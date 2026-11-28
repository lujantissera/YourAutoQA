import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { JobSummary } from '../lib/api';
import { JobsControl } from './jobs-control';

const job = (id: string, status: JobSummary['status']): JobSummary => ({
  id,
  issueKey: `YAQ-${id}`,
  summary: `Historia ${id}`,
  status,
  tokensUsed: 0,
  attemptCount: 1,
  createdAt: new Date('2026-11-20T10:00:00Z'),
});

const jobs = [job('1', 'done'), job('2', 'fail'), job('3', 'awaiting_clarification')];

describe('JobsControl', () => {
  it('empieza mostrando todos los jobs', async () => {
    render(<JobsControl loadJobs={async () => jobs} />);
    expect(await screen.findByText('Historia 1')).toBeInTheDocument();
    expect(screen.getByText('Historia 2')).toBeInTheDocument();
    expect(screen.getByText('Historia 3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Todos' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('filtrar por "Fallidos" deja solo los fallidos y marca el filtro activo', async () => {
    render(<JobsControl loadJobs={async () => jobs} />);
    await screen.findByText('Historia 1');

    await userEvent.click(screen.getByRole('button', { name: 'Fallidos' }));

    expect(screen.getByText('Historia 2')).toBeInTheDocument();
    expect(screen.queryByText('Historia 1')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Fallidos' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Todos' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('un filtro sin resultados lo explica', async () => {
    render(<JobsControl loadJobs={async () => [job('1', 'done')]} />);
    await screen.findByText('Historia 1');

    await userEvent.click(screen.getByRole('button', { name: 'En curso' }));

    expect(screen.getByText(/no hay jobs con este estado/i)).toBeInTheDocument();
  });
});
