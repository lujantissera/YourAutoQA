import type { AtlassianOAuthPort } from './atlassian-oauth.js';
import type { AuthRepository } from './auth-repository.js';
import { AuthError } from './errors.js';
import { resolveInitialRole } from './initial-role.js';
import type { Role } from './roles.js';
import { generateSessionToken, hashSessionToken } from './session-token.js';
import type { User } from './user.js';

export interface AuthServiceDeps {
  repository: AuthRepository;
  atlassian: AtlassianOAuthPort;
  sessionTtlHours: number;
  adminEmails: readonly string[];
  now?: () => Date;
}

// La lógica de identidad, sin HTTP: las rutas son una capa fina encima (como JobService).
export class AuthService {
  private readonly now: () => Date;

  constructor(private readonly deps: AuthServiceDeps) {
    this.now = deps.now ?? (() => new Date());
  }

  get sessionTtlSeconds(): number {
    return Math.round(this.deps.sessionTtlHours * 3600);
  }

  // `state` es un valor aleatorio que viaja a Atlassian y vuelve en el callback. Quien llama lo
  // guarda en una cookie y lo compara al volver: así nadie puede colarnos un login que no empezó
  // este navegador (CSRF de login).
  startLogin(): { state: string; url: string } {
    const state = generateSessionToken();
    return { state, url: this.deps.atlassian.authorizeUrl(state) };
  }

  // Devuelve el token EN CLARO (para la cookie); en la base solo se guarda su hash.
  async completeLogin(code: string): Promise<{ token: string; user: User }> {
    const profile = await this.deps.atlassian.fetchProfile(code);
    const user = await this.deps.repository.upsertUser(
      profile,
      resolveInitialRole(profile, { adminEmails: this.deps.adminEmails }),
    );

    const token = generateSessionToken();
    await this.deps.repository.createSession({
      tokenHash: hashSessionToken(token),
      userId: user.id,
      expiresAt: new Date(this.now().getTime() + this.sessionTtlSeconds * 1000),
    });
    return { token, user };
  }

  async authenticate(token: string | undefined): Promise<User | null> {
    if (!token) return null;
    return this.deps.repository.findSessionUser(hashSessionToken(token), this.now());
  }

  async logout(token: string | undefined): Promise<void> {
    if (!token) return;
    await this.deps.repository.deleteSession(hashSessionToken(token));
  }

  listUsers(): Promise<User[]> {
    return this.deps.repository.listUsers();
  }

  async changeRole(actorId: string, userId: string, role: Role): Promise<User> {
    // Un Admin que se quita el rol a sí mismo podría dejar la app sin ningún Admin.
    if (actorId === userId) {
      throw new AuthError('cannot_change_own_role', 'You cannot change your own role.');
    }
    const user = await this.deps.repository.setRole(userId, role);
    if (!user) throw new AuthError('user_not_found', 'User not found.');
    return user;
  }
}
