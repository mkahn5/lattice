import { create } from 'zustand'
import type { LatticeNode, LatticeEdge, GraphStats, NodeType } from '../types'
import type { Annotation, TagConfig } from '../types/annotations'

export type ViewMode = 'uc' | 'compute' | 'all'

interface WorkspaceInfo {
  host: string
  catalog_filter: string[] | null
  ingested: boolean
}

export interface PreflightCheck {
  key: string
  name: string
  description: string
  enabled_feature: string
  ok: boolean | null
  error: string | null
  fix_sql: string | null
  docs_url: string | null
}

export interface AppStatus {
  ready: boolean
  running: boolean
  user: string | null
  warehouse_id: string | null
  checked_at: number | null
  checks: PreflightCheck[]
}

export interface AppConfig {
  version: number
  catalogs: string[]
  schema_limit: number
  table_limit: number
  warehouse_id: string
  is_first_run: boolean
  lineage_backfill_jobs: number
  lineage_backfill_tables: number
  lineage_query_limit: number
}

export interface ScorecardDimension {
  name: string
  key: string
  score: number
  weight: number
  weighted_contribution: number
  available: boolean
  detail: Record<string, unknown>
}

export interface ScorecardOffenderItem {
  id: string
  fqn?: string
  name: string
  [key: string]: unknown
}

export interface ScorecardOffenderGroup {
  category: string
  label: string
  count: number
  items: ScorecardOffenderItem[]
}

export interface ScorecardStructure {
  observation: string
  severity: 'warning' | 'info' | 'positive'
  message: string
  details: Array<Record<string, unknown>>
}

export interface ScorecardCatalog {
  catalog_name: string
  composite: number
  grade: string
  table_count: number
}

export interface ScorecardData {
  available: boolean
  reason?: string
  score?: {
    composite: number
    grade: string
    label: string
    delta: number | null
    delta_direction: string | null
    previous_composite: number | null
    computed_at: string
  }
  dimensions?: ScorecardDimension[]
  offenders?: ScorecardOffenderGroup[]
  workspace_structure?: ScorecardStructure[]
  by_catalog?: ScorecardCatalog[]
  notes?: string
  notes_updated_at?: string
  table_count?: number
  compute_count?: number
  enrichment_available: boolean
}

export interface CostNodeData {
  direct_dbu: number
  attributed_dbu: number
  total_dbu: number
  cost_rank_pct: number
  top_consumers: Array<{ id: string; name: string; dbu: number }>
}

export interface CostApiResponse {
  available: boolean
  summary: {
    total_workspace_dbu_30d: number
    top_catalogs: Array<{ id: string; name: string; fqn: string; total_dbu: number }>
    top_schemas: Array<{ id: string; name: string; fqn: string; total_dbu: number }>
    top_tables: Array<{ id: string; name: string; fqn: string; total_dbu: number }>
  }
  nodes: Record<string, CostNodeData>
}

interface GraphStore {
  nodes: LatticeNode[]
  edges: LatticeEdge[]
  stats: GraphStats | null
  selectedNodeId: string | null
  filterTypes: Set<NodeType>
  searchQuery: string
  loading: boolean
  error: string | null
  viewMode: ViewMode
  collapsedSchemas: Set<string>
  workspaceInfo: WorkspaceInfo | null
  showLineage: boolean
  freshnessFilter: number | null
  costOverlayEnabled: boolean
  costData: CostApiResponse | null
  costDataLoading: boolean
  highlightedIds: Set<string> | null

  // Annotation state
  annotations: Record<string, Annotation>
  allTags: string[]
  tagConfig: Record<string, TagConfig>
  activeTagFilter: string | null
  annotationsAvailable: boolean
  annotationsLoaded: boolean
  annotationsError: string | null

  // Phase 5: config, status, wizard
  appConfig: AppConfig | null
  appStatus: AppStatus | null
  showWizard: boolean
  showSettings: boolean
  showScorecard: boolean
  scorecardData: ScorecardData | null
  scorecardLoading: boolean
  scorecardDisabledDims: Set<string>

