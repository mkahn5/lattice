import { useEffect, useCallback, useMemo, useRef, useState, forwardRef, useImperativeHandle } from 'react'
import { createPortal } from 'react-dom'
import {
  ReactFlow, Background, Controls, MiniMap, Panel,
  useNodesState, useEdgesState, useReactFlow, MarkerType,
  ReactFlowProvider,
  type Node, type Edge,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import Dagre from '@dagrejs/dagre'
import { useGraphStore, type ViewMode } from '../../stores/graphStore'
import { nodeTypes } from './NodeTypes'
import { EdgeLegend } from '../EdgeLegend'
import type { LatticeNode, LatticeEdge } from '../../types'
import { getCostBgColor, getCostScale } from '../../utils/costColors'
import { getTagDotColor } from '../../constants/tagConfig'

type LayoutMode = 'tree-tb' | 'tree-lr' | 'swimlane'

const LAYOUT_MODES: { key: LayoutMode; label: string; title: string }[] = [
  { key: 'tree-tb', label: 'Tree →', title: 'Hierarchy left-to-right (catalogs across top)' },
  { key: 'tree-lr', label: 'Tree ↓', title: 'Hierarchy top-down (catalogs stacked vertically)' },
  { key: 'swimlane', label: 'Lanes', title: 'Grouped by asset type' },
]

// Type display order for swimlane
const SWIMLANE_ORDER = [
  'Catalog', 'ForeignCatalog', 'Schema', 'Database', 'Table', 'View', 'Model',
  'Connection', 'Share', 'Recipient',
  'Warehouse', 'Cluster', 'Job', 'App', 'Dashboard',
]

const UC_TYPES = new Set(['Catalog', 'ForeignCatalog', 'Schema', 'Table', 'View', 'Model', 'Volume', 'StreamingTable', 'MaterializedView', 'Database', 'Connection', 'Share', 'Recipient'])
const COMPUTE_TYPES = new Set(['Warehouse', 'Serverless', 'Cluster', 'Job', 'Dashboard', 'App', 'Pipeline'])

const VIEW_MODES: { key: ViewMode; label: string }[] = [
  { key: 'uc', label: 'UC Tree' },
  { key: 'compute', label: 'Compute' },
  { key: 'all', label: 'All' },
]

function getConsoleUrl(host: string, node: LatticeNode): string | null {
  if (!host) return null
  const base = host.replace(/\/$/, '')
  const cat = String(node.catalog_name ?? '')
  const sch = String(node.schema_name ?? '')
  switch (node.type) {
    case 'Catalog':  return `${base}/explore/data/${node.name}`
    case 'Schema':   return `${base}/explore/data/${cat}/${node.name}`
    case 'Table':
    case 'View':     return `${base}/explore/data/${cat}/${sch}/${node.name}`
    case 'Volume':   return `${base}/explore/data/volumes/${cat}/${sch}/${node.name}`
    case 'Model':    return `${base}/explore/data/models/${cat}/${sch}/${node.name}`
    case 'Warehouse': return `${base}/sql/warehouses/${node.fqn}`
    case 'Cluster':  return `${base}/clusters/${node.fqn}`
    case 'Job':      return `${base}/jobs/${node.fqn}`
    case 'Dashboard': return `${base}/dashboardsv3/${node.fqn}`
    case 'App':       return `${base}/apps/${node.name}`
    default: return null
  }
}

const NODE_W = 170
const NODE_H = 58
const GRID_GAP_X = 18
const GRID_GAP_Y = 16

function gridCols(count: number): number {
  if (count <= 4) return count
  if (count <= 16) return 4
  if (count <= 36) return 6
  return 8
}

function hybridLayout(
  nodes: LatticeNode[],
  edges: LatticeEdge[],
  rankdir: 'TB' | 'LR' = 'TB',
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>()
  const visibleIds = new Set(nodes.map((n) => n.id))

  const containsEdges = edges.filter((e) => e.relationship === 'contains')
  const treeNodeIds = new Set<string>()
  containsEdges.forEach((e) => {
    treeNodeIds.add(e.source)
    treeNodeIds.add(e.target)
  })

  const treeNodes = nodes.filter((n) => treeNodeIds.has(n.id))
  const orphanNodes = nodes.filter((n) => !treeNodeIds.has(n.id))

  if (treeNodes.length > 0) {
    const g = new Dagre.graphlib.Graph()
    const isLR = rankdir === 'LR'
    g.setGraph({
      rankdir,
      nodesep: isLR ? 30 : 55,
      ranksep: isLR ? 120 : 90,
      marginx: 40,
      marginy: 40,
    })
    g.setDefaultEdgeLabel(() => ({}))
    treeNodes.forEach((n) => g.setNode(n.id, { width: NODE_W, height: NODE_H }))
    containsEdges.forEach((e) => {
      if (visibleIds.has(e.source) && visibleIds.has(e.target))
        g.setEdge(e.source, e.target)
    })
    Dagre.layout(g)
    treeNodes.forEach((n) => {
      const pos = g.node(n.id)
      if (pos) positions.set(n.id, { x: pos.x - NODE_W / 2, y: pos.y - NODE_H / 2 })
    })
  }

  if (orphanNodes.length === 0) return positions

  // Place orphan grid after the tree (below for TB, to the right for LR)
  let maxTreeX = 0, maxTreeY = 0
  positions.forEach((p) => {
    if (p.x > maxTreeX) maxTreeX = p.x
    if (p.y > maxTreeY) maxTreeY = p.y
  })

  let currentY = treeNodes.length > 0 ? maxTreeY + NODE_H + 80 : 0
  const orphanOffsetX = rankdir === 'LR' && treeNodes.length > 0 ? maxTreeX + NODE_W + 80 : 0

  const byType = new Map<string, LatticeNode[]>()
  orphanNodes.forEach((n) => {
    if (!byType.has(n.type)) byType.set(n.type, [])
    byType.get(n.type)!.push(n)
  })

  byType.forEach((typeNodes) => {
    const cols = gridCols(typeNodes.length)
    typeNodes.forEach((n, i) => {
      positions.set(n.id, {
        x: orphanOffsetX + (i % cols) * (NODE_W + GRID_GAP_X),
        y: currentY + Math.floor(i / cols) * (NODE_H + GRID_GAP_Y),
      })
    })
    currentY += Math.ceil(typeNodes.length / cols) * (NODE_H + GRID_GAP_Y) + 50
  })

  return positions
}

// Swimlane: each asset type gets its own wrapped row band
function swimlaneLayout(nodes: LatticeNode[]): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>()

  const byType = new Map<string, LatticeNode[]>()
  // Seed in display order so iteration is ordered
  SWIMLANE_ORDER.forEach((t) => byType.set(t, []))
  nodes.forEach((n) => {
    const key = SWIMLANE_ORDER.includes(n.type) ? n.type : n.type
    if (!byType.has(key)) byType.set(key, [])
    byType.get(key)!.push(n)
  })

  const LANE_GAP = 80   // vertical gap between type bands
  const MAX_COLS = 12   // cap per row so lanes don't go too wide
  let currentY = 0

  const typeOrder = [
    ...SWIMLANE_ORDER,
    ...[...byType.keys()].filter((t) => !SWIMLANE_ORDER.includes(t)),
  ]

  typeOrder.forEach((typeName) => {
    const typeNodes = byType.get(typeName) ?? []
    if (typeNodes.length === 0) return

    const rawCols = gridCols(typeNodes.length)
    const cols = Math.min(rawCols, MAX_COLS)

    typeNodes.forEach((n, i) => {
      positions.set(n.id, {
        x: (i % cols) * (NODE_W + GRID_GAP_X),
        y: currentY + Math.floor(i / cols) * (NODE_H + GRID_GAP_Y),
      })
    })

    currentY += Math.ceil(typeNodes.length / cols) * (NODE_H + GRID_GAP_Y) + LANE_GAP
  })

  return positions
}

