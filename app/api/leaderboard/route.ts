import { NextResponse } from 'next/server';
import { getLeaderboard } from '@/lib/leaderboard';

// Query at request time, rather than opening database connections during builds.
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return NextResponse.json(await getLeaderboard());
  } catch {
    console.error('Leaderboard query failed');
    return NextResponse.json({ error: 'Failed to fetch leaderboard data' }, { status: 500 });
  }
}
