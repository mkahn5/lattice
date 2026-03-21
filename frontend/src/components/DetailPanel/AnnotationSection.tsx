import { useState, useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { useGraphStore } from '../../stores/graphStore'
import { getTagColor } from '../../constants/tagConfig'
import { TagComboBox } from './TagComboBox'

interface AnnotationSectionProps {
  nodeId: string
  fqn: string
  nodeType: string
}

export function AnnotationSection({ nodeId, fqn, nodeType }: AnnotationSectionProps) {
  const {
    annotations, tagConfig, annotationsAvailable, annotationsError,
    upsertAnnotation, bulkUpsertAnnotation,
    workspaceInfo, appStatus,
  } = useGraphStore()

  const ann = annotations[fqn]
  const currentTags: string[] = ann?.tags ?? []
  const [noteValue, setNoteValue] = useState(ann?.note ?? '')
  const [saved, setSaved] = useState(false)
  const [bulkPromptTag, setBulkPromptTag] = useState<string | null>(null)
  const [descendantCount, setDescendantCount] = useState<number | null>(null)
  const noteRef = useRef<HTMLTextAreaElement>(null)
  const isSchema = nodeType === 'Schema'
  const isCatalog = nodeType === 'Catalog'

  // Sync note field when annotation changes externally (e.g. after fetch)
  useEffect(() => {
    setNoteValue(ann?.note ?? '')
  }, [fqn, ann?.note])

  // Fetch descendant count for Schema/Catalog bulk prompt
  useEffect(() => {
    if (!isSchema && !isCatalog) return
    fetch(`/api/nodes/${encodeURIComponent(nodeId)}/descendants`)
      .then(r => r.json())
      .then(d => setDescendantCount((d.descendants ?? []).length))
      .catch(() => setDescendantCount(null))
  }, [nodeId, isSchema, isCatalog])

  if (!annotationsAvailable) {
    if (annotationsError) {
      const host = workspaceInfo?.host?.replace(/\/$/, '')
      const whId = appStatus?.warehouse_id
      const whUrl = host && whId ? `${host}/sql/warehouses/${whId}` : host ? `${host}/sql/warehouses` : null
      return (
        <div className="px-4 py-2 text-[10px] text-gray-400 border-b border-gray-100">
          <span>Annotations unavailable — a running SQL warehouse is required. </span>
          {whUrl ? (
            <a href={whUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-500 hover:text-indigo-700 underline">
              Check warehouse status
            </a>
          ) : (
            <span>Configure a warehouse in Settings.</span>
          )}
        </div>
      )
    }
    return null
  }

  const handleAddTag = async (tag: string) => {
    const newTags = [...new Set([...currentTags, tag])]
    await upsertAnnotation(fqn, newTags, noteValue)
    if ((isSchema || isCatalog) && descendantCount && descendantCount > 0) {
      setBulkPromptTag(tag)
    }
  }

  const handleRemoveTag = (tag: string) => {
    const newTags = currentTags.filter(t => t !== tag)
    upsertAnnotation(fqn, newTags, noteValue)
  }

  const handleNoteSave = () => {
    if (noteValue === (ann?.note ?? '')) return
    upsertAnnotation(fqn, currentTags, noteValue)
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  const handleNoteKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      handleNoteSave()
    }
  }

  const handleBulkYes = async () => {
    if (!bulkPromptTag) return
    try {
      const res = await fetch(`/api/nodes/${encodeURIComponent(nodeId)}/descendants`)
      const data = await res.json()
      const fqns: string[] = data.descendants ?? []
      if (fqns.length > 0) {
        await bulkUpsertAnnotation(fqns, [bulkPromptTag], '')
      }
    } catch { /* silent */ }
    setBulkPromptTag(null)
  }

  return (
    <div className="px-4 py-3 border-b border-gray-100">
      {/* Tag pills row */}
      <div className="flex flex-wrap items-center gap-1.5 min-h-[22px]">
        {currentTags.map(tag => {
          const colorName = tagConfig[tag]?.color ?? 'teal'
          const colors = getTagColor(colorName)
          return (
            <span
              key={tag}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${colors.bg} ${colors.text}`}
            >
              {tag}
              <button
                onClick={() => handleRemoveTag(tag)}
                className="hover:opacity-70 transition-opacity leading-none"
                title={`Remove ${tag}`}
              >
                <X size={9} />
              </button>
            </span>
          )
        })}
        <TagComboBox currentTags={currentTags} onAdd={handleAddTag} />
      </div>

      {/* Bulk prompt */}
      {bulkPromptTag && descendantCount != null && descendantCount > 0 && (
        <div className="mt-2 text-[10px] text-gray-500 flex items-center gap-2">
          <span>Apply "{bulkPromptTag}" to all {descendantCount} children?</span>
          <button onClick={handleBulkYes} className="text-indigo-600 hover:underline font-medium">Yes</button>
          <button onClick={() => setBulkPromptTag(null)} className="text-gray-400 hover:underline">No</button>
        </div>
      )}

      {/* Note textarea */}
      <div className="mt-2 relative">
        <textarea
          ref={noteRef}
          value={noteValue}
          onChange={e => setNoteValue(e.target.value)}
          onBlur={handleNoteSave}
          onKeyDown={handleNoteKeyDown}
          placeholder="Add a note..."
          rows={2}
          className="w-full text-[11px] text-gray-700 placeholder-gray-300 bg-gray-50 border border-gray-200 rounded px-2 py-1.5 resize-none focus:outline-none focus:border-indigo-300 focus:bg-white transition-colors"
        />
        {saved && (
          <span className="absolute bottom-2 right-2 text-[9px] text-green-500 pointer-events-none animate-fade-out">
            Saved
          </span>
        )}
      </div>
    </div>
  )
}
