'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { 
  ArrowLeft, 
  Circle, 
  RefreshCw, 
  Trophy,
  TrendingUp,
  Users,
  Target
} from 'lucide-react'
import { motion } from 'framer-motion'

interface Team {
  name: string
  total_score: number
  total_wickets: number
  total_balls: number
  total_overs?: number
  extras?: number
}

interface Match {
  _id: string
  matchCode: string
  status: 'upcoming' | 'live' | 'completed'
  venue: string
  overs: number
  startTime: string
  teamOne: Team
  teamTwo: Team
  batting_team?: string
  bowling_team?: string
  target?: number
}

export default function LiveMatchPage() {
  const params = useParams()
  const router = useRouter()
  const matchId = params.id as string
  
  const [match, setMatch] = useState<Match | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())

  const fetchMatch = useCallback(async () => {
    try {
      const response = await fetch(`/api/matches/${matchId}`)

      if (!response.ok) {
        if (response.status === 404) {
          setError('Match not found')
        } else {
          setError('Failed to load match')
        }
        return
      }

      const data = await response.json()
      setMatch(data.data)
      setLastUpdated(new Date())
      setError('')
      
    } catch (err) {
      setError('Failed to load match')
      console.error('Fetch match error:', err)
    } finally {
      setLoading(false)
    }
  }, [matchId])

  useEffect(() => {
    fetchMatch()

    // Auto-refresh every 10 seconds
    const interval = setInterval(fetchMatch, 10000)

    return () => clearInterval(interval)
  }, [fetchMatch])

  const manualRefresh = () => {
    setLoading(true)
    fetchMatch()
  }

  const getBattingTeam = (): Team | null => {
    if (!match || !match.batting_team) return null
    return match.batting_team === match.teamOne.name ? match.teamOne : match.teamTwo
  }

  const getBowlingTeam = (): Team | null => {
    if (!match || !match.bowling_team) return null
    return match.bowling_team === match.teamOne.name ? match.teamOne : match.teamTwo
  }

  const getOvers = (balls: number): string => {
    const overs = Math.floor(balls / 6)
    const remainingBalls = balls % 6
    return `${overs}.${remainingBalls}`
  }

  const getRunRate = (score: number, balls: number): string => {
    if (balls === 0) return '0.00'
    const runRate = (score / balls) * 6
    return runRate.toFixed(2)
  }

  const getRequiredRunRate = (): string => {
    if (!match || !match.target) return '0.00'
    
    const battingTeam = getBattingTeam()
    if (!battingTeam) return '0.00'
    
    const totalBalls = match.overs * 6
    const ballsRemaining = totalBalls - battingTeam.total_balls
    const runsRequired = match.target - battingTeam.total_score
    
    if (ballsRemaining <= 0) return '0.00'
    
    const requiredRate = (runsRequired / ballsRemaining) * 6
    return Math.max(0, requiredRate).toFixed(2)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 via-white to-emerald-50">
        <div className="text-center">
          <div className="h-12 w-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading live match...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 via-white to-emerald-50">
        <div className="text-center">
          <div className="h-12 w-12 text-red-500 mx-auto mb-4">
            <Circle className="h-full w-full" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">{error}</h2>
          <Button onClick={() => router.push('/dashboard')} variant="secondary">
            Back to Dashboard
          </Button>
        </div>
      </div>
    )
  }

  if (!match) return null

  const battingTeam = getBattingTeam()
  const bowlingTeam = getBowlingTeam()

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10 shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => router.back()}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
              <span>Back</span>
            </button>
            
            <div className="flex items-center gap-3">
              <span className="font-mono font-bold text-lg">{match.matchCode}</span>
              {match.status === 'live' && (
                <div className="flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">
                  <Circle className="h-3 w-3 fill-current animate-pulse" />
                  LIVE
                </div>
              )}
              <Button
                size="sm"
                variant="secondary"
                onClick={manualRefresh}
                disabled={loading}
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 max-w-4xl">
        {/* Match Status */}
        {match.status === 'upcoming' && (
          <Card className="p-6 mb-6 bg-blue-50 border-blue-200">
            <div className="text-center">
              <h2 className="text-xl font-bold text-blue-900 mb-2">Match Yet to Start</h2>
              <p className="text-blue-700">
                Scheduled for {new Date(match.startTime).toLocaleString()}
              </p>
            </div>
          </Card>
        )}

        {match.status === 'completed' && (
          <Card className="p-6 mb-6 bg-green-50 border-green-200">
            <div className="text-center">
              <Trophy className="h-12 w-12 text-green-600 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-green-900 mb-2">Match Completed</h2>
            </div>
          </Card>
        )}

        {/* Live Score Display */}
        {(match.status === 'live' || match.status === 'completed') && battingTeam && bowlingTeam && (
          <div className="space-y-6">
            {/* Main Score */}
            <Card className="p-6 bg-gradient-to-r from-green-500 to-emerald-500 text-white">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold">{match.teamOne.name} vs {match.teamTwo.name}</h2>
                <div className="text-right text-sm opacity-90">
                  <div>{match.venue}</div>
                  <div>{match.overs} Overs</div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Current Batting Team */}
                <div>
                  <div className="text-sm opacity-90 mb-1">
                    {battingTeam.name} (Batting)
                  </div>
                  <div className="text-4xl font-bold mb-2">
                    {battingTeam.total_score}/{battingTeam.total_wickets}
                  </div>
                  <div className="text-sm opacity-90">
                    Overs: {getOvers(battingTeam.total_balls)} | Run Rate: {getRunRate(battingTeam.total_score, battingTeam.total_balls)}
                  </div>
                </div>

                {/* Target/Trail */}
                <div className="text-right">
                  <div className="text-sm opacity-90 mb-1">
                    {bowlingTeam.name} (Bowling)
                  </div>
                  {match.target ? (
                    <div>
                      <div className="text-2xl font-bold mb-2">
                        Target: {match.target}
                      </div>
                      <div className="text-sm opacity-90">
                        Need {Math.max(0, match.target - battingTeam.total_score)} runs in {Math.max(0, (match.overs * 6) - battingTeam.total_balls)} balls
                      </div>
                      <div className="text-sm opacity-90">
                        Required Rate: {getRequiredRunRate()}
                      </div>
                    </div>
                  ) : (
                    <div className="text-lg font-semibold">
                      First Innings
                    </div>
                  )}
                </div>
              </div>
            </Card>

            {/* Teams Overview */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Team 1 */}
              <Card className="p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  {match.teamOne.name}
                </h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Score</span>
                    <span className="font-medium">{match.teamOne.total_score}/{match.teamOne.total_wickets}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Overs</span>
                    <span className="font-medium">{getOvers(match.teamOne.total_balls)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Run Rate</span>
                    <span className="font-medium">{getRunRate(match.teamOne.total_score, match.teamOne.total_balls)}</span>
                  </div>
                  {match.teamOne.extras && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Extras</span>
                      <span className="font-medium">{match.teamOne.extras}</span>
                    </div>
                  )}
                </div>
              </Card>

              {/* Team 2 */}
              <Card className="p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  {match.teamTwo.name}
                </h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Score</span>
                    <span className="font-medium">{match.teamTwo.total_score}/{match.teamTwo.total_wickets}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Overs</span>
                    <span className="font-medium">{getOvers(match.teamTwo.total_balls)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Run Rate</span>
                    <span className="font-medium">{getRunRate(match.teamTwo.total_score, match.teamTwo.total_balls)}</span>
                  </div>
                  {match.teamTwo.extras && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Extras</span>
                      <span className="font-medium">{match.teamTwo.extras}</span>
                    </div>
                  )}
                </div>
              </Card>
            </div>

            {/* Additional Actions */}
            <div className="flex gap-4 justify-center">
              <Button
                onClick={() => router.push(`/matches/${matchId}`)}
                variant="secondary"
              >
                View Full Details
              </Button>
              {match.status === 'completed' && (
                <Button
                  onClick={() => router.push(`/matches/${matchId}/scorecard`)}
                >
                  View Scorecard
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Last Updated */}
        <div className="text-center text-sm text-gray-500 mt-8">
          Last updated: {lastUpdated.toLocaleTimeString()}
          {match.status === 'live' && (
            <span className="ml-2">(Auto-refreshing every 10 seconds)</span>
          )}
        </div>
      </div>
    </div>
  )
}
