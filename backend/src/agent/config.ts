// Límites del agente. Nunca se hardcodean: se inyectan desde fuera (env en producción,
// valores sueltos en los tests). RNF-1, RNF-2 y D-22.
export interface AgentConfig {
  /** Máximo de ejecuciones por job (D-28: intento = una ejecución). */
  maxAttempts: number;
  /** Límite de tokens acumulados por job (D-22). */
  maxTokens: number;
  /** Timeout de cada ejecución de Robot, en segundos. */
  executionTimeoutSeconds: number;
  /** Máximo de preguntas que el agente puede hacer al usuario por job (D-42). */
  maxClarifications: number;
  /** Si true, antes de generar se comprueba que la US tenga información suficiente (D-40). */
  storyCheck: boolean;
}

// Un número positivo de una variable de entorno; si falta o no es válido, el valor por defecto.
// Así un .env mal escrito nunca rompe el arranque ni deja el agente sin límite.
function positiveNumber(
  env: Record<string, string | undefined>,
  name: string,
  fallback: number,
): number {
  const value = Number(env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

// Recibe el entorno como parámetro (en producción `process.env`) para poder probarlo sin tocar
// variables globales. Lo comparten try-agent y el servidor: los límites viven solo aquí.
export function loadAgentConfig(env: Record<string, string | undefined>): AgentConfig {
  return {
    maxAttempts: positiveNumber(env, 'MAX_ATTEMPTS', 5),
    maxTokens: positiveNumber(env, 'MAX_TOKENS', 50_000),
    executionTimeoutSeconds: positiveNumber(env, 'EXECUTION_TIMEOUT_SECONDS', 120),
    maxClarifications: positiveNumber(env, 'MAX_CLARIFICATIONS', 3),
    storyCheck: env.STORY_CHECK !== 'false', // activado salvo STORY_CHECK=false
  };
}
