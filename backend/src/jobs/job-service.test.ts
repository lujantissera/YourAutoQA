import { describe, expect, it, vi } from 'vitest';
import type { AgentConfig } from '../agent/config.js';
import { buildGraph } from '../agent/graph.js';
import type { RunnerPort, RunResult, UserStory } from '../agent/ports.js';
import { FakeLlm, FakeRunner } from '../agent/testing/fakes.js';
import { FakeJira } from '../jira/testing/fakes.js';
import { storyToPrompt } from '../jira/story-text.js';
import { InMemoryJobRepository } from './in-memory-job-repository.js';
import { JobService } from './job-service.js';

const story: UserStory = {
  key: 'YAQ-1',
  summary: 'Iniciar sesión con credenciales válidas',
  description: 'Como usuario registrado quiero iniciar sesión.',
  acceptanceCriteria: 'Dado un usuario en el login\nEntonces ve la página de productos',
};

// storyCheck desactivado por defecto: así los tests no cuentan esa llamada al LLM.
const baseConfig: AgentConfig = {
  maxAttempts: 5,
  maxTokens: 50_000,
  executionTimeoutSeconds: 120,
  maxClarifications: 3,
  storyCheck: false,
};
const pass: RunResult = { result: 'PASS', logs: 'ok', timedOut: false };
// Respuesta de LLM que es un .robot válido (si no, el agente la trata como no interpretable).
const code = (n: number) => `*** Test Cases ***\nTest ${n}`;

interface SetupOptions {
  config?: Partial<AgentConfig>;
  runner?: RunnerPort;
  onError?: (error: unknown) => void;
}

// Prepara el servicio con el grafo real y dobles de Jira, LLM y runner (nunca OpenAI ni Docker).
function setup(llmTexts: string[], runs: RunResult[], options: SetupOptions = {}) {
  const llm = new FakeLlm(llmTexts);
  const runner = options.runner ?? new FakeRunner(runs);
  const graph = buildGraph({ llm, runner, config: { ...baseConfig, ...options.config } });
  const repository = new InMemoryJobRepository();
  const jira = new FakeJira({ 'YAQ-1': story });
  const service = new JobService({ jira, repository, graph, onError: options.onError });
  return { llm, jira, repository, service };
}

describe('JobService (RF-3, RNF-3)', () => {
  it('createJob pide la US a Jira y devuelve un job nuevo sin esperar al agente', async () => {
    const { jira, service } = setup([code(1)], [pass]);

    const job = await service.createJob('YAQ-1');
    await service.idle();

    expect(jira.calls).toEqual(['YAQ-1']);
    expect(job).toMatchObject({
      issueKey: 'YAQ-1',
      summary: 'Iniciar sesión con credenciales válidas',
      status: 'generating',
    });
  });

  it('el agente recibe el texto de la historia: clave, descripción y criterios', async () => {
    const { llm, service } = setup([code(1)], [pass]);

    await service.createJob('YAQ-1');
    await service.idle();

    expect(llm.calls[0]?.user).toContain(storyToPrompt(story));
  });

  it('al terminar con PASS, el job queda en done con su intento y los tokens', async () => {
    const { service } = setup([code(1)], [pass]);

    const { id } = await service.createJob('YAQ-1');
    await service.idle();

    const job = await service.getJob(id);
    expect(job?.status).toBe('done');
    expect(job?.attempts).toHaveLength(1);
    expect(job?.attempts[0]?.run.result).toBe('PASS');
    expect(job?.tokensUsed).toBeGreaterThan(0);
  });

  it('una US poco clara deja el job en awaiting_clarification con la pregunta (US-10)', async () => {
    const question = '¿Qué credenciales hay que usar?';
    const { service } = setup([JSON.stringify({ ready: false, question })], [], {
      config: { storyCheck: true },
    });

    const { id } = await service.createJob('YAQ-1');
    await service.idle();

    expect(await service.getJob(id)).toMatchObject({ status: 'awaiting_clarification', question });
  });

  it('guarda el progreso mientras el agente trabaja (US-07.5)', async () => {
    let release: (result: RunResult) => void = () => undefined;
    const blockedRunner: RunnerPort = {
      run: () =>
        new Promise<RunResult>((resolve) => {
          release = resolve;
        }),
    };
    const { service } = setup([code(1)], [], { runner: blockedRunner });

    const { id } = await service.createJob('YAQ-1');

    // El runner sigue bloqueado, pero la generación ya terminó y sus tokens ya están en el job.
    await vi.waitFor(async () => {
      expect((await service.getJob(id))?.tokensUsed).toBeGreaterThan(0);
    });
    expect((await service.getJob(id))?.status).toBe('generating');

    release(pass);
    await service.idle();
    expect((await service.getJob(id))?.status).toBe('done');
  });

  it('si Jira falla, createJob rechaza con ese error y no crea el job ni llama al LLM (RF-3, US-04.4)', async () => {
    const { llm, repository, service } = setup([code(1)], [pass]);
    const create = vi.spyOn(repository, 'create');

    await expect(service.createJob('YAQ-999')).rejects.toMatchObject({
      name: 'JiraError',
      kind: 'not_found',
    });

    expect(create).not.toHaveBeenCalled();
    expect(llm.calls).toHaveLength(0);
  });

  it('si el agente lanza una excepción, el job pasa a fail con un motivo limpio y se avisa con onError', async () => {
    const original = new Error('docker exploded: secret-detail');
    const brokenRunner: RunnerPort = {
      run: async () => {
        throw original;
      },
    };
    const onError = vi.fn();
    const { service } = setup([code(1)], [], { runner: brokenRunner, onError });

    const { id } = await service.createJob('YAQ-1');
    await service.idle();

    const job = await service.getJob(id);
    expect(job?.status).toBe('fail');
    expect(job?.failureReason).toMatch(/internal error/i);
    expect(job?.failureReason).not.toContain('secret-detail');
    expect(onError).toHaveBeenCalledWith(original);
  });

  it('getJob devuelve el job y, con un id desconocido, undefined', async () => {
    const { service } = setup([code(1)], [pass]);

    const { id } = await service.createJob('YAQ-1');
    await service.idle();

    expect(await service.getJob(id)).toMatchObject({ id, issueKey: 'YAQ-1' });
    expect(await service.getJob('no-existe')).toBeUndefined();
  });
});

