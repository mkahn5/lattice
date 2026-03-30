import { useState, Fragment } from 'react'
import { useGraphStore } from '../../stores/graphStore'
import type { ScorecardOffenderGroup, ScorecardStructure, ScorecardCatalog } from '../../stores/graphStore'

function ImpactBadge({ score }: { score: number | undefined }) {
  if (score == null) return null
  const isHigh = score >= 2.0
  const bg = isHigh
    ? 'bg-red-50 text-red-600 dark:bg-red-900/40 dark:text-red-300'
    : 'bg-amber-50 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300'
  return (
    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-lg whitespace-nowrap ${bg}`}>
      +{score.toFixed(1)} pts
    </span>
  )
}

function fmtTs(raw: unknown): string {
  if (!raw) return ''
  const s = String(raw)
  const n = Number(s)
  const ts = !isNaN(n) && s.length >= 10 ? new Date(s.length <= 10 ? n * 1000 : n) : new Date(s)
  if (isNaN(ts.getTime())) return s
  return ts.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

function OffenderCard({ item }: { item: Record<string, unknown> }) {
  const [expanded, setExpanded] = useState(false)
  const fqn = (item.fqn as string) || (item.name as string) || ''
  const detailParts: string[] = []

  if (item.days_since_last_query != null) detailParts.push(`${item.days_since_last_query} days stale`)
  if (item.monthly_dbu != null && (item.monthly_dbu as number) > 0) detailParts.push(`${item.monthly_dbu} DBU/mo`)
  if (item.success_rate_pct != null) detailParts.push(`${item.success_rate_pct}% success rate`)
  if (item.total_runs_30d != null) detailParts.push(`${item.total_runs_30d} runs/30d`)
  if (item.query_count_30d != null && (item.query_count_30d as number) > 0) detailParts.push(`Queried ${item.query_count_30d} times/mo`)
  if (item.state) detailParts.push(String(item.state))
  if (item.dbu_30d === 0 && item.state) detailParts.push('0 DBU/30d')
  if (!detailParts.length && item.catalog_name) detailParts.push(`${item.catalog_name}.${item.schema_name}`)

  // Extended detail fields shown on expand
  const extendedFields: Array<[string, string]> = []
  if (item.owner) extendedFields.push(['Owner', String(item.owner)])
  if (item.creator_user_name) extendedFields.push(['Created by', String(item.creator_user_name)])
  if (item.created_at) extendedFields.push(['Created', fmtTs(item.created_at)])
  if (item.created_time) extendedFields.push(['Created', fmtTs(item.created_time)])
  if (item.updated_at) extendedFields.push(['Updated', fmtTs(item.updated_at)])
  if (item.last_queried) extendedFields.push(['Last queried', fmtTs(item.last_queried)])
  if (item.last_run) extendedFields.push(['Last run', fmtTs(item.last_run)])
  if (item.heat) extendedFields.push(['Heat', String(item.heat)])
  if (item.table_type) extendedFields.push(['Type', String(item.table_type)])
  if (item.num_rows != null) extendedFields.push(['Rows', Number(item.num_rows).toLocaleString()])
  if (item.size_mb != null) extendedFields.push(['Size', `${item.size_mb} MB`])
  if (item.schedule) extendedFields.push(['Schedule', String(item.schedule)])
  if (item.task_count) extendedFields.push(['Tasks', String(item.task_count)])
  if (item.comment) extendedFields.push(['Comment', String(item.comment)])

  return (
    <div
      className="px-3 py-2.5 rounded-lg border border-black/8 dark:border-white/8 hover:border-black/20 dark:hover:border-white/20 cursor-pointer transition-colors mb-0.5"
      onClick={() => setExpanded(v => !v)}
    >
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium font-mono text-gray-800 dark:text-gray-200 truncate">{fqn}</p>
          {detailParts.length > 0 && (
            <p className="text-[12px] text-gray-500 dark:text-gray-400 mt-0.5">{detailParts.join(' · ')}</p>
          )}
        </div>
        <ImpactBadge score={item.impact_score as number | undefined} />
      </div>
      {expanded && extendedFields.length > 0 && (
        <div className="mt-2 pt-2 border-t border-black/5 dark:border-white/5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
          {extendedFields.map(([label, value]) => (
            <Fragment key={label}>
              <span className="text-[11px] text-gray-400">{label}</span>
              <span className="text-[11px] text-gray-600 dark:text-gray-300 truncate">{value}</span>
            </Fragment>
          ))}
        </div>
      )}
    </div>
  )
}

const DISPLAY_LIMIT = 10

function OffenderGroup({ group, defaultExpanded }: { group: ScorecardOffenderGroup; defaultExpanded: boolean }) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const [showAll, setShowAll] = useState(false)
  const displayItems = showAll ? group.items : group.items.slice(0, DISPLAY_LIMIT)
  const hasMore = group.items.length > DISPLAY_LIMIT

  return (
    <div className="mb-1">
      <button
        onClick={() => setExpanded(v => !v)}
        className="text-[11px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1 flex items-center gap-1"
      >
        {group.label} ({group.count}) {expanded ? '▾' : '▸'}
      </button>
      {expanded && (
        <>
          {displayItems.map((item, i) => <OffenderCard key={`${group.category}-${i}`} item={item as Record<string, unknown>} />)}
          {hasMore && !showAll && (
            <button
              onClick={() => setShowAll(true)}
              className="text-[11px] text-indigo-500 hover:text-indigo-700 pl-3 mt-1"
            >
              Show all {group.items.length} →
            </button>
          )}
          {showAll && hasMore && (
            <button
              onClick={() => setShowAll(false)}
              className="text-[11px] text-indigo-500 hover:text-indigo-700 pl-3 mt-1"
            >
              Show less
            </button>
          )}
        </>
      )}
    </div>
  )
}

function StructureItem({ item }: { item: ScorecardStructure }) {
  const icon = item.severity === 'warning' ? '⚠' : item.severity === 'positive' ? '✓' : 'ℹ'
  const color = item.severity === 'warning' ? 'text-amber-600 dark:text-amber-400'
    : item.severity === 'positive' ? 'text-emerald-600 dark:text-emerald-400'
    : 'text-gray-400'
  return (
    <p className={`text-[12px] ${color} py-0.5`}>
      <span className="mr-1.5">{icon}</span>
      {item.message}
    </p>
  )
}

// Map offender categories to the dimension they relate to
const OFFENDER_DIM_MAP: Record<string, string> = {
  cold_costly_tables: 'freshness',
  idle_compute: 'compute_utilization',
  orphaned_tables: 'orphan_rate',
  untagged_tables: 'tag_coverage',
  // These are from dropped dimensions — always show unless user explicitly hides
  failing_jobs: '_jobs',
  stale_jobs: '_jobs',
  undocumented_tables: '_docs',
}

export function RecommendationsPanel() {
  const { scorecardData, scorecardLoading, fetchScorecard, scorecardDisabledDims } = useGraphStore()
  const [catalogFilter, setCatalogFilter] = useState<string>('')
  // Preserve the catalog list from the initial (unfiltered) scorecard load
  const [catalogList, setCatalogList] = useState<ScorecardCatalog[]>([])

  // Capture catalog list from the first load (before any filtering)
  if (scorecardData?.by_catalog && scorecardData.by_catalog.length > 0 && catalogList.length === 0) {
    setCatalogList(scorecardData.by_catalog)
  }

  if (!scorecardData?.available && !scorecardLoading) {
    return <div className="p-6 text-gray-400 text-sm">Scorecard data not available.</div>
  }

  // Use previous data while loading a catalog switch (prevents dropdown from disappearing)
  const data = scorecardData?.available ? scorecardData : null

  const score = data?.score
  // Filter offenders based on disabled dimensions
  const allOffenders = data?.offenders || []
  const offenders = allOffenders.filter(g => {
    const dimKey = OFFENDER_DIM_MAP[g.category]
    if (!dimKey) return true
    // Offenders from dropped dimensions (prefixed _) always show
    if (dimKey.startsWith('_')) return true
    return !scorecardDisabledDims.has(dimKey)
  })
  const workspace_structure = data?.workspace_structure

  const handleCatalogChange = (cat: string) => {
    setCatalogFilter(cat)
    fetchScorecard(cat || undefined)
  }

  // Estimate fix-to-target: sum of top 5 impact scores
  const allItems = (offenders || []).flatMap(g =>
    g.items.map(i => ({ ...i, _category: g.category }))
  )
  allItems.sort((a, b) => ((b as Record<string, unknown>).impact_score as number || 0) - ((a as Record<string, unknown>).impact_score as number || 0))
  const top5Impact = allItems.slice(0, 5).reduce((sum, i) => sum + ((i as Record<string, unknown>).impact_score as number || 0), 0)
  const estimatedScore = Math.min(100, Math.round((score?.composite || 0) + top5Impact))

  // Target grade
  const targetGrade = estimatedScore >= 80 ? 'A' : estimatedScore >= 65 ? 'B' : estimatedScore >= 50 ? 'C' : estimatedScore >= 35 ? 'D' : 'F'

  return (
    <div className="p-5 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-[15px] font-medium text-gray-800 dark:text-gray-200">Recommendations</h3>
        {catalogList.length > 0 && (
          <select
            value={catalogFilter}
            onChange={e => handleCatalogChange(e.target.value)}
            className="text-[12px] text-gray-500 dark:text-gray-400 bg-transparent border border-black/10 dark:border-white/10 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-400"
          >
            <option value="">All catalogs</option>
            {catalogList.map(c => <option key={c.catalog_name} value={c.catalog_name}>{c.catalog_name}</option>)}
          </select>
        )}
      </div>

      {/* Fix-to-target banner */}
      {top5Impact > 0 && (
        <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg px-3.5 py-2.5 text-[13px] text-blue-700 dark:text-blue-300">
          Fix the top 5 items to move from <strong>{score?.grade} ({score?.composite})</strong> → <strong>{targetGrade} ({estimatedScore})</strong>
        </div>
      )}

      {/* Offender groups */}
      <div className="flex flex-col gap-2">
        {(offenders || []).map((g, i) => (
          <OffenderGroup key={g.category} group={g} defaultExpanded={i < 3} />
        ))}
      </div>

      {/* Workspace Structure */}
      {workspace_structure && workspace_structure.length > 0 && (
        <div className="border-t border-black/10 dark:border-white/10 pt-3 mt-2">
          <p className="text-[11px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2">
            Workspace Structure
          </p>
          {workspace_structure.map((s, i) => <StructureItem key={i} item={s} />)}
        </div>
      )}

      {/* Table count note */}
      <p className="text-[10px] text-gray-300 dark:text-gray-600 mt-2">
        Based on {scorecardData?.table_count ?? 0} ingested tables · {scorecardData?.compute_count ?? 0} compute resources
      </p>
    </div>
  )
}
