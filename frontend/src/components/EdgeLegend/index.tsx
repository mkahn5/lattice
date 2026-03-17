import { useState } from 'react'

interface LegendEntry {
  label: string
  color: string
  dashed?: boolean
  description: string
}

const EDGES: LegendEntry[] = [
  { label: 'contains',   color: '#d1d5db', description: 'Catalog→Schema, Schema→Table/View/Model' },
  { label: 'runsOn',     color: '#f97316', description: 'Dashboard/App→Warehouse' },
  { label: 'triggers',   color: '#f97316', description: 'App→Job' },
  { label: 'queries',    color: '#8b5cf6', description: 'Dashboard→Table/View' },
  { label: 'uses',       color: '#8b5cf6', description: 'App→Database, App→Catalog' },
  { label: 'exposes',    color: '#14b8a6', description: 'Connection→ForeignCatalog, Database→Catalog, Share→Table' },
  { label: 'feedsInto',  color: '#3b82f6', dashed: true, description: 'Table→Table lineage' },
  { label: 'writesTo',   color: '#3b82f6', dashed: true, description: 'Job→Table lineage' },
  { label: 'readsFrom',  color: '#3b82f6', dashed: true, description: 'Table→Job lineage' },
]

export function EdgeLegend() {
  const [open, setOpen] = useState(false)

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm text-xs select-none">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 px-3 py-1.5 text-gray-500 hover:text-gray-800 font-medium w-full"
      >
        <span>Edge Types</span>
        <span className="ml-auto">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="px-3 pb-2 flex flex-col gap-1.5 border-t border-gray-100 pt-2">
          {EDGES.map(({ label, color, dashed, description }) => (
            <div key={label} className="flex items-center gap-2" title={description}>
              {/* Line sample */}
              <svg width="28" height="10" className="shrink-0">
                <line
                  x1="2" y1="5" x2="26" y2="5"
                  stroke={color}
                  strokeWidth="2"
                  strokeDasharray={dashed ? '4 2' : undefined}
                />
                <polygon points="22,2 26,5 22,8" fill={color} />
              </svg>
              <span className="font-mono text-[10px] text-gray-700 w-20 shrink-0">{label}</span>
              <span className="text-[10px] text-gray-400 leading-tight">{description}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
