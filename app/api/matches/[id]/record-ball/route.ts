import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import Match, { IMatch, IPlayer, ITeam, IScoringState, IBall } from '@/models/Match';
import { verifyToken } from '@/lib/auth';
import { calculateBallOutcome } from '@/utils/scoringValidations';
import { pusherServer } from '@/lib/pusher';

interface Params {
  params: { id: string };
}

interface RecordBallRequest {
  outcome: string;
  extraRuns: number;
}

// --- (All your server-side helper functions remain the same) ---
// finalizeMatch(...)
// handleInningsCompletion(...)
// updatePlayerStats(...)
// --- (Paste those helper functions here) ---
function finalizeMatch(match: IMatch) {
  match.status = 'completed';
  const battingTeam = match.batting_team === match.teamOne.name ? match.teamOne : match.teamTwo;
  const bowlingTeam = match.bowling_team === match.teamOne.name ? match.teamOne : match.teamTwo;
  const target = match.target || 0;
  if (battingTeam.total_score >= target) {
    const wicketsLeft = (battingTeam.players.length || 10) - battingTeam.total_wickets;
    console.log(`[Server] ${battingTeam.name} won by ${wicketsLeft} wickets`);
  } else {
    const runDiff = target - 1 - battingTeam.total_score;
    console.log(`[Server] ${bowlingTeam.name} won by ${runDiff} runs`);
  }
  match.scoringState = null;
}

function handleInningsCompletion(match: IMatch) {
  if (match.currentInnings === 1) {
    console.log('[Server] First innings complete');
    const battingTeam = match.batting_team === match.teamOne.name ? match.teamOne : match.teamTwo;
    match.target = battingTeam.total_score + 1;
    const oldBattingTeam = match.batting_team;
    match.batting_team = match.bowling_team;
    match.bowling_team = oldBattingTeam;
    match.currentInnings = 2;
    match.scoringState = {
      selectedBatsman1: '',
      selectedBatsman2: '',
      selectedBowler: '',
      previousBowler: '',
      currentStriker: 'batsman1',
      currentOver: [],
      outBatsmen: [],
      currentInnings: 2,
      extraRuns: 0,
    };
  } else {
    console.log('[Server] Second innings complete. Finalizing match.');
    finalizeMatch(match);
  }
}

function updatePlayerStats(
  outcome: string, runs: number, isWicket: boolean, isExtra: boolean,
  ballCounts: boolean, extraRuns: number, strikerName: string, bowlerName: string,
  battingTeam: ITeam, bowlingTeam: ITeam
) {
  const batsman = battingTeam.players.find((p: IPlayer) => p.name === strikerName);
  if (batsman) {
    if (ballCounts) batsman.balls_played = (batsman.balls_played || 0) + 1;
    if (!isExtra) batsman.runs_scored = (batsman.runs_scored || 0) + runs;
    if (runs === 4) batsman.fours = (batsman.fours || 0) + 1;
    if (runs === 6) batsman.sixes = (batsman.sixes || 0) + 1;
    if (isWicket) batsman.is_out = true;
  }
  const bowler = bowlingTeam.players.find((p: IPlayer) => p.name === bowlerName);
  if (bowler) {
    if (ballCounts) bowler.balls_bowled = (bowler.balls_bowled || 0) + 1;
    if (!isExtra || outcome === 'NB') {
      bowler.runs_conceded = (bowler.runs_conceded || 0) + runs;
    } else if (outcome === 'WD') {
      bowler.runs_conceded = (bowler.runs_conceded || 0) + (runs - extraRuns);
    }
    if (isWicket) bowler.wickets = (bowler.wickets || 0) + 1;
  }
}
// --- END OF HELPER FUNCTIONS ---


