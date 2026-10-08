import { randomUUID } from 'node:crypto';
import { customAlphabet } from 'nanoid';
import { z } from 'zod';
import type { PoolClient } from 'pg';
import { getPool, withTransaction } from '@/lib/db';

const generateMatchCode = customAlphabet('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', 6);
const stat = z.number().default(0);
const playerSchema = z.object({
  _id: z.string().optional(),
  name: z.string().min(1),
  runs_scored: stat, balls_played: stat, dots: stat, fours: stat, sixes: stat,
  wickets: stat, balls_bowled: stat, runs_conceded: stat, maidens: stat, dot_balls: stat,
  is_captain: z.boolean().default(false), is_keeper: z.boolean().default(false),
  is_out: z.boolean().default(false),
});
const teamSchema = z.object({
  _id: z.string().optional(),
  name: z.string().min(1), players: z.array(playerSchema).default([]),
  total_score: stat, total_wickets: stat, total_overs: stat, total_balls: stat, extras: stat,
});
const ballSchema = z.object({
  ballNumber: z.number(), overNumber: z.number(), innings: z.number(),
  batsman: z.string(), bowler: z.string(), runs: z.number(), outcome: z.string(),
  isExtra: z.boolean().default(false), isWicket: z.boolean().default(false),
  timestamp: z.coerce.date().default(() => new Date()),
});
const scoringStateSchema = z.object({
  selectedBatsman1: z.string().default(''), selectedBatsman2: z.string().default(''),
  selectedBowler: z.string().default(''), previousBowler: z.string().default(''),
  currentStriker: z.enum(['batsman1', 'batsman2']).default('batsman1'),
  currentOver: z.array(z.string()).default([]), outBatsmen: z.array(z.string()).default([]),
  currentInnings: z.number().default(1), extraRuns: stat,
});
const matchSchema = z.object({
  matchCode: z.string().min(1).default(() => generateMatchCode()),
  createdBy: z.string().min(1), status: z.enum(['upcoming', 'live', 'completed']).default('upcoming'),
  startTime: z.coerce.date(), venue: z.string().min(1), overs: z.number().int().positive(),
  teamOne: teamSchema, teamTwo: teamSchema,
  toss_decision: z.string().nullable().default(null), toss_winner: z.string().nullable().default(null),
  batting_team: z.string().nullable().default(null), bowling_team: z.string().nullable().default(null),
  isPrivate: z.boolean().default(false),
  admins: z.array(z.string()).default([]), scorers: z.array(z.string()).default([]),
  viewers: z.array(z.string()).default([]), target: z.number().nullable().default(null),
  currentInnings: z.number().default(1),
  scoringState: scoringStateSchema.nullable().default(null),
  ballHistory: z.array(ballSchema).default([]),
});

export type IPlayer = z.infer<typeof playerSchema>;
export type ITeam = z.infer<typeof teamSchema>;
export type IBall = z.infer<typeof ballSchema>;
export type IScoringState = z.infer<typeof scoringStateSchema>;
type MatchFields = z.infer<typeof matchSchema>;
export type MatchData = MatchFields & { _id: string; createdAt: Date; updatedAt: Date };
export type IMatch = MatchRecord;

interface MatchRow {
  id: string; match_code: string; created_by: string; status: MatchFields['status'];
  start_time: Date; venue: string; overs: number; is_private: boolean;
  scorecard: Pick<MatchFields, 'teamOne' | 'teamTwo' | 'toss_decision' | 'toss_winner' |
    'batting_team' | 'bowling_team' | 'target' | 'currentInnings' | 'scoringState' | 'ballHistory'>;
  version: number; created_at: Date; updated_at: Date;
  admins: string[]; scorers: string[]; viewers: string[];
}

const selectMatch = `SELECT m.*,
  ARRAY(SELECT user_id FROM match_members WHERE match_id = m.id AND role = 'admin' ORDER BY user_id) AS admins,
  ARRAY(SELECT user_id FROM match_members WHERE match_id = m.id AND role = 'scorer' ORDER BY user_id) AS scorers,
  ARRAY(SELECT user_id FROM match_members WHERE match_id = m.id AND role = 'viewer' ORDER BY user_id) AS viewers
  FROM matches m`;

function fromRow(row: MatchRow): MatchRecord {
  const fields = matchSchema.parse({
    ...row.scorecard, matchCode: row.match_code, createdBy: row.created_by,
    status: row.status, startTime: row.start_time, venue: row.venue, overs: row.overs,
    isPrivate: row.is_private, admins: row.admins, scorers: row.scorers, viewers: row.viewers,
  });
  return new MatchRecord({
    ...fields, _id: row.id, createdAt: new Date(row.created_at), updatedAt: new Date(row.updated_at),
  }, row.version);
}

function scorecard(match: MatchFields) {
  const { teamOne, teamTwo, toss_decision, toss_winner, batting_team, bowling_team,
    target, currentInnings, scoringState, ballHistory } = match;
  return { teamOne, teamTwo, toss_decision, toss_winner, batting_team, bowling_team,
    target, currentInnings, scoringState, ballHistory };
}

async function syncMembers(client: PoolClient, id: string, match: MatchFields) {
  await client.query('DELETE FROM match_members WHERE match_id = $1', [id]);
  for (const [role, ids] of [
    ['admin', match.admins], ['scorer', match.scorers], ['viewer', match.viewers],
  ] as const) {
    if (!ids.length) continue;
    await client.query(
      `INSERT INTO match_members(match_id, user_id, role)
       SELECT $1, user_id, $2 FROM unnest($3::text[]) AS user_id ON CONFLICT DO NOTHING`,
      [id, role, ids]
    );
  }
}

