// Punto de entrada del servidor: aquí se conectan las piezas REALES (Jira, OpenAI, Docker) a la API.
// No lleva tests porque solo cablea lo que ya está probado por separado con dobles; se verifica
// arrancándolo (`npm run dev` desde backend/) y haciendo peticiones con curl.
import { fileURLToPath } from 'node:url';
import { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres';
import OpenAI from 'openai';
import { Pool } from 'pg';
import { loadAgentConfig } from './agent/config.js';
import { buildGraph } from './agent/graph.js';
import { loadDatabaseUrl } from './db/config.js';
import { migrate } from './db/migrate.js';
import { createApp } from './http/app.js';
import { loadJiraConfig } from './jira/config.js';
import { RestJira } from './jira/rest-jira.js';
import { JobService } from './jobs/job-service.js';
import { PostgresJobRepository } from './jobs/postgres-job-repository.js';
import { loadOpenAiConfig } from './llm/config.js';
import { OpenAiLlm } from './llm/openai-llm.js';
import { loadRunnerConfig } from './runner/config.js';
import { DockerRunner } from './runner/docker-runner.js';

// El .env está en la raíz del repo, fuera de backend/.
try {
  process.loadEnvFile('../.env');
} catch {
  // sin .env: puede que las variables ya vengan del entorno
}

// Hasta la Fase 5 la API no tiene login: escucha solo en este equipo (no en toda la red) para que
// nadie más pueda crear jobs y gastar tokens de OpenAI.
const HOST = '127.0.0.1';
const port = Number(process.env.PORT ?? 3000);
if (!Number.isInteger(port) || port < 1 || port > 65_535) {
  throw new Error('PORT must be an integer between 1 and 65535');
}

const logError = (error: unknown): void => {
  console.error('Unexpected error:', error);
};

// Los jobs se guardan en PostgreSQL (D-47): sobreviven a un reinicio del servidor. Al arrancar se
// aplican las migraciones pendientes, así no hay que acordarse de `npm run migrate`. (En
// producción, con varias copias arrancando a la vez, esto se hará como un paso aparte.)
const databaseUrl = loadDatabaseUrl(process.env);
const pool = new Pool({ connectionString: databaseUrl });
await migrate(pool, fileURLToPath(new URL('../migrations', import.meta.url)));

// Dónde LangGraph guarda "en qué paso va cada job" (D-32): en Postgres, para que un job pausado
// esperando una respuesta se pueda reanudar aunque el servidor se reinicie. Crea sus propias tablas.
const checkpointer = PostgresSaver.fromConnString(databaseUrl);
await checkpointer.setup();

const openAi = loadOpenAiConfig(process.env);
const graph = buildGraph(
  {
    llm: new OpenAiLlm(new OpenAI({ apiKey: openAi.apiKey }), openAi.models),
    runner: new DockerRunner(loadRunnerConfig(process.env)),
    config: loadAgentConfig(process.env),
  },
  checkpointer,
);
const jobService = new JobService({
  jira: new RestJira(loadJiraConfig(process.env)),
  repository: new PostgresJobRepository(pool),
  graph,
  onError: logError,
});

const interrupted = await jobService.recoverInterrupted();
if (interrupted > 0) {
  process.stdout.write(`Marked ${interrupted} interrupted job(s) as failed.
`);
}

createApp({ jobService, onError: logError }).listen(port, HOST, () => {
  process.stdout.write(`API listening on http://${HOST}:${port}\n`);
});
