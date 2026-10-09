import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import Match, { MatchConflictError } from '@/models/Match'
import { verifyToken } from '@/lib/auth'

interface Params {
  params: Promise<{ id: string }>
}

// GET single match
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id: matchId } = await params;
    const user = await verifyToken(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await connectDB()

        const match = await Match.findById(matchId)

    if (!match) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 })
    }

    // ✅ Debug: Log player stats to verify they're being retrieved
    const teamOnePlayerStats = (match.teamOne?.players || []).map((p: any) => ({
      name: p.name,
      runs_scored: p.runs_scored,
      balls_played: p.balls_played,
      fours: p.fours,
      sixes: p.sixes,
      wickets: p.wickets,
      balls_bowled: p.balls_bowled,
      runs_conceded: p.runs_conceded,
      is_out: p.is_out,
    }))
    
    const teamTwoPlayerStats = (match.teamTwo?.players || []).map((p: any) => ({
      name: p.name,
      runs_scored: p.runs_scored,
      balls_played: p.balls_played,
      fours: p.fours,
      sixes: p.sixes,
      wickets: p.wickets,
      balls_bowled: p.balls_bowled,
      runs_conceded: p.runs_conceded,
      is_out: p.is_out,
    }))

    // console.log('📥 [GET] Fetched match from DB:', {
    //   id: match._id,
    //   tossWinner: match.toss_winner,
    //   battingTeam: match.batting_team,
    //   scoringState: match.scoringState,
    //   teamOne: {
    //     name: match.teamOne?.name,
    //     total_score: match.teamOne?.total_score,
    //     players_count: match.teamOne?.players?.length || 0,
    //     player_stats: teamOnePlayerStats,
    //   },
    //   teamTwo: {
    //     name: match.teamTwo?.name,
    //     total_score: match.teamTwo?.total_score,
    //     players_count: match.teamTwo?.players?.length || 0,
    //     player_stats: teamTwoPlayerStats,
    //   },
    // })

    // ✅ Ensure player arrays are properly included in response
    // Convert to plain object to ensure proper JSON serialization
    const matchData = {
      ...match.toObject(),
      teamOne: match.teamOne ? {
        ...match.teamOne,
        players: (match.teamOne.players || []).map((p: any) => ({
          ...p,
          runs_scored: p.runs_scored || 0,
          balls_played: p.balls_played || 0,
          fours: p.fours || 0,
          sixes: p.sixes || 0,
          wickets: p.wickets || 0,
          balls_bowled: p.balls_bowled || 0,
          runs_conceded: p.runs_conceded || 0,
          maidens: p.maidens || 0,
          dots: p.dots || 0,
          dot_balls: p.dot_balls || 0,
          is_out: p.is_out || false,
          is_captain: p.is_captain || false,
          is_keeper: p.is_keeper || false,
        })),
      } : match.teamOne,
      teamTwo: match.teamTwo ? {
        ...match.teamTwo,
        players: (match.teamTwo.players || []).map((p: any) => ({
          ...p,
          runs_scored: p.runs_scored || 0,
          balls_played: p.balls_played || 0,
          fours: p.fours || 0,
          sixes: p.sixes || 0,
          wickets: p.wickets || 0,
          balls_bowled: p.balls_bowled || 0,
          runs_conceded: p.runs_conceded || 0,
          maidens: p.maidens || 0,
          dots: p.dots || 0,
          dot_balls: p.dot_balls || 0,
          is_out: p.is_out || false,
          is_captain: p.is_captain || false,
          is_keeper: p.is_keeper || false,
        })),
      } : match.teamTwo,
    }

    // ✅ Return the FULL match object with properly serialized player stats
    return NextResponse.json({
      success: true,
      data: matchData,
    })
  } catch (error) {
    if (error instanceof MatchConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error('Get match error:', error)
    return NextResponse.json(
      { error: 'Failed to get match' },
      { status: 500 }
    )
  }
}

// PUT/PATCH - Update match (if needed)
export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const { id: matchId } = await params;
    const user = await verifyToken(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await connectDB()

    const body = await request.json()

    const existingMatch = await Match.findById(matchId)
    if (!existingMatch) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 })
    }
    const canEdit = existingMatch.createdBy === user.userId ||
      existingMatch.admins.includes(user.userId) || existingMatch.scorers.includes(user.userId)
    if (!canEdit) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const match = await Match.updateById(matchId, body, existingMatch)

    if (!match) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: match,
    })
  } catch (error) {
    if (error instanceof MatchConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error('Update match error:', error)
    return NextResponse.json(
      { error: 'Failed to update match' },
      { status: 500 }
    )
  }
}
