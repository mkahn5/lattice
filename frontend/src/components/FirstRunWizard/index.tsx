import { useEffect, useRef, useState } from 'react'
import { useGraphStore, type PreflightCheck } from '../../stores/graphStore'
import { CheckCircle, XCircle, Loader, Copy, Check, ExternalLink } from 'lucide-react'

function useVersionInfo() {
  const [info, setInfo] = useState<{ current: string; latest: string | null; update_available: boolean } | null>(null)
  useEffect(() => {
    fetch('/api/version').then(r => r.json()).then(setInfo).catch(() => {})
  }, [])
  return info
}

const STEPS = ['Welcome', 'Catalog scope', 'System access']

// Catalog scope presets
const PRESETS = [
  { key: 'small',  label: 'Small',  schema_limit: 10,  table_limit: 20,  desc: '10 schemas / 20 tables' },
  { key: 'medium', label: 'Medium', schema_limit: 20,  table_limit: 50,  desc: '20 schemas / 50 tables' },
  { key: 'large',  label: 'Large',  schema_limit: 50,  table_limit: 200, desc: '50 schemas / 200 tables' },
  { key: 'all',    label: 'All',    schema_limit: 0,   table_limit: 0,   desc: 'No limits (may be slow)' },
]

function StepDots({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-2 mb-6">
      {STEPS.map((label, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${
            i < current ? 'bg-indigo-500 text-white' :
            i === current ? 'bg-indigo-600 text-white ring-2 ring-indigo-200' :
            'bg-gray-200 text-gray-400'
          }`}>
            {i < current ? '✓' : i + 1}
          </div>
          <span className={`text-[11px] ${i === current ? 'text-gray-700 font-medium' : 'text-gray-400'}`}>
            {label}
          </span>
          {i < STEPS.length - 1 && <div className="w-8 h-px bg-gray-200 mx-1" />}
        </div>
      ))}
    </div>
  )
}

function CheckRow({ check, workspaceHost }: { check: PreflightCheck; workspaceHost?: string }) {
  const isFailed = check.ok === false
  const isPending = check.ok === null
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    if (check.fix_sql) {
      navigator.clipboard.writeText(check.fix_sql)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    }
  }

  return (
    <div className={`rounded-lg border ${
      check.ok ? 'border-green-100 bg-green-50/50' :
      isPending ? 'border-gray-100 bg-gray-50' :
      'border-red-200 bg-red-50/40'
    }`}>
      {/* Header */}
      <div className="flex items-start gap-2.5 px-3 py-2.5">
        <div className="mt-0.5 flex-shrink-0">
          {isPending
            ? <Loader size={13} className="text-gray-400 animate-spin" />
            : check.ok
              ? <CheckCircle size={13} className="text-green-500" />
              : <XCircle size={13} className="text-red-400" />
          }
        </div>
        <div className="flex-1 min-w-0">
          <span className={`text-[11px] font-semibold ${check.ok ? 'text-gray-700' : isPending ? 'text-gray-400' : 'text-red-700'}`}>
            {check.name}
          </span>
          <div className="text-[10px] text-gray-500 mt-0.5 leading-relaxed">
            {check.ok ? check.description : isPending ? 'Checking…' : (check.error || check.description)}
          </div>
          {isFailed && (
            <div className="text-[10px] text-amber-700 mt-0.5 font-medium">
              Affects: {check.enabled_feature}
            </div>
          )}
        </div>
      </div>

      {/* Fix section — always visible for failed checks */}
      {isFailed && check.fix_sql && (
        <div className="border-t border-red-100 px-3 py-3 bg-white/70">
          <div className="text-[10px] font-semibold text-gray-600 mb-2 uppercase tracking-wide">How to fix</div>
          {check.key === 'warehouse' ? (
            <div className="space-y-2 mb-3 text-[10px] text-gray-600">
              <div className="flex items-start gap-2">
                <span className="w-4 h-4 rounded-full bg-indigo-100 text-indigo-700 font-bold flex-shrink-0 flex items-center justify-center text-[8px]">1</span>
                <span>Copy the <code className="font-mono bg-gray-100 px-0.5 rounded">app.yaml</code> snippet below</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="w-4 h-4 rounded-full bg-indigo-100 text-indigo-700 font-bold flex-shrink-0 flex items-center justify-center text-[8px]">2</span>
                <span>Add to your <code className="font-mono bg-gray-100 px-0.5 rounded">app.yaml</code> and redeploy</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="w-4 h-4 rounded-full bg-indigo-100 text-indigo-700 font-bold flex-shrink-0 flex items-center justify-center text-[8px]">3</span>
                <span>For local dev: <code className="font-mono bg-gray-100 px-0.5 rounded">export DATABRICKS_WAREHOUSE_ID=&lt;id&gt;</code></span>
              </div>
            </div>
          ) : (
            <div className="space-y-2 mb-3 text-[10px] text-gray-600">
              <div className="flex items-start gap-2">
                <span className="w-4 h-4 rounded-full bg-indigo-100 text-indigo-700 font-bold flex-shrink-0 flex items-center justify-center text-[8px]">1</span>
                <span>Copy the SQL grant below</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="w-4 h-4 rounded-full bg-indigo-100 text-indigo-700 font-bold flex-shrink-0 flex items-center justify-center text-[8px]">2</span>
                <span>
                  {workspaceHost
                    ? <><a href={`${workspaceHost.replace(/\/$/, '')}/sql/editor`} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline font-semibold inline-flex items-center gap-0.5">Open SQL Editor <ExternalLink size={9} /></a> — run as a <strong>workspace admin</strong></>
                    : <>Open SQL Editor in your workspace — run as a <strong>workspace admin</strong></>
                  }
                </span>
              </div>
              <div className="flex items-start gap-2">
                <span className="w-4 h-4 rounded-full bg-indigo-100 text-indigo-700 font-bold flex-shrink-0 flex items-center justify-center text-[8px]">3</span>
                <span>The check updates automatically when access is granted</span>
              </div>
            </div>
          )}
          <div className="relative">
            <pre className="text-[9px] font-mono bg-gray-900 text-green-300 rounded p-2.5 overflow-auto whitespace-pre-wrap leading-relaxed">
              {check.fix_sql}
            </pre>
            <button
              onClick={handleCopy}
              className={`absolute top-2 right-2 flex items-center gap-1 text-[9px] px-2 py-1 rounded transition-all font-medium ${
                copied ? 'bg-green-600 text-white' : 'bg-gray-600 hover:bg-gray-500 text-gray-200'
              }`}
            >
              {copied ? <><Check size={9} /> Copied!</> : <><Copy size={9} /> Copy SQL</>}
            </button>
          </div>
          {check.docs_url && (
            <a href={check.docs_url} target="_blank" rel="noopener noreferrer"
              className="mt-2 flex items-center gap-1 text-[9px] text-indigo-500 hover:text-indigo-700">
              <ExternalLink size={8} /> View permission docs
            </a>
          )}
        </div>
      )}
    </div>
  )
}

export function FirstRunWizard() {
  const { appStatus, workspaceInfo, saveConfig, fetchStatus, setShowWizard } = useGraphStore()
  const versionInfo = useVersionInfo()
  const [step, setStep] = useState(0)
  const [selectedCatalogs, setSelectedCatalogs] = useState<string[]>([])
  const [allCatalogs, setAllCatalogs] = useState<{ name: string; type: string }[]>([])
  const [catalogsLoading, setCatalogsLoading] = useState(false)
  const [preset, setPreset] = useState('medium')
  const [saving, setSaving] = useState(false)
  const statusPolledRef = useRef(false)

  // Fetch available catalogs for step 2
  useEffect(() => {
    if (step === 1 && allCatalogs.length === 0) {
      setCatalogsLoading(true)
      fetch('/api/catalogs?limit=50')
        .then(r => r.json())
        .then(d => setAllCatalogs(d.catalogs ?? []))
        .catch(() => {})
        .finally(() => setCatalogsLoading(false))
    }
  }, [step])

  // Kick off pre-flight status fetch as soon as wizard opens (so it's ready by step 3)
  useEffect(() => {
    if (!statusPolledRef.current) {
      statusPolledRef.current = true
      fetchStatus()
    }
  }, [])

  // Poll status every 2s while checks are still running
  useEffect(() => {
    if (step < 2) return
    if (appStatus?.ready) return
    const t = setTimeout(() => fetchStatus(), 2000)
    return () => clearTimeout(t)
  }, [step, appStatus])

  const toggleCatalog = (name: string) => {
    setSelectedCatalogs(prev =>
      prev.includes(name) ? prev.filter(c => c !== name) : [...prev, name]
    )
  }

  const markWizardComplete = () => {
    fetch('/api/config/wizard-complete', { method: 'POST' }).catch(() => {})
  }

  const handleFinish = async () => {
    setSaving(true)
    const p = PRESETS.find(p => p.key === preset) ?? PRESETS[1]
    await saveConfig({
      catalogs: selectedCatalogs,
      schema_limit: p.schema_limit || undefined,
      table_limit: p.table_limit || undefined,
    })
    markWizardComplete()
    setSaving(false)
    setShowWizard(false)
  }

  const handleSkip = () => {
    markWizardComplete()
    setShowWizard(false)
  }

  const allChecksOk = appStatus?.ready && appStatus.checks.every(c => c.ok !== false)
  const criticalFailed = appStatus?.ready && appStatus.checks.find(c => c.key === 'workspace' && !c.ok)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-[520px] max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-7 pt-7 pb-4 border-b border-gray-100">
          <StepDots current={step} />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-7 py-5">

          {/* ── Step 0: Welcome ── */}
          {step === 0 && (
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className="text-3xl">🔷</div>
                {versionInfo && (
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-gray-400 bg-gray-100 px-2 py-0.5 rounded">v{versionInfo.current}</span>
                    {versionInfo.update_available && versionInfo.latest && (
                      <span className="text-[10px] text-amber-600 bg-amber-50 px-2 py-0.5 rounded font-medium">
                        v{versionInfo.latest} available
                      </span>
                    )}
                  </div>
                )}
              </div>
              <h2 className="text-lg font-bold text-gray-900 mb-1">Welcome to Lattice</h2>
              <p className="text-sm text-gray-500 mb-5 leading-relaxed">
                Lattice maps your entire Databricks workspace into an interactive knowledge graph — so you can explore data assets, compute, lineage, and cost in one place.
              </p>
              <div className="space-y-2.5">
                {[
                  { icon: '🗂️', label: 'Unity Catalog', desc: 'Browse catalogs, schemas, tables, views, and models' },
                  { icon: '⚙️', label: 'Compute & Jobs', desc: 'Warehouses, clusters, jobs, dashboards, and apps' },
                  { icon: '🔗', label: 'Lineage', desc: 'See how data flows between tables and jobs' },
                  { icon: '💰', label: 'Cost attribution', desc: 'DBU spend attributed to assets (requires SQL warehouse)' },
                  { icon: '📊', label: 'Usage patterns', desc: 'Heat dots show hot/warm/cold assets at a glance' },
                ].map(f => (
                  <div key={f.label} className="flex items-start gap-3 text-sm">
                    <span className="text-lg leading-none mt-0.5">{f.icon}</span>
                    <div>
                      <span className="font-medium text-gray-700">{f.label}</span>
                      <span className="text-gray-400"> — {f.desc}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-5 p-3 bg-indigo-50 rounded-lg text-[11px] text-indigo-700 leading-relaxed">
                This setup takes about 60–90 seconds. You can skip it and configure everything later in <strong>Settings</strong>.
              </div>
            </div>
          )}

          {/* ── Step 1: Catalog scope ── */}
          {step === 1 && (
            <div>
              <h2 className="text-base font-bold text-gray-900 mb-1">Catalog scope</h2>
              <p className="text-sm text-gray-500 mb-4 leading-relaxed">
                Select which catalogs to visualize. Leave all unchecked to use up to 20 catalogs automatically.
              </p>

              {catalogsLoading ? (
                <div className="text-[12px] text-gray-400 py-4 flex items-center gap-2">
                  <Loader size={13} className="animate-spin" /> Loading catalogs…
                </div>
              ) : (
                <div className="max-h-44 overflow-y-auto border border-gray-100 rounded-lg divide-y divide-gray-50 mb-5">
                  {allCatalogs.map(c => (
                    <label key={c.name} className="flex items-center gap-2.5 px-3 py-2 hover:bg-indigo-50/50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedCatalogs.includes(c.name)}
                        onChange={() => toggleCatalog(c.name)}
                        className="accent-indigo-600"
                      />
                      <span className="text-sm text-gray-700 font-medium">{c.name}</span>
                      {c.type && c.type !== 'MANAGED_CATALOG' && (
                        <span className="text-[10px] text-gray-400 font-mono">{c.type}</span>
                      )}
                    </label>
                  ))}
                  {allCatalogs.length === 0 && (
                    <div className="px-3 py-4 text-[12px] text-gray-400">
                      No catalogs found. They will be discovered during ingestion.
                    </div>
                  )}
                </div>
              )}

              {selectedCatalogs.length > 0 && (
                <p className="text-[11px] text-indigo-600 mb-4">
                  {selectedCatalogs.length} catalog{selectedCatalogs.length > 1 ? 's' : ''} selected: {selectedCatalogs.join(', ')}
                </p>
              )}
              {selectedCatalogs.length === 0 && (
                <p className="text-[11px] text-gray-400 mb-4">All catalogs will be used (up to 20)</p>
              )}

              <div className="border-t border-gray-100 pt-4">
                <div className="text-[11px] font-semibold text-gray-600 mb-2">Scale preset</div>
                <div className="grid grid-cols-4 gap-2">
                  {PRESETS.map(p => (
                    <button
                      key={p.key}
                      onClick={() => setPreset(p.key)}
                      className={`rounded-lg border px-2 py-2 text-center transition-all ${
                        preset === p.key
                          ? 'border-indigo-400 bg-indigo-50 text-indigo-700'
                          : 'border-gray-200 text-gray-500 hover:border-indigo-200'
                      }`}
                    >
                      <div className="text-[11px] font-semibold">{p.label}</div>
                      <div className="text-[9px] text-gray-400 mt-0.5 leading-tight">{p.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Step 2: System access ── */}
          {step === 2 && (
            <div>
              <h2 className="text-base font-bold text-gray-900 mb-1">System access</h2>
              <p className="text-sm text-gray-500 mb-4 leading-relaxed">
                Checking what Lattice can access in your workspace. Missing permissions reduce functionality but won't block you from using the app.
              </p>

              {!appStatus?.ready ? (
                <div className="space-y-2 mb-4">
                  {[1, 2, 3, 4, 5, 6].map(i => (
                    <div key={i} className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2.5 flex items-center gap-2.5">
                      <Loader size={13} className="text-gray-300 animate-spin" />
                      <div className="h-2.5 bg-gray-200 rounded w-48 animate-pulse" />
                    </div>
                  ))}
                  <p className="text-[11px] text-gray-400 text-center mt-3">Running pre-flight checks…</p>
                </div>
              ) : (
                <div className="space-y-2 mb-4">
                  {appStatus.checks.map(c => <CheckRow key={c.key} check={c} workspaceHost={workspaceInfo?.host} />)}
                </div>
              )}

              {appStatus?.ready && !criticalFailed && (
                <div className="p-3 bg-gray-50 rounded-lg text-[11px] text-gray-500 leading-relaxed">
                  {allChecksOk
                    ? '✅ All checks passed — Lattice has full access to your workspace.'
                    : '⚠️ Some features require additional grants. You can fix these now or later in Settings → System access.'
                  }
                </div>
              )}
              {appStatus?.ready && criticalFailed && (
                <div className="p-3 bg-red-50 rounded-lg text-[11px] text-red-700 leading-relaxed">
                  ⚠️ Workspace connection failed. Check your credentials and try refreshing.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-7 py-4 border-t border-gray-100 flex items-center justify-between">
          <button
            onClick={handleSkip}
            className="text-[11px] text-gray-400 hover:text-gray-600 transition-colors"
          >
            Skip setup
          </button>
          <div className="flex items-center gap-2">
            {step > 0 && (
              <button
                onClick={() => setStep(s => s - 1)}
                className="px-3 py-1.5 text-[11px] font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-all"
              >
                ← Back
              </button>
            )}
            {step < STEPS.length - 1 ? (
              <button
                onClick={() => setStep(s => s + 1)}
                className="px-4 py-1.5 text-[11px] font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all"
              >
                Next →
              </button>
            ) : (
              <button
                onClick={handleFinish}
                disabled={saving || (!appStatus?.ready && step === 2)}
                className="px-4 py-1.5 text-[11px] font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-1.5"
              >
                {saving && <Loader size={11} className="animate-spin" />}
                {saving ? 'Saving…' : 'Start Lattice →'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
