import { describeJob } from './describe-job';
import type { JobSummary } from './api';

const job = (overrides: Partial<JobSummary>): JobSummary => ({
  id: 'job-1',
  issueKey: 'PROJ-123',
  summary: 'Login',
  status: 'generating',
  tokensUsed: 0,
  attemptCount: 0,
  createdAt: new Date('2026-11-21T10:00:00.000Z'),
  ...overrides,
});

describe('describeJob', () => {
  it('marks every attempt as failed except the last one of a job that passed', () => {
    const view = describeJob(job({ status: 'done', attemptCount: 3 }));

    expect(view.attempts.map((attempt) => attempt.result)).toEqual(['FAIL', 'FAIL', 'PASS']);
    expect(view).toMatchObject({ glyph: '✓', text: 'Superado en 3 intentos', tone: 'pass' });
  });

  it('uses the singular when it passed at the first attempt', () => {
    expect(describeJob(job({ status: 'done', attemptCount: 1 })).text).toBe(
      'Superado en 1 intento',
    );
  });

  it('marks every attempt as failed when the job failed', () => {
    const view = describeJob(job({ status: 'fail', attemptCount: 5 }));

    expect(view.attempts.every((attempt) => attempt.result === 'FAIL')).toBe(true);
    expect(view.attempts).toHaveLength(5);
    expect(view).toMatchObject({ glyph: '✕', text: 'Fallido tras 5 intentos', tone: 'fail' });
  });

  it('says the agent is asking something when it waits for a clarification', () => {
    expect(describeJob(job({ status: 'awaiting_clarification', attemptCount: 1 }))).toMatchObject({
      glyph: '?',
      text: 'Te pregunta algo',
      tone: 'wait',
    });
  });

  it('describes a job that is still generating or running without inventing attempts', () => {
    expect(describeJob(job({ status: 'generating' }))).toMatchObject({
      text: 'Generando',
      tone: 'neutral',
      attempts: [],
    });
    expect(describeJob(job({ status: 'running', attemptCount: 2 })).text).toBe(
      'Ejecutando el test',
    );
  });
});
