import { hasPermission, type Action } from './auth';

export type NavItem = {
  href: string;
  label: string;
  icon: 'home' | 'create' | 'jobs' | 'admin';
  /** Permiso necesario para ver el apartado. Sin permiso, ni aparece en el menú. */
  requires: Action;
};

// Los cuatro apartados de RF-7. El orden es el del menú.
export const NAV_ITEMS: readonly NavItem[] = [
  { href: '/', label: 'Inicio', icon: 'home', requires: 'job:read' },
  { href: '/crear', label: 'Crear test', icon: 'create', requires: 'job:create' },
  { href: '/jobs', label: 'Control de tests', icon: 'jobs', requires: 'job:read' },
  { href: '/admin', label: 'Administración', icon: 'admin', requires: 'admin:manage' },
];

// Solo los apartados que el rol permite. Es comodidad: cada API vuelve a comprobarlo (D-57).
export const navItemsFor = (permissions: readonly Action[]): NavItem[] =>
  NAV_ITEMS.filter((item) => hasPermission(permissions, item.requires));

// ¿Está activo este apartado? La portada solo con "/"; el resto también en sus subrutas
// (/jobs/abc mantiene marcado "Control de tests"), pero sin confundir /jobs con /jobsx.
export const isActive = (pathname: string, href: string): boolean =>
  href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
