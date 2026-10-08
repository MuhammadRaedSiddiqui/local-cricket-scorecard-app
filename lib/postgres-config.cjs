const { readFileSync } = require('node:fs');

/** @param {Record<string, string | undefined>} [env] @returns {import('pg').PoolConfig} */
function createPostgresConfig(env = process.env) {
  if (!env.DATABASE_URL) throw new Error('Please define the DATABASE_URL environment variable');
  let url;
  try {
    url = new URL(env.DATABASE_URL);
  } catch {
    throw new Error('DATABASE_URL must be a PostgreSQL connection URI');
  }
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) {
    throw new Error('DATABASE_URL must use postgres:// or postgresql://');
  }
  const mode = env.PGSSLMODE || 'verify-full';
  if (!['disable', 'verify-full'].includes(mode)) {
    throw new Error('PGSSLMODE must be verify-full, or disable for local development');
  }
  if (mode === 'disable' && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) {
    throw new Error('TLS may only be disabled for a local PostgreSQL server');
  }
  // URI SSL parameters replace pg's supplied SSL object, losing its CA.
  for (const key of ['ssl', 'sslmode', 'sslcert', 'sslkey', 'sslrootcert', 'uselibpqcompat']) {
    url.searchParams.delete(key);
  }
  const ca = env.DATABASE_CA_CERT?.replace(/\\n/g, '\n') ||
    (env.DATABASE_CA_CERT_PATH ? readFileSync(env.DATABASE_CA_CERT_PATH, 'utf8') : undefined);
  const max = Number(env.DATABASE_POOL_MAX || 5);
  if (!Number.isInteger(max) || max < 1 || max > 100) {
    throw new Error('DATABASE_POOL_MAX must be an integer between 1 and 100');
  }
  return {
    connectionString: url.toString(),
    ssl: mode === 'disable' ? false : { rejectUnauthorized: true, ...(ca ? { ca } : {}) },
    max,
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000,
    application_name: 'local-cricket-scorecard',
  };
}

module.exports = { createPostgresConfig };
