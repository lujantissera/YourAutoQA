import { describe, expect, it } from 'vitest';
import { loadDatabaseUrl } from './config.js';

describe('loadDatabaseUrl', () => {
  it('lee DATABASE_URL del entorno', () => {
    const env = { DATABASE_URL: 'postgres://user:pass@localhost:5432/db' };

    expect(loadDatabaseUrl(env)).toBe('postgres://user:pass@localhost:5432/db');
  });

  it('recorta los espacios del valor', () => {
    expect(loadDatabaseUrl({ DATABASE_URL: '  postgres://localhost/db  ' })).toBe(
      'postgres://localhost/db',
    );
  });

  it.each([undefined, '', '   '])(
    'falla nombrando la variable si falta o está vacía: %j',
    (value) => {
      expect(() => loadDatabaseUrl({ DATABASE_URL: value })).toThrow(/DATABASE_URL/);
    },
  );
});
