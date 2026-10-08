'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Calendar, MapPin, Eye, Edit2, Play, CheckCircle, Clock, RefreshCw, Trash2, MoreVertical } from 'lucide-react'
import toast from 'react-hot-toast'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/AlertDialog'
import { MatchCardSkeleton } from './MatchCardSkeleton'

interface MatchData {
  _id: string;
  matchCode: string;
  status: string;
  venue: string;
  startTime: string;
  overs: number;
  teamOne: {
    name: string;
    total_score?: number;
    total_wickets?: number;
    overs: string;
  };
  teamTwo: {
    name: string;
    total_score?: number;
    total_wickets?: number;
    overs: string;
  };
  isPrivate: boolean;
  createdAt: string;
  target?: number;
}

interface MyMatchesProps {
  matches: MatchData[];
  loading: boolean;
  onRefresh: () => void;
}

export default function MyMatches({ matches, loading, onRefresh }: MyMatchesProps) {
  const router = useRouter()
  const [filter, setFilter] = useState<'all' | 'live' | 'upcoming' | 'completed'>('all')
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [matchToDelete, setMatchToDelete] = useState<MatchData | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [showMenu, setShowMenu] = useState<string | null>(null)

  // Force close menu when dialog opens
  useEffect(() => {
    if (deleteDialogOpen) {
      console.log('🎯 Dialog opened, forcing menu to close')
      setShowMenu(null)
    }
  }, [deleteDialogOpen])

  const filteredMatches = filter === 'all'
    ? matches
    : matches.filter(match => match.status === filter)


  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'live':
        return <Play className="h-4 w-4" />
      case 'upcoming':
        return <Clock className="h-4 w-4" />
      case 'completed':
        return <CheckCircle className="h-4 w-4" />
      default:
        return null
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
        return 'bg-gray-100 text-gray-700'
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const today = new Date()
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    if (date.toDateString() === today.toDateString()) {
      return 'Today'
    } else if (date.toDateString() === tomorrow.toDateString()) {
      return 'Tomorrow'
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday'
    }

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    })
  }

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit'
    })
  }

  const handleDeleteClick = (match: MatchData, e: React.MouseEvent) => {
    console.log('🎯 Delete clicked for:', match.matchCode)
    e.stopPropagation()
    e.preventDefault()

    setMatchToDelete(match)
    setDeleteDialogOpen(true)
    setShowMenu(null) // This will now work correctly
  }

  const handleDeleteConfirm = async () => {
    console.log('🎯 DELETE CONFIRM CALLED!')
    console.log('🎯 Match to delete:', matchToDelete)

    if (!matchToDelete) {
      console.log('🎯 No match to delete, returning')
      return
    }

    setDeleting(true)
    console.log('🎯 Set deleting to true')

    try {
      const token = localStorage.getItem('auth_token')
      console.log('🎯 Token:', token ? 'exists' : 'missing')
      console.log('🎯 Calling DELETE API for match:', matchToDelete._id)

      const response = await fetch(`/api/matches?id=${encodeURIComponent(matchToDelete._id)}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })


      const data = await response.json()


      if (response.ok) {
        console.log('🎯 Delete successful!')
        toast.success('Match deleted successfully')
        setDeleteDialogOpen(false)
        setMatchToDelete(null)
        console.log('🎯 Calling onRefresh...')
        onRefresh()
      } else {
        console.error('🎯 Delete failed:', data.error)
        toast.error(data.error || 'Failed to delete match')
      }
    } catch (error) {
      console.error('🎯 Delete error:', error)
      toast.error('Failed to delete match')
    } finally {
      console.log('🎯 Setting deleting to false')
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <section className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h2 className="text-xl font-bold text-gray-900">My Matches</h2>
            <p className="text-sm text-gray-500">Matches you&apos;ve created or manage</p>
          </div>
          {/* We also render the filter/refresh UI in a loading state 
              to prevent layout shift, but you could skeleton this too. */}
          <div className="flex items-center gap-2">
            {/* --- Mobile Only Select --- */}
            <div className="sm:hidden">
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value as any)}
                className="px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-100 border-gray-300"
              >
                <option value="all">All</option>
                <option value="live">Live</option>
                <option value="upcoming">Upcoming</option>
                <option value="completed">Completed</option>
              </select>
            </div>
            <div className="hidden sm:flex items-center gap-2 bg-gray-100 p-1 rounded-xl opacity-50">
              {(['all', 'live', 'upcoming', 'completed'] as const).map((status) => (
                <button
                  key={status}
                  disabled
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize ${status === 'all' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600'}`}
                >
                  {status}
                </button>
              ))}
            </div>
            <Button
              variant="secondary"
              size="sm"
              disabled
              className="gap-2"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Use the new high-fidelity skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <MatchCardSkeleton />
          <MatchCardSkeleton />
          <MatchCardSkeleton />
        </div>
      </section>
    )
  }

  return (
    <>
      <section className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h2 className="text-xl font-bold text-gray-900">My Matches</h2>
            <p className="text-sm text-gray-500">Matches you&apos;ve created or manage</p>
          </div>

          <div className="flex items-center gap-2">
            {/* Filter Tabs */}
            <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-xl">
              {(['all', 'live', 'upcoming', 'completed'] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => setFilter(status)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition-all ${filter === status
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                    }`}
                >
                  {status}
                </button>
              ))}
            </div>

            {/* Refresh Button */}
            <Button
              variant="secondary"
              size="sm"
              onClick={onRefresh}
              className="gap-2"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {filteredMatches.length === 0 ? (
          <Card className="p-12 text-center">
            <div className="max-w-md mx-auto">
              <div className="h-16 w-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
                <Clock className="h-8 w-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {filter === 'all' ? 'No matches yet' : `No ${filter} matches`}
              </h3>
              <p className="text-gray-500 mb-4">
                {filter === 'all'
                  ? "Create your first cricket match to get started!"
                  : `You don't have any ${filter} matches.`}
              </p>
              {filter === 'all' && (
                <Button onClick={() => router.push('/matches/create')}>
                  Create Match
                </Button>
              )}
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredMatches.map((match, index) => (
              <motion.div
                key={match._id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.1 }}
                whileHover={{ y: -4 }}
              >
                <Card className="p-5 hover:shadow-lg transition-all bg-white/80 backdrop-blur-sm border-gray-100 relative">
                  {/* Delete/Menu Button */}
                  <div className="absolute top-3 right-3">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setShowMenu(showMenu === match._id ? null : match._id)
                      }}
                      className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <MoreVertical className="h-4 w-4 text-gray-500" />
                    </button>

                    {/* Dropdown Menu */}
                    {showMenu === match._id && (
                      <div className="absolute right-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10">
                        <button
                          onClick={() => router.push(`/matches/${match._id}`)}
                          className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                        >
                          <Eye className="h-4 w-4" />
                          View Details
                        </button>
                        {match.status === 'upcoming' && (
                          <button
                            onClick={() => router.push(`/matches/${match._id}/edit`)}
                            className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                          >
                            <Edit2 className="h-4 w-4" />
                            Edit Match
                          </button>
                        )}
                        <hr className="my-1" />
                        <button
                          onClick={(e) => handleDeleteClick(match, e)}
                          className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete Match
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Status Badge */}
                  <div className="flex items-center justify-between mb-4 pr-8">
                    <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(match.status)}`}>
                      {getStatusIcon(match.status)}
                      <span className="capitalize">{match.status}</span>
                      {match.status === 'live' && (
                        <span className="ml-1 relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mb-2">
                    <span className="text-xs font-mono text-gray-500">
                      {match.matchCode}
                    </span>
                  </div>

                  {/* Teams */}
                  <div className="space-y-3 mb-4">
                    <div>
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-gray-900">{match.teamOne.name}</h3>
                        {match.status !== 'upcoming' && (
                          <span className="text-sm font-medium text-gray-700">
                            {match.teamOne.total_score || 0}/{match.teamOne.total_wickets || 0}
                          </span>
                        )}
                      </div>
                      {match.status !== 'upcoming' && (
                        <div className="text-xs text-gray-500 text-right">
                          ({match.teamOne.overs} ov)
                        </div>
                      )}

                      <div className="text-center text-xs text-gray-400 my-1">vs</div>

                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-gray-900">{match.teamTwo.name}</h3>
                        {match.status !== 'upcoming' && (
                          <span className="text-sm font-medium text-gray-700">
                            {match.teamTwo.total_score || 0}/{match.teamTwo.total_wickets || 0}
                          </span>
                        )}
                      </div>
                      {match.status !== 'upcoming' && (
                        <div className="text-xs text-gray-500 text-right">
                          ({match.teamTwo.overs} ov)
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Target Display */}
                  {match.target && (
                    <div className="mb-4 p-2 bg-blue-50 rounded-lg text-center">
                      <span className="text-xs font-medium text-blue-700">
                        Target: {match.target}
                      </span>
                    </div>
                  )}

                  {/* Match Details */}
                  <div className="space-y-2 mb-4 text-sm text-gray-600">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-3.5 w-3.5" />
                      <span>{formatDate(match.startTime)} • {formatTime(match.startTime)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="h-3.5 w-3.5" />
                      <span className="truncate">{match.venue}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    {match.status === 'live' ? (
                      <Button
                        className="flex-1 bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 text-white"
                        onClick={(e) => {
                          e.stopPropagation()
                          router.push(`/matches/${match._id}/score`)
                        }}
                      >
                        <Edit2 className="h-4 w-4 mr-1.5" />
                        Continue Scoring
                      </Button>
                    ) : match.status === 'upcoming' ? (
                      <>
                        <Button
                          variant="secondary"
                          className="flex-1"
                          onClick={(e) => {
                            e.stopPropagation()
                            router.push(`/matches/${match._id}/edit`)
                          }}
                        >
                          <Edit2 className="h-4 w-4 mr-1.5" />
                          Edit
                        </Button>
                        <Button
                          className="flex-1 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white"
                          onClick={(e) => {
                            e.stopPropagation()
                            router.push(`/matches/${match._id}/score`)
                          }}
                        >
                          Start
                        </Button>
                      </>
                    ) : (
                      <Button
                        variant="secondary"
                        className="flex-1"
                        onClick={(e) => {
                          e.stopPropagation()
                          router.push(`/matches/${match._id}`)
                        }}
                      >
                        <Eye className="h-4 w-4 mr-1.5" />
                        View Details
                      </Button>
                    )}
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </section>


      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          console.log('🎯 Dialog onOpenChange called with:', open)
          setDeleteDialogOpen(open)
          if (!open) {
            setMatchToDelete(null)
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Match?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{matchToDelete?.matchCode}</strong>?
              <br />
              <span className="text-gray-900 font-medium">
                {matchToDelete?.teamOne.name} vs {matchToDelete?.teamTwo.name}
              </span>
              <br /><br />
              This action cannot be undone. All match data including scores and statistics will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              console.log('🎯 Cancel clicked')
              setDeleteDialogOpen(false)
              setMatchToDelete(null)
            }}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                console.log('🎯 Delete clicked')
                handleDeleteConfirm()
              }}
              variant="destructive"
              disabled={deleting}
            >
              {deleting ? 'Deleting...' : 'Delete Match'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>


    </>
  )
}
