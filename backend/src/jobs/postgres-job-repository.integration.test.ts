// Test de integración: necesita el Postgres de `docker compose up -d`.
// Uso (desde backend/): npx vitest run src/jobs/postgres-job-repository.integration.test.ts
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';
import { afterAll } from 'vitest';
import { loadDatabaseUrl } from '../db/config.js';
import { migrate } from '../db/migrate.js';
import { describeJobRepositoryContract } from './job-repository.contract.js';
import { PostgresJobRepository } from './postgres-job-repository.js';

// El .env está en la raíz del repo (tres carpetas por encima de este archivo).
try {
  process.loadEnvFile(fileURLToPath(new URL('../../../.env', import.meta.url)));
} catch {
  // sin .env: puede que las variables ya vengan del entorno
}

const databaseUrl = loadDatabaseUrl(process.env);
const adminPool = new Pool({ connectionString: databaseUrl });
const migrationsDirectory = fileURLToPath(new URL('../../migrations', import.meta.url));

afterAll(async () => {
  await adminPool.end();
});

// Cada test trabaja en su propio "cajón" (schema) con las tablas reales creadas por nuestras
// migraciones, y lo borra al terminar: no se ensucia nada ni chocan unos tests con otros.
describeJobRepositoryContract('PostgresJobRepository', async (options) => {
  const schema = `test_${randomUUID().replaceAll('-', '')}`;
  await adminPool.query(`CREATE SCHEMA ${schema}`);
  const pool = new Pool({ connectionString: databaseUrl, options: `-c search_path=${schema}` });
  await migrate(pool, migrationsDirectory);

  return {
    repository: new PostgresJobRepository(pool, options),
    dispose: async () => {
      await pool.end();
      await adminPool.query(`DROP SCHEMA ${schema} CASCADE`);
    },
  };
});
