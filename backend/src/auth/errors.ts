export type AuthErrorKind = 'login_failed' | 'user_not_found' | 'cannot_change_own_role';

// Error propio de la autenticación, igual que JiraError y JobError: la capa HTTP lo traduce a un
// código y los mensajes son siempre nuestros y limpios (nunca el texto crudo de Atlassian).
export class AuthError extends Error {
  constructor(
    readonly kind: AuthErrorKind,
    message: string,
  ) {
    super(message);
    this.name = 'AuthError';
  }
}
