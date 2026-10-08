const { loadEnvConfig } = require('@next/env');
const path = require('node:path');
const { Pool } = require('pg');
const { createPostgresConfig } = require('../lib/postgres-config.cjs');
const { applyMigrations } = require('./migrations.cjs');

async function main() {
  loadEnvConfig(process.cwd(), process.env.NODE_ENV !== 'production');
  const pool = new Pool(createPostgresConfig());
  let client;
  try {
    client = await pool.connect();
    await applyMigrations(client, path.join(__dirname, '../db/migrations'));
    console.log('PostgreSQL schema is up to date');
  } finally {
    client?.release();
    await pool.end();
  }
}

main().catch(() => {
  console.error('Database migration failed. Check DATABASE_URL, the CA certificate, connectivity, and database permissions.');
  process.exitCode = 1;
});
