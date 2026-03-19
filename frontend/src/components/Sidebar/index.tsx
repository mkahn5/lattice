import { useEffect, useMemo, useRef, useState } from 'react'
import { useGraphStore } from '../../stores/graphStore'
import type { NodeType } from '../../types'
import { Search, RefreshCw, Download, Globe, Database, ChevronDown, AlertTriangle, FileJson, HelpCircle, Tag, CheckCircle, XCircle, Loader, Settings } from 'lucide-react'
import { getTagColor } from '../../constants/tagConfig'
import { FreshnessFilter } from '../FreshnessFilter'
import { formatDBU } from '../../utils/costColors'

interface HealthData {
  orphaned_count: number
  unowned_count: number
  orphaned: { id: string; name: string; fqn: string; type: string }[]
  unowned: { id: string; name: string; fqn: string; type: string }[]
  enrichment_available: boolean
}

type HealthItem = { id: string; name: string; fqn: string; type: string }

function HealthModal({ items, title, slug, onNavigate, onHighlight, onClose }: {
  items: HealthItem[]
  title: string
  slug: string
  onNavigate: (id: string) => void
  onHighlight: (ids: Set<string>) => void
  onClose: () => void
}) {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const filtered = query
    ? items.filter(n => n.name.toLowerCase().includes(query.toLowerCase()) || n.fqn.toLowerCase().includes(query.toLowerCase()))
    : items

  const allSelected = filtered.length > 0 && filtered.every(n => selected.has(n.id))
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(filtered.map(n => n.id)))
  const toggleRow = (id: string) => setSelected(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })

  const exportCsv = () => {
    const rows = [['Name', 'Type', 'FQN'], ...items.map(n => [n.name, n.type, n.fqn])]
    const csv = rows.map(r => r.map(v => `"${v.replace(/"/g, '""')}"`).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    const a = document.createElement('a'); a.href = url; a.download = `${slug}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-[660px] max-h-[72vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <div>
            <div className="text-sm font-semibold text-gray-800">{title}</div>
            <div className="text-[11px] text-gray-400">
              {filtered.length} of {items.length} shown
              {selected.size > 0 && <span className="text-amber-600 font-medium"> · {selected.size} selected</span>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {selected.size > 0 && (
              <button
                onClick={() => { onHighlight(selected); onClose() }}
                className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium bg-amber-50 border border-amber-300 text-amber-700 rounded-lg hover:bg-amber-100 transition-all"
                title="Highlight selected on canvas"
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <circle cx="5" cy="5" r="4" stroke="currentColor" strokeWidth="1.5"/>
                  <circle cx="5" cy="5" r="1.5" fill="currentColor"/>
                </svg>
                Highlight {selected.size} on canvas
              </button>
            )}
            <button
              onClick={exportCsv}
              className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium bg-white border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-all"
              title="Export all as CSV"
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M5 1v6M2.5 5l2.5 2.5L7.5 5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M1 8.5h8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
              Export CSV
            </button>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none px-1">✕</button>
          </div>
        </div>
        {/* Search */}
        <div className="px-4 py-2 border-b border-gray-100">
          <input
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Filter by name or FQN…"
            className="w-full text-xs border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-400"
          />
        </div>
        {/* Table */}
        <div className="overflow-y-auto flex-1">
          <table className="w-full text-[11px] border-collapse">
            <thead className="sticky top-0 bg-gray-50 z-10">
              <tr className="text-left text-gray-500 font-semibold">
                <th className="pl-4 pr-2 py-2 border-b border-gray-100 w-8">
                  <input type="checkbox" checked={allSelected} onChange={toggleAll} className="cursor-pointer" />
                </th>
                <th className="px-2 py-2 border-b border-gray-100">Name</th>
                <th className="px-2 py-2 border-b border-gray-100">Type</th>
                <th className="px-2 py-2 border-b border-gray-100 text-gray-400 font-normal">FQN</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((n, i) => {
                const isSelected = selected.has(n.id)
                return (
                  <tr
                    key={n.id}
                    className={`hover:bg-indigo-50 ${isSelected ? 'bg-amber-50' : i % 2 === 0 ? '' : 'bg-gray-50/60'}`}
                  >
                    <td className="pl-4 pr-2 py-1.5" onClick={() => toggleRow(n.id)}>
                      <input type="checkbox" checked={isSelected} onChange={() => toggleRow(n.id)} className="cursor-pointer" />
                    </td>
                    <td
                      className="px-2 py-1.5 font-medium text-gray-700 cursor-pointer hover:text-indigo-600 hover:underline"
                      onClick={() => { onNavigate(n.id); onClose() }}
                    >
                      {n.name}
                    </td>
                    <td className="px-2 py-1.5 text-gray-500">{n.type}</td>
                    <td className="px-2 py-1.5 text-gray-400 font-mono truncate max-w-[240px]" title={n.fqn}>{n.fqn}</td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-400">No matches</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function HealthPanel() {
  const { selectNode, stats, setHighlightedIds } = useGraphStore()
  const [health, setHealth] = useState<HealthData | null>(null)
  const [open, setOpen] = useState(false)
  const [modal, setModal] = useState<'orphaned' | 'unowned' | null>(null)
  const PREVIEW = 8

  useEffect(() => {
    if (!stats) return
    fetch('/api/health')
      .then(r => r.json())
      .then(d => setHealth(d))
      .catch(() => {})
  }, [stats])

  if (!health || !stats) return null

  const hasIssues = health.orphaned_count > 0 || health.unowned_count > 0

  return (
    <>
      {modal === 'orphaned' && (
        <HealthModal
          items={health.orphaned}
          title={`Orphaned tables — zero queries in 30d (${health.orphaned_count})`}
          slug="orphaned-tables"
          onNavigate={selectNode}
          onHighlight={ids => setHighlightedIds(ids)}
          onClose={() => setModal(null)}
        />
      )}
      {modal === 'unowned' && (
        <HealthModal
          items={health.unowned}
          title={`Active tables with no owner set (${health.unowned_count})`}
          slug="unowned-active-tables"
          onNavigate={selectNode}
          onHighlight={ids => setHighlightedIds(ids)}
          onClose={() => setModal(null)}
        />
      )}
      <div className="px-3 py-2 border-b border-gray-100">
        <button
          onClick={() => setOpen(v => !v)}
          className={`w-full flex items-center justify-between text-[10px] ${hasIssues ? 'text-amber-600 hover:text-amber-700' : 'text-gray-400 hover:text-gray-600'}`}
          title="Orphaned tables and active tables with no owner set"
        >
          <div className="flex items-center gap-1">
            <AlertTriangle size={10} />
            <span className="font-semibold">Health</span>
          </div>
          <div className="flex items-center gap-2">
            {hasIssues ? (
              <>
                {health.orphaned_count > 0 && <span>{health.orphaned_count} orphaned</span>}
                {health.unowned_count > 0 && <span>{health.unowned_count} unowned</span>}
              </>
            ) : (
              <span className="text-[9px]">{health.enrichment_available ? 'no issues' : 'no data'}</span>
            )}
            <ChevronDown size={10} className={open ? 'rotate-180' : ''} />
          </div>
        </button>
        {open && (
          <div className="mt-2 space-y-2 text-[10px]">
            {!health.enrichment_available ? (
              <div className="text-gray-400 leading-relaxed">
                <div className="font-medium text-gray-500 mb-1">Requires system table access</div>
                <div>Orphaned table detection needs query history from <span className="font-mono">system.query.history</span>. To enable:</div>
                <ol className="mt-1 list-decimal list-inside space-y-0.5 text-gray-400">
                  <li>Set <span className="font-mono">DATABRICKS_WAREHOUSE_ID</span> in app.yaml</li>
                  <li>Grant SELECT on <span className="font-mono">system.query.history</span></li>
                  <li>Refresh the workspace</li>
                </ol>
              </div>
            ) : !hasIssues ? (
              <div className="text-gray-400">
                <div className="font-medium text-gray-500 mb-1">All clear</div>
                <div><span className="font-medium">Orphaned</span> = cold Tables/Views with zero queries in 30 days.</div>
                <div className="mt-1"><span className="font-medium">Unowned</span> = active Tables/Views with no owner — governance risk.</div>
              </div>
            ) : null}
            {health.orphaned_count > 0 && (
              <div>
                <div className="text-[9px] uppercase tracking-wider text-gray-400 mb-1 font-semibold">
                  Orphaned — zero queries in 30d ({health.orphaned_count})
                </div>
                <div className="space-y-0.5">
                  {health.orphaned.slice(0, PREVIEW).map(n => (
                    <button key={n.id} onClick={() => selectNode(n.id)}
                      className="text-left w-full truncate text-gray-600 hover:text-indigo-600 hover:underline" title={n.fqn}>
                      {n.name}
                    </button>
                  ))}
                </div>
                {health.orphaned_count > PREVIEW && (
                  <button
                    onClick={() => setModal('orphaned')}
                    className="mt-1 text-[9px] text-indigo-500 hover:text-indigo-700 hover:underline"
                  >
                    Browse all {health.orphaned_count} →
                  </button>
                )}
              </div>
            )}
            {health.unowned_count > 0 && (
              <div>
                <div className="text-[9px] uppercase tracking-wider text-gray-400 mb-1 font-semibold">
                  Active, no owner ({health.unowned_count})
                </div>
                <div className="space-y-0.5">
                  {health.unowned.slice(0, PREVIEW).map(n => (
                    <button key={n.id} onClick={() => selectNode(n.id)}
                      className="text-left w-full truncate text-gray-600 hover:text-indigo-600 hover:underline" title={n.fqn}>
                      {n.name}
                    </button>
                  ))}
                </div>
                {health.unowned_count > PREVIEW && (
                  <button
                    onClick={() => setModal('unowned')}
                    className="mt-1 text-[9px] text-indigo-500 hover:text-indigo-700 hover:underline"
                  >
                    Browse all {health.unowned_count} →
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}

interface ProgressState {
  step: string
  pct: number
  done: boolean
  error: boolean
  graph_ready: boolean
}

// Maps progress % to a human-readable phase label
function phaseLabel(_step: string, pct: number, done: boolean, error: boolean): string {
  if (error) return 'Ingestion failed'
  if (done) return 'Ready'
  if (pct <= 12) return 'Connecting…'
  if (pct <= 40) return 'Loading compute & jobs…'
  if (pct <= 68) return 'Loading Unity Catalog…'
  if (pct <= 88) return 'Fetching usage & lineage…'
  return 'Building graph…'
}

function IngestionStatus() {
  const { refreshGraph, stats } = useGraphStore()
  const [progress, setProgress] = useState<ProgressState | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [doneAt, setDoneAt] = useState<Date | null>(null)
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let prevDone = false
    const poll = async () => {
      try {
        const res = await fetch('/api/progress')
        const data: ProgressState = await res.json()
        setProgress(data)
        if (data.done && !data.error && !prevDone) setDoneAt(new Date())
        // Detect workspace switch: done went from true → false
        if (!data.done && prevDone) { setDoneAt(null) }
        prevDone = data.done
        // Always keep polling (workspace switch resets progress)
        pollRef.current = setTimeout(poll, data.done ? 5000 : 1200)
      } catch {
        pollRef.current = setTimeout(poll, 3000)
      }
    }
    poll()
    return () => { if (pollRef.current) clearTimeout(pollRef.current) }
  }, [])

  // Re-poll after manual refresh
  const handleRefresh = () => {
    setProgress(null)
    setDoneAt(null)
    refreshGraph()
    const poll = async () => {
      try {
        const res = await fetch('/api/progress')
        const data: ProgressState = await res.json()
        setProgress(data)
        if (data.done && !data.error) setDoneAt(new Date())
        if (!data.done) pollRef.current = setTimeout(poll, 1200)
      } catch {
        pollRef.current = setTimeout(poll, 3000)
      }
    }
    if (pollRef.current) clearTimeout(pollRef.current)
    setTimeout(poll, 600)
  }

  if (!progress) return null

  const { pct, done, error, step } = progress
  const isRunning = !done && !error
  const phase = phaseLabel(step, pct, done, error)

  return (
    <div className="px-3 py-1.5 border-b border-gray-100">
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-1.5 text-[10px] text-left"
      >
        {/* Status icon */}
        {isRunning ? (
          <Loader size={10} className="shrink-0 text-indigo-500 animate-spin" />
        ) : error ? (
          <XCircle size={10} className="shrink-0 text-red-500" />
        ) : (
          <CheckCircle size={10} className="shrink-0 text-green-500" />
        )}

        {/* Phase text */}
        <span className={`flex-1 truncate font-medium ${
          error ? 'text-red-600' : isRunning ? 'text-indigo-600' : 'text-gray-500'
        }`}>
          {phase}
        </span>

        {/* Percentage when running */}
        {isRunning && (
          <span className="shrink-0 text-gray-400 font-mono">{pct}%</span>
        )}

        {/* Stats when ready */}
        {done && !error && stats && (
          <span className="shrink-0 text-gray-400">
            {stats.node_count.toLocaleString()} assets
            {doneAt && (
              <span className="ml-1.5 text-gray-300">
                {doneAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </span>
        )}

        <ChevronDown size={9} className={`shrink-0 text-gray-300 transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>

      {/* Progress bar — always visible when running */}
      {isRunning && (
        <div className="mt-1 h-0.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-indigo-400 rounded-full transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      )}

      {/* Expanded detail */}
      {expanded && (
        <div className="mt-1.5 text-[10px] text-gray-400 space-y-1">
          {/* Step breakdown */}
          <div className="space-y-0.5">
            {[
              { label: 'Connect & auth', threshold: 12 },
              { label: 'Compute & jobs', threshold: 40 },
              { label: 'Unity Catalog', threshold: 68 },
              { label: 'Usage & lineage', threshold: 88 },
              { label: 'Build graph', threshold: 100 },
            ].map(({ label, threshold }) => {
              const isDone = done ? !error : pct >= threshold
              const isActive = !done && pct < threshold && pct >= (threshold === 12 ? 0 : threshold - 28)
              return (
                <div key={label} className="flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                    isDone ? 'bg-green-400' : isActive ? 'bg-indigo-400 animate-pulse' : 'bg-gray-200'
                  }`} />
                  <span className={isDone ? 'text-gray-500' : isActive ? 'text-indigo-500 font-medium' : 'text-gray-300'}>
                    {label}
                  </span>
                </div>
              )
            })}
          </div>

          {/* Raw step text */}
          {isRunning && (
            <div className="text-[9px] text-gray-300 truncate pt-0.5 border-t border-gray-100" title={step}>
              {step}
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className="text-red-500 text-[10px] leading-relaxed">
              {step}
              <button
                onClick={handleRefresh}
                className="ml-2 text-indigo-500 hover:underline"
              >
                Retry
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function TagFilterPanel() {
  const { annotations, allTags, tagConfig, activeTagFilter, setActiveTagFilter, annotationsAvailable } = useGraphStore()
  const [open, setOpen] = useState(false)

  // Compute per-tag counts from annotations
  const tagCounts = useMemo<Record<string, number>>(() => {
    const counts: Record<string, number> = {}
    for (const ann of Object.values(annotations)) {
      for (const tag of ann.tags ?? []) {
        counts[tag] = (counts[tag] ?? 0) + 1
      }
    }
    return counts
  }, [annotations])

  const tagsWithCount = allTags.filter(t => tagCounts[t] > 0)

  if (!annotationsAvailable || tagsWithCount.length === 0) return null

  return (
    <div className="px-3 py-2 border-b border-gray-100">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between text-[10px] text-gray-500 hover:text-gray-700 font-semibold"
      >
        <div className="flex items-center gap-1">
          <Tag size={10} />
          <span>Tags</span>
          {activeTagFilter && (
            <span className="ml-1 px-1.5 py-0 bg-indigo-100 text-indigo-600 rounded-full font-medium">
              {activeTagFilter}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {activeTagFilter && (
            <button
              onClick={e => { e.stopPropagation(); setActiveTagFilter(null) }}
              className="text-gray-400 hover:text-gray-600 text-[10px]"
              title="Clear tag filter"
            >
              ✕
            </button>
          )}
          <ChevronDown size={10} className={open ? 'rotate-180' : ''} />
        </div>
      </button>

      {open && (
        <div className="mt-2 flex flex-wrap gap-1">
          {tagsWithCount.map(tag => {
            const colorName = tagConfig[tag]?.color ?? 'teal'
            const colors = getTagColor(colorName)
            const isActive = activeTagFilter === tag
            return (
              <button
                key={tag}
                onClick={() => setActiveTagFilter(isActive ? null : tag)}
                title={`Filter canvas to ${tag} (${tagCounts[tag]} nodes)`}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium transition-all border ${
                  isActive
                    ? `${colors.bg} ${colors.text} border-current shadow-sm ring-1 ring-offset-1 ring-indigo-400`
                    : `${colors.bg} ${colors.text} border-transparent hover:border-current/30 opacity-75 hover:opacity-100`
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: colors.dot }} />
                {tag}
                <span className="ml-0.5 opacity-60">{tagCounts[tag]}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function CostPanel() {
  const { selectNode, costOverlayEnabled, costData, costDataLoading, toggleCostOverlay, fetchCostData } = useGraphStore()
  const [open, setOpen] = useState(false)

  // Auto-open when overlay turns on
  useEffect(() => {
    if (costOverlayEnabled) setOpen(true)
  }, [costOverlayEnabled])

  const topSchemas = costData?.summary?.top_schemas?.slice(0, 5) ?? []
  const maxDbu = topSchemas.reduce((m, s) => Math.max(m, s.total_dbu), 0)

  return (
    <div className="px-3 py-2 border-b border-gray-100">
      <div className="flex items-center justify-between">
        <button
          onClick={() => setOpen(v => !v)}
          className="flex items-center gap-1 text-[10px] text-gray-500 hover:text-gray-700 font-semibold"
        >
          <span>💰</span>
          <span>Cost</span>
          <ChevronDown size={10} className={open ? 'rotate-180' : ''} />
        </button>
        {/* Toggle switch */}
        <button
          onClick={toggleCostOverlay}
          title={costOverlayEnabled ? 'Disable cost overlay' : 'Enable cost overlay'}
          className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors ${
            costOverlayEnabled ? 'bg-amber-500' : 'bg-gray-300'
          }`}
        >
          <span
            className={`inline-block h-3 w-3 transform rounded-full bg-white shadow transition-transform ${
              costOverlayEnabled ? 'translate-x-3.5' : 'translate-x-0.5'
            }`}
          />
        </button>
      </div>

      {open && (
        <div className="mt-2 space-y-2 text-[10px]">
          {costDataLoading ? (
            <div className="text-gray-400">Loading cost data…</div>
          ) : !costData ? (
            <div className="text-gray-400">Toggle on to load cost attribution data.</div>
          ) : !costData.available ? (
            <div className="text-gray-400 leading-relaxed space-y-1.5">
              {(costData as {reason?: string}).reason === 'no_billing_data' ? (
                <>
                  <div className="font-medium text-gray-500">No billing data</div>
                  <div>Enrichment is running but <span className="font-mono">system.billing.usage</span> returned no DBU records for this workspace in the last 30 days.</div>
                  <div>Check that you have SELECT access on <span className="font-mono">system.billing.usage</span> and that warehouses/jobs have run recently.</div>
                </>
              ) : (
                <>
                  <div className="font-medium text-gray-500">Requires enrichment</div>
                  <div>Cost overlay needs a SQL warehouse + SELECT on <span className="font-mono">system.billing.usage</span>.</div>
                  <ol className="list-decimal list-inside space-y-0.5 text-gray-400">
                    <li>Set <span className="font-mono">DATABRICKS_WAREHOUSE_ID</span> in app.yaml</li>
                    <li>Grant SELECT on <span className="font-mono">system.billing.usage</span></li>
                    <li>Refresh the workspace</li>
                  </ol>
                </>
              )}
              <button
                onClick={fetchCostData}
                className="text-[10px] text-indigo-500 hover:text-indigo-700 underline"
              >
                Retry
              </button>
            </div>
          ) : (
            <>
              <div className="text-gray-500 font-medium">
                {formatDBU(costData.summary.total_workspace_dbu_30d)} total (30d)
              </div>
              {topSchemas.length > 0 && (
                <div className="space-y-1">
                  <div className="text-[9px] uppercase tracking-wider text-gray-400 font-semibold">Top schemas</div>
                  {topSchemas.map(s => (
                    <button
                      key={s.id}
                      onClick={() => selectNode(s.id)}
                      className="w-full text-left group"
                    >
                      <div className="flex items-center gap-1 mb-0.5">
                        <span className="truncate text-gray-600 group-hover:text-indigo-600 flex-1" title={s.fqn}>{s.name}</span>
                        <span className="font-mono text-gray-400 shrink-0">{formatDBU(s.total_dbu)}</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500"
                          style={{ width: `${maxDbu > 0 ? (s.total_dbu / maxDbu) * 100 : 0}%` }}
                        />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

const GUIDE_STEPS = [
  {
    title: 'What is Lattice?',
    content: 'Lattice maps your entire Databricks workspace as an interactive knowledge graph — catalogs, schemas, tables, jobs, dashboards, pipelines, and the lineage edges between them.',
  },
  {
    title: 'Navigating the Canvas',
    content: 'Drag to pan, scroll to zoom. Click any node to open its detail panel on the right. Use the top-center controls to switch between UC Tree, Compute, and All views, or change the layout (Tree →, Tree ↓, Lanes).',
  },
  {
    title: 'Multi-Select',
    content: 'Select multiple nodes at once using two methods:\n\n• Shift + drag on empty canvas — draw a rubber-band box to select all nodes inside\n• Shift + click individual nodes — toggle each node in/out of the selection\n• Cmd/Ctrl + A — select all visible nodes\n• Escape — clear the selection\n\nWhen 2+ nodes are selected, the right panel switches to bulk-tag mode.',
  },
  {
    title: 'Focus & Radial Layout',
    content: 'Select any node, then click the Focus button (top-center toolbar) to pull all directly connected nodes into a ring around it. This is useful for exploring what a specific table, job, or dashboard is connected to without losing context.',
  },
  {
    title: 'Filtering & Search',
    content: 'Use the search box to filter by name, FQN, or owner. Toggle asset types in the left panel to show/hide node types. Use the Freshness filter to surface recently-updated assets.',
  },
  {
    title: 'Tags & Annotations',
    content: 'Click any node to open its detail panel, then add tags (e.g. "critical", "pii", "deprecated") and notes. Tags appear as colored dots on the canvas. Use the Tags filter in the sidebar to spotlight all nodes with a given tag.',
  },
  {
    title: 'Lineage & Impact',
    content: 'Toggle "Lineage" (top-center) to show data flow edges between tables, jobs, and dashboards. Select any node and click "Analyze" in the detail panel to see what depends on it or what it contains.',
  },
  {
    title: 'Health & Cost',
    content: 'The Health panel shows orphaned tables (cold, unqueried) and unowned assets. The Cost panel (💰) overlays DBU spend on the canvas — nodes color from light amber to deep orange by cost intensity.',
  },
  {
    title: 'Save & Export',
    content: 'Use "Save View" (top-center) to freeze the current canvas for side-by-side comparison. Export the full graph as JSON or JSON-LD for use with AI agents or external tools.',
  },
]

function GettingStartedModal({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0)
  const total = GUIDE_STEPS.length

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-[420px] max-w-[90vw] overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <div className="font-bold text-gray-800 text-base">Getting Started</div>
            <div className="text-[11px] text-gray-400 mt-0.5">Lattice — Databricks Workspace Graph</div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 p-1 rounded hover:bg-gray-100">
            ✕
          </button>
        </div>

        {/* Step indicators */}
        <div className="px-5 pt-3 flex gap-1">
          {GUIDE_STEPS.map((_, i) => (
            <button
              key={i}
              onClick={() => setStep(i)}
              className={`flex-1 h-1 rounded-full transition-all ${i === step ? 'bg-indigo-500' : i < step ? 'bg-indigo-200' : 'bg-gray-200'}`}
            />
          ))}
        </div>

        {/* Content */}
        <div className="px-5 py-4 min-h-[120px]">
          <div className="text-sm font-semibold text-gray-700 mb-2">{GUIDE_STEPS[step].title}</div>
          <div className="text-[13px] text-gray-500 leading-relaxed">{GUIDE_STEPS[step].content}</div>
        </div>

        {/* Navigation */}
        <div className="px-5 pb-4 flex items-center justify-between">
          <span className="text-[11px] text-gray-400">{step + 1} / {total}</span>
          <div className="flex gap-2">
            {step > 0 && (
              <button
                onClick={() => setStep(s => s - 1)}
                className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
              >
                Back
              </button>
            )}
            {step < total - 1 ? (
              <button
                onClick={() => setStep(s => s + 1)}
                className="px-3 py-1.5 text-xs rounded-lg bg-indigo-600 text-white hover:bg-indigo-700"
              >
                Next
              </button>
            ) : (
              <button
                onClick={onClose}
                className="px-3 py-1.5 text-xs rounded-lg bg-indigo-600 text-white hover:bg-indigo-700"
              >
                Got it
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

const ALL_TYPES: NodeType[] = [
  'Catalog', 'Schema', 'Table', 'View', 'Model', 'Volume', 'StreamingTable', 'MaterializedView', 'Database',
  'ForeignCatalog', 'Connection', 'Share', 'Recipient',
  'Warehouse', 'Serverless', 'Cluster', 'Job', 'Dashboard', 'Pipeline', 'App',
]

const TYPE_COLORS: Record<NodeType, string> = {
  Catalog: '#6366f1', Schema: '#3b82f6', Table: '#22c55e', View: '#14b8a6',
  Model: '#ec4899', Volume: '#92400e', StreamingTable: '#0369a1', MaterializedView: '#7c3aed', Database: '#84cc16',
  ForeignCatalog: '#f43f5e', Connection: '#78716c', Share: '#d946ef', Recipient: '#fb923c',
  Warehouse: '#f97316', Serverless: '#06b6d4', Cluster: '#6b7280', Job: '#a855f7', Dashboard: '#f59e0b', Pipeline: '#b91c1c', App: '#0ea5e9',
}

const UC_TYPES = new Set(['Catalog', 'Schema', 'Table', 'View', 'Model', 'Volume', 'StreamingTable', 'MaterializedView', 'Database', 'ForeignCatalog', 'Connection', 'Share', 'Recipient'])
const COMPUTE_TYPES = new Set(['Warehouse', 'Serverless', 'Cluster', 'Job', 'Dashboard', 'App', 'Pipeline'])

interface Profile { name: string; host: string; active: boolean; source?: 'lattice' | 'databrickscfg' | 'app' | 'env' }
interface CatalogInfo { name: string; type: string; active: boolean }

function pollUntilReady(onReady: () => void, onDone: () => void) {
  let readyFired = false
  const poll = async () => {
    try {
      const res = await fetch('/api/progress')
      const data = await res.json()
      if (data.graph_ready && !readyFired) {
        readyFired = true
        onReady()
        // Keep polling until fully done so we reload the complete graph
        if (!data.done) setTimeout(poll, 2000)
        return
      }
      if (data.done) {
        // Final reload with the complete graph
        onReady()
        onDone()
        return
      }
      setTimeout(poll, 1500)
    } catch {
      setTimeout(poll, 3000)
    }
  }
  setTimeout(poll, 1000)
}

function ProfileSwitcher({ onSwitching }: { onSwitching: (v: boolean) => void }) {
  const { loadGraph, loadInfo } = useGraphStore()
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [open, setOpen] = useState(false)
  const [switching, setSwitching] = useState(false)
  const active = profiles.find(p => p.active)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const fetchProfiles = () => {
    fetch('/api/profiles')
      .then(r => r.json())
      .then(d => setProfiles(d.profiles ?? []))
      .catch(() => {})
  }

  // Fetch on mount and periodically (picks up profiles added in Settings)
  useEffect(() => {
    fetchProfiles()
    const interval = setInterval(fetchProfiles, 10000)
    return () => clearInterval(interval)
  }, [])

  // Close dropdown on click outside
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const switchTo = async (profile: string) => {
    setSwitching(true)
    onSwitching(true)
    setOpen(false)
    try {
      const resp = await fetch('/api/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile }),
      })
      if (!resp.ok) {
        setSwitching(false)
        onSwitching(false)
        return
      }
      setProfiles(p => p.map(x => ({ ...x, active: x.name === profile })))
      // Clear old graph and show loading state
      useGraphStore.setState({ nodes: [], edges: [], stats: { node_count: 0, edge_count: 0, node_types: {} }, collapsedSchemas: new Set(), selectedNodeIds: new Set(), loading: true })
      // Try loading cached graph immediately (backend serves cache within ms)
      setTimeout(async () => {
        try { await loadGraph(); await loadInfo() } catch {}
      }, 500)
      pollUntilReady(
        async () => {
          await loadGraph()
          await loadInfo()
        },
        () => { setSwitching(false); onSwitching(false) },
      )
    } catch {
      setSwitching(false)
      onSwitching(false)
    }
  }

  if (profiles.length < 2) return null

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1 text-[10px] text-gray-500 hover:text-gray-800 max-w-full"
        title="Switch workspace profile"
      >
        {switching
          ? <Loader size={10} className="shrink-0 text-indigo-500 animate-spin" />
          : <Globe size={10} className="shrink-0 text-gray-400" />
        }
        <span className="truncate">{active?.host?.replace(/^https?:\/\//, '').replace(/\/$/, '') || 'Default workspace'}</span>
        <ChevronDown size={10} className="shrink-0" />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 bg-white border border-gray-200 rounded-lg shadow-lg w-72 text-xs">
          <div className="px-3 py-2 border-b border-gray-100 text-[10px] uppercase tracking-wider text-gray-400 font-semibold">
            {switching ? 'Switching workspace…' : 'Switch Workspace'}
          </div>
          <div className="max-h-48 overflow-y-auto">
            {profiles.map(p => (
              <button
                key={p.name}
                onClick={() => switchTo(p.name)}
                className={`w-full text-left px-3 py-2 hover:bg-gray-50 flex flex-col gap-0.5 ${p.active ? 'bg-indigo-50' : ''}`}
              >
                <span className={`font-medium ${p.active ? 'text-indigo-700' : 'text-gray-700'}`}>
                  {p.name} {p.active && <span className="text-[10px] font-normal text-indigo-400">active</span>}
                  {' '}<span className={`text-[8px] px-1 py-0.5 rounded ${
                    p.source === 'lattice' ? 'bg-amber-50 text-amber-600' :
                    p.source === 'app' ? 'bg-green-50 text-green-600' :
                    'bg-gray-100 text-gray-400'
                  }`}>
                    {p.source === 'lattice' ? 'PAT' : p.source === 'app' ? 'APP' : p.source === 'env' ? 'ENV' : 'CLI'}
                  </span>
                </span>
                <span className="text-[10px] text-gray-400 truncate">{p.host}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function CatalogSelector({ disabled }: { disabled: boolean }) {
  const { loadGraph, loadInfo, workspaceInfo } = useGraphStore()
  const [catalogs, setCatalogs] = useState<CatalogInfo[]>([])
  const [open, setOpen] = useState(false)
  const [switching, setSwitching] = useState(false)
  const [search, setSearch] = useState('')
  const [totalHint, setTotalHint] = useState(0)
  const ref = useRef<HTMLDivElement>(null)

  const currentFilter = workspaceInfo?.catalog_filter

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const fetchCatalogs = (q = '') => {
    fetch(`/api/catalogs?q=${encodeURIComponent(q)}&limit=200`)
      .then(r => r.json())
      .then(d => { setCatalogs(d.catalogs ?? []); setTotalHint(d.total_hint ?? 0) })
      .catch(() => {})
  }

  useEffect(() => {
    if (!open) return
    const t = setTimeout(() => fetchCatalogs(search), search ? 200 : 0)
    return () => clearTimeout(t)
  }, [search, open])

  const handleOpen = () => {
    if (disabled || switching) return
    const next = !open
    setOpen(next)
    if (next) { setSearch(''); fetchCatalogs('') }
  }

  const selectCatalog = async (catalogName: string) => {
    setSwitching(true)
    setOpen(false)
    setSearch('')
    try {
      await fetch('/api/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ catalog: catalogName }),
      })
      pollUntilReady(
        async () => { await loadGraph(); await loadInfo(); setSwitching(false) },
        () => setSwitching(false),
      )
    } catch {
      setSwitching(false)
    }
  }

  const label = currentFilter?.length ? currentFilter.join(', ') : 'all catalogs'

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={handleOpen}
        disabled={disabled || switching}
        className="flex items-center gap-1 text-[10px] text-gray-500 hover:text-gray-800 disabled:opacity-50 max-w-full"
        title="Filter by catalog"
      >
        <Database size={10} className="shrink-0 text-gray-400" />
        <span className="truncate max-w-[160px]">{label}</span>
        <ChevronDown size={10} className="shrink-0" />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 bg-white border border-gray-200 rounded-lg shadow-lg w-64 text-xs">
          <div className="px-3 py-2 border-b border-gray-100 text-[10px] uppercase tracking-wider text-gray-400 font-semibold">
            Filter Catalog
          </div>

          {/* Search input */}
          <div className="p-2 border-b border-gray-100">
            <input
              autoFocus
              type="text"
              placeholder="Search catalogs…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded px-2 py-1 text-[11px] outline-none focus:border-indigo-400"
            />
          </div>

          <div className="max-h-52 overflow-y-auto">
            {/* All catalogs option */}
            {!search && (
              <button
                onClick={() => selectCatalog('')}
                className={`w-full text-left px-3 py-2 hover:bg-gray-50 ${!currentFilter?.length ? 'bg-indigo-50' : ''}`}
              >
                <span className={`font-medium ${!currentFilter?.length ? 'text-indigo-700' : 'text-gray-500'}`}>
                  All catalogs
                  {!currentFilter?.length && <span className="ml-1.5 text-[10px] font-normal text-indigo-400">active</span>}
                </span>
              </button>
            )}

            {catalogs.length === 0 && (
              <div className="px-3 py-2 text-gray-400 text-[11px]">
                {search ? 'No matches' : 'Loading…'}
              </div>
            )}

            {catalogs.map(c => {
              const isActive = currentFilter?.includes(c.name)
              const typeLabel = c.type && !c.type.includes('MANAGED') ? c.type.replace('_CATALOG', '').replace('_', ' ') : ''
              return (
                <button
                  key={c.name}
                  onClick={() => selectCatalog(c.name)}
                  className={`w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center justify-between gap-2 ${isActive ? 'bg-indigo-50' : ''}`}
                >
                  <span className={`font-medium truncate ${isActive ? 'text-indigo-700' : 'text-gray-700'}`}>
                    {c.name}
                    {isActive && <span className="ml-1.5 text-[10px] font-normal text-indigo-400">active</span>}
                  </span>
                  {typeLabel && (
                    <span className="text-[9px] text-gray-400 shrink-0">{typeLabel}</span>
                  )}
                </button>
              )
            })}

            {totalHint > catalogs.length && (
              <div className="px-3 py-2 text-[10px] border-t border-gray-100 text-amber-600 bg-amber-50">
                Showing {catalogs.length} of {totalHint.toLocaleString()} catalogs — type to search for more
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export function Sidebar() {
  const { stats, filterTypes, searchQuery, setFilterTypes, setSearchQuery, refreshGraph, loading, viewMode, setViewMode, setShowSettings } = useGraphStore()
  const [workspaceSwitching, setWorkspaceSwitching] = useState(false)
  const [showGuide, setShowGuide] = useState(false)

  const toggleType = (t: NodeType) => {
    const next = new Set(filterTypes)
    if (next.has(t)) {
      next.delete(t)
    } else {
      next.add(t)
      if (viewMode === 'uc' && COMPUTE_TYPES.has(t)) setViewMode('all')
      else if (viewMode === 'compute' && UC_TYPES.has(t)) setViewMode('all')
    }
    setFilterTypes(next)
  }

  const handleExport = () => {
    window.open('/api/export', '_blank')
  }

  const handleExportJsonLd = () => {
    window.open('/api/export/jsonld', '_blank')
  }

  return (
    <>
    {showGuide && <GettingStartedModal onClose={() => setShowGuide(false)} />}
    <aside className="w-64 bg-white border-r border-gray-200 flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200">
        <div className="flex items-center justify-between mb-1">
          <span className="font-bold text-gray-800 text-lg tracking-tight">Lattice</span>
          <div className="flex gap-1">
            <button
              onClick={() => setShowGuide(true)}
              className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700"
              title="Getting started guide"
            >
              <HelpCircle size={14} />
            </button>
            <button
              onClick={refreshGraph}
              disabled={loading}
              className="p-1.5 rounded hover:bg-gray-100 text-gray-500 disabled:opacity-40"
              title="Refresh workspace"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={handleExport}
              className="p-1.5 rounded hover:bg-gray-100 text-gray-500"
              title="Export JSON"
            >
              <Download size={14} />
            </button>
            <button
              onClick={handleExportJsonLd}
              className="p-1.5 rounded hover:bg-gray-100 text-gray-500"
              title="Export JSON-LD (for AI agents)"
            >
              <FileJson size={14} />
            </button>
            <button
              onClick={() => setShowSettings(true)}
              className="p-1.5 rounded hover:bg-gray-100 text-gray-500"
              title="Settings — catalog scope, warehouse, system access"
            >
              <Settings size={14} />
            </button>
          </div>
        </div>
        <ProfileSwitcher onSwitching={setWorkspaceSwitching} />
        <div className="mt-0.5">
          <CatalogSelector disabled={workspaceSwitching} />
        </div>
      </div>

      <IngestionStatus />

      {/* Search */}
      <div className="px-3 py-2 border-b border-gray-100">
        <div className="flex items-center gap-2 bg-gray-50 rounded px-2 py-1.5">
          <Search size={12} className="text-gray-400 shrink-0" />
          <input
            type="text"
            placeholder="Search assets..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="bg-transparent text-xs outline-none flex-1 text-gray-700 placeholder-gray-400"
          />
        </div>
      </div>

      <FreshnessFilter />

      <TagFilterPanel />

      <HealthPanel />

      <CostPanel />

      {/* Type filters */}
      <div className="px-3 py-2 overflow-y-auto flex-1">
        <div className="text-[10px] uppercase tracking-wider text-gray-400 mb-2 font-semibold">Asset Types</div>
        {ALL_TYPES.map(t => {
          const count = stats?.node_types?.[t] || 0
          const active = filterTypes.size === 0 || filterTypes.has(t)
          return (
            <button
              key={t}
              onClick={() => toggleType(t)}
              className={`w-full flex items-center justify-between px-2 py-1.5 rounded text-xs mb-0.5 transition-all ${
                active ? 'text-gray-700' : 'text-gray-300 line-through'
              } hover:bg-gray-50`}
            >
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-sm" style={{ background: TYPE_COLORS[t] }} />
                <span>{t}</span>
              </div>
              <span className="text-gray-400 tabular-nums">{count}</span>
            </button>
          )
        })}
      </div>
      <div className="px-3 py-2 border-t border-gray-100">
        <a
          href="https://github.com/mkahn5/lattice/issues"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-[10px] text-gray-300 hover:text-indigo-500 transition-colors"
          title="Report a bug or request a feature"
        >
          🐞 Feedback and bugs
        </a>
      </div>
    </aside>
    </>
  )
}
