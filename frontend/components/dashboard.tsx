'use client';

import Link from 'next/link';
import type { JobSummary } from '../lib/api';
import { roleLabel } from '../lib/auth';
import { attentionJobs, recentJobs, summarizeJobs } from '../lib/dashboard';
import { useJobs } from '../lib/use-jobs';
import { useAuth } from './auth-provider';
import { JobRow } from './job-row';

const RECENT_LIMIT = 5;

type DashboardProps = {
  loadJobs?: () => Promise<JobSummary[]>;
  pollIntervalMs?: number;
};

type StatTone = 'neutral' | 'pass' | 'fail' | 'wait';

function Stat({ label, value, tone }: { label: string; value: number; tone: StatTone }) {
  // `data-highlight` resalta la tarjeta de "esperan tu respuesta" cuando hay algo pendiente.
  return (
    <li className="stat" data-tone={tone} data-highlight={tone === 'wait' && value > 0}>
      <span className="stat-label">{label}</span>
      <span className="stat-value" data-testid="stat-value">
        {value}
      </span>
    </li>
  );
}

// El Inicio (RF-7): qué está pasando y qué necesita tu atención, sin entrar en cada job.
// Todo sale de GET /jobs, que ya trae el estado de cada uno.
export function Dashboard({ loadJobs, pollIntervalMs }: DashboardProps) {
  const auth = useAuth();
  const { state, retry } = useJobs({ loadJobs, pollIntervalMs });
  const firstName = auth.user.displayName.trim().split(/\s+/)[0] ?? '';
  const canCreate = auth.can('job:create');

  return (
    <main className="page">
      <div className="page-head page-head-row">
        <div>
          <h1>Hola, {firstName}</h1>
          <p className="page-sub">
            <span className="user-role">{roleLabel(auth.user.role)}</span>{' '}
            {canCreate
              ? 'Genera tests desde tus historias de Jira y deja que el agente los corrija.'
              : 'Puedes consultar los tests y cómo avanza el agente.'}
          </p>
        </div>
        {canCreate && (
          <Link href="/crear" className="button-link">
            Crear test
          </Link>
        )}
      </div>

      {state.kind === 'loading' && <p role="status">Cargando…</p>}

      {state.kind === 'error' && (
        <div role="alert">
          <p>{state.message}</p>
          <button type="button" onClick={retry}>
            Reintentar
          </button>
        </div>
      )}

      {state.kind === 'ready' && state.jobs.length === 0 && (
        <section className="card onboarding" aria-labelledby="onboarding-title">
          <h2 id="onboarding-title">Aún no hay tests</h2>
          <p>
            {canCreate
              ? 'Empieza con la clave de una historia de Jira. El agente hace el resto:'
              : 'Cuando alguien cree un test aparecerá aquí. Así funciona:'}
          </p>
          <ol className="steps">
            <li>Escribes la clave de la historia (por ejemplo, YAQ-5).</li>
            <li>El agente genera el test de Robot Framework y lo ejecuta.</li>
            <li>Si falla, lo corrige solo o te pregunta lo que le falta.</li>
          </ol>
        </section>
      )}

      {state.kind === 'ready' && state.jobs.length > 0 && <ReadyContent jobs={state.jobs} />}
    </main>
  );
}

function ReadyContent({ jobs }: { jobs: JobSummary[] }) {
  const summary = summarizeJobs(jobs);
  const attention = attentionJobs(jobs);
  const recent = recentJobs(jobs, RECENT_LIMIT);

  return (
    <>
      <ul className="stats" aria-label="Resumen de tests">
        <Stat label="Total de tests" value={summary.total} tone="neutral" />
        <Stat label="Superados" value={summary.passed} tone="pass" />
        <Stat label="Fallidos" value={summary.failed} tone="fail" />
        <Stat label="Esperan tu respuesta" value={summary.waiting} tone="wait" />
      </ul>

      <section className="panel" aria-labelledby="attention-title">
        <h2 id="attention-title">Necesitan tu atención</h2>
        {attention.length === 0 ? (
          <p className="panel-empty">Nada pendiente. El agente no te ha preguntado nada.</p>
        ) : (
          <ul className="attention-list">
            {attention.map((job) => (
              <li key={job.id}>
                <span className="job-key">{job.issueKey}</span>
                <Link href={`/jobs/${job.id}`}>{job.summary}</Link>
                <span className="attention-cta" aria-hidden="true">
                  Responder →
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel" aria-labelledby="recent-title">
        <div className="panel-head">
          <h2 id="recent-title">Actividad reciente</h2>
          <Link href="/jobs" className="panel-link">
            Ver todos
          </Link>
        </div>
        <ul className="job-list">
          {recent.map((job) => (
            <JobRow key={job.id} job={job} />
          ))}
        </ul>
      </section>
    </>
  );
}
