import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { JobDetail } from '../lib/api';
import type { Action } from '../lib/auth';
import { AuthContext, type AuthValue } from './auth-provider';
import { JobDetailView } from './job-detail';
import { JobsPanel } from './jobs-panel';

// La interfaz esconde lo que el rol no puede hacer (US-02.1). Es comodidad: el backend lo vuelve a
// comprobar con un 403 (auth.test.ts del backend).
const as = (permissions: Action[]): AuthValue => ({
  user: { id: 'u', email: 'a@x.com', displayName: 'Ana', avatarUrl: null, role: 'QA Executer' },
  permissions,
  can: (action) => permissions.includes(action),
  signOut: async () => undefined,
});

vi.mock('../lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/api')>()),
  listJobs: async () => [],
}));

const paused: JobDetail = {
  id: 'j1',
  issueKey: 'YAQ-4',
  summary: 'Login',
  status: 'awaiting_clarification',
  tokensUsed: 0,
  createdAt: new Date('2026-11-25T10:00:00Z'),
  attempts: [],
  question: '¿Qué credenciales uso?',
  failureReason: null,
};

describe('visibilidad por rol', () => {
  it('un QA Executer no ve el formulario de crear jobs', () => {
    render(
      <AuthContext.Provider value={as(['job:read'])}>
        <JobsPanel />
      </AuthContext.Provider>,
    );
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('un QA Controller sí lo ve', () => {
    render(
      <AuthContext.Provider value={as(['job:read', 'job:create'])}>
        <JobsPanel />
      </AuthContext.Provider>,
    );
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('un QA Executer ve la pregunta del agente pero no puede responder', async () => {
    render(
      <AuthContext.Provider value={as(['job:read'])}>
        <JobDetailView jobId="j1" loadJob={async () => paused} />
      </AuthContext.Provider>,
    );
    expect(await screen.findByText('¿Qué credenciales uso?')).toBeInTheDocument();
    expect(screen.getByText(/solo un qa controller o un admin/i)).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('un QA Controller sí ve la caja de respuesta', async () => {
    render(
      <AuthContext.Provider value={as(['job:read', 'job:clarify'])}>
        <JobDetailView jobId="j1" loadJob={async () => paused} />
      </AuthContext.Provider>,
    );
    expect(await screen.findByRole('textbox')).toBeInTheDocument();
  });
});
