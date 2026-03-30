import { useState, useEffect, useRef } from 'react'
import { Download, Loader } from 'lucide-react'
import { useGraphStore } from '../../stores/graphStore'
import type { ScorecardDimension, ScorecardCatalog } from '../../stores/graphStore'

function DimensionBar({ dim, enabled, onToggle }: { dim: ScorecardDimension; enabled: boolean; onToggle: () => void }) {
  const color = dim.score >= 65 ? 'bg-emerald-200 dark:bg-emerald-900'
    : dim.score >= 35 ? 'bg-amber-200 dark:bg-amber-900'
    : 'bg-red-200 dark:bg-red-900'
  return (
    <div className={`mb-1 ${!enabled ? 'opacity-40' : ''}`}>
      <div className="flex items-center justify-between text-[12px] mb-1 gap-1">
        <label className="flex items-center gap-1.5 cursor-pointer min-w-0">
          <input
            type="checkbox"
            checked={enabled}
            onChange={onToggle}
            className="accent-indigo-600 w-3 h-3 shrink-0"
          />
          <span className="text-gray-500 dark:text-gray-400 truncate">{dim.name}</span>
        </label>
        <span className="font-medium text-gray-800 dark:text-gray-200 shrink-0">{enabled ? dim.score : '—'}</span>
      </div>
      <div className="h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
        {enabled && <div className={`h-full rounded-full ${color}`} style={{ width: `${dim.score}%` }} />}
      </div>
    </div>
  )
}

function CatalogBar({ cat }: { cat: ScorecardCatalog }) {
  const color = cat.composite >= 65 ? 'bg-emerald-200 dark:bg-emerald-900'
    : cat.composite >= 35 ? 'bg-amber-200 dark:bg-amber-900'
    : 'bg-red-200 dark:bg-red-900'
  return (
    <div className="flex items-center gap-2 text-[12px] mb-1.5">
      <span className="text-gray-500 dark:text-gray-400 min-w-[60px] font-mono truncate">{cat.catalog_name}</span>
      <div className="flex-1 h-[5px] bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${cat.composite}%` }} />
      </div>
      <span className="font-medium text-gray-800 dark:text-gray-200 min-w-[20px] text-right">{cat.composite}</span>
    </div>
  )
}

function GradeBadge({ grade }: { grade: string }) {
  const colors: Record<string, string> = {
    A: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300',
    B: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
    C: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
    D: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
    F: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
  }
  return (
    <span className={`text-[13px] font-medium px-2.5 py-0.5 rounded-lg ${colors[grade] || colors.C}`}>
      {grade}
    </span>
  )
}

