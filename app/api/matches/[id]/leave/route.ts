import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import Match from '@/models/Match';
import { verifyToken } from '@/lib/auth';

interface Params {
  params: { id: string };
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    // 1. Verify user is authenticated
    const user = await verifyToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();
    const userId = user.userId;
    const matchId = params.id;

    const match = await Match.findById(matchId);
    if (!match) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 });
    }

    // 2. Check if user is the creator
    // The creator cannot "leave" their own match, they must delete it.
    if (match.createdBy === userId) {
      return NextResponse.json(
        { error: 'As the match creator, you cannot leave. You must delete the match from the "My Matches" section.' },
        { status: 403 } // 403 Forbidden
      );
    }

    await Match.leave(matchId, userId);

    return NextResponse.json({
      success: true,
      message: 'You have successfully left the match.',
    });

  } catch (error: any) {
    console.error('Leave Match Error:', error);
    return NextResponse.json(
      { error: 'Failed to leave match', message: error.message },
      { status: 500 }
    );
  }
}