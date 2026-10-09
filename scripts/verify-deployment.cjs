const { chromium, request } = require('@playwright/test');
const { randomUUID } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

require('@next/env').loadEnvConfig(process.cwd(), true, { info() {}, error() {} });

const baseURL = process.env.VERIFY_BASE_URL;
const report = { baseURL, checks: [], accounts: [], cleanup: {} };
let browser;
let api;
let matchId;
let owner;

function check(name, passed, status) {
  report.checks.push({ name, passed, ...(status ? { status } : {}) });
  if (!passed) throw new Error(`Verification failed: ${name}${status ? ` (HTTP ${status})` : ''}`);
}

async function account(label) {
  const email = `verification-${label}-${randomUUID()}@example.com`;
  const password = `Verify-${randomUUID()}!`;
  const response = await api.post('/api/auth/register', { data: { name: 'Verification User', email, password } });
  check(`${label} registration`, response.status() === 201, response.status());
  const body = await response.json();
  report.accounts.push({ id: body.user.id, email });
  return { email, password, token: body.token, user: body.user };
}

async function login(page, user) {
  await page.goto('/login');
  await page.locator('input[type="email"]').fill(user.email);
  await page.locator('input[type="password"]').fill(user.password);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL('**/dashboard', { timeout: 30000 });
  const profile = await page.request.get('/api/auth/me');
  check('browser login and profile', profile.status() === 200, profile.status());
  check('profile identity and hash privacy', (await profile.json()).user.email === user.email && !JSON.stringify(await profile.json()).includes('password'));
}

