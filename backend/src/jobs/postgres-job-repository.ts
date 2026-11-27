import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import type { AttemptRecord, FailureKind, JobStatus } from '../agent/state.js';
import type { Job, JobPatch, JobSummary, NewJob } from './job.js';
import { JOB_LIST_LIMIT, type JobRepository } from './job-repository.js';

export interface PostgresJobRepositoryOptions {
  newId?: () => string;
  now?: () => Date;
}

// Filas tal como las devuelve Postgres (columnas en snake_case).
interface JobRow {
  id: string;
  issue_key: string;
  summary: string;
  status: JobStatus;
  tokens_used: number;
  question: string | null;
  failure_reason: string | null;
  created_at: Date;
}

interface AttemptRow {
  id: number;
  attempt: number;
  robot_code: string;
  result: 'PASS' | 'FAIL';
  logs: string;
  timed_out: boolean;
  failure_kind: FailureKind | null;
}

const UUID_FORMAT = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Qué columna corresponde a cada campo del JobPatch. Son nombres fijos nuestros, nunca texto del
// usuario, por eso es seguro ponerlos en el SQL; los valores siempre van como parámetros ($1, $2...).
const PATCH_COLUMNS = {
  status: 'status',
  tokensUsed: 'tokens_used',
  question: 'question',
  failureReason: 'failure_reason',
} as const;

const notFound = (id: string): Error => new Error(`Job ${id} not found`);

const toAttempt = (row: AttemptRow): AttemptRecord => ({
  id: row.id,
  attempt: row.attempt,
  robotCode: row.robot_code,
  run: { result: row.result, logs: row.logs, timedOut: row.timed_out },
  failureKind: row.failure_kind,
});

// Guarda los jobs en PostgreSQL (tablas `jobs` y `job_attempts`, ver backend/migrations).
// Cumple el mismo contrato que InMemoryJobRepository: los dos pasan los mismos tests.
export class PostgresJobRepository implements JobRepository {
  private readonly newId: () => string;
  private readonly now: () => Date;

  constructor(
    private readonly pool: Pool,
    options: PostgresJobRepositoryOptions = {},
  ) {
    this.newId = options.newId ?? randomUUID;
    this.now = options.now ?? (() => new Date());
  }

  async create(input: NewJob): Promise<Job> {
    const id = this.newId();
    await this.pool.query(
      `INSERT INTO jobs (id, issue_key, summary, status, created_at) VALUES ($1, $2, $3, $4, $5)`,
      [id, input.issueKey, input.summary, 'generating', this.now()],
    );
    return this.mustGet(id);
  }

  async get(id: string): Promise<Job | undefined> {
    // `id` es de tipo uuid: con un texto cualquiera Postgres lanzaría un error en vez de decir
    // "no existe". Un id que no tiene formato de UUID simplemente no puede existir.
    if (!UUID_FORMAT.test(id)) return undefined;

    const jobs = await this.pool.query<JobRow>('SELECT * FROM jobs WHERE id = $1', [id]);
    const row = jobs.rows[0];
    if (!row) return undefined;

    const attempts = await this.pool.query<AttemptRow>(
      `SELECT id, attempt, robot_code, result, logs, timed_out, failure_kind
         FROM job_attempts WHERE job_id = $1 ORDER BY id`,
      [id],
    );
    return {
      id: row.id,
      issueKey: row.issue_key,
      summary: row.summary,
      status: row.status,
      attempts: attempts.rows.map(toAttempt),
      tokensUsed: row.tokens_used,
      question: row.question,
      failureReason: row.failure_reason,
      createdAt: row.created_at,
    };
  }

  async update(id: string, patch: JobPatch): Promise<Job> {
    if (!UUID_FORMAT.test(id)) throw notFound(id);

    // `undefined` significa "no cambiar"; `null` sí es un valor (deja la columna vacía).
    const changes = (Object.keys(PATCH_COLUMNS) as (keyof typeof PATCH_COLUMNS)[]).filter(
      (field) => patch[field] !== undefined,
    );

    // Transacción: los campos del job y sus intentos cambian juntos, o no cambia nada.
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const assignments = changes.map((field, index) => `${PATCH_COLUMNS[field]} = $${index + 2}`);
      const result =
        changes.length > 0
          ? await client.query(`UPDATE jobs SET ${assignments.join(', ')} WHERE id = $1`, [
              id,
              ...changes.map((field) => patch[field]),
            ])
          : await client.query('SELECT 1 FROM jobs WHERE id = $1', [id]);
      if (result.rowCount === 0) throw notFound(id);

      // El servicio manda la lista completa de intentos tras cada paso: los que ya existen se
      // actualizan y los nuevos se añaden ("upsert").
      for (const attempt of patch.attempts ?? []) {
        await client.query(
          `INSERT INTO job_attempts (job_id, id, attempt, robot_code, result, logs, timed_out, failure_kind)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (job_id, id) DO UPDATE SET
             attempt = EXCLUDED.attempt,
             robot_code = EXCLUDED.robot_code,
             result = EXCLUDED.result,
             logs = EXCLUDED.logs,
             timed_out = EXCLUDED.timed_out,
             failure_kind = EXCLUDED.failure_kind`,
          [
            id,
            attempt.id,
            attempt.attempt,
            attempt.robotCode,
            attempt.run.result,
            attempt.run.logs,
            attempt.run.timedOut,
            attempt.failureKind,
          ],
        );
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
    return this.mustGet(id);
  }

  async failInterrupted(reason: string): Promise<number> {
    const result = await this.pool.query(
      `UPDATE jobs SET status = 'fail', failure_reason = $1
        WHERE status IN ('generating', 'running')`,
      [reason],
    );
    return result.rowCount ?? 0;
  }

  async list(): Promise<JobSummary[]> {
    // Sin traer los intentos (pesan mucho): solo se cuentan con una subconsulta. `count` devuelve
    // un bigint que `pg` entrega como texto, por eso el `::int`.
    const { rows } = await this.pool.query<
      Omit<JobRow, 'question' | 'failure_reason'> & { attempt_count: number }
    >(
      `SELECT j.id, j.issue_key, j.summary, j.status, j.tokens_used, j.created_at,
              (SELECT count(*) FROM job_attempts a WHERE a.job_id = j.id)::int AS attempt_count
         FROM jobs j
        ORDER BY j.created_at DESC
        LIMIT $1`,
      [JOB_LIST_LIMIT],
    );
    return rows.map((row) => ({
      id: row.id,
      issueKey: row.issue_key,
      summary: row.summary,
      status: row.status,
      tokensUsed: row.tokens_used,
      attemptCount: row.attempt_count,
      createdAt: row.created_at,
    }));
  }

  private async mustGet(id: string): Promise<Job> {
    const job = await this.get(id);
    if (!job) throw notFound(id);
    return job;
  }
}
