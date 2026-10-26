export interface JiraConfig {
  email: string;
  apiToken: string;
  cloudId: string;
  timeoutMs: number;
}

const REQUIRED = ['ATLASSIAN_EMAIL', 'ATLASSIAN_API_TOKEN', 'ATLASSIAN_CLOUD_ID'] as const;

// Tiempo máximo de espera a Jira si no se define JIRA_TIMEOUT_MS: ni se cuelga el agente ni se
// corta una respuesta lenta pero válida.
const DEFAULT_TIMEOUT_MS = 10_000;

// Formato UUID: el cloudId se inserta en la URL de la petición, así que nada que no lo sea
// (p. ej. "../otra-ruta") debe llegar hasta allí.
const CLOUD_ID_FORMAT = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Recibe el entorno como parámetro (en producción `process.env`) para poder probarlo
// sin tocar variables globales. Lista todo lo que falta de una vez y nunca imprime valores.
export function loadJiraConfig(env: Record<string, string | undefined>): JiraConfig {
  const email = env.ATLASSIAN_EMAIL?.trim();
  const apiToken = env.ATLASSIAN_API_TOKEN?.trim();
  const cloudId = env.ATLASSIAN_CLOUD_ID?.trim();
  if (!email || !apiToken || !cloudId) {
    const missing = REQUIRED.filter((name) => !env[name]?.trim());
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
  if (!CLOUD_ID_FORMAT.test(cloudId)) {
    throw new Error('ATLASSIAN_CLOUD_ID must be a UUID');
  }

  const rawTimeout = env.JIRA_TIMEOUT_MS?.trim();
  const timeoutMs = rawTimeout ? Number(rawTimeout) : DEFAULT_TIMEOUT_MS;
  if (!Number.isInteger(timeoutMs) || timeoutMs <= 0) {
    throw new Error('JIRA_TIMEOUT_MS must be a positive integer');
  }

  return { email, apiToken, cloudId, timeoutMs };
}