async function run() {
  if (!baseURL || process.env.VERIFY_ALLOW_WRITES !== '1') throw new Error('Set VERIFY_BASE_URL and VERIFY_ALLOW_WRITES=1 for an approved test deployment');
  const url = new URL(baseURL);
  if (url.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(url.hostname)) throw new Error('Remote verification requires HTTPS');
  api = await request.newContext({ baseURL, timeout: 30000 });
  const health = await api.get('/api/health');
  check('PostgreSQL connectivity', health.status() === 200 && (await health.json()).database === 'connected', health.status());
  check('anonymous profile denied', (await api.get('/api/auth/me')).status() === 401);
  check('anonymous matches denied', (await api.get('/api/matches')).status() === 401);
  browser = await chromium.launch({ headless: true });
  const ownerContext = await browser.newContext({ baseURL, viewport: { width: 1440, height: 1000 } });
  const ownerPage = await ownerContext.newPage();
  const screenshotDir = path.join(process.cwd(), 'docs/screenshots');
  if (process.env.VERIFY_SCREENSHOTS === '1') {
    fs.mkdirSync(screenshotDir, { recursive: true });
    await ownerPage.goto('/');
    await ownerPage.getByRole('heading', { name: /bring local cricket/i }).waitFor();
    await ownerPage.screenshot({ path: path.join(screenshotDir, 'home.png'), animations: 'disabled' });
  }
  owner = await account('owner');
  const viewer = await account('viewer');
  await login(ownerPage, owner);
  const wrong = await api.post('/api/auth/login', { data: { email: owner.email, password: 'wrong-password' } });
  check('invalid password denied', wrong.status() === 401);
  const headers = { authorization: `Bearer ${owner.token}` };
  const created = await api.post('/api/matches', { headers, data: {
    venue: 'Verification Ground', startTime: new Date().toISOString(), overs: 2,
    teamOne: { name: 'Verification Rangers', players: [{ name: 'Alice' }, { name: 'Ann' }, { name: 'Amy' }] },
    teamTwo: { name: 'Verification Vikings', players: [{ name: 'Bob' }, { name: 'Ben' }, { name: 'Bill' }] },
  } });
  check('match creation', created.status() === 201, created.status());
  const match = (await created.json()).data;
  matchId = match._id;
  const route = `/api/matches/${matchId}`;
  const viewerHeaders = { authorization: `Bearer ${viewer.token}` };
  const joined = await api.post('/api/matches/join', { headers: viewerHeaders, data: { matchCode: match.matchCode } });
  check('viewer joins', joined.status() === 200, joined.status());
  const denied = await api.put(route, { headers: viewerHeaders, data: { 'teamOne.total_score': 99 } });
  check('viewer edit denied', denied.status() === 403, denied.status());
  check('start match', (await api.post(`${route}/start`, { headers, data: {} })).status() === 200);
  check('player setup', (await api.put(route, { headers, data: {
    batting_team: 'Verification Rangers', bowling_team: 'Verification Vikings',
    toss_winner: 'Verification Rangers', toss_decision: 'bat',
    scoringState: { selectedBatsman1: 'Alice', selectedBatsman2: 'Ann', selectedBowler: 'Bob' },
  } })).status() === 200);
  const viewerContext = await browser.newContext({ baseURL });
  const viewerPage = await viewerContext.newPage();
  await login(viewerPage, viewer);
  await viewerPage.addScriptTag({ path: require.resolve('pusher-js/dist/web/pusher.min.js') });
  await viewerPage.evaluate(({ key, cluster, id }) => {
    window.verificationEvents = [];
    window.verificationSubscribed = false;
    window.verificationPusher = new window.Pusher(key, { cluster, authEndpoint: '/api/pusher/auth' });
    const channel = window.verificationPusher.subscribe(`private-user-${id}`);
    channel.bind('pusher:subscription_succeeded', () => { window.verificationSubscribed = true; });
    channel.bind('match-updated', event => { window.verificationEvents.push(event); });
  }, { key: process.env.NEXT_PUBLIC_PUSHER_KEY, cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER, id: viewer.user.id });
  await viewerPage.waitForFunction(() => window.verificationSubscribed === true, undefined, { timeout: 30000 });
  check('Pusher private subscription', true);
  const recorded = await api.post(`${route}/record-ball`, { headers, data: { outcome: '4', extraRuns: 0 } });
  check('record boundary', recorded.status() === 200, recorded.status());
  const fresh = (await (await api.get(route, { headers })).json()).data;
  check('persisted batting and bowling statistics', fresh.teamOne.total_score === 4 && fresh.teamOne.total_balls === 1 && fresh.teamOne.players[0].runs_scored === 4 && fresh.teamTwo.players[0].runs_conceded === 4);
  await viewerPage.waitForFunction(id => window.verificationEvents.some(event => event._id === id && event.teamOne.total_score === 4), matchId, { timeout: 30000 });
  check('viewer receives realtime scored ball', true);
  await ownerPage.goto(`/matches/${matchId}/score`);
  await ownerPage.getByText('Verification Rangers').first().waitFor({ timeout: 30000 });
  if (process.env.VERIFY_SCREENSHOTS === '1') await ownerPage.screenshot({ path: path.join(screenshotDir, 'scoring.png'), animations: 'disabled' });
  check('scoring page renders', true);
  const undo = await api.post(`${route}/undo-ball`, { headers, data: {} });
  check('undo ball', undo.status() === 200, undo.status());
  const undone = (await (await api.get(route, { headers })).json()).data;
  check('persisted undo', undone.teamOne.total_score === 0 && undone.teamOne.total_balls === 0 && undone.ballHistory.length === 0);
  await viewerPage.waitForFunction(id => window.verificationEvents.some(event => event._id === id && event.teamOne.total_score === 0), matchId, { timeout: 30000 });
  check('viewer receives realtime undo', true);
  await viewerPage.evaluate(() => window.verificationPusher.disconnect());
  check('leaderboard available', (await api.get('/api/leaderboard')).status() === 200);
  await ownerPage.request.post('/api/auth/logout');
  check('logout invalidates cookie', (await ownerPage.request.get('/api/auth/me')).status() === 401);
}

run().catch(error => {
  report.error = error.message.startsWith('Verification failed:') ? error.message : 'Browser or network verification failed; inspect the named checks';
  process.exitCode = 1;
}).finally(async () => {
  if (matchId && owner) {
    try { report.cleanup.matchDeleted = (await api.delete(`/api/matches?id=${matchId}`, { headers: { authorization: `Bearer ${owner.token}` } })).status() === 200; }
    catch { report.cleanup.matchDeleted = false; }
  }
  await browser?.close();
  await api?.dispose();
  fs.mkdirSync('test-results', { recursive: true });
  const host = baseURL ? new URL(baseURL).hostname : 'unknown';
  fs.writeFileSync(`test-results/deployment-${host}.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ baseURL, checks: report.checks, cleanup: report.cleanup, error: report.error, temporaryAccounts: report.accounts.length }));
});
