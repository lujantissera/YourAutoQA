import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Action } from '../lib/auth';
import { AuthContext, type AuthValue } from './auth-provider';
import { CreateTest } from './create-test';

const push = vi.fn();
const router = { push };
vi.mock('next/navigation', () => ({ useRouter: () => router }));

beforeEach(() => push.mockClear());

const as = (permissions: Action[]): AuthValue => ({
  user: { id: 'u', email: 'a@x.com', displayName: 'Ana', avatarUrl: null, role: 'QA Controller' },
  permissions,
  can: (action) => permissions.includes(action),
  signOut: async () => undefined,
});

describe('CreateTest', () => {
  it('quien puede crear ve el formulario y una guía de cómo funciona', () => {
    render(
      <AuthContext.Provider value={as(['job:read', 'job:create'])}>
        <CreateTest />
      </AuthContext.Provider>,
    );
    expect(screen.getByLabelText(/clave de la historia/i)).toBeInTheDocument();
    expect(screen.getByRole('list', { name: /cómo funciona/i })).toBeInTheDocument();
  });

  it('al crear un test lleva al detalle del job para ver cómo avanza', async () => {
    const createJob = vi.fn(async () => ({
      id: 'job-9',
      issueKey: 'YAQ-5',
      summary: 'x',
      status: 'generating' as const,
    }));
    render(
      <AuthContext.Provider value={as(['job:read', 'job:create'])}>
        <CreateTest createJob={createJob} />
      </AuthContext.Provider>,
    );

    await userEvent.type(screen.getByLabelText(/clave de la historia/i), 'YAQ-5');
    await userEvent.click(screen.getByRole('button', { name: /generar test/i }));

    expect(createJob).toHaveBeenCalledWith('YAQ-5');
    expect(push).toHaveBeenCalledWith('/jobs/job-9');
  });

  it('sin permiso de crear no hay formulario y se explica (US-02.1)', () => {
    render(
      <AuthContext.Provider value={as(['job:read'])}>
        <CreateTest />
      </AuthContext.Provider>,
    );
    expect(screen.queryByLabelText(/clave de la historia/i)).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(/tu rol no puede crear tests/i);
  });
});
