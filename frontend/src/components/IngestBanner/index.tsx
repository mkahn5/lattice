interface Props {
  step: string
  pct: number
  error: boolean
}

export function IngestBanner({ step, pct }: Props) {
  return (
    <div className="relative z-10 bg-indigo-950 text-white px-4 py-1.5 flex items-center gap-3 shrink-0">
      {/* Animated progress fill */}
      <div
        className="absolute inset-0 bg-indigo-700 transition-all duration-700 opacity-40"
        style={{ width: `${pct}%` }}
      />

      {/* Spinner */}
      <div className="relative shrink-0 w-3 h-3 border-2 border-indigo-400 border-t-white rounded-full animate-spin" />

      {/* Text */}
      <span className="relative text-[11px] text-indigo-200 truncate">{step}</span>

      {/* Percent */}
      <span className="relative text-[11px] text-indigo-400 font-mono ml-auto shrink-0">{pct}%</span>
    </div>
  )
}
