import { vi, type Mock } from 'vitest';
import { POST } from '@/app/api/auth/login/route';
import { connectDB } from '@/lib/db';
import User from '@/models/User';
import * as Sentry from '@sentry/nextjs';
import * as winston from 'winston';
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it } from 'vitest';

vi.mock('@/lib/db', () => ({ connectDB: vi.fn() }));
vi.mock('@/models/User', () => ({
  __esModule: true,
  default: { findByEmail: vi.fn() },
}));
vi.mock('@sentry/nextjs', () => ({
  init: vi.fn(),
  captureMessage: vi.fn(),
  captureException: vi.fn(),
}));
vi.mock('winston', () => {
  const logError = vi.fn();
  return {
    __esModule: true,
    logError,
    default: {
      createLogger: () => ({ error: logError }),
      format: { json: vi.fn() },
      transports: { Console: vi.fn() },
    },
  };
});

const logError = (winston as unknown as { logError: Mock }).logError;
const findByEmail = vi.mocked(User.findByEmail);
const dbConnect = vi.mocked(connectDB);

const request = () => new NextRequest('http://localhost', {
  method: 'POST',
  body: JSON.stringify({ email: 'unit@example.com', password: 'test-input-password' }),
});

beforeEach(() => {
  dbConnect.mockReset();
});

describe('Login logging privacy', () => {
  it('should keep account identifiers out of missing-hash logs and telemetry', async () => {
    findByEmail.mockResolvedValue({
      _id: 'private-account-identifier',
    } as Awaited<ReturnType<typeof User.findByEmail>>);

    const response = await POST(request());

    expect(response.status).toBe(401);
    expect(findByEmail).toHaveBeenCalledWith('unit@example.com', true);
    expect(logError).toHaveBeenCalledWith('User record missing password hash');
    expect(Sentry.captureMessage).toHaveBeenCalledWith('User record missing password hash', { level: 'error' });
    const diagnostics = JSON.stringify([logError.mock.calls, vi.mocked(Sentry.captureMessage).mock.calls]);
    expect(diagnostics).not.toContain('private-account-identifier');
    expect(diagnostics).not.toContain('test-input-password');
  });

  it('should report login failures without forwarding raw exception contents', async () => {
    dbConnect.mockRejectedValueOnce(new Error('private database/request details'));

    const response = await POST(request());

    expect(response.status).toBe(500);
    expect(logError).toHaveBeenCalledWith('Login error');
    expect(Sentry.captureMessage).toHaveBeenCalledWith('Login error', { level: 'error' });
    expect(Sentry.captureException).not.toHaveBeenCalled();
    expect(JSON.stringify(logError.mock.calls)).not.toContain('private database/request details');
  });
});
