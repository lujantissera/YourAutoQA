'use client';

import { useRouter } from 'next/navigation';
import type { CreatedJob } from '../lib/api';
import { useAuth } from './auth-provider';
import { NewJobForm } from './new-job-form';

type CreateTestProps = {
  createJob?: (issueKey: string) => Promise<CreatedJob>;
};

// Crear test (RF-7): el formulario y una guía corta. Al crear, lleva directamente al detalle del
// job para verlo avanzar. Quien no puede crear (QA Executer) recibe una explicación en vez del
// formulario; el backend responde 403 igualmente si alguien llama a la API a mano (D-57).
export function CreateTest({ createJob }: CreateTestProps) {
  const auth = useAuth();
  const router = useRouter();

  if (!auth.can('job:create')) {
    return (
      <p role="alert" className="auth-notice">
        Tu rol no puede crear tests. Pídele a un Admin que te dé el rol QA Controller.
      </p>
    );
  }

  return (
    <div className="create-grid">
      <NewJobForm
        createJob={createJob}
        onCreated={(job: CreatedJob) => router.push(`/jobs/${job.id}`)}
      />
      <aside className="card guide">
        <h2>Cómo funciona</h2>
        <ol className="steps" aria-label="Cómo funciona">
          <li>Escribes la clave de una historia de Jira, por ejemplo YAQ-5.</li>
          <li>El agente lee la historia, genera el test y lo ejecuta en un entorno aislado.</li>
          <li>Si falla, lo corrige hasta 5 veces. Si le falta información, te pregunta.</li>
        </ol>
        <p className="guide-hint">
          Pon en la historia la URL del sistema y los criterios de aceptación: cuanto más claros,
          menos preguntas.
        </p>
      </aside>
    </div>
  );
}
