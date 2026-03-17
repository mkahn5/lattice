import { Component, type ReactNode } from 'react'

interface Props { children: ReactNode }
interface State { error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error('[lattice] React render error:', error, info.componentStack)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <div className="flex flex-col items-center justify-center h-screen w-screen bg-gray-50 p-8">
        <div className="max-w-2xl w-full bg-white rounded-xl border border-red-200 shadow-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-red-500 text-lg">⚠</span>
            <h2 className="text-sm font-semibold text-red-700">Lattice encountered an error</h2>
          </div>
          <p className="text-xs text-gray-600 mb-3">{error.message}</p>
          <pre className="text-[10px] text-gray-500 bg-gray-50 rounded p-3 overflow-auto max-h-48 mb-4 font-mono whitespace-pre-wrap">
            {error.stack}
          </pre>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 text-xs font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Reload app
          </button>
        </div>
      </div>
    )
  }
}
