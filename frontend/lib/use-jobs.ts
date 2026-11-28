import { useCallback, useEffect, useState } from 'react';
import { ApiError, listJobs, type JobSummary } from './api';
import { shouldPoll } from './should-poll';

export type JobsState =
  { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'ready'; jobs: JobSummary[] };

type UseJobsOptions = {
  loadJobs?: () => Promise<JobSummary[]>;
  /** Cuando cambia, la lista se vuelve a cargar (p. ej. tras crear un job). */
  refreshKey?: number;
  /** Cada cuántos ms se vuelve a consultar mientras algún job siga en curso. */
  pollIntervalMs?: number;
};

const DEFAULT_POLL_INTERVAL_MS = 3000;

// Carga la lista de jobs y la mantiene al día mientras algún job avance solo (D-50). Lo usan el
// Inicio y el Control de tests, así la lógica de carga, error y refresco vive en un único sitio.
export function useJobs({
  loadJobs = listJobs,
  refreshKey = 0,
  pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
}: UseJobsOptions = {}): { state: JobsState; retry: () => void } {
  const [state, setState] = useState<JobsState>({ kind: 'loading' });
  // Subir este contador vuelve a lanzar la carga: lo hacen "Reintentar" y el temporizador.
  const [round, setRound] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    loadJobs().then(
      (jobs) => {
        if (cancelled) return;
        setState({ kind: 'ready', jobs });
        if (shouldPoll(jobs))
          timer = setTimeout(() => setRound((value) => value + 1), pollIntervalMs);
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
    // Si el componente se cierra o la carga se relanza, ignoramos la respuesta y el temporizador.
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [loadJobs, round, refreshKey, pollIntervalMs]);

  const retry = useCallback(() => {
    setState({ kind: 'loading' });
    setRound((value) => value + 1);
  }, []);

  return { state, retry };
}
