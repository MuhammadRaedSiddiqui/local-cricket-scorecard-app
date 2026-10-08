import { randomUUID } from 'node:crypto';
import { getPool } from '@/lib/db';
import Match from './Match';

export interface IUser {
  _id: string;
  name: string;
  email: string;
  password?: string;
  avatar?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface UserRow {
  id: string;
  name: string;
  email: string;
  password_hash?: string;
  avatar: string | null;
  created_at: Date;
  updated_at: Date;
}

function fromRow(row: UserRow): IUser {
  return {
    _id: row.id, name: row.name, email: row.email,
    ...(row.password_hash !== undefined ? { password: row.password_hash } : {}),
    ...(row.avatar ? { avatar: row.avatar } : {}),
    createdAt: new Date(row.created_at), updatedAt: new Date(row.updated_at),
  };
}

const User = {
  async findByEmail(email: string, includePassword = false): Promise<IUser | null> {
    // Hashes are selected only by the login path, never by profile/list queries.
    const columns = 'id, name, email, avatar, created_at, updated_at' +
      (includePassword ? ', password_hash' : '');
    const result = await getPool().query<UserRow>(
      `SELECT ${columns} FROM users WHERE email = $1`, [email.trim().toLowerCase()]
    );
    return result.rows[0] ? fromRow(result.rows[0]) : null;
  },

  async create(input: { name: string; email: string; password: string }): Promise<IUser> {
    const result = await getPool().query<UserRow>(
      `INSERT INTO users(id, name, email, password_hash) VALUES ($1, $2, $3, $4)
       RETURNING id, name, email, avatar, created_at, updated_at`,
      [randomUUID(), input.name.trim(), input.email.trim().toLowerCase(), input.password]
    );
    return fromRow(result.rows[0]);
  },

  async findProfile(id: string) {
    const result = await getPool().query<UserRow>(
      'SELECT id, name, email, avatar, created_at, updated_at FROM users WHERE id = $1', [id]
    );
    if (!result.rows[0]) return null;
    const [created, joined] = await Promise.all([
      Match.listForUser(id, 'created'), Match.listForUser(id, 'invited'),
    ]);
    const summary = (match: Awaited<ReturnType<typeof Match.listForUser>>[number]) => ({
      _id: match._id, matchCode: match.matchCode, teamOne: match.teamOne,
      teamTwo: match.teamTwo, status: match.status,
    });
    return { ...fromRow(result.rows[0]), createdMatches: created.map(summary), joinedMatches: joined.map(summary) };
  },
};

export default User;
