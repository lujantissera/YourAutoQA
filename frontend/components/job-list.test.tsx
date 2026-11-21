import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiError, type JobSummary } from '../lib/api';
import { JobList } from './job-list';

const job = (overrides: Partial<JobSummary>): JobSummary => ({
  id: 'job-1',
  issueKey: 'PROJ-123',
  summary: 'Login con email',
  status: 'done',
  tokensUsed: 0,
  attemptCount: 3,
  createdAt: new Date('2026-11-21T10:00:00.000Z'),
  ...overrides,
});

describe('JobList', () => {
  it('shows a loading message until the jobs arrive', async () => {
    const loadJobs = vi.fn().mockReturnValue(new Promise(() => {}));

    render(<JobList loadJobs={loadJobs} />);

    expect(screen.getByRole('status')).toHaveTextContent('Cargando jobs');
  });

  it('shows one row per job with its key, summary and status', async () => {
    const loadJobs = vi
      .fn()
      .mockResolvedValue([
        job({ id: '1', issueKey: 'PROJ-123', summary: 'Login con email' }),
        job({
          id: '2',
          issueKey: 'PROJ-120',
          summary: 'Carrito',
          status: 'awaiting_clarification',
        }),
      ]);

    render(<JobList loadJobs={loadJobs} />);

    expect(await screen.findByText('Login con email')).toBeInTheDocument();
    expect(screen.getByText('PROJ-123')).toBeInTheDocument();
    expect(screen.getByText(/Superado en 3 intentos/)).toBeInTheDocument();
    expect(screen.getByText(/Te pregunta algo/)).toBeInTheDocument();
    expect(screen.getAllByRole('listitem').length).toBeGreaterThanOrEqual(2);
  });

  it('tells the user what to do when there are no jobs yet', async () => {
    const loadJobs = vi.fn().mockResolvedValue([]);

    render(<JobList loadJobs={loadJobs} />);

    expect(await screen.findByText(/Aún no hay jobs/)).toBeInTheDocument();
  });

  it('shows the error message and lets the user try again', async () => {
    const loadJobs = vi
      .fn()
      .mockRejectedValueOnce(new ApiError('internal_error', 'Internal server error.'))
      .mockResolvedValueOnce([job({ summary: 'Login con email' })]);

    render(<JobList loadJobs={loadJobs} />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Internal server error.');

    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(await screen.findByText('Login con email')).toBeInTheDocument();
    expect(loadJobs).toHaveBeenCalledTimes(2);
  });
});
