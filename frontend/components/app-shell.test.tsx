import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Action, Role } from '../lib/auth';
import { AppShell } from './app-shell';
import { AuthContext, type AuthValue } from './auth-provider';

let pathname = '/';
vi.mock('next/navigation', () => ({ usePathname: () => pathname }));

beforeEach(() => {
  pathname = '/';
});

const ALL: Action[] = ['job:read', 'job:create', 'job:clarify', 'admin:manage'];

const as = (
  role: Role,
  permissions: Action[],
  signOut = vi.fn(async () => undefined),
): AuthValue => ({
  user: { id: 'u', email: 'a@x.com', displayName: 'María Luján', avatarUrl: null, role },
  permissions,
  can: (action) => permissions.includes(action),
  signOut,
});

const renderShell = (auth: AuthValue | null, children = <p>contenido</p>) =>
  render(
    <AuthContext.Provider value={auth}>
      <AppShell>{children}</AppShell>
    </AuthContext.Provider>,
  );

describe('AppShell', () => {
  it('un Admin ve los cuatro apartados y el nombre de la aplicación', () => {
    renderShell(as('Admin', ALL));
    const nav = screen.getByRole('navigation', { name: /principal/i });

    expect(
      within(nav)
        .getAllByRole('link')
        .map((l) => l.textContent),
    ).toEqual(['Inicio', 'Crear test', 'Control de tests', 'Administración']);
    expect(screen.getByText('YourAutoQA')).toBeInTheDocument();
    expect(screen.getByText('contenido')).toBeInTheDocument();
  });

  it('un QA Executer solo ve Inicio y Control de tests (US-02.1)', () => {
    renderShell(as('QA Executer', ['job:read']));
    const nav = screen.getByRole('navigation', { name: /principal/i });

    expect(
      within(nav)
        .getAllByRole('link')
        .map((l) => l.textContent),
    ).toEqual(['Inicio', 'Control de tests']);
  });

  it('marca el apartado actual, también en las subrutas', () => {
    pathname = '/jobs/abc';
    renderShell(as('Admin', ALL));

    expect(screen.getByRole('link', { name: 'Control de tests' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('link', { name: 'Inicio' })).not.toHaveAttribute('aria-current');
  });

  it('muestra quién eres y tu rol, y permite cerrar sesión', async () => {
    const signOut = vi.fn(async () => undefined);
    renderShell(as('QA Controller', ALL, signOut));

    expect(screen.getByText('María Luján')).toBeInTheDocument();
    expect(screen.getByText('QA Controller')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /cerrar sesión/i }));
    expect(signOut).toHaveBeenCalled();
  });

  it('sin sesión (pantalla de login) no pinta la barra lateral, solo el contenido', () => {
    renderShell(null);
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    expect(screen.getByText('contenido')).toBeInTheDocument();
  });
});
