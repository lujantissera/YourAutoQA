import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from './api';
import { changeUserRole, listUsers } from './admin';

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

afterEach(() => vi.unstubAllGlobals());

const user = {
  id: 'u1',
  email: 'ana@x.com',
  displayName: 'Ana',
  avatarUrl: null,
  role: 'QA Executer',
  createdAt: '2026-11-25T10:00:00.000Z',
};

describe('listUsers', () => {
  it('devuelve los usuarios con la fecha ya convertida a Date', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ users: [user] }));
    vi.stubGlobal('fetch', fetchMock);

    const users = await listUsers();

    expect(users).toHaveLength(1);
    expect(users[0]?.displayName).toBe('Ana');
    expect(users[0]?.createdAt).toEqual(new Date('2026-11-25T10:00:00.000Z'));
    expect(fetchMock).toHaveBeenCalledWith('/api/admin/users', { cache: 'no-store' });
  });

  it('un 403 es un ApiError con el código del backend', async () => {
    vi.stubGlobal('fetch', async () =>
      jsonResponse(
        { error: { code: 'forbidden', message: 'Your role does not allow this action.' } },
        403,
      ),
    );
    await expect(listUsers()).rejects.toMatchObject({ code: 'forbidden' });
    await expect(listUsers()).rejects.toBeInstanceOf(ApiError);
  });
});

describe('changeUserRole', () => {
  it('hace PATCH con el rol nuevo y devuelve el usuario actualizado', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ user: { ...user, role: 'QA Controller' } }));
    vi.stubGlobal('fetch', fetchMock);

    const updated = await changeUserRole('u1', 'QA Controller');

    expect(updated.role).toBe('QA Controller');
    expect(fetchMock).toHaveBeenCalledWith('/api/admin/users/u1/role', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'QA Controller' }),
    });
  });

  it('codifica el id en la URL', async () => {
    const fetchMock = vi.fn<(url: string) => Promise<Response>>(async () => jsonResponse({ user }));
    vi.stubGlobal('fetch', fetchMock);
    await changeUserRole('a/b', 'Admin');
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/admin/users/a%2Fb/role');
  });

  it('un 409 (cambiarse el propio rol) es un ApiError', async () => {
    vi.stubGlobal('fetch', async () =>
      jsonResponse({ error: { code: 'cannot_change_own_role', message: 'x' } }, 409),
    );
    await expect(changeUserRole('u1', 'Admin')).rejects.toMatchObject({
      code: 'cannot_change_own_role',
    });
  });
});
