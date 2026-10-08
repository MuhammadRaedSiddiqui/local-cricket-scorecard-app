import { PGlite } from '@electric-sql/pglite';
import { applyMigrations } from '@/scripts/migrations.cjs';
import path from 'node:path';
import type { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import { NextRequest } from 'next/server';
import User from '@/models/User';
import Match, { MatchConflictError } from '@/models/Match';
import { getLeaderboard } from '@/lib/leaderboard';
import { POST as register } from '@/app/api/auth/register/route';
import { POST as login } from '@/app/api/auth/login/route';
import { GET as me } from '@/app/api/auth/me/route';
import { GET as dashboard } from '@/app/api/dashboard/route';
import { POST as createMatch, GET as listMatches, DELETE as deleteMatch } from '@/app/api/matches/route';
import { GET as getMatch, PUT as updateMatch } from '@/app/api/matches/[id]/route';
import { POST as join } from '@/app/api/matches/join/route';
import { POST as leave } from '@/app/api/matches/[id]/leave/route';
import { POST as start } from '@/app/api/matches/[id]/start/route';
import { POST as score } from '@/app/api/matches/[id]/score/route';
import { POST as record } from '@/app/api/matches/[id]/record-ball/route';
import { POST as undo } from '@/app/api/matches/[id]/undo-ball/route';
import { GET as health } from '@/app/api/health/route';

jest.mock('@sentry/nextjs', () => ({ init: jest.fn(), captureMessage: jest.fn() }));
jest.mock('@/lib/pusher', () => ({
  pusherServer: { trigger: jest.fn().mockResolvedValue(undefined) },
}));
jest.mock('winston', () => ({
  __esModule: true,
  default: {
    createLogger: () => ({ error: jest.fn() }),
    format: { json: jest.fn() }, transports: { File: jest.fn() },
  },
}));

// WASM startup plus real bcrypt checks can exceed Jest's 5s default on Windows.
jest.setTimeout(30000);

let db: PGlite;
const secret = 'postgres-integration-test-secret';

function request(body?: unknown, token?: string, method = 'POST', url = 'http://localhost/api/test') {
  return new NextRequest(url, {
    method,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
}

async function account(email = 'owner@example.com') {
  const response = await register(request({ name: 'Test User', email, password: 'ValidPassword123' }));
  expect(response.status).toBe(201);
  return response.json() as Promise<{ token: string; user: { id: string; name: string; email: string } }>;
}

async function fixture() {
  const owner = await account();
  const response = await createMatch(request({
    venue: 'Test Ground', startTime: '2026-10-08T10:00:00Z', overs: 20,
    teamOne: { name: 'Rangers', players: [{ name: 'Alice' }, { name: 'Ann' }, { name: 'Amy' }] },
    teamTwo: { name: 'Vikings', players: [{ name: 'Bob' }, { name: 'Ben' }, { name: 'Bill' }] },
  }, owner.token));
  expect(response.status).toBe(201);
  const { data } = await response.json();
  return { owner, match: data, params: { params: { id: data._id as string } } };
}

beforeAll(async () => {
  db = new PGlite();
  const query = async (sql: string, values?: unknown[]) => {
    if (!values && sql.includes(';')) {
      const results = await db.exec(sql);
      const result = results[results.length - 1];
      return { rows: result.rows, rowCount: result.affectedRows ?? result.rows.length };
    }
    const result = await db.query(sql, values);
    return { rows: result.rows, rowCount: result.affectedRows ?? result.rows.length };
  };
  const release = jest.fn();
  // Only transport is substituted: real repository SQL and transaction code run
  // against PostgreSQL compiled to WASM. No Aiven credentials/network are used.
  global.cricketPostgresPool = {
    query, connect: async () => ({ query, release }),
  } as unknown as Pool;
  await applyMigrations({ query }, path.join(process.cwd(), 'db/migrations'), () => {});
}, 60000);

beforeEach(async () => {
  jest.replaceProperty(process, 'env', { ...process.env, JWT_SECRET: secret });
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  await db.exec('TRUNCATE match_members, matches, users CASCADE');
});

afterEach(() => jest.restoreAllMocks());
afterAll(async () => {
  global.cricketPostgresPool = undefined;
  await db?.close();
});

describe('PostgreSQL-backed API behavior', () => {
  it('re-runs migrations without recreating tables or losing accounts', async () => {
    const owner = await account();
    await applyMigrations(global.cricketPostgresPool, path.join(process.cwd(), 'db/migrations'), () => {});
    expect((await User.findProfile(owner.user.id))?.email).toBe('owner@example.com');
    expect((await db.query('SELECT name FROM schema_migrations')).rows).toEqual([{ name: '001_initial.sql' }]);
  });

  it('registers hashed passwords, logs in, and never exposes hashes in profiles', async () => {
    const owner = await account('OWNER@example.com');
    expect(owner.user.email).toBe('owner@example.com');
    const publicUser = await User.findByEmail('OWNER@example.com');
    expect(publicUser?.password).toBeUndefined();
    const privateUser = await User.findByEmail('OWNER@example.com', true);
    expect(await bcrypt.compare('ValidPassword123', privateUser!.password!)).toBe(true);

    const duplicate = await register(request({ name: 'Duplicate', email: 'owner@example.com', password: 'ValidPassword123' }));
    expect(duplicate.status).toBe(400);
    const response = await login(request({ email: ' OWNER@example.com ', password: 'ValidPassword123' }));
    expect(response.status).toBe(200);
    expect(response.cookies.get('auth-token')?.value).toBeTruthy();
    expect((await response.json()).user.id).toBe(owner.user.id);
    expect((await login(request({ email: 'owner@example.com', password: 'wrong' }))).status).toBe(401);

    const profile = await me(request(undefined, owner.token, 'GET'));
    expect(profile.status).toBe(200);
    const data = await profile.json();
    expect(data.user).not.toHaveProperty('password');
    expect(data.user).not.toHaveProperty('password_hash');
    expect(data.user.createdMatches).toEqual([]);
    expect((await health()).status).toBe(200);
  });

  it('persists default scorecard fields and preserves list/detail response formats', async () => {
    const { owner, match, params } = await fixture();
    expect(match._id).toEqual(expect.any(String));
    expect(match.matchCode).toMatch(/^[A-Z0-9]{6}$/);
    expect(match.teamOne.total_balls).toBe(0);
    expect(match.teamOne.players[0].runs_scored).toBe(0);
    expect(match.ballHistory).toEqual([]);
    const detail = await getMatch(request(undefined, owner.token, 'GET'), params);
    expect((await detail.json()).data._id).toBe(match._id);
    const list = await listMatches(request(undefined, owner.token, 'GET'));
    expect((await list.json()).data.created[0].teamOne.overs).toBe('0.0');
    const summary = await dashboard(request(undefined, owner.token, 'GET'));
    expect((await summary.json()).data).toMatchObject({ totalMatches: 1, liveMatches: 0 });
    expect((await getMatch(request(undefined, undefined, 'GET'), params)).status).toBe(401);
  });

  it('joins, lists, leaves, and deletes memberships without dangling user match arrays', async () => {
    const { owner, match, params } = await fixture();
    const viewer = await account('viewer@example.com');
    expect((await join(request({ matchCode: match.matchCode.toLowerCase() }, viewer.token))).status).toBe(200);
    expect((await join(request({ matchCode: match.matchCode }, viewer.token))).status).toBe(409);
    expect((await User.findProfile(viewer.user.id))?.joinedMatches).toHaveLength(1);
    const list = await listMatches(request(undefined, viewer.token, 'GET'));
    expect((await list.json()).data.invited).toHaveLength(1);
    const summary = await dashboard(request(undefined, viewer.token, 'GET'));
    expect((await summary.json()).data.invitedMatches).toHaveLength(1);
    expect((await leave(request({}, owner.token), params)).status).toBe(403);
    expect((await leave(request({}, viewer.token), params)).status).toBe(200);
    expect((await User.findProfile(viewer.user.id))?.joinedMatches).toEqual([]);
    expect((await Match.findById(match._id))?.viewers).toEqual([]);
    await join(request({ matchCode: match.matchCode }, viewer.token));
    const deleted = await deleteMatch(request(undefined, owner.token, 'DELETE', `http://localhost/api/matches?id=${match._id}`));
    expect(deleted.status).toBe(200);
    expect(await Match.findById(match._id)).toBeNull();
    expect((await User.findProfile(owner.user.id))?.createdMatches).toEqual([]);
    expect((await User.findProfile(viewer.user.id))?.joinedMatches).toEqual([]);
    expect((await db.query('SELECT * FROM match_members')).rows).toEqual([]);
  });

  it('starts, records and undoes balls, and saves nested/dotted score updates', async () => {
    const { owner, match, params } = await fixture();
    const viewer = await account('viewer@example.com');
    expect((await start(request({}, viewer.token), params)).status).toBe(403);
    expect((await start(request({}, owner.token), params)).status).toBe(200);
    const setup = await updateMatch(request({
      batting_team: 'Rangers', bowling_team: 'Vikings',
      scoringState: { selectedBatsman1: 'Alice', selectedBatsman2: 'Ann', selectedBowler: 'Bob' },
    }, owner.token, 'PUT'), params);
    expect(setup.status).toBe(200);
    expect((await record(request({ outcome: '4', extraRuns: 0 }, viewer.token), params)).status).not.toBe(200);
    const ball = await record(request({ outcome: '4', extraRuns: 0 }, owner.token), params);
    expect(ball.status).toBe(200);
    const saved = (await ball.json()).data;
    expect(saved.teamOne).toMatchObject({ total_score: 4, total_balls: 1 });
    expect(saved.teamOne.players[0]).toMatchObject({ runs_scored: 4, balls_played: 1, fours: 1 });
    expect(saved.teamTwo.players[0]).toMatchObject({ runs_conceded: 4, balls_bowled: 1 });
    expect(saved.ballHistory).toHaveLength(1);
    expect((await undo(request({}, owner.token), params)).status).toBe(200);
    const undone = await Match.findById(match._id);
    expect(undone?.teamOne.total_score).toBe(0);
    expect(undone?.ballHistory).toEqual([]);
    const scored = await score(request({ match: {
      'teamOne.total_score': 12, 'teamOne.total_balls': 6,
      teamOne: { players: saved.teamOne.players },
      target: 13, currentInnings: 2,
    } }, owner.token), params);
    expect(scored.status).toBe(200);
    const final = await Match.findById(match._id);
    expect(final?.teamOne.total_score).toBe(12);
    expect(final?.teamOne.players[0].runs_scored).toBe(4);
    expect(final?.target).toBe(13);
    expect(final?.batting_team).toBe('Vikings');
    expect(final?.bowling_team).toBe('Rangers');
  });

  it('rejects stale score snapshots and rolls back failed match/member writes', async () => {
    const { owner, match, params } = await fixture();
    const first = (await Match.findById(match._id))!;
    const stale = (await Match.findById(match._id))!;
    first.teamOne.total_score = 4;
    await first.save();
    stale.teamOne.total_score = 6;
    await expect(stale.save()).rejects.toBeInstanceOf(MatchConflictError);
    expect((await Match.findById(match._id))?.teamOne.total_score).toBe(4);
    const lookup = jest.spyOn(Match, 'findById').mockResolvedValueOnce(stale);
    const conflict = await updateMatch(request({ 'teamOne.total_score': 8 }, owner.token, 'PUT'), params);
    expect(conflict.status).toBe(409);
    lookup.mockRestore();

    const invalid = (await Match.findById(match._id))!;
    invalid.teamOne.total_score = 100;
    invalid.viewers.push('nonexistent-user');
    await expect(invalid.save()).rejects.toMatchObject({ code: '23503' });
    expect((await Match.findById(match._id))?.teamOne.total_score).toBe(4);
    expect((await Match.findById(match._id))?.admins).toHaveLength(1);
    await expect(Match.create({
      ...first.toObject(), matchCode: 'BAD001', viewers: ['nonexistent-user'],
    })).rejects.toMatchObject({ code: '23503' });
    expect(await Match.findByCode('BAD001')).toBeNull();
  });

  it('enforces case-normalized unique email and treats input as SQL parameters', async () => {
    const owner = await account();
    await expect(User.create({ name: 'Duplicate', email: 'OWNER@example.com', password: 'hash' }))
      .rejects.toMatchObject({ code: '23505' });
    expect(await User.findByEmail("' OR 1=1 --", true)).toBeNull();
    expect(await Match.findById("' OR 1=1 --")).toBeNull();
    expect((await User.findProfile(owner.user.id))?.email).toBe('owner@example.com');
  });

  it('aggregates completed scorecards and handles empty leaderboards and wicketless bowlers', async () => {
    expect(await getLeaderboard()).toEqual({ totalMatches: 0, teamStats: [], battingStats: [], bowlingStats: [] });
    const { match } = await fixture();
    const completed = (await Match.findById(match._id))!;
    completed.status = 'completed';
    completed.teamOne.total_score = 120;
    completed.teamOne.total_wickets = 2;
    completed.teamTwo.total_score = 100;
    completed.teamTwo.total_wickets = 1;
    Object.assign(completed.teamOne.players[0], {
      runs_scored: 60, balls_played: 40, fours: 4, sixes: 2, is_out: true,
      wickets: 1, balls_bowled: 24, runs_conceded: 20,
    });
    Object.assign(completed.teamTwo.players[0], {
      runs_scored: 50, balls_played: 30, wickets: 0, balls_bowled: 25, runs_conceded: 30,
    });
    await completed.save();
    const stats = await getLeaderboard();
    expect(stats.totalMatches).toBe(1);
    expect(stats.teamStats).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'Rangers', wins: 1, losses: 0, draws: 0, winRate: 100, averageScore: 120 }),
      expect.objectContaining({ name: 'Vikings', wins: 0, losses: 1, winRate: 0 }),
    ]));
    expect(stats.battingStats).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'Alice', runs: 60, average: 60, strikeRate: 150 }),
      expect.objectContaining({ name: 'Bob', average: 50, strikeRate: 166.67 }),
    ]));
    expect(stats.bowlingStats).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'Alice', wickets: 1, overs: '4.0', economy: 5, average: 20 }),
      expect.objectContaining({ name: 'Bob', overs: '4.1', economy: 7.2, average: null }),
    ]));
  });
});
