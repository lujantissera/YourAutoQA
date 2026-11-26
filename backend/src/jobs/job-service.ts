import { Command } from '@langchain/langgraph';
import type { buildGraph } from '../agent/graph.js';
import { RunnerUnavailableError, type JiraPort } from '../agent/ports.js';
import type { AgentStateType } from '../agent/state.js';
import { LlmError, type LlmErrorKind } from '../llm/openai-llm.js';
import { storyToPrompt } from '../jira/story-text.js';
import { JobError } from './errors.js';
import type { Job, JobPatch, JobSummary } from './job.js';
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

// Motivos claros según qué falló en OpenAI. Si no es un error conocido, el mensaje genérico.
const LLM_REASONS: Record<LlmErrorKind, string> = {
  auth: 'OpenAI rejected the API key. Check OPENAI_API_KEY and restart the server.',
  quota: 'OpenAI credit exhausted. Add credit and try again.',
  rate_limit: 'OpenAI rate limit reached. Try again in a moment.',
  network: 'Could not reach OpenAI. Check the connection and try again.',
  unknown: 'The agent stopped because of an internal error.',
};

function failureReasonFor(error: unknown): string {
  if (error instanceof RunnerUnavailableError) return DOCKER_REASON;
  if (error instanceof LlmError) return LLM_REASONS[error.kind];
  return INTERNAL_ERROR_REASON;
}

const DOCKER_REASON = 'Docker is not available. Start Docker and try again.';
const INTERRUPTED_REASON = 'The server restarted while the agent was running.';

const notAwaiting = (): JobError =>
  new JobError('not_awaiting_clarification', 'The job is not waiting for an answer.');

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

// Lo que se le da al grafo: la US para empezar, o la respuesta del usuario para reanudarlo.
// Es el tipo de entrada que acepta nuestro grafo. El `Command` de LangGraph incluye los nombres de
// los nodos de cada grafo, así que se toma del propio grafo en vez de escribirlo a mano.
type GraphInput = Parameters<AgentGraph['stream']>[0];

// Reanudar un job pausado solo necesita la respuesta (`resume`); el resto del `Command` no se usa.
const resumeWith = (answer: string): GraphInput => new Command({ resume: answer }) as GraphInput;

export class JobService {
  private readonly running = new Set<Promise<void>>();
  // Jobs que se están reanudando ahora mismo: evita reanudar dos veces con un doble envío.
  private readonly resuming = new Set<string>();

  constructor(private readonly deps: JobServiceDeps) {}

  // Lee la US ANTES de crear el job: si Jira falla, el error sube y no queda ningún job (RF-3).
  // El agente corre en segundo plano (RNF-3), así que se devuelve el job sin esperar a que acabe.
  async createJob(issueKey: string, userId?: string): Promise<Job> {
    const story = await this.deps.jira.getUserStory(issueKey);
    const job = await this.deps.repository.create({
      issueKey: story.key,
      summary: story.summary,
      userId,
    });

    this.launch(job.id, { usText: storyToPrompt(story) });
    return job;
  }

  getJob(id: string): Promise<Job | undefined> {
    return this.deps.repository.get(id);
  }

  listJobs(): Promise<JobSummary[]> {
    return this.deps.repository.list();
  }

  // Da la respuesta del usuario a un job pausado y reanuda al agente donde se quedó (RF-9).
  async clarify(id: string, answer: string): Promise<Job> {
    // Se anota ANTES de cualquier `await`: así, aunque lleguen dos envíos casi a la vez, el segundo
    // ya encuentra la anotación y se rechaza (en un solo servidor; con varios haría falta la BD).
    if (this.resuming.has(id)) throw notAwaiting();
    this.resuming.add(id);

    try {
      const job = await this.deps.repository.get(id);
      if (!job) throw new JobError('job_not_found', 'Job not found.');
      if (job.status !== 'awaiting_clarification') throw notAwaiting();

      // Primero el job pasa a `generating` y pierde la pregunta, y solo después se reanuda al
      // agente: quien consulte el job ya ve que hay trabajo en marcha, no la pregunta antigua.
      const updated = await this.deps.repository.update(id, {
        status: 'generating',
        question: null,
      });
      this.launch(id, resumeWith(answer), () => this.resuming.delete(id));
      return updated;
    } catch (error) {
      this.resuming.delete(id);
      throw error;
    }
  }

  // Para llamar al arrancar el servidor: los jobs que estaban en marcha cuando se apagó ya no los
  // ejecuta nadie, así que se marcan como fallidos en vez de quedarse "en marcha" para siempre.
  recoverInterrupted(): Promise<number> {
    return this.deps.repository.failInterrupted(INTERRUPTED_REASON);
  }

  /** Espera a que terminen (o se pausen) los jobs en curso. Útil en tests y al apagar el servidor. */
  async idle(): Promise<void> {
    await Promise.all(this.running);
  }

  // Lanza el agente en segundo plano y lo apunta en `running` mientras dura (para `idle`).
  private launch(jobId: string, input: GraphInput, onDone?: () => void): void {
    const run = this.run(jobId, input).finally(() => {
      this.running.delete(run);
      onDone?.();
    });
    this.running.add(run);
  }

  // Nunca rechaza: cualquier fallo acaba en el job (`fail`) y en `onError`, sin dejar jobs colgados.
  private async run(jobId: string, input: GraphInput): Promise<void> {
    const { graph, repository, onError } = this.deps;
    try {
      // thread_id = id del job: el checkpointer guarda la conversación de cada job por separado.
      // streamMode 'values' emite el estado completo tras cada paso, y así el job va avanzando.
      const states = await graph.stream(input, {
        configurable: { thread_id: jobId },
        streamMode: 'values',
      });
      for await (const state of states) {
        await repository.update(jobId, toPatch(state));
      }
    } catch (error) {
      onError?.(error);
      await repository
        .update(jobId, {
          status: 'fail',
          failureReason: failureReasonFor(error),
        })
        .catch((updateError: unknown) => onError?.(updateError));
    }
  }
}