export async function POST(request: NextRequest, { params }: Params) {
  const user = await verifyToken(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { outcome, extraRuns }: RecordBallRequest = await request.json();
  if (!outcome) {
    return NextResponse.json({ error: 'Invalid ball outcome' }, { status: 400 });
  }

  await connectDB();

  let updatedMatch: IMatch | null = null;
  let matchEnded = false;

  try {

      // 3. --- FETCH CURRENT STATE (Authoritative) ---
      const match = await Match.findById(params.id);
      if (!match) throw new Error('Match not found');

      const isAuthorized =
        match.scorers.some((id: any) => id.toString() === user.userId) ||
        match.admins.some((id: any) => id.toString() === user.userId) ||
        match.createdBy.toString() === user.userId;

      if (!isAuthorized) throw new Error('Not authorized to score this match');
      const currentStatus = match.status;
      if (currentStatus !== 'live') throw new Error('Match is not live');

      const state = match.scoringState;
      if (!state) throw new Error('Match has not been set up for scoring.');
      
      const battingTeamKey = match.batting_team === match.teamOne.name ? 'teamOne' : 'teamTwo';
      const bowlingTeamKey = match.bowling_team === match.teamOne.name ? 'teamOne' : 'teamTwo';
      const battingTeam = match[battingTeamKey];
      const bowlingTeam = match[bowlingTeamKey];

      // 4. --- CALCULATE NEW STATE (Server-Authoritative) ---
      const { runs, isWicket, isExtra, ballCounts, shouldRotateStrike } =
        calculateBallOutcome(outcome, extraRuns);

      const strikerName = state.currentStriker === 'batsman1' ? state.selectedBatsman1 : state.selectedBatsman2;
      const bowlerName = state.selectedBowler;

      // Update Team Totals
      battingTeam.total_score += runs;
      if (isExtra) battingTeam.extras += runs;
      if (ballCounts) battingTeam.total_balls += 1;

      // Update Player Stats
      updatePlayerStats(outcome, runs, isWicket, isExtra, ballCounts, extraRuns, strikerName, bowlerName, battingTeam, bowlingTeam);

      // This was the missing piece
      const newBall: IBall = {
        ballNumber: battingTeam.total_balls,
        overNumber: Math.floor((battingTeam.total_balls - (ballCounts ? 1 : 0)) / 6) + 1,
        innings: match.currentInnings, 
        batsman: strikerName,
        bowler: bowlerName,
        runs: runs,
        outcome: outcome,
        isExtra: isExtra,
        isWicket: isWicket,
        timestamp: new Date(),
      };
      
      match.ballHistory.push(newBall);

      // Update Scoring State
      state.currentOver.push(outcome);

      if (isWicket) {
        battingTeam.total_wickets += 1;
        state.outBatsmen.push(strikerName);
        if (state.currentStriker === 'batsman1') state.selectedBatsman1 = '';
        else state.selectedBatsman2 = '';
      } else if (shouldRotateStrike) {
        state.currentStriker = state.currentStriker === 'batsman1' ? 'batsman2' : 'batsman1';
      }

      // --- 5. CHECK FOR INNINGS/MATCH END CONDITIONS ---
      let inningsOver = false;

      // Condition 1: All Out
      if (battingTeam.total_wickets >= battingTeam.players.length - 1) {
        console.log('[Server] All Out!');
        inningsOver = true;
      }

      // Condition 2: Overs Completed
      const legalBalls = state.currentOver.filter(b => b !== 'WD' && b !== 'NB').length;
      if (legalBalls === 6) {
        state.previousBowler = state.selectedBowler;
        state.selectedBowler = '';
        state.currentOver = [];
        state.currentStriker = state.currentStriker === 'batsman1' ? 'batsman2' : 'batsman1';

        // Check if total balls for innings is complete
        // Note: We check >= just in case.
        if (battingTeam.total_balls >= match.overs * 6) {
          console.log('[Server] Overs complete!');
          inningsOver = true;
        }
      }
      
      // Condition 3: Target Reached (only check if not a wicket)
      if (!isWicket && match.currentInnings === 2 && battingTeam.total_score >= (match.target || 0)) {
        console.log('[Server] Target reached!');
        inningsOver = true;
      }

      // Handle Innings/Match End if any condition is met
      if (inningsOver) {
        handleInningsCompletion(match);
        if (match.status === 'completed') {
            matchEnded = true;
        }
      }
      
      // --- 6. SAVE ATOMICALLY ---
      
      updatedMatch = await match.save();

    // --- 7. TRIGGER REAL-TIME EVENT ---
    if (updatedMatch) {
      // (Your existing Pusher logic)
      const allParticipantIds = new Set([
        updatedMatch.createdBy.toString(),
        ...updatedMatch.admins.map((id: any) => id.toString()),
        ...updatedMatch.scorers.map((id: any) => id.toString()),
        ...updatedMatch.viewers.map((id: any) => id.toString()),
      ]);
      const payload = updatedMatch.toObject(); 
      const triggers = Array.from(allParticipantIds).map(userId => {
        const channelName = `private-user-${userId}`;
        const eventName = 'match-updated';
        return pusherServer.trigger(channelName, eventName, payload);
      });
      await Promise.allSettled(triggers);
    }

    // --- 8. RETURN NEW STATE ---
    return NextResponse.json({
      success: true,
      data: updatedMatch,
    });

  } catch (error: any) {
    if (error.name === 'MatchConflictError') {
      console.warn('[API] /record-ball MatchConflictError: A race condition occurred.');
      return NextResponse.json(
        { error: 'Conflict: Another scorer updated the match. Please refresh and try again.' },
        { status: 409 } // 409 Conflict
      );
    }
    
    console.error(`❌ [API] /record-ball Error: ${error.message}`);
    return NextResponse.json(
      { error: error.message || 'Failed to record ball' },
      { status: 500 }
    );
  }
}