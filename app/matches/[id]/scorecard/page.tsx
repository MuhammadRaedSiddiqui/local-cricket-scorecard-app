'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  ArrowLeft,
  Trophy,
  Share2,
  Printer,
  Calendar,
  MapPin,
  Copy,
  Clock
} from 'lucide-react'
import toast, { Toaster } from 'react-hot-toast'
import { motion } from 'framer-motion'
import ModernScorecard from '@/components/sections/ModernScorecard'

export default function ScorecardPage() {
  const params = useParams()
  const router = useRouter()
  const matchId = params.id as string

  const [match, setMatch] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const fetchMatch = useCallback(async () => {
    try {
      const token = localStorage.getItem('auth_token')
      const response = await fetch(`/api/matches/${matchId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (!response.ok) {
        toast.error('Failed to load match')
        router.push('/dashboard')
        return
      }

      const data = await response.json()
      console.log("scoreboard data", data)
      setMatch(data.data)
    } catch (err) {
      toast.error('Failed to load match details')
      console.error('Fetch match error:', err)
    } finally {
      setLoading(false)
    }
  }, [matchId, router])

  useEffect(() => {
    fetchMatch()
  }, [fetchMatch])

 // ...existing code...

  const getMatchResult = () => {
    if (!match || match.status !== 'completed') return null

    // Limited-overs style chase logic
    if (match.target && match.currentInnings === 2) {
      const battingTeam =
        match.batting_team === match.teamOne.name ? match.teamOne : match.teamTwo
      const bowlingTeam =
        match.bowling_team === match.teamOne.name ? match.teamOne : match.teamTwo

      // Tie in a chase
      if (battingTeam.total_score === match.target - 1) {
        return 'Match Tied'
      }

      if (battingTeam.total_score >= match.target) {
        const wicketsLeft = 10 - battingTeam.total_wickets
        return `${match.batting_team} won by ${wicketsLeft} wicket${
          wicketsLeft === 1 ? '' : 's'
        }`
      } else {
        const runsDiff = match.target - 1 - battingTeam.total_score
        return `${match.bowling_team} won by ${runsDiff} run${
          runsDiff === 1 ? '' : 's'
        }`
      }
    }

    // First innings only or non-target scenario
    if (match.teamOne.total_score > match.teamTwo.total_score) {
      const diff = match.teamOne.total_score - match.teamTwo.total_score
      return `${match.teamOne.name} won by ${diff} run${diff === 1 ? '' : 's'}`
    } else if (match.teamTwo.total_score > match.teamOne.total_score) {
      const diff = match.teamTwo.total_score - match.teamOne.total_score
      return `${match.teamTwo.name} won by ${diff} run${diff === 1 ? '' : 's'}`
    }

    return 'Match Tied'
  }

// ...existing code...

  const handleShare = () => {
    const result = getMatchResult()
    const shareText = `CrickLive Match Scorecard\n\n${match?.teamOne.name} vs ${match?.teamTwo.name}\n${result}\n\nMatch Code: ${match?.matchCode}\n\nView full scorecard: ${window.location.href}`
    if (navigator.share) {
      navigator.share({
        title: 'Cricket Match Scorecard',
        text: shareText,
        url: window.location.href
      })
    } else {
      navigator.clipboard.writeText(shareText)
      toast.success('Scorecard link copied!')
    }
  }

  const handlePrint = () => {
    window.print()
  }

  const copyMatchCode = () => {
    navigator.clipboard.writeText(match.matchCode)
    toast.success('Match code copied!')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 via-white to-emerald-50">
        <div className="text-center">
          <div className="h-12 w-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading scorecard...</p>
        </div>
      </div>
    )
  }

  if (!match) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 via-white to-emerald-50">
        <Card className="p-8 text-center">
          <Trophy className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Match Not Found</h2>
          <p className="text-gray-600 mb-4">This match doesn&apos;t exist or has been removed.</p>
          <Button onClick={() => router.push('/dashboard')}>
            Back to Dashboard
          </Button>
        </Card>
      </div>
    )
  }

  return (
    <>
      <Toaster position="top-center" />

      <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-50 overflow-x-hidden">
        {/* Header */}
        <div className="bg-white border-b sticky top-0 z-10 print:hidden shadow-sm">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <button
                onClick={() => router.back()}
                className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
              >
                <ArrowLeft className="h-5 w-5" />
                <span className="hidden sm:inline">Back</span>
              </button>

              <h1 className="text-lg font-semibold text-gray-900">Scorecard</h1>

              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="icon"
                  onClick={handleShare}
                  title="Share"
                >
                  <Share2 className="h-4 w-4" />
                </Button>
                <Button
                  variant="secondary"
                  size="icon"
                  onClick={handlePrint}
                  title="Print"
                >
                  <Printer className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="container mx-auto px-2 py-4 md:px-4 md:py-8 max-w-6xl">

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <Card className="p-6 bg-gradient-to-r from-green-500 to-emerald-500 text-white">
              <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <Trophy className="h-8 w-8" />
                    <div>
                      <h1 className="text-xl md:text-2xl font-bold">
                        {match.teamOne.name} vs {match.teamTwo.name}
                      </h1>
                      {match.status === 'completed' && (
                        <p className="text-green-100 text-sm">
                          Match Completed
                        </p>
                      )}
                    </div>
                  </div>


                  {match.status === 'completed' && (
                    <div className="bg-white/20 rounded-lg p-3 mt-4">
                      <p className="text-lg md:text-xl font-bold">
                        🏆 {getMatchResult()}
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-2 text-sm">
                  <div className="flex items-center gap-2 text-green-100">
                    <MapPin className="h-4 w-4" />
                    <span>{match.venue}</span>
                  </div>
                  <div className="flex items-center gap-2 text-green-100">
                    <Calendar className="h-4 w-4" />
                    <span>{new Date(match.startTime).toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center gap-2 text-green-100">
                    <Clock className="h-4 w-4" />
                    <span>{match.overs} Overs Match</span>
                  </div>
                </div>
              </div>


              {match.toss_winner && (
                <div className="mt-4 pt-4 border-t border-white/20">
                  <p className="text-sm text-green-100">
                    <span className="font-medium">Toss:</span> {match.toss_winner} won and chose to {match.toss_decision}
                  </p>
                </div>
              )}
            </Card>
          </motion.div>


          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <ModernScorecard match={match} />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mt-8 print:hidden"
          >
            <Card className="p-4 md:p-6">
              <div className="text-center">
                <p className="text-sm text-gray-600 mb-4">
                  Share this scorecard with friends using the match code
                </p>
                <div className="inline-flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border border-green-200">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Match Code</p>
                    <span className="text-2xl font-mono font-bold text-green-700">
                      {match.matchCode}
                    </span>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={copyMatchCode}
                    className="gap-2"
                  >
                    <Copy className="h-3 w-3" />
                    Copy
                  </Button>
                </div>

                <div className="mt-4 flex flex-col md:flex-row justify-center gap-3">
                  <Button
                    variant="secondary"
                    onClick={handleShare}
                    className="gap-2"
                  >
                    <Share2 className="h-4 w-4" />
                    Share Scorecard
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => router.push(`/matches/${matchId}`)}
                    className="gap-2"
                  >
                    View Match Details
                  </Button>
                </div>
              </div>
            </Card>
          </motion.div>
        </div>
      </div>

      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          .print\\:hidden {
            display: none !important;
          }
          
          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
          
          @page {
            margin: 1cm;
          }
        }
      `}</style>
    </>
  )
}
