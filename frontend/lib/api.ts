export type JobStatus = 'generating' | 'running' | 'done' | 'fail' | 'awaiting_clarification';

// Resumen de un job tal como lo necesita la lista (misma forma que JobSummary del backend).
export type JobSummary = {
  id: string;
  issueKey: string;
  summary: string;
  status: JobStatus;
  tokensUsed: number;
  attemptCount: number;
  createdAt: Date;
};

// Error de la API con el código y el mensaje que envía el backend: { error: { code, message } }.
export class ApiError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
  }
}

async function readError(response: Response): Promise<ApiError> {
  try {
    const body = (await response.json()) as { error?: { code?: string; message?: string } };
    return new ApiError(
      body.error?.code ?? 'unknown_error',
      body.error?.message ?? 'Request failed.',
    );
  } catch {
    // La respuesta de error no era JSON (por ejemplo, el backend está caído).
    return new ApiError('unknown_error', `Request failed with status ${response.status}.`);
  }
}

export async function listJobs(): Promise<JobSummary[]> {
  const response = await fetch('/api/jobs', { cache: 'no-store' });
  if (!response.ok) throw await readError(response);

  const body = (await response.json()) as {
    jobs: Array<Omit<JobSummary, 'createdAt'> & { createdAt: string }>;
  };
  // En JSON las fechas viajan como texto: aquí las convertimos a Date.
  return body.jobs.map((job) => ({ ...job, createdAt: new Date(job.createdAt) }));
}

// Lo que devuelve el backend al crear un job: lo justo para saber que ha empezado.
export type CreatedJob = {
  id: string;
  issueKey: string;
  summary: string;
  status: JobStatus;
};

export async function createJob(issueKey: string): Promise<CreatedJob> {
  const response = await fetch('/api/jobs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ issueKey }),
  });
  if (!response.ok) throw await readError(response);
  return (await response.json()) as CreatedJob;
}

export type FailureKind = 'technical' | 'missing_info' | 'environment' | 'cannot_test';

// Un intento tal como lo devuelve GET /jobs/:id: el código Robot y el resultado de ejecutarlo.
export type AttemptDetail = {
  id: number;
  attempt: number;
  robotCode: string;
  run: { result: 'PASS' | 'FAIL'; logs: string; timedOut: boolean };
  failureKind: FailureKind | null;
};

export type JobDetail = Omit<JobSummary, 'attemptCount'> & {
  attempts: AttemptDetail[];
  question: string | null;
  failureReason: string | null;
};

type JobDetailBody = Omit<JobDetail, 'createdAt'> & { createdAt: string };

const toJobDetail = (body: JobDetailBody): JobDetail => ({
  ...body,
  createdAt: new Date(body.createdAt),
});

export async function getJob(id: string): Promise<JobDetail> {
  const response = await fetch(`/api/jobs/${encodeURIComponent(id)}`, { cache: 'no-store' });
  if (!response.ok) throw await readError(response);
  return toJobDetail((await response.json()) as JobDetailBody);
}

// El usuario contesta a la pregunta de un job pausado y el agente se reanuda (RF-9).
export async function clarify(id: string, answer: string): Promise<JobDetail> {
  const response = await fetch(`/api/jobs/${encodeURIComponent(id)}/clarify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ answer }),
  });
  if (!response.ok) throw await readError(response);
  return toJobDetail((await response.json()) as JobDetailBody);
}
