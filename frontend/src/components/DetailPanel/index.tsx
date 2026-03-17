import { useEffect, useState } from 'react'
import { X, Flame, Thermometer, Snowflake, Zap, GitBranch } from 'lucide-react'
import { useGraphStore } from '../../stores/graphStore'
import type { LatticeNode, LatticeEdge } from '../../types'
import { formatDBU } from '../../utils/costColors'
import { AnnotationSection } from './AnnotationSection'

interface ImpactNode { id: string; name: string; type: string; fqn: string }
interface ImpactResult { contains: ImpactNode[]; consumers: ImpactNode[]; total: number; graph_available: boolean }
interface ColLineageRow { target_col: string; source_table: string; source_col: string }

function fmtTs(raw: unknown): string {
  if (!raw) return ''
  const s = String(raw)
  // Handle epoch milliseconds (13-digit number)
  const asNum = Number(s)
  const ts = !isNaN(asNum) && s.length >= 10
    ? new Date(s.length <= 10 ? asNum * 1000 : asNum)
    : new Date(s)
  if (isNaN(ts.getTime())) return s
  return ts.toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

const TS_KEYS = new Set(['created_at', 'updated_at', 'last_queried', 'last_run'])

const HEAT_ICON = {
  hot: <Flame size={11} className="text-green-500" />,
  warm: <Thermometer size={11} className="text-amber-500" />,
  cold: <Snowflake size={11} className="text-gray-400" />,
}

const HEAT_LABEL = {
  hot: 'Active (last 7 days)',
  warm: 'Active (last 30 days)',
  cold: 'Inactive (30 days)',
}

// Keys rendered in the Usage section — excluded from generic Properties list
const USAGE_KEYS = new Set([
  'heat', 'dbu_30d', 'query_count_30d', 'last_queried', 'days_since_query',
  'total_runs_30d', 'success_runs_30d', 'success_rate_pct', 'last_run',
  'num_rows', 'size_mb',
])
const SKIP_KEYS = new Set([
  'id', 'color', 'icon', 'type', 'name', 'fqn',
  // internal graph fields
  'table_fqns', 'cluster_ids', 'uses_serverless', 'stub', 'catalog_name', 'schema_name',
  // shown elsewhere
  'connection_type', 'num_rows', 'size_mb',
  ...USAGE_KEYS,
])

// Per-type explanation shown when enrichment data is missing
const USAGE_NO_DATA: Partial<Record<string, { msg: string; system_table: string }>> = {
  Table:         { msg: 'Query history not yet loaded.', system_table: 'system.query.history' },
  View:          { msg: 'Query history not yet loaded.', system_table: 'system.query.history' },
  Dashboard:     { msg: 'Dashboard activity is derived from the tables it queries.', system_table: 'system.query.history' },
  Job:           { msg: 'Run history not yet loaded.', system_table: 'system.lakeflow.job_run_timeline' },
  Pipeline:      { msg: 'Pipeline run history not yet loaded.', system_table: 'system.lakeflow.job_run_timeline' },
  Warehouse:     { msg: 'DBU usage not yet loaded.', system_table: 'system.billing.usage' },
  Serverless:    { msg: 'DBU usage not yet loaded.', system_table: 'system.billing.usage' },
  Cluster:       { msg: 'DBU usage not yet loaded.', system_table: 'system.billing.usage' },
}

// Types that structurally cannot have activity data — omit the section entirely
const NO_USAGE_TYPES = new Set(['Schema', 'Catalog', 'ForeignCatalog', 'Database', 'App',
  'Model', 'Volume', 'StreamingTable', 'MaterializedView', 'Connection', 'Share', 'Recipient'])

function UsageSection({ node }: { node: LatticeNode }) {
  const heat = node.heat as string | undefined
  const hasUsage = heat != null || node.dbu_30d != null || node.query_count_30d != null
    || node.total_runs_30d != null || node.num_rows != null || node.size_mb != null

  if (!hasUsage) {
    if (NO_USAGE_TYPES.has(node.type)) return null
    const hint = USAGE_NO_DATA[node.type]
    return (
      <section>
        <div className="text-[10px] uppercase tracking-wider text-gray-400 mb-2 font-semibold">Usage</div>
        <div className="text-[11px] text-gray-400 bg-gray-50 rounded-lg px-3 py-2 leading-relaxed space-y-1">
          <div>{hint?.msg ?? `Activity data is not available for ${node.type} assets.`}</div>
          {hint?.system_table && (
            <div>
              Requires a SQL warehouse and <span className="font-mono text-gray-500">SELECT</span> on{' '}
              <span className="font-mono text-gray-500">{hint.system_table}</span>.
            </div>
          )}
        </div>
      </section>
    )
  }

  const rows: { label: string; value: string }[] = []

  if (heat) {
    rows.push({ label: 'Activity', value: HEAT_LABEL[heat as keyof typeof HEAT_LABEL] ?? heat })
  }
  if (node.query_count_30d != null) {
    rows.push({ label: 'Queries (30d)', value: String(node.query_count_30d) })
  }
  if (node.days_since_query != null) {
    rows.push({ label: 'Last queried', value: `${node.days_since_query} days ago` })
  } else if (node.last_queried) {
    rows.push({ label: 'Last queried', value: fmtTs(node.last_queried) })
  }
  if (node.dbu_30d != null) {
    rows.push({ label: 'DBU (30d)', value: `${node.dbu_30d}` })
  }
  if (node.total_runs_30d != null) {
    const total = node.total_runs_30d as number
    const succ = (node.success_runs_30d as number) ?? 0
    rows.push({ label: 'Runs (30d)', value: `${total} (${succ} succeeded)` })
  }
  if (node.success_rate_pct != null) {
    rows.push({ label: 'Success rate', value: `${node.success_rate_pct}%` })
  }
  if (node.last_run) {
    rows.push({ label: 'Last run', value: fmtTs(node.last_run) })
  }
  if (node.num_rows != null) {
    rows.push({ label: 'Row count', value: Number(node.num_rows).toLocaleString() })
  }
  if (node.size_mb != null) {
    rows.push({ label: 'Size', value: `${node.size_mb} MB` })
  }

  return (
    <section>
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-gray-400 mb-2 font-semibold">
        {heat && HEAT_ICON[heat as keyof typeof HEAT_ICON]}
        Usage
      </div>
      <div className="space-y-1.5 bg-gray-50 rounded-lg px-3 py-2">
        {rows.map(({ label, value }) => (
          <div key={label} className="flex justify-between gap-2 text-xs">
            <span className="text-gray-400 shrink-0">{label}</span>
            <span className="text-gray-700 text-right font-mono text-[11px]">{value}</span>
          </div>
        ))}
      </div>
    </section>
  )
}

// Types that can be direct cost sources (have dbu_30d themselves)
const COST_SOURCE_TYPES = new Set(['Warehouse', 'Serverless', 'Cluster', 'Job', 'Pipeline'])
// Types that can receive attributed cost from compute sources
const COST_ATTRIBUTED_TYPES = new Set(['Table', 'View', 'Schema', 'Catalog', 'Dashboard'])
// Types that structurally cannot have cost data — omit the section entirely
const NO_COST_TYPES = new Set(['App', 'Database', 'ForeignCatalog', 'Model', 'Volume',
  'StreamingTable', 'MaterializedView', 'Connection', 'Share', 'Recipient'])

function CostSection({ node }: { node: LatticeNode }) {
  const { costData, costOverlayEnabled, selectNode } = useGraphStore()

  if (NO_COST_TYPES.has(node.type)) return null

  // Overlay not yet enabled
  if (!costOverlayEnabled && costData === null) {
    return (
      <section>
        <div className="text-[10px] uppercase tracking-wider text-amber-600 mb-2 font-semibold">
          💰 Cost Attribution (30d)
        </div>
        <div className="text-[11px] text-gray-400 bg-gray-50 rounded-lg px-3 py-2 leading-relaxed">
          Enable the <span className="font-medium text-amber-600">cost overlay</span> (💰) in the sidebar to see DBU attribution for this asset.
        </div>
      </section>
    )
  }

  // Overlay data loaded but system tables unavailable
  if (costData && !costData.available) {
    return (
      <section>
        <div className="text-[10px] uppercase tracking-wider text-amber-600 mb-2 font-semibold">
          💰 Cost Attribution (30d)
        </div>
        <div className="text-[11px] text-gray-400 bg-gray-50 rounded-lg px-3 py-2 leading-relaxed space-y-1">
          <div>Cost data unavailable.</div>
          <div>Requires a SQL warehouse and <span className="font-mono text-gray-500">SELECT</span> on{' '}
            <span className="font-mono text-gray-500">system.billing.usage</span>.
          </div>
        </div>
      </section>
    )
  }

  const costNode = costData?.nodes[node.id]

  // Overlay enabled + data loaded but this node has no cost
  if (!costNode || costNode.total_dbu === 0) {
    if (!costOverlayEnabled) return null  // overlay off, don't show empty state
    const msg = COST_SOURCE_TYPES.has(node.type)
      ? 'No billable DBU recorded for this asset in the last 30 days.'
      : COST_ATTRIBUTED_TYPES.has(node.type)
        ? 'No cost was attributed to this asset in the last 30 days.'
        : 'No cost data found for this asset.'
    return (
      <section>
        <div className="text-[10px] uppercase tracking-wider text-amber-600 mb-2 font-semibold">
          💰 Cost Attribution (30d)
        </div>
        <div className="text-[11px] text-gray-400 bg-gray-50 rounded-lg px-3 py-2 leading-relaxed">
          {msg}
        </div>
      </section>
    )
  }

  return (
    <section>
      <div className="text-[10px] uppercase tracking-wider text-amber-600 mb-2 font-semibold">
        💰 Cost Attribution (30d)
      </div>
      <div className="space-y-1.5 bg-amber-50 rounded-lg px-3 py-2">
        <div className="flex justify-between text-xs">
          <span className="text-gray-400">Total</span>
          <span className="font-mono text-[11px] text-gray-700">{formatDBU(costNode.total_dbu)}</span>
        </div>
        {costNode.direct_dbu > 0 && (
          <div className="flex justify-between text-xs">
            <span className="text-gray-400">Direct</span>
            <span className="font-mono text-[11px] text-gray-700">{formatDBU(costNode.direct_dbu)}</span>
          </div>
        )}
        {costNode.attributed_dbu > 0 && (
          <div className="flex justify-between text-xs">
            <span className="text-gray-400">Attributed</span>
            <span className="font-mono text-[11px] text-gray-700">{formatDBU(costNode.attributed_dbu)}</span>
          </div>
        )}
      </div>
      {costNode.top_consumers.length > 0 && (
        <div className="mt-2">
          <div className="text-[9px] uppercase tracking-wider text-gray-400 mb-1 font-semibold">Top consumers</div>
          <div className="space-y-1">
            {costNode.top_consumers.map(c => (
              <div key={c.id} className="flex items-center gap-1 text-[10px]">
                <button
                  onClick={() => selectNode(c.id)}
                  className="text-gray-700 hover:text-indigo-600 hover:underline truncate flex-1 text-left"
                >
                  {c.name}
                </button>
                <span className="font-mono text-gray-400 shrink-0">{formatDBU(c.dbu)}</span>
                <span className="text-gray-300 shrink-0">
                  {costNode.total_dbu > 0 ? Math.round((c.dbu / costNode.total_dbu) * 100) : 0}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}

export function DetailPanel() {
  const { selectedNodeId, nodes, edges, selectNode } = useGraphStore()
  const [node, setNode] = useState<LatticeNode | null>(null)
  const [connectedEdges, setConnectedEdges] = useState<LatticeEdge[]>([])
  const [impact, setImpact] = useState<ImpactResult | null>(null)
  const [impactLoading, setImpactLoading] = useState(false)
  const [colLineage, setColLineage] = useState<ColLineageRow[]>([])

  useEffect(() => {
    if (!selectedNodeId) { setNode(null); setImpact(null); setColLineage([]); return }
    const found = nodes.find(n => n.id === selectedNodeId) || null
    setNode(found)
    setConnectedEdges(edges.filter(e => e.source === selectedNodeId || e.target === selectedNodeId))
    setImpact(null)
    // Fetch column lineage for Table/View nodes
    if (found && (found.type === 'Table' || found.type === 'View')) {
      fetch(`/api/nodes/${encodeURIComponent(selectedNodeId)}`)
        .then(r => r.json())
        .then(d => setColLineage(d.column_lineage ?? []))
        .catch(() => setColLineage([]))
    } else {
      setColLineage([])
    }
  }, [selectedNodeId, nodes, edges])

  const analyzeImpact = async () => {
    if (!selectedNodeId) return
    setImpactLoading(true)
    try {
      const res = await fetch(`/api/impact?node_id=${encodeURIComponent(selectedNodeId)}`)
      const d = await res.json()
      setImpact(d)
    } catch {
      setImpact({ contains: [], consumers: [], total: 0, graph_available: false })
    } finally {
      setImpactLoading(false)
    }
  }

  if (!node) return null

  const nodeById = new Map(nodes.map(n => [n.id, n]))
  const props = Object.entries(node).filter(([k, v]) => !SKIP_KEYS.has(k) && v != null && v !== '')

  const outgoing = connectedEdges.filter(e => e.source === node.id)
  const incoming = connectedEdges.filter(e => e.target === node.id)

  return (
    <div className="w-80 bg-white border-l border-gray-200 flex flex-col h-full overflow-hidden shadow-lg">
      {/* Header */}
      <div className="flex items-start justify-between px-4 py-3 border-b border-gray-200">
        <div className="min-w-0">
          <div
            className="text-xs font-bold px-2 py-0.5 rounded-full text-white inline-block mb-1"
            style={{ background: node.color }}
          >
            {node.type}
          </div>
          <div className="font-semibold text-sm text-gray-800 truncate" title={node.name}>{node.name}</div>
          <div className="text-[10px] text-gray-400 truncate" title={node.fqn}>{node.fqn}</div>
        </div>
        <button onClick={() => selectNode(null)} className="ml-2 p-1 hover:bg-gray-100 rounded text-gray-400 shrink-0">
          <X size={14} />
        </button>
      </div>

      {/* Annotations — above fold, always visible */}
      <AnnotationSection nodeId={node.id} fqn={node.fqn} nodeType={node.type} />

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {/* Usage */}
        <UsageSection node={node} />

        {/* Cost Attribution */}
        <CostSection node={node} />

        {/* Properties */}
        {props.length > 0 && (
          <section>
            <div className="text-[10px] uppercase tracking-wider text-gray-400 mb-2 font-semibold">Properties</div>
            <div className="space-y-1.5">
              {props.map(([k, v]) => {
                const str = TS_KEYS.has(k) ? fmtTs(v) : String(v)
                const isUrl = str.startsWith('http://') || str.startsWith('https://')
                return (
                  <div key={k} className="flex justify-between gap-2 text-xs">
                    <span className="text-gray-400 capitalize shrink-0">{k.replace(/_/g, ' ')}</span>
                    {isUrl ? (
                      <a
                        href={str}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-indigo-500 hover:text-indigo-700 text-right truncate underline"
                        title={str}
                      >
                        {str.replace(/^https?:\/\//, '')}
                      </a>
                    ) : (
                      <span className="text-gray-700 text-right truncate" title={str}>{str}</span>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* Referenced Tables — Dashboard datasources */}
        {node.type === 'Dashboard' && Array.isArray(node.table_fqns) && (node.table_fqns as string[]).length > 0 && (
          <section>
            <div className="text-[10px] uppercase tracking-wider text-gray-400 mb-2 font-semibold">
              Referenced Tables ({(node.table_fqns as string[]).length})
            </div>
            <div className="space-y-1">
              {(node.table_fqns as string[]).map((fqn: string) => {
                const peer = nodes.find(n => String(n.fqn).toLowerCase() === fqn.toLowerCase())
                return (
                  <div key={fqn}>
                    {peer ? (
                      <button
                        onClick={() => selectNode(peer.id)}
                        className="text-[10px] font-mono text-indigo-600 hover:underline text-left truncate w-full"
                        title={fqn}
                      >
                        {fqn}
                      </button>
                    ) : (
                      <span className="text-[10px] font-mono text-gray-400 truncate block" title={fqn}>{fqn}</span>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* Connections */}
        {(outgoing.length > 0 || incoming.length > 0) && (
          <section>
            <div className="text-[10px] uppercase tracking-wider text-gray-400 mb-2 font-semibold">
              Connections ({connectedEdges.length})
            </div>
            {outgoing.length > 0 && (
              <div className="mb-2">
                <div className="text-[10px] text-gray-400 mb-1">→ Outgoing</div>
                {outgoing.map(e => {
                  const peer = nodeById.get(e.target)
                  const label = peer?.name ?? (e.target.split(':')[1]?.split('.').pop() || e.target)
                  return (
                    <div key={e.id} className="flex items-center gap-1 text-xs py-1 border-b border-gray-50">
                      <span className="text-indigo-500 font-medium shrink-0">{e.relationship}</span>
                      <span className="text-gray-400 shrink-0">→</span>
                      <button
                        onClick={() => selectNode(e.target)}
                        className="text-gray-600 hover:text-indigo-600 hover:underline text-[10px] truncate text-left"
                        title={e.target}
                      >
                        {label}
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
            {incoming.length > 0 && (
              <div>
                <div className="text-[10px] text-gray-400 mb-1">← Incoming</div>
                {incoming.map(e => {
                  const peer = nodeById.get(e.source)
                  const label = peer?.name ?? (e.source.split(':')[1]?.split('.').pop() || e.source)
                  return (
                    <div key={e.id} className="flex items-center gap-1 text-xs py-1 border-b border-gray-50">
                      <button
                        onClick={() => selectNode(e.source)}
                        className="text-gray-600 hover:text-indigo-600 hover:underline text-[10px] truncate text-left"
                        title={e.source}
                      >
                        {label}
                      </button>
                      <span className="text-gray-400 shrink-0">→</span>
                      <span className="text-indigo-500 font-medium shrink-0">{e.relationship}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        )}

        {/* Column Lineage — Table/View only */}
        {colLineage.length > 0 && (
          <section>
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-gray-400 mb-2 font-semibold">
              <GitBranch size={10} />
              Column Lineage ({colLineage.length})
            </div>
            <div className="space-y-1">
              {colLineage.slice(0, 20).map((row, i) => (
                <div key={i} className="text-[10px] bg-gray-50 rounded px-2 py-1.5">
                  <span className="font-mono text-indigo-600">{row.target_col}</span>
                  <span className="text-gray-400 mx-1">←</span>
                  <span className="font-mono text-gray-500 truncate">{row.source_table}.{row.source_col}</span>
                </div>
              ))}
              {colLineage.length > 20 && (
                <div className="text-[10px] text-gray-400 text-center py-1">+{colLineage.length - 20} more</div>
              )}
            </div>
          </section>
        )}

        {/* Impact Analysis */}
        <section>
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-gray-400 font-semibold">
              <Zap size={10} />
              Impact Analysis
            </div>
            {impact === null && (
              <button
                onClick={analyzeImpact}
                disabled={impactLoading}
                className="text-[10px] px-2 py-0.5 rounded bg-indigo-50 text-indigo-600 hover:bg-indigo-100 disabled:opacity-50"
              >
                {impactLoading ? 'Analyzing…' : 'Analyze'}
              </button>
            )}
          </div>
          {impact === null ? (
            <div className="text-[11px] text-gray-400 leading-relaxed">
              Click <span className="font-medium text-indigo-500">Analyze</span> to see what would be affected if this asset were removed or changed.
              <ul className="mt-1 space-y-0.5 text-[10px] text-gray-400 list-disc list-inside">
                <li><span className="font-medium">Schema/Catalog</span> → shows all contained assets</li>
                <li><span className="font-medium">Table/View</span> → shows dashboards &amp; jobs that query it</li>
                <li><span className="font-medium">Warehouse/Cluster</span> → shows dashboards &amp; jobs using it</li>
              </ul>
              <div className="mt-1 text-[10px] text-gray-400">Requires lineage edges — needs system table access to populate job/dashboard relationships.</div>
            </div>
          ) : !impact.graph_available ? (
            <div className="text-[11px] text-amber-600">Graph not yet built — try after ingestion completes.</div>
          ) : impact.total === 0 ? (
            <div className="text-[11px] text-gray-400">No connected assets found. This may mean lineage edges haven't been ingested yet (requires <span className="font-mono">system.access.table_lineage</span> access).</div>
          ) : (
            <div className="space-y-3">
              <div className="text-[11px] text-amber-600 font-medium">{impact.total} asset{impact.total > 1 ? 's' : ''} affected</div>
              {impact.consumers.length > 0 && (
                <div>
                  <div className="text-[10px] text-gray-400 mb-1">Depends on this ({impact.consumers.length})</div>
                  <div className="space-y-0.5 max-h-36 overflow-y-auto">
                    {impact.consumers.map(n => (
                      <div key={n.id} className="flex items-center gap-1 text-[10px]">
                        <span className="text-gray-400 shrink-0 w-16 truncate">{n.type}</span>
                        <button onClick={() => selectNode(n.id)} className="text-gray-700 hover:text-indigo-600 hover:underline truncate text-left" title={n.fqn}>{n.name}</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {impact.contains.length > 0 && (
                <div>
                  <div className="text-[10px] text-gray-400 mb-1">Contained within ({impact.contains.length})</div>
                  <div className="space-y-0.5 max-h-36 overflow-y-auto">
                    {impact.contains.map(n => (
                      <div key={n.id} className="flex items-center gap-1 text-[10px]">
                        <span className="text-gray-400 shrink-0 w-16 truncate">{n.type}</span>
                        <button onClick={() => selectNode(n.id)} className="text-gray-700 hover:text-indigo-600 hover:underline truncate text-left" title={n.fqn}>{n.name}</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
