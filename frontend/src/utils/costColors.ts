const COST_RAMP: Array<{ threshold: number; color: string | null }> = [
  { threshold: 0,    color: null },
  { threshold: 0.01, color: '#FEF3E2' },
  { threshold: 0.26, color: '#FDDCAB' },
  { threshold: 0.51, color: '#F9B86C' },
  { threshold: 0.76, color: '#E8863A' },
  { threshold: 0.91, color: '#D05538' },
]

export function getCostBgColor(rankPct: number): string | null {
  if (rankPct <= 0) return null
  let color: string | null = null
  for (const step of COST_RAMP) {
    if (rankPct >= step.threshold) color = step.color
  }
  return color
}

export function getCostScale(rankPct: number): number {
  return 1.0 + rankPct * 0.4
}

export function formatDBU(dbu: number): string {
  if (dbu >= 1000) return `${(dbu / 1000).toFixed(1)}k DBU`
  if (dbu >= 10) return `${Math.round(dbu)} DBU`
  return `${dbu.toFixed(1)} DBU`
}
