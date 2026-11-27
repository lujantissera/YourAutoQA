import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiError, type JobDetail } from '../lib/api';
import { JobDetailView } from './job-detail';

const detail = (overrides: Partial<JobDetail> = {}): JobDetail => ({
  id: 'job-1',
  issueKey: 'PROJ-123',
  summary: 'Login con email',
  status: 'done',
  attempts: [
    {
      id: 1,
      attempt: 1,
      robotCode: '*** Test Cases ***\nFirst version',
      run: { result: 'FAIL', logs: 'Element not found', timedOut: false },
      failureKind: 'technical',
    },
    {
      id: 2,
      attempt: 2,
      robotCode: '*** Test Cases ***\nSecond version',
      run: { result: 'PASS', logs: 'All keywords passed', timedOut: false },
      failureKind: null,
    },
  ],
  tokensUsed: 1200,
  question: null,
  failureReason: null,
  createdAt: new Date('2026-11-25T10:00:00.000Z'),
  ...overrides,
});

describe('JobDetailView', () => {
  it('shows a loading message until the job arrives', () => {
    render(
      <JobDetailView jobId="job-1" loadJob={vi.fn().mockReturnValue(new Promise(() => {}))} />,
    );

    expect(screen.getByRole('status')).toHaveTextContent('Cargando job');
  });

  it('shows the header and, for every attempt, its Robot code and log', async () => {
    render(<JobDetailView jobId="job-1" loadJob={vi.fn().mockResolvedValue(detail())} />);

    expect(await screen.findByRole('heading', { name: 'Login con email' })).toBeInTheDocument();
    expect(screen.getByText('PROJ-123')).toBeInTheDocument();
    expect(screen.getByText(/Superado en 2 intentos/)).toBeInTheDocument();
    expect(screen.getByText(/1200 tokens/)).toBeInTheDocument();
    expect(screen.getByText(/First version/)).toBeInTheDocument();
    expect(screen.getByText('Element not found')).toBeInTheDocument();
    expect(screen.getByText(/Second version/)).toBeInTheDocument();
    expect(screen.getByText('All keywords passed')).toBeInTheDocument();
  });

  it('shows the question and the answer form when the agent waits for the user', async () => {
    const loadJob = vi.fn().mockResolvedValue(
      detail({
        status: 'awaiting_clarification',
        attempts: [],
        question: '¿Qué credenciales de prueba debo usar?',
      }),
    );
    const clarify = vi.fn().mockResolvedValue(detail({ status: 'generating', attempts: [] }));
    render(<JobDetailView jobId="job-1" loadJob={loadJob} clarify={clarify} />);

    expect(await screen.findByText('¿Qué credenciales de prueba debo usar?')).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('Tu respuesta'), 'usuario / clave');
    await userEvent.click(screen.getByRole('button', { name: 'Enviar respuesta' }));

    // Al contestar, el job se reanuda: el formulario desaparece y el estado se actualiza.
    expect(clarify).toHaveBeenCalledWith('job-1', 'usuario / clave');
    expect(await screen.findByText(/Generando/)).toBeInTheDocument();
    expect(screen.queryByLabelText('Tu respuesta')).not.toBeInTheDocument();
  });

  it('shows why the job failed', async () => {
    const loadJob = vi
      .fn()
      .mockResolvedValue(
        detail({ status: 'fail', attempts: [], failureReason: 'OpenAI no respondió a tiempo.' }),
      );
    render(<JobDetailView jobId="job-1" loadJob={loadJob} />);

    expect(await screen.findByText(/OpenAI no respondió a tiempo/)).toBeInTheDocument();
  });

  it('explains the error in Spanish when the job cannot be loaded', async () => {
    const loadJob = vi.fn().mockRejectedValue(new ApiError('job_not_found', 'Job not found.'));
    render(<JobDetailView jobId="nope" loadJob={loadJob} />);

    expect(await screen.findByRole('alert')).toHaveTextContent('No se encuentra este job.');
  });

  describe('automatic refresh', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it('reloads while the job is running and stops when it finishes', async () => {
      const loadJob = vi
        .fn()
        .mockResolvedValueOnce(detail({ status: 'running', attempts: [] }))
        .mockResolvedValueOnce(detail());
      const advance = (ms: number) =>
        act(async () => {
          await vi.advanceTimersByTimeAsync(ms);
        });

      render(<JobDetailView jobId="job-1" loadJob={loadJob} pollIntervalMs={3000} />);
      await advance(0);
      expect(screen.getByText(/Ejecutando el test/)).toBeInTheDocument();

      await advance(3000);
      expect(screen.getByText(/Superado en 2 intentos/)).toBeInTheDocument();

      await advance(30000);
      expect(loadJob).toHaveBeenCalledTimes(2);
    });
  });
});
