import { randomUUID } from 'node:crypto';
import type { Job, JobPatch, JobSummary, NewJob } from './job.js';
import { JOB_LIST_LIMIT, type JobRepository } from './job-repository.js';

export interface InMemoryJobRepositoryOptions {
  newId?: () => string;
  now?: () => Date;
}

// Guarda los jobs en un Map. Se pierde al reiniciar, y por eso en 3b lo sustituye PostgreSQL.
// `newId` y `now` se pueden inyectar para que los tests sean predecibles.
export class InMemoryJobRepository implements JobRepository {
  private readonly jobs = new Map<string, Job>();
  private readonly newId: () => string;
  private readonly now: () => Date;

  constructor(options: InMemoryJobRepositoryOptions = {}) {
    this.newId = options.newId ?? randomUUID;
    this.now = options.now ?? (() => new Date());
  }

  async create(input: NewJob): Promise<Job> {
    const job: Job = {
      id: this.newId(),
      issueKey: input.issueKey,
      summary: input.summary,
      status: 'generating',
      attempts: [],
      tokensUsed: 0,
      question: null,
      failureReason: null,
      createdAt: this.now(),
    };
    this.jobs.set(job.id, job);
    return structuredClone(job);
  }

  async get(id: string): Promise<Job | undefined> {
    const job = this.jobs.get(id);
    return job && structuredClone(job);
  }

  async update(id: string, patch: JobPatch): Promise<Job> {
    const job = this.jobs.get(id);
    if (!job) throw new Error(`Job ${id} not found`);
    const updated: Job = { ...job, ...patch };
    this.jobs.set(id, updated);
    return structuredClone(updated);
  }

  async failInterrupted(reason: string): Promise<number> {
    let count = 0;
    for (const [id, job] of this.jobs) {
      if (job.status === 'generating' || job.status === 'running') {
        this.jobs.set(id, { ...job, status: 'fail', failureReason: reason });
        count++;
      }
    }
    return count;
  }

  async list(): Promise<JobSummary[]> {
    // `reverse` antes de ordenar: si dos jobs tienen la misma fecha, el creado después va primero.
    return [...this.jobs.values()]
      .reverse()
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, JOB_LIST_LIMIT)
      .map((job) => ({
        id: job.id,
        issueKey: job.issueKey,
        summary: job.summary,
        status: job.status,
        tokensUsed: job.tokensUsed,
        attemptCount: job.attempts.length,
        createdAt: new Date(job.createdAt),
      }));
  }
}
