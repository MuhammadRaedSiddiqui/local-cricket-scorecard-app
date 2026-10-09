import { test, expect } from '@playwright/test';
import { createAccount, fixtureMatch, login } from './helpers';

test('persists scored and undone balls and renders the scorecard', async ({ page, request }) => {
  const owner = await createAccount(request, 'scorer');
  await login(page, owner);
  const headers = { authorization: `Bearer ${owner.token}` };
  const created = await request.post('/api/matches', { headers, data: fixtureMatch });
  expect(created.status()).toBe(201);
  const { data: match } = await created.json();
  const path = `/api/matches/${match._id}`;
  try {
    expect((await request.post(`${path}/start`, { headers, data: {} })).status()).toBe(200);
    expect((await request.put(path, { headers, data: {
      batting_team: fixtureMatch.teamOne.name, bowling_team: fixtureMatch.teamTwo.name,
      scoringState: { selectedBatsman1: 'Alice', selectedBatsman2: 'Ann', selectedBowler: 'Bob' },
    } })).status()).toBe(200);
    const recorded = await request.post(`${path}/record-ball`, { headers, data: { outcome: '4', extraRuns: 0 } });
    expect(recorded.status()).toBe(200);
    const fresh = await request.get(path, { headers });
    expect((await fresh.json()).data.teamOne).toMatchObject({ total_score: 4, total_balls: 1 });
    await page.goto(`/matches/${match._id}/scorecard`);
    await expect(page.getByText(fixtureMatch.teamOne.name).first()).toBeVisible();
    await expect(page.getByText('Alice', { exact: true }).first()).toBeVisible();
    expect((await request.post(`${path}/undo-ball`, { headers, data: {} })).status()).toBe(200);
    const undone = await request.get(path, { headers });
    expect((await undone.json()).data.teamOne).toMatchObject({ total_score: 0, total_balls: 0 });
  } finally {
    expect((await request.delete(`/api/matches?id=${match._id}`, { headers })).status()).toBe(200);
  }
});
