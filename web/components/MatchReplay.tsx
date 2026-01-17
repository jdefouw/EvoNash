'use client'

import { Match } from '@/types/protocol'

interface MatchReplayProps {
  match: Match
}

export default function MatchReplay({ match }: MatchReplayProps) {
  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
      <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Match Replay</h2>
      <div className="space-y-2 text-sm">
        <div>
          <span className="text-gray-600 dark:text-gray-400">Agent A:</span>
          <span className="ml-2 font-medium text-gray-900 dark:text-white">
            {match.agent_a_id.slice(0, 8)}...
          </span>
        </div>
        <div>
          <span className="text-gray-600 dark:text-gray-400">Agent B:</span>
          <span className="ml-2 font-medium text-gray-900 dark:text-white">
            {match.agent_b_id.slice(0, 8)}...
          </span>
        </div>
        <div>
          <span className="text-gray-600 dark:text-gray-400">Winner:</span>
          <span className="ml-2 font-medium text-gray-900 dark:text-white">
            {match.winner_id ? `${match.winner_id.slice(0, 8)}...` : 'Draw'}
          </span>
        </div>
      </div>
    </div>
  )
}
