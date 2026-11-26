import { randomUUID } from 'node:crypto';
import type { AuthRepository } from './auth-repository.js';
import type { Role } from './roles.js';
import type { ExternalProfile, User } from './user.js';

export interface InMemoryAuthOptions {
  newId?: () => string;
  now?: () => Date;
}

// Versión en memoria: para los tests de las rutas, sin base de datos. Cumple el mismo contrato.
export class InMemoryAuthRepository implements AuthRepository {
  private readonly users = new Map<string, User>();
  private readonly accounts = new Map<string, string>(); // "provider:cuenta" -> id de usuario
  private readonly sessions = new Map<string, { userId: string; expiresAt: Date }>();
  private readonly newId: () => string;
  private readonly now: () => Date;

  constructor(options: InMemoryAuthOptions = {}) {
    this.newId = options.newId ?? randomUUID;
    this.now = options.now ?? (() => new Date());
  }

  async upsertUser(profile: ExternalProfile, initialRole: Role): Promise<User> {
    const accountKey = `${profile.provider}:${profile.providerAccountId}`;
    const existingId = this.accounts.get(accountKey);
    const existing = existingId ? this.users.get(existingId) : undefined;

    if (existing) {
      const updated: User = {
        ...existing,
        email: profile.email,
        displayName: profile.displayName,
        avatarUrl: profile.avatarUrl,
      };
      this.users.set(updated.id, updated);
      return { ...updated };
    }

    const user: User = {
      id: this.newId(),
      email: profile.email,
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl,
      role: initialRole,
      createdAt: this.now(),
    };
    this.users.set(user.id, user);
    this.accounts.set(accountKey, user.id);
    return { ...user };
  }

  async createSession(session: {
    tokenHash: string;
    userId: string;
    expiresAt: Date;
  }): Promise<void> {
    this.sessions.set(session.tokenHash, { userId: session.userId, expiresAt: session.expiresAt });
  }

  async findSessionUser(tokenHash: string, now: Date): Promise<User | null> {
    const session = this.sessions.get(tokenHash);
    if (!session || session.expiresAt <= now) return null;
    const user = this.users.get(session.userId);
    return user ? { ...user } : null;
  }

  async deleteSession(tokenHash: string): Promise<void> {
    this.sessions.delete(tokenHash);
  }

  async listUsers(): Promise<User[]> {
    return [...this.users.values()].map((user) => ({ ...user }));
  }

  async setRole(userId: string, role: Role): Promise<User | null> {
    const user = this.users.get(userId);
    if (!user) return null;
    const updated = { ...user, role };
    this.users.set(userId, updated);
    return { ...updated };
  }
}
