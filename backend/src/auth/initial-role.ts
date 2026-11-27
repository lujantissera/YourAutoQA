import { DEFAULT_ROLE, type Role } from './roles.js';
import type { ExternalProfile } from './user.js';

export interface InitialRoleConfig {
  /** Correos en minúsculas (ADMIN_EMAILS). */
  adminEmails: readonly string[];
}

// Qué rol recibe alguien que entra por PRIMERA vez. Solo se usa al crear el usuario: después
// el rol lo cambia un Admin y no se vuelve a calcular.
//
// El problema: D-25 dice que por defecto es QA Executer, pero entonces nadie sería Admin y
// nadie podría subir el rol de los demás. La regla (D-60): los correos de ADMIN_EMAILS entran
// como Admin; todos los demás, con el rol por defecto.
export function resolveInitialRole(profile: ExternalProfile, config: InitialRoleConfig): Role {
  const email = profile.email.trim().toLowerCase();
  // Un email vacío (el usuario lo oculta en Atlassian) nunca coincide, aunque la lista lleve un vacío.
  if (email !== '' && config.adminEmails.includes(email)) return 'Admin';
  return DEFAULT_ROLE;
}
