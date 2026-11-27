import type { JobSummary } from './api';

export type JobsSummary = {
  total: number;
  passed: number;
  failed: number;
  /** Generando o ejecutando: el agente está trabajando. */
  running: number;
  /** El agente espera una respuesta de la persona usuaria. */
  waiting: number;
};

// Las cifras de las tarjetas del Inicio. Se calculan con la lista que ya da GET /jobs: no hace
// falta ningún endpoint nuevo.
export function summarizeJobs(jobs: readonly JobSummary[]): JobsSummary {
  const count = (statuses: JobSummary['status'][]) =>
    jobs.filter((job) => statuses.includes(job.status)).length;
  return {
    total: jobs.length,
    passed: count(['done']),
    failed: count(['fail']),
    running: count(['generating', 'running']),
    waiting: count(['awaiting_clarification']),
  };
}

// Más reciente primero. Copia la lista antes de ordenar: `sort` modifica el array original.
const newestFirst = (jobs: readonly JobSummary[]) =>
  [...jobs].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

// Lo que necesita a una persona ahora mismo: los jobs en los que el agente le pregunta algo.
export const attentionJobs = (jobs: readonly JobSummary[]): JobSummary[] =>
  newestFirst(jobs.filter((job) => job.status === 'awaiting_clarification'));

export const recentJobs = (jobs: readonly JobSummary[], limit: number): JobSummary[] =>
  newestFirst(jobs).slice(0, limit);

export type JobFilter = 'all' | 'running' | 'waiting' | 'passed' | 'failed';

export const JOB_FILTERS: ReadonlyArray<{ value: JobFilter; label: string }> = [
  { value: 'all', label: 'Todos' },
  { value: 'running', label: 'En curso' },
  { value: 'waiting', label: 'Esperan respuesta' },
  { value: 'passed', label: 'Superados' },
  { value: 'failed', label: 'Fallidos' },
];

const FILTER_STATUSES: Record<Exclude<JobFilter, 'all'>, JobSummary['status'][]> = {
  running: ['generating', 'running'],
  waiting: ['awaiting_clarification'],
  passed: ['done'],
  failed: ['fail'],
};

export function filterJobs(jobs: readonly JobSummary[], filter: JobFilter): JobSummary[] {
  if (filter === 'all') return [...jobs];
  return jobs.filter((job) => FILTER_STATUSES[filter].includes(job.status));
}
