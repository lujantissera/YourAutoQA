import type { Job, JobPatch, NewJob } from './job.js';

// Puerto: dónde se guardan los jobs. Hoy en memoria (3a); en 3b, PostgreSQL, sin tocar quien lo usa.
export interface JobRepository {
  create(input: NewJob): Promise<Job>;
  get(id: string): Promise<Job | undefined>;
  /** Falla si el job no existe. */
  update(id: string, patch: JobPatch): Promise<Job>;
}
