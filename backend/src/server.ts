// Punto de entrada del servidor: aquí se conectan las piezas REALES (Jira, OpenAI, Docker) a la API.
// No lleva tests porque solo cablea lo que ya está probado por separado con dobles; se verifica
// arrancándolo (`npm run dev` desde backend/) y haciendo peticiones con curl.
import OpenAI from 'openai';
import { loadAgentConfig } from './agent/config.js';
import { buildGraph } from './agent/graph.js';
import { createApp } from './http/app.js';
import { loadJiraConfig } from './jira/config.js';
import { RestJira } from './jira/rest-jira.js';
import { InMemoryJobRepository } from './jobs/in-memory-job-repository.js';
import { JobService } from './jobs/job-service.js';
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

const openAi = loadOpenAiConfig(process.env);
const graph = buildGraph({
  llm: new OpenAiLlm(new OpenAI({ apiKey: openAi.apiKey }), openAi.models),
  runner: new DockerRunner(loadRunnerConfig(process.env)),
  config: loadAgentConfig(process.env),
});
const jobService = new JobService({
  jira: new RestJira(loadJiraConfig(process.env)),
  repository: new InMemoryJobRepository(),
  graph,
  onError: logError,
});

createApp({ jobService, onError: logError }).listen(port, HOST, () => {
  process.stdout.write(`API listening on http://${HOST}:${port}\n`);
});
