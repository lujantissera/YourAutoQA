'use client';

import Link from 'next/link';
import { useOptionalAuth } from './auth-provider';

// Quién soy y cómo salir, en la cabecera. Sin sesión (pantalla de login) no pinta nada.
export function UserMenu() {
  const auth = useOptionalAuth();
  if (!auth) return null;

  return (
    <div className="user-menu">
      {/* Solo un Admin ve el enlace (US-02.1); el backend responde 403 al resto igualmente. */}
      {auth.can('admin:manage') && (
        <Link href="/admin" className="user-admin-link">
          Administración
        </Link>
      )}
      <span className="user-name">{auth.user.displayName}</span>
      <span className="user-role">{auth.user.role}</span>
      <button type="button" className="user-signout" onClick={() => void auth.signOut()}>
        Cerrar sesión
      </button>
    </div>
  );
}
