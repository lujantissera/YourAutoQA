// Test de integración: necesita el Postgres de `docker compose up -d`.
// Uso (desde backend/): npm run test:integration
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadDatabaseUrl } from './config.js';
import { migrate } from './migrate.js';

// El .env está en la raíz del repo (tres carpetas por encima de este archivo).
try {
  process.loadEnvFile(fileURLToPath(new URL('../../../.env', import.meta.url)));
} catch {
  // sin .env: puede que las variables ya vengan del entorno
}

const databaseUrl = loadDatabaseUrl(process.env);
const adminPool = new Pool({ connectionString: databaseUrl });

// Cada test trabaja en su propio "cajón" (schema) de la base de datos y lo borra al terminar,
// así no se ensucia nada ni chocan unos tests con otros.
let schema: string;
let pool: Pool;
let directory: string;

beforeEach(async () => {
  schema = `test_${randomUUID().replaceAll('-', '')}`;
  await adminPool.query(`CREATE SCHEMA ${schema}`);
  pool = new Pool({ connectionString: databaseUrl, options: `-c search_path=${schema}` });
  directory = await mkdtemp(join(tmpdir(), 'migrations-'));
});

afterEach(async () => {
  await pool.end();
  await adminPool.query(`DROP SCHEMA ${schema} CASCADE`);
  await rm(directory, { recursive: true, force: true });
});

afterAll(async () => {
  await adminPool.end();
});

// Escribe archivos en la carpeta temporal de migraciones de este test.
async function writeFiles(files: Record<string, string>): Promise<void> {
  for (const [name, content] of Object.entries(files)) {
    await writeFile(join(directory, name), content);
  }
}

async function tableExists(name: string): Promise<boolean> {
  const { rows } = await pool.query<{ found: string | null }>('SELECT to_regclass($1) AS found', [
    name,
  ]);
  return rows[0]?.found !== null;
}

describe('migrate', () => {
  it('aplica las migraciones pendientes en orden por nombre y devuelve sus nombres', async () => {
    // 002 depende de la tabla de 001: si se aplicara al revés, fallaría.
    await writeFiles({
      '002_b.sql': 'CREATE TABLE b (a_id integer REFERENCES a (id));',
      '001_a.sql': 'CREATE TABLE a (id integer PRIMARY KEY);',
    });

    expect(await migrate(pool, directory)).toEqual(['001_a.sql', '002_b.sql']);
    expect(await tableExists('a')).toBe(true);
    expect(await tableExists('b')).toBe(true);
  });

  it('es idempotente: la segunda vez no aplica nada', async () => {
    await writeFiles({ '001_a.sql': 'CREATE TABLE a (id integer);' });
    await migrate(pool, directory);

    expect(await migrate(pool, directory)).toEqual([]);
  });

  it('si se añade una migración nueva, solo aplica esa', async () => {
    await writeFiles({ '001_a.sql': 'CREATE TABLE a (id integer);' });
    await migrate(pool, directory);
    await writeFiles({ '002_b.sql': 'CREATE TABLE b (id integer);' });

    expect(await migrate(pool, directory)).toEqual(['002_b.sql']);
  });

  it('una migración con error se deshace entera, nombra el archivo y detiene las siguientes', async () => {
    await writeFiles({
      '001_ok.sql': 'CREATE TABLE ok (id integer);',
      '002_bad.sql': 'CREATE TABLE half (id integer); INSERT INTO no_existe VALUES (1);',
      '003_never.sql': 'CREATE TABLE never (id integer);',
    });

    await expect(migrate(pool, directory)).rejects.toThrow(/002_bad\.sql/);

    expect(await tableExists('ok')).toBe(true);
    expect(await tableExists('half')).toBe(false); // se deshizo con la transacción
    expect(await tableExists('never')).toBe(false); // no llegó a ejecutarse
    const { rows } = await pool.query<{ name: string }>('SELECT name FROM schema_migrations');
    expect(rows.map((row) => row.name)).toEqual(['001_ok.sql']);
  });

  it('ignora los archivos que no son .sql', async () => {
    await writeFiles({
      'README.md': '# notas',
      '001_a.sql': 'CREATE TABLE a (id integer);',
    });

    expect(await migrate(pool, directory)).toEqual(['001_a.sql']);
  });

  it('las migraciones reales del proyecto se aplican y crean jobs y job_attempts', async () => {
    const realDirectory = fileURLToPath(new URL('../../migrations', import.meta.url));

    const applied = await migrate(pool, realDirectory);

    expect(applied).toContain('001_create_jobs.sql');
    expect(await tableExists('jobs')).toBe(true);
    expect(await tableExists('job_attempts')).toBe(true);
  });
});
