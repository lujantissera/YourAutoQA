import type { JobSummary } from './api';

// Decide si la lista debe seguir consultando al backend: solo mientras algún job siga avanzando
// por su cuenta. Pura y sin reloj, para poder probarla sin esperar.
// Estados en los que el agente está trabajando y el job cambiará solo. Se listan los activos (y no
// los parados) a propósito: si el backend añade un estado nuevo, por defecto NO se consulta, en vez
// de martillear al servidor sin fin por un estado que no conocemos.
const ACTIVE_STATUSES: ReadonlySet<JobSummary['status']> = new Set(['generating', 'running']);

// Acepta cualquier cosa con `status`: sirve tanto para la lista (JobSummary) como para el detalle.
export function shouldPoll(jobs: Array<Pick<JobSummary, 'status'>>): boolean {
  return jobs.some((job) => ACTIVE_STATUSES.has(job.status));
}