  fetchConfig: () => Promise<void>
  saveConfig: (updates: Partial<Omit<AppConfig, 'version' | 'is_first_run'>>) => Promise<{ re_ingesting: boolean }>
  fetchStatus: () => Promise<void>
  setShowWizard: (show: boolean) => void
  setShowSettings: (show: boolean) => void
  setShowScorecard: (show: boolean) => void
  fetchScorecard: (catalog?: string) => Promise<void>
  saveScorecardNotes: (notes: string) => Promise<void>
  toggleScorecardDim: (key: string) => void

  // Multi-select state
  selectedNodeIds: Set<string>

  // Graph actions
  loadGraph: () => Promise<void>
  refreshGraph: () => Promise<void>
  selectNode: (id: string | null) => void
  setFilterTypes: (types: Set<NodeType>) => void
  setSearchQuery: (q: string) => void
  setViewMode: (mode: ViewMode) => void
  toggleSchema: (id: string) => void
  loadInfo: () => Promise<void>
  toggleLineage: () => void
  setFreshnessFilter: (days: number | null) => void
  toggleCostOverlay: () => void
  fetchCostData: () => Promise<void>
  setHighlightedIds: (ids: Set<string> | null) => void

  // Annotation actions
  fetchAnnotations: () => Promise<void>
  upsertAnnotation: (fqn: string, tags: string[], note: string) => Promise<void>
  deleteAnnotation: (fqn: string) => Promise<void>
  bulkUpsertAnnotation: (fqns: string[], tags: string[], note: string) => Promise<void>
  setActiveTagFilter: (tag: string | null) => void

  // Multi-select actions
  setSelectedNodes: (ids: string[]) => void
  clearSelection: () => void
  addToSelection: (id: string) => void
  removeFromSelection: (id: string) => void
}

