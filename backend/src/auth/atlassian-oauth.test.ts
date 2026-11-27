import { describe, expect, it, vi } from 'vitest';
import { AuthError } from './errors.js';
import { AtlassianOAuth } from './atlassian-oauth.js';

const config = {
  clientId: 'client-id',
  clientSecret: 'client-secret',
  redirectUri: 'http://localhost:3001/api/auth/callback',
};

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

// Un `fetch` falso que responde según la URL: estos tests NUNCA hablan con Atlassian de verdad.
const fakeFetch = (handlers: Record<string, () => Response>) =>
  vi.fn(async (url: string | URL | Request) => {
    const handler = handlers[String(url)];
    if (!handler) throw new Error(`unexpected request to ${String(url)}`);
    return handler();
  });

describe('AtlassianOAuth', () => {
  it('authorizeUrl construye la URL de consentimiento con el state y el ámbito mínimo', () => {
    const url = new URL(new AtlassianOAuth(config, fakeFetch({})).authorizeUrl('abc'));
    expect(url.origin + url.pathname).toBe('https://auth.atlassian.com/authorize');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      audience: 'api.atlassian.com',
      client_id: 'client-id',
      scope: 'read:me',
      redirect_uri: config.redirectUri,
      state: 'abc',
      response_type: 'code',
      prompt: 'consent',
    });
  });

  it('fetchProfile cambia el código por un token y lee el perfil', async () => {
    const fetchFake = fakeFetch({
      'https://auth.atlassian.com/oauth/token': () => json({ access_token: 'tok' }),
      'https://api.atlassian.com/me': () =>
        json({ account_id: 'acc-1', email: 'a@x.com', name: 'Ana', picture: 'https://p/a.png' }),
    });

    const profile = await new AtlassianOAuth(config, fetchFake).fetchProfile('the-code');

    expect(profile).toEqual({
      provider: 'atlassian',
      providerAccountId: 'acc-1',
      email: 'a@x.com',
      displayName: 'Ana',
      avatarUrl: 'https://p/a.png',
    });

    // El código y el secreto viajan en el cuerpo del POST; el token, solo en la cabecera de /me.
    const [tokenUrl, tokenInit] = fetchFake.mock.calls[0] as unknown as [string, RequestInit];
    expect(tokenUrl).toBe('https://auth.atlassian.com/oauth/token');
    expect(tokenInit.method).toBe('POST');
    expect(JSON.parse(tokenInit.body as string)).toEqual({
      grant_type: 'authorization_code',
      client_id: 'client-id',
      client_secret: 'client-secret',
      code: 'the-code',
      redirect_uri: config.redirectUri,
    });
    const [, meInit] = fetchFake.mock.calls[1] as unknown as [string, RequestInit];
    expect((meInit.headers as Record<string, string>).Authorization).toBe('Bearer tok');
  });

  it('si el usuario oculta el email, el perfil se crea con email vacío', async () => {
    const fetchFake = fakeFetch({
      'https://auth.atlassian.com/oauth/token': () => json({ access_token: 'tok' }),
      'https://api.atlassian.com/me': () => json({ account_id: 'acc-1', name: 'Ana' }),
    });
    const profile = await new AtlassianOAuth(config, fetchFake).fetchProfile('c');
    expect(profile).toMatchObject({ email: '', avatarUrl: null });
  });

  it('un código rechazado por Atlassian es un AuthError sin filtrar el secreto', async () => {
    const fetchFake = fakeFetch({
      'https://auth.atlassian.com/oauth/token': () => json({ error: 'invalid_grant' }, 403),
    });
    const attempt = new AtlassianOAuth(config, fetchFake).fetchProfile('bad');
    await expect(attempt).rejects.toBeInstanceOf(AuthError);
    await expect(attempt).rejects.not.toThrow(/client-secret/);
  });

  it('un fallo de red o un perfil sin account_id también es un AuthError', async () => {
    const down = vi.fn(async () => {
      throw new Error('ECONNRESET');
    });
    await expect(new AtlassianOAuth(config, down).fetchProfile('c')).rejects.toBeInstanceOf(
      AuthError,
    );

    const noAccount = fakeFetch({
      'https://auth.atlassian.com/oauth/token': () => json({ access_token: 'tok' }),
      'https://api.atlassian.com/me': () => json({ name: 'Ana' }),
    });
    await expect(new AtlassianOAuth(config, noAccount).fetchProfile('c')).rejects.toBeInstanceOf(
      AuthError,
    );
  });
});
