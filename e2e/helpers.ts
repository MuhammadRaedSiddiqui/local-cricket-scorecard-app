import { expect, type APIRequestContext, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';

export async function createAccount(request: APIRequestContext, label: string) {
  const email = `verification-${label}-${randomUUID()}@example.com`;
  const password = `Verify-${randomUUID()}!`;
  const response = await request.post('/api/auth/register', { data: { name: 'Verification User', email, password } });
  expect(response.status()).toBe(201);
  const { token, user } = await response.json();
  return { email, password, token, user };
}

export async function login(page: Page, account: { email: string; password: string }) {
  await page.goto('/login');
  await page.locator('input[type="email"]').fill(account.email);
  await page.locator('input[type="password"]').fill(account.password);
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

export const fixtureMatch = {
  venue: 'Verification Ground', startTime: '2026-10-09T10:00:00Z', overs: 2,
  teamOne: { name: 'Verification Rangers', players: [{ name: 'Alice' }, { name: 'Ann' }, { name: 'Amy' }] },
  teamTwo: { name: 'Verification Vikings', players: [{ name: 'Bob' }, { name: 'Ben' }, { name: 'Bill' }] },
};
