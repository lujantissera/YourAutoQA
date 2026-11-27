'use client';

import { useOptionalAuth } from './auth-provider';

// Quién soy y cómo salir, en la cabecera. Sin sesión (pantalla de login) no pinta nada.
export function UserMenu() {
  const auth = useOptionalAuth();
  if (!auth) return null;

  return (
    <div className="user-menu">
      <span className="user-name">{auth.user.displayName}</span>
      <span className="user-role">{auth.user.role}</span>
      <button type="button" className="user-signout" onClick={() => void auth.signOut()}>
        Cerrar sesión
      </button>
    </div>
  );
}
