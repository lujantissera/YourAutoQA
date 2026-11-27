import { readError } from './api';
import type { CurrentUser, Role } from './auth';

// Un usuario tal como lo ve la pantalla de Administración (GET /admin/users).
export type AdminUser = CurrentUser & { createdAt: Date };

type AdminUserBody = Omit<AdminUser, 'createdAt'> & { createdAt: string };

// En JSON las fechas viajan como texto: aquí las convertimos a Date.
const toAdminUser = (body: AdminUserBody): AdminUser => ({
  ...body,
  createdAt: new Date(body.createdAt),
});

export async function listUsers(): Promise<AdminUser[]> {
  const response = await fetch('/api/admin/users', { cache: 'no-store' });
  if (!response.ok) throw await readError(response);
  const body = (await response.json()) as { users: AdminUserBody[] };
  return body.users.map(toAdminUser);
}

export async function changeUserRole(id: string, role: Role): Promise<AdminUser> {
  const response = await fetch(`/api/admin/users/${encodeURIComponent(id)}/role`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role }),
  });
  if (!response.ok) throw await readError(response);
  const body = (await response.json()) as { user: AdminUserBody };
  return toAdminUser(body.user);
}
