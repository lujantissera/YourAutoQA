import type { Role } from './roles.js';
import type { ExternalProfile, User } from './user.js';

// Puerto: dónde se guardan usuarios, cuentas vinculadas y sesiones (como JobRepository para los jobs).
export interface AuthRepository {
  /**
   * Busca al usuario por su cuenta del proveedor; si no existe lo crea con `initialRole`. Si ya
   * existía, refresca nombre, email y avatar pero NUNCA toca su rol.
   */
  upsertUser(profile: ExternalProfile, initialRole: Role): Promise<User>;
  createSession(session: { tokenHash: string; userId: string; expiresAt: Date }): Promise<void>;
  /** El usuario de una sesión vigente en `now`, o null si no existe o caducó. */
  findSessionUser(tokenHash: string, now: Date): Promise<User | null>;
  /** Cerrar una sesión que no existe no es un error. */
  deleteSession(tokenHash: string): Promise<void>;
  /** Los más antiguos primero. */
  listUsers(): Promise<User[]>;
  /** Devuelve el usuario actualizado, o null si no existe. */
  setRole(userId: string, role: Role): Promise<User | null>;
}
