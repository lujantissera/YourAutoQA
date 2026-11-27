import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { AdminUser } from '../lib/admin';
import { ApiError } from '../lib/api';
import type { Action } from '../lib/auth';
import { AdminUsers } from './admin-users';
import { AuthContext, type AuthValue } from './auth-provider';

const users: AdminUser[] = [
  {
    id: 'me',
    email: 'yo@x.com',
    displayName: 'Yo Admin',
    avatarUrl: null,
    role: 'Admin',
    createdAt: new Date('2026-11-20T10:00:00Z'),
  },
  {
    id: 'bob',
    email: 'bob@x.com',
    displayName: 'Bob',
    avatarUrl: null,
    role: 'QA Executer',
    createdAt: new Date('2026-11-21T10:00:00Z'),
  },
];

const asAdmin = (permissions: Action[] = ['job:read', 'admin:manage']): AuthValue => ({
  user: { id: 'me', email: 'yo@x.com', displayName: 'Yo Admin', avatarUrl: null, role: 'Admin' },
  permissions,
  can: (action) => permissions.includes(action),
  signOut: async () => undefined,
});

const renderAs = (auth: AuthValue, props: Parameters<typeof AdminUsers>[0]) =>
  render(
    <AuthContext.Provider value={auth}>
      <AdminUsers {...props} />
    </AuthContext.Provider>,
  );

describe('AdminUsers', () => {
  it('lista los usuarios con su email y su rol', async () => {
    renderAs(asAdmin(), { loadUsers: async () => users });

    expect(await screen.findByText('Bob')).toBeInTheDocument();
    expect(screen.getByText('bob@x.com')).toBeInTheDocument();
    expect(screen.getByLabelText('Rol de Bob')).toHaveValue('QA Executer');
    expect(screen.getByLabelText('Rol de Yo Admin')).toHaveValue('Admin');
  });

  it('pone primero a quien espera aprobación y ofrece el rol "Sin acceso (pendiente)"', async () => {
    const waiting: AdminUser = {
      id: 'zoe',
      email: 'zoe@x.com',
      displayName: 'Zoe',
      avatarUrl: null,
      role: 'Pending',
      createdAt: new Date('2026-11-27T10:00:00Z'),
    };
    renderAs(asAdmin(), { loadUsers: async () => [...users, waiting] });

    const selects = await screen.findAllByRole('combobox');
    // El primero es el de Zoe aunque sea la última de la lista y la más reciente en llegar.
    expect(selects[0]).toHaveAccessibleName('Rol de Zoe');
    expect(screen.getByLabelText('Rol de Zoe')).toHaveValue('Pending');
    expect(
      within(screen.getByLabelText('Rol de Zoe')).getByRole('option', {
        name: 'Sin acceso (pendiente)',
      }),
    ).toBeInTheDocument();
  });

  it('cambiar el rol de otra persona llama a la API y refleja el rol nuevo', async () => {
    const changeRole = vi.fn(async (id: string, role: AdminUser['role']) => ({
      ...users.find((u) => u.id === id)!,
      role,
    }));
    renderAs(asAdmin(), { loadUsers: async () => users, changeRole });

    await userEvent.selectOptions(await screen.findByLabelText('Rol de Bob'), 'QA Controller');

    expect(changeRole).toHaveBeenCalledWith('bob', 'QA Controller');
    await waitFor(() => expect(screen.getByLabelText('Rol de Bob')).toHaveValue('QA Controller'));
  });

  it('no deja cambiar el propio rol (evita quedarse sin Admins)', async () => {
    renderAs(asAdmin(), { loadUsers: async () => users });
    expect(await screen.findByLabelText('Rol de Yo Admin')).toBeDisabled();
    expect(screen.getByLabelText('Rol de Bob')).toBeEnabled();
  });

  it('si el cambio falla muestra el motivo y deja el rol que había', async () => {
    const changeRole = vi.fn(async () => {
      throw new ApiError('forbidden', 'Your role does not allow this action.');
    });
    renderAs(asAdmin(), { loadUsers: async () => users, changeRole });

    await userEvent.selectOptions(await screen.findByLabelText('Rol de Bob'), 'Admin');

    expect(await screen.findByRole('alert')).toHaveTextContent(/no tienes permiso/i);
    expect(screen.getByLabelText('Rol de Bob')).toHaveValue('QA Executer');
  });

  it('sin permiso de administración no pide la lista y lo explica', () => {
    const loadUsers = vi.fn(async () => users);
    renderAs(asAdmin(['job:read']), { loadUsers });

    expect(screen.getByRole('alert')).toHaveTextContent(/no tienes acceso/i);
    expect(loadUsers).not.toHaveBeenCalled();
  });

  it('si no se puede cargar la lista ofrece reintentar', async () => {
    const loadUsers = vi
      .fn<() => Promise<AdminUser[]>>()
      .mockRejectedValueOnce(new Error('down'))
      .mockResolvedValueOnce(users);
    renderAs(asAdmin(), { loadUsers });

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/servidor/i);
    await userEvent.click(within(alert).getByRole('button', { name: /reintentar/i }));

    expect(await screen.findByText('Bob')).toBeInTheDocument();
  });
});
