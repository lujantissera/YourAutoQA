'use client';

import { useEffect, useState } from 'react';
import { ApiError, listJobs, type JobSummary } from '../lib/api';
import { describeJob } from '../lib/describe-job';
import { AttemptStrip } from './attempt-strip';

const MAX_ATTEMPTS = 5;

type State =
  { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'ready'; jobs: JobSummary[] };

type JobListProps = {
  loadJobs?: () => Promise<JobSummary[]>;
  /** Cuando cambia, la lista se vuelve a cargar (p. ej. tras crear un job). */
  refreshKey?: number;
};

export function JobList({ loadJobs = listJobs, refreshKey = 0 }: JobListProps) {
  const [state, setState] = useState<State>({ kind: 'loading' });
  // Subir este contador vuelve a lanzar la carga: es lo que hace el botón "Reintentar".
  const [round, setRound] = useState(0);

  useEffect(() => {
    let cancelled = false;
    loadJobs().then(
      (jobs) => {
        if (!cancelled) setState({ kind: 'ready', jobs });
      },
      (error: unknown) => {
        if (cancelled) return;
        setState({
          kind: 'error',
          message:
            error instanceof ApiError ? error.message : 'No se pudo conectar con el servidor.',
        });
      },
    );
    // Si el componente se cierra antes de que llegue la respuesta, la ignoramos.
    return () => {
      cancelled = true;
    };
  }, [loadJobs, round, refreshKey]);

  if (state.kind === 'loading') return <p role="status">Cargando jobs…</p>;

  if (state.kind === 'error') {
    return (
      <div role="alert">
        <p>{state.message}</p>
        <button
          type="button"
          onClick={() => {
            setState({ kind: 'loading' });
            setRound((value) => value + 1);
          }}
        >
          Reintentar
        </button>
      </div>
    );
  }

  if (state.jobs.length === 0) {
    return (
      <p>
        Aún no hay jobs. Genera tu primer test con la clave de una historia de Jira, por ejemplo
        PROJ-123.
      </p>
    );
  }

  return (
    <ul className="job-list">
      {state.jobs.map((job) => {
        const view = describeJob(job);
        return (
          <li key={job.id} className="job-row">
            <div className="job-title">
              <span className="job-key">{job.issueKey}</span>
              <h2>{job.summary}</h2>
            </div>
            <AttemptStrip attempts={view.attempts} max={MAX_ATTEMPTS} />
            <span className="job-status" data-tone={view.tone}>
              {view.glyph} {view.text}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
