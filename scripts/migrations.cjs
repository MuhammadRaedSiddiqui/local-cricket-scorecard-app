const { readFileSync, readdirSync } = require('node:fs');
const path = require('node:path');

/** Apply migrations on one checked-out client; callers own connection cleanup. */
async function applyMigrations(client, directory, log = console.log) {
  await client.query('BEGIN');
  try {
    await client.query('SELECT pg_advisory_xact_lock(73642001)');
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now()
    )`);
    const applied = await client.query('SELECT name FROM schema_migrations');
    const names = new Set(applied.rows.map(row => row.name));
    for (const name of readdirSync(directory).filter(name => name.endsWith('.sql')).sort()) {
      if (names.has(name)) continue;
      await client.query(readFileSync(path.join(directory, name), 'utf8'));
      await client.query('INSERT INTO schema_migrations(name) VALUES ($1)', [name]);
      log(`Applied ${name}`);
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

module.exports = { applyMigrations };
