// Comando `npm run migrate` (desde backend/): aplica las migraciones pendientes a la base de datos
// de DATABASE_URL. Solo cablea lo que ya está probado en migrate.ts.
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';
import { loadDatabaseUrl } from './config.js';
import { migrate } from './migrate.js';

// El .env está en la raíz del repo, fuera de backend/.
try {
  process.loadEnvFile('../.env');
} catch {
  // sin .env: puede que las variables ya vengan del entorno
}

const pool = new Pool({ connectionString: loadDatabaseUrl(process.env) });
try {
  const directory = fileURLToPath(new URL('../../migrations', import.meta.url));
  const applied = await migrate(pool, directory);
  process.stdout.write(
    applied.length > 0 ? `Applied: ${applied.join(', ')}\n` : 'Nothing to migrate.\n',
  );
} catch (error) {
  console.error((error as Error).message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
