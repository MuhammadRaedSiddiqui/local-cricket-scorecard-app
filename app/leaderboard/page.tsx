
import { Suspense } from 'react';
import { getLeaderboard } from '@/lib/leaderboard';

export const dynamic = 'force-dynamic';
import LeaderboardTabs from '@/components/Leaderboard/LeaderboardTabs';
import { Metadata } from 'next';
import { ArrowUp10, BarChart3, Trophy } from 'lucide-react';
import { Card } from '@/components/ui/card';
import BackButton from '@/components/ui/BackButton';

export const metadata: Metadata = {
  title: 'Leaderboard - Local Cricket Scorecard',
  description: 'View top cricket players batting and bowling statistics',
};

async function getLeaderboardData() {
  try {
    return await getLeaderboard();
  } catch {
    console.error('Failed to load leaderboard');
    return { battingStats: [], bowlingStats: [], teamStats: [], totalMatches: 0 };
  }
}

function LoadingSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-gray-200 rounded-lg h-24"></div>
        ))}
      </div>
      <div className="bg-gray-200 rounded-xl h-96"></div>
    </div>
  );
}

export default async function LeaderboardPage() {
  const data = await getLeaderboardData();
  return (
    <>
    <BackButton />
    <div className="min-h-screen bg-gray-50 p-0 md:p-8 overflow-x-hidden">
      <div className="bg-gradient-to-r from-primary-500 to-accent-600 text-white py-6 md:mb-4 md:py-12 md:px-4">       
         <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl md:text-5xl font-bold mb-3 flex items-center justify-center md:justify-start gap-3">
          <Trophy className="h-10 w-10" /> Players Leaderboard
        </h1>
        <p className="text-primary-100 text-lg text-center md:text-start md:justify-start">
          Top 10 Cricket Players Performance Statistics
        </p>
      </div>
      </div>
      <div className="max-w-7xl px-1 py-8 md:px-4 md:py-8 -mt-6">
        <Suspense fallback={<LoadingSkeleton />}>
          <LeaderboardTabs
            battingStats={data.battingStats}
            bowlingStats={data.bowlingStats}
            teamStats={data.teamStats}
            totalMatches={data.totalMatches}
          />
        </Suspense>
      </div>
    </div>
    </>
  );
}
    // <div className="min-h-screen bg-gradient-to-br from-green-50/30 via-white to-emerald-50/20">      {/* Header */}
    //   <div className="bg-gradient-to-r from-primary-600 to-accent-600 text-white py-12 px-4">        <div className="max-w-6xl mx-auto">
    //     <h1 className="text-4xl md:text-5xl font-bold mb-3 flex items-center gap-3">
    //       <Trophy className="h-10 w-10" /> Players Leaderboard
    //     </h1>
    //     <p className="text-primary-100 text-lg">
    //        Top 10 Cricket Players Performance Statistics
    //     </p>
    //   </div>
    //   </div>

    //   {/* Content */}
    //   <div className="max-w-6xl mx-auto px-4 py-8 -mt-6">
    //     <Card className="p-4 md:p-8"> 
    //       <Suspense fallback={<LoadingSkeleton />}> 
    //         <LeaderboardTabs 
    //           battingStats={data.battingStats} 
    //           bowlingStats={data.bowlingStats} 
    //           teamStats={data.teamStats} 
    //           totalMatches={data.totalMatches} 
    //         /> 
    //       </Suspense> 
    //     </Card>

    //     {/* Footer Info */}
    //     <div className="mt-8 text-center">
    //       <p className="text-gray-600 text-sm flex items-center justify-center gap-4"> 
    //         <span className="flex items-center gap-1.5"><BarChart3 className="h-4 w-4" /> Stats updated every 60 seconds</span>
    //         <span className="flex items-center gap-1.5"><ArrowUp10 className="h-4 w-4" /> Top 10 players displayed</span>
    //       </p>
    //     </div>
    //   </div>
    // </div>
//   );
// } 