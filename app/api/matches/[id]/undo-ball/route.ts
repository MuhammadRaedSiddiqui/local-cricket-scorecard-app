import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import Match, { IMatch, IPlayer, ITeam, IBall, MatchConflictError } from '@/models/Match';
import { verifyToken } from '@/lib/auth';
import { pusherServer } from '@/lib/pusher';

interface Params {
  params: Promise<{ id: string }>;
}

// Helper to convert balls to overs
const ballsToOvers = (balls: number): string => {
  const overs = Math.floor(balls / 6);
  const remainingBalls = balls % 6;
  return `${overs}.${remainingBalls}`;
};

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id: matchId } = await params;
    console.log('🔵 [UNDO] POST /api/matches/:id/undo-ball started');

    const user = await verifyToken(request);
    if (!user) {
      console.log('❌ [UNDO] Unauthorized');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();
    console.log('✅ [UNDO] Database connected');

    const match = await Match.findById(matchId);
    if (!match) {
      console.log('❌ [UNDO] Match not found');
      return NextResponse.json({ error: 'Match not found' }, { status: 404 });
    }

    // Check authorization
    const isAuthorized =
      match.scorers.some((id: any) => id.toString() === user.userId) ||
      match.admins.some((id: any) => id.toString() === user.userId) ||
      match.createdBy.toString() === user.userId;

    if (!isAuthorized) {
      console.log('❌ [UNDO] User not authorized');
      return NextResponse.json(
        { error: 'Not authorized to undo balls in this match' },
        { status: 403 }
      );
    }

    // Check if there are balls to undo
    if (!match.ballHistory || match.ballHistory.length === 0) {
      console.log('❌ [UNDO] No balls to undo');
      return NextResponse.json(
        { error: 'No balls to undo' },
        { status: 400 }
      );
    }

    // Get the last ball
    const lastBall: IBall = match.ballHistory[match.ballHistory.length - 1];
    console.log('📝 [UNDO] Last ball:', {
      outcome: lastBall.outcome,
      runs: lastBall.runs,
      isWicket: lastBall.isWicket,
      isExtra: lastBall.isExtra,
      batsman: lastBall.batsman,
      bowler: lastBall.bowler,
    });

    // Determine which team is batting
    const battingTeamKey = match.batting_team === match.teamOne.name ? 'teamOne' : 'teamTwo';
    const bowlingTeamKey = match.bowling_team === match.teamOne.name ? 'teamOne' : 'teamTwo';
    const battingTeam: ITeam = match[battingTeamKey];
    const bowlingTeam: ITeam = match[bowlingTeamKey];

    // Find the batsman and bowler
    const batsman = battingTeam.players.find((p: IPlayer) => p.name === lastBall.batsman);
    const bowler = bowlingTeam.players.find((p: IPlayer) => p.name === lastBall.bowler);

    if (!batsman || !bowler) {
      console.log('❌ [UNDO] Player not found');
      return NextResponse.json(
        { error: 'Player not found in teams' },
        { status: 400 }
      );
    }

    // Determine if ball counts toward over
    const ballCounts = lastBall.outcome !== 'WD' && lastBall.outcome !== 'NB';

    // Calculate what to subtract
    const runsToSubtract = lastBall.runs;
    const ballsToSubtract = ballCounts ? 1 : 0;

    // Calculate extras to subtract
    let extrasToSubtract = 0;
    if (lastBall.outcome === 'WD' || lastBall.outcome === 'B' || lastBall.outcome === 'LB') {
      extrasToSubtract = lastBall.runs;
    } else if (lastBall.outcome === 'NB') {
      extrasToSubtract = 1;
    }

    // Reverse batsman stats
    if (ballCounts) {
      batsman.balls_played = Math.max(0, (batsman.balls_played || 0) - 1);
    }

    // Reverse runs (for non-extras or NB with batsman runs)
    if (!lastBall.isExtra || lastBall.outcome === 'NB') {
      const batsmanRuns = lastBall.outcome === 'NB' 
        ? Math.max(0, lastBall.runs - 1) // NB: subtract batsman runs only
        : lastBall.runs;
      batsman.runs_scored = Math.max(0, (batsman.runs_scored || 0) - batsmanRuns);
    }

    // Reverse boundaries
    if (lastBall.runs === 4 && !lastBall.isExtra) {
      batsman.fours = Math.max(0, (batsman.fours || 0) - 1);
    }
    if (lastBall.runs === 6 && !lastBall.isExtra) {
      batsman.sixes = Math.max(0, (batsman.sixes || 0) - 1);
    }

    // Reverse wicket
    if (lastBall.isWicket) {
      batsman.is_out = false;
      bowler.wickets = Math.max(0, (bowler.wickets || 0) - 1);
      battingTeam.total_wickets = Math.max(0, battingTeam.total_wickets - 1);
    }

    // Reverse bowler stats
    if (ballCounts) {
      bowler.balls_bowled = Math.max(0, (bowler.balls_bowled || 0) - 1);
    }

    // Reverse bowler runs
    if (lastBall.outcome === 'NB' || lastBall.outcome === 'WD') {
      bowler.runs_conceded = Math.max(0, (bowler.runs_conceded || 0) - lastBall.runs);
    } else if (!lastBall.isExtra) {
      bowler.runs_conceded = Math.max(0, (bowler.runs_conceded || 0) - lastBall.runs);
    }

    // Reverse team totals
    battingTeam.total_score = Math.max(0, battingTeam.total_score - runsToSubtract);
    battingTeam.total_balls = Math.max(0, battingTeam.total_balls - ballsToSubtract);
    battingTeam.extras = Math.max(0, battingTeam.extras - extrasToSubtract);

    // Reverse scoringState
    if (match.scoringState) {
      const state = match.scoringState;

      // Remove last ball from currentOver
      if (state.currentOver && state.currentOver.length > 0) {
        state.currentOver = state.currentOver.slice(0, -1);
      }

      // If wicket, restore the batsman
      if (lastBall.isWicket && state.outBatsmen && state.outBatsmen.length > 0) {
        const restoredBatsman = state.outBatsmen.pop();
        
        // Restore to the correct slot
        if (!state.selectedBatsman1) {
          state.selectedBatsman1 = restoredBatsman || '';
        } else if (!state.selectedBatsman2) {
          state.selectedBatsman2 = restoredBatsman || '';
        }
      }

      // Note: We don't reverse strike rotation as it's complex and could be incorrect
      // User may need to manually adjust if needed
    }

    // Remove the last ball from history
    match.ballHistory = match.ballHistory.slice(0, -1);

    // Save the match
    await match.save();

    console.log('✅ [UNDO] Ball undone successfully');
    console.log('📊 [UNDO] Updated stats:', {
      teamScore: `${battingTeam.total_score}/${battingTeam.total_wickets}`,
      teamBalls: ballsToOvers(battingTeam.total_balls),
      batsmanStats: `${batsman.name}: ${batsman.runs_scored}(${batsman.balls_played})`,
      bowlerStats: `${bowler.name}: ${bowler.wickets}/${bowler.runs_conceded} (${ballsToOvers(bowler.balls_bowled || 0)})`,
    });

    // Trigger real-time update
    try {
      const allParticipantIds = new Set([
        match.createdBy.toString(),
        ...match.admins.map((id: any) => id.toString()),
        ...match.scorers.map((id: any) => id.toString()),
        ...match.viewers.map((id: any) => id.toString()),
      ]);

      const payload = match.toObject();
      const triggers = Array.from(allParticipantIds).map(userId => {
        const channelName = `private-user-${userId}`;
        const eventName = 'match-updated';
        return pusherServer.trigger(channelName, eventName, payload);
      });

      await Promise.allSettled(triggers);
      console.log(`[Pusher] Triggered undo updates for ${allParticipantIds.size} users`);
    } catch (pusherError) {
      console.error('Failed to trigger Pusher event:', pusherError);
    }

    return NextResponse.json({
      success: true,
      message: 'Last ball undone successfully',
      data: match,
    });

  } catch (error: any) {
    if (error instanceof MatchConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error(`❌ [UNDO] Error: ${error.message}`);
    if (error?.stack) console.error(error.stack);
    return NextResponse.json(
      { error: 'Failed to undo ball', details: error.message },
      { status: 500 }
    );
  }
}