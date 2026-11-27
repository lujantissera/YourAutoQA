import { AuthError } from './errors.js';
import type { ExternalProfile } from './user.js';

// Puerto: lo que la aplicación necesita de Atlassian. Los tests usan un doble; en producción,
// AtlassianOAuth (abajo). Así ningún test habla con Atlassian de verdad.
export interface AtlassianOAuthPort {
  /** La URL a la que se manda al usuario para que autorice. `state` protege contra CSRF. */
  authorizeUrl(state: string): string;
  /** Cambia el código que devuelve Atlassian por el perfil del usuario. Lanza AuthError. */
  fetchProfile(code: string): Promise<ExternalProfile>;
}

export interface AtlassianOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

const AUTHORIZE_URL = 'https://auth.atlassian.com/authorize';
const TOKEN_URL = 'https://auth.atlassian.com/oauth/token';
const ME_URL = 'https://api.atlassian.com/me';

// Un único ámbito: solo queremos saber quién es (nombre, email, cuenta). No pedimos nada de Jira.
const SCOPE = 'read:me';

type FetchFn = typeof fetch;

const loginFailed = (): AuthError =>
  new AuthError('login_failed', 'The Atlassian login could not be completed.');

export class AtlassianOAuth implements AtlassianOAuthPort {
  // `fetch` se inyecta para poder probar sin red.
  constructor(
    private readonly config: AtlassianOAuthConfig,
    private readonly fetchFn: FetchFn = fetch,
  ) {}

  authorizeUrl(state: string): string {
    const url = new URL(AUTHORIZE_URL);
    url.search = new URLSearchParams({
      audience: 'api.atlassian.com',
      client_id: this.config.clientId,
      scope: SCOPE,
      redirect_uri: this.config.redirectUri,
      state,
      response_type: 'code',
      prompt: 'consent',
    }).toString();
    return url.toString();
  }

  async fetchProfile(code: string): Promise<ExternalProfile> {
    try {
      const tokenResponse = await this.fetchFn(TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grant_type: 'authorization_code',
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          code,
          redirect_uri: this.config.redirectUri,
        }),
      });
      if (!tokenResponse.ok) throw loginFailed();
      const { access_token: accessToken } = (await tokenResponse.json()) as {
        access_token?: string;
      };
      if (!accessToken) throw loginFailed();

      const meResponse = await this.fetchFn(ME_URL, {
        headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
      });
      if (!meResponse.ok) throw loginFailed();
      const me = (await meResponse.json()) as {
        account_id?: string;
        email?: string;
        name?: string;
        picture?: string;
      };
      if (!me.account_id) throw loginFailed();

      return {
        provider: 'atlassian',
        providerAccountId: me.account_id,
        // El usuario puede ocultar su email en Atlassian: entonces queda vacío.
        email: me.email ?? '',
        displayName: me.name ?? me.email ?? 'Atlassian user',
        avatarUrl: me.picture ?? null,
      };
    } catch (error) {
      // Cualquier fallo (red, respuesta rara, código rechazado) se reduce a un mensaje nuestro:
      // el error original podría contener datos que no deben salir.
      throw error instanceof AuthError ? error : loginFailed();
    }
  }
}
