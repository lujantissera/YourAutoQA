import type { AttemptRecord, JobStatus } from '../agent/state.js';

// Un trabajo del agente: "genera y valida el test de esta historia". El estado, los intentos,
// los tokens, la pregunta y el motivo del fallo reflejan lo que va pasando en el grafo.
export interface Job {
  id: string;
  issueKey: string;
  summary: string;
  status: JobStatus;
  attempts: AttemptRecord[];
  tokensUsed: number;
  question: string | null;
  failureReason: string | null;
  createdAt: Date;
}

// El resumen de un job para las listas: sin intentos ni logs (pesan mucho), solo cuántos intentos hay.
export type JobSummary = Pick<
  Job,
  'id' | 'issueKey' | 'summary' | 'status' | 'tokensUsed' | 'createdAt'
> & { attemptCount: number };

// Lo único que hace falta para crear un job; el resto lo pone el repositorio.
export interface NewJob {
  issueKey: string;
  summary: string;
  /** Quién lo crea (jobs.user_id). Sin valor para los jobs hechos desde scripts o antes del login. */
  userId?: string;
}

// Lo que puede cambiar después de crearlo. `id`, `issueKey`, `summary` y `createdAt` no cambian nunca.
export type JobPatch = Partial<
  Pick<Job, 'status' | 'attempts' | 'tokensUsed' | 'question' | 'failureReason'>
>;
