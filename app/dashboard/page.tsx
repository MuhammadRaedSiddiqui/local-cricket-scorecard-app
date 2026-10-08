'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/dashboard/Navbar'
import WelcomeBanner from '@/components/dashboard/WelcomeBanner'
import QuickActions from '@/components/dashboard/QuickActions'
import MyMatches from '@/components/dashboard/MyMatches'
import InvitedMatches from '@/components/dashboard/InvitedMatches'
import Footer from '@/components/dashboard/Footer'
import { Toaster } from 'react-hot-toast'
import toast from 'react-hot-toast'
import { pusherClient } from '@/lib/pusher-client'
import { DashboardSkeleton } from '@/components/dashboard/DashboardSkeleton'

// --- Interfaces (remain the same) ---
interface User {
  id: string;
  name: string;
  email: string;
}
interface MatchData {
  _id: string;
  matchCode: string;
  status: string;
  venue: string;
  startTime: string;
  overs: number;
  teamOne: {
    name: string;
    total_score: number;
    total_wickets: number;
    total_balls: number;
    overs: string;
  };
  teamTwo: {
    name: string;
    total_score: number;
    total_wickets: number;
    total_balls: number;
    overs: string;
  };
  isPrivate: boolean;
  createdAt: string;
  target?: number;
}
interface DashboardData {
  user: User | null;
  myMatches: MatchData[];
  invitedMatches: MatchData[];
  totalMatches: number;
  liveMatches: number;
}

