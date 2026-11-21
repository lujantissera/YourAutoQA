export type JobErrorKind = 'job_not_found' | 'not_awaiting_clarification';

// Error propio del servicio de jobs, igual que JiraError: la capa HTTP lo traduce a un código y no
// necesita conocer los detalles internos. Los mensajes son siempre nuestros y limpios (US-04.6).
export class JobError extends Error {
  constructor(
    readonly kind: JobErrorKind,
    message: string,
  ) {
    super(message);
    this.name = 'JobError';
  }
}
