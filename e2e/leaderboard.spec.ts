import { test, expect } from '@playwright/test';

test('renders the public home and leaderboard without client errors', async ({ page, request }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /bring local cricket/i })).toBeVisible();
  const health = await request.get('/api/health');
  expect(health.status()).toBe(200);
  expect((await health.json()).database).toBe('connected');
  expect((await request.get('/api/leaderboard')).status()).toBe(200);
  await page.goto('/leaderboard');
  await expect(page.getByRole('heading', { name: /leaderboard/i }).first()).toBeVisible();
  expect(errors).toEqual([]);
});
