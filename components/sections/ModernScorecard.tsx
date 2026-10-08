import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft, 
  Share2, 
  Trophy,
  Calendar,
  MapPin,
  Users,
  TrendingUp,
  Target,
  Clock
} from 'lucide-react';

// Interfaces matching your existing types
export interface Player {
  name: string;
  runs_scored: number;
  balls_played: number;
  dots: number;
  fours: number;
  sixes: number;
  wickets: number;
  balls_bowled: number;
  runs_conceded: number;
  maidens: number;
  dot_balls: number;
  is_captain: boolean;
  is_keeper: boolean;
  is_out: boolean;
}

export interface Team {
  name: string;
  players: Player[];
  total_score: number;
  total_wickets: number;
  total_balls: number;
  extras: number;
}

export interface Ball {
  ballNumber: number;
  overNumber: number;
  innings: number;
  batsman: string;
  bowler: string;
  runs: number;
  outcome: string;
  isExtra: boolean;
  isWicket: boolean;
  timestamp: Date;
}

interface ScoreCardProps {
  match?: {
    _id?: string;
    matchCode?: string;
    status?: 'upcoming' | 'live' | 'completed';
    venue?: string;
    overs?: number;
    startTime?: string;
    teamOne?: Team;
    teamTwo?: Team;
    currentInnings?: number;
    batting_team?: string;
    bowling_team?: string;
    target?: number;
    toss_winner?: string;
    toss_decision?: string;
    ballHistory?: Ball[];
    viewers?: string[];
  };
  onBack?: () => void;
  onShare?: () => void;
}

// Helper function to calculate strike rate
const calculateStrikeRate = (runs: number, balls: number): number => {
  if (balls === 0) return 0;
  return (runs / balls) * 100;
};

// Helper function to calculate economy rate
const calculateEconomy = (runs: number, balls: number): number => {
  if (balls === 0) return 0;
  return (runs / balls) * 6;
};

// Helper function to convert balls to overs
const ballsToOvers = (balls: number): string => {
  const overs = Math.floor(balls / 6);
  const remainingBalls = balls % 6;
  return `${overs}.${remainingBalls}`;
};

