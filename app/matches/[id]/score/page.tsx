'use client'

import { useEffect, Fragment } from 'react'; // Import Fragment
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Circle } from 'lucide-react';
import { Toaster } from 'react-hot-toast';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TossForm } from './components/TossForm';
import { PlayerSelectionForm } from './components/PlayerSelectionForm';
import { ScoringControls } from './components/ScoringControls';
import { BatsmanChangeForm } from './components/BatsmanSelectionForm';
import { BowlerSelection } from './components/BowlerSelection';


import { useMatchScoring, initialScoringState } from '@/hooks/useMatchScoring';
import { Match, Player } from '@/types/match'; // Import types
import type { ScoringState as IScoringState } from '@/types/match';
import CompactMatchStatus from './components/CompactMatchStatus';

type MatchState = 'LOADING' | 'TOSS' | 'SCORING' | 'ERROR';

export default function ScoringPage() {
  const params = useParams();
  const router = useRouter();
  const matchId = params.id as string;

  const {
    match,
    loading,
    isSubmitting,
    scoringState,
    dispatch,
    battingTeam,
    bowlingTeam,
    fetchMatch,
    recordBall,
    saveFullState,
    isStateRestored,
    undoLastBall,
    canUndo,
    isUndoing,
  } = useMatchScoring(matchId);

  // Initial fetch
  useEffect(() => {
    if (matchId && !isStateRestored) { // Only fetch if not restored
      fetchMatch();
    }
  }, [matchId, fetchMatch, isStateRestored]);

  // --- 1. SIMPLIFIED getMatchState ---
  const getMatchState = (): MatchState => {
    if (loading || !isStateRestored) return 'LOADING';
    if (!match) return 'ERROR';
    if (!match.toss_winner || !match.batting_team) return 'TOSS';
    return 'SCORING'; // If toss is done, we are in a scoring state
  };

  const state = getMatchState();

  // --- 2. SERVER-DRIVEN UI ACTIONS ---
  // These functions call the 'saveFullState' from the hook,
  // which uses the old, simple API route. This is fine for one-off events.
  const handleTossComplete = async (winner: string, decision: 'bat' | 'bowl') => {
    if (!match) return;
    const battingTeam = decision === 'bat' ? winner : (winner === match.teamOne.name ? match.teamTwo.name : match.teamOne.name);
    const bowlingTeam = battingTeam === match.teamOne.name ? match.teamTwo.name : match.teamOne.name;

    await saveFullState({
      toss_winner: winner,
      toss_decision: decision,
      batting_team: battingTeam,
      bowling_team: bowlingTeam,
      status: 'live',
      currentInnings: 1,
      // Reset scoring state
      scoringState: { ...initialScoringState, currentInnings: 1 } as IScoringState
    });
  };

  const handlePlayersSelected = async (batsman1: string, batsman2: string, bowler: string) => {
    await saveFullState({
      scoringState: {
        ...scoringState,
        selectedBatsman1: batsman1,
        selectedBatsman2: batsman2,
        selectedBowler: bowler,
        currentStriker: 'batsman1',
        currentOver: [],
        outBatsmen: [], // Reset on first selection
        previousBowler: '',
      },
    } as Partial<Match>);
  };

  const handleBatsmanChange = async (newBatsman: string) => {
    if (!scoringState) return;
    const { currentStriker, selectedBatsman1, selectedBatsman2 } = scoringState;
    // Fill the empty slot
    const newB1 = selectedBatsman1 === '' ? newBatsman : selectedBatsman1;
    const newB2 = selectedBatsman2 === '' ? newBatsman : selectedBatsman2;

    await saveFullState({
      scoringState: { ...scoringState, selectedBatsman1: newB1, selectedBatsman2: newB2 },
    } as Partial<Match>);
  };

  const handleBowlerChange = async (newBowler: string) => {
    if (!scoringState) return;
    await saveFullState({
      scoringState: {
        ...scoringState,
        selectedBowler: newBowler,
        // previousBowler & currentOver were already set by the reducer/API
      },
    } as Partial<Match>);
  };


  // --- 3. ROBUST RENDER LOGIC ---

  // These booleans determine which sub-component to show *within* the SCORING state
  const stateExists = state === 'SCORING' && scoringState;

  // Start of innings: No batsmen selected AND no one is out.
  const needsFirstPlayerSelection =
    stateExists &&
    !scoringState.selectedBatsman1 &&
    !scoringState.selectedBatsman2 &&
    scoringState.outBatsmen.length === 0;

  // Wicket fell: One of the batsman slots is empty, AND it's not the start of the innings.
  const needsBatsmanChange =
    stateExists &&
    (!scoringState.selectedBatsman1 || !scoringState.selectedBatsman2) &&
    !needsFirstPlayerSelection;

  // Over ended: Batsman slots are full, but the bowler slot is empty.
  const needsBowlerChange =
    stateExists &&
    !needsFirstPlayerSelection &&
    !needsBatsmanChange &&
    !scoringState.selectedBowler;

  // Ready to score: All slots are full.
  const showScoringControls =
    stateExists &&
    !needsFirstPlayerSelection &&
    !needsBatsmanChange &&
    !needsBowlerChange;

  const getAvailableBatsmen = (): Player[] => {
    if (!battingTeam || !scoringState) return [];
    return battingTeam.players.filter((p: Player) => {
      if (scoringState.outBatsmen.includes(p.name)) return false;
      if (p.name === scoringState.selectedBatsman1) return false;
      if (p.name === scoringState.selectedBatsman2) return false;
      return true;
    });
  };

  const { selectedBatsman1, selectedBatsman2, selectedBowler, previousBowler, currentInnings, currentOver, currentStriker } = scoringState

  // --- RENDER ---

  if (state === 'LOADING') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="h-12 w-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading scoring...</p>
        </div>
      </div>
    );
  }

  if (state === 'ERROR' || !match) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="p-6 max-w-md">
          <h2 className="text-xl font-bold text-red-600 mb-4">Error</h2>
          <p className="text-gray-700 mb-4">Could not load match data. Please try again.</p>
          <Button onClick={() => router.push('/dashboard')} className="w-full">
            Back to Dashboard
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <>
      <Toaster position="top-center" />
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-50">
        {/* Header */}
        <div className="bg-white border-b sticky top-0 z-10 shadow-sm">
          <div className="container mx-auto px-4 py-3">
            <div className="flex justify-between items-center">
              <Button variant="ghost" onClick={() => router.push(`/matches/${matchId}`)} className="flex items-center gap-2 text-gray-600 hover:text-gray-900">
                <ArrowLeft className="h-5 w-5" />
                <span>Back</span>
              </Button>
              <div className="flex items-center gap-3">
                <span className="font-mono font-bold text-lg">{match.matchCode}</span>
                {match.status === 'live' && (
                  <div className="flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">
                    <Circle className="h-3 w-3 fill-current animate-pulse" /> LIVE
                  </div>
                )}
                {/* <Button size="sm" variant="secondary" onClick={() => logger.downloadLogs()}>
                  <Download className="h-4 w-4" />
                </Button> */}
              </div>
            </div>
          </div>
        </div>

        <div className="container mx-auto px-4 py-6 max-w-4xl">

          {/* State 1: Toss */}
          {state === 'TOSS' && (
            <TossForm
              teamOneName={match.teamOne.name}
              teamTwoName={match.teamTwo.name}
              onTossComplete={handleTossComplete}
            />
          )}

          {/* State 2: Scoring (and its sub-states) */}
          {state === 'SCORING' && battingTeam && bowlingTeam && scoringState && (
            <Fragment>


              {/* Sub-State: Start of Innings */}
              {needsFirstPlayerSelection && (
                <PlayerSelectionForm
                  battingTeamName={battingTeam.name}
                  bowlingTeamName={bowlingTeam.name}
                  battingPlayers={getAvailableBatsmen()} // Use available
                  bowlingPlayers={bowlingTeam.players}
                  onPlayersSelected={handlePlayersSelected}
                />
              )}

              {/* Sub-State: Wicket fell, need new batsman */}
              {needsBatsmanChange && (
                <BatsmanChangeForm
                  availableBatsmen={getAvailableBatsmen()}
                  outBatsman={scoringState.outBatsmen[scoringState.outBatsmen.length - 1] || "New Batsman"}
                  onBatsmanSelected={handleBatsmanChange}
                />
              )}

              {/* Sub-State: Over ended, need new bowler */}
              {needsBowlerChange && (
                <BowlerSelection
                  bowlers={bowlingTeam.players}
                  previousBowler={scoringState.previousBowler}
                  onSelect={handleBowlerChange}
                  reason="over"
                />
              )}

              {/* Sub-State: Ready to score */}
              {showScoringControls && (
                <>

                  <CompactMatchStatus
                    match={{ ...match, currentInnings: match.currentInnings ?? currentInnings ?? 1 } as typeof match & { currentInnings: number }}
                    battingTeam={battingTeam}
                    bowlingTeam={bowlingTeam}
                    batsman1={selectedBatsman1}
                    batsman2={selectedBatsman2}
                    striker={currentStriker}
                    bowler={selectedBowler}
                    currentInnings={currentInnings}
                    currentOver={currentOver}
                    previousBowler={previousBowler}
                  />
                  <ScoringControls
                    onBallRecorded={recordBall}
                    onUndo={undoLastBall}
                    canUndo={!!canUndo}
                    disabled={isSubmitting || isUndoing}
                  />
                </>
              )}
            </Fragment>
          )}
        </div>
      </div>
    </>
  );
}
