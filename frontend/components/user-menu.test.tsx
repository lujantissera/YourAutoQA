import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Session } from '../lib/auth';
import { AuthContext, type AuthValue } from './auth-provider';
import { UserMenu } from './user-menu';

const session: Session = {
  user: { id: 'u1', email: 'a@x.com', displayName: 'Ana', avatarUrl: null, role: 'QA Executer' },
  permissions: ['job:read'],
};

const value = (signOut = vi.fn(async () => undefined)): AuthValue => ({
  user: session.user,
  permissions: session.permissions,
  can: (action) => session.permissions.includes(action),
  signOut,
});

describe('UserMenu', () => {
  it('muestra el nombre y el rol', () => {
    render(
      <AuthContext.Provider value={value()}>
        <UserMenu />
      </AuthContext.Provider>,
    );
    expect(screen.getByText('Ana')).toBeInTheDocument();
    expect(screen.getByText('QA Executer')).toBeInTheDocument();
  });

  it('"Cerrar sesión" llama a signOut', async () => {
    const signOut = vi.fn(async () => undefined);
    render(
      <AuthContext.Provider value={value(signOut)}>
        <UserMenu />
      </AuthContext.Provider>,
    );
    await userEvent.click(screen.getByRole('button', { name: /cerrar sesión/i }));
    expect(signOut).toHaveBeenCalled();
  });

  it('un QA Executer no ve el enlace a Administración (US-02.1)', () => {
    render(
      <AuthContext.Provider value={value()}>
        <UserMenu />
      </AuthContext.Provider>,
    );
    expect(screen.queryByRole('link', { name: /administración/i })).not.toBeInTheDocument();
  });

  it('un Admin ve el enlace a Administración', () => {
    const admin: AuthValue = {
      ...value(),
      permissions: ['job:read', 'admin:manage'],
      can: (action) => ['job:read', 'admin:manage'].includes(action),
    };
    render(
      <AuthContext.Provider value={admin}>
        <UserMenu />
      </AuthContext.Provider>,
    );
    expect(screen.getByRole('link', { name: /administración/i })).toHaveAttribute('href', '/admin');
  });

  it('sin sesión (pantalla de login) no pinta nada', () => {
    const { container } = render(<UserMenu />);
    expect(container).toBeEmptyDOMElement();
  });
});
