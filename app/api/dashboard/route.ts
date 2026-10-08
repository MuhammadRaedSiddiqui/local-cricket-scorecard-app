import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import Match from '@/models/Match';
import { verifyToken } from '@/lib/auth';

// Helper function (same as in your /api/matches route)
const formatMatch = (match: any) => {
  const calculateBalls = (team: any) => team.players?.reduce((total: number, player: any) => total + (player.balls_played || 0), 0) || 0;
  const teamOneBalls = match.teamOne.total_balls ?? calculateBalls(match.teamOne);
  const teamTwoBalls = match.teamTwo.total_balls ?? calculateBalls(match.teamTwo);

  return {
    ...match,
    _id: match._id.toString(),
    teamOne: {
      name: match.teamOne.name,
      total_score: match.teamOne.total_score,
      total_wickets: match.teamOne.total_wickets,
      overs: `${Math.floor(teamOneBalls / 6)}.${teamOneBalls % 6}`
    },
    teamTwo: {
      name: match.teamTwo.name,
      total_score: match.teamTwo.total_score,
      total_wickets: match.teamTwo.total_wickets,
      overs: `${Math.floor(teamTwoBalls / 6)}.${teamTwoBalls % 6}`
    },
    startTime: match.startTime.toISOString(),
    createdAt: match.createdAt.toISOString(),
  };
};


export async function GET(request: NextRequest) {
  try {
    const user = await verifyToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();
    const userId = user.userId;

    // 1. Fetch user's matches (created and invited)
    const [createdMatchesRaw, invitedMatchesRaw] = await Promise.all([
      Match.listForUser(userId, 'created'),
      Match.listForUser(userId, 'invited')
    ]);

    // 2. Format them
    const myMatches = createdMatchesRaw.map(formatMatch);
    const invitedMatches = invitedMatchesRaw.map(formatMatch);

    // 3. Calculate stats
    // We can just use the arrays we already fetched
    const allMatches = [...myMatches, ...invitedMatches];
    const totalMatches = allMatches.length;
    const liveMatches = allMatches.filter(match => match.status === 'live').length;

    return NextResponse.json({
      success: true,
      data: {
        myMatches,
        invitedMatches,
        totalMatches,
        liveMatches,
      }
    });

  } catch (error) {
    console.error('Fetch dashboard data error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard data' },
      { status: 500 }
    );
  }
}