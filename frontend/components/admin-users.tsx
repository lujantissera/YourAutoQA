'use client';

import { useEffect, useState } from 'react';
import {
  changeUserRole as changeUserRoleRequest,
  listUsers as listUsersRequest,
  type AdminUser,
} from '../lib/admin';
import { ApiError } from '../lib/api';
import { ROLES, roleLabel, type Role } from '../lib/auth';
import { useAuth } from './auth-provider';

type AdminUsersProps = {
  loadUsers?: () => Promise<AdminUser[]>;
  changeRole?: (id: string, role: Role) => Promise<AdminUser>;
};

type State = { kind: 'loading' } | { kind: 'error' } | { kind: 'ready'; users: AdminUser[] };

// Por qué falló el cambio de rol, en lenguaje de persona usuaria.
const CHANGE_ERRORS: Record<string, string> = {
  forbidden: 'No tienes permiso para cambiar roles.',
  cannot_change_own_role: 'No puedes cambiar tu propio rol.',
  user_not_found: 'Ese usuario ya no existe.',
};

// Quien espera aprobación va arriba: es lo primero que un Admin necesita ver. `sort` es estable,
// así que el resto conserva su orden.
const pendingFirst = (a: AdminUser, b: AdminUser): number =>
  Number(b.role === 'Pending') - Number(a.role === 'Pending');

function changeErrorMessage(error: unknown): string {
  if (error instanceof ApiError && Object.hasOwn(CHANGE_ERRORS, error.code)) {
    return CHANGE_ERRORS[error.code]!;
  }
  return 'No se pudo cambiar el rol. Inténtalo de nuevo.';
}

// Pantalla de Administración (US-12, versión simple): ver quién ha entrado y subir o bajar su rol.
// Que solo la vea un Admin es comodidad; el 403 del backend es lo que de verdad protege (D-57).
export function AdminUsers({
  loadUsers = listUsersRequest,
  changeRole = changeUserRoleRequest,
}: AdminUsersProps) {
  const auth = useAuth();
  const allowed = auth.can('admin:manage');
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0); // subirlo repite la carga ("Reintentar")
  const [busyId, setBusyId] = useState<string | null>(null);
  const [changeError, setChangeError] = useState<string | null>(null);

  useEffect(() => {
    if (!allowed) return;
    let cancelled = false;
    loadUsers().then(
      (users) => {
        if (!cancelled) setState({ kind: 'ready', users });
      },
      () => {
        if (!cancelled) setState({ kind: 'error' });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [allowed, loadUsers, attempt]);

  if (!allowed) {
    return (
      <p role="alert" className="auth-notice" data-tone="fail">
        No tienes acceso a la administración. Pídele a un Admin que te cambie el rol.
      </p>
    );
  }

  if (state.kind === 'loading') return <p role="status">Cargando usuarios…</p>;

  if (state.kind === 'error') {
    return (
      <div role="alert" className="auth-notice" data-tone="fail">
        <p>No se pudo conectar con el servidor.</p>
        <button
          type="button"
          onClick={() => {
            setState({ kind: 'loading' });
            setAttempt((value) => value + 1);
          }}
        >
          Reintentar
        </button>
      </div>
    );
  }

  const onChange = async (user: AdminUser, role: Role) => {
    setChangeError(null);
    setBusyId(user.id);
    try {
      const updated = await changeRole(user.id, role);
      setState((current) =>
        current.kind === 'ready'
          ? { kind: 'ready', users: current.users.map((u) => (u.id === updated.id ? updated : u)) }
          : current,
      );
    } catch (error) {
      // El selector es controlado: al no cambiar el estado, vuelve solo al rol que había.
      setChangeError(changeErrorMessage(error));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      {changeError && (
        <p role="alert" className="auth-notice" data-tone="fail">
          {changeError}
        </p>
      )}
      <table className="admin-table">
        <thead>
          <tr>
            <th scope="col">Usuario</th>
            <th scope="col">Email</th>
            <th scope="col">Rol</th>
          </tr>
        </thead>
        <tbody>
          {[...state.users].sort(pendingFirst).map((user) => {
            const isMe = user.id === auth.user.id;
            return (
              <tr key={user.id}>
                <td>
                  {user.displayName}
                  {isMe && <span className="admin-me"> (tú)</span>}
                </td>
                <td>{user.email || '—'}</td>
                <td>
                  <select
                    aria-label={`Rol de ${user.displayName}`}
                    value={user.role}
                    // Nadie se cambia su propio rol: dejaría la app sin Admins (D-59).
                    disabled={isMe || busyId === user.id}
                    onChange={(event) => void onChange(user, event.target.value as Role)}
                  >
                    {ROLES.map((role) => (
                      <option key={role} value={role}>
                        {roleLabel(role)}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </>
  );
}
