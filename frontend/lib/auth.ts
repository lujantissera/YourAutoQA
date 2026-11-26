import { readError } from './api';

export type Role = 'Admin' | 'QA Controller' | 'QA Executer';
export type Action = 'job:read' | 'job:create' | 'job:clarify' | 'admin:manage';

// Lo que devuelve GET /auth/me. `permissions` lo calcula el backend a partir del rol: la interfaz
// solo lo usa para decidir qué mostrar; la seguridad real la aplica el backend en cada petición.
export type CurrentUser = {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  role: Role;
};
export type Session = { user: CurrentUser; permissions: Action[] };

// null = no hay sesión (el 401 es el caso esperado aquí, no un error). Cualquier otro fallo sí lanza.
export async function getSession(): Promise<Session | null> {
  const response = await fetch('/api/auth/me', { cache: 'no-store' });
  if (response.status === 401) return null;
  if (!response.ok) throw await readError(response);
  return (await response.json()) as Session;
}

export async function logout(): Promise<void> {
  await fetch('/api/auth/logout', { method: 'POST' });
}

export const hasPermission = (permissions: readonly Action[], action: Action): boolean =>
  permissions.includes(action);

// Por qué ha vuelto el navegador a /login. Solo se aceptan nuestros códigos: lo que venga en la URL
// nunca se pinta tal cual.
const LOGIN_ERRORS: Record<string, string> = {
  cancelled: 'Cancelaste la autorización en Atlassian, así que no se ha iniciado sesión.',
  expired: 'Tu sesión ha caducado. Inicia sesión de nuevo.',
  state: 'No pudimos verificar el inicio de sesión. Inténtalo de nuevo.',
  failed: 'Atlassian no completó el inicio de sesión. Inténtalo de nuevo en un momento.',
};

export function loginErrorMessage(code: string | undefined): string | null {
  return code !== undefined && Object.hasOwn(LOGIN_ERRORS, code) ? LOGIN_ERRORS[code]! : null;
}

// La regla de proxy.ts: ¿hay que mandar esta pantalla al login? Solo mira si existe la cookie de
// sesión (no puede validarla: eso lo hace el backend). Sirve para no enseñar ni un destello de
// contenido privado a quien claramente no ha entrado.
export const needsLogin = (pathname: string, hasSessionCookie: boolean): boolean =>
  !hasSessionCookie && pathname !== '/login';
