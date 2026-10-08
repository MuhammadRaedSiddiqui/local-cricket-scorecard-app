import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import Match from '@/models/Match';
import { verifyToken } from '@/lib/auth';



// GET - Fetch user's matches
export async function GET(request: NextRequest) {
  try {
    const user = await verifyToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    // Matches created by user
    const createdMatches = await Match.listForUser(user.userId, 'created');

    // Matches where user is invited (admin, scorer, or viewer)
    const invitedMatches = await Match.listForUser(user.userId, 'invited');

    // Format matches for easier display
    const formatMatch = (match: any) => {
      // Calculate total balls from players if total_balls doesn't exist
      const calculateBalls = (team: any) => {
        if (team.total_balls !== undefined && team.total_balls !== null) {
          return team.total_balls;
        }
        // Sum up all players' balls_played
        return team.players?.reduce((total: number, player: any) => {
          return total + (player.balls_played || 0);
        }, 0) || 0;
      };

      const teamOneBalls = calculateBalls(match.teamOne);
      const teamTwoBalls = calculateBalls(match.teamTwo);

      return {
        ...match,
        _id: match._id.toString(),
        teamOne: {
          ...match.teamOne,
          total_balls: teamOneBalls,
          overs: `${Math.floor(teamOneBalls / 6)}.${teamOneBalls % 6}`
        },
        teamTwo: {
          ...match.teamTwo,
          total_balls: teamTwoBalls,
          overs: `${Math.floor(teamTwoBalls / 6)}.${teamTwoBalls % 6}`
        }
      };
    };

    return NextResponse.json({
      success: true,
      data: {
        created: createdMatches.map(formatMatch),
        invited: invitedMatches.map(formatMatch)
      }
    });
  } catch (error) {
    console.error('Fetch matches error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch matches' },
      { status: 500 }
    );
  }
}

// POST - Create new match
export async function POST(request: NextRequest) {
  try {
    const user = await verifyToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const matchData = await request.json();

    // Create match with generated code
    const match = await Match.create({
      ...matchData,
      createdBy: user.userId,
      admins: [user.userId],
      scorers: [user.userId],
      status: 'upcoming'
    });

    return NextResponse.json({
      success: true,
      data: match
    }, { status: 201 });

  } catch (error) {
    console.error('Create match error:', error);
    return NextResponse.json(
      { error: 'Failed to create match' },
      { status: 500 }
    );
  }
}

// DELETE - Delete a match by id (via query param)
export async function DELETE(request: NextRequest) {
  try {
    const user = await verifyToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Match id is required' }, { status: 400 });
    }

    await connectDB();

    const match = await Match.findById(id);
    if (!match) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 });
    }

    const isCreator = match.createdBy?.toString() === user.userId;
    const isAdmin = (match.admins || []).some((a: any) => a.toString() === user.userId);
    if (!isCreator && !isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await Match.deleteById(id);

    return NextResponse.json({ success: true, message: 'Match deleted' });
  } catch (error) {
    console.error('Delete match error:', error);
    return NextResponse.json({ error: 'Failed to delete match' }, { status: 500 });
  }
}