import { describe, it, expect } from 'vitest';
import { createPostgresConfig } from '@/lib/postgres-config.cjs';

describe('PostgreSQL connection configuration', () => {
  const url = 'postgresql://test-user:test-password@service.example.aivencloud.com:12345/defaultdb';

  it('keeps certificate verification and the supplied CA even with Aiven URI SSL options', () => {
    const config = createPostgresConfig({
      DATABASE_URL: url + '?sslmode=require&sslrootcert=ignored',
      DATABASE_CA_CERT: 'certificate-line-1\\ncertificate-line-2',
    });
    expect(config.ssl).toEqual({ rejectUnauthorized: true, ca: 'certificate-line-1\ncertificate-line-2' });
    expect(config.connectionString).not.toContain('sslmode');
    expect(config.connectionString).not.toContain('sslrootcert');
    expect(config.max).toBe(5);
  });

  it('allows an explicit local TLS opt-out but rejects insecure remote connections', () => {
    expect(createPostgresConfig({ DATABASE_URL: 'postgres://localhost/cricket', PGSSLMODE: 'disable' }).ssl).toBe(false);
    expect(() => createPostgresConfig({ DATABASE_URL: url, PGSSLMODE: 'disable' })).toThrow('local');
    expect(() => createPostgresConfig({ DATABASE_URL: url, PGSSLMODE: 'require' })).toThrow('PGSSLMODE');
  });

  it('validates settings without echoing credentials', () => {
    expect(() => createPostgresConfig({})).toThrow('DATABASE_URL');
    expect(() => createPostgresConfig({ DATABASE_URL: 'mongodb://private-password@host/db' })).toThrow('postgres://');
    expect(() => createPostgresConfig({ DATABASE_URL: url, DATABASE_POOL_MAX: '0' })).toThrow('DATABASE_POOL_MAX');
    expect(() => createPostgresConfig({ DATABASE_URL: 'private-password' })).toThrow('PostgreSQL connection URI');
  });
});
