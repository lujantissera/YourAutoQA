// Los tres roles de RF-2. En la base de datos se guardan tal cual (texto con un CHECK).
// Nota: "Tester" en el vocabulario del negocio equivale a QA Controller (decisión previa).
// `Pending` no está en la matriz de RF-2: es una cuenta que ya existe pero aún no tiene acceso.
export const ROLES = ['Admin', 'QA Controller', 'QA Executer', 'Pending'] as const;
export type Role = (typeof ROLES)[number];

// Mínimo privilegio (D-64, sustituye a D-25): quien entra por primera vez NO puede hacer nada hasta
// que un Admin le asigna un rol. Como ningún permiso nombra a Pending, `can()` le dice que no a todo.
export const DEFAULT_ROLE: Role = 'Pending';

export const isRole = (value: unknown): value is Role =>
  typeof value === 'string' && (ROLES as readonly string[]).includes(value);

// Las acciones que la API protege. Se nombran por lo que hacen, no por la ruta: si mañana cambia
// una URL, la matriz de permisos no se toca.
export const ACTIONS = ['job:read', 'job:create', 'job:clarify', 'admin:manage'] as const;
export type Action = (typeof ACTIONS)[number];

// La matriz de US-02: qué roles pueden hacer cada acción. Una sola tabla, un solo sitio donde
// mirar (y donde cambiar) los permisos.
const ALLOWED_ROLES: Record<Action, readonly Role[]> = {
  'job:read': ['Admin', 'QA Controller', 'QA Executer'],
  'job:create': ['Admin', 'QA Controller'],
  'job:clarify': ['Admin', 'QA Controller'],
  'admin:manage': ['Admin'],
};

export const can = (role: Role, action: Action): boolean => ALLOWED_ROLES[action].includes(role);
