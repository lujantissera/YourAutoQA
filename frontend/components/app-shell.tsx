'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { roleLabel } from '../lib/auth';
import { isActive, navItemsFor, type NavItem } from '../lib/navigation';
import { useOptionalAuth } from './auth-provider';

// Iconos en SVG (nunca emojis): trazo con `currentColor`, así heredan el color del enlace.
const ICONS: Record<NavItem['icon'], React.ReactNode> = {
  home: <path d="M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z" />,
  create: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <path d="M12 8v8M8 12h8" />
    </>
  ),
  jobs: <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />,
  admin: <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />,
};

function NavIcon({ name }: { name: NavItem['icon'] }) {
  return (
    <svg
      className="nav-icon"
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICONS[name]}
    </svg>
  );
}

// La estructura de toda la aplicación: barra lateral con los apartados que tu rol permite y,
// abajo, quién eres. Sin sesión (la pantalla de login) no hay barra: solo se pinta el contenido.
export function AppShell({ children }: { children: React.ReactNode }) {
  const auth = useOptionalAuth();
  const pathname = usePathname();
  if (!auth) return <>{children}</>;

  const initial = auth.user.displayName.trim().charAt(0).toUpperCase() || '?';

  return (
    <div className="shell">
      <aside className="sidebar">
        <Link href="/" className="brand">
          <span className="brand-mark" aria-hidden="true">
            QA
          </span>
          YourAutoQA
        </Link>

        <nav aria-label="Navegación principal">
          <ul className="nav-list">
            {navItemsFor(auth.permissions).map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="nav-link"
                    aria-current={active ? 'page' : undefined}
                  >
                    <NavIcon name={item.icon} />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="sidebar-user">
          <span className="user-avatar" aria-hidden="true">
            {initial}
          </span>
          <div className="user-info">
            <span className="user-name">{auth.user.displayName}</span>
            <span className="user-role">{roleLabel(auth.user.role)}</span>
          </div>
          <button type="button" className="user-signout" onClick={() => void auth.signOut()}>
            Cerrar sesión
          </button>
        </div>
      </aside>

      <div className="shell-main">{children}</div>
    </div>
  );
}
