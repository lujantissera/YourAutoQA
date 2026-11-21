import type { AttemptCell } from '../components/attempt-strip';
import type { JobSummary } from './api';

export type JobView = {
  glyph: string;
  text: string;
  tone: 'pass' | 'fail' | 'wait' | 'neutral';
  attempts: AttemptCell[];
};

const attemptsWord = (count: number) => `${count} ${count === 1 ? 'intento' : 'intentos'}`;

// El agente solo reintenta cuando un intento falla. Por eso, de los intentos ya terminados, todos
// fallaron salvo el último de un job superado. Así pintamos la tira sin pedir el detalle al backend.
function attemptCells(job: JobSummary): AttemptCell[] {
  return Array.from({ length: job.attemptCount }, (_, index) => {
    const isLast = index === job.attemptCount - 1;
    const result = job.status === 'done' && isLast ? 'PASS' : 'FAIL';
    return { id: index + 1, result };
  });
}

// Traduce el resumen de un job a lo que muestra su fila: glifo, texto, color y tira de intentos.
export function describeJob(job: JobSummary): JobView {
  const attempts = attemptCells(job);

  switch (job.status) {
    case 'done':
      return {
        glyph: '✓',
        text: `Superado en ${attemptsWord(job.attemptCount)}`,
        tone: 'pass',
        attempts,
      };
    case 'fail':
      return {
        glyph: '✕',
        text: `Fallido tras ${attemptsWord(job.attemptCount)}`,
        tone: 'fail',
        attempts,
      };
    case 'awaiting_clarification':
      return { glyph: '?', text: 'Te pregunta algo', tone: 'wait', attempts };
    case 'running':
      return { glyph: '…', text: 'Ejecutando el test', tone: 'neutral', attempts };
    case 'generating':
      return { glyph: '…', text: 'Generando', tone: 'neutral', attempts };
  }
}
