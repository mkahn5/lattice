import { Handle, Position } from '@xyflow/react'
import {
  Database, Folder, Table2, Eye, Cpu, Server, Settings,
  PlayCircle, BarChart2, Circle, ChevronDown, ChevronRight, ExternalLink,
  Globe, HardDrive, Link, Plug, Share2, UserCheck, Zap,
  Archive, Activity, Layers, GitBranch,
} from 'lucide-react'
import { formatDBU } from '../../utils/costColors'

const ICONS: Record<string, React.FC<{ size: number; color: string }>> = {
  database: ({ size, color }) => <Database size={size} color={color} />,
  folder: ({ size, color }) => <Folder size={size} color={color} />,
  table: ({ size, color }) => <Table2 size={size} color={color} />,
  eye: ({ size, color }) => <Eye size={size} color={color} />,
  cpu: ({ size, color }) => <Cpu size={size} color={color} />,
  server: ({ size, color }) => <Server size={size} color={color} />,
  zap: ({ size, color }) => <Zap size={size} color={color} />,
  settings: ({ size, color }) => <Settings size={size} color={color} />,
  'play-circle': ({ size, color }) => <PlayCircle size={size} color={color} />,
  'bar-chart-2': ({ size, color }) => <BarChart2 size={size} color={color} />,
  globe: ({ size, color }) => <Globe size={size} color={color} />,
  'hard-drive': ({ size, color }) => <HardDrive size={size} color={color} />,
  link: ({ size, color }) => <Link size={size} color={color} />,
  plug: ({ size, color }) => <Plug size={size} color={color} />,
  'share-2': ({ size, color }) => <Share2 size={size} color={color} />,
  'user-check': ({ size, color }) => <UserCheck size={size} color={color} />,
  circle: ({ size, color }) => <Circle size={size} color={color} />,
  archive: ({ size, color }) => <Archive size={size} color={color} />,
  activity: ({ size, color }) => <Activity size={size} color={color} />,
  layers: ({ size, color }) => <Layers size={size} color={color} />,
  'git-branch': ({ size, color }) => <GitBranch size={size} color={color} />,
}

const HEAT_COLORS: Record<string, string> = {
  hot: '#22c55e',   // green — active last 7d / healthy job
  warm: '#f59e0b',  // amber — active last 30d / degraded job
  cold: '#d1d5db',  // gray — inactive
}

const HEAT_TITLES: Record<string, string> = {
  hot: 'Active (last 7 days)',
  warm: 'Active (last 30 days)',
  cold: 'Inactive (30 days)',
}

interface NodeData {
  name: string
  type: string
  color: string
  icon: string
  owner?: string
  isCollapsed?: boolean
  tableCount?: number
  onToggleCollapse?: () => void
  consoleUrl?: string | null
  heat?: string
  dbu_30d?: number
  query_count_30d?: number
  success_rate_pct?: number
  dimmed?: boolean
  stub?: boolean
  comment?: string
  connection_type?: string
  costOverlayEnabled?: boolean
  costBgColor?: string | null
  costScale?: number
  costTotalDbu?: number
  highlighted?: boolean
  annotationDotColor?: string | null
}