// Batting Stats Table
const BattingTable = ({ players }: { players: Player[] }) => {
  if (!players || players.length === 0) {
    return <div className="text-center py-8 text-gray-500">No batting data available</div>;
  }

  // Filter players who have batted (either played balls or are out)
  const battedPlayers = players.filter(p => p.balls_played > 0 || p.is_out);

  if (battedPlayers.length === 0) {
    return <div className="text-center py-8 text-gray-500">No batting data available</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50">
            <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Batter</th>
            <th className="text-center py-3 px-2 text-xs font-semibold text-gray-600 uppercase">R</th>
            <th className="text-center py-3 px-2 text-xs font-semibold text-gray-600 uppercase">B</th>
            <th className="text-center py-3 px-2 text-xs font-semibold text-gray-600 uppercase">4s</th>
            <th className="text-center py-3 px-2 text-xs font-semibold text-gray-600 uppercase">6s</th>
            <th className="text-center py-3 px-2 text-xs font-semibold text-gray-600 uppercase">SR</th>
          </tr>
        </thead>
        <tbody>
          {battedPlayers.map((player, idx) => (
            <tr key={idx} className="border-b border-gray-100 hover:bg-green-50 transition-colors">
              <td className="py-3 px-4">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-900">{player.name}</span>
                  {player.is_captain && (
                    <span className="text-xs bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded">C</span>
                  )}
                  {player.is_keeper && (
                    <span className="text-xs bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded">WK</span>
                  )}
                </div>
                {player.is_out ? (
                  <div className="text-xs text-red-600 mt-0.5">out</div>
                ) : player.balls_played > 0 ? (
                  <div className="text-xs text-green-600 mt-0.5 font-medium">not out *</div>
                ) : null}
              </td>
              <td className="text-center py-3 px-2 font-bold text-gray-900">{player.runs_scored}</td>
              <td className="text-center py-3 px-2 text-gray-600">{player.balls_played}</td>
              <td className="text-center py-3 px-2 text-gray-700">{player.fours}</td>
              <td className="text-center py-3 px-2 text-gray-700">{player.sixes}</td>
              <td className="text-center py-3 px-2 text-gray-600">
                {calculateStrikeRate(player.runs_scored, player.balls_played).toFixed(1)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// Bowling Stats Table
const BowlingTable = ({ players }: { players: Player[] }) => {
  if (!players || players.length === 0) {
    return <div className="text-center py-8 text-gray-500">No bowling data available</div>;
  }

  // Filter players who have bowled
  const bowlers = players.filter(p => p.balls_bowled > 0);

  if (bowlers.length === 0) {
    return <div className="text-center py-8 text-gray-500">No bowling data available</div>;
  }

  return (
    <div className="overflow-x-auto mt-6">
      <h4 className="text-sm font-semibold text-gray-600 uppercase mb-3 px-4">Bowling</h4>
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50">
            <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Bowler</th>
            <th className="text-center py-3 px-2 text-xs font-semibold text-gray-600 uppercase">O</th>
            <th className="text-center py-3 px-2 text-xs font-semibold text-gray-600 uppercase">M</th>
            <th className="text-center py-3 px-2 text-xs font-semibold text-gray-600 uppercase">R</th>
            <th className="text-center py-3 px-2 text-xs font-semibold text-gray-600 uppercase">W</th>
            <th className="text-center py-3 px-2 text-xs font-semibold text-gray-600 uppercase">Econ</th>
          </tr>
        </thead>
        <tbody>
          {bowlers.map((bowler, idx) => (
            <tr key={idx} className="border-b border-gray-100 hover:bg-green-50 transition-colors">
              <td className="py-3 px-4 font-semibold text-gray-900">{bowler.name}</td>
              <td className="text-center py-3 px-2 text-gray-600">
                {ballsToOvers(bowler.balls_bowled)}
              </td>
              <td className="text-center py-3 px-2 text-gray-600">{bowler.maidens}</td>
              <td className="text-center py-3 px-2 text-gray-600">{bowler.runs_conceded}</td>
              <td className="text-center py-3 px-2 font-bold text-gray-900">{bowler.wickets}</td>
              <td className="text-center py-3 px-2 text-gray-600">
                {calculateEconomy(bowler.runs_conceded, bowler.balls_bowled).toFixed(2)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// Team Summary Component
const TeamSummary = ({ team }: { team: Team }) => {
  const topBatsmen = [...team.players]
    .filter(p => p.balls_played > 0)
    .sort((a, b) => b.runs_scored - a.runs_scored)
    .slice(0, 3);
  
  const topBowlers = [...team.players]
    .filter(p => p.balls_bowled > 0)
    .sort((a, b) => b.wickets - a.wickets)
    .slice(0, 2);

  return (
    <div className="space-y-6">
      {/* Top Batsmen */}
      {topBatsmen.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-600 uppercase mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Top Batsmen
          </h4>
          <div className="space-y-2">
            {topBatsmen.map((player, idx) => (
              <div key={idx} className="flex justify-between items-center py-3 px-4 bg-white border border-gray-200 rounded-lg hover:border-green-300 hover:shadow-sm transition-all">
                <div>
                  <div className="font-semibold text-gray-900">{player.name}</div>
                  <div className="text-xs text-gray-500">{player.balls_played} balls</div>
                </div>
                <div className="text-right">
                  <div className="text-xl font-bold text-gray-900">{player.runs_scored}</div>
                  <div className="text-xs text-gray-500">
                    SR: {calculateStrikeRate(player.runs_scored, player.balls_played).toFixed(1)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top Bowlers */}
      {topBowlers.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-600 uppercase mb-3 flex items-center gap-2">
            <Target className="w-4 h-4" />
            Top Bowlers
          </h4>
          <div className="space-y-2">
            {topBowlers.map((bowler, idx) => (
              <div key={idx} className="flex justify-between items-center py-3 px-4 bg-white border border-gray-200 rounded-lg hover:border-green-300 hover:shadow-sm transition-all">
                <div>
                  <div className="font-semibold text-gray-900">{bowler.name}</div>
                  <div className="text-xs text-gray-500">{ballsToOvers(bowler.balls_bowled)} overs</div>
                </div>
                <div className="text-right">
                  <div className="text-xl font-bold text-gray-900">
                    {bowler.wickets}/{bowler.runs_conceded}
                  </div>
                  <div className="text-xs text-gray-500">
                    Econ: {calculateEconomy(bowler.runs_conceded, bowler.balls_bowled).toFixed(2)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {topBatsmen.length === 0 && topBowlers.length === 0 && (
        <div className="text-center py-8 text-gray-500">No statistics available</div>
      )}
    </div>
  );
};

// Main Component
export default function ModernScorecard({ match, onBack, onShare }: ScoreCardProps) {
    console.log("match live data",match)
  const [mainTab, setMainTab] = useState<'summary' | 'scorecard'>('summary');
  const [scorecardTab, setScorecardTab] = useState<'team1' | 'team2'>('team1');

  // Show loading state if no match data
  if (!match || !match.teamOne || !match.teamTwo) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-green-600 border-r-transparent mb-4"></div>
          <p className="text-gray-600 text-lg font-medium">Loading scorecard...</p>
        </div>
      </div>
    );
  }

  const { teamOne, teamTwo } = match;

  ////typescript
// filepath: c:\Users\HP\OneDrive\Desktop\Cricket_App\Local_Cricket_Scorecard_App\components\sections\ModernScorecard.tsx
// ...existing code...

  const getMatchResult = () => {
    if (!match || match.status !== 'completed') return null

    const teamOneRuns = teamOne.total_score
    const teamTwoRuns = teamTwo.total_score

    // Chase logic – 2nd innings with a target
    if (match.target && match.currentInnings === 2) {
      const battingTeam =
        match.batting_team === teamOne.name ? teamOne : teamTwo
      const bowlingTeam =
        match.bowling_team === teamOne.name ? teamOne : teamTwo

      const target = match.target
      const chasingScore = battingTeam.total_score

      // In your app, target appears to be "runs to win + 1"
      // so tie when chasingScore === target - 1
      if (chasingScore === target - 1) {
        return 'Match Tied'
      }

      // Chasing side wins
      if (chasingScore >= target) {
        const wicketsLeft = 10 - battingTeam.total_wickets
        return `${match.batting_team} won by ${wicketsLeft} wicket${
          wicketsLeft === 1 ? '' : 's'
        }`
      }

      // Bowling side wins
      const runsDiff = target - 1 - chasingScore
      return `${match.bowling_team} won by ${runsDiff} run${
        runsDiff === 1 ? '' : 's'
      }`
    }

    // Non‑chase / both innings completed
    if (teamOneRuns === teamTwoRuns) {
      return 'Match Tied'
    }

    if (teamOneRuns > teamTwoRuns) {
      const diff = teamOneRuns - teamTwoRuns
      return `${teamOne.name} won by ${diff} run${diff === 1 ? '' : 's'}`
    } else {
      const diff = teamTwoRuns - teamOneRuns
      return `${teamTwo.name} won by ${diff} run${diff === 1 ? '' : 's'}`
    }
  }

// ...existing code...

  const handleShare = () => {
    const result = getMatchResult();
    const shareText = `CrickLive Match Scorecard\n\n${match.teamOne?.name} vs ${match.teamTwo?.name}\n${result}\n\nMatch Code: ${match.matchCode}`;
    
    if (onShare) {
      onShare();
    } else if (navigator.share) {
      navigator.share({
        title: 'Cricket Match Scorecard',
        text: shareText,
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(shareText);
    }
  };

  const result = getMatchResult();

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-50 md:p-8">
      {/* Header Bar */}
      {/* <div className="max-w-5xl mx-auto mb-6">
        <div className="flex items-center justify-between">
          <button 
            onClick={onBack}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="font-medium">Back</span>
          </button>
          <button 
            onClick={handleShare}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors shadow-md"
          >
            <Share2 className="w-4 h-4" />
            <span className="hidden sm:inline">Share</span>
          </button>
        </div>
      </div> */}

      {/* Main Scorecard Card */}
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-200"
        >
          {/* Match Header */}
          <div className="p-6 md:p-8 bg-gray-50">
            <div className="flex px-4 flex-row items-center justify-between gap-6">
              {/* Team 1 */}
              <div className="flex flex-col items-center md:items-start flex-1">
                <h2 className="text-xl md:text-3xl font-bold text-gray-900">
                  {match.teamOne.name}
                </h2>
                <div className="text-2xl md:text-4xl font-black text-gray-900 md:mt-2">
                  {match.teamOne.total_score}/{match.teamOne.total_wickets}
                </div>
                <div className="text-sm text-gray-500 md:mt-1">
                  ({ballsToOvers(match.teamOne.total_balls)} overs)
                </div>
              </div>

              {/* VS Divider */}
              <div className="flex items-center justify-center">
                <div className="text-xl md:text-2xl font-semibold text-gray-400 md:px-4">vs</div>
              </div>

              {/* Team 2 */}
              <div className="flex flex-col items-center md:items-end flex-1">
                <h2 className="text-xl md:text-3xl font-bold text-gray-900">
                  {match.teamTwo.name}
                </h2>
                <div className="text-2xl md:text-4xl font-black text-gray-900 md:mt-2">
                  {match.teamTwo.total_score}/{match.teamTwo.total_wickets}
                </div>
                <div className="text-sm text-gray-500 md:mt-1">
                  ({ballsToOvers(match.teamTwo.total_balls)} overs)
                </div>
              </div>
            </div>
          </div>

          {/* Match Result Banner */}
          {match.status === 'completed' && result && (
            <div className="bg-gradient-to-r from-green-600 to-emerald-600 px-6 md:px-8 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Trophy className="w-5 h-5 text-white" />
                  <div>
                    <p className="text-white font-bold text-lg">{result}</p>
                    <p className="text-green-100 text-sm">Match Completed</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Main Navigation Tabs */}
          <div className="border-b border-gray-200 bg-white">
            <div className="flex">
              <button
                onClick={() => setMainTab('summary')}
                className={`flex-1 px-6 py-4 font-semibold transition-all ${
                  mainTab === 'summary'
                    ? 'text-green-600 border-b-2 border-green-600 bg-green-50'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                Summary
              </button>
              <button
                onClick={() => setMainTab('scorecard')}
                className={`flex-1 px-6 py-4 font-semibold transition-all ${
                  mainTab === 'scorecard'
                    ? 'text-green-600 border-b-2 border-green-600 bg-green-50'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                Scorecard
              </button>
            </div>
          </div>

          {/* Tab Content */}
          <AnimatePresence mode="wait">
            {mainTab === 'summary' && (
              <motion.div
                key="summary"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="p-6 md:p-8 bg-gray-50"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 mb-4">
                      {match.teamOne.name}
                    </h3>
                    <TeamSummary team={match.teamOne} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 mb-4">
                      {match.teamTwo.name}
                    </h3>
                    <TeamSummary team={match.teamTwo} />
                  </div>
                </div>
              </motion.div>
            )}

            {mainTab === 'scorecard' && (
              <motion.div
                key="scorecard"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
              >
                {/* Nested Tabs for Teams */}
                <div className="border-b border-gray-200 bg-gray-50">
                  <div className="flex px-6">
                    <button
                      onClick={() => setScorecardTab('team1')}
                      className={`px-6 py-3 font-semibold transition-all text-sm ${
                        scorecardTab === 'team1'
                          ? 'text-green-600 border-b-2 border-green-600'
                          : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      {match.teamOne.name}
                    </button>
                    <button
                      onClick={() => setScorecardTab('team2')}
                      className={`px-6 py-3 font-semibold transition-all text-sm ${
                        scorecardTab === 'team2'
                          ? 'text-green-600 border-b-2 border-green-600'
                          : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      {match.teamTwo.name}
                    </button>
                  </div>
                </div>

                <div className="p-2 md:p-6 bg-white">
                  <AnimatePresence mode="wait">
                    {scorecardTab === 'team1' ? (
                      <motion.div
                        key="team1-scorecard"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                      >
                        <BattingTable players={match.teamOne.players} />
                        <BowlingTable players={match.teamTwo.players} />
                      </motion.div>
                    ) : (
                      <motion.div
                        key="team2-scorecard"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                      >
                        <BattingTable players={match.teamTwo.players} />
                        <BowlingTable players={match.teamOne.players} />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Footer - Match Details */}
          <div className="bg-gray-100 px-6 md:px-8 py-4 border-t border-gray-200">
            <div className="flex flex-wrap gap-6 text-sm text-gray-600">
              {match.toss_winner && (
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  <span>
                    <strong className="text-gray-900">Toss:</strong> {match.toss_winner} won and chose to {match.toss_decision}
                  </span>
                </div>
              )}
              {match.venue && (
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  <span><strong className="text-gray-900">Venue:</strong> {match.venue}</span>
                </div>
              )}
              {match.startTime && (
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  <span>
                    {new Date(match.startTime).toLocaleDateString('en-US', { 
                      month: 'short', 
                      day: 'numeric', 
                      year: 'numeric' 
                    })}
                  </span>
                </div>
              )}
              {match.overs && (
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  <span>{match.overs} Overs Match</span>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
