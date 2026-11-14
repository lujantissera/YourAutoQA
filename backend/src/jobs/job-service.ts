import type { buildGraph } from '../agent/graph.js';
import type { JiraPort } from '../agent/ports.js';
import type { AgentStateType } from '../agent/state.js';
import { storyToPrompt } from '../jira/story-text.js';
import type { Job, JobPatch } from './job.js';
import type { JobRepository } from './job-repository.js';

type AgentGraph = ReturnType<typeof buildGraph>;

export interface JobServiceDeps {
  jira: JiraPort;
  repository: JobRepository;
  graph: AgentGraph;
  /** Para registrar errores inesperados del agente (en 3d se conectará a un log de verdad). */
  onError?: (error: unknown) => void;
}

// Mensaje fijo y limpio (US-04.6): el detalle del error va a `onError`, nunca al usuario.
const INTERNAL_ERROR_REASON = 'The agent stopped because of an internal error.';

// Copia al job lo que cambió en el estado del grafo. Solo los campos que vienen definidos: si
// llegara un trozo parcial, no debe borrar lo ya guardado.
function toPatch(state: Partial<AgentStateType>): JobPatch {
  const patch: JobPatch = {};
  if (state.status !== undefined) patch.status = state.status;
  if (state.attempts !== undefined) patch.attempts = state.attempts;
  if (state.tokensUsed !== undefined) patch.tokensUsed = state.tokensUsed;
  if (state.question !== undefined) patch.question = state.question;
  if (state.failureReason !== undefined) patch.failureReason = state.failureReason;
  return patch;
}

export class JobService {
  private readonly running = new Set<Promise<void>>();

  constructor(private readonly deps: JobServiceDeps) {}

  // Lee la US ANTES de crear el job: si Jira falla, el error sube y no queda ningún job (RF-3).
  // El agente corre en segundo plano (RNF-3), así que se devuelve el job sin esperar a que acabe.
  async createJob(issueKey: string): Promise<Job> {
    const story = await this.deps.jira.getUserStory(issueKey);
    const job = await this.deps.repository.create({
      issueKey: story.key,
      summary: story.summary,
    });

    const run = this.run(job.id, storyToPrompt(story)).finally(() => this.running.delete(run));
    this.running.add(run);
    return job;
  }

  getJob(id: string): Promise<Job | undefined> {
    return this.deps.repository.get(id);
  }

  /** Espera a que terminen (o se pausen) los jobs en curso. Útil en tests y al apagar el servidor. */
  async idle(): Promise<void> {
    await Promise.all(this.running);
  }

  // Nunca rechaza: cualquier fallo acaba en el job (`fail`) y en `onError`, sin dejar jobs colgados.
  private async run(jobId: string, usText: string): Promise<void> {
    const { graph, repository, onError } = this.deps;
    try {
      // thread_id = id del job: el checkpointer guarda la conversación de cada job por separado.
      // streamMode 'values' emite el estado completo tras cada paso, y así el job va avanzando.
      const states = await graph.stream(
        { usText },
        { configurable: { thread_id: jobId }, streamMode: 'values' },
      );
      for await (const state of states) {
        await repository.update(jobId, toPatch(state));
      }
    } catch (error) {
      onError?.(error);
      await repository
        .update(jobId, { status: 'fail', failureReason: INTERNAL_ERROR_REASON })
        .catch((updateError: unknown) => onError?.(updateError));
    }
  }
}
