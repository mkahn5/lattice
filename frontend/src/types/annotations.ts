export interface Annotation {
  tags: string[]
  note: string
  created: string
  updated: string
}

export interface TagConfig {
  color: string    // maps to TAG_COLORS key
  priority: number
}

export interface AnnotationsApiResponse {
  available: boolean
  error?: string
  annotations: Record<string, Annotation>
  all_tags: string[]
  tag_config: Record<string, TagConfig>
}
