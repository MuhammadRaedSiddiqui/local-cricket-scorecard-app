import { Pool, PoolClient } from 'pg';
import { createPostgresConfig } from './postgres-config.cjs';

declare global {
  var cricketPostgresPool: Pool | undefined;
}

// Open connections only when a request actually needs the database.
export function getPool(): Pool {
  if (!global.cricketPostgresPool) {
    const pool = new Pool(createPostgresConfig());
    pool.on('error', () => console.error('PostgreSQL connection error'));
    global.cricketPostgresPool = pool;
  }
  return global.cricketPostgresPool;
}

export async function connectDB() {
  await getPool().query('SELECT 1');
  return getPool();
}

export async function withTransaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
