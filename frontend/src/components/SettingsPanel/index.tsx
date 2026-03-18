import { useEffect, useRef, useState } from 'react'
import { useGraphStore, type PreflightCheck } from '../../stores/graphStore'
import { CheckCircle, XCircle, Loader, RefreshCw, ChevronDown, ChevronUp, X, Copy, Check, ExternalLink } from 'lucide-react'
// ChevronDown/ChevronUp used in collapsible scope/status sections

const PRESETS = [
  { key: 'small',  label: 'S',  schema_limit: 10,  table_limit: 20 },
  { key: 'medium', label: 'M',  schema_limit: 20,  table_limit: 50 },
  { key: 'large',  label: 'L',  schema_limit: 50,  table_limit: 200 },
  { key: 'custom', label: '…',  schema_limit: 0,   table_limit: 0 },
]

function StatusDot({ ok }: { ok: boolean | null }) {
  if (ok === null) return <Loader size={11} className="text-gray-400 animate-spin flex-shrink-0" />
  if (ok) return <CheckCircle size={11} className="text-green-500 flex-shrink-0" />
  return <XCircle size={11} className="text-red-400 flex-shrink-0" />
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
      check.ok ? 'border-green-100 bg-green-50/40' :
      isPending ? 'border-gray-100 bg-gray-50' :
      'border-red-200 bg-red-50/40'
    }`}>
      {/* Header row */}
      <div className="flex items-start gap-2 px-3 py-2">
        <div className="mt-0.5 flex-shrink-0"><StatusDot ok={check.ok} /></div>
        <div className="flex-1 min-w-0">
          <span className={`text-[10px] font-semibold ${check.ok ? 'text-gray-700' : isPending ? 'text-gray-400' : 'text-red-700'}`}>
            {check.name}
          </span>
          <div className="text-[9px] text-gray-500 mt-0.5 leading-relaxed">
            {check.ok ? check.description : isPending ? 'Checking…' : (check.error ?? check.description)}
          </div>
          {isFailed && (
            <div className="text-[9px] text-amber-600 mt-0.5 font-medium">
              Affects: {check.enabled_feature}
            </div>
          )}
        </div>
      </div>

      {/* Fix section — always visible for failed checks with fix_sql */}
      {isFailed && check.fix_sql && (
        <div className="border-t border-red-100 px-3 py-2.5 bg-white/60">
          <div className="text-[9px] font-semibold text-gray-600 mb-2 uppercase tracking-wide">How to fix</div>
          {check.key === 'warehouse' ? (
            <div className="space-y-1.5 mb-2 text-[9px] text-gray-600">
              <div className="flex items-start gap-2">
                <span className="w-4 h-4 rounded-full bg-indigo-100 text-indigo-700 font-bold flex-shrink-0 flex items-center justify-center text-[8px]">1</span>
                <span>Copy the <code className="font-mono bg-gray-100 px-0.5 rounded">app.yaml</code> snippet below</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="w-4 h-4 rounded-full bg-indigo-100 text-indigo-700 font-bold flex-shrink-0 flex items-center justify-center text-[8px]">2</span>
                <span>Add to your <code className="font-mono bg-gray-100 px-0.5 rounded">app.yaml</code> and redeploy the app</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="w-4 h-4 rounded-full bg-indigo-100 text-indigo-700 font-bold flex-shrink-0 flex items-center justify-center text-[8px]">3</span>
                <span>For local dev: <code className="font-mono bg-gray-100 px-0.5 rounded">export DATABRICKS_WAREHOUSE_ID=&lt;id&gt;</code></span>
              </div>
            </div>
          ) : (
            <div className="space-y-1.5 mb-2 text-[9px] text-gray-600">
              <div className="flex items-start gap-2">
                <span className="w-4 h-4 rounded-full bg-indigo-100 text-indigo-700 font-bold flex-shrink-0 flex items-center justify-center text-[8px]">1</span>
                <span>Copy the SQL grant below</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="w-4 h-4 rounded-full bg-indigo-100 text-indigo-700 font-bold flex-shrink-0 flex items-center justify-center text-[8px]">2</span>
                <span>
                  {workspaceHost
                    ? <><a href={`${workspaceHost.replace(/\/$/, '')}/sql/editor`} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline font-medium inline-flex items-center gap-0.5">Open SQL Editor <ExternalLink size={7} /></a> and run as a <strong>workspace admin</strong></>
                    : <>Open SQL Editor and run as a <strong>workspace admin</strong></>
                  }
                </span>
              </div>
              <div className="flex items-start gap-2">
                <span className="w-4 h-4 rounded-full bg-indigo-100 text-indigo-700 font-bold flex-shrink-0 flex items-center justify-center text-[8px]">3</span>
                <span>Click <strong>Re-check</strong> to verify</span>
              </div>
            </div>
          )}
          <div className="relative">
            <pre className="text-[8px] font-mono bg-gray-900 text-green-300 rounded p-2 overflow-auto whitespace-pre-wrap leading-relaxed">
              {check.fix_sql}
            </pre>
            <button
              onClick={handleCopy}
              className={`absolute top-1.5 right-1.5 flex items-center gap-1 text-[8px] px-2 py-1 rounded transition-all font-medium ${
                copied ? 'bg-green-600 text-white' : 'bg-gray-600 hover:bg-gray-500 text-gray-200'
              }`}
            >
              {copied ? <><Check size={8} /> Copied!</> : <><Copy size={8} /> Copy</>}
            </button>
          </div>
          {check.docs_url && (
            <a href={check.docs_url} target="_blank" rel="noopener noreferrer"
              className="mt-1.5 flex items-center gap-1 text-[9px] text-indigo-500 hover:text-indigo-700">
              <ExternalLink size={8} /> View docs
            </a>
          )}
        </div>
      )}
    </div>
  )
}

function useVersionInfo() {
  const [info, setInfo] = useState<{ current: string; latest: string | null; update_available: boolean } | null>(null)
  useEffect(() => {
    fetch('/api/version').then(r => r.json()).then(setInfo).catch(() => {})
  }, [])
  return info
}

export function SettingsPanel() {
  const { appConfig, appStatus, workspaceInfo, saveConfig, fetchConfig, fetchStatus, setShowSettings, setShowWizard } = useGraphStore()
  const versionInfo = useVersionInfo()

  const [catalogs, setCatalogs] = useState<string[]>([])
  const [allCatalogs, setAllCatalogs] = useState<{ name: string }[]>([])
  const [catalogsLoading, setCatalogsLoading] = useState(false)
  const [schemaLimit, setSchemaLimit] = useState(20)
  const [tableLimit, setTableLimit] = useState(50)
  const [warehouseId, setWarehouseId] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [statusSection, setStatusSection] = useState(true)
  const [scopeSection, setScopeSection] = useState(true)
  const loadedRef = useRef(false)

  useEffect(() => {
    if (!loadedRef.current) {
      loadedRef.current = true
      fetchConfig()
      fetchStatus()
    }
  }, [])

  useEffect(() => {
    if (appConfig) {
      setCatalogs(appConfig.catalogs ?? [])
      setSchemaLimit(appConfig.schema_limit ?? 20)
      setTableLimit(appConfig.table_limit ?? 50)
      setWarehouseId(appConfig.warehouse_id ?? '')
    }
  }, [appConfig])

  useEffect(() => {
    setCatalogsLoading(true)
    fetch('/api/catalogs?limit=100')
      .then(r => r.json())
      .then(d => setAllCatalogs(d.catalogs ?? []))
      .catch(() => {})
      .finally(() => setCatalogsLoading(false))
  }, [])

  const toggleCatalog = (name: string) =>
    setCatalogs(prev => prev.includes(name) ? prev.filter(c => c !== name) : [...prev, name])

  const getPreset = () => {
    const p = PRESETS.find(p => p.schema_limit === schemaLimit && p.table_limit === tableLimit && p.key !== 'custom')
    return p?.key ?? 'custom'
  }

  const applyPreset = (key: string) => {
    const p = PRESETS.find(p => p.key === key)
    if (p && p.key !== 'custom') { setSchemaLimit(p.schema_limit); setTableLimit(p.table_limit) }
  }

  const handleSave = async () => {
    setSaving(true)
    await saveConfig({ catalogs, schema_limit: schemaLimit, table_limit: tableLimit, warehouse_id: warehouseId })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleRefreshStatus = () => fetchStatus()

  const host = appStatus?.ready ? (appStatus.checks.find(c => c.key === 'workspace')?.ok ? 'Connected' : 'Connection error') : 'Checking…'
  const user = appStatus?.user ?? '—'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowSettings(false)}>
      <div className="bg-white rounded-2xl shadow-2xl w-[500px] max-h-[85vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-gray-900">Settings</h2>
              {versionInfo && (
                <span className="text-[9px] font-mono text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">v{versionInfo.current}</span>
              )}
              {versionInfo?.update_available && versionInfo.latest && (
                <span className="text-[9px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded font-medium">
                  v{versionInfo.latest} available
                </span>
              )}
            </div>
            <p className="text-[11px] text-gray-400 mt-0.5">Configure catalog scope, limits, and warehouse</p>
          </div>
          <button onClick={() => setShowSettings(false)} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition-all">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">

          {/* ── Workspace (read-only) ── */}
          <div className="px-6 py-4 border-b border-gray-50">
            <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Workspace</div>
            <div className="space-y-1 text-[11px]">
              <div className="flex items-center gap-2">
                <span className="text-gray-400 w-20">Status</span>
                <span className={`font-medium ${host === 'Connected' ? 'text-green-600' : 'text-red-500'}`}>{host}</span>
              </div>
              {workspaceInfo?.host && (
                <div className="flex items-center gap-2">
                  <span className="text-gray-400 w-20">Host</span>
                  <span className="text-gray-700 font-mono text-[10px] truncate">{workspaceInfo.host}</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <span className="text-gray-400 w-20">User</span>
                <span className="text-gray-700 font-mono text-[10px]">{user}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-400 w-20">Warehouse</span>
                <span className="text-gray-700 font-mono text-[10px] truncate">{warehouseId || 'Not configured'}</span>
              </div>
            </div>
            <div className="mt-2 text-[9px] text-gray-400 leading-relaxed bg-gray-50 rounded p-2">
              <strong className="text-gray-500">Credentials:</strong> Configured automatically via{' '}
              <code className="font-mono">app.yaml</code> when running as a Databricks App.
              For local dev, set <code className="font-mono">DATABRICKS_PROFILE</code> in your environment.
            </div>
          </div>

          {/* ── Scope ── */}
          <div className="px-6 py-4 border-b border-gray-50">
            <button
              onClick={() => setScopeSection(v => !v)}
              className="w-full flex items-center justify-between text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1"
            >
              <span>Catalog scope</span>
              {scopeSection ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
            </button>
            {scopeSection && (
              <div className="mt-2 space-y-3">
                <div>
                  <div className="text-[11px] text-gray-500 mb-1.5">
                    Select catalogs to include. Leave all unchecked to use all catalogs.
                  </div>
                  {catalogsLoading ? (
                    <div className="flex items-center gap-2 text-[11px] text-gray-400 py-2">
                      <Loader size={11} className="animate-spin" /> Loading…
                    </div>
                  ) : (
                    <div className="max-h-36 overflow-y-auto border border-gray-100 rounded-lg divide-y divide-gray-50">
                      {allCatalogs.map(c => (
                        <label key={c.name} className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-indigo-50/50 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={catalogs.includes(c.name)}
                            onChange={() => toggleCatalog(c.name)}
                            className="accent-indigo-600"
                          />
                          <span className="text-[11px] text-gray-700">{c.name}</span>
                        </label>
                      ))}
                    </div>
                  )}
                  {catalogs.length > 0 && (
                    <p className="text-[10px] text-indigo-600 mt-1">{catalogs.length} selected: {catalogs.join(', ')}</p>
                  )}
                </div>

                <div>
                  <div className="text-[11px] text-gray-500 mb-1.5">Scale preset</div>
                  <div className="flex gap-2">
                    {PRESETS.filter(p => p.key !== 'custom').map(p => (
                      <button
                        key={p.key}
                        onClick={() => applyPreset(p.key)}
                        className={`flex-1 rounded-lg border py-1.5 text-[10px] font-medium transition-all ${
                          getPreset() === p.key
                            ? 'border-indigo-400 bg-indigo-50 text-indigo-700'
                            : 'border-gray-200 text-gray-500 hover:border-indigo-200'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-4 mt-2">
                    <label className="flex-1 text-[10px] text-gray-500">
                      Schemas / catalog
                      <input
                        type="number"
                        min={1}
                        max={500}
                        value={schemaLimit}
                        onChange={e => setSchemaLimit(Number(e.target.value))}
                        className="mt-1 w-full border border-gray-200 rounded px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-indigo-400"
                      />
                    </label>
                    <label className="flex-1 text-[10px] text-gray-500">
                      Tables / schema
                      <input
                        type="number"
                        min={1}
                        max={1000}
                        value={tableLimit}
                        onChange={e => setTableLimit(Number(e.target.value))}
                        className="mt-1 w-full border border-gray-200 rounded px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-indigo-400"
                      />
                    </label>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── System access ── */}
          <div className="px-6 py-4">
            <div className="flex items-center justify-between mb-2">
              <button
                onClick={() => setStatusSection(v => !v)}
                className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1"
              >
                System access {statusSection ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
              </button>
              <button
                onClick={handleRefreshStatus}
                className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-indigo-600 transition-colors"
                title="Re-run checks"
              >
                <RefreshCw size={10} /> Re-check
              </button>
            </div>
            {statusSection && (
              <div className="space-y-1.5">
                {!appStatus?.ready
                  ? <div className="flex items-center gap-2 text-[11px] text-gray-400 py-2"><Loader size={11} className="animate-spin" /> Running checks…</div>
                  : appStatus.checks.map(c => <CheckRow key={c.key} check={c} workspaceHost={workspaceInfo?.host} />)
                }
                {appStatus?.ready && appStatus.checks.some(c => !c.ok && c.fix_sql) && (
                  <p className="text-[9px] text-gray-400 pt-1">
                    SQL fixes must be run by a <strong>workspace admin</strong>. After applying grants, click Re-check.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <p className="text-[10px] text-gray-400">Changes to scope will re-ingest the graph.</p>
            <button
              onClick={() => { setShowSettings(false); setShowWizard(true) }}
              className="text-[10px] text-indigo-500 hover:text-indigo-700 transition-colors whitespace-nowrap"
            >
              Run setup wizard
            </button>
          </div>
          <div className="flex items-center gap-2">
            {saved && <span className="text-[10px] text-green-600 font-medium">✓ Saved</span>}
            <button
              onClick={() => setShowSettings(false)}
              className="px-3 py-1.5 text-[11px] border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-1.5 text-[11px] font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-all flex items-center gap-1.5"
            >
              {saving && <Loader size={11} className="animate-spin" />}
              {saving ? 'Saving…' : 'Save & apply'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
