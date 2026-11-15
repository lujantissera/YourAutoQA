// Test de integración: necesita el Postgres de `docker compose up -d`.
// Uso (desde backend/): npx vitest run src/jobs/job-resume.integration.test.ts
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres';
import { Pool } from 'pg';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { AgentConfig } from '../agent/config.js';
import { buildGraph } from '../agent/graph.js';
import type { RunResult, UserStory } from '../agent/ports.js';
import { FakeLlm, FakeRunner } from '../agent/testing/fakes.js';
import { loadDatabaseUrl } from '../db/config.js';
import { migrate } from '../db/migrate.js';
import { FakeJira } from '../jira/testing/fakes.js';
import { JobService } from './job-service.js';
import { PostgresJobRepository } from './postgres-job-repository.js';

// El .env está en la raíz del repo (tres carpetas por encima de este archivo).
try {
  process.loadEnvFile(fileURLToPath(new URL('../../../.env', import.meta.url)));
} catch {
  // sin .env: puede que las variables ya vengan del entorno
}

const databaseUrl = loadDatabaseUrl(process.env);
const adminPool = new Pool({ connectionString: databaseUrl });
const migrationsDirectory = fileURLToPath(new URL('../../migrations', import.meta.url));

const story: UserStory = {
  key: 'YAQ-1',
  summary: 'Iniciar sesión con credenciales válidas',
  description: 'Como usuario registrado quiero iniciar sesión.',
  acceptanceCriteria: null,
};
const config: AgentConfig = {
  maxAttempts: 5,
  maxTokens: 50_000,
  executionTimeoutSeconds: 120,
  maxClarifications: 3,
  storyCheck: true,
};
const pass: RunResult = { result: 'PASS', logs: 'ok', timedOut: false };
const notReady = JSON.stringify({ ready: false, question: '¿Qué credenciales hay que usar?' });
const robot = '*** Test Cases ***\nTest 1';
const answer = 'Con el usuario standard_user y la contraseña secret_sauce';

// Cada test trabaja en su propio "cajón" (schema), con las tablas de jobs y las del agente.
let schema: string;
let pool: Pool;

beforeEach(async () => {
  schema = `test_${randomUUID().replaceAll('-', '')}`;
  await adminPool.query(`CREATE SCHEMA ${schema}`);
  pool = new Pool({ connectionString: databaseUrl, options: `-c search_path=${schema}` });
  await migrate(pool, migrationsDirectory);
});

afterEach(async () => {
  await pool.end();
  await adminPool.query(`DROP SCHEMA ${schema} CASCADE`);
});

afterAll(async () => {
  await adminPool.end();
});

// Simula UN arranque del servidor: guardador, grafo y servicio nuevos, sin ninguna memoria previa.
// Lo único compartido entre arranques es la base de datos, como pasa en la realidad.
async function startServer(llmTexts: string[], runs: RunResult[]) {
  const checkpointer = PostgresSaver.fromConnString(databaseUrl, { schema });
  await checkpointer.setup();
  const graph = buildGraph(
    { llm: new FakeLlm(llmTexts), runner: new FakeRunner(runs), config },
    checkpointer,
  );
  const service = new JobService({
    jira: new FakeJira({ 'YAQ-1': story }),
    repository: new PostgresJobRepository(pool),
    graph,
  });
  return { service, stop: () => checkpointer.end() };
}

describe('reanudar un job pausado tras reiniciar el servidor (D-32, US-10.6)', () => {
  it('el job pausado conserva su estado y llega a done al responder en el segundo arranque', async () => {
    // Primer arranque: el agente se pausa preguntando.
    const first = await startServer([notReady], []);
    const { id } = await first.service.createJob('YAQ-1');
    await first.service.idle();
    expect((await first.service.getJob(id))?.status).toBe('awaiting_clarification');
    await first.stop(); // el servidor se apaga: se pierde todo lo que había en su memoria

    // Segundo arranque: no sabe nada de ese job salvo lo que haya en la base de datos.
    const second = await startServer([robot], [pass]);
    await second.service.clarify(id, answer);
    await second.service.idle();

    expect(await second.service.getJob(id)).toMatchObject({ status: 'done', question: null });
    await second.stop();
  });
});
