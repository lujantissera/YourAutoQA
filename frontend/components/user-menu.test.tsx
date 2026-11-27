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

  it('sin sesión (pantalla de login) no pinta nada', () => {
    const { container } = render(<UserMenu />);
    expect(container).toBeEmptyDOMElement();
  });
});