type SaveMode = 'graph' | 'details'
interface SavedView { name: string; workspace: string; catalog: string; mode: SaveMode; nodes: Node[]; edges: Edge[]; viewport: { x: number; y: number; zoom: number } }

// Inner component that lives inside a ReactFlow context so it can call useReactFlow()
const FrozenPaneExporter = forwardRef<
  { export: (containerRef: React.RefObject<HTMLDivElement | null>, slug: string) => Promise<void> }
>((_props, ref) => {
  useImperativeHandle(ref, () => ({
    export: async (containerRef, slug) => {
      // Capture exactly what's visible in the frozen pane at 3× resolution.
      // The user zooms/pans to the area they care about first, then exports.
      const { toPng } = await import('html-to-image')
      const wrapper = containerRef.current?.querySelector('.react-flow') as HTMLElement | null
      if (!wrapper) return
      const dataUrl = await toPng(wrapper, {
        backgroundColor: '#f9fafb',
        pixelRatio: 3,
      })
      const a = document.createElement('a')
      a.href = dataUrl; a.download = `lattice-${slug}-full.png`; a.click()
    },
  }))
  return null
})
FrozenPaneExporter.displayName = 'FrozenPaneExporter'

function FrozenPane({ view, onClose }: { view: SavedView; onClose: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const outerRef = useRef<HTMLDivElement>(null)
  const exporterRef = useRef<{ export: (containerRef: React.RefObject<HTMLDivElement | null>, slug: string) => Promise<void> } | null>(null)
  const [captureRect, setCaptureRect] = useState<DOMRect | null>(null)
  const slug = `${view.workspace}-${view.catalog}`.replace(/[^a-z0-9]/gi, '-').toLowerCase()
  const assetNodes = view.nodes.filter(n => !n.id.startsWith('__label__'))

  const exportDetailsCsv = () => {
    const headers = ['Name', 'Type', 'Owner', 'Activity', 'Queries 30d', 'DBU 30d', 'FQN']
    const rows = assetNodes.map(n => {
      const d = n.data as Record<string, unknown>
      return [
        String(d.name ?? ''), String(d.type ?? ''), String(d.owner ?? ''),
        String(d.heat ?? ''), String(d.query_count_30d ?? ''), String(d.dbu_30d ?? ''),
        String(d.fqn ?? ''),
      ]
    })
    const csv = [headers, ...rows].map(r => r.map(v => `"${v.replace(/"/g, '""')}"`).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    const a = document.createElement('a'); a.href = url; a.download = `${slug}-details.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  const exportJson = () => {
    const nodes = view.mode === 'graph'
      ? view.nodes.map(n => ({ id: n.id, type: (n.data as Record<string,unknown>).type, name: (n.data as Record<string,unknown>).name, fqn: (n.data as Record<string,unknown>).fqn, position: n.position, color: (n.data as Record<string,unknown>).color }))
      : view.nodes.map(n => ({ ...n.data, position: n.position }))
    const edges = view.edges.map(e => ({ id: e.id, source: e.source, target: e.target, relationship: (e as Record<string,unknown>).relationship ?? '', label: e.label }))
    const payload = JSON.stringify({ name: view.name, workspace: view.workspace, catalog: view.catalog, mode: view.mode, nodes, edges }, null, 2)
    const url = URL.createObjectURL(new Blob([payload], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url; a.download = `lattice-${slug}-${view.mode}.json`; a.click()
    URL.revokeObjectURL(url)
  }

  const showCapturePreview = () => {
    if (containerRef.current) setCaptureRect(containerRef.current.getBoundingClientRect())
  }
  const hideCapturePreview = () => setCaptureRect(null)

  const exportPng = async () => {
    setCaptureRect(null)
    await exporterRef.current?.export(containerRef, slug)
  }

  return (
    <div ref={outerRef} className="relative flex flex-col border-l border-gray-300" style={{ width: '50%' }}>
      {captureRect && createPortal(
        <div style={{
          position: 'fixed',
          left: captureRect.left,
          top: captureRect.top,
          width: captureRect.width,
          height: captureRect.height,
          pointerEvents: 'none',
          zIndex: 99999,
          border: '2px dashed #6366f1',
          background: 'rgba(99, 102, 241, 0.04)',
          boxSizing: 'border-box',
        }}>
          <div style={{
            position: 'absolute',
            top: 48,
            left: '50%',
            transform: 'translateX(-50%)',
            background: '#6366f1',
            color: 'white',
            fontSize: 10,
            padding: '2px 10px',
            borderRadius: 999,
            whiteSpace: 'nowrap',
            fontWeight: 500,
          }}>
            Capture area
          </div>
        </div>,
        document.body
      )}
      {/* Header bar */}
      <div className="absolute top-2 left-2 right-2 z-10 flex items-center gap-2 pointer-events-none">
        {/* Workspace + catalog identity */}
        <div className="pointer-events-auto flex flex-col min-w-0 shrink">
          <span className="flex items-center gap-1 bg-indigo-600 text-white text-[11px] font-medium px-2.5 py-1 rounded-t-lg truncate">
            <svg width="9" height="9" viewBox="0 0 10 10" fill="none" className="shrink-0">
              <rect x="1" y="1" width="8" height="8" rx="1.5" stroke="white" strokeWidth="1.5"/>
              <path d="M3 5h4M3 3.5h4M3 6.5h2.5" stroke="white" strokeWidth="1" strokeLinecap="round"/>
            </svg>
            {view.workspace}
          </span>
          <span className="bg-indigo-100 text-indigo-700 text-[10px] px-2.5 py-0.5 rounded-b-lg truncate">
            {view.catalog}
          </span>
        </div>
        <span className="pointer-events-auto text-[10px] text-gray-400 bg-white border border-gray-200 rounded px-1.5 py-0.5 shrink-0">
          {view.mode === 'details' ? 'graph + details' : 'graph'}
        </span>
        {/* Export buttons */}
        <button
          onClick={() => exportPng()}
          onMouseEnter={showCapturePreview}
          onMouseLeave={hideCapturePreview}
          className="pointer-events-auto flex items-center gap-1 bg-white border border-gray-200 text-gray-500 hover:text-gray-800 hover:border-gray-300 rounded-lg px-2 py-1 text-[11px] font-medium shadow-sm transition-all shrink-0"
          title="Export current view as PNG (3× resolution — zoom to the area you want first)"
        >
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
            <rect x="1" y="1" width="9" height="7" rx="1" stroke="currentColor" strokeWidth="1.3"/>
            <circle cx="3.5" cy="3.5" r="1" fill="currentColor"/>
            <path d="M1 7.5l2.5-2.5 2 2 1.5-1.5L10 8.5" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
          </svg>
          PNG
        </button>
        <button
          onClick={exportJson}
          className="pointer-events-auto flex items-center gap-1 bg-white border border-gray-200 text-gray-500 hover:text-gray-800 hover:border-gray-300 rounded-lg px-2 py-1 text-[11px] font-medium shadow-sm transition-all shrink-0"
          title={view.mode === 'details' ? 'Export full node metadata as JSON' : 'Export graph structure as JSON'}
        >
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
            <path d="M3 1.5H1.5A.5.5 0 001 2v7a.5.5 0 00.5.5H3M8 1.5h1.5a.5.5 0 01.5.5v7a.5.5 0 01-.5.5H8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
            <path d="M4 4l-1.5 1.5L4 7M7 4l1.5 1.5L7 7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          JSON
        </button>
        <button
          onClick={onClose}
          className="pointer-events-auto ml-auto bg-white border border-gray-200 text-gray-400 hover:text-gray-700 hover:border-gray-300 rounded-lg px-2 py-1 text-[11px] font-medium shadow-sm transition-all shrink-0"
          title="Close saved view"
        >
          ✕
        </button>
      </div>

      {/* Graph canvas */}
      <div ref={containerRef} className={view.mode === 'details' ? 'flex-1 min-h-0' : 'flex-1'}>
        <ReactFlow
          nodes={view.nodes}
          edges={view.edges}
          nodeTypes={nodeTypes}
          defaultViewport={view.viewport}
          minZoom={0.04}
          maxZoom={2}
          defaultEdgeOptions={{ zIndex: 1 }}
        >
          <Background color="#e5e7eb" gap={20} />
          <Controls />
          <MiniMap
            nodeColor={(n) => ((n.data as { color?: string }).color ?? '#94a3b8')}
            zoomable pannable style={{ height: 100 }}
          />
          <FrozenPaneExporter ref={exporterRef} />
        </ReactFlow>
      </div>

      {/* Details table — only in graph + details mode */}
      {view.mode === 'details' && (
        <div className="h-48 border-t border-gray-200 bg-white overflow-y-auto shrink-0 flex flex-col">
          <div className="flex items-center justify-between px-2 py-1 bg-gray-50 border-b border-gray-200 shrink-0">
            <span className="text-[9px] text-gray-400">{assetNodes.length} nodes</span>
            <button
              onClick={exportDetailsCsv}
              className="text-[9px] text-indigo-500 hover:text-indigo-700 hover:underline flex items-center gap-0.5"
              title="Export as CSV"
            >
              <svg width="9" height="9" viewBox="0 0 10 10" fill="none">
                <path d="M5 1v6M2.5 5l2.5 2.5L7.5 5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M1 8.5h8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
              Export CSV
            </button>
          </div>
          <div className="overflow-y-auto flex-1">
          <table className="w-full text-[10px] border-collapse">
            <thead className="sticky top-0 bg-gray-50 z-10">
              <tr className="text-left text-gray-500 font-semibold">
                <th className="px-2 py-1.5 border-b border-gray-200">Name</th>
                <th className="px-2 py-1.5 border-b border-gray-200">Type</th>
                <th className="px-2 py-1.5 border-b border-gray-200">Owner</th>
                <th className="px-2 py-1.5 border-b border-gray-200">Activity</th>
                <th className="px-2 py-1.5 border-b border-gray-200">Queries 30d</th>
                <th className="px-2 py-1.5 border-b border-gray-200">DBU 30d</th>
                <th className="px-2 py-1.5 border-b border-gray-200 max-w-[140px]">FQN</th>
              </tr>
            </thead>
            <tbody>
              {assetNodes.map((n, i) => {
                const d = n.data as Record<string, unknown>
                const heat = String(d.heat ?? '')
                const heatColor = heat === 'hot' ? 'text-green-600' : heat === 'warm' ? 'text-amber-500' : heat ? 'text-gray-400' : ''
                return (
                  <tr key={n.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-2 py-1 font-medium text-gray-700 max-w-[100px] truncate" title={String(d.name ?? '')}>{String(d.name ?? '')}</td>
                    <td className="px-2 py-1 text-gray-500">{String(d.type ?? '')}</td>
                    <td className="px-2 py-1 text-gray-500 max-w-[100px] truncate" title={String(d.owner ?? '')}>{String(d.owner ?? '—')}</td>
                    <td className={`px-2 py-1 font-medium ${heatColor}`}>{heat || '—'}</td>
                    <td className="px-2 py-1 text-gray-500">{d.query_count_30d != null ? String(d.query_count_30d) : '—'}</td>
                    <td className="px-2 py-1 text-gray-500">{d.dbu_30d != null ? String(d.dbu_30d) : '—'}</td>
                    <td className="px-2 py-1 text-gray-400 max-w-[140px] truncate font-mono" title={String(d.fqn ?? '')}>{String(d.fqn ?? '')}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          </div>
        </div>
      )}
    </div>
  )
}

export function Canvas() {
  const {
    nodes: latticeNodes,
    edges: latticeEdges,
    selectedNodeId,
    selectNode,
    viewMode,
    collapsedSchemas,
    filterTypes,
    searchQuery,
    setViewMode,
    toggleSchema,
    workspaceInfo,
    showLineage,
    freshnessFilter,
    costOverlayEnabled,
    costData,
    highlightedIds,
    setHighlightedIds,
    selectedNodeIds,
    setSelectedNodes,
    clearSelection,
    addToSelection,
    removeFromSelection,
    activeTagFilter,
    annotations,
    tagConfig,
  } = useGraphStore()

  const [layoutMode, setLayoutMode] = useState<LayoutMode>('tree-tb')
  const [savedView, setSavedView] = useState<SavedView | null>(null)

  const [rfNodes, setRfNodes, onNodesChange] = useNodesState<Node>([])
  const [rfEdges, setRfEdges, onEdgesChange] = useEdgesState<Edge>([])
  const { fitView, setCenter, getViewport } = useReactFlow()

  // Preserve manual node positions across incremental changes.
  // Cleared on hard resets — but only when the user hasn't manually arranged nodes.
  const savedPositions = useRef<Map<string, { x: number; y: number }>>(new Map())
  const filterTypesKey = useMemo(() => [...filterTypes].sort().join(','), [filterTypes])
  const hardResetKey = `${viewMode}|${layoutMode}|${searchQuery}|${filterTypesKey}`
  const prevHardResetKey = useRef('')
  const initialFitDone = useRef(false)
  // When true, filter/search changes skip hard reset and show a nudge instead
  const [filterChangedWhileModified, setFilterChangedWhileModified] = useState(false)

  // Table counts per schema (for collapsed badge)
  const tableCountBySchema = useMemo(() => {
    const counts = new Map<string, number>()
    for (const n of latticeNodes) {
      if (n.type === 'Table' || n.type === 'View') {
        const schemaId = `schema:${String(n.catalog_name)}.${String(n.schema_name)}`
        counts.set(schemaId, (counts.get(schemaId) ?? 0) + 1)
      }
    }
    return counts
  }, [latticeNodes])

  const visibleNodes = useMemo(() => {
    const typeFilter =
      viewMode === 'uc' ? UC_TYPES : viewMode === 'compute' ? COMPUTE_TYPES : null

    return latticeNodes.filter((n) => {
      if (typeFilter && !typeFilter.has(n.type)) return false
      if (filterTypes.size > 0 && !filterTypes.has(n.type)) return false

      // Hide tables/views whose schema is collapsed
      if (n.type === 'Table' || n.type === 'View') {
        const schemaId = `schema:${String(n.catalog_name)}.${String(n.schema_name)}`
        if (collapsedSchemas.has(schemaId)) return false
      }

      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        const hay =
          `${n.name} ${n.fqn} ${n.owner ?? ''} ${n.comment ?? ''}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [latticeNodes, viewMode, collapsedSchemas, filterTypes, searchQuery])

  const MAX_RENDER = 2000
  const clippedNodes = useMemo(
    () => visibleNodes.length > MAX_RENDER ? visibleNodes.slice(0, MAX_RENDER) : visibleNodes,
    [visibleNodes],
  )
  const clipped = visibleNodes.length > MAX_RENDER

  useEffect(() => {
    if (!latticeNodes.length) return

    // Hard reset: clear saved positions when layout/view/filter changes
    if (hardResetKey !== prevHardResetKey.current) {
      if (userModifiedLayout.current) {
        // User has manually arranged nodes — don't reset, just show nudge
        prevHardResetKey.current = hardResetKey
        setFilterChangedWhileModified(true)
      } else {
        prevHardResetKey.current = hardResetKey
        savedPositions.current.clear()
        setFilterChangedWhileModified(false)
      }
    }

    // Always compute fresh layout positions (used as fallback for new nodes)
    const layoutPositions =
      layoutMode === 'swimlane'
        ? swimlaneLayout(clippedNodes)
        : hybridLayout(clippedNodes, latticeEdges, layoutMode === 'tree-lr' ? 'LR' : 'TB')
    const visibleIds = new Set(clippedNodes.map((n) => n.id))

    const now = Date.now()
    const assetNodes: Node[] = clippedNodes.map((n) => {
      // Highlight mode — dim everything not in the highlighted set
      const isHighlightMode = highlightedIds !== null
      const isHighlighted = isHighlightMode && highlightedIds!.has(n.id)

      // Freshness dimming — only dim nodes that have a timestamp AND are outside the window.
      // Nodes without timestamps (Schema, Catalog, Warehouse, etc.) are never dimmed by freshness.
      let dimmed = false
      if (!isHighlightMode && freshnessFilter !== null) {
        const raw = (n as Record<string, unknown>).updated_at ?? (n as Record<string, unknown>).created_at
        const ts = raw ? Number(raw) : NaN
        if (!isNaN(ts) && (now - ts) > freshnessFilter * 24 * 60 * 60 * 1000) {
          dimmed = true
        }
      }
      // Cost overlay
      const costNode = costOverlayEnabled && costData?.nodes ? costData.nodes[n.id] : undefined
      const costRankPct = costNode?.cost_rank_pct ?? 0
      const costDimmed = costOverlayEnabled && (costData?.available ?? false) && (!costNode || costNode.total_dbu === 0)
      // Tag spotlight: dim nodes that don't have the active filter tag
      const tagDimmed = activeTagFilter !== null && !(annotations[n.fqn]?.tags ?? []).includes(activeTagFilter)
      // Annotation dot: highest-priority tag color, or teal for note-only
      const ann = annotations[n.fqn]
      let annotationDotColor: string | null = null
      if (ann) {
        const tags = ann.tags ?? []
        if (tags.length > 0) {
          // Pick tag with lowest priority number (most important)
          const best = tags.reduce((a, b) => {
            const pa = tagConfig[a]?.priority ?? 99
            const pb = tagConfig[b]?.priority ?? 99
            return pa <= pb ? a : b
          })
          annotationDotColor = getTagDotColor(tagConfig[best]?.color ?? 'teal')
        } else if (ann.note) {
          annotationDotColor = getTagDotColor('teal')
        }
      }
      // In highlight mode, dim non-highlighted nodes (takes priority over everything else)
      const highlightDimmed = isHighlightMode && !isHighlighted

      // Use saved position if available (preserves manual layout); fall back to computed
      const saved = savedPositions.current.get(n.id)
      const position = saved ?? layoutPositions.get(n.id) ?? { x: 0, y: 0 }
      // Register new nodes so they're tracked going forward
      if (!saved) savedPositions.current.set(n.id, position)
      return {
        id: n.id,
        type: 'latticeNode',
        position,
        data: {
          ...n,
          isCollapsed: collapsedSchemas.has(n.id),
          tableCount: tableCountBySchema.get(n.id) ?? 0,
          onToggleCollapse:
            n.type === 'Schema' ? () => toggleSchema(n.id) : undefined,
          consoleUrl: getConsoleUrl(workspaceInfo?.host ?? '', n),
          dimmed: highlightDimmed || dimmed || costDimmed || tagDimmed,
          highlighted: isHighlighted,
          costOverlayEnabled,
          costBgColor: costOverlayEnabled ? getCostBgColor(costRankPct) : null,
          costScale: costOverlayEnabled ? getCostScale(costRankPct) : 1.0,
          costTotalDbu: costNode?.total_dbu ?? 0,
          annotationDotColor,
        },
        selected: false,
      }
    })

    // In swimlane mode, inject label nodes above each type band
    const labelNodes: Node[] = []
    if (layoutMode === 'swimlane') {
      const byType = new Map<string, { minY: number; count: number }>()
      clippedNodes.forEach((n) => {
        const pos = layoutPositions.get(n.id)
        if (!pos) return
        const prev = byType.get(n.type)
        if (!prev || pos.y < prev.minY) byType.set(n.type, { minY: pos.y, count: 0 })
        byType.get(n.type)!.count++
      })
      byType.forEach(({ minY, count }, typeName) => {
        labelNodes.push({
          id: `__label__${typeName}`,
          type: 'default',
          position: { x: -10, y: minY - 28 },
          draggable: false,
          selectable: false,
          data: { label: `${typeName}s (${count})` },
          style: {
            background: 'transparent',
            border: 'none',
            fontSize: 11,
            fontWeight: 600,
            color: '#6b7280',
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            pointerEvents: 'none',
            padding: 0,
            width: 'auto',
          },
        })
      })
    }

    const nodes = [...labelNodes, ...assetNodes]

    const edges: Edge[] = latticeEdges
      .filter((e) => visibleIds.has(e.source) && visibleIds.has(e.target))
      .filter((e) => !e.lineage || showLineage)
      .map((e) => {
        const isContains = e.relationship === 'contains'
        const isLineage  = !!e.lineage
        const isExposes  = e.relationship === 'exposes' || e.relationship === 'includes'
        const isQueries  = e.relationship === 'queries' || e.relationship === 'uses'
        return {
          id: e.id,
          source: e.source,
          target: e.target,
          label: isContains ? undefined : e.label,
          type: isContains ? 'smoothstep' : 'default',
          animated: !isContains && !isLineage && !isExposes,
          markerEnd: { type: MarkerType.ArrowClosed, width: 12, height: 12 },
          style: {
            stroke: isContains ? '#d1d5db' : isLineage ? '#3b82f6' : isExposes ? '#14b8a6' : isQueries ? '#8b5cf6' : '#f97316',
            strokeWidth: isLineage ? 2 : 1.5,
            strokeDasharray: isLineage ? '6 3' : undefined,
          },
          labelStyle: { fontSize: 9, fill: '#6b7280', fontFamily: 'system-ui, sans-serif' },
          labelBgStyle: { fill: '#ffffff', fillOpacity: 0.85 },
          labelBgPadding: [2, 3] as [number, number],
          labelBgBorderRadius: 2,
        }
      })

    setRfNodes(nodes)
    setRfEdges(edges)
  }, [clippedNodes, latticeEdges, collapsedSchemas, tableCountBySchema, toggleSchema, layoutMode, showLineage, freshnessFilter, costOverlayEnabled, costData, highlightedIds, activeTagFilter, annotations, tagConfig])

  // Tracks when WE are the ones updating node selection so onSelectionChange
  // knows to skip its re-sync (avoids the setRfNodes → onSelectionChange → setSelectedNodes → re-render loop)
  const ownSelectionUpdate = useRef(false)

  // Update selection state without triggering a relayout
  useEffect(() => {
    ownSelectionUpdate.current = true
    setRfNodes(prev => prev.map(n => ({ ...n, selected: n.id === selectedNodeId })))
  }, [selectedNodeId])

  // Always-current ref to rfNodes — readable in setTimeout callbacks without stale closure
  const rfNodesRef = useRef(rfNodes)
  rfNodesRef.current = rfNodes

  // Center on the most-connected visible node at a readable zoom.
  const zoomToTopCluster = useCallback(() => {
    const nodes = rfNodesRef.current
    const degreeMap = new Map<string, number>()
    for (const e of latticeEdges) {
      degreeMap.set(e.source, (degreeMap.get(e.source) ?? 0) + 1)
      degreeMap.set(e.target, (degreeMap.get(e.target) ?? 0) + 1)
    }
    const topNode = nodes
      .filter(n => !n.id.startsWith('__label__'))
      .sort((a, b) => (degreeMap.get(b.id) ?? 0) - (degreeMap.get(a.id) ?? 0))[0]
    if (!topNode) return
    setCenter(topNode.position.x + NODE_W / 2, topNode.position.y + NODE_H / 2, { zoom: 0.8, duration: 700 })
  }, [latticeEdges, setCenter])

  // On view/layout hard reset: schedule zoom 150ms out so React has time to
  // re-render with the new node set before we read rfNodesRef.current
  const filterKey = useMemo(
    () => `${viewMode}|${layoutMode}|${searchQuery}|${[...filterTypes].sort().join(',')}|${[...collapsedSchemas].sort().join(',')}`,
    [viewMode, layoutMode, searchQuery, filterTypes, collapsedSchemas],
  )
  // Separate ref so the layout effect updating prevHardResetKey doesn't interfere
  const prevHardResetKeyForZoom = useRef('')
  const prevFilterKey = useRef('')
  useEffect(() => {
    if (filterKey === prevFilterKey.current) return
    const wasHardReset = hardResetKey !== prevHardResetKeyForZoom.current
    prevFilterKey.current = filterKey
    prevHardResetKeyForZoom.current = hardResetKey
    if (!wasHardReset || !initialFitDone.current) return
    const t = setTimeout(zoomToTopCluster, 150)
    return () => clearTimeout(t)
  }, [filterKey, hardResetKey, zoomToTopCluster])

  // On first load: wait for both nodes and edges, then zoom
  const rfNodesLen = rfNodes.length
  const latticeEdgesLen = latticeEdges.length
  useEffect(() => {
    if (initialFitDone.current || rfNodesLen === 0 || latticeEdgesLen === 0) return
    initialFitDone.current = true
    const t = setTimeout(zoomToTopCluster, 150)
    return () => clearTimeout(t)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rfNodesLen, latticeEdgesLen, zoomToTopCluster])

  // Fit view to search results when search query changes
  const prevSearchQuery = useRef('')
  useEffect(() => {
    if (searchQuery === prevSearchQuery.current) return
    prevSearchQuery.current = searchQuery
    if (!searchQuery || rfNodes.length === 0) return
    const t = setTimeout(() => fitView({ padding: 0.15, duration: 400 }), 200)
    return () => clearTimeout(t)
  }, [searchQuery, rfNodes.length, fitView])

  // Fit view to highlighted nodes when highlight mode activates
  useEffect(() => {
    if (!highlightedIds || highlightedIds.size === 0) return
    const t = setTimeout(() => fitView({
      nodes: [...highlightedIds].map(id => ({ id })),
      padding: 0.25,
      duration: 500,
    }), 100)
    return () => clearTimeout(t)
  }, [highlightedIds, fitView])

  // Zoom to selected node (single select only — do not fit-all on deselect)
  useEffect(() => {
    if (!selectedNodeId) return
    const t = setTimeout(
      () => fitView({ nodes: [{ id: selectedNodeId }], padding: 0.5, duration: 600, maxZoom: 1.5 }),
      80,
    )
    return () => clearTimeout(t)
  }, [selectedNodeId, fitView])

  const onNodeClick = useCallback(
    (event: React.MouseEvent, node: Node) => {
      if (event.shiftKey) {
        // Shift+click: toggle node in/out of multi-select without opening detail panel
        if (selectedNodeIds.has(node.id)) {
          removeFromSelection(node.id)
        } else {
          addToSelection(node.id)
        }
        // Keep ReactFlow selection in sync
        setRfNodes(prev => prev.map(n => ({
          ...n,
          selected: n.id === node.id ? !selectedNodeIds.has(n.id) : n.selected,
        })))
      } else {
        // Normal click: clear multi-select and open detail panel
        // Note: do NOT call setRfNodes here for selection — the useEffect([selectedNodeId])
        // handles it. Calling setRfNodes here AND in the effect causes ReactFlow to fire
        // onSelectionChange twice, which creates an infinite re-render loop.
        clearSelection()
        selectNode(node.id)
      }
    },
    [selectNode, selectedNodeIds, addToSelection, removeFromSelection, clearSelection, setRfNodes],
  )

  // Persist drag positions so filter changes don't reset them
  const onNodeDragStop = useCallback((_: unknown, node: Node) => {
    savedPositions.current.set(node.id, node.position)
    userModifiedLayout.current = true
  }, [])

  // Multi-select: sync ReactFlow selection to store.
  // Guard: if this was fired in response to our own setRfNodes(selected) call, skip it
  // to break the setRfNodes → onSelectionChange → setSelectedNodes → re-render loop.
  const onSelectionChange = useCallback(
    ({ nodes: selectedRfNodes }: { nodes: Node[]; edges: Edge[] }) => {
      if (ownSelectionUpdate.current) {
        ownSelectionUpdate.current = false
        return
      }
      const idArr = selectedRfNodes.filter(n => !n.id.startsWith('__label__')).map(n => n.id)
      const ids = new Set(idArr)
      if (ids.size === 0 && selectedNodeIds.size === 0) return
      setSelectedNodes(idArr)
      // Single selection: also drive the detail panel
      if (ids.size === 1) {
        selectNode([...ids][0])
      } else if (ids.size === 0) {
        selectNode(null)
      }
    },
    [setSelectedNodes, selectNode, selectedNodeIds.size],
  )

  // Cmd/Ctrl+A: select all visible nodes
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'a') {
        e.preventDefault()
        const ids = new Set(clippedNodes.map(n => n.id))
        setSelectedNodes(clippedNodes.map(n => n.id))
        setRfNodes(prev => prev.map(n => ({ ...n, selected: ids.has(n.id) })))
      }
      if (e.key === 'Escape') {
        clearSelection()
        setRfNodes(prev => prev.map(n => ({ ...n, selected: false })))
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [clippedNodes, setSelectedNodes, clearSelection, setRfNodes])

  // Directional focus: place callers (→ anchor) above, targets (anchor →) below
  const focusNeighbors = useCallback(() => {
    if (!selectedNodeId) return
    const anchor = rfNodes.find(n => n.id === selectedNodeId)
    if (!anchor) return

    const cx = anchor.position.x + NODE_W / 2
    const cy = anchor.position.y + NODE_H / 2

    // Separate neighbors by edge direction
    const callerIds = new Set<string>()  // edge.target === anchor (things that → this node)
    const targetIds = new Set<string>()  // edge.source === anchor (this node → things)
    for (const e of rfEdges) {
      if (e.source === selectedNodeId) targetIds.add(e.target as string)
      if (e.target === selectedNodeId) callerIds.add(e.source as string)
    }
    // Bidirectional: stay in callers (will appear above)
    for (const id of callerIds) { if (targetIds.has(id)) targetIds.delete(id) }

    if (callerIds.size === 0 && targetIds.size === 0) return

    const COL_GAP = NODE_W + 24
    const ROW_GAP = NODE_H + 44
    const MAX_PER_ROW = 10
    const VERT_SPACING = NODE_H + 72  // gap between anchor and nearest row

    // Build positions for a set of nodes, arranged in rows centered on cx
    const layoutGroup = (ids: Set<string>, baseY: number): Map<string, { x: number; y: number }> => {
      const result = new Map<string, { x: number; y: number }>()
      if (ids.size === 0) return result
      const sorted = rfNodes
        .filter(n => ids.has(n.id))
        .sort((a, b) =>
          String((a.data as Record<string, unknown>).type ?? '').localeCompare(
            String((b.data as Record<string, unknown>).type ?? ''),
          ),
        )
      sorted.forEach((node, i) => {
        const row = Math.floor(i / MAX_PER_ROW)
        const col = i % MAX_PER_ROW
        const nodesInRow = Math.min(MAX_PER_ROW, sorted.length - row * MAX_PER_ROW)
        const rowW = nodesInRow * COL_GAP - (COL_GAP - NODE_W)
        result.set(node.id, {
          x: cx - rowW / 2 + col * COL_GAP,
          y: baseY + row * ROW_GAP,
        })
      })
      return result
    }

    // Callers: rows grow upward from just above the anchor
    const callerRows = Math.ceil(callerIds.size / MAX_PER_ROW)
    const callerBlockH = callerRows * ROW_GAP
    const callerBaseY = cy - NODE_H / 2 - VERT_SPACING - callerBlockH + ROW_GAP - NODE_H

    // Targets: rows grow downward from just below the anchor
    const targetBaseY = cy + NODE_H / 2 + VERT_SPACING

    const allPositions = new Map([
      ...layoutGroup(callerIds, callerBaseY),
      ...layoutGroup(targetIds, targetBaseY),
    ])

    setRfNodes(prev => prev.map(node => {
      const pos = allPositions.get(node.id)
      if (!pos) return node
      savedPositions.current.set(node.id, pos)
      return { ...node, position: pos }
    }))

    const focusedIds = [selectedNodeId, ...callerIds, ...targetIds]
    setTimeout(() => fitView({
      nodes: focusedIds.map(id => ({ id })),
      padding: 0.2,
      duration: 400,
    }), 50)
    userModifiedLayout.current = true
    setLayoutModified(true)
  }, [selectedNodeId, rfNodes, rfEdges, setRfNodes, fitView])

  // Tracks whether the user has manually rearranged nodes (drag / Focus) since last view switch
  const userModifiedLayout = useRef(false)
  // Drives the "re-apply layout" nudge after Focus is used
  const [layoutModified, setLayoutModified] = useState(false)
  const [pendingViewMode, setPendingViewMode] = useState<ViewMode | null>(null)
  const viewModePanelRef = useRef<HTMLDivElement>(null)
  const [pendingLayoutMode, setPendingLayoutMode] = useState<LayoutMode | null>(null)
  const layoutPanelRef = useRef<HTMLDivElement>(null)

  // Dismiss the confirm popover on outside click
  useEffect(() => {
    if (!pendingViewMode) return
    const handler = (e: MouseEvent) => {
      if (viewModePanelRef.current && !viewModePanelRef.current.contains(e.target as globalThis.Node)) {
        setPendingViewMode(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [pendingViewMode])

  useEffect(() => {
    if (!pendingLayoutMode) return
    const handler = (e: MouseEvent) => {
      if (layoutPanelRef.current && !layoutPanelRef.current.contains(e.target as globalThis.Node)) {
        setPendingLayoutMode(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [pendingLayoutMode])

  const confirmLayoutModeSwitch = useCallback((saveFirst: boolean) => {
    if (!pendingLayoutMode) return
    if (saveFirst) {
      const ws = workspaceInfo?.host?.replace(/^https?:\/\//, '').replace(/\/$/, '') ?? 'workspace'
      const catalog = rfNodes.find(n => (n.data as Record<string,unknown>).type === 'Catalog')
        ? String((rfNodes.find(n => (n.data as Record<string,unknown>).type === 'Catalog')!.data as Record<string,unknown>).name ?? 'catalog')
        : 'catalog'
      const viewport = getViewport()
      setSavedView({ name: `${ws} / ${catalog}`, workspace: ws, catalog, mode: 'graph', nodes: [...rfNodes], edges: [...rfEdges], viewport })
    }
    userModifiedLayout.current = false
    setLayoutModified(false)
    setLayoutMode(pendingLayoutMode)
    setPendingLayoutMode(null)
  }, [pendingLayoutMode, workspaceInfo, rfNodes, rfEdges, getViewport, setLayoutMode])

  const handleLayoutModeClick = useCallback((key: LayoutMode) => {
    if (key === layoutMode) return
    if (userModifiedLayout.current) {
      setPendingLayoutMode(key)
    } else {
      setLayoutModified(false)
      setLayoutMode(key)
    }
  }, [layoutMode, setLayoutMode])

  const [saveMenuOpen, setSaveMenuOpen] = useState(false)
  const saveMenuRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!saveMenuOpen) return
    const handler = (e: MouseEvent) => {
      if (saveMenuRef.current && !saveMenuRef.current.contains(e.target as globalThis.Node)) setSaveMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [saveMenuOpen])

  const handleViewModeClick = useCallback((key: ViewMode) => {
    if (key === viewMode) return
    if (userModifiedLayout.current) {
      setPendingViewMode(key)
    } else {
      userModifiedLayout.current = false
      setViewMode(key)
    }
  }, [viewMode, setViewMode])

  const confirmViewModeSwitch = useCallback((saveFirst: boolean, mode: SaveMode = 'graph') => {
    if (!pendingViewMode) return
    if (saveFirst) {
      // saveView is defined below — call after it's bound via closure capture
      const ws = workspaceInfo?.host?.replace(/^https?:\/\//, '').replace(/\/$/, '') ?? 'workspace'
      const filter = workspaceInfo?.catalog_filter
      const catalog = filter?.length ? filter.join(', ') : 'all catalogs'
      const frozenNodes: Node[] = rfNodes.map(n => ({
        ...n,
        data: { ...(n.data as object), onToggleCollapse: undefined },
      }))
      const viewport = getViewport()
      setSavedView({ name: `${ws} / ${catalog}`, workspace: ws, catalog, mode, nodes: frozenNodes, edges: [...rfEdges], viewport })
    }
    userModifiedLayout.current = false
    setViewMode(pendingViewMode)
    setPendingViewMode(null)
  }, [pendingViewMode, workspaceInfo, rfNodes, rfEdges, getViewport, setViewMode])

  const saveView = useCallback((mode: SaveMode) => {
    const ws = workspaceInfo?.host?.replace(/^https?:\/\//, '').replace(/\/$/, '') ?? 'workspace'
    const filter = workspaceInfo?.catalog_filter
    const catalog = filter?.length ? filter.join(', ') : 'all catalogs'
    // Deep-clone nodes stripping non-serializable functions so snapshot is truly frozen
    const frozenNodes: Node[] = rfNodes.map(n => ({
      ...n,
      data: { ...(n.data as object), onToggleCollapse: undefined },
    }))
    const viewport = getViewport()
    setSavedView({ name: `${ws} / ${catalog}`, workspace: ws, catalog, mode, nodes: frozenNodes, edges: [...rfEdges], viewport })
    setSaveMenuOpen(false)
  }, [rfNodes, rfEdges, workspaceInfo, getViewport])

  const visibleCount = clippedNodes.length

  return (
    <div className="flex-1 h-full flex relative">
      <div className={savedView ? 'flex-1' : 'flex-1'} style={savedView ? { width: '50%' } : undefined}>
      <ReactFlow
        key={layoutMode}
        nodes={rfNodes}
        edges={rfEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onNodeDragStop={onNodeDragStop}
        onSelectionChange={onSelectionChange}
        nodeTypes={nodeTypes}
        multiSelectionKeyCode="Shift"
        selectionKeyCode="Shift"
        fitView
        fitViewOptions={{ padding: 0.15 }}
        minZoom={0.04}
        maxZoom={2}
        defaultEdgeOptions={{ zIndex: 1 }}
      >
        <Background color="#e5e7eb" gap={20} />
        <Controls />
        <MiniMap
          nodeColor={(n) => ((n.data as { color?: string }).color ?? '#94a3b8')}
          zoomable
          pannable
          style={{ height: 120 }}
        />

        <Panel position="bottom-left">
          <EdgeLegend />
        </Panel>

        {/* View mode + layout toggle */}
        <Panel position="top-center">
          <div className="flex items-center gap-2">
            {/* Asset filter — with unsaved-layout guard */}
            <div className="flex flex-col items-start gap-0.5">
              {searchQuery && (
                <span className="flex items-center gap-1 text-[9px] text-amber-600 font-medium px-1">
                  <svg width="8" height="8" viewBox="0 0 10 10" fill="none" className="shrink-0">
                    <circle cx="4" cy="4" r="3" stroke="currentColor" strokeWidth="1.3"/>
                    <path d="M6.5 6.5L9 9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                  </svg>
                  Search filter active — showing filtered results
                </span>
              )}
              {freshnessFilter !== null && (
                <span className="flex items-center gap-1 text-[9px] text-indigo-600 font-medium px-1">
                  <svg width="8" height="8" viewBox="0 0 10 10" fill="none" className="shrink-0">
                    <circle cx="5" cy="5" r="4" stroke="currentColor" strokeWidth="1.3"/>
                    <path d="M5 3v2.5l1.5 1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                  </svg>
                  Activity timeline active — assets updated in last {freshnessFilter >= 365 ? '1y' : freshnessFilter >= 90 ? '90d' : freshnessFilter >= 30 ? '30d' : '7d'}
                </span>
              )}
            <div ref={viewModePanelRef} className="relative flex items-center gap-1 bg-white border border-gray-200 rounded-lg shadow-sm p-1">
              {VIEW_MODES.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => handleViewModeClick(key)}
                  title={
                    key === 'compute'
                      ? 'Compute view — enable Cost Overlay in the sidebar to see DBU attribution'
                      : key !== viewMode
                        ? 'Switch view and reset layout'
                        : undefined
                  }
                  className={`px-3 py-1 text-xs rounded-md font-medium transition-all ${
                    viewMode === key
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {label}
                </button>
              ))}

              {/* Confirm-before-reset popover */}
              {pendingViewMode && (
                <div className="absolute top-full left-0 mt-1.5 z-50 w-56 bg-white border border-amber-200 rounded-xl shadow-xl p-3">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <span className="text-amber-500 text-xs">⚠</span>
                    <span className="text-xs font-semibold text-gray-800">Reset layout?</span>
                  </div>
                  <p className="text-[10px] text-gray-500 mb-3 leading-relaxed">
                    You have manually arranged nodes. Switching views will reset the layout.
                  </p>
                  <div className="flex flex-col gap-1.5">
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => confirmViewModeSwitch(true)}
                        className="flex-1 px-2 py-1.5 text-[10px] font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                      >
                        Save snapshot &amp; reset
                      </button>
                      <button
                        onClick={() => confirmViewModeSwitch(false)}
                        className="flex-1 px-2 py-1.5 text-[10px] font-medium bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                      >
                        Proceed &amp; reset layout
                      </button>
                    </div>
                    <button
                      onClick={() => setPendingViewMode(null)}
                      className="w-full px-2 py-1.5 text-[10px] font-medium border border-gray-200 text-gray-500 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Cancel — keep current view
                    </button>
                  </div>
                </div>
              )}
              <span
                className={`px-2 border-l border-gray-200 ml-1 text-[10px] ${clipped ? 'text-amber-500' : 'text-gray-400'}`}
                title={clipped ? `Showing ${MAX_RENDER.toLocaleString()} of ${visibleNodes.length.toLocaleString()} — filter to see all` : undefined}
              >
                {clipped ? `${visibleCount.toLocaleString()} / ${visibleNodes.length.toLocaleString()}` : `${visibleCount} nodes`}
                {clipped && ' ⚠'}
              </span>
            </div>
            </div>

            {/* Filter nudge — shown when filter changed but user has arranged nodes */}
            {filterChangedWhileModified && (
              <button
                onClick={() => {
                  savedPositions.current.clear()
                  userModifiedLayout.current = false
                  setFilterChangedWhileModified(false)
                  setLayoutModified(false)
                  // Force re-render by bumping prevHardResetKey to trigger layout recompute
                  prevHardResetKey.current = ''
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-amber-50 border border-amber-300 text-amber-700 rounded-lg shadow-sm hover:bg-amber-100 transition-all"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M6 1v4l2.5 1.5M11 6a5 5 0 11-10 0 5 5 0 0110 0z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                </svg>
                Reset layout of filtered view
              </button>
            )}

            {/* Layout mode */}
            <div className="flex flex-col items-start gap-0.5">
              {layoutModified && (
                <span className="text-[9px] text-violet-500 font-medium px-1 animate-pulse">
                  ↓ Re-apply to reset + reorganize
                </span>
              )}
              <div ref={layoutPanelRef} className="relative">
                <div className={`flex items-center gap-1 bg-white border rounded-lg shadow-sm p-1 transition-all ${layoutModified ? 'border-violet-400 ring-2 ring-violet-200' : 'border-gray-200'}`}>
                  {LAYOUT_MODES.map(({ key, label, title }) => (
                    <button
                      key={key}
                      onClick={() => handleLayoutModeClick(key)}
                      title={title}
                      className={`px-3 py-1 text-xs rounded-md font-medium transition-all ${
                        layoutMode === key
                          ? 'bg-violet-600 text-white shadow-sm'
                          : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {pendingLayoutMode && (
                  <div className="absolute top-full left-0 mt-1.5 z-50 w-56 bg-white border border-amber-200 rounded-xl shadow-xl p-3">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <span className="text-amber-500 text-xs">⚠</span>
                      <span className="text-xs font-semibold text-gray-800">Reset layout?</span>
                    </div>
                    <p className="text-[10px] text-gray-500 mb-3 leading-relaxed">
                      You have manually arranged nodes. Switching layouts will reset your arrangement.
                    </p>
                    <div className="flex flex-col gap-1.5">
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => confirmLayoutModeSwitch(true)}
                          className="flex-1 px-2 py-1.5 text-[10px] font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                        >
                          Save snapshot &amp; reset
                        </button>
                        <button
                          onClick={() => confirmLayoutModeSwitch(false)}
                          className="flex-1 px-2 py-1.5 text-[10px] font-medium bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                        >
                          Proceed &amp; reset layout
                        </button>
                      </div>
                      <button
                        onClick={() => setPendingLayoutMode(null)}
                        className="w-full px-2 py-1.5 text-[10px] font-medium border border-gray-200 text-gray-500 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        Cancel — keep current view
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>


            {/* Clear highlights */}
            {highlightedIds !== null && (
              <button
                onClick={() => setHighlightedIds(null)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-amber-50 border border-amber-300 text-amber-700 rounded-lg shadow-sm hover:bg-amber-100 transition-all"
                title="Clear highlighted nodes"
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <circle cx="5" cy="5" r="4" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M3 3l4 4M7 3L3 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                Clear highlights ({highlightedIds.size})
              </button>
            )}

            {/* Focus hint — shown when nothing is selected */}
            {!selectedNodeId && (
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] text-gray-400 bg-white border border-gray-200 rounded-lg shadow-sm select-none">
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="shrink-0 opacity-60">
                  <circle cx="5" cy="5" r="4" stroke="currentColor" strokeWidth="1.3"/>
                  <path d="M5 4.5v3M5 3h.01" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                </svg>
                Click a node, then use <span className="font-semibold text-gray-500 mx-0.5">Focus</span> to arrange its connections
              </div>
            )}

            {/* Focus neighbors — only visible when a node is selected */}
            {selectedNodeId && (
              <button
                onClick={focusNeighbors}
                title="Rearranges connected nodes around the selection — callers above, targets below. Use UC Tree / Compute / All to reset the layout."
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white border border-indigo-300 text-indigo-600 rounded-lg shadow-sm hover:bg-indigo-50 transition-all"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <circle cx="6" cy="6" r="2" fill="currentColor"/>
                  <circle cx="6" cy="1.5" r="1.5" fill="currentColor" opacity=".5"/>
                  <circle cx="6" cy="10.5" r="1.5" fill="currentColor" opacity=".5"/>
                  <circle cx="1.5" cy="6" r="1.5" fill="currentColor" opacity=".5"/>
                  <circle cx="10.5" cy="6" r="1.5" fill="currentColor" opacity=".5"/>
                </svg>
                Focus
              </button>
            )}

            {/* Save View */}
            <div className="relative" ref={saveMenuRef}>
              <div className={`flex items-stretch rounded-lg shadow-sm border overflow-hidden transition-all ${savedView ? 'border-emerald-500' : 'border-gray-200'}`}>
                <button
                  onClick={() => saveView(savedView?.mode ?? 'graph')}
                  title="Freeze this canvas for side-by-side comparison"
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-all ${
                    savedView ? 'bg-emerald-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                    <rect x="0.75" y="0.75" width="4.5" height="9.5" rx="1" stroke="currentColor" strokeWidth="1.5"/>
                    <rect x="5.75" y="0.75" width="4.5" height="9.5" rx="1" stroke="currentColor" strokeWidth="1.5"/>
                  </svg>
                  {savedView ? `Saved (${savedView.mode})` : 'Save View'}
                </button>
                <button
                  onClick={() => setSaveMenuOpen(v => !v)}
                  className={`px-1.5 border-l text-xs transition-all ${
                    savedView ? 'bg-emerald-600 text-white border-emerald-500' : 'bg-white text-gray-400 border-gray-200 hover:bg-gray-50'
                  }`}
                  title="Choose save mode"
                >
                  ▾
                </button>
              </div>
              {saveMenuOpen && (
                <div className="absolute right-0 top-full mt-1 z-50 bg-white border border-gray-200 rounded-lg shadow-lg w-52 text-xs overflow-hidden">
                  <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-gray-400 font-semibold border-b border-gray-100">
                    Save mode
                  </div>
                  <button
                    onClick={() => saveView('graph')}
                    className="w-full text-left px-3 py-2 hover:bg-gray-50 flex flex-col gap-0.5"
                  >
                    <span className="font-medium text-gray-700">Graph</span>
                    <span className="text-[10px] text-gray-400">Visual layout — compact JSON export</span>
                  </button>
                  <button
                    onClick={() => saveView('details')}
                    className="w-full text-left px-3 py-2 hover:bg-gray-50 flex flex-col gap-0.5 border-t border-gray-100"
                  >
                    <span className="font-medium text-gray-700">Graph + Details</span>
                    <span className="text-[10px] text-gray-400">Full node metadata — owner, stats, tags</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </Panel>
      </ReactFlow>
      </div>
      {savedView && (
        <ReactFlowProvider>
          <FrozenPane view={savedView} onClose={() => setSavedView(null)} />
        </ReactFlowProvider>
      )}
    </div>
  )
}
