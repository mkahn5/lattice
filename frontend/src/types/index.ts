export type NodeType =
  | 'Catalog' | 'Schema' | 'Table' | 'View' | 'Model'
  | 'Volume' | 'StreamingTable' | 'MaterializedView'
  | 'Warehouse' | 'Serverless' | 'Cluster' | 'Job' | 'Dashboard' | 'Pipeline'
  | 'App' | 'Database'
  | 'ForeignCatalog' | 'Connection' | 'Share' | 'Recipient'
  | 'ServingEndpoint' | 'VectorSearchIndex' | 'GenieSpace'

export interface LatticeNode {
  id: string
  type: NodeType
  name: string
  fqn: string
  owner?: string
  comment?: string
  color: string
  icon: string
  [key: string]: unknown
}

export interface LatticeEdge {
  id: string
  source: string
  target: string
  relationship: string
  label: string
  lineage?: boolean
}

export interface GraphStats {
  node_count: number
  edge_count: number
  node_types: Record<string, number>
}

export interface GraphData {
  nodes: LatticeNode[]
  edges: LatticeEdge[]
  stats: GraphStats
}
