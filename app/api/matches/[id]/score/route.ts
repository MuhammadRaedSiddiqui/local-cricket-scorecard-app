import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import Match, { MatchConflictError } from '@/models/Match'
import { verifyToken } from '@/lib/auth'
import { pusherServer } from '@/lib/pusher';

interface Params {
  params: Promise<{ id: string }>
}

export async function POST(request: NextRequest, { params }: Params) {
  const startTime = Date.now()

  try {
    const { id: matchId } = await params;
    console.log('🔵 [API] POST /api/matches/:id/score started')

    const user = await verifyToken(request)
    if (!user) {
      console.log('❌ [API] Unauthorized')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await connectDB()
    console.log('✅ [API] Database connected')

    const existingMatch = await Match.findById(matchId)
    if (!existingMatch) {
      console.log('❌ [API] Match not found')
      return NextResponse.json({ error: 'Match not found' }, { status: 404 })
    }

    // Helper summarizers for concise diff logs
    const sumField = (arr: any[] = [], key: string) =>
      arr.reduce((a: number, p: any) => a + (Number(p?.[key]) || 0), 0)

    const summarizeTeam = (team: any) => {
      const players: any[] = Array.isArray(team?.players) ? team.players : []
      return {
        totals: {
          total_score: Number(team?.total_score) || 0,
          total_wickets: Number(team?.total_wickets) || 0,
          total_balls: Number(team?.total_balls) || 0,
        },
        players: {
          count: players.length,
          batting_runs: sumField(players, 'runs_scored'),
          batting_balls: sumField(players, 'balls_played'),
          fours: sumField(players, 'fours'),
          sixes: sumField(players, 'sixes'),
          outs: players.filter((p: any) => !!p?.is_out).length,
          bowling_balls: sumField(players, 'balls_bowled'),
          bowling_runs: sumField(players, 'runs_conceded'),
          bowling_wkts: sumField(players, 'wickets'),
          maidens: sumField(players, 'maidens'),
        },
      }
    }

    const beforeSummary = {
      root: {
        currentInnings: Number(existingMatch.currentInnings) || 0,
        batting_team: existingMatch.batting_team,
        bowling_team: existingMatch.bowling_team,
        target: Number(existingMatch.target) || 0,
        status: existingMatch.status,
      },
      teamOne: summarizeTeam(existingMatch.teamOne || {}),
      teamTwo: summarizeTeam(existingMatch.teamTwo || {}),
    }

    const isAuthorized =
      existingMatch.scorers.some((id: any) => id.toString() === user.userId) ||
      existingMatch.admins.some((id: any) => id.toString() === user.userId) ||
      existingMatch.createdBy.toString() === user.userId

    if (!isAuthorized) {
      console.log('❌ [API] User not authorized to score')
      return NextResponse.json(
        { error: 'Not authorized to score this match' },
        { status: 403 }
      )
    }

    // CHANGED: normalize body to support { match: {...} } and flat body
    const raw = await request.json()
    const body = raw?.match ?? raw


    const updateData: any = {}
    const before = {
      innings: existingMatch.currentInnings,
      bat: existingMatch.batting_team,
      bowl: existingMatch.bowling_team,
      target: existingMatch.target,
    }

    const isDefined = (v: any) => typeof v !== 'undefined'

    // Presence map for incoming payload
    const presenceMap = {
      totals: {
        t1: {
          score: isDefined(body['teamOne.total_score']),
          wickets: isDefined(body['teamOne.total_wickets']),
          balls: isDefined(body['teamOne.total_balls']),
        },
        t2: {
          score: isDefined(body['teamTwo.total_score']),
          wickets: isDefined(body['teamTwo.total_wickets']),
          balls: isDefined(body['teamTwo.total_balls']),
        },
      },
      players: {
        teamOne_nested: isDefined(body.teamOne?.players),
        teamTwo_nested: isDefined(body.teamTwo?.players),
        teamOne_flat: isDefined(body['teamOne.players']),
        teamTwo_flat: isDefined(body['teamTwo.players']),
      },
      scoringState: isDefined(body.scoringState),
      root: {
        batting_team: isDefined(body.batting_team),
        bowling_team: isDefined(body.bowling_team),
        currentInnings: isDefined(body.currentInnings),
        target: isDefined(body.target),
        status: isDefined(body.status),
      },
    }


    // Simple root fields
    if (isDefined(body.toss_winner)) updateData.toss_winner = body.toss_winner
    if (isDefined(body.toss_decision)) updateData.toss_decision = body.toss_decision
    if (isDefined(body.batting_team)) updateData.batting_team = body.batting_team
    if (isDefined(body.bowling_team)) updateData.bowling_team = body.bowling_team
    if (isDefined(body.status)) updateData.status = body.status
    // NEW: persist target at root
    if (isDefined(body.target)) updateData.target = body.target

    // NEW: normalize and persist currentInnings at root
    const normalizedInnings =
      (isDefined(body.currentInnings) ? body.currentInnings : undefined) ??
      (isDefined(body.scoringState?.currentInnings) ? body.scoringState.currentInnings : undefined) ??
      existingMatch.currentInnings

    updateData.currentInnings = normalizedInnings

    // Team score updates
    if (isDefined(body['teamOne.total_score'])) updateData['teamOne.total_score'] = body['teamOne.total_score']
    if (isDefined(body['teamOne.total_wickets'])) updateData['teamOne.total_wickets'] = body['teamOne.total_wickets']
    if (isDefined(body['teamOne.total_balls'])) updateData['teamOne.total_balls'] = body['teamOne.total_balls']
    if (isDefined(body['teamOne.extras'])) updateData['teamOne.extras'] = body['teamOne.extras']

    if (isDefined(body['teamTwo.total_score'])) updateData['teamTwo.total_score'] = body['teamTwo.total_score']
    if (isDefined(body['teamTwo.total_wickets'])) updateData['teamTwo.total_wickets'] = body['teamTwo.total_wickets']
    if (isDefined(body['teamTwo.total_balls'])) updateData['teamTwo.total_balls'] = body['teamTwo.total_balls']
    if (isDefined(body['teamTwo.extras'])) updateData['teamTwo.extras'] = body['teamTwo.extras']

    // Optional players - CRITICAL: Support nested and dotted scorecard fields
    if (isDefined(body.teamOne?.players)) {
      updateData['teamOne.players'] = body.teamOne.players
      console.log('📝 [API] Updating teamOne.players:', {
        count: body.teamOne.players.length,
        sample: body.teamOne.players.slice(0, 2).map((p: any) => ({
          name: p.name,
          runs_scored: p.runs_scored,
          balls_played: p.balls_played,
          wickets: p.wickets,
        })),
      })
    }
    if (isDefined(body.teamTwo?.players)) {
      updateData['teamTwo.players'] = body.teamTwo.players
      console.log('📝 [API] Updating teamTwo.players:', {
        count: body.teamTwo.players.length,
        sample: body.teamTwo.players.slice(0, 2).map((p: any) => ({
          name: p.name,
          runs_scored: p.runs_scored,
          balls_played: p.balls_played,
          wickets: p.wickets,
        })),
      })
    }

    // NEW: also accept flattened keys (to match how totals are handled)
    if (isDefined(body['teamOne.players'])) {
      updateData['teamOne.players'] = body['teamOne.players']
      console.log('📝 [API] Updating teamOne.players (flat key):', {
        count: body['teamOne.players'].length,
      })
    }
    if (isDefined(body['teamTwo.players'])) {
      updateData['teamTwo.players'] = body['teamTwo.players']
      console.log('📝 [API] Updating teamTwo.players (flat key):', {
        count: body['teamTwo.players'].length,
      })
    }

    // CHANGED: scoringState forced to use normalizedInnings
    if (isDefined(body.scoringState)) {
      updateData.scoringState = {
        ...body.scoringState,
        currentInnings: normalizedInnings,
      }
    }

    // Optional ballHistory passthrough
    if (isDefined(body.ballHistory)) {
      updateData.ballHistory = body.ballHistory
    }

    // NEW: defensive auto-swap teams on innings change if client forgot
    const inningsChangedTo2 = before.innings !== 2 && normalizedInnings === 2
    const noTeamsProvided = !isDefined(body.batting_team) && !isDefined(body.bowling_team)
    if (inningsChangedTo2 && noTeamsProvided) {
      updateData.batting_team = before.bowl
      updateData.bowling_team = before.bat
      console.log('🔄 [API] Auto-swapped teams for second innings:', {
        batting_team: updateData.batting_team,
        bowling_team: updateData.bowling_team,
      })
    }

    updateData.updatedAt = new Date()

    console.log('📝 [API] Update data (computed):', JSON.stringify(updateData, null, 2))

    const inningsSummary = {
      before,
      after: {
        innings: updateData.currentInnings,
        bat: updateData.batting_team ?? before.bat,
        bowl: updateData.bowling_team ?? before.bowl,
        target: updateData.target ?? before.target,
      },
    }


    const updatedMatch = await Match.updateById(matchId, updateData, existingMatch)

    if (!updatedMatch) {
      console.log('❌ [API] Failed to update match')
      return NextResponse.json(
        { error: 'Failed to update match' },
        { status: 500 }
      )
    }



    try {
      const allParticipantIds = new Set([
        updatedMatch.createdBy.toString(),
        ...updatedMatch.admins.map(id => id.toString()),
        ...updatedMatch.scorers.map(id => id.toString()),
        ...updatedMatch.viewers.map(id => id.toString()),
      ]);

      // --- THIS IS THE NEW, RICHER PAYLOAD ---
      // We are now sending the complete score details for both teams.
      const payload = {
        matchId: updatedMatch._id.toString(),
        idempotencyKey: crypto.randomUUID(), // Add this

        status: updatedMatch.status,
        teamOne: {
          total_score: updatedMatch.teamOne.total_score,
          total_wickets: updatedMatch.teamOne.total_wickets,
          total_balls: updatedMatch.teamOne.total_balls, // Send total balls
        },
        teamTwo: {
          total_score: updatedMatch.teamTwo.total_score,
          total_wickets: updatedMatch.teamTwo.total_wickets,
          total_balls: updatedMatch.teamTwo.total_balls, // Send total balls
        }
      };
      // --- END OF NEW PAYLOAD ---

      const triggers = Array.from(allParticipantIds).map(userId => {
        const channelName = `private-user-${userId}`;
        const eventName = 'match-updated';

        console.log(`[Pusher] Triggering event '${eventName}' on channel '${channelName}'`);

        // Send the new, richer payload
        return pusherServer.trigger(channelName, eventName, payload);
      });

      await Promise.allSettled(triggers); // Use allSettled
      console.log(`[Pusher] Successfully triggered events for ${allParticipantIds.size} users.`);

    } catch (pusherError) {
      console.error('Failed to trigger Pusher event:', pusherError);
    }


    // ✅ CRITICAL: Verify player stats were actually saved
    const verifyTeamOnePlayers = (updatedMatch.teamOne?.players || []).map((p: any) => ({
      name: p.name,
      runs_scored: p.runs_scored || 0,
      balls_played: p.balls_played || 0,
      fours: p.fours || 0,
      sixes: p.sixes || 0,
      wickets: p.wickets || 0,
      balls_bowled: p.balls_bowled || 0,
      runs_conceded: p.runs_conceded || 0,
      is_out: p.is_out || false,
    }))
    const verifyTeamTwoPlayers = (updatedMatch.teamTwo?.players || []).map((p: any) => ({
      name: p.name,
      runs_scored: p.runs_scored || 0,
      balls_played: p.balls_played || 0,
      fours: p.fours || 0,
      sixes: p.sixes || 0,
      wickets: p.wickets || 0,
      balls_bowled: p.balls_bowled || 0,
      runs_conceded: p.runs_conceded || 0,
      is_out: p.is_out || false,
    }))

    console.log('✅ [API] Match updated - verifying player stats:', JSON.stringify({
      teamOne: {
        players_count: updatedMatch.teamOne?.players?.length || 0,
        player_stats: verifyTeamOnePlayers,
      },
      teamTwo: {
        players_count: updatedMatch.teamTwo?.players?.length || 0,
        player_stats: verifyTeamTwoPlayers,
      },
    }, null, 2))

    // AFTER UPDATE: Summaries and change diagnostics
    const afterSummary = {
      root: {
        currentInnings: Number(updatedMatch.currentInnings) || 0,
        batting_team: updatedMatch.batting_team,
        bowling_team: updatedMatch.bowling_team,
        target: Number(updatedMatch.target) || 0,
        status: updatedMatch.status,
      },
      teamOne: summarizeTeam(updatedMatch.teamOne || {}),
      teamTwo: summarizeTeam(updatedMatch.teamTwo || {}),
    }

    const fieldChange = (from: any, to: any) => ({ from, to, changed: from !== to })

    const changeSummary = {
      root: {
        currentInnings: fieldChange(beforeSummary.root.currentInnings, afterSummary.root.currentInnings),
        batting_team: fieldChange(beforeSummary.root.batting_team, afterSummary.root.batting_team),
        bowling_team: fieldChange(beforeSummary.root.bowling_team, afterSummary.root.bowling_team),
        target: fieldChange(beforeSummary.root.target, afterSummary.root.target),
        status: fieldChange(beforeSummary.root.status, afterSummary.root.status),
      },
      teamOne: {
        totals: {
          total_score: fieldChange(beforeSummary.teamOne.totals.total_score, afterSummary.teamOne.totals.total_score),
          total_wickets: fieldChange(beforeSummary.teamOne.totals.total_wickets, afterSummary.teamOne.totals.total_wickets),
          total_balls: fieldChange(beforeSummary.teamOne.totals.total_balls, afterSummary.teamOne.totals.total_balls),
        },
        players: {
          count: fieldChange(beforeSummary.teamOne.players.count, afterSummary.teamOne.players.count),
          batting_runs: fieldChange(beforeSummary.teamOne.players.batting_runs, afterSummary.teamOne.players.batting_runs),
          batting_balls: fieldChange(beforeSummary.teamOne.players.batting_balls, afterSummary.teamOne.players.batting_balls),
          fours: fieldChange(beforeSummary.teamOne.players.fours, afterSummary.teamOne.players.fours),
          sixes: fieldChange(beforeSummary.teamOne.players.sixes, afterSummary.teamOne.players.sixes),
          outs: fieldChange(beforeSummary.teamOne.players.outs, afterSummary.teamOne.players.outs),
          bowling_balls: fieldChange(beforeSummary.teamOne.players.bowling_balls, afterSummary.teamOne.players.bowling_balls),
          bowling_runs: fieldChange(beforeSummary.teamOne.players.bowling_runs, afterSummary.teamOne.players.bowling_runs),
          bowling_wkts: fieldChange(beforeSummary.teamOne.players.bowling_wkts, afterSummary.teamOne.players.bowling_wkts),
          maidens: fieldChange(beforeSummary.teamOne.players.maidens, afterSummary.teamOne.players.maidens),
        },
      },
      teamTwo: {
        totals: {
          total_score: fieldChange(beforeSummary.teamTwo.totals.total_score, afterSummary.teamTwo.totals.total_score),
          total_wickets: fieldChange(beforeSummary.teamTwo.totals.total_wickets, afterSummary.teamTwo.totals.total_wickets),
          total_balls: fieldChange(beforeSummary.teamTwo.totals.total_balls, afterSummary.teamTwo.totals.total_balls),
        },
        players: {
          count: fieldChange(beforeSummary.teamTwo.players.count, afterSummary.teamTwo.players.count),
          batting_runs: fieldChange(beforeSummary.teamTwo.players.batting_runs, afterSummary.teamTwo.players.batting_runs),
          batting_balls: fieldChange(beforeSummary.teamTwo.players.batting_balls, afterSummary.teamTwo.players.batting_balls),
          fours: fieldChange(beforeSummary.teamTwo.players.fours, afterSummary.teamTwo.players.fours),
          sixes: fieldChange(beforeSummary.teamTwo.players.sixes, afterSummary.teamTwo.players.sixes),
          outs: fieldChange(beforeSummary.teamTwo.players.outs, afterSummary.teamTwo.players.outs),
          bowling_balls: fieldChange(beforeSummary.teamTwo.players.bowling_balls, afterSummary.teamTwo.players.bowling_balls),
          bowling_runs: fieldChange(beforeSummary.teamTwo.players.bowling_runs, afterSummary.teamTwo.players.bowling_runs),
          bowling_wkts: fieldChange(beforeSummary.teamTwo.players.bowling_wkts, afterSummary.teamTwo.players.bowling_wkts),
          maidens: fieldChange(beforeSummary.teamTwo.players.maidens, afterSummary.teamTwo.players.maidens),
        },
      },
    }


    // Warnings when totals changed but per-player aggregates did not
    const warnIfTotalsChangedButPlayersDidNot = (which: 'teamOne' | 'teamTwo') => {
      const b = (beforeSummary as any)[which]
      const a = (afterSummary as any)[which]
      const totalsChanged =
        b.totals.total_score !== a.totals.total_score ||
        b.totals.total_balls !== a.totals.total_balls ||
        b.totals.total_wickets !== a.totals.total_wickets
      const battingUnchanged = b.players.batting_runs === a.players.batting_runs && b.players.batting_balls === a.players.batting_balls
      const bowlingUnchanged = b.players.bowling_runs === a.players.bowling_runs && b.players.bowling_balls === a.players.bowling_balls
      if (totalsChanged && battingUnchanged && bowlingUnchanged) {
        console.warn(`⚠️ [API] ${which}: team totals changed but per-player aggregates did not. Did client send ${which}.players?`)
      }
    }
    warnIfTotalsChangedButPlayersDidNot('teamOne')
    warnIfTotalsChangedButPlayersDidNot('teamTwo')

    const duration = Date.now() - startTime
    console.log(`✅ [API] Match updated successfully in ${duration}ms`)
    const snapshot = {
      currentInnings: updatedMatch.currentInnings,
      batting_team: updatedMatch.batting_team,
      bowling_team: updatedMatch.bowling_team,
      target: updatedMatch.target,
      scoringState: updatedMatch.scoringState
        ? {
          currentInnings: updatedMatch.scoringState.currentInnings,
          selectedBatsman1: updatedMatch.scoringState.selectedBatsman1,
          selectedBatsman2: updatedMatch.scoringState.selectedBatsman2,
          selectedBowler: updatedMatch.scoringState.selectedBowler,
        }
        : null,
    }


    return NextResponse.json({
      success: true,
      data: updatedMatch,
    })
  } catch (error: any) {
    if (error instanceof MatchConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    const duration = Date.now() - startTime
    console.error(`❌ [API] Error after ${duration}ms: ${error?.message}`)
    if (error?.stack) console.error(error.stack)
    return NextResponse.json(
      { error: 'Failed to update match', details: error.message },
      { status: 500 }
    )
  }
}
