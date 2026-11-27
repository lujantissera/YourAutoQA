'use client';

import { useId, useState, type FormEvent } from 'react';
import { ApiError, createJob as createJobRequest, type CreatedJob } from '../lib/api';

// Mensajes para la persona usuaria según el código de error de Jira. Si llega un código que no
// conocemos, mostramos el mensaje que envía el backend.
const JIRA_MESSAGES: Record<string, string> = {
  invalid_key: 'Escribe una clave de Jira válida, por ejemplo PROJ-123.',
  not_found: 'No existe esa historia en Jira.',
  forbidden: 'No tienes permisos para ver esa historia.',
  unavailable: 'Jira no responde ahora mismo. Inténtalo de nuevo en un momento.',
};

function messageFor(error: unknown): string {
  if (error instanceof ApiError) return JIRA_MESSAGES[error.code] ?? error.message;
  return 'No se pudo conectar con el servidor.';
}

type NewJobFormProps = {
  createJob?: (issueKey: string) => Promise<CreatedJob>;
  onCreated: (job: CreatedJob) => void;
};

export function NewJobForm({ createJob = createJobRequest, onCreated }: NewJobFormProps) {
  const inputId = useId();
  const errorId = useId();
  const [issueKey, setIssueKey] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = issueKey.trim() !== '' && !pending;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;

    setPending(true);
    setError(null);
    try {
      const job = await createJob(issueKey.trim());
      setIssueKey('');
      onCreated(job);
    } catch (failure) {
      // El campo conserva lo escrito para que se pueda corregir.
      setError(messageFor(failure));
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="new-job" onSubmit={handleSubmit}>
      <label htmlFor={inputId}>Clave de la historia</label>
      <div className="new-job-row">
        <input
          id={inputId}
          value={issueKey}
          onChange={(event) => setIssueKey(event.target.value)}
          placeholder="PROJ-123"
          autoComplete="off"
          aria-invalid={error !== null}
          aria-describedby={error ? errorId : undefined}
        />
        <button type="submit" disabled={!canSubmit}>
          {pending ? 'Generando…' : 'Generar test'}
        </button>
      </div>
      {error && (
        <p id={errorId} role="alert" className="new-job-error">
          {error}
        </p>
      )}
    </form>
  );
}
