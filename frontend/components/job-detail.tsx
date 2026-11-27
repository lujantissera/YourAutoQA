'use client';

import { useEffect, useState } from 'react';
import { ApiError, clarify as clarifyRequest, getJob, type JobDetail } from '../lib/api';
import { describeJob } from '../lib/describe-job';
import { shouldPoll } from '../lib/should-poll';
import { AttemptStrip } from './attempt-strip';
import { ClarificationForm } from './clarification-form';

const MAX_ATTEMPTS = 5;
const DEFAULT_POLL_INTERVAL_MS = 3000;

type State =
  { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'ready'; job: JobDetail };

type JobDetailViewProps = {
  jobId: string;
  loadJob?: (id: string) => Promise<JobDetail>;
  clarify?: (id: string, answer: string) => Promise<JobDetail>;
  pollIntervalMs?: number;
};

function messageFor(error: unknown): string {
  if (error instanceof ApiError) {
    return error.code === 'job_not_found' ? 'No se encuentra este job.' : error.message;
  }
  return 'No se pudo conectar con el servidor.';
}

export function JobDetailView({
  jobId,
  loadJob = getJob,
  clarify = clarifyRequest,
  pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
}: JobDetailViewProps) {
  const [state, setState] = useState<State>({ kind: 'loading' });
  // Subir este contador vuelve a pedir el job: lo hace el temporizador y el botón "Reintentar".
  const [round, setRound] = useState(0);

  // Carga el job. Cada subida de `round` la repite.
  useEffect(() => {
    let cancelled = false;
    loadJob(jobId).then(
      (job) => {
        if (!cancelled) setState({ kind: 'ready', job });
      },
      (error: unknown) => {
        if (!cancelled) setState({ kind: 'error', message: messageFor(error) });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [loadJob, jobId, round]);

  // Mientras el job avance solo, programa la siguiente consulta. Depende del estado, así que
  // también se reanuda cuando el job vuelve a correr tras contestar una aclaración.
  useEffect(() => {
    if (state.kind !== 'ready' || !shouldPoll([state.job])) return;
    const timer = setTimeout(() => setRound((value) => value + 1), pollIntervalMs);
    return () => clearTimeout(timer);
  }, [state, pollIntervalMs]);

  if (state.kind === 'loading') return <p role="status">Cargando job…</p>;

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

  const { job } = state;
  const view = describeJob({ status: job.status, attemptCount: job.attempts.length });
  // La tira muestra los resultados reales (la lista tiene que deducirlos; aquí los tenemos).
  const cells = job.attempts.slice(-MAX_ATTEMPTS).map((attempt) => ({
    id: attempt.id,
    result: attempt.run.result,
  }));

  return (
    <article className="job-detail">
      <header>
        <span className="job-key">{job.issueKey}</span>
        <h1>{job.summary}</h1>
        <p className="job-status" data-tone={view.tone}>
          {view.glyph} {view.text}
        </p>
        <p className="job-meta">{`${job.tokensUsed} tokens`}</p>
        <AttemptStrip attempts={cells} max={MAX_ATTEMPTS} />
      </header>

      {job.status === 'awaiting_clarification' && job.question && (
        <ClarificationForm
          jobId={job.id}
          question={job.question}
          clarify={clarify}
          onAnswered={(resumed) => setState({ kind: 'ready', job: resumed })}
        />
      )}

      {job.status === 'fail' && job.failureReason && (
        <p role="note" className="job-failure">
          {job.failureReason}
        </p>
      )}

      <section aria-labelledby="attempts-title">
        <h2 id="attempts-title">Intentos</h2>
        {job.attempts.length === 0 ? (
          <p>Todavía no hay intentos.</p>
        ) : (
          job.attempts.map((attempt, index) => (
            // Un <details> por intento: se abre y se cierra con teclado sin código extra.
            // El último, el más reciente, llega abierto.
            <details key={attempt.id} open={index === job.attempts.length - 1}>
              <summary>
                {`Intento ${attempt.attempt}: ${attempt.run.result === 'PASS' ? 'superado' : 'fallido'}`}
              </summary>
              <h3>Código Robot</h3>
              <pre>{attempt.robotCode}</pre>
              <h3>Log de ejecución</h3>
              <pre>{attempt.run.logs}</pre>
            </details>
          ))
        )}
      </section>
    </article>
  );
}
