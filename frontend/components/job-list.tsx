'use client';

import { filterJobs, type JobFilter } from '../lib/dashboard';
import type { JobSummary } from '../lib/api';
import { useJobs } from '../lib/use-jobs';
import { JobRow } from './job-row';

type JobListProps = {
  loadJobs?: () => Promise<JobSummary[]>;
  /** Cuando cambia, la lista se vuelve a cargar (p. ej. tras crear un job). */
  refreshKey?: number;
  /** Cada cuántos ms se vuelve a consultar mientras algún job siga en curso. */
  pollIntervalMs?: number;
  /** Qué jobs se muestran. Por defecto, todos. */
  filter?: JobFilter;
};

export function JobList({ loadJobs, refreshKey, pollIntervalMs, filter = 'all' }: JobListProps) {
  const { state, retry } = useJobs({ loadJobs, refreshKey, pollIntervalMs });

  if (state.kind === 'loading') return <p role="status">Cargando jobs…</p>;

  if (state.kind === 'error') {
    return (
      <div role="alert">
        <p>{state.message}</p>
        <button type="button" onClick={retry}>
          Reintentar
        </button>
      </div>
    );
  }

  if (state.jobs.length === 0) {
    return (
      <p className="empty-state">
        Aún no hay jobs. Genera tu primer test con la clave de una historia de Jira, por ejemplo
        PROJ-123.
      </p>
    );
  }

  const visible = filterJobs(state.jobs, filter);
  if (visible.length === 0) {
    return <p className="empty-state">No hay jobs con este estado.</p>;
  }

  return (
    <ul className="job-list">
      {visible.map((job) => (
        <JobRow key={job.id} job={job} />
      ))}
    </ul>
  );
}
