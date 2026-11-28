import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ApiError, type JobSummary } from '../lib/api';
import type { Action, Role } from '../lib/auth';
import { AuthContext, type AuthValue } from './auth-provider';
import { Dashboard } from './dashboard';

const job = (
  id: string,
  status: JobSummary['status'],
  createdAt = '2026-11-20T10:00:00Z',
): JobSummary => ({
  id,
  issueKey: `YAQ-${id}`,
  summary: `Historia ${id}`,
  status,
  tokensUsed: 0,
  attemptCount: 1,
  createdAt: new Date(createdAt),
});

const as = (role: Role, permissions: Action[]): AuthValue => ({
  user: { id: 'u', email: 'a@x.com', displayName: 'María Luján Tissera', avatarUrl: null, role },
  permissions,
  can: (action) => permissions.includes(action),
  signOut: async () => undefined,
});

const CONTROLLER: Action[] = ['job:read', 'job:create', 'job:clarify'];

const renderDashboard = (auth: AuthValue, loadJobs: () => Promise<JobSummary[]>) =>
  render(
    <AuthContext.Provider value={auth}>
      <Dashboard loadJobs={loadJobs} />
    </AuthContext.Provider>,
  );

describe('Dashboard', () => {
  it('saluda por el nombre de pila y enseña el rol', async () => {
    renderDashboard(as('QA Controller', CONTROLLER), async () => []);
    expect(
      await screen.findByRole('heading', { level: 1, name: /hola, maría/i }),
    ).toBeInTheDocument();
    expect(screen.getByText('QA Controller')).toBeInTheDocument();
  });

  it('enseña las cifras: total, superados, fallidos y los que esperan respuesta', async () => {
    const jobs = [
      job('1', 'done'),
      job('2', 'done'),
      job('3', 'fail'),
      job('4', 'awaiting_clarification'),
      job('5', 'running'),
    ];
    renderDashboard(as('QA Controller', CONTROLLER), async () => jobs);

    const stats = await screen.findByRole('list', { name: /resumen/i });
    const value = (label: RegExp) =>
      within(within(stats).getByText(label).closest('li')!).getByTestId('stat-value').textContent;
    expect(value(/total/i)).toBe('5');
    expect(value(/superados/i)).toBe('2');
    expect(value(/fallidos/i)).toBe('1');
    expect(value(/esperan tu respuesta/i)).toBe('1');
  });

  it('lista los jobs que necesitan atención, con enlace al detalle', async () => {
    renderDashboard(as('QA Controller', CONTROLLER), async () => [
      job('1', 'done'),
      job('7', 'awaiting_clarification'),
    ]);

    const attention = await screen.findByRole('region', { name: /necesitan tu atención/i });
    expect(within(attention).getByRole('link', { name: /historia 7/i })).toHaveAttribute(
      'href',
      '/jobs/7',
    );
    expect(within(attention).queryByText(/historia 1/i)).not.toBeInTheDocument();
  });

  it('si nada espera respuesta lo dice', async () => {
    renderDashboard(as('QA Controller', CONTROLLER), async () => [job('1', 'done')]);
    const attention = await screen.findByRole('region', { name: /necesitan tu atención/i });
    expect(within(attention).getByText(/nada pendiente/i)).toBeInTheDocument();
  });

  it('muestra la actividad reciente, la más nueva primero y como mucho cinco', async () => {
    const jobs = Array.from({ length: 7 }, (_, i) =>
      job(String(i + 1), 'done', `2026-11-${String(10 + i).padStart(2, '0')}T10:00:00Z`),
    );
    renderDashboard(as('QA Controller', CONTROLLER), async () => jobs);

    const recent = await screen.findByRole('region', { name: /actividad reciente/i });
    // Solo los enlaces a un job (la sección también tiene el enlace "Ver todos").
    const titles = within(recent)
      .getAllByRole('link')
      .filter((link) => link.getAttribute('href')?.startsWith('/jobs/'))
      .map((link) => link.textContent);
    expect(titles).toEqual(['Historia 7', 'Historia 6', 'Historia 5', 'Historia 4', 'Historia 3']);
  });

  it('quien puede crear tests ve el botón "Crear test"; un QA Executer no', async () => {
    const { unmount } = renderDashboard(as('QA Controller', CONTROLLER), async () => []);
    expect(await screen.findByRole('link', { name: /crear test/i })).toHaveAttribute(
      'href',
      '/crear',
    );
    unmount();

    renderDashboard(as('QA Executer', ['job:read']), async () => []);
    await screen.findByRole('heading', { level: 1 });
    expect(screen.queryByRole('link', { name: /crear test/i })).not.toBeInTheDocument();
  });

  it('sin ningún job explica cómo funciona', async () => {
    renderDashboard(as('QA Controller', CONTROLLER), async () => []);
    expect(await screen.findByText(/aún no hay tests/i)).toBeInTheDocument();
  });

  it('si falla la carga ofrece reintentar', async () => {
    const loadJobs = vi
      .fn<() => Promise<JobSummary[]>>()
      .mockRejectedValueOnce(new ApiError('internal_error', 'Internal server error.'))
      .mockResolvedValueOnce([job('1', 'done')]);
    renderDashboard(as('QA Controller', CONTROLLER), loadJobs);

    const alert = await screen.findByRole('alert');
    await userEvent.click(within(alert).getByRole('button', { name: /reintentar/i }));

    expect(await screen.findByRole('list', { name: /resumen/i })).toBeInTheDocument();
  });
});
