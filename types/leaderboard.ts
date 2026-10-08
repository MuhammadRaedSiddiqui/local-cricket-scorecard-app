// FILE: types/index.ts

// ... (your existing User, Player, Team, Match interfaces) ...

// --- ADD THESE NEW INTERFACES ---

export interface BattingStats {
  name: string;
  matches: number;
  innings: number;
  runs: number;
  average: number;
  strikeRate: number;
  fours: number;
  sixes: number;
  highScore: number;
}

export interface BowlingStats {
  name: string;
  matches: number;
  wickets: number;
  runs_conceded: number;
  maidens: number;
  overs: string;
  economy: number;
  average: number | null;
}

export interface TeamStats {
  name: string;
  matches: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
  totalRuns: number;
  averageScore: number;
  highestScore: number;
  totalWickets: number;
}

export interface LeaderboardData {
  battingStats: BattingStats[];
  bowlingStats: BowlingStats[];
  teamStats: TeamStats[];
  totalMatches: number;
}
