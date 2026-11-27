import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Session } from '../lib/auth';
import { setUnauthorizedHandler } from '../lib/api';
import { AuthProvider, useAuth } from './auth-provider';

const replace = vi.fn();
const router = { replace };
let pathname = '/';
vi.mock('next/navigation', () => ({
  // El mismo objeto en cada render, como el router real de Next: si cambiara, los efectos que lo
  // usan como dependencia se repetirían sin parar.
  useRouter: () => router,
  usePathname: () => pathname,
}));

const session: Session = {
  user: { id: 'u1', email: 'a@x.com', displayName: 'Ana', avatarUrl: null, role: 'QA Controller' },
  permissions: ['job:read', 'job:create', 'job:clarify'],
};

function Probe() {
  const auth = useAuth();
  return (
    <div>
      <p>hola {auth.user.displayName}</p>
      <p>{auth.can('job:create') ? 'puede crear' : 'no puede crear'}</p>
      <p>{auth.can('admin:manage') ? 'es admin' : 'no es admin'}</p>
      <button onClick={() => void auth.signOut()}>salir</button>
    </div>
  );
}

beforeEach(() => {
  replace.mockClear();
  pathname = '/';
  setUnauthorizedHandler(null);
});

describe('AuthProvider', () => {
  it('con sesión muestra el contenido y expone el usuario y lo que puede hacer', async () => {
    render(
      <AuthProvider loadSession={async () => session}>
        <Probe />
      </AuthProvider>,
    );

    expect(await screen.findByText('hola Ana')).toBeInTheDocument();
    expect(screen.getByText('puede crear')).toBeInTheDocument();
    expect(screen.getByText('no es admin')).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it('una cuenta Pending ve la pantalla de espera en vez del contenido (D-64)', async () => {
    const pending: Session = {
      user: { ...session.user, role: 'Pending' },
      permissions: [],
    };
    render(
      <AuthProvider loadSession={async () => pending}>
        <p>contenido privado</p>
      </AuthProvider>,
    );

    expect(
      await screen.findByRole('heading', { name: /pendiente de aprobación/i }),
    ).toBeInTheDocument();
    expect(screen.queryByText('contenido privado')).not.toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it('"Comprobar de nuevo" deja pasar en cuanto un Admin ha asignado un rol', async () => {
    const pending: Session = { user: { ...session.user, role: 'Pending' }, permissions: [] };
    const loadSession = vi
      .fn<() => Promise<Session | null>>()
      .mockResolvedValueOnce(pending)
      .mockResolvedValueOnce(session);
    render(
      <AuthProvider loadSession={loadSession}>
        <p>contenido privado</p>
      </AuthProvider>,
    );

    await userEvent.click(await screen.findByRole('button', { name: /comprobar de nuevo/i }));

    expect(await screen.findByText('contenido privado')).toBeInTheDocument();
  });

  it('sin sesión lleva al login y no enseña el contenido (US-01.1)', async () => {
    render(
      <AuthProvider loadSession={async () => null}>
        <p>contenido privado</p>
      </AuthProvider>,
    );

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/login'));
    expect(screen.queryByText('contenido privado')).not.toBeInTheDocument();
  });

  it('en /login no pregunta por la sesión y deja ver la pantalla', () => {
    pathname = '/login';
    const loadSession = vi.fn(async () => null);
    render(
      <AuthProvider loadSession={loadSession}>
        <p>pantalla de login</p>
      </AuthProvider>,
    );

    expect(screen.getByText('pantalla de login')).toBeInTheDocument();
    expect(loadSession).not.toHaveBeenCalled();
  });

  it('si la API responde 401 más tarde (sesión caducada) lleva al login con aviso (US-01.5)', async () => {
    render(
      <AuthProvider loadSession={async () => session}>
        <Probe />
      </AuthProvider>,
    );
    await screen.findByText('hola Ana');

    // api.ts llama a este manejador cuando cualquier petición recibe 401.
    const { notifyUnauthorized } = await import('../lib/api');
    notifyUnauthorized();

    expect(replace).toHaveBeenCalledWith('/login?error=expired');
  });

  it('signOut cierra la sesión y lleva al login', async () => {
    const logoutRequest = vi.fn(async () => undefined);
    render(
      <AuthProvider loadSession={async () => session} logoutRequest={logoutRequest}>
        <Probe />
      </AuthProvider>,
    );

    await userEvent.click(await screen.findByRole('button', { name: 'salir' }));

    expect(logoutRequest).toHaveBeenCalled();
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/login'));
  });

  it('si el servidor falla al comprobar la sesión muestra un aviso con reintento', async () => {
    render(
      <AuthProvider
        loadSession={async () => {
          throw new Error('down');
        }}
      >
        <p>contenido privado</p>
      </AuthProvider>,
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(/servidor/i);
    expect(screen.getByRole('button', { name: /reintentar/i })).toBeInTheDocument();
    expect(screen.queryByText('contenido privado')).not.toBeInTheDocument();
  });
});
