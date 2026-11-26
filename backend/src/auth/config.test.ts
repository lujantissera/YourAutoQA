import { describe, expect, it } from 'vitest';
import { loadAuthConfig } from './config.js';

const base = {
  ATLASSIAN_CLIENT_ID: 'client-id',
  ATLASSIAN_CLIENT_SECRET: 'client-secret',
  ATLASSIAN_REDIRECT_URI: 'http://localhost:3001/api/auth/callback',
};

describe('loadAuthConfig', () => {
  it('lee las variables obligatorias y aplica los valores por defecto', () => {
    expect(loadAuthConfig(base)).toEqual({
      clientId: 'client-id',
      clientSecret: 'client-secret',
      redirectUri: 'http://localhost:3001/api/auth/callback',
      sessionTtlHours: 12,
      adminEmails: [],
      cookieSecure: false,
    });
  });

  it.each(['ATLASSIAN_CLIENT_ID', 'ATLASSIAN_CLIENT_SECRET', 'ATLASSIAN_REDIRECT_URI'])(
    'falla con un mensaje claro si falta %s',
    (name) => {
      expect(() => loadAuthConfig({ ...base, [name]: '  ' })).toThrow(name);
    },
  );

  it('el error nunca incluye el valor del secreto', () => {
    expect(() => loadAuthConfig({ ...base, ATLASSIAN_CLIENT_ID: '' })).not.toThrow(/client-secret/);
  });

  it('SESSION_TTL_HOURS tiene que ser un número positivo', () => {
    expect(loadAuthConfig({ ...base, SESSION_TTL_HOURS: '2' }).sessionTtlHours).toBe(2);
    expect(() => loadAuthConfig({ ...base, SESSION_TTL_HOURS: '0' })).toThrow('SESSION_TTL_HOURS');
    expect(() => loadAuthConfig({ ...base, SESSION_TTL_HOURS: 'abc' })).toThrow(
      'SESSION_TTL_HOURS',
    );
  });

  it('ADMIN_EMAILS es una lista separada por comas, sin espacios y en minúsculas', () => {
    const config = loadAuthConfig({ ...base, ADMIN_EMAILS: ' Ana@X.com, ,bob@x.com ' });
    expect(config.adminEmails).toEqual(['ana@x.com', 'bob@x.com']);
  });

  it('COOKIE_SECURE=true activa la cookie segura (HTTPS)', () => {
    expect(loadAuthConfig({ ...base, COOKIE_SECURE: 'true' }).cookieSecure).toBe(true);
    expect(loadAuthConfig({ ...base, COOKIE_SECURE: 'false' }).cookieSecure).toBe(false);
  });
});