// --- Main Component ---
export default function DashboardPage() {
  const router = useRouter()

  // --- 1. CONSOLIDATED STATE ---
  // We will use *only* this state object.
  const [data, setData] = useState<DashboardData>({
    user: null,
    myMatches: [],
    invitedMatches: [],
    totalMatches: 0,
    liveMatches: 0,
  });

  // These are now derived from the 'data' state
  const { user, myMatches, invitedMatches, totalMatches, liveMatches } = data;

  const [loading, setLoading] = useState(true);
  const [matchesLoading, setMatchesLoading] = useState(true);
  // --- End of State ---

  useEffect(() => {
    // Check if user is authenticated
    const checkAuth = () => {
      try {
        const token = localStorage.getItem('auth_token');
        const userData = localStorage.getItem('user');

        if (!token || !userData) {
          router.push('/login');
          return;
        }

        const parsedUser = JSON.parse(userData);
        if (parsedUser._id && !parsedUser.id) {
          parsedUser.id = parsedUser._id;
        }

        // --- 2. FIX: Set user in the *single* state object ---
        setData(prevData => ({ ...prevData, user: parsedUser }));
        setLoading(false);
      } catch (error) {
        console.error('Failed to load user data:', error);
        localStorage.clear();
        router.push('/login');
      }
    };

    checkAuth();
  }, [router]);

  // --- 3. FIX: This function now populates the single 'data' state ---
  const fetchMatches = useCallback(async () => {
    if (!user) return; // Guard against running before user is set

    try {
      setMatchesLoading(true);
      const token = localStorage.getItem('auth_token');

      const response = await fetch('/api/dashboard', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch dashboard data');
      }

      const responseData = await response.json();

      if (responseData.success) {
        setData(prevData => ({
          ...prevData,
          myMatches: responseData.data.myMatches || [],
          invitedMatches: responseData.data.invitedMatches || [],
          totalMatches: responseData.data.totalMatches,
          liveMatches: responseData.data.liveMatches,
        }));
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setMatchesLoading(false);
    }
  }, [user]); // Now only depends on 'user'

  // Initial fetch
  useEffect(() => {
    if (user) {
      fetchMatches();
    }
  }, [user, fetchMatches]);

  // --- 4. FIX: This function now correctly updates the 'data' state ---
  const updateMatchInState = useCallback((updatedMatchData: any) => {
    const formatOvers = (balls: number | undefined): string => {
      if (balls === undefined) return '0.0';
      return `${Math.floor(balls / 6)}.${balls % 6}`;
    };

    const updateMatchArray = (prevMatches: MatchData[]) =>
      prevMatches.map(match => {
        if (match._id === updatedMatchData.matchId) {
          console.log(`[Pusher] Updating local state for match: ${match.matchCode}`);
          return {
            ...match,
            status: updatedMatchData.status,
            teamOne: {
              ...match.teamOne,
              total_score: updatedMatchData.teamOne.total_score,
              total_wickets: updatedMatchData.teamOne.total_wickets,
              overs: formatOvers(updatedMatchData.teamOne.total_balls),
            },
            teamTwo: {
              ...match.teamTwo,
              total_score: updatedMatchData.teamTwo.total_score,
              total_wickets: updatedMatchData.teamTwo.total_wickets,
              overs: formatOvers(updatedMatchData.teamTwo.total_balls),
            },
          };
        }
        return match;
      });

    // This now correctly updates the single state object
    setData(prevData => ({
      ...prevData,
      myMatches: updateMatchArray(prevData.myMatches),
      invitedMatches: updateMatchArray(prevData.invitedMatches),
      // Also update live count
      liveMatches: (prevData.myMatches.filter(m => m.status === 'live').length +
        prevData.invitedMatches.filter(m => m.status === 'live').length)
    }));
  }, []);

  // --- 5. FIX: Pusher 'useEffect' now *only* calls updateMatchInState ---
  const userId = user?.id;
  useEffect(() => {
    if (!userId) return;
    const channelName = `private-user-${userId}`;

    let channel: any;

    channel = pusherClient.subscribe(channelName);
    const handleMatchUpdate = (data: any) => {
      updateMatchInState(data);
    };

    channel.bind('match-updated', handleMatchUpdate);



    // channel.bind('pusher:subscription_succeeded', () => {
    //   console.log(`[Pusher] Successfully subscribed to ${channelName}`);
    // });
    // channel.bind('pusher:subscription_error', (status: any) => {
    //   console.error(`[Pusher] Failed to subscribe to ${channelName}:`, status);
    // });

    // channel.bind('match-updated', (data: any) => {
    //   console.log('[Pusher] Received match-updated event:', data);
    //   toast('Match scores updated!', { icon: '🏏', duration: 2000 });

    //   // --- THIS IS THE FIX ---
    //   // Call our new function to update state locally
    //   updateMatchInState(data);
    //   // REMOVED: fetchMatches(); // This was causing the reload
    //   // --- END OF FIX ---
    // });


    return () => {
      if (channel) {
        channel.unbind('match-updated', handleMatchUpdate);
        pusherClient.unsubscribe(channelName);
      }
    };
  }, [userId, updateMatchInState]);

  const handleLogout = async () => {
    // ... (logic remains the same)
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user');
      pusherClient.disconnect();
      router.push('/login');
    }
  };

  if (loading) {
    return <DashboardSkeleton />;
  }

  if (!user) {
    return null;
  }



  return (
    <>
      <Toaster position="top-right" />
      <div className="min-h-screen bg-gradient-to-br from-green-50/30 via-white to-emerald-50/20 overflow-x-hidden">
        <Navbar user={user} onLogout={handleLogout} />

        <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 max-w-7xl">
          <WelcomeBanner
            userName={user.name}
            totalMatches={totalMatches}
            liveMatches={liveMatches}
            friendsPlaying={0}
          />
          <QuickActions />

          <MyMatches
            matches={myMatches}
            loading={matchesLoading}
            onRefresh={fetchMatches}
          />

          {/* --- 4. UNCOMMENTED THESE PROPS --- */}
          <InvitedMatches
            matches={invitedMatches}
            loading={matchesLoading}
            onRefresh={fetchMatches}
          />
        </main>

        <Footer />
      </div>
    </>
  );
}
