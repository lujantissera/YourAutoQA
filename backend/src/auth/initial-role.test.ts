import { describe, expect, it } from 'vitest';
import { resolveInitialRole } from './initial-role.js';
import type { ExternalProfile } from './user.js';

const profile = (email: string): ExternalProfile => ({
  provider: 'atlassian',
  providerAccountId: 'acc-1',
  email,
  displayName: 'Ana',
  avatarUrl: null,
});

describe('resolveInitialRole', () => {
  it('un usuario cualquiera entra como Pending, sin acceso (D-64)', () => {
    expect(resolveInitialRole(profile('nadie@x.com'), { adminEmails: [] })).toBe('Pending');
    expect(resolveInitialRole(profile('nadie@x.com'), { adminEmails: ['otro@x.com'] })).toBe(
      'Pending',
    );
  });

  it('un correo de ADMIN_EMAILS entra como Admin, sin importar las mayúsculas', () => {
    const config = { adminEmails: ['lujan@x.com'] };
    expect(resolveInitialRole(profile('lujan@x.com'), config)).toBe('Admin');
    expect(resolveInitialRole(profile('Lujan@X.com'), config)).toBe('Admin');
  });

  it('un email vacío (el usuario lo oculta en Atlassian) nunca es Admin', () => {
    expect(resolveInitialRole(profile(''), { adminEmails: [''] })).toBe('Pending');
    expect(resolveInitialRole(profile(''), { adminEmails: ['lujan@x.com'] })).toBe('Pending');
  });
});
