import { randomUUID } from 'node:crypto';
import type { Job, JobPatch, NewJob } from './job.js';
import type { JobRepository } from './job-repository.js';

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
}
