import type { JiraPort, UserStory } from '../../agent/ports.js';
import { JiraError } from '../errors.js';

// Doble de Jira (D-30): responde con las historias que se le dan y lanza `not_found` con el resto,
// igual que el adaptador real. Apunta cada clave pedida para poder comprobar "se llamó a Jira".
export class FakeJira implements JiraPort {
  readonly calls: string[] = [];

  constructor(private readonly stories: Record<string, UserStory>) {}

  async getUserStory(key: string): Promise<UserStory> {
    this.calls.push(key);
    const story = this.stories[key];
    if (!story) {
      throw new JiraError('not_found', `Issue ${key} was not found, or you cannot view it.`);
    }
    return story;
  }
}