export const useGraphStore = create<GraphStore>((set, get) => ({
  nodes: [],
  edges: [],
  stats: null,
  selectedNodeId: null,
  filterTypes: new Set(),
  searchQuery: '',
  loading: false,
  error: null,
  viewMode: 'all',
  collapsedSchemas: new Set(),
  workspaceInfo: null,
  showLineage: true,
  freshnessFilter: null,
  costOverlayEnabled: false,
  costData: null,
  costDataLoading: false,
  highlightedIds: null,

  // Annotation initial state
  annotations: {},
  allTags: [],
  tagConfig: {},
  activeTagFilter: null,
  annotationsAvailable: false,
  annotationsLoaded: false,
  annotationsError: null,

  // Phase 5 initial state
  appConfig: null,
  appStatus: null,
  showWizard: false,
  showSettings: false,
  showScorecard: false,
  scorecardData: null,
  scorecardLoading: false,
  scorecardDisabledDims: new Set(),

  // Multi-select initial state
  selectedNodeIds: new Set(),

  loadGraph: async () => {
    set({ loading: true, error: null })
    try {
      const res = await fetch('/api/graph')
      const data = await res.json()
      set({ nodes: data.nodes, edges: data.edges, stats: data.stats, loading: false })
      if (get().costData !== null) {
        get().fetchCostData()
      }
    } catch (e) {
      set({ error: String(e), loading: false })
    }
  },

  refreshGraph: async () => {
    set({ loading: true, error: null, scorecardData: null })
    try {
      await fetch('/api/refresh', { method: 'POST' })
      const res = await fetch('/api/graph')
      const data = await res.json()
      set({
        nodes: data.nodes,
        edges: data.edges,
        stats: data.stats,
        loading: false,
        selectedNodeIds: new Set(), // clear selection on refresh
      })
      if (get().costData !== null) {
        get().fetchCostData()
      }
      // Re-fetch annotations to pick up any store-side merges
      get().fetchAnnotations()
    } catch (e) {
      set({ error: String(e), loading: false })
    }
  },

  loadInfo: async () => {
    try {
      const res = await fetch('/api/info')
      const data = await res.json()
      set({ workspaceInfo: data })
    } catch { /* ignore */ }
  },

  fetchCostData: async () => {
    set({ costDataLoading: true })
    try {
      const res = await fetch('/api/cost')
      const data = await res.json()
      set({ costData: data, costDataLoading: false })
    } catch {
      set({ costDataLoading: false })
    }
  },

  toggleCostOverlay: () => {
    const { costData, fetchCostData } = get()
    const enabled = !get().costOverlayEnabled
    set({ costOverlayEnabled: enabled })
    if (enabled && !costData) {
      fetchCostData()
    }
  },

  setHighlightedIds: (ids) => set({ highlightedIds: ids }),
  toggleLineage: () => set((state) => ({ showLineage: !state.showLineage })),
  setFreshnessFilter: (days) => set({ freshnessFilter: days }),
  selectNode: (id) => set({ selectedNodeId: id }),
  setFilterTypes: (types) => set({ filterTypes: types }),
  setSearchQuery: (q) => set({ searchQuery: q }),
  setViewMode: (mode) => set({ viewMode: mode, collapsedSchemas: new Set(), selectedNodeIds: new Set() }),
  toggleSchema: (id) => set((state) => {
    const next = new Set(state.collapsedSchemas)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return { collapsedSchemas: next }
  }),

  // ------------------------------------------------------------------ //
  //  Annotation actions                                                   //
  // ------------------------------------------------------------------ //

  fetchAnnotations: async () => {
    try {
      const res = await fetch('/api/annotations')
      const data = await res.json()
      if (!data.available) {
        set({
          annotationsAvailable: false,
          annotationsLoaded: true,
          annotationsError: data.error ?? 'Annotations unavailable',
          annotations: {},
          allTags: [],
          tagConfig: {},
        })
        return
      }
      set({
        annotationsAvailable: true,
        annotationsLoaded: true,
        annotationsError: null,
        annotations: data.annotations ?? {},
        allTags: data.all_tags ?? [],
        tagConfig: data.tag_config ?? {},
      })
    } catch (e) {
      set({ annotationsLoaded: true, annotationsError: String(e) })
    }
  },

  upsertAnnotation: async (fqn, tags, note) => {
    // Optimistic update
    const prev = get().annotations
    const prevEntry = prev[fqn]
    const optimistic = tags.length === 0 && !note
      ? (() => { const copy = { ...prev }; delete copy[fqn]; return copy })()
      : { ...prev, [fqn]: { ...prevEntry, tags, note, updated: new Date().toISOString() } as Annotation }
    set({ annotations: optimistic, allTags: _computeAllTags(optimistic, get().tagConfig) })

    try {
      const res = await fetch(`/api/annotations/${encodeURIComponent(fqn)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tags, note }),
      })
      if (!res.ok && res.status !== 204) {
        // Revert
        set({ annotations: prev, allTags: _computeAllTags(prev, get().tagConfig) })
        console.error('[annotations] upsert failed:', await res.text())
        return
      }
      // Re-fetch to get server-side normalized state
      get().fetchAnnotations()
    } catch (e) {
      set({ annotations: prev, allTags: _computeAllTags(prev, get().tagConfig) })
      console.error('[annotations] upsert error:', e)
    }
  },

  deleteAnnotation: async (fqn) => {
    const prev = get().annotations
    const optimistic = { ...prev }
    delete optimistic[fqn]
    set({ annotations: optimistic, allTags: _computeAllTags(optimistic, get().tagConfig) })

    try {
      const res = await fetch(`/api/annotations/${encodeURIComponent(fqn)}`, { method: 'DELETE' })
      if (!res.ok && res.status !== 204 && res.status !== 404) {
        set({ annotations: prev, allTags: _computeAllTags(prev, get().tagConfig) })
      }
    } catch {
      set({ annotations: prev, allTags: _computeAllTags(prev, get().tagConfig) })
    }
  },

  bulkUpsertAnnotation: async (fqns, tags, note) => {
    // Optimistic: merge tags into each fqn in store
    const prev = get().annotations
    const optimistic = { ...prev }
    const now = new Date().toISOString()
    for (const fqn of fqns) {
      const existing = optimistic[fqn]
      const merged = Array.from(new Set([...(existing?.tags ?? []), ...tags]))
      const mergedNote = existing?.note
        ? (note ? existing.note + '\n' + note : existing.note)
        : (note ?? '')
      optimistic[fqn] = { tags: merged, note: mergedNote, created: existing?.created ?? now, updated: now }
    }
    set({ annotations: optimistic, allTags: _computeAllTags(optimistic, get().tagConfig) })

    try {
      const res = await fetch('/api/annotations/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fqns, tags, note }),
      })
      if (!res.ok) {
        set({ annotations: prev, allTags: _computeAllTags(prev, get().tagConfig) })
        console.error('[annotations] bulk upsert failed:', await res.text())
        return
      }
      get().fetchAnnotations()
    } catch (e) {
      set({ annotations: prev, allTags: _computeAllTags(prev, get().tagConfig) })
      console.error('[annotations] bulk upsert error:', e)
    }
  },

  setActiveTagFilter: (tag) => set({ activeTagFilter: tag }),

  // ------------------------------------------------------------------ //
  //  Phase 5: config + status                                            //
  // ------------------------------------------------------------------ //

  fetchConfig: async () => {
    try {
      const res = await fetch('/api/config')
      const data: AppConfig = await res.json()
      set({ appConfig: data, showWizard: data.is_first_run })
    } catch { /* ignore */ }
  },

  saveConfig: async (updates) => {
    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      const data = await res.json()
      // Refresh config from server after save
      const cfgRes = await fetch('/api/config')
      const cfg: AppConfig = await cfgRes.json()
      set({ appConfig: cfg })
      return { re_ingesting: data.re_ingesting ?? false }
    } catch {
      return { re_ingesting: false }
    }
  },

  fetchStatus: async () => {
    try {
      const res = await fetch('/api/status')
      const data: AppStatus = await res.json()
      set({ appStatus: data })
    } catch { /* ignore */ }
  },

  setShowWizard: (show) => set({ showWizard: show }),
  setShowSettings: (show) => set({ showSettings: show }),
  setShowScorecard: (show) => set({ showScorecard: show }),
  fetchScorecard: async (catalog) => {
    set({ scorecardLoading: true })
    try {
      const url = catalog ? `/api/scorecard?catalog=${encodeURIComponent(catalog)}` : '/api/scorecard'
      const r = await fetch(url)
      const data = await r.json()
      set({ scorecardData: data, scorecardLoading: false })
    } catch {
      set({ scorecardLoading: false })
    }
  },
  saveScorecardNotes: async (notes) => {
    try {
      await fetch('/api/scorecard/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes }),
      })
    } catch { /* silent */ }
  },
  toggleScorecardDim: (key) => {
    const prev = get().scorecardDisabledDims
    const next = new Set(prev)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    set({ scorecardDisabledDims: next })
  },

  // ------------------------------------------------------------------ //
  //  Multi-select actions                                                 //
  // ------------------------------------------------------------------ //

  setSelectedNodes: (ids) => set({ selectedNodeIds: new Set(ids) }),

  clearSelection: () => set({ selectedNodeIds: new Set() }),

  addToSelection: (id) => set((state) => {
    const next = new Set(state.selectedNodeIds)
    next.add(id)
    return { selectedNodeIds: next }
  }),

  removeFromSelection: (id) => set((state) => {
    const next = new Set(state.selectedNodeIds)
    next.delete(id)
    return { selectedNodeIds: next }
  }),
}))

function _computeAllTags(annotations: Record<string, Annotation>, tagConfig: Record<string, TagConfig>): string[] {
  const tags = new Set<string>()
  for (const ann of Object.values(annotations)) {
    for (const t of ann.tags) tags.add(t)
  }
  // Sort: built-ins by priority, then custom alphabetically
  return Array.from(tags).sort((a, b) => {
    const pa = tagConfig[a]?.priority ?? 99
    const pb = tagConfig[b]?.priority ?? 99
    if (pa !== pb) return pa - pb
    return a.localeCompare(b)
  })
}
