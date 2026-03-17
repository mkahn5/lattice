import { useState, useRef, useEffect, useCallback } from 'react'
import { Plus } from 'lucide-react'
import { useGraphStore } from '../../stores/graphStore'
import { getTagColor } from '../../constants/tagConfig'

interface TagComboBoxProps {
  currentTags: string[]
  onAdd: (tag: string) => void
}

export function TagComboBox({ currentTags, onAdd }: TagComboBoxProps) {
  const { allTags, tagConfig } = useGraphStore()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIdx, setActiveIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const availableTags = allTags.filter(t => !currentTags.includes(t))
  const filtered = query
    ? availableTags.filter(t => t.includes(query.toLowerCase()))
    : availableTags

  // Show "Create" option if query doesn't exactly match any existing tag
  const queryNorm = query.trim().toLowerCase().replace(/\s+/g, '-')
  const showCreate = queryNorm.length > 0 && !allTags.includes(queryNorm)
  const options = showCreate ? [...filtered, `__create__:${queryNorm}`] : filtered

  const select = useCallback((opt: string) => {
    const tag = opt.startsWith('__create__:') ? opt.slice(11) : opt
    if (tag) onAdd(tag)
    setOpen(false)
    setQuery('')
    setActiveIdx(0)
  }, [onAdd])

  // Click outside to close
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [open])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { setOpen(false); setQuery(''); return }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, options.length - 1)); return }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)); return }
    if (e.key === 'Enter' && options.length > 0) { e.preventDefault(); select(options[activeIdx]); return }
  }

  // Reset active index when options change
  useEffect(() => { setActiveIdx(0) }, [query])

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center justify-center w-5 h-5 rounded border border-gray-300 hover:border-gray-400 hover:bg-gray-50 text-gray-500 hover:text-gray-700 transition-colors"
        title="Add tag"
      >
        <Plus size={10} />
      </button>

      {open && (
        <div className="absolute left-0 top-7 z-50 w-52 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
          <div className="p-1.5 border-b border-gray-100">
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search or create tag..."
              className="w-full text-xs px-2 py-1 rounded border border-gray-200 focus:outline-none focus:border-indigo-400"
            />
          </div>
          <div className="max-h-48 overflow-y-auto py-0.5">
            {options.length === 0 && (
              <div className="px-3 py-2 text-xs text-gray-400">No tags found</div>
            )}
            {options.map((opt, i) => {
              const isCreate = opt.startsWith('__create__:')
              const tag = isCreate ? opt.slice(11) : opt
              const colorName = tagConfig[tag]?.color ?? 'teal'
              const colors = getTagColor(colorName)
              return (
                <button
                  key={opt}
                  onClick={() => select(opt)}
                  className={`w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 hover:bg-gray-50 ${
                    i === activeIdx ? 'bg-gray-50' : ''
                  }`}
                >
                  {isCreate ? (
                    <>
                      <Plus size={9} className="text-gray-400 shrink-0" />
                      <span className="text-gray-500 italic">Create "{tag}"</span>
                    </>
                  ) : (
                    <>
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: colors.dot }}
                      />
                      <span>{tag}</span>
                    </>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
