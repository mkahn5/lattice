import { useEffect, useRef } from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import { useGraphStore } from './stores/graphStore'
import { Sidebar } from './components/Sidebar'
import { Canvas } from './components/Canvas'
import { DetailPanel } from './components/DetailPanel'
import { MultiSelectPanel } from './components/DetailPanel/MultiSelectPanel'
import { FirstRunWizard } from './components/FirstRunWizard'
import { SettingsPanel } from './components/SettingsPanel'

interface Progress {
  step: string
  pct: number
  done: boolean
  error: boolean
  graph_ready: boolean
}

export default function App() {
  const { loadGraph, loadInfo, fetchAnnotations, fetchConfig, selectedNodeIds, showWizard, showSettings } = useGraphStore()
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const graphLoadedRef = useRef(false)
  const prevGraphReadyRef = useRef(false)

  useEffect(() => {
    loadInfo()
    loadGraph()
    fetchAnnotations()
    fetchConfig()

    const poll = async () => {
      try {
        const res = await fetch('/api/progress')
        const data: Progress = await res.json()

        // Detect workspace switch: graph_ready went from true → false
        if (!data.graph_ready && prevGraphReadyRef.current) {
          graphLoadedRef.current = false
        }
        prevGraphReadyRef.current = data.graph_ready

        if (data.graph_ready && !graphLoadedRef.current) {
          graphLoadedRef.current = true
          loadGraph()
          loadInfo()
        }

        if (data.done && !data.error) {
          // Final reload with complete graph
          loadGraph()
          loadInfo()
          fetchAnnotations()
        }

        // Always keep polling (workspace switch resets progress)
        pollRef.current = setTimeout(poll, data.done ? 5000 : 1500)
      } catch {
        pollRef.current = setTimeout(poll, 3000)
      }
    }
    poll()

    return () => { if (pollRef.current) clearTimeout(pollRef.current) }
  }, [])

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-gray-50 font-sans">
      <Sidebar />
      <ReactFlowProvider>
        <Canvas />
      </ReactFlowProvider>
      {selectedNodeIds.size > 1 ? <MultiSelectPanel /> : <DetailPanel />}
      {showWizard && <FirstRunWizard />}
      {showSettings && <SettingsPanel />}
    </div>
  )
}