export class MatchConflictError extends Error {
  constructor() {
    super('Conflict: Another scorer updated the match. Please refresh and try again.');
    this.name = 'MatchConflictError';
  }
}

// Keep the existing scorecard shape at the API boundary, including _id strings.
export interface MatchRecord extends MatchData {}
export class MatchRecord {
  private version!: number;

  constructor(data: MatchData, version: number) {
    Object.assign(this, data);
    Object.defineProperty(this, 'version', { value: version, writable: true, enumerable: false });
  }

  toObject(): MatchData {
    return { ...this };
  }

  async save(): Promise<this> {
    const fields = matchSchema.parse(this);
    const result = await withTransaction(async client => {
      const updated = await client.query<{ version: number; updated_at: Date }>(
        `UPDATE matches SET match_code=$2, status=$3, start_time=$4, venue=$5, overs=$6,
         is_private=$7, scorecard=$8::jsonb, version=version+1, updated_at=now()
         WHERE id=$1 AND version=$9 RETURNING version, updated_at`,
        [this._id, fields.matchCode, fields.status, fields.startTime, fields.venue,
          fields.overs, fields.isPrivate, JSON.stringify(scorecard(fields)), this.version]
      );
      if (!updated.rowCount) throw new MatchConflictError();
      await syncMembers(client, this._id, fields);
      return updated.rows[0];
    });
    Object.assign(this, fields);
    this.version = result.version;
    this.updatedAt = new Date(result.updated_at);
    return this;
  }
}

const mutableFields = new Set([
  'status', 'startTime', 'venue', 'overs', 'teamOne', 'teamTwo', 'toss_decision',
  'toss_winner', 'batting_team', 'bowling_team', 'target', 'currentInnings',
  'isPrivate', 'scoringState', 'ballHistory',
]);

// Score payloads contain both nested objects and dotted keys such as teamOne.total_score.
function applyPatch(match: MatchRecord, patch: Record<string, unknown>) {
  const data = match.toObject() as unknown as Record<string, unknown>;
  for (const [path, value] of Object.entries(patch)) {
    const parts = path.split('.');
    if (!mutableFields.has(parts[0]) || parts.some(part =>
      ['__proto__', 'prototype', 'constructor'].includes(part))) continue;
    let node = data;
    for (const part of parts.slice(0, -1)) {
      if (typeof node[part] !== 'object' || node[part] === null) node[part] = {};
      node = node[part] as Record<string, unknown>;
    }
    node[parts[parts.length - 1]] = value;
  }
  Object.assign(match, matchSchema.parse(data));
}

const Match = {
  async findById(id: string): Promise<MatchRecord | null> {
    const result = await getPool().query<MatchRow>(`${selectMatch} WHERE m.id = $1`, [id]);
    return result.rows[0] ? fromRow(result.rows[0]) : null;
  },

  async findByCode(code: string): Promise<MatchRecord | null> {
    const result = await getPool().query<MatchRow>(`${selectMatch} WHERE m.match_code = $1`, [code]);
    return result.rows[0] ? fromRow(result.rows[0]) : null;
  },

  async listForUser(userId: string, kind: 'created' | 'invited'): Promise<MatchRecord[]> {
    const filter = kind === 'created' ? 'm.created_by = $1' :
      `m.created_by <> $1 AND EXISTS (
        SELECT 1 FROM match_members WHERE match_id = m.id AND user_id = $1)`;
    const result = await getPool().query<MatchRow>(
      `${selectMatch} WHERE ${filter} ORDER BY m.created_at DESC`, [userId]
    );
    return result.rows.map(fromRow);
  },

  async create(input: unknown): Promise<MatchRecord> {
    const fields = matchSchema.parse(input);
    const id = randomUUID();
    const row = await withTransaction(async client => {
      const result = await client.query<MatchRow>(
        `INSERT INTO matches(id, match_code, created_by, status, start_time, venue, overs, is_private, scorecard)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb) RETURNING *`,
        [id, fields.matchCode, fields.createdBy, fields.status, fields.startTime,
          fields.venue, fields.overs, fields.isPrivate, JSON.stringify(scorecard(fields))]
      );
      await syncMembers(client, id, fields);
      return result.rows[0];
    });
    return fromRow({ ...row, admins: fields.admins, scorers: fields.scorers, viewers: fields.viewers });
  },

  async updateById(id: string, patch: Record<string, unknown>, expected?: MatchRecord) {
    const match = expected || await Match.findById(id);
    if (!match) return null;
    applyPatch(match, patch);
    return match.save();
  },

  async deleteById(id: string) {
    // Membership rows cascade; user match lists are derived, with no dangling arrays.
    await getPool().query('DELETE FROM matches WHERE id = $1', [id]);
  },

  async leave(id: string, userId: string) {
    await withTransaction(async client => {
      await client.query('SELECT id FROM matches WHERE id = $1 FOR UPDATE', [id]);
      await client.query('DELETE FROM match_members WHERE match_id = $1 AND user_id = $2', [id, userId]);
      // Invalidate snapshots held by scorers or users joining this match.
      await client.query('UPDATE matches SET version=version+1, updated_at=now() WHERE id=$1', [id]);
    });
  },
};

export default Match;
