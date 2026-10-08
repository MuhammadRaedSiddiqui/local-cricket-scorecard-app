'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Save, AlertCircle } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import toast, { Toaster } from 'react-hot-toast'
import { motion } from 'framer-motion'

interface Player {
  name: string
  is_captain: boolean
  is_keeper: boolean
}

interface Team {
  name: string
  players: Player[]
}

interface Match {
  _id: string
  matchCode: string
  status: string
  venue: string
  overs: number
  startTime: string
  teamOne: Team
  teamTwo: Team
  isPrivate: boolean
}

export default function EditMatchPage() {
  const params = useParams()
  const router = useRouter()
  const matchId = params.id as string
  
  const [match, setMatch] = useState<Match | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  
  const [formData, setFormData] = useState({
    venue: '',
    overs: 20,
    startTime: '',
    teamOne: { name: '', players: [] as Player[] },
    teamTwo: { name: '', players: [] as Player[] },
    isPrivate: false
  })

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
      const matchData = data.data
      
      setMatch(matchData)
      setFormData({
        venue: matchData.venue,
        overs: matchData.overs,
        startTime: new Date(matchData.startTime).toISOString().slice(0, 16),
        teamOne: {
          name: matchData.teamOne.name,
          players: matchData.teamOne.players
        },
        teamTwo: {
          name: matchData.teamTwo.name,
          players: matchData.teamTwo.players
        },
        isPrivate: matchData.isPrivate
      })
      
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

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!match) return
    
    // Validate form
    if (!formData.venue || !formData.teamOne.name || !formData.teamTwo.name) {
      toast.error('Please fill in all required fields')
      return
    }

    if (formData.teamOne.players.length === 0 || formData.teamTwo.players.length === 0) {
      toast.error('Each team must have at least one player')
      return
    }

    setSaving(true)
    
    try {
      const token = localStorage.getItem('auth_token')
      const response = await fetch(`/api/matches/${matchId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          venue: formData.venue,
          overs: formData.overs,
          startTime: new Date(formData.startTime).toISOString(),
          teamOne: formData.teamOne,
          teamTwo: formData.teamTwo,
          isPrivate: formData.isPrivate
        })
      })

      if (response.ok) {
        toast.success('Match updated successfully!')
        setTimeout(() => {
          router.push(`/matches/${matchId}`)
        }, 1000)
      } else {
        const errorData = await response.json()
        toast.error(errorData.error || 'Failed to update match')
      }
    } catch (error) {
      toast.error('Failed to update match')
      console.error('Update error:', error)
    } finally {
      setSaving(false)
    }
  }

  const updatePlayer = (teamKey: 'teamOne' | 'teamTwo', playerIndex: number, field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [teamKey]: {
        ...prev[teamKey],
        players: prev[teamKey].players.map((player, idx) => 
          idx === playerIndex ? { ...player, [field]: value } : player
        )
      }
    }))
  }

  const addPlayer = (teamKey: 'teamOne' | 'teamTwo') => {
    setFormData(prev => ({
      ...prev,
      [teamKey]: {
        ...prev[teamKey],
        players: [...prev[teamKey].players, { name: '', is_captain: false, is_keeper: false }]
      }
    }))
  }

  const removePlayer = (teamKey: 'teamOne' | 'teamTwo', playerIndex: number) => {
    setFormData(prev => ({
      ...prev,
      [teamKey]: {
        ...prev[teamKey],
        players: prev[teamKey].players.filter((_, idx) => idx !== playerIndex)
      }
    }))
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 via-white to-emerald-50">
        <div className="text-center">
          <div className="h-12 w-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading match...</p>
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

  // Check if match can be edited (only upcoming matches)
  if (match.status !== 'upcoming') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 via-white to-emerald-50">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Cannot Edit Match</h2>
          <p className="text-gray-600 mb-4">Only upcoming matches can be edited.</p>
          <Button onClick={() => router.push(`/matches/${matchId}`)} variant="secondary">
            View Match
          </Button>
        </div>
      </div>
    )
  }

  return (
    <>
      <Toaster position="top-center" />
      
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-50">
        {/* Header */}
        <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <button
                onClick={() => router.back()}
                className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
              >
                <ArrowLeft className="h-5 w-5" />
                <span>Back</span>
              </button>
              
              <h1 className="text-lg font-semibold text-gray-900">Edit Match</h1>
              
              <div className="w-20"></div> {/* Spacer for centering */}
            </div>
          </div>
        </div>

        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Match Info Card */}
            <Card className="p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Match Information</h3>
              
              <form onSubmit={handleSave} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Venue *
                    </label>
                    <input
                      type="text"
                      value={formData.venue}
                      onChange={(e) => setFormData(prev => ({ ...prev, venue: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      placeholder="Match venue"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Overs
                    </label>
                    <input
                      type="number"
                      value={formData.overs}
                      onChange={(e) => setFormData(prev => ({ ...prev, overs: parseInt(e.target.value) }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      min="1"
                      max="50"
                      required
                    />
                  </div>
                  
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Start Time *
                    </label>
                    <input
                      type="datetime-local"
                      value={formData.startTime}
                      onChange={(e) => setFormData(prev => ({ ...prev, startTime: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      required
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="isPrivate"
                    checked={formData.isPrivate}
                    onChange={(e) => setFormData(prev => ({ ...prev, isPrivate: e.target.checked }))}
                    className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                  />
                  <label htmlFor="isPrivate" className="text-sm text-gray-700">
                    Private Match (only visible to invited users)
                  </label>
                </div>

                {/* Teams Section */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
                  {/* Team One */}
                  <div>
                    <h4 className="text-md font-semibold text-gray-900 mb-3">Team One</h4>
                    <div className="space-y-4">
                      <input
                        type="text"
                        value={formData.teamOne.name}
                        onChange={(e) => setFormData(prev => ({ 
                          ...prev, 
                          teamOne: { ...prev.teamOne, name: e.target.value }
                        }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                        placeholder="Team name"
                        required
                      />
                      
                      <div className="space-y-2">
                        {formData.teamOne.players.map((player, idx) => (
                          <div key={idx} className="flex items-center gap-2 p-2 border rounded-lg">
                            <input
                              type="text"
                              value={player.name}
                              onChange={(e) => updatePlayer('teamOne', idx, 'name', e.target.value)}
                              className="flex-1 px-2 py-1 border-0 focus:ring-0"
                              placeholder="Player name"
                              required
                            />
                            <label className="flex items-center gap-1 text-xs">
                              <input
                                type="checkbox"
                                checked={player.is_captain}
                                onChange={(e) => updatePlayer('teamOne', idx, 'is_captain', e.target.checked)}
                                className="rounded"
                              />
                              C
                            </label>
                            <label className="flex items-center gap-1 text-xs">
                              <input
                                type="checkbox"
                                checked={player.is_keeper}
                                onChange={(e) => updatePlayer('teamOne', idx, 'is_keeper', e.target.checked)}
                                className="rounded"
                              />
                              WK
                            </label>
                            <button
                              type="button"
                              onClick={() => removePlayer('teamOne', idx)}
                              className="text-red-500 hover:text-red-700 px-2 py-1"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                        
                        <button
                          type="button"
                          onClick={() => addPlayer('teamOne')}
                          className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-green-500 hover:text-green-500 transition-colors"
                        >
                          + Add Player
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Team Two */}
                  <div>
                    <h4 className="text-md font-semibold text-gray-900 mb-3">Team Two</h4>
                    <div className="space-y-4">
                      <input
                        type="text"
                        value={formData.teamTwo.name}
                        onChange={(e) => setFormData(prev => ({ 
                          ...prev, 
                          teamTwo: { ...prev.teamTwo, name: e.target.value }
                        }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                        placeholder="Team name"
                        required
                      />
                      
                      <div className="space-y-2">
                        {formData.teamTwo.players.map((player, idx) => (
                          <div key={idx} className="flex items-center gap-2 p-2 border rounded-lg">
                            <input
                              type="text"
                              value={player.name}
                              onChange={(e) => updatePlayer('teamTwo', idx, 'name', e.target.value)}
                              className="flex-1 px-2 py-1 border-0 focus:ring-0"
                              placeholder="Player name"
                              required
                            />
                            <label className="flex items-center gap-1 text-xs">
                              <input
                                type="checkbox"
                                checked={player.is_captain}
                                onChange={(e) => updatePlayer('teamTwo', idx, 'is_captain', e.target.checked)}
                                className="rounded"
                              />
                              C
                            </label>
                            <label className="flex items-center gap-1 text-xs">
                              <input
                                type="checkbox"
                                checked={player.is_keeper}
                                onChange={(e) => updatePlayer('teamTwo', idx, 'is_keeper', e.target.checked)}
                                className="rounded"
                              />
                              WK
                            </label>
                            <button
                              type="button"
                              onClick={() => removePlayer('teamTwo', idx)}
                              className="text-red-500 hover:text-red-700 px-2 py-1"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                        
                        <button
                          type="button"
                          onClick={() => addPlayer('teamTwo')}
                          className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-green-500 hover:text-green-500 transition-colors"
                        >
                          + Add Player
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex gap-4 pt-6">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => router.push(`/matches/${matchId}`)}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={saving}
                    className="flex-1 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600"
                  >
                    {saving ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-2" />
                        Save Changes
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </Card>
          </motion.div>
        </div>
      </div>
    </>
  )
}
