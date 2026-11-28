import Link from 'next/link';
import type { JobSummary } from '../lib/api';
import { describeJob } from '../lib/describe-job';
import { AttemptStrip } from './attempt-strip';

const MAX_ATTEMPTS = 5;

// Una fila de job: clave, título que lleva al detalle, tira de intentos y estado. La usan el
// Control de tests y la actividad reciente del Inicio.
export function JobRow({ job }: { job: JobSummary }) {
  const view = describeJob(job);
  return (
    <li className="job-row">
      <div className="job-title">
        <span className="job-key">{job.issueKey}</span>
        <h2>
          <Link href={`/jobs/${job.id}`}>{job.summary}</Link>
        </h2>
      </div>
      <AttemptStrip attempts={view.attempts} max={MAX_ATTEMPTS} />
      <span className="job-status" data-tone={view.tone}>
        {view.glyph} {view.text}
      </span>
    </li>
  );
}
