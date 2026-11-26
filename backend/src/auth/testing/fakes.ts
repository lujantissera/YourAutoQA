import type { AtlassianOAuthPort } from '../atlassian-oauth.js';
import { AuthError } from '../errors.js';
import type { ExternalProfile } from '../user.js';

// Doble de Atlassian (como FakeJira): "canjea" cada código por el perfil que se le haya dado y
// rechaza los demás. Nunca sale a internet: los tests no hablan con Atlassian real.
export class FakeAtlassian implements AtlassianOAuthPort {
  constructor(private readonly profiles: Record<string, ExternalProfile>) {}

  authorizeUrl(state: string): string {
    return `https://fake.atlassian.test/authorize?state=${state}`;
  }

  async fetchProfile(code: string): Promise<ExternalProfile> {
    const profile = this.profiles[code];
    if (!profile)
      throw new AuthError('login_failed', 'The Atlassian login could not be completed.');
    return profile;
  }
}
