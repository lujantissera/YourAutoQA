import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Pool } from 'pg';

// Aplica en orden los archivos .sql de `directory` que aún no se hayan aplicado, y devuelve sus
// nombres. Qué migraciones están ya aplicadas se apunta en la tabla `schema_migrations`.
export async function migrate(pool: Pool, directory: string): Promise<string[]> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name       text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  // Los nombres llevan un número delante (001_, 002_...) para que ordenarlos sea ordenar las migraciones.
  const files = (await readdir(directory)).filter((name) => name.endsWith('.sql')).sort();
  const { rows } = await pool.query<{ name: string }>('SELECT name FROM schema_migrations');
  const alreadyApplied = new Set(rows.map((row) => row.name));

  const applied: string[] = [];
  for (const name of files) {
    if (alreadyApplied.has(name)) continue;
    const sql = await readFile(join(directory, name), 'utf8');

    // Una conexión propia y una transacción: la migración se aplica entera junto con su anotación,
    // o no queda nada (si falla a medias, ROLLBACK la deshace).
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [name]);
      await client.query('COMMIT');
      applied.push(name);
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw new Error(`Migration ${name} failed: ${(error as Error).message}`, { cause: error });
    } finally {
      client.release();
    }
  }
  return applied;
}
