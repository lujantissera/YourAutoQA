import { describe, expect, it } from 'vitest';
import { generateSessionToken, hashSessionToken } from './session-token.js';

describe('session token', () => {
  it('genera tokens largos, aleatorios y seguros para ir en una cookie', () => {
    const a = generateSessionToken();
    const b = generateSessionToken();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/); // 32 bytes en base64url
  });

  it('el hash es estable y no revela el token', () => {
    const token = generateSessionToken();
    expect(hashSessionToken(token)).toBe(hashSessionToken(token));
    expect(hashSessionToken(token)).not.toContain(token);
    expect(hashSessionToken(token)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashSessionToken('otro')).not.toBe(hashSessionToken(token));
  });
});
