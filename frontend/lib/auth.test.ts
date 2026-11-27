import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, setUnauthorizedHandler } from './api';
import {
  getSession,
  hasPermission,
  loginErrorMessage,
  logout,
  needsLogin,
  roleLabel,
} from './auth';

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

afterEach(() => {
  vi.unstubAllGlobals();
  setUnauthorizedHandler(null);
});

describe('getSession', () => {
  it('devuelve el usuario y sus permisos', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        user: { id: 'u1', email: 'a@x.com', displayName: 'Ana', avatarUrl: null, role: 'Admin' },
        permissions: ['job:read', 'admin:manage'],
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const session = await getSession();

    expect(session?.user.displayName).toBe('Ana');
    expect(session?.permissions).toEqual(['job:read', 'admin:manage']);
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/me', { cache: 'no-store' });
  });

  it('sin sesión (401) devuelve null y NO dispara el aviso de sesión caducada', async () => {
    const onUnauthorized = vi.fn();
    setUnauthorizedHandler(onUnauthorized);
    vi.stubGlobal('fetch', async () =>
      jsonResponse({ error: { code: 'unauthorized', message: 'You must sign in.' } }, 401),
    );

    expect(await getSession()).toBeNull();
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it('un fallo del servidor es un ApiError', async () => {
    vi.stubGlobal('fetch', async () =>
      jsonResponse({ error: { code: 'internal_error', message: 'Internal server error.' } }, 500),
    );
    await expect(getSession()).rejects.toBeInstanceOf(ApiError);
  });
});

describe('logout', () => {
  it('hace POST a /api/auth/logout', async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);
    await logout();
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/logout', { method: 'POST' });
  });
});

describe('roleLabel', () => {
  it('Pending se muestra como "Sin acceso (pendiente)" y el resto con su nombre', () => {
    expect(roleLabel('Pending')).toBe('Sin acceso (pendiente)');
    expect(roleLabel('Admin')).toBe('Admin');
    expect(roleLabel('QA Executer')).toBe('QA Executer');
  });
});

describe('hasPermission', () => {
  it('comprueba si la acción está entre los permisos', () => {
    expect(hasPermission(['job:read'], 'job:read')).toBe(true);
    expect(hasPermission(['job:read'], 'job:create')).toBe(false);
  });
});

describe('loginErrorMessage', () => {
  it('traduce cada código a un mensaje claro (US-01.4)', () => {
    expect(loginErrorMessage('cancelled')).toMatch(/cancelaste/i);
    expect(loginErrorMessage('expired')).toMatch(/caducado/i);
    expect(loginErrorMessage('state')).toBeTruthy();
    expect(loginErrorMessage('failed')).toBeTruthy();
  });

  it('sin código o con uno desconocido no muestra nada', () => {
    expect(loginErrorMessage(undefined)).toBeNull();
    expect(loginErrorMessage('<script>')).toBeNull();
  });
});

describe('needsLogin (la puerta de proxy.ts, US-01.1)', () => {
  it('sin cookie de sesión, cualquier pantalla menos /login lleva al login', () => {
    expect(needsLogin('/', false)).toBe(true);
    expect(needsLogin('/jobs/abc', false)).toBe(true);
    expect(needsLogin('/login', false)).toBe(false);
  });

  it('con cookie de sesión se deja pasar (el backend comprueba que sea válida)', () => {
    expect(needsLogin('/', true)).toBe(false);
    expect(needsLogin('/jobs/abc', true)).toBe(false);
  });
});
