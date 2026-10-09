import { test, expect } from '@playwright/test';
import { createAccount, login } from './helpers';

test('requires authentication and logs in through the browser', async ({ page, request }) => {
  const anonymous = await request.get('/api/auth/me');
  expect(anonymous.status()).toBe(401);
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login/);
  const account = await createAccount(request, 'login');
  await login(page, account);
  const profile = await page.request.get('/api/auth/me');
  expect(profile.status()).toBe(200);
  expect((await profile.json()).user.email).toBe(account.email);
  expect((await request.post('/api/auth/login', { data: { email: account.email, password: 'wrong-password' } })).status()).toBe(401);
  await page.request.post('/api/auth/logout');
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login/);
});
