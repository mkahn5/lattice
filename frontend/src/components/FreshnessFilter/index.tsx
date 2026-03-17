import { useMemo, useState } from 'react'
import { useGraphStore } from '../../stores/graphStore'
import type { LatticeNode } from '../../types'
import { Info } from 'lucide-react'

const PRESETS = [
  { label: '7d',  days: 7 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
  { label: '1y',  days: 365 },
  { label: 'All', days: null },
]

function nodeTimestamp(n: LatticeNode): number | null {
  const raw = n.updated_at ?? n.created_at
  if (!raw) return null
  const ms = Number(raw)
  return isNaN(ms) ? null : ms
}

function Sparkline({ nodes, freshnessFilter, onSelectMonth }: {
  nodes: LatticeNode[]
  freshnessFilter: number | null
  onSelectMonth: (days: number) => void
}) {
  const [hovered, setHovered] = useState<number | null>(null)

  const buckets = useMemo(() => {
    const now = Date.now()
    // 18 monthly buckets going back 18 months
    const N = 18
    const counts = new Array(N).fill(0)
    const labels: string[] = []

    for (let i = N - 1; i >= 0; i--) {
      const d = new Date(now)
      d.setMonth(d.getMonth() - i)
      labels.push(d.toLocaleString('default', { month: 'short', year: '2-digit' }))
    }

    for (const n of nodes) {
      const ts = nodeTimestamp(n)
      if (!ts) continue
      const ageMs = now - ts
      const ageMo = ageMs / (1000 * 60 * 60 * 24 * 30.5)
      const idx = N - 1 - Math.floor(ageMo)
      if (idx >= 0 && idx < N) counts[idx]++
    }

    return counts.map((count, i) => ({
      count,
      label: labels[i],
      daysAgo: (N - 1 - i) * 30.5,
    }))
  }, [nodes])

  const max = Math.max(...buckets.map(b => b.count), 1)
  const cutoffDays = freshnessFilter

  return (
    <div className="flex flex-col gap-1">
      <span className="text-[9px] uppercase tracking-wider text-gray-400 font-semibold">
        Activity Timeline
      </span>
      <div className="flex items-end gap-[2px] h-8 w-full">
        {buckets.map((b, i) => {
          const h = Math.max(2, Math.round((b.count / max) * 28))
          const inRange = cutoffDays === null || b.daysAgo <= cutoffDays
          const isHovered = hovered === i
          return (
            <div
              key={i}
              className="relative flex-1 flex flex-col justify-end group cursor-pointer"
              style={{ height: 32 }}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => b.count > 0 && onSelectMonth(Math.ceil(b.daysAgo + 31))}
            >
              <div
                style={{ height: h }}
                className={`w-full rounded-sm transition-all duration-150 ${
                  isHovered ? 'bg-indigo-500' :
                  inRange && b.count > 0 ? 'bg-indigo-400' :
                  b.count > 0 ? 'bg-gray-200' : 'bg-gray-100'
                }`}
              />
              {isHovered && b.count > 0 && (
                <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[9px] rounded px-1.5 py-0.5 whitespace-nowrap z-10 pointer-events-none">
                  {b.count} · {b.label}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function FreshnessFilter() {
  const { nodes, freshnessFilter, setFreshnessFilter, viewMode, setViewMode } = useGraphStore()
  const showHint = viewMode === 'compute'

  return (
    <div className="flex flex-col gap-2 px-3 py-2 border-b border-gray-100">
      <Sparkline
        nodes={nodes}
        freshnessFilter={freshnessFilter}
        onSelectMonth={setFreshnessFilter}
      />
      <div className="flex gap-1">
        {PRESETS.map(({ label, days }) => {
          const active = freshnessFilter === days
          return (
            <button
              key={label}
              onClick={() => setFreshnessFilter(active ? null : days)}
              className={`flex-1 py-0.5 rounded text-[10px] font-medium transition-all ${
                active
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              {label}
            </button>
          )
        })}
      </div>
      {showHint && (
        <div className="flex items-start gap-1.5 text-[9px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5 leading-relaxed">
          <Info size={10} className="flex-shrink-0 mt-0.5" />
          <span>
            Activity Timeline works best with{' '}
            <button
              onClick={() => setViewMode('uc')}
              className="font-semibold underline underline-offset-2 hover:text-amber-900 transition-colors"
            >
              UC Tree
            </button>
            {' '}or{' '}
            <button
              onClick={() => setViewMode('all')}
              className="font-semibold underline underline-offset-2 hover:text-amber-900 transition-colors"
            >
              All
            </button>
            {' '}view — compute assets have no modification timestamps.
          </span>
        </div>
      )}
    </div>
  )
}
