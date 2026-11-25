import type { JobSummary } from './api';
import { shouldPoll } from './should-poll';

const job = (status: JobSummary['status']): JobSummary => ({
  id: `job-${status}`,
  issueKey: 'PROJ-123',
  summary: 'Login',
  status,
  tokensUsed: 0,
  attemptCount: 0,
  createdAt: new Date('2026-11-25T10:00:00.000Z'),
});

describe('shouldPoll', () => {
  it('keeps polling while a job is generating', () => {
    expect(shouldPoll([job('done'), job('generating')])).toBe(true);
  });

  it('keeps polling while a job is running', () => {
    expect(shouldPoll([job('running')])).toBe(true);
  });

  it('stops when every job is finished or waiting for the user', () => {
    expect(shouldPoll([job('done'), job('fail'), job('awaiting_clarification')])).toBe(false);
  });

  it('does not poll when there are no jobs', () => {
    expect(shouldPoll([])).toBe(false);
  });
});
