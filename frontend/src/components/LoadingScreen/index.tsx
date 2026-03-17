import { useEffect, useRef, useState } from 'react'

interface Props {
  step: string
  pct: number
  error: boolean
}

function formatEta(seconds: number): string {
  if (seconds < 5) return 'almost done'
  if (seconds < 60) return `~${Math.ceil(seconds)}s remaining`
  return `~${Math.ceil(seconds / 60)}m remaining`
}

export function LoadingScreen({ step, pct, error }: Props) {
  const startRef = useRef<number | null>(null)
  const [eta, setEta] = useState<string | null>(null)

  useEffect(() => {
    if (pct > 0 && pct < 100) {
      if (!startRef.current) startRef.current = Date.now()
      const elapsed = (Date.now() - startRef.current) / 1000
      const rate = pct / elapsed // % per second
      if (rate > 0 && elapsed > 2) {
        const remaining = (100 - pct) / rate
        setEta(formatEta(remaining))
      }
    } else if (pct === 100) {
      setEta(null)
    }
  }, [pct])

  return (
    <div className="flex-1 flex items-center justify-center bg-gray-50">
      <div className="w-96 text-center">
        <div className="text-5xl mb-5">🔷</div>
        <div className="text-xl font-bold text-gray-800 mb-1 tracking-tight">Lattice</div>
        <div className="text-sm text-gray-400 mb-2">Building your workspace graph...</div>

        {eta && (
          <div className="text-xs text-indigo-400 mb-5 font-mono">{eta}</div>
        )}
        {!eta && <div className="mb-5" />}

        <div className="bg-gray-200 rounded-full h-1.5 mb-3 overflow-hidden">
          <div
            className={`h-1.5 rounded-full transition-all duration-700 ${error ? 'bg-red-400' : 'bg-indigo-500'}`}
            style={{ width: `${pct}%` }}
          />
        </div>

        <div className={`text-xs ${error ? 'text-red-500' : 'text-gray-400'}`}>
          {step}
        </div>

        {!error && pct < 100 && (
          <div className="mt-6 flex justify-center gap-1">
            {[0, 150, 300].map((delay) => (
              <div
                key={delay}
                className="w-1.5 h-1.5 bg-indigo-300 rounded-full animate-bounce"
                style={{ animationDelay: `${delay}ms` }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
