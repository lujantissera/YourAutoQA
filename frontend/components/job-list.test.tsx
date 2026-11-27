import { act, render, screen } from '@testing-library/react';
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
    const loadJobs = vi.fn().mockResolvedValue([
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

  it('reloads the jobs when refreshKey changes, without going back to loading', async () => {
    const loadJobs = vi
      .fn()
      .mockResolvedValueOnce([job({ id: '1', summary: 'Login con email' })])
      .mockResolvedValueOnce([
        job({ id: '1', summary: 'Login con email' }),
        job({ id: '2', issueKey: 'PROJ-124', summary: 'Recuperar contraseña' }),
      ]);

    const { rerender } = render(<JobList loadJobs={loadJobs} refreshKey={0} />);
    expect(await screen.findByText('Login con email')).toBeInTheDocument();

    rerender(<JobList loadJobs={loadJobs} refreshKey={1} />);

    // La lista que ya se veía no desaparece mientras llega la nueva.
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(await screen.findByText('Recuperar contraseña')).toBeInTheDocument();
    expect(loadJobs).toHaveBeenCalledTimes(2);
  });

  describe('automatic refresh', () => {
    // Reloj falso: avanzamos el tiempo a mano, sin esperar segundos reales.
    beforeEach(() => {
      vi.useFakeTimers();
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    const advance = (ms: number) =>
      act(async () => {
        await vi.advanceTimersByTimeAsync(ms);
      });

    it('reloads while a job is running and stops once everything has finished', async () => {
      const loadJobs = vi
        .fn()
        .mockResolvedValueOnce([job({ status: 'running', attemptCount: 1 })])
        .mockResolvedValueOnce([job({ status: 'done', attemptCount: 2 })]);

      render(<JobList loadJobs={loadJobs} pollIntervalMs={3000} />);
      await advance(0);
      expect(screen.getByText(/Ejecutando el test/)).toBeInTheDocument();
      expect(loadJobs).toHaveBeenCalledTimes(1);

      await advance(3000);
      expect(screen.getByText(/Superado en 2 intentos/)).toBeInTheDocument();
      expect(loadJobs).toHaveBeenCalledTimes(2);

      // Ya no hay nada en curso: por mucho que pase el tiempo, no vuelve a consultar.
      await advance(30000);
      expect(loadJobs).toHaveBeenCalledTimes(2);
    });

    it('does not reload on a timer when no job is in progress', async () => {
      const loadJobs = vi.fn().mockResolvedValue([job({ status: 'fail', attemptCount: 5 })]);

      render(<JobList loadJobs={loadJobs} pollIntervalMs={3000} />);
      await advance(0);
      await advance(30000);

      expect(loadJobs).toHaveBeenCalledTimes(1);
    });
  });
});
