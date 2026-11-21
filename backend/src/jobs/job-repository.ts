import type { Job, JobPatch, JobSummary, NewJob } from './job.js';

// Cuántos jobs devuelve `list` como máximo. La paginación completa llegará cuando haga falta.
export const JOB_LIST_LIMIT = 100;

// Puerto: dónde se guardan los jobs. Hoy en memoria (3a); en 3b, PostgreSQL, sin tocar quien lo usa.
export interface JobRepository {
  create(input: NewJob): Promise<Job>;
  get(id: string): Promise<Job | undefined>;
  /** Falla si el job no existe. */
  update(id: string, patch: JobPatch): Promise<Job>;
  /** Los más recientes primero, como máximo JOB_LIST_LIMIT. */
  list(): Promise<JobSummary[]>;
  /**
   * Pasa a `fail` (con este motivo) los jobs que estaban en marcha (`generating` o `running`) y
   * devuelve cuántos eran. Se usa al arrancar el servidor: esos jobs se quedaron sin quien los
   * ejecute. Los que esperan una respuesta (`awaiting_clarification`) no se tocan: se pueden reanudar.
   */
  failInterrupted(reason: string): Promise<number>;
}
