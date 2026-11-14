import type { JiraPort, UserStory } from '../../agent/ports.js';
import { JiraError } from '../errors.js';
import { parseIssueKey } from '../issue-key.js';

// Doble de Jira (D-30): se comporta como el adaptador real. Valida la clave (`invalid_key`),
// responde con las historias que se le dan y lanza `not_found` con el resto. Apunta cada clave
// ya normalizada para poder comprobar "se llamó a Jira".
export class FakeJira implements JiraPort {
  readonly calls: string[] = [];

  constructor(private readonly stories: Record<string, UserStory>) {}

  async getUserStory(rawKey: string): Promise<UserStory> {
    const key = parseIssueKey(rawKey);
    this.calls.push(key);
    const story = this.stories[key];
    if (!story) {
      throw new JiraError('not_found', `Issue ${key} was not found, or you cannot view it.`);
    }
    return story;
  }
}
