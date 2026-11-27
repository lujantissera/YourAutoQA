'use client';

import { usePathname, useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { setUnauthorizedHandler } from '../lib/api';
import { PendingApproval } from './pending-approval';
import {
  getSession,
  hasPermission,
  logout,
  type Action,
  type CurrentUser,
  type Session,
} from '../lib/auth';

export type AuthValue = {
  user: CurrentUser;
  permissions: readonly Action[];
  can: (action: Action) => boolean;
  signOut: () => Promise<void>;
};

export const AuthContext = createContext<AuthValue | null>(null);

// Para las pantallas que solo existen con sesión: si falta el proveedor es un error de montaje.
export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>');
  return value;
}

// Para componentes que también se pintan sin sesión (la cabecera en /login) o en tests sin proveedor.
export const useOptionalAuth = (): AuthValue | null => useContext(AuthContext);

type State = { kind: 'loading' } | { kind: 'error' } | { kind: 'ready'; session: Session };

type AuthProviderProps = {
  children: React.ReactNode;
  loadSession?: () => Promise<Session | null>;
  logoutRequest?: () => Promise<void>;
};

// Pide quién es la persona usuaria al abrir la aplicación. Sin sesión lleva a /login; mientras
// tanto no enseña nada de lo privado. En /login se salta todo esto.
export function AuthProvider({
  children,
  loadSession = getSession,
  logoutRequest = logout,
}: AuthProviderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const onLogin = pathname === '/login';
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0); // subirlo repite la comprobación ("Reintentar")

  useEffect(() => {
    if (onLogin) return;
    let cancelled = false;
    loadSession().then(
      (session) => {
        if (cancelled) return;
        if (session) setState({ kind: 'ready', session });
        else router.replace('/login');
      },
      () => {
        if (!cancelled) setState({ kind: 'error' });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [onLogin, loadSession, router, attempt]);

  // Si cualquier petición posterior recibe 401, la sesión caducó: al login con aviso (US-01.5).
  useEffect(() => {
    setUnauthorizedHandler(() => router.replace('/login?error=expired'));
    return () => setUnauthorizedHandler(null);
  }, [router]);

  const signOut = useCallback(async () => {
    await logoutRequest();
    router.replace('/login');
  }, [logoutRequest, router]);

  const value = useMemo<AuthValue | null>(
    () =>
      state.kind === 'ready'
        ? {
            user: state.session.user,
            permissions: state.session.permissions,
            can: (action) => hasPermission(state.session.permissions, action),
            signOut,
          }
        : null,
    [state, signOut],
  );

  if (onLogin) return <>{children}</>;
  if (state.kind === 'error') {
    return (
      <main className="page">
        <p role="alert" className="auth-notice">
          No se pudo comprobar la sesión con el servidor.
        </p>
        <button
          type="button"
          onClick={() => {
            setState({ kind: 'loading' });
            setAttempt((n) => n + 1);
          }}
        >
          Reintentar
        </button>
      </main>
    );
  }
  if (!value) {
    return (
      <main className="page">
        <p className="auth-notice" role="status">
          Cargando…
        </p>
      </main>
    );
  }
  // Una cuenta nueva existe pero aún no tiene permisos (D-64): en vez del contenido, una pantalla
  // que lo explica. El backend ya responde 403 a todo, esto solo evita pantallas llenas de errores.
  if (value.user.role === 'Pending') {
    return (
      <PendingApproval
        email={value.user.email}
        onRecheck={() => {
          setState({ kind: 'loading' });
          setAttempt((n) => n + 1);
        }}
        onSignOut={() => void signOut()}
      />
    );
  }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
