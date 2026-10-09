import { vi, type MockInstance } from 'vitest';
import { POST as registerHandler } from '@/app/api/auth/register/route';
import { NextRequest } from 'next/server';
import { beforeEach, afterEach, describe, it, expect } from 'vitest';
import bcrypt from 'bcryptjs';
import User from '@/models/User';

// Keep registration checks independent of PostgreSQL and deployment credentials.
vi.mock('@/lib/db', () => ({ connectDB: vi.fn() }));
vi.mock('@/models/User', () => ({
  __esModule: true,
  default: { findByEmail: vi.fn(), create: vi.fn() },
}));

const findByEmail = vi.mocked(User.findByEmail);
const createUser = vi.mocked(User.create);
let consoleLog: MockInstance<typeof console.log>;
let consoleError: MockInstance<typeof console.error>;

beforeEach(() => {
  consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.stubEnv('JWT_SECRET', 'phase-1-unit-test-secret');
  findByEmail.mockResolvedValue(null);
  createUser.mockResolvedValue({
    name: 'John',
    email: 'john@example.com',
    _id: { toString: () => 'unit-test-user' },
  } as unknown as Awaited<ReturnType<typeof User.create>>);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe('Auth Register', () => {
  it('should validate email format', async () => {
    const req = new NextRequest('http://localhost', {
      method: 'POST',
      body: JSON.stringify({
        name: 'John',
        email: 'invalid-email', // Invalid
        password: 'SecurePass123',
      }),
    });

    const res = await registerHandler(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: ['email'] }),
    ]));
    expect(findByEmail).not.toHaveBeenCalled();
    expect(createUser).not.toHaveBeenCalled();
  });

  it('should store a bcrypt hash and omit the password from the response', async () => {
    const req = new NextRequest('http://localhost', {
      method: 'POST',
      body: JSON.stringify({
        name: 'John',
        email: 'john@example.com',
        password: 'SecurePass123',
      }),
    });

    const res = await registerHandler(req);
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.user.password).toBeUndefined(); // Password should never be returned
    const storedUser = createUser.mock.calls[0][0] as unknown as { password: string };
    expect(storedUser.password).not.toBe('SecurePass123');
    expect(await bcrypt.compare('SecurePass123', storedUser.password)).toBe(true);
    expect(consoleLog).not.toHaveBeenCalled();
    expect(consoleError).not.toHaveBeenCalled();
  });

  it('should report registration errors without exposing exception contents', async () => {
    findByEmail.mockRejectedValueOnce(new Error('private database/request details'));
    const req = new NextRequest('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ name: 'John', email: 'john@example.com', password: 'SecurePass123' }),
    });

    const res = await registerHandler(req);
    expect(res.status).toBe(500);
    expect(consoleError).toHaveBeenCalledWith('Registration error');
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain('private database/request details');
    expect(consoleLog).not.toHaveBeenCalled();
  });
});
