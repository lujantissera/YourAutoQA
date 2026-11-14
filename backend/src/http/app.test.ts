import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import type { AgentConfig } from '../agent/config.js';
import { buildGraph } from '../agent/graph.js';
import type { JiraPort, RunResult, UserStory } from '../agent/ports.js';
import { FakeLlm, FakeRunner } from '../agent/testing/fakes.js';
import { JiraError, type JiraErrorKind } from '../jira/errors.js';
import { FakeJira } from '../jira/testing/fakes.js';
import { InMemoryJobRepository } from '../jobs/in-memory-job-repository.js';
import { JobService } from '../jobs/job-service.js';
import { createApp } from './app.js';

const story: UserStory = {
  key: 'YAQ-1',
  summary: 'Iniciar sesión con credenciales válidas',
  description: 'Como usuario registrado quiero iniciar sesión.',
  acceptanceCriteria: 'Dado un usuario en el login\nEntonces ve la página de productos',
};

const config: AgentConfig = {
  maxAttempts: 5,
  maxTokens: 50_000,
  executionTimeoutSeconds: 120,
  maxClarifications: 3,
  storyCheck: false,
};
const pass: RunResult = { result: 'PASS', logs: 'ok', timedOut: false };

interface SetupOptions {
  jira?: JiraPort;
  onError?: (error: unknown) => void;
}

// La aplicación completa con el servicio real y dobles de Jira, LLM y runner. `supertest` hace las
// peticiones directamente a `app`, sin abrir ningún puerto.
function setup(options: SetupOptions = {}) {
  const graph = buildGraph({
    llm: new FakeLlm(['*** Test Cases ***\nTest 1']),
    runner: new FakeRunner([pass]),
    config,
  });
  const jobService = new JobService({
    jira: options.jira ?? new FakeJira({ 'YAQ-1': story }),
    repository: new InMemoryJobRepository(),
    graph,
  });
  const app = createApp({ jobService, onError: options.onError });
  return { app, jobService };
}

// Un Jira que falla siempre con el error que se le diga.
const failingJira = (error: unknown): JiraPort => ({
  getUserStory: async () => {
    throw error;
  },
});

describe('POST /jobs (RF-3, RNF-3)', () => {
  it('con una clave válida responde 202 con el job y la cabecera Location', async () => {
    const { app, jobService } = setup();

    const response = await request(app).post('/jobs').send({ issueKey: 'YAQ-1' });
    await jobService.idle();

    expect(response.status).toBe(202);
    expect(response.body).toMatchObject({
      issueKey: 'YAQ-1',
      summary: 'Iniciar sesión con credenciales válidas',
      status: 'generating',
    });
    expect(response.headers.location).toBe(`/jobs/${response.body.id}`);
  });

  it('una clave con formato inválido responde 400 invalid_key (US-03.4)', async () => {
    const { app } = setup();

    const response = await request(app).post('/jobs').send({ issueKey: 'no es una clave' });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('invalid_key');
  });

  it('una US que no existe responde 404 not_found (US-04.1)', async () => {
    const { app } = setup();

    const response = await request(app).post('/jobs').send({ issueKey: 'YAQ-999' });

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('not_found');
  });

  it.each<[JiraErrorKind, number]>([
    ['forbidden', 403],
    ['unavailable', 502],
  ])(
    'un error de Jira %s responde %i con nuestro mensaje (US-04.2, US-04.5)',
    async (kind, status) => {
      const { app } = setup({ jira: failingJira(new JiraError(kind, 'Mensaje limpio')) });

      const response = await request(app).post('/jobs').send({ issueKey: 'YAQ-1' });

      expect(response.status).toBe(status);
      expect(response.body).toEqual({ error: { code: kind, message: 'Mensaje limpio' } });
    },
  );

  it.each([{}, { issueKey: 42 }, { issueKey: null }, undefined])(
    'un cuerpo sin issueKey de texto responde 400 invalid_request: %j',
    async (body) => {
      const { app } = setup();

      const response = await request(app).post('/jobs').send(body);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('invalid_request');
    },
  );

  it('un JSON mal formado responde 400 invalid_request', async () => {
    const { app } = setup();

    const response = await request(app)
      .post('/jobs')
      .set('Content-Type', 'application/json')
      .send('{esto no es json');

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('invalid_request');
  });

  it('una excepción inesperada responde 500 con un mensaje genérico y avisa a onError (US-04.6)', async () => {
    const original = new Error('boom: secret-detail');
    const onError = vi.fn();
    const { app } = setup({ jira: failingJira(original), onError });

    const response = await request(app).post('/jobs').send({ issueKey: 'YAQ-1' });

    expect(response.status).toBe(500);
    expect(response.body.error.code).toBe('internal_error');
    expect(JSON.stringify(response.body)).not.toContain('secret-detail');
    expect(onError).toHaveBeenCalledWith(original);
  });
});

describe('GET /jobs/:id', () => {
  it('devuelve el job con su estado actual (US-07.5)', async () => {
    const { app, jobService } = setup();
    const created = await request(app).post('/jobs').send({ issueKey: 'YAQ-1' });
    await jobService.idle();

    const response = await request(app).get(`/jobs/${created.body.id}`);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ id: created.body.id, issueKey: 'YAQ-1', status: 'done' });
    expect(response.body.attempts).toHaveLength(1);
  });

  it('con un id desconocido responde 404 job_not_found', async () => {
    const { app } = setup();

    const response = await request(app).get('/jobs/no-existe');

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('job_not_found');
  });
});
