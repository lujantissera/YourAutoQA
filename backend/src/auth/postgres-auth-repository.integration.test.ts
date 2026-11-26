// Test de integración: necesita el Postgres de `docker compose up -d`.
// Uso (desde backend/): npx vitest run src/auth/postgres-auth-repository.integration.test.ts
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';
import { afterAll } from 'vitest';
import { loadDatabaseUrl } from '../db/config.js';
import { migrate } from '../db/migrate.js';
import { describeAuthRepositoryContract } from './auth-repository.contract.js';
import { PostgresAuthRepository } from './postgres-auth-repository.js';

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

// Igual que en los jobs: cada test usa su propio schema con las tablas reales de las migraciones.
describeAuthRepositoryContract('PostgresAuthRepository', async (options) => {
  const schema = `test_${randomUUID().replaceAll('-', '')}`;
  await adminPool.query(`CREATE SCHEMA ${schema}`);
  const pool = new Pool({ connectionString: databaseUrl, options: `-c search_path=${schema}` });
  await migrate(pool, migrationsDirectory);

  return {
    repository: new PostgresAuthRepository(pool, options),
    dispose: async () => {
      await pool.end();
      await adminPool.query(`DROP SCHEMA ${schema} CASCADE`);
    },
  };
});
