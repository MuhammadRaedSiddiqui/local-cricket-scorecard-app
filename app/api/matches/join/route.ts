import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import Match, { MatchConflictError } from '@/models/Match';
import { verifyToken } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    // 1. Verify user is authenticated
    const user = await verifyToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { matchCode } = await request.json();

    if (!matchCode) {
      return NextResponse.json({ error: 'Match code is required' }, { status: 400 });
    }

    await connectDB();

    // 2. Find the match by its code
    const match = await Match.findByCode(matchCode.toUpperCase());

    if (!match) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 });
    }

    const userId = user.userId;

    // 3. Check if user is already part of the match
    const isCreator = match.createdBy === userId;
    const isAdmin = match.admins.includes(userId);
    const isScorer = match.scorers.includes(userId);
    const isViewer = match.viewers.includes(userId);

    if (isCreator || isAdmin || isScorer || isViewer) {
      return NextResponse.json(
        { error: 'You are already in this match', data: match },
        { status: 409 } // 409 Conflict
      );
    }

    // 4. Add user to the match's 'viewers' array
    match.viewers.push(userId);

    await match.save();

    return NextResponse.json({
      success: true,
      message: 'Successfully joined match!',
      data: match
    });

  } catch (error: any) {
    if (error instanceof MatchConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error('Join Match Error:', error);
    return NextResponse.json(
      { error: 'Failed to join match', message: error.message },
      { status: 500 }
    );
  }
}