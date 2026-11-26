import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import type { AuthRepository } from './auth-repository.js';
import type { Role } from './roles.js';
import type { ExternalProfile, User } from './user.js';

interface UserRow {
  id: string;
  email: string;
  display_name: string;
  avatar_url: string | null;
  role: Role;
  created_at: Date;
}

export interface PostgresAuthOptions {
  newId?: () => string;
}

const UUID_FORMAT = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const toUser = (row: UserRow): User => ({
  id: row.id,
  email: row.email,
  displayName: row.display_name,
  avatarUrl: row.avatar_url,
  role: row.role,
  createdAt: row.created_at,
});

export class PostgresAuthRepository implements AuthRepository {
  private readonly newId: () => string;

  constructor(
    private readonly pool: Pool,
    options: PostgresAuthOptions = {},
  ) {
    this.newId = options.newId ?? randomUUID;
  }

  async upsertUser(profile: ExternalProfile, initialRole: Role): Promise<User> {
    // Transacción: el usuario y su cuenta vinculada se crean juntos o no se crea nada.
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const found = await client.query<{ user_id: string }>(
        'SELECT user_id FROM linked_accounts WHERE provider = $1 AND provider_account_id = $2',
        [profile.provider, profile.providerAccountId],
      );

      let row: UserRow | undefined;
      if (found.rows[0]) {
        // Ya existe: se refrescan los datos de perfil, pero el rol no se toca.
        const updated = await client.query<UserRow>(
          `UPDATE users SET email = $2, display_name = $3, avatar_url = $4
            WHERE id = $1 RETURNING *`,
          [found.rows[0].user_id, profile.email, profile.displayName, profile.avatarUrl],
        );
        row = updated.rows[0];
      } else {
        const inserted = await client.query<UserRow>(
          `INSERT INTO users (id, email, display_name, avatar_url, role)
           VALUES ($1, $2, $3, $4, $5) RETURNING *`,
          [this.newId(), profile.email, profile.displayName, profile.avatarUrl, initialRole],
        );
        row = inserted.rows[0];
        await client.query(
          `INSERT INTO linked_accounts (provider, provider_account_id, user_id)
           VALUES ($1, $2, $3)`,
          [profile.provider, profile.providerAccountId, row?.id],
        );
      }

      await client.query('COMMIT');
      if (!row) throw new Error('upsertUser: no row returned');
      return toUser(row);
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  async createSession(session: {
    tokenHash: string;
    userId: string;
    expiresAt: Date;
  }): Promise<void> {
    await this.pool.query(
      'INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)',
      [session.tokenHash, session.userId, session.expiresAt],
    );
  }

  async findSessionUser(tokenHash: string, now: Date): Promise<User | null> {
    const { rows } = await this.pool.query<UserRow>(
      `SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
        WHERE s.token_hash = $1 AND s.expires_at > $2`,
      [tokenHash, now],
    );
    return rows[0] ? toUser(rows[0]) : null;
  }

  async deleteSession(tokenHash: string): Promise<void> {
    await this.pool.query('DELETE FROM sessions WHERE token_hash = $1', [tokenHash]);
  }

  async listUsers(): Promise<User[]> {
    const { rows } = await this.pool.query<UserRow>('SELECT * FROM users ORDER BY created_at, id');
    return rows.map(toUser);
  }

  async setRole(userId: string, role: Role): Promise<User | null> {
    // Un texto que no es UUID no puede ser un id: Postgres lanzaría un error en vez de "no existe".
    if (!UUID_FORMAT.test(userId)) return null;
    const { rows } = await this.pool.query<UserRow>(
      'UPDATE users SET role = $2 WHERE id = $1 RETURNING *',
      [userId, role],
    );
    return rows[0] ? toUser(rows[0]) : null;
  }
}
