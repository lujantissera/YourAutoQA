import { describe, expect, it } from 'vitest';
import { AuthService } from './auth-service.js';
import { AuthError } from './errors.js';
import { InMemoryAuthRepository } from './in-memory-auth-repository.js';
import { FakeAtlassian } from './testing/fakes.js';
import type { ExternalProfile } from './user.js';

const ana: ExternalProfile = {
  provider: 'atlassian',
  providerAccountId: 'acc-ana',
  email: 'ana@x.com',
  displayName: 'Ana',
  avatarUrl: null,
};

function setup(options: { adminEmails?: string[]; now?: () => Date; ttlHours?: number } = {}) {
  const repository = new InMemoryAuthRepository();
  const atlassian = new FakeAtlassian({ good: ana });
  const service = new AuthService({
    repository,
    atlassian,
    sessionTtlHours: options.ttlHours ?? 12,
    adminEmails: options.adminEmails ?? [],
    now: options.now,
  });
  return { service, repository, atlassian };
}

describe('AuthService', () => {
  describe('startLogin', () => {
    it('devuelve un state distinto cada vez y la URL de Atlassian que lo lleva', () => {
      const { service } = setup();
      const a = service.startLogin();
      const b = service.startLogin();
      expect(a.state).not.toBe(b.state);
      expect(a.url).toContain(`state=${a.state}`);
    });
  });

  describe('completeLogin', () => {
    it('crea el usuario con rol Pending y abre una sesión (US-01.2, US-01.3)', async () => {
      const { service } = setup();
      const { token, user } = await service.completeLogin('good');

      expect(user).toMatchObject({ email: 'ana@x.com', role: 'Pending' });
      expect((await service.authenticate(token))?.id).toBe(user.id);
    });

    it('un código que Atlassian rechaza no crea ni usuario ni sesión', async () => {
      const { service, repository } = setup();
      await expect(service.completeLogin('bad')).rejects.toBeInstanceOf(AuthError);
      expect(await repository.listUsers()).toEqual([]);
    });

    it('el segundo login reutiliza al usuario y conserva el rol que le dio un Admin', async () => {
      const { service, repository } = setup();
      const first = await service.completeLogin('good');
      await repository.setRole(first.user.id, 'QA Controller');

      const second = await service.completeLogin('good');
      expect(second.user.id).toBe(first.user.id);
      expect(second.user.role).toBe('QA Controller');
      expect(second.token).not.toBe(first.token);
    });
  });

  describe('authenticate', () => {
    it('sin token o con un token desconocido no hay usuario', async () => {
      const { service } = setup();
      expect(await service.authenticate(undefined)).toBeNull();
      expect(await service.authenticate('inventado')).toBeNull();
    });

    it('la sesión caduca pasado el tiempo configurado (US-01.5)', async () => {
      let now = new Date('2026-11-25T10:00:00Z');
      const { service } = setup({ ttlHours: 2, now: () => now });
      const { token } = await service.completeLogin('good');

      now = new Date('2026-11-25T11:59:00Z');
      expect(await service.authenticate(token)).not.toBeNull();
      now = new Date('2026-11-25T12:01:00Z');
      expect(await service.authenticate(token)).toBeNull();
    });
  });

  describe('logout', () => {
    it('cierra la sesión: el mismo token deja de valer', async () => {
      const { service } = setup();
      const { token } = await service.completeLogin('good');
      await service.logout(token);
      expect(await service.authenticate(token)).toBeNull();
    });

    it('cerrar sin token no es un error', async () => {
      const { service } = setup();
      await expect(service.logout(undefined)).resolves.toBeUndefined();
    });
  });

  describe('administración de roles', () => {
    it('changeRole cambia el rol de otro usuario', async () => {
      const { service, repository } = setup();
      const actor = (await service.completeLogin('good')).user;
      const target = await repository.upsertUser(
        { ...ana, providerAccountId: 'acc-2' },
        'QA Executer',
      );

      const updated = await service.changeRole(actor.id, target.id, 'QA Controller');
      expect(updated.role).toBe('QA Controller');
    });

    it('un Admin no puede cambiarse el rol a sí mismo (evita quedarse sin Admins)', async () => {
      const { service } = setup();
      const actor = (await service.completeLogin('good')).user;
      await expect(service.changeRole(actor.id, actor.id, 'QA Executer')).rejects.toMatchObject({
        kind: 'cannot_change_own_role',
      });
    });

    it('cambiar el rol de un usuario que no existe es user_not_found', async () => {
      const { service } = setup();
      await expect(
        service.changeRole('quien-sea', '00000000-0000-4000-8000-000000000999', 'Admin'),
      ).rejects.toMatchObject({ kind: 'user_not_found' });
    });

    it('listUsers devuelve los usuarios', async () => {
      const { service } = setup();
      await service.completeLogin('good');
      expect((await service.listUsers()).map((u) => u.email)).toEqual(['ana@x.com']);
    });
  });
});
