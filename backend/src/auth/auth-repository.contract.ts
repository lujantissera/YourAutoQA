import { afterEach, describe, expect, it } from 'vitest';
import type { AuthRepository } from './auth-repository.js';
import type { ExternalProfile } from './user.js';

// El "contrato" de AuthRepository (igual que el de JobRepository): lo que debe cumplir CUALQUIER
// implementación. La versión en memoria y la de Postgres pasan exactamente estos tests.

export interface AuthRepositoryOptions {
  newId?: () => string;
}

export interface AuthRepositoryHarness {
  repository: AuthRepository;
  dispose?: () => Promise<void>;
}

export type CreateAuthHarness = (
  options: AuthRepositoryOptions,
) => AuthRepositoryHarness | Promise<AuthRepositoryHarness>;

// Postgres solo acepta UUIDs válidos como id.
const uuid = (n: number): string => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const profile: ExternalProfile = {
  provider: 'atlassian',
  providerAccountId: 'acc-1',
  email: 'lujan@example.com',
  displayName: 'Lujan',
  avatarUrl: 'https://example.com/a.png',
};

const T0 = new Date('2026-11-25T10:00:00Z');
const inHours = (hours: number): Date => new Date(T0.getTime() + hours * 3_600_000);

export function describeAuthRepositoryContract(
  name: string,
  createHarness: CreateAuthHarness,
): void {
  describe(`${name} (contrato de AuthRepository)`, () => {
    const opened: AuthRepositoryHarness[] = [];
    const open = async (): Promise<AuthRepository> => {
      let counter = 0;
      const harness = await createHarness({ newId: () => uuid(++counter) });
      opened.push(harness);
      return harness.repository;
    };

    afterEach(async () => {
      for (const harness of opened.splice(0)) await harness.dispose?.();
    });

    describe('upsertUser', () => {
      it('crea el usuario con el rol inicial y su cuenta vinculada (US-01.3)', async () => {
        const repo = await open();
        const user = await repo.upsertUser(profile, 'QA Executer');
        expect(user).toMatchObject({
          email: 'lujan@example.com',
          displayName: 'Lujan',
          avatarUrl: 'https://example.com/a.png',
          role: 'QA Executer',
        });
        expect(user.id).toBe(uuid(1));
      });

      it('acepta el rol Pending: es el que reciben los usuarios nuevos (D-64)', async () => {
        const repo = await open();
        const user = await repo.upsertUser(profile, 'Pending');
        expect(user.role).toBe('Pending');
        expect((await repo.setRole(user.id, 'QA Executer'))?.role).toBe('QA Executer');
        expect((await repo.setRole(user.id, 'Pending'))?.role).toBe('Pending');
      });

      it('la segunda vez devuelve el mismo usuario y NO cambia su rol', async () => {
        const repo = await open();
        const first = await repo.upsertUser(profile, 'QA Executer');
        await repo.setRole(first.id, 'QA Controller');

        // Aunque ahora se pida "Admin" como rol inicial, el usuario ya existe: el rol se respeta.
        const second = await repo.upsertUser(profile, 'Admin');
        expect(second.id).toBe(first.id);
        expect(second.role).toBe('QA Controller');
      });

      it('actualiza nombre, email y avatar con los datos más recientes de Atlassian', async () => {
        const repo = await open();
        await repo.upsertUser(profile, 'QA Executer');
        const updated = await repo.upsertUser(
          { ...profile, displayName: 'Lujan T.', email: 'nuevo@example.com', avatarUrl: null },
          'QA Executer',
        );
        expect(updated).toMatchObject({
          displayName: 'Lujan T.',
          email: 'nuevo@example.com',
          avatarUrl: null,
        });
      });

      it('cuentas de Atlassian distintas son usuarios distintos', async () => {
        const repo = await open();
        const a = await repo.upsertUser(profile, 'QA Executer');
        const b = await repo.upsertUser({ ...profile, providerAccountId: 'acc-2' }, 'QA Executer');
        expect(b.id).not.toBe(a.id);
      });
    });

    describe('sesiones', () => {
      it('encuentra al usuario de una sesión vigente', async () => {
        const repo = await open();
        const user = await repo.upsertUser(profile, 'QA Controller');
        await repo.createSession({ tokenHash: 'h1', userId: user.id, expiresAt: inHours(12) });

        expect(await repo.findSessionUser('h1', T0)).toEqual(user);
      });

      it('no encuentra una sesión caducada (US-01.5)', async () => {
        const repo = await open();
        const user = await repo.upsertUser(profile, 'QA Executer');
        await repo.createSession({ tokenHash: 'h1', userId: user.id, expiresAt: inHours(1) });

        expect(await repo.findSessionUser('h1', inHours(2))).toBeNull();
      });

      it('no encuentra una sesión que no existe', async () => {
        const repo = await open();
        expect(await repo.findSessionUser('nada', T0)).toBeNull();
      });

      it('deleteSession cierra la sesión (logout)', async () => {
        const repo = await open();
        const user = await repo.upsertUser(profile, 'QA Executer');
        await repo.createSession({ tokenHash: 'h1', userId: user.id, expiresAt: inHours(12) });
        await repo.deleteSession('h1');

        expect(await repo.findSessionUser('h1', T0)).toBeNull();
        // Cerrar una sesión que ya no existe no es un error.
        await expect(repo.deleteSession('h1')).resolves.toBeUndefined();
      });

      it('un cambio de rol se nota en la sesión ya abierta', async () => {
        const repo = await open();
        const user = await repo.upsertUser(profile, 'QA Executer');
        await repo.createSession({ tokenHash: 'h1', userId: user.id, expiresAt: inHours(12) });
        await repo.setRole(user.id, 'Admin');

        expect((await repo.findSessionUser('h1', T0))?.role).toBe('Admin');
      });
    });

    describe('administración', () => {
      it('setRole cambia el rol y devuelve el usuario; null si no existe', async () => {
        const repo = await open();
        const user = await repo.upsertUser(profile, 'QA Executer');

        expect((await repo.setRole(user.id, 'Admin'))?.role).toBe('Admin');
        expect(await repo.setRole(uuid(999), 'Admin')).toBeNull();
        expect(await repo.setRole('no-es-un-uuid', 'Admin')).toBeNull();
      });

      it('listUsers devuelve todos los usuarios, los más antiguos primero', async () => {
        const repo = await open();
        await repo.upsertUser(profile, 'Admin');
        await repo.upsertUser(
          { ...profile, providerAccountId: 'acc-2', email: 'b@x.com' },
          'QA Executer',
        );

        const users = await repo.listUsers();
        expect(users.map((u) => u.email)).toEqual(['lujan@example.com', 'b@x.com']);
      });
    });
  });
}