export function LatticeNode({ data, selected }: { data: NodeData; selected: boolean }) {
  const IconComp = ICONS[data.icon] ?? ICONS['circle']
  const isSchema = data.type === 'Schema'

  const heatColor = data.heat ? HEAT_COLORS[data.heat] : null
  const heatTitle = data.heat ? HEAT_TITLES[data.heat] : null

  // Compact metric label (shown inline on node)
  let metricLabel: string | null = null
  if (data.type === 'Job' && data.success_rate_pct != null) {
    metricLabel = `${data.success_rate_pct}%`
  } else if ((data.type === 'Warehouse' || data.type === 'Serverless' || data.type === 'Cluster' || data.type === 'Job') && data.dbu_30d != null) {
    metricLabel = `${data.dbu_30d} DBU`
  } else if ((data.type === 'Table' || data.type === 'View') && data.query_count_30d != null) {
    metricLabel = `${data.query_count_30d}q`
  }

  const costBg = data.costOverlayEnabled && data.costBgColor ? data.costBgColor : undefined

  return (
    <div
      className={`relative group px-3 py-2 rounded-lg border-2 shadow-sm min-w-[150px] max-w-[210px] cursor-pointer ${
        selected ? 'ring-2 ring-offset-1 ring-indigo-400' : ''
      }`}
      style={{
        borderColor: data.highlighted ? '#f59e0b' : costBg ?? data.color,
        backgroundColor: costBg ?? 'white',
        borderStyle: data.stub ? 'dashed' : 'solid',
        boxShadow: data.highlighted
          ? '0 0 0 3px #f59e0b80, 0 0 12px #f59e0b40'
          : selected ? `0 0 0 2px ${data.color}30` : undefined,
        opacity: data.dimmed ? (data.costOverlayEnabled ? 0.35 : 0.2) : data.stub ? 0.55 : 1,
        transform: data.costScale && data.costScale !== 1.0 ? `scale(${data.costScale})` : undefined,
        transition: 'transform 0.3s ease, background-color 0.3s ease, border-color 0.3s ease, opacity 0.3s ease, box-shadow 0.2s ease',
        transformOrigin: 'center center',
      }}
      title={data.stub ? `External table: ${data.comment ?? ''}` : undefined}
    >
      <Handle type="target" position={Position.Top} className="!bg-gray-300 !w-2 !h-2" />

      {data.consoleUrl && (
        <a
          href={data.consoleUrl}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600"
          title="Open in Databricks"
        >
          <ExternalLink size={10} />
        </a>
      )}

      {/* Annotation dot — top-right, indicates tags or note present */}
      {data.annotationDotColor && (
        <div
          className="absolute top-1 right-1.5 w-1.5 h-1.5 rounded-full"
          style={{ background: data.annotationDotColor }}
          title="Has annotations (tags or note)"
        />
      )}

      {/* Heat dot — bottom-right, hidden when external link is visible on hover */}
      {heatColor && (
        <div
          className={`absolute bottom-1.5 right-1.5 w-2 h-2 rounded-full transition-opacity ${data.consoleUrl ? 'group-hover:opacity-0' : ''}`}
          style={{ background: heatColor }}
          title={heatTitle ?? ''}
        />
      )}

      <div className="flex items-center gap-2">
        <IconComp size={14} color={data.color} />
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold truncate leading-tight" title={data.name}>
            {data.name}
          </div>
          <div className="text-[10px] text-gray-400">
            {data.type}{data.connection_type ? ` · ${data.connection_type}` : ''}
          </div>
        </div>
        {isSchema && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              data.onToggleCollapse?.()
            }}
            className="shrink-0 p-0.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
            title={data.isCollapsed ? 'Expand tables' : 'Collapse tables'}
          >
            {data.isCollapsed
              ? <ChevronRight size={12} />
              : <ChevronDown size={12} />
            }
          </button>
        )}
      </div>

      {isSchema && data.isCollapsed && data.tableCount != null && data.tableCount > 0 && (
        <div className="text-[9px] text-gray-400 mt-1 pl-5">
          {data.tableCount} table{data.tableCount !== 1 ? 's' : ''} hidden
        </div>
      )}

      {data.owner && !(isSchema && data.isCollapsed) && (
        <div className="text-[9px] text-gray-400 mt-1 truncate pl-5" title={data.owner}>
          {data.owner}
        </div>
      )}

      {metricLabel && (
        <div className="text-[9px] text-gray-400 mt-0.5 pl-5 font-mono">
          {metricLabel}
        </div>
      )}

      {/* Cost badge — bottom-left, only when cost overlay is on */}
      {data.costOverlayEnabled && data.costTotalDbu != null && data.costTotalDbu > 0 && (
        <div className="absolute bottom-1 left-1.5 text-[8px] font-mono bg-black/60 text-white rounded px-1 leading-tight">
          {formatDBU(data.costTotalDbu)}
        </div>
      )}

      <Handle type="source" position={Position.Bottom} className="!bg-gray-300 !w-2 !h-2" />
    </div>
  )
}

export const nodeTypes = { latticeNode: LatticeNode }
