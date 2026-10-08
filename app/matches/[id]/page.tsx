'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { 
  Trophy, 
  Users, 
  Calendar, 
  MapPin, 
  Clock, 
  Share2, 
  Copy, 
  Play,
  Eye,
  Edit2,
  ArrowLeft,
  Circle,
  Shield,
  CheckCircle,
  AlertCircle
} from 'lucide-react'
import toast, { Toaster } from 'react-hot-toast'
import { motion } from 'framer-motion'

interface Player {
  name: string
  runs_scored: number
  balls_played: number
  fours: number
  sixes: number
  wickets: number
  is_captain: boolean
  is_keeper: boolean
  is_out: boolean
}

interface Team {
  name: string
  players: Player[]
  total_score: number
  total_wickets: number
  total_overs: number
  extras: number
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
  createdBy: string
  admins: string[]
  scorers: string[]
  viewers: string[]
  isPrivate: boolean
  createdAt: string
  updatedAt: string
}

export default function MatchViewPage() {
  const params = useParams()
  const router = useRouter()
  const matchId = params.id as string
  
  const [match, setMatch] = useState<Match | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)

  const fetchMatch = useCallback(async () => {
    
    try {
      const token = localStorage.getItem('auth_token')
      const response = await fetch(`/api/matches/${matchId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

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
      
      // Check if current user is admin
      const userData = localStorage.getItem('user')
      if (userData) {
        const user = JSON.parse(userData)
        setIsAdmin(data.data.createdBy === user.id || data.data.admins?.includes(user.id))
      }
     
    } catch (err) {
      setError('Failed to load match')
      console.error('Fetch match error:', err)
    } finally {
      setLoading(false)
      
      
    }
  }, [matchId])

  useEffect(() => {
    fetchMatch()
  }, [fetchMatch])

  const copyMatchCode = () => {
    if (match?.matchCode) {
      navigator.clipboard.writeText(match.matchCode)
      setCopied(true)
      toast.success('Match code copied!')
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const shareMatch = () => {
    if (match?.matchCode) {
      const shareUrl = `${window.location.origin}/join/${match.matchCode}`
      const shareText = `Join my cricket match!\n\nMatch Code: ${match.matchCode}\nTeams: ${match.teamOne.name} vs ${match.teamTwo.name}\n\nJoin here: ${shareUrl}`
      
      if (navigator.share) {
        navigator.share({
          title: 'Join Cricket Match',
          text: shareText,
        })
      } else {
        navigator.clipboard.writeText(shareText)
        toast.success('Share link copied!')
      }
    }
  }

  const startMatch = async () => {
    try {
      const token = localStorage.getItem('auth_token')
      const response = await fetch(`/api/matches/${matchId}/start`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        toast.success('Match started!')
        // Redirect to scoring page
        router.push(`/matches/${matchId}/score`)
      } else {
        toast.error('Failed to start match')
      }
    } catch (err) {
      toast.error('Failed to start match')
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'live':
        return 'bg-red-100 text-red-700 border-red-200'
      case 'upcoming':
        return 'bg-blue-100 text-blue-700 border-blue-200'
      case 'completed':
        return 'bg-green-100 text-green-700 border-green-200'
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'live':
        return <Circle className="h-4 w-4 fill-current animate-pulse" />
      case 'upcoming':
        return <Clock className="h-4 w-4" />
      case 'completed':
        return <CheckCircle className="h-4 w-4" />
      default:
        return null
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 via-white to-emerald-50">
        <div className="text-center">
          <div className="h-12 w-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading match details...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 via-white to-emerald-50">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">{error}</h2>
          <Button onClick={() => router.push('/dashboard')} variant="secondary">
            Back to Dashboard
          </Button>
        </div>
      </div>
    )
  }

  if (!match) return null

  return (
    <>
      <Toaster position="top-center" />
      
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-50">
        {/* Header */}
        <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <button
                onClick={() => router.push("/dashboard")}
                className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
              >
                <ArrowLeft className="h-5 w-5" />
                <span>Back</span>
              </button>
              
              <div className="flex items-center gap-2">
                <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(match.status)}`}>
                  {getStatusIcon(match.status)}
                  <span className="capitalize">{match.status}</span>
                </div>
                {isAdmin && (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700 border border-purple-200">
                    <Shield className="h-3 w-3" />
                    Admin
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="container mx-auto px-4 py-8 max-w-6xl">
          {/* Match Code Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <Card className="p-6 bg-gradient-to-r from-primary-50 to-accent-50 border-primary-200">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <h2 className="text-sm font-medium text-gray-600 mb-1">Match Code</h2>
                  <div className="flex items-center gap-3">
                    <span className="text-3xl font-bold font-mono text-gray-900">{match.matchCode}</span>
                    <button
                      onClick={copyMatchCode}
                      className="p-2 hover:bg-white/50 rounded-lg transition-colors"
                      title="Copy code"
                    >
                      {copied ? (
                        <CheckCircle className="h-5 w-5 text-green-600" />
                      ) : (
                        <Copy className="h-5 w-5 text-gray-600" />
                      )}
                    </button>
                  </div>
                  <p className="text-sm text-gray-600 mt-2">Share this code with others to join the match</p>
                </div>
                <Button onClick={shareMatch} variant="secondary" className="gap-2">
                  <Share2 className="h-4 w-4" />
                  Share Match
                </Button>
              </div>
            </Card>
          </motion.div>

          {/* Match Details */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            {/* Teams Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="lg:col-span-2"
            >
              <Card className="p-6 h-full">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Teams</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Team 1 */}
                  <div className="space-y-3">
                    <div className="bg-green-50 rounded-lg p-4">
                      <h4 className="font-bold text-green-900 text-lg mb-2">{match.teamOne.name}</h4>
                      <div className="space-y-2">
                        {match.teamOne.players.map((player, index) => (
                          <div key={index} className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              <span className="text-gray-600">{index + 1}.</span>
                              <span className="font-medium text-gray-900">{player.name}</span>
                              {player.is_captain && (
                                <span className="px-1.5 py-0.5 bg-yellow-100 text-yellow-700 text-xs rounded-full">C</span>
                              )}
                              {player.is_keeper && (
                                <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">WK</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Team 2 */}
                  <div className="space-y-3">
                    <div className="bg-green-50 rounded-lg p-4">
                      <h4 className="font-bold text-green-900 text-lg mb-2">{match.teamTwo.name}</h4>
                      <div className="space-y-2">
                        {match.teamTwo.players.map((player, index) => (
                          <div key={index} className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              <span className="text-gray-600">{index + 1}.</span>
                              <span className="font-medium text-gray-900">{player.name}</span>
                              {player.is_captain && (
                                <span className="px-1.5 py-0.5 bg-yellow-100 text-yellow-700 text-xs rounded-full">C</span>
                              )}
                              {player.is_keeper && (
                                <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">WK</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            </motion.div>

            {/* Match Info Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Card className="p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Match Information</h3>
                
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <MapPin className="h-5 w-5 text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-sm text-gray-600">Venue</p>
                      <p className="font-medium text-gray-900">{match.venue}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <Calendar className="h-5 w-5 text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-sm text-gray-600">Date & Time</p>
                      <p className="font-medium text-gray-900">
                        {new Date(match.startTime).toLocaleDateString()}
                      </p>
                      <p className="text-sm text-gray-600">
                        {new Date(match.startTime).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <Trophy className="h-5 w-5 text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-sm text-gray-600">Format</p>
                      <p className="font-medium text-gray-900">{match.overs} Overs</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <Users className="h-5 w-5 text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-sm text-gray-600">Visibility</p>
                      <p className="font-medium text-gray-900">
                        {match.isPrivate ? 'Private Match' : 'Public Match'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="mt-6 space-y-2">
                  {match.status === 'upcoming' && isAdmin && (
                    <Button 
                      onClick={startMatch}
                      className="w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white"
                    >
                      <Play className="h-4 w-4 mr-2" />
                      Start Match
                    </Button>
                  )}
                  
                  {match.status === 'live' && (
                    <>
                      {isAdmin ? (
                        <Button 
                          onClick={() => router.push(`/matches/${matchId}/score`)}
                          className="w-full bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 text-white"
                        >
                          <Edit2 className="h-4 w-4 mr-2" />
                          Update Score
                        </Button>
                      ) : (
                        <Button 
                          onClick={() => router.push(`/matches/${matchId}/live`)}
                          className="w-full"
                          variant="secondary"
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          View Live Score
                        </Button>
                      )}
                    </>
                  )}
                  
                  {match.status === 'completed' && (
                    <Button 
                      onClick={() => router.push(`/matches/${matchId}/scorecard`)}
                      className="w-full"
                      variant="secondary"
                    >
                      <Trophy className="h-4 w-4 mr-2" />
                      View Scorecard
                    </Button>
                  )}
                </div>
              </Card>
            </motion.div>
          </div>

          {/* Created By */}
          <div className="text-center text-sm text-gray-500">
            Created on {new Date(match.createdAt).toLocaleDateString()} at {new Date(match.createdAt).toLocaleTimeString()}
          </div>
        </div>
      </div>
    </>
  )
}
