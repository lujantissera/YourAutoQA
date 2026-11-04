export type JiraErrorKind = 'invalid_key' | 'not_found' | 'forbidden' | 'unavailable';

// Error propio: el resto del sistema no necesita conocer los detalles de Jira ni de MCP.
// Los mensajes son siempre nuestros y limpios (US-04.6); el error original va aparte, en `cause`.
export class JiraError extends Error {
  constructor(
    readonly kind: JiraErrorKind,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = 'JiraError';
  }
}