describe('JobService.clarify (RF-9, US-11)', () => {
  const question = '¿Qué credenciales hay que usar?';
  const notReady = JSON.stringify({ ready: false, question });
  const answer = 'Con el usuario standard_user y la contraseña secret_sauce';

  // Un job que el agente ha pausado para preguntar: el comprobador de la US (storyCheck) dice
  // que falta información. Tras la respuesta, el agente genera el test y lo ejecuta.
  async function pausedJob() {
    const context = setup([notReady, code(1)], [pass], { config: { storyCheck: true } });
    const { id } = await context.service.createJob('YAQ-1');
    await context.service.idle();
    expect((await context.service.getJob(id))?.status).toBe('awaiting_clarification');
    return { ...context, id };
  }

  it('reanuda el job pausado con la respuesta del usuario y llega a done', async () => {
    const { llm, service, id } = await pausedJob();

    await service.clarify(id, answer);
    await service.idle();

    expect(await service.getJob(id)).toMatchObject({ status: 'done', question: null });
    // Las llamadas al LLM: 0 = comprobar la US, 1 = generar el test, ya con la respuesta dentro.
    expect(llm.calls[1]?.user).toContain(answer);
  });

  it('devuelve el job al instante, en generating y sin la pregunta antigua', async () => {
    const { service, id } = await pausedJob();

    const job = await service.clarify(id, answer);
    await service.idle();

    expect(job).toMatchObject({ id, status: 'generating', question: null });
  });

  it('con un id que no existe falla con job_not_found', async () => {
    const { service } = await pausedJob();

    await expect(
      service.clarify('22222222-2222-4222-8222-222222222222', answer),
    ).rejects.toMatchObject({ name: 'JobError', kind: 'job_not_found' });
  });

  it('si el job no está esperando una respuesta falla con not_awaiting_clarification y no reanuda al agente', async () => {
    const { llm, service } = setup([code(1)], [pass]);
    const { id } = await service.createJob('YAQ-1');
    await service.idle(); // el job termina en done sin preguntar nada

    await expect(service.clarify(id, answer)).rejects.toMatchObject({
      name: 'JobError',
      kind: 'not_awaiting_clarification',
    });
    expect(llm.calls).toHaveLength(1); // solo la generación original
  });

  it('dos respuestas seguidas: la segunda se rechaza y el agente se reanuda una sola vez', async () => {
    const { llm, service, id } = await pausedJob();

    const first = service.clarify(id, answer);
    await expect(service.clarify(id, 'otra respuesta')).rejects.toMatchObject({
      kind: 'not_awaiting_clarification',
    });
    await first;
    await service.idle();

    expect(llm.calls).toHaveLength(2); // comprobar la US + generar: ninguna llamada de más
  });
});