export function ScorecardPanel() {
  const { scorecardData, scorecardLoading, saveScorecardNotes, scorecardDisabledDims: disabledDims, toggleScorecardDim: toggleDim } = useGraphStore()
  const [notes, setNotes] = useState('')
  const [catalogOpen, setCatalogOpen] = useState(true)
  const notesRef = useRef<HTMLTextAreaElement>(null)
  const [showExport, setShowExport] = useState(false)

  useEffect(() => {
    if (scorecardData?.notes !== undefined) {
      setNotes(scorecardData.notes || '')
    }
  }, [scorecardData?.notes])

  // Recompute composite excluding disabled dimensions
  const activeDims = (scorecardData?.dimensions || []).filter(d => !disabledDims.has(d.key))
  const totalWeight = activeDims.reduce((s, d) => s + d.weight, 0)
  const adjustedComposite = totalWeight > 0
    ? Math.round(activeDims.reduce((s, d) => s + d.score * (d.weight / totalWeight), 0))
    : 0
  const adjustedGrade = adjustedComposite >= 80 ? 'A' : adjustedComposite >= 65 ? 'B' : adjustedComposite >= 50 ? 'C' : adjustedComposite >= 35 ? 'D' : 'F'
  const adjustedLabel = adjustedComposite >= 80 ? 'Well-governed' : adjustedComposite >= 65 ? 'Healthy with gaps' : adjustedComposite >= 50 ? 'Needs attention' : adjustedComposite >= 35 ? 'At risk' : 'Critical'

  if (scorecardLoading || !scorecardData) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 text-sm gap-2">
        <Loader size={14} className="animate-spin" /> Computing score...
      </div>
    )
  }

  if (!scorecardData.available) {
    return (
      <div className="p-6 text-center text-sm text-gray-400">
        <p className="mb-2">Workspace Scorecard requires system table access.</p>
        <p className="text-xs">Configure a SQL warehouse in Settings.</p>
      </div>
    )
  }

  const { score, dimensions, by_catalog } = scorecardData

  // Filter offenders by enabled dimensions (same logic as RecommendationsPanel)
  const OFFENDER_DIM_MAP: Record<string, string> = {
    cold_costly_tables: 'freshness', idle_compute: 'compute_utilization',
    orphaned_tables: 'orphan_rate', untagged_tables: 'tag_coverage',
    failing_jobs: '_jobs', stale_jobs: '_jobs', undocumented_tables: '_docs',
  }
  const filteredOffenders = (scorecardData.offenders || []).filter(g => {
    const dimKey = OFFENDER_DIM_MAP[g.category]
    if (!dimKey || dimKey.startsWith('_')) return true
    return !disabledDims.has(dimKey)
  })

  const handleExportJSON = () => {
    const exportData = {
      ...scorecardData,
      score: { ...scorecardData.score, composite: adjustedComposite, grade: adjustedGrade, label: adjustedLabel },
      dimensions: (dimensions || []).filter(d => !disabledDims.has(d.key)),
      offenders: filteredOffenders,
      notes,
    }
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `lattice-scorecard-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    setShowExport(false)
  }

  const handleExportCSV = () => {
    const rows: string[] = []
    // Notes in first row
    if (notes) {
      rows.push(`"Notes","${notes.replace(/"/g, '""')}"`)
      rows.push('')
    }
    rows.push('category,fqn,name,owner,created_at,last_queried,query_count_30d,detail,impact_score')
    for (const group of filteredOffenders) {
      for (const item of group.items) {
        const r = item as Record<string, unknown>
        const detail = Object.entries(r)
          .filter(([k]) => !['id', 'fqn', 'name', 'impact_score', 'owner', 'created_at', 'last_queried', 'query_count_30d', 'catalog_name', 'schema_name'].includes(k))
          .map(([k, v]) => v != null && v !== '' ? `${k}=${v}` : '')
          .filter(Boolean)
          .join('; ')
        rows.push(`"${group.label}","${r.fqn || ''}","${r.name || ''}","${r.owner || ''}","${r.created_at || ''}","${r.last_queried || ''}","${r.query_count_30d || ''}","${detail}","${r.impact_score || ''}"`)
      }
    }
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `lattice-scorecard-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    setShowExport(false)
  }

  const handleExportMarkdown = () => {
    const lines: string[] = []
    if (notes) lines.push(`> **Notes:** ${notes}`, '')
    lines.push(`# Workspace Scorecard`)
    lines.push(`**Score:** ${adjustedComposite} / 100 (${adjustedGrade} — ${adjustedLabel})`)
    if (disabledDims.size === 0 && score?.delta != null) {
      lines.push(`**Delta:** ${score.delta > 0 ? '+' : ''}${score.delta} vs. previous`)
    }
    lines.push('', '## Dimensions')
    for (const d of (dimensions || [])) {
      const status = disabledDims.has(d.key) ? '(excluded)' : `${d.score} (${(d.weight * 100).toFixed(0)}% weight)`
      lines.push(`- **${d.name}:** ${status}`)
    }
    lines.push('', '## Top Recommendations')
    for (const g of filteredOffenders) {
      lines.push(`### ${g.label} (${g.count})`)
      for (const i of g.items.slice(0, 3)) {
        lines.push(`- ${i.fqn || i.name}`)
      }
    }
    const md = lines.join('\n')
    navigator.clipboard.writeText(md)
    setShowExport(false)
  }

  return (
    <div className="p-5 flex flex-col gap-4 h-full">
      {/* Headline */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-[11px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">Workspace Scorecard</span>
          <span className="text-[11px] text-gray-400 dark:text-gray-500">
            {score?.computed_at ? new Date(score.computed_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : ''}
          </span>
        </div>
        <div className="flex items-baseline gap-3">
          <span className="text-[42px] font-medium leading-none text-gray-900 dark:text-gray-100">{adjustedComposite}</span>
          <GradeBadge grade={adjustedGrade} />
          {score?.delta != null && disabledDims.size === 0 && (
            <span className={`text-sm font-medium ${score.delta > 0 ? 'text-emerald-600 dark:text-emerald-400' : score.delta < 0 ? 'text-red-500' : 'text-gray-400'}`}>
              {score.delta > 0 ? '▲' : score.delta < 0 ? '▼' : '—'} {score.delta > 0 ? '+' : ''}{score.delta}
            </span>
          )}
        </div>
        {disabledDims.size > 0 ? (
          <p className="text-[11px] text-indigo-500 dark:text-indigo-400 mt-0.5">
            {disabledDims.size} dimension{disabledDims.size > 1 ? 's' : ''} excluded — score adjusted
          </p>
        ) : score?.delta != null ? (
          <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">vs. previous ingestion</p>
        ) : (
          <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">Baseline — no prior score</p>
        )}
      </div>

      {/* Dimension bars */}
      <div className="flex flex-col gap-2">
        {(dimensions || []).map(d => (
          <DimensionBar
            key={d.key}
            dim={d}
            enabled={!disabledDims.has(d.key)}
            onToggle={() => toggleDim(d.key)}
          />
        ))}
      </div>

      {/* By Catalog */}
      {by_catalog && by_catalog.length > 0 && by_catalog.some(c => c.composite > 0) && (
        <div className="border-t border-black/10 dark:border-white/10 pt-3">
          <button
            onClick={() => setCatalogOpen(v => !v)}
            className="text-[12px] font-medium text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-1"
          >
            By catalog {catalogOpen ? '▾' : '▸'}
          </button>
          {catalogOpen && by_catalog.map(c => <CatalogBar key={c.catalog_name} cat={c} />)}
        </div>
      )}

      {/* Notes */}
      <div className="border-t border-black/10 dark:border-white/10 pt-3">
        <label className="text-[12px] font-medium text-gray-500 dark:text-gray-400 block mb-1.5">Notes</label>
        <textarea
          ref={notesRef}
          value={notes}
          onChange={e => setNotes(e.target.value)}
          onBlur={() => saveScorecardNotes(notes)}
          placeholder="Add notes about this workspace..."
          className="w-full h-20 text-[12px] text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 border border-black/10 dark:border-white/10 rounded-lg p-2.5 resize-none focus:outline-none focus:ring-1 focus:ring-indigo-400 placeholder:text-gray-300 dark:placeholder:text-gray-600"
        />
        {scorecardData.notes_updated_at && (
          <p className="text-[10px] text-gray-300 dark:text-gray-600 mt-1">
            Last saved {new Date(scorecardData.notes_updated_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </p>
        )}
      </div>

      {/* Export */}
      <div className="mt-auto relative">
        <button
          onClick={() => setShowExport(v => !v)}
          className="w-full text-[12px] py-2 border border-black/15 dark:border-white/15 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex items-center justify-center gap-1.5"
        >
          <Download size={12} /> Export
        </button>
        {showExport && (
          <div className="absolute bottom-full left-0 right-0 mb-1 bg-white dark:bg-gray-800 border border-black/10 dark:border-white/10 rounded-lg shadow-lg overflow-hidden">
            <button onClick={handleExportJSON} className="w-full text-left px-3 py-2 text-[12px] text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">JSON — full scorecard payload</button>
            <button onClick={handleExportCSV} className="w-full text-left px-3 py-2 text-[12px] text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 border-t border-black/5 dark:border-white/5">CSV — offenders list</button>
            <button onClick={handleExportMarkdown} className="w-full text-left px-3 py-2 text-[12px] text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 border-t border-black/5 dark:border-white/5">Markdown — copy to clipboard</button>
          </div>
        )}
      </div>
    </div>
  )
}
