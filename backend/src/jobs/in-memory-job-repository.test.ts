import { describe, expect, it } from 'vitest';
import { InMemoryJobRepository } from './in-memory-job-repository.js';

const input = { issueKey: 'YAQ-1', summary: 'Iniciar sesión con credenciales válidas' };
const createdAt = new Date('2026-11-10T10:00:00Z');

// Con id y hora fijos los resultados son predecibles.
const fixedRepository = () =>
  new InMemoryJobRepository({ newId: () => 'job-1', now: () => createdAt });

describe('InMemoryJobRepository', () => {
  it('create asigna id y fecha, guarda la clave y el título, y deja el resto en su valor inicial', async () => {
    expect(await fixedRepository().create(input)).toEqual({
      id: 'job-1',
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
    const repository = new InMemoryJobRepository();

    const first = await repository.create(input);
    const second = await repository.create(input);

    expect(first.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    expect(second.id).not.toBe(first.id);
  });

  it('get devuelve el job creado y undefined si el id no existe', async () => {
    const repository = fixedRepository();
    const created = await repository.create(input);

    expect(await repository.get(created.id)).toEqual(created);
    expect(await repository.get('no-existe')).toBeUndefined();
  });

  it('update mezcla los cambios, devuelve el job actualizado y conserva lo que no se toca', async () => {
    const repository = fixedRepository();
    await repository.create(input);

    const updated = await repository.update('job-1', { status: 'running', tokensUsed: 1200 });

    expect(updated).toMatchObject({
      status: 'running',
      tokensUsed: 1200,
      issueKey: 'YAQ-1',
      createdAt,
    });
    expect(await repository.get('job-1')).toEqual(updated);
  });

  it('update con un id que no existe falla', async () => {
    await expect(fixedRepository().update('no-existe', { status: 'done' })).rejects.toThrow(
      /no-existe/,
    );
  });

  it('devuelve copias: modificar el job recibido no cambia lo guardado', async () => {
    const repository = fixedRepository();
    const created = await repository.create(input);

    created.tokensUsed = 99;
    created.status = 'done';

    expect(await repository.get('job-1')).toMatchObject({ tokensUsed: 0, status: 'generating' });
  });
});
