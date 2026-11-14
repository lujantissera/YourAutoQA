import { afterEach, describe, expect, it } from 'vitest';
import type { AttemptRecord } from '../agent/state.js';
import type { JobRepository } from './job-repository.js';

// El "contrato" de JobRepository: lo que debe cumplir CUALQUIER implementación (en memoria,
// Postgres...). Cada implementación tiene su archivo de test que llama a esta función; si todas
// pasan lo mismo, son intercambiables y quien las usa no nota la diferencia.

export interface RepositoryOptions {
  newId?: () => string;
  now?: () => Date;
}

export interface RepositoryHarness {
  repository: JobRepository;
  /** Limpieza al terminar cada test (p. ej. borrar el schema de la base de datos). */
  dispose?: () => Promise<void>;
}

export type CreateHarness = (
  options: RepositoryOptions,
) => RepositoryHarness | Promise<RepositoryHarness>;

// Un UUID válido y fijo: Postgres no aceptaría un id cualquiera como 'job-1'.
const JOB_ID = '11111111-1111-4111-8111-111111111111';
const input = { issueKey: 'YAQ-1', summary: 'Iniciar sesión con credenciales válidas' };
const createdAt = new Date('2026-11-10T10:00:00Z');

const attempt = (id: number, overrides: Partial<AttemptRecord> = {}): AttemptRecord => ({
  id,
  attempt: id,
  robotCode: `*** Test Cases ***\nTest ${id}`,
  run: { result: 'FAIL', logs: `error ${id}`, timedOut: false },
  failureKind: null,
  ...overrides,
});

export function describeJobRepositoryContract(name: string, createHarness: CreateHarness): void {
  describe(`${name} (contrato de JobRepository)`, () => {
    // Cada test abre su propio repositorio; al terminar se limpia todo lo que se abrió.
    const opened: RepositoryHarness[] = [];
    const open = async (options: RepositoryOptions = {}): Promise<JobRepository> => {
      const harness = await createHarness(options);
      opened.push(harness);
      return harness.repository;
    };
    // Con id y hora fijos los resultados son predecibles.
    const openFixed = () => open({ newId: () => JOB_ID, now: () => createdAt });

    afterEach(async () => {
      for (const harness of opened.splice(0)) await harness.dispose?.();
    });

    it('create asigna id y fecha, guarda la clave y el título, y deja el resto en su valor inicial', async () => {
      const repository = await openFixed();

      expect(await repository.create(input)).toEqual({
        id: JOB_ID,
        issueKey: 'YAQ-1',
        summary: 'Iniciar sesión con credenciales válidas',
        status: 'generating',
        attempts: [],
        tokensUsed: 0,
        question: null,
        failureReason: null,
        createdAt,
      });
    });

    it('dos jobs reciben ids distintos con formato UUID', async () => {
      const repository = await open();

      const first = await repository.create(input);
      const second = await repository.create(input);

      expect(first.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
      expect(second.id).not.toBe(first.id);
    });

    it('get devuelve el job creado y undefined si el id no existe', async () => {
      const repository = await openFixed();
      const created = await repository.create(input);

      expect(await repository.get(created.id)).toEqual(created);
      expect(await repository.get('22222222-2222-4222-8222-222222222222')).toBeUndefined();
    });

    // En la base de datos `id` es de tipo uuid: sin una comprobación previa, Postgres lanzaría un
    // error en vez de "no existe", y GET /jobs/no-existe acabaría en un 500 en lugar de un 404.
    it('un id que no tiene formato de UUID es "no existe": get devuelve undefined y update falla', async () => {
      const repository = await openFixed();

      expect(await repository.get('no-existe')).toBeUndefined();
      await expect(repository.update('no-existe', { status: 'done' })).rejects.toThrow(/no-existe/);
    });

    it('update mezcla los cambios, devuelve el job actualizado y conserva lo que no se toca', async () => {
      const repository = await openFixed();
      await repository.create(input);

      const updated = await repository.update(JOB_ID, { status: 'running', tokensUsed: 1200 });

      expect(updated).toMatchObject({
        status: 'running',
        tokensUsed: 1200,
        issueKey: 'YAQ-1',
        createdAt,
      });
      expect(await repository.get(JOB_ID)).toEqual(updated);
    });

    it('update con un UUID que no existe falla', async () => {
      const repository = await openFixed();

      await expect(
        repository.update('22222222-2222-4222-8222-222222222222', { status: 'done' }),
      ).rejects.toThrow(/22222222-2222-4222-8222-222222222222/);
    });

    it('devuelve copias: modificar el job recibido no cambia lo guardado', async () => {
      const repository = await openFixed();
      const created = await repository.create(input);

      created.tokensUsed = 99;
      created.status = 'done';

      expect(await repository.get(JOB_ID)).toMatchObject({ tokensUsed: 0, status: 'generating' });
    });

    it('update guarda los intentos y se leen idénticos (US-07.4)', async () => {
      const repository = await openFixed();
      await repository.create(input);
      const attempts = [
        attempt(1, { failureKind: 'technical' }),
        attempt(2, { run: { result: 'PASS', logs: 'ok', timedOut: false } }),
      ];

      const updated = await repository.update(JOB_ID, { attempts });

      expect(updated.attempts).toEqual(attempts);
      expect((await repository.get(JOB_ID))?.attempts).toEqual(attempts);
    });

    it('un segundo update con la lista de intentos actualiza los existentes y añade los nuevos, sin duplicar', async () => {
      const repository = await openFixed();
      await repository.create(input);
      await repository.update(JOB_ID, { attempts: [attempt(1), attempt(2)] });

      // El servicio manda la lista completa tras cada paso: el 1 cambia, el 2 igual, el 3 es nuevo.
      const next = [
        attempt(1, { failureKind: 'technical' }),
        attempt(2),
        attempt(3, { run: { result: 'PASS', logs: 'ok', timedOut: false } }),
      ];
      await repository.update(JOB_ID, { attempts: next });

      expect((await repository.get(JOB_ID))?.attempts).toEqual(next);
    });

    it('un update sin intentos conserva los que ya había', async () => {
      const repository = await openFixed();
      await repository.create(input);
      await repository.update(JOB_ID, { attempts: [attempt(1)] });

      await repository.update(JOB_ID, { status: 'running' });

      expect((await repository.get(JOB_ID))?.attempts).toEqual([attempt(1)]);
    });

    it('la pregunta y el motivo del fallo se pueden poner y volver a dejar en null', async () => {
      const repository = await openFixed();
      await repository.create(input);

      await repository.update(JOB_ID, {
        question: '¿Qué credenciales uso?',
        failureReason: 'Motivo',
      });
      expect(await repository.get(JOB_ID)).toMatchObject({
        question: '¿Qué credenciales uso?',
        failureReason: 'Motivo',
      });

      await repository.update(JOB_ID, { question: null, failureReason: null });
      expect(await repository.get(JOB_ID)).toMatchObject({ question: null, failureReason: null });
    });
  });
}
