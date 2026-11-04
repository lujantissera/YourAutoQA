// Puertos (D-30): lo único que el grafo conoce del mundo exterior.
// OpenAI y Docker serán adaptadores que implementan estas interfaces;
// en los tests se sustituyen por dobles (FakeLlm, FakeRunner).

export interface LlmRequest {
  system: string;
  user: string;
  /** Qué modelo usar: 'generate' (potente, por defecto) o 'triage' (barato, tareas cortas). */
  tier?: 'generate' | 'triage';
}

export interface LlmResponse {
  text: string;
  tokensIn: number;
  tokensOut: number;
}

export interface LlmPort {
  generate(request: LlmRequest): Promise<LlmResponse>;
}

export interface RunResult {
  result: 'PASS' | 'FAIL';
  logs: string;
  timedOut: boolean;
}

export interface RunnerPort {
  run(robotCode: string, timeoutSeconds: number): Promise<RunResult>;
}

export interface UserStory {
  key: string; // 'YAQ-123'
  summary: string; // tituo
  description: string; //texti d el user story
  acceptanceCriteria: string | null; // lista de criterios de aceptacion o null si no hay
}

// Lanza JiraError si no puede obtenerla (ID inválido, no existe, sin permisos, Jira caído).
export interface JiraPort {
  getUserStory(key: string): Promise<UserStory>;
}
