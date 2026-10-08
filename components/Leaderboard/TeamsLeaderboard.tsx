'use client';

import { motion } from 'framer-motion';
import { Trophy } from 'lucide-react';
import { useState } from 'react';
import type { TeamStats } from '@/types/leaderboard';

interface TeamsLeaderboardProps {
  stats: TeamStats[];
}

// Rank Badge Component
const RankBadge = ({ rank }: { rank: number }) => {
  const getBadgeStyle = () => {
    switch (rank) {
      case 1:
        return 'bg-gradient-to-br from-yellow-400 via-yellow-500 to-amber-600';
      case 2:
        return 'bg-gradient-to-br from-slate-300 via-slate-400 to-slate-500';
      case 3:
        return 'bg-gradient-to-br from-orange-400 via-orange-500 to-orange-600';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <motion.div
      whileHover={{ scale: 1.1, rotate: 5 }}
      className={`flex items-center justify-center w-12 h-12 rounded-xl font-black ${rank > 3 ? 'text-gray-700' : 'text-white'
        } ${getBadgeStyle()}`}
    >
      {rank <= 3 && rank === 1 ? <Trophy className="w-5 h-5" /> : rank}
    </motion.div>
  );
};

export default function TeamsLeaderboard({ stats }: TeamsLeaderboardProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  if (stats.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-gray-400">
        <Trophy className="w-20 h-20 mb-4 opacity-20" />
        <p className="text-lg font-medium">No team statistics available</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Desktop View */}
      <div className="hidden lg:block">
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-200">
          <div className="grid grid-cols-8 gap-4 px-6 py-4 text-gray-500 text-xs font-semibold uppercase border-b border-gray-200">
            <div className="col-span-2">Team</div>
            <div className="text-center">Matches</div>
            <div className="text-center">Wins</div>
            <div className="text-center">Losses</div>
            <div className="text-center">Draws</div>
            <div className="text-center">Win %</div>
            <div className="text-center">Avg Score</div>
          </div>
          {stats.map((team, index) => (
            <motion.div
              key={team.name}
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1, type: 'spring' }}
              onHoverStart={() => setHoveredIndex(index)}
              onHoverEnd={() => setHoveredIndex(null)}
              className="relative"
            >
              <div
                className={`grid grid-cols-8 gap-4 px-6 py-5 items-center border-b border-gray-200/50 transition-all duration-300 ${hoveredIndex === index ? 'bg-green-50' : ''
                  }`}
              >
                <div className="col-span-2 flex items-center gap-4">
                  <RankBadge rank={index + 1} />
                  <div>
                    <div className="font-bold text-gray-900 text-lg">{team.name}</div>
                    <div className="text-sm text-gray-500">{team.matches} matches</div>
                  </div>
                </div>
                <div className="text-center text-gray-700">{team.matches}</div>
                <div className="text-center">
                  <div className="text-gray-900 font-bold">{team.wins}</div>
                </div>
                <div className="text-center text-gray-900 font-semibold">{team.losses}</div>
                <div className="text-center text-gray-500 font-semibold">{team.draws}</div>
                <div className="text-center">
                  <span className="text-gray-900 font-bold">{team.winRate.toFixed(1)}%</span>
                </div>
                <div className="text-center text-gray-900 font-semibold">{team.averageScore.toFixed(1)}</div>
              </div>
              {hoveredIndex === index && (
                <motion.div
                  layoutId="activeRowTeams"
                  className="absolute inset-0 border-l-4 border-green-500 pointer-events-none"
                  initial={false}
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                />
              )}
            </motion.div>
          ))}
        </div>
      </div>

      {/* Mobile & Tablet View */}
      <div className="lg:hidden space-y-4">
        {stats.map((team, index) => (
          <motion.div
            key={team.name}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            whileHover={{ scale: 1.02 }}
            className="relative overflow-hidden rounded-2xl bg-white border border-gray-200 shadow-xl"
          >
            <div className="relative p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-4">
                  <RankBadge rank={index + 1} />
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">{team.name}</h3>
                    <p className="text-sm text-gray-500">{team.matches} matches played</p>
                  </div>
                </div>
                <Trophy className="w-6 h-6 text-green-500" />
              </div>

              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="bg-gray-50 rounded-xl p-3 border border-gray-100 text-center">
                  <div className="text-xs text-gray-500 mb-1">Wins</div>
                  <div className="text-xl font-bold text-gray-900">{team.wins}</div>
                </div>
                <div className="bg-gray-50 rounded-xl p-3 border border-gray-100 text-center">
                  <div className="text-xs text-gray-500 mb-1">Losses</div>
                  <div className="text-xl font-bold text-gray-900">{team.losses}</div>
                </div>
                <div className="bg-gray-50 rounded-xl p-3 border border-gray-100 text-center">
                  <div className="text-xs text-gray-500 mb-1">Draws</div>
                  <div className="text-xl font-bold text-gray-700">{team.draws}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                  <div className="text-xs text-gray-500 mb-1">Win Rate</div>
                  <div className="text-lg font-bold text-gray-900">{team.winRate.toFixed(1)}%</div>
                </div>
                <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                  <div className="text-xs text-gray-500 mb-1">Avg Score</div>
                  <div className="text-lg font-bold text-gray-900">{team.averageScore.toFixed(1)}</div>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
