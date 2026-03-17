export interface TagColorDef {
  bg: string
  text: string
  dot: string
}

export const TAG_COLORS: Record<string, TagColorDef> = {
  red:    { bg: 'bg-red-100',    text: 'text-red-700',    dot: '#E24B4A' },
  coral:  { bg: 'bg-orange-100', text: 'text-orange-700', dot: '#D85A30' },
  amber:  { bg: 'bg-amber-100',  text: 'text-amber-700',  dot: '#EF9F27' },
  purple: { bg: 'bg-purple-100', text: 'text-purple-700', dot: '#7F77DD' },
  gray:   { bg: 'bg-gray-200',   text: 'text-gray-600',   dot: '#888780' },
  green:  { bg: 'bg-green-100',  text: 'text-green-700',  dot: '#639922' },
  teal:   { bg: 'bg-teal-100',   text: 'text-teal-700',   dot: '#1D9E75' },
}

export const DEFAULT_TAG_COLOR: TagColorDef = TAG_COLORS.teal

export function getTagColor(colorName: string): TagColorDef {
  return TAG_COLORS[colorName] ?? DEFAULT_TAG_COLOR
}

export function getTagDotColor(colorName: string): string {
  return (TAG_COLORS[colorName] ?? DEFAULT_TAG_COLOR).dot
}
