import type { JiraPort, UserStory } from '../agent/ports.js';
import { splitAcceptanceCriteria } from './acceptance-criteria.js';
import { adfToText } from './adf.js';
import type { JiraConfig } from './config.js';
import { JiraError } from './errors.js';
import { parseIssueKey } from './issue-key.js';

// Pasarela de Atlassian: los tokens con ámbitos solo funcionan por aquí, no por la URL del sitio (D-45).
const API_BASE = 'https://api.atlassian.com/ex/jira';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

// Implementa JiraPort con la API REST de Jira. `fetch` se inyecta para probarlo sin red.
// Los mensajes de error son nuestros y limpios (US-04.6): nunca llevan el token, el cloudId, la
// URL ni lo que devuelva Jira. Solo cuenta el código HTTP, porque el texto viene localizado.
export class RestJira implements JiraPort {
  constructor(
    private readonly config: JiraConfig,
    private readonly fetchFn: typeof fetch = fetch,
  ) {}

  async getUserStory(rawKey: string): Promise<UserStory> {
    const key = parseIssueKey(rawKey);
    const response = await this.request(key);

    // Jira responde 404 tanto si la incidencia no existe como si no se puede ver (D-45).
    if (response.status === 404) {
      throw new JiraError('not_found', `Issue ${key} was not found, or you cannot view it.`);
    }
    if (response.status === 401 || response.status === 403) {
      throw new JiraError(
        'forbidden',
        'Jira rejected the credentials or you do not have permission to read this issue.',
      );
    }
    if (!response.ok) {
      throw new JiraError('unavailable', 'Jira is not available right now. Try again later.');
    }

    return this.toUserStory(key, response);
  }

  private async request(key: string): Promise<Response> {
    const basic = Buffer.from(`${this.config.email}:${this.config.apiToken}`).toString('base64');
    const url = `${API_BASE}/${this.config.cloudId}/rest/api/3/issue/${key}?fields=summary,description`;
    try {
      return await this.fetchFn(url, {
        headers: { Authorization: `Basic ${basic}`, Accept: 'application/json' },
        signal: AbortSignal.timeout(this.config.timeoutMs),
      });
    } catch (error) {
      // Red caída, DNS o timeout: el original va en `cause`.
      throw new JiraError('unavailable', 'Jira is not available right now. Try again later.', {
        cause: error,
      });
    }
  }

  private async toUserStory(key: string, response: Response): Promise<UserStory> {
    let body: unknown;
    try {
      body = await response.json();
    } catch (error) {
      throw new JiraError('unavailable', 'Jira returned an unexpected response.', { cause: error });
    }

    const fields = isRecord(body) ? body.fields : undefined;
    if (!isRecord(fields) || typeof fields.summary !== 'string') {
      throw new JiraError('unavailable', 'Jira returned an unexpected response.');
    }

    const { description, acceptanceCriteria } = splitAcceptanceCriteria(
      adfToText(fields.description),
    );
    return { key, summary: fields.summary, description, acceptanceCriteria };
  }
}
