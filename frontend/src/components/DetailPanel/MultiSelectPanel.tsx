import { useState, useMemo } from 'react'
import { X, Tag } from 'lucide-react'
import { useGraphStore } from '../../stores/graphStore'
import { getTagColor } from '../../constants/tagConfig'
import { TagComboBox } from './TagComboBox'

export function MultiSelectPanel() {
  const {
    selectedNodeIds, clearSelection, nodes, tagConfig,
    annotations, annotationsAvailable, bulkUpsertAnnotation,
  } = useGraphStore()

  const [pendingTags, setPendingTags] = useState<string[]>([])
  const [pendingNote, setPendingNote] = useState('')
  const [applying, setApplying] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const selectedNodes = useMemo(
    () => nodes.filter(n => selectedNodeIds.has(n.id)),
    [nodes, selectedNodeIds]
  )

  // Type breakdown
  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const n of selectedNodes) {
      counts[n.type] = (counts[n.type] ?? 0) + 1
    }
    return counts
  }, [selectedNodes])

  const typeBreakdown = Object.entries(typeCounts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([type, count]) => `${count} ${type}${count !== 1 ? 's' : ''}`)
    .join(', ')

  // Common tags: tags that exist on ≥1 selected node, with counts
  const commonTags = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const n of selectedNodes) {
      const fqn = n.fqn
      const ann = annotations[fqn]
      for (const tag of ann?.tags ?? []) {
        counts[tag] = (counts[tag] ?? 0) + 1
      }
    }
    return Object.entries(counts)
      .sort(([, a], [, b]) => b - a)
      .map(([tag, count]) => ({ tag, count }))
  }, [selectedNodes, annotations])

  const handleAddPendingTag = (tag: string) => {
    if (!pendingTags.includes(tag)) {
      setPendingTags(prev => [...prev, tag])
    }
  }

  const handleRemovePendingTag = (tag: string) => {
    setPendingTags(prev => prev.filter(t => t !== tag))
  }

  const handleApplyTags = async () => {
    if (pendingTags.length === 0 && !pendingNote) return
    setApplying(true)
    const fqns = selectedNodes.map(n => n.fqn).filter(Boolean)
    await bulkUpsertAnnotation(fqns, pendingTags, pendingNote)
    const tagStr = pendingTags.length > 0 ? ` with ${pendingTags.join(', ')}` : ''
    setToast(`Tagged ${fqns.length} nodes${tagStr}`)
    setTimeout(() => setToast(null), 3000)
    setPendingTags([])
    setPendingNote('')
    setApplying(false)
  }

  const handleToggleCommonTag = async (tag: string, count: number) => {
    const fqns = selectedNodes.map(n => n.fqn).filter(Boolean)
    const allHaveIt = count === selectedNodes.length
    if (allHaveIt) {
      // Remove from all
      for (const n of selectedNodes) {
        const ann = useGraphStore.getState().annotations[n.fqn]
        const newTags = (ann?.tags ?? []).filter(t => t !== tag)
        await useGraphStore.getState().upsertAnnotation(n.fqn, newTags, ann?.note ?? '')
      }
    } else {
      // Apply to all that don't have it
      await bulkUpsertAnnotation(fqns, [tag], '')
    }
  }

  const { selectNode } = useGraphStore()

  return (
    <div className="w-80 bg-white border-l border-gray-200 flex flex-col h-full overflow-hidden shadow-lg">
      {/* Header */}
      <div className="flex items-start justify-between px-4 py-3 border-b border-gray-200">
        <div>
          <div className="font-semibold text-sm text-gray-800">{selectedNodeIds.size} nodes selected</div>
          <div className="text-[10px] text-gray-400 mt-0.5">{typeBreakdown}</div>
        </div>
        <button
          onClick={clearSelection}
          className="ml-2 p-1 hover:bg-gray-100 rounded text-gray-400 shrink-0"
          title="Clear selection"
        >
          <X size={14} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Tag all section */}
        {annotationsAvailable && (
          <div className="px-4 py-3 border-b border-gray-100">
            <div className="text-[10px] uppercase tracking-wider text-gray-400 mb-2 font-semibold flex items-center gap-1">
              <Tag size={9} />
              Tag all selected
            </div>

            {/* Pending tag pills + add button */}
            <div className="flex flex-wrap items-center gap-1.5 min-h-[22px] mb-2">
              {pendingTags.map(tag => {
                const colorName = tagConfig[tag]?.color ?? 'teal'
                const colors = getTagColor(colorName)
                return (
                  <span
                    key={tag}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${colors.bg} ${colors.text}`}
                  >
                    {tag}
                    <button onClick={() => handleRemovePendingTag(tag)} className="hover:opacity-70">
                      <X size={9} />
                    </button>
                  </span>
                )
              })}
              <TagComboBox currentTags={pendingTags} onAdd={handleAddPendingTag} />
            </div>

            {/* Note input */}
            <textarea
              value={pendingNote}
              onChange={e => setPendingNote(e.target.value)}
              placeholder="Add a note (appended to existing notes)..."
              rows={2}
              className="w-full text-[11px] text-gray-700 placeholder-gray-300 bg-gray-50 border border-gray-200 rounded px-2 py-1.5 resize-none focus:outline-none focus:border-indigo-300 mb-2"
            />

            {/* Apply buttons */}
            <div className="flex gap-2">
              <button
                onClick={handleApplyTags}
                disabled={applying || (pendingTags.length === 0 && !pendingNote)}
                className="flex-1 text-xs font-medium py-1.5 px-3 rounded bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {applying ? 'Applying...' : `Apply to ${selectedNodeIds.size} nodes`}
              </button>
            </div>

            {toast && (
              <div className="mt-2 text-[10px] text-green-600 bg-green-50 rounded px-2 py-1">
                {toast}
              </div>
            )}
          </div>
        )}

        {/* Common tags */}
        {commonTags.length > 0 && (
          <div className="px-4 py-3 border-b border-gray-100">
            <div className="text-[10px] uppercase tracking-wider text-gray-400 mb-2 font-semibold">
              Common tags
            </div>
            <div className="space-y-1">
              {commonTags.map(({ tag, count }) => {
                const colorName = tagConfig[tag]?.color ?? 'teal'
                const colors = getTagColor(colorName)
                const allHaveIt = count === selectedNodes.length
                return (
                  <button
                    key={tag}
                    onClick={() => handleToggleCommonTag(tag, count)}
                    className="w-full flex items-center gap-2 text-xs text-left hover:bg-gray-50 rounded px-1 py-0.5 group"
                    title={allHaveIt ? `Remove "${tag}" from all selected` : `Apply "${tag}" to all selected`}
                  >
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: colors.dot }} />
                    <span className={`${colors.text} font-medium`}>{tag}</span>
                    <span className="text-gray-400 ml-auto text-[10px]">{count} of {selectedNodes.length}</span>
                    <span className="text-[9px] text-gray-300 group-hover:text-gray-400">
                      {allHaveIt ? '− remove' : '+ apply all'}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Selected nodes list */}
        <div className="px-4 py-3">
          <div className="text-[10px] uppercase tracking-wider text-gray-400 mb-2 font-semibold">
            Selected nodes
          </div>
          <div className="space-y-0.5 max-h-64 overflow-y-auto">
            {selectedNodes.map(n => (
              <button
                key={n.id}
                onClick={() => {
                  clearSelection()
                  selectNode(n.id)
                }}
                className="w-full flex items-center gap-2 text-left px-1 py-1 rounded hover:bg-gray-50 group"
              >
                <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-gray-300" />
                <span className="text-[11px] text-gray-700 truncate flex-1">{n.fqn || n.name}</span>
                <span className="text-[9px] text-gray-400 shrink-0">{n.type}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
