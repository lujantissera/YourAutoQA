'use client';

import { useId, useState, type FormEvent } from 'react';
import { ApiError, clarify as clarifyRequest, type JobDetail } from '../lib/api';

// Mismo límite que el backend (la respuesta acaba dentro del prompt del LLM y gasta tokens).
export const MAX_ANSWER_LENGTH = 2000;

const ERROR_MESSAGES: Record<string, string> = {
  not_awaiting_clarification:
    'Este job ya no espera tu respuesta. Actualiza la lista para ver su estado.',
  job_not_found: 'No se encuentra este job.',
  invalid_request: `La respuesta debe tener entre 1 y ${MAX_ANSWER_LENGTH} caracteres.`,
};

function messageFor(error: unknown): string {
  if (error instanceof ApiError) return ERROR_MESSAGES[error.code] ?? error.message;
  return 'No se pudo conectar con el servidor.';
}

type ClarificationFormProps = {
  jobId: string;
  question: string;
  clarify?: (id: string, answer: string) => Promise<JobDetail>;
  onAnswered: (job: JobDetail) => void;
};

export function ClarificationForm({
  jobId,
  question,
  clarify = clarifyRequest,
  onAnswered,
}: ClarificationFormProps) {
  const fieldId = useId();
  const hintId = useId();
  const errorId = useId();
  const [answer, setAnswer] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = answer.trim() !== '' && !pending;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;

    setPending(true);
    setError(null);
    try {
      const job = await clarify(jobId, answer.trim());
      setAnswer('');
      onAnswered(job);
    } catch (failure) {
      // El campo conserva lo escrito para poder corregirlo.
      setError(messageFor(failure));
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="clarification" onSubmit={handleSubmit}>
      <p className="clarification-question">{question}</p>
      <label htmlFor={fieldId}>Tu respuesta</label>
      <textarea
        id={fieldId}
        value={answer}
        onChange={(event) => setAnswer(event.target.value)}
        maxLength={MAX_ANSWER_LENGTH}
        rows={4}
        aria-invalid={error !== null}
        aria-describedby={error ? `${hintId} ${errorId}` : hintId}
      />
      <p id={hintId} className="clarification-hint">
        Usa credenciales de prueba, nunca reales: tu respuesta se envía al modelo de IA.
      </p>
      <div className="clarification-row">
        <span className="clarification-count">{`${answer.length} / ${MAX_ANSWER_LENGTH}`}</span>
        <button type="submit" disabled={!canSubmit}>
          {pending ? 'Enviando…' : 'Enviar respuesta'}
        </button>
      </div>
      {error && (
        <p id={errorId} role="alert" className="clarification-error">
          {error}
        </p>
      )}
    </form>
  );
}
