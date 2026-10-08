import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import Match, { MatchConflictError } from '@/models/Match';
import { verifyToken } from '@/lib/auth';

interface Params {
  params: { id: string }
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const user = await verifyToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();
    
    const match = await Match.findById(params.id);
    
    if (!match) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 });
    }

    // Check if user is admin
    if (match.createdBy.toString() !== user.userId && !match.admins.map(id => id.toString()).includes(user.userId)) {
      return NextResponse.json({ error: 'Only match admin can start the match' }, { status: 403 });
    }

    // Update match status
    match.status = 'live';
    await match.save();

    return NextResponse.json({
      success: true,
      data: match
    });

  } catch (error) {
    if (error instanceof MatchConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error('Start match error:', error);
    return NextResponse.json(
      { error: 'Failed to start match' },
      { status: 500 }
    );
  }
}