import { getPool } from './db';
import type { LeaderboardData } from '@/types/leaderboard';

// PostgreSQL aggregates the same completed-match statistics previously computed
// by the MongoDB pipeline. Nested players stay in JSONB scorecards.
export async function getLeaderboard() {
  const result = await getPool().query<{ data: LeaderboardData }>(`
    WITH completed AS (
      SELECT scorecard FROM matches WHERE status = 'completed'
    ), teams AS (
      SELECT t.team->>'name' AS name,
        (t.team->>'total_score')::numeric AS score,
        (t.team->>'total_wickets')::numeric AS wickets,
        (t.opponent->>'total_score')::numeric AS opponent_score
      FROM completed c CROSS JOIN LATERAL (
        VALUES (c.scorecard->'teamOne', c.scorecard->'teamTwo'),
               (c.scorecard->'teamTwo', c.scorecard->'teamOne')
      ) AS t(team, opponent)
    ), players AS (
      SELECT p.player
      FROM completed c CROSS JOIN LATERAL jsonb_array_elements(
        (c.scorecard->'teamOne'->'players') || (c.scorecard->'teamTwo'->'players')
      ) AS p(player)
    ), team_totals AS (
      SELECT name, count(*) AS matches,
        count(*) FILTER (WHERE score > opponent_score) AS wins,
        count(*) FILTER (WHERE score < opponent_score) AS losses,
        count(*) FILTER (WHERE score = opponent_score) AS draws,
        sum(score) AS runs, sum(wickets) AS wickets, max(score) AS highest
      FROM teams GROUP BY name
    ), batting AS (
      SELECT player->>'name' AS name, count(*) AS innings,
        sum((player->>'runs_scored')::numeric) AS runs,
        sum((player->>'balls_played')::numeric) AS balls,
        sum((player->>'fours')::numeric) AS fours,
        sum((player->>'sixes')::numeric) AS sixes,
        max((player->>'runs_scored')::numeric) AS highest,
        count(*) FILTER (WHERE (player->>'is_out')::boolean) AS outs
      FROM players WHERE (player->>'balls_played')::numeric > 0
      GROUP BY player->>'name'
    ), bowling AS (
      SELECT player->>'name' AS name, count(*) AS matches,
        sum((player->>'wickets')::numeric) AS wickets,
        sum((player->>'runs_conceded')::numeric) AS runs,
        sum((player->>'balls_bowled')::integer) AS balls,
        sum((player->>'maidens')::numeric) AS maidens
      FROM players WHERE (player->>'balls_bowled')::numeric > 0
      GROUP BY player->>'name'
    )
    SELECT jsonb_build_object(
      'totalMatches', (SELECT count(*) FROM completed),
      'teamStats', COALESCE((
        SELECT jsonb_agg(value ORDER BY wins DESC, rate DESC, name) FROM (
          SELECT name, wins, round(wins * 100.0 / matches, 0) AS rate,
            jsonb_build_object(
              'name', name, 'matches', matches, 'wins', wins, 'losses', losses, 'draws', draws,
              'winRate', round(wins * 100.0 / matches, 0), 'totalRuns', runs,
              'totalWickets', wickets, 'highestScore', highest, 'averageScore', round(runs / matches, 0)
            ) AS value FROM team_totals ORDER BY wins DESC, rate DESC, name LIMIT 10
        ) t
      ), '[]'::jsonb),
      'battingStats', COALESCE((
        SELECT jsonb_agg(value ORDER BY runs DESC, name) FROM (
          SELECT name, runs, jsonb_build_object(
            'name', name, 'matches', innings, 'innings', innings, 'runs', runs,
            'fours', fours, 'sixes', sixes, 'highScore', highest,
            'average', round(CASE WHEN outs = 0 THEN runs ELSE runs / outs END, 2),
            'strikeRate', round(runs * 100 / balls, 2)
          ) AS value FROM batting ORDER BY runs DESC, name LIMIT 10
        ) b
      ), '[]'::jsonb),
      'bowlingStats', COALESCE((
        SELECT jsonb_agg(value ORDER BY wickets DESC, name) FROM (
          SELECT name, wickets, jsonb_build_object(
            'name', name, 'matches', matches, 'wickets', wickets,
            'runs_conceded', runs, 'maidens', maidens,
            'overs', (balls / 6)::text || '.' || (balls % 6)::text,
            'economy', round(runs * 6 / balls, 2),
            'average', round(runs / NULLIF(wickets, 0), 2)
          ) AS value FROM bowling ORDER BY wickets DESC, name LIMIT 10
        ) w
      ), '[]'::jsonb)
    ) AS data
  `);
  return result.rows[0].data;
}
