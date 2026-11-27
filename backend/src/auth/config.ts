export interface AuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  sessionTtlHours: number;
  /** Correos (en minúsculas) que entran como Admin la primera vez. Ver initial-role.ts. */
  adminEmails: string[];
  /** true en producción (HTTPS): la cookie solo viaja por conexión cifrada. */
  cookieSecure: boolean;
}

const DEFAULT_SESSION_TTL_HOURS = 12;

// Recibe el entorno como parámetro (como loadDatabaseUrl) para poder probarlo. Los errores nombran
// la variable, nunca su valor: el secreto no puede acabar en un log.
export function loadAuthConfig(env: Record<string, string | undefined>): AuthConfig {
  const required = (name: string): string => {
    const value = env[name]?.trim();
    if (!value) throw new Error(`Missing required environment variable: ${name}`);
    return value;
  };

  const ttlText = env.SESSION_TTL_HOURS?.trim();
  const sessionTtlHours = ttlText ? Number(ttlText) : DEFAULT_SESSION_TTL_HOURS;
  if (!Number.isFinite(sessionTtlHours) || sessionTtlHours <= 0) {
    throw new Error('SESSION_TTL_HOURS must be a positive number');
  }

  return {
    clientId: required('ATLASSIAN_CLIENT_ID'),
    clientSecret: required('ATLASSIAN_CLIENT_SECRET'),
    redirectUri: required('ATLASSIAN_REDIRECT_URI'),
    sessionTtlHours,
    adminEmails: (env.ADMIN_EMAILS ?? '')
      .split(',')
      .map((email) => email.trim().toLowerCase())
      .filter((email) => email !== ''),
    cookieSecure: env.COOKIE_SECURE?.trim() === 'true',
  };
}
