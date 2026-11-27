import { ApiError, clarify, createJob, getJob, listJobs } from './api';

// Sustituye fetch por un falso: los tests nunca llaman al backend real.
const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch);
});

afterEach(() => {
  mockFetch.mockReset();
  vi.unstubAllGlobals();
});

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

describe('listJobs', () => {
  it('calls /api/jobs and returns the jobs array', async () => {
    mockFetch.mockResolvedValue(
      jsonResponse({
        jobs: [
          {
            id: 'job-1',
            issueKey: 'PROJ-123',
            summary: 'Login',
            status: 'done',
            tokensUsed: 120,
            attemptCount: 2,
            createdAt: '2026-11-21T10:00:00.000Z',
          },
        ],
      }),
    );

    const jobs = await listJobs();

    expect(mockFetch).toHaveBeenCalledWith('/api/jobs', expect.anything());
    expect(jobs).toHaveLength(1);
    expect(jobs[0]?.issueKey).toBe('PROJ-123');
  });

  it('turns createdAt into a real Date', async () => {
    mockFetch.mockResolvedValue(
      jsonResponse({
        jobs: [
          {
            id: 'job-1',
            issueKey: 'PROJ-123',
            summary: 'Login',
            status: 'done',
            tokensUsed: 0,
            attemptCount: 0,
            createdAt: '2026-11-21T10:00:00.000Z',
          },
        ],
      }),
    );

    const [job] = await listJobs();

    expect(job?.createdAt).toBeInstanceOf(Date);
    expect(job?.createdAt.toISOString()).toBe('2026-11-21T10:00:00.000Z');
  });

  it('throws an ApiError with the backend code and message when the request fails', async () => {
    mockFetch.mockResolvedValue(
      jsonResponse({ error: { code: 'internal_error', message: 'Internal server error.' } }, 500),
    );

    const failure = await listJobs().catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(ApiError);
    expect(failure).toMatchObject({ code: 'internal_error', message: 'Internal server error.' });
  });
});

describe('createJob', () => {
  it('posts the issue key as JSON and returns the created job', async () => {
    mockFetch.mockResolvedValue(
      jsonResponse(
        { id: 'job-9', issueKey: 'PROJ-123', summary: 'Login', status: 'generating' },
        202,
      ),
    );

    const created = await createJob('PROJ-123');

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/jobs',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ issueKey: 'PROJ-123' }),
      }),
    );
    expect(created).toMatchObject({ id: 'job-9', status: 'generating' });
  });

  it('throws an ApiError with the Jira error code when the story cannot be used', async () => {
    mockFetch.mockResolvedValue(
      jsonResponse({ error: { code: 'not_found', message: 'Issue PROJ-999 not found.' } }, 404),
    );

    const failure = await createJob('PROJ-999').catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(ApiError);
    expect(failure).toMatchObject({ code: 'not_found', message: 'Issue PROJ-999 not found.' });
  });
});

const jobDetailBody = {
  id: 'job-1',
  issueKey: 'PROJ-123',
  summary: 'Login',
  status: 'awaiting_clarification',
  attempts: [
    {
      id: 1,
      attempt: 1,
      robotCode: '*** Test Cases ***',
      run: { result: 'FAIL', logs: 'Element not found', timedOut: false },
      failureKind: 'missing_info',
    },
  ],
  tokensUsed: 300,
  question: '¿Qué credenciales de prueba debo usar?',
  failureReason: null,
  createdAt: '2026-11-25T10:00:00.000Z',
};

describe('getJob', () => {
  it('gets /api/jobs/:id and returns the detail with a real Date', async () => {
    mockFetch.mockResolvedValue(jsonResponse(jobDetailBody));

    const job = await getJob('job-1');

    expect(mockFetch).toHaveBeenCalledWith('/api/jobs/job-1', expect.anything());
    expect(job.question).toBe('¿Qué credenciales de prueba debo usar?');
    expect(job.attempts[0]?.run.logs).toBe('Element not found');
    expect(job.createdAt).toBeInstanceOf(Date);
  });

  it('throws an ApiError with job_not_found when the job does not exist', async () => {
    mockFetch.mockResolvedValue(
      jsonResponse({ error: { code: 'job_not_found', message: 'Job not found.' } }, 404),
    );

    const failure = await getJob('nope').catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(ApiError);
    expect(failure).toMatchObject({ code: 'job_not_found' });
  });
});

describe('clarify', () => {
  it('posts the answer as JSON to /api/jobs/:id/clarify', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ ...jobDetailBody, status: 'generating' }, 202));

    const job = await clarify('job-1', 'usuario@test.com / Test1234');

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/jobs/job-1/clarify',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answer: 'usuario@test.com / Test1234' }),
      }),
    );
    expect(job.status).toBe('generating');
  });

  it('throws an ApiError when the job is not waiting for an answer', async () => {
    mockFetch.mockResolvedValue(
      jsonResponse(
        { error: { code: 'not_awaiting_clarification', message: 'Job is not waiting.' } },
        409,
      ),
    );

    const failure = await clarify('job-1', 'hola').catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(ApiError);
    expect(failure).toMatchObject({ code: 'not_awaiting_clarification' });
  });
});
