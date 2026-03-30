import { useEffect, useCallback } from 'react'
import { X } from 'lucide-react'
import { useGraphStore } from '../../stores/graphStore'
import { ScorecardPanel } from './ScorecardPanel'
import { RecommendationsPanel } from './RecommendationsPanel'

export function ScorecardOverlay() {
  const { showScorecard, setShowScorecard, fetchScorecard, scorecardData } = useGraphStore()

  useEffect(() => {
    if (showScorecard && !scorecardData) {
      fetchScorecard()
    }
  }, [showScorecard])

  const handleDismiss = useCallback(() => setShowScorecard(false), [setShowScorecard])

  // Keyboard shortcut: Escape to close
  useEffect(() => {
    if (!showScorecard) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleDismiss()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [showScorecard, handleDismiss])

  if (!showScorecard) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={(e) => { if (e.target === e.currentTarget) handleDismiss() }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" />

      {/* Overlay content */}
      <div className="relative z-10 w-[95vw] max-w-[1100px] h-[90vh] bg-white dark:bg-[#1e1e1e] rounded-xl border border-black/10 dark:border-white/10 shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-black/10 dark:border-white/10">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
            Workspace Scorecard
          </h2>
          <button
            onClick={handleDismiss}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Two-panel grid */}
        <div className="flex-1 overflow-hidden grid grid-cols-[300px_1fr] min-h-0">
          <div className="overflow-y-auto border-r border-black/10 dark:border-white/10">
            <ScorecardPanel />
          </div>
          <div className="overflow-y-auto">
            <RecommendationsPanel />
          </div>
        </div>
      </div>
    </div>
  )
}
