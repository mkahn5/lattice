import { useEffect, useRef, useState } from 'react'
import { useGraphStore, type PreflightCheck } from '../../stores/graphStore'
import { CheckCircle, XCircle, Loader, RefreshCw, ChevronDown, ChevronUp, X, Copy, Check, ExternalLink, Plus, Pencil, Trash2, FlaskConical, Globe } from 'lucide-react'

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
  const [checking, setChecking] = useState(false)
  const check = () => {
    setChecking(true)
    fetch('/api/version').then(r => r.json()).then(d => { setInfo(d); setChecking(false) }).catch(() => setChecking(false))
  }
  useEffect(() => { check() }, [])
  return { info, checking, check }
}

interface ProfileEntry {
  name: string
  host: string
  active: boolean
  source: 'lattice' | 'databrickscfg'
}

interface ProfileFormProps {
  form: { name: string; host: string; token: string }
  setForm: (f: { name: string; host: string; token: string }) => void
  testResult: { ok: boolean; user?: string; error?: string } | null
  testing: boolean
  saving: boolean
  saveError?: string | null
  isEdit?: boolean
  onTest: () => void
  onSave: () => void
  onCancel: () => void
}

function ProfileForm({ form, setForm, testResult, testing, saving, saveError, isEdit, onTest, onSave, onCancel }: ProfileFormProps) {
  const canTest = form.host.startsWith('https://') && form.token.length > 5
  const canSave = form.name.length > 0 && form.host.startsWith('https://') && (isEdit || form.token.length > 5)

  return (
    <form className="border border-indigo-200 bg-indigo-50/30 rounded-lg p-3 space-y-2" autoComplete="off" onSubmit={e => e.preventDefault()}>
      <div>
        <label className="text-[10px] text-gray-500 block mb-0.5">Profile name</label>
        <input
          type="text"
          value={form.name}
          onChange={e => setForm({ ...form, name: e.target.value })}
          disabled={isEdit}
          placeholder="my-workspace"
          autoComplete="off"
          className="w-full border border-gray-200 rounded px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-indigo-400 disabled:bg-gray-100 disabled:text-gray-500"
        />
      </div>
      <div>
        <label className="text-[10px] text-gray-500 block mb-0.5">Host URL</label>
        <input
          type="text"
          value={form.host}
          onChange={e => setForm({ ...form, host: e.target.value })}
          placeholder="https://my-workspace.cloud.databricks.com"
          autoComplete="off"
          className="w-full border border-gray-200 rounded px-2 py-1 text-[11px] font-mono focus:outline-none focus:ring-1 focus:ring-indigo-400"
        />
      </div>
      <div>
        <label className="text-[10px] text-gray-500 block mb-0.5">
          Personal Access Token {isEdit && <span className="text-gray-400">(leave blank to keep current)</span>}
        </label>
        <input
          type="text"
          value={form.token}
          onChange={e => setForm({ ...form, token: e.target.value })}
          placeholder={isEdit ? '••••••••' : 'dapi...'}
          autoComplete="off"
          data-1p-ignore
          data-lpignore="true"
          className="w-full border border-gray-200 rounded px-2 py-1 text-[11px] font-mono focus:outline-none focus:ring-1 focus:ring-indigo-400"
          style={{ WebkitTextSecurity: 'disc' } as React.CSSProperties}
        />
      </div>
      <div className="pt-1 space-y-1.5">
        <div className="flex items-center gap-2">
          <button
            onClick={onTest}
            disabled={!canTest || testing}
            className="flex items-center gap-1 text-[10px] text-indigo-600 hover:text-indigo-800 disabled:text-gray-400 disabled:cursor-not-allowed font-medium transition-colors"
          >
            {testing ? <Loader size={9} className="animate-spin" /> : <FlaskConical size={9} />}
            {testing ? 'Testing…' : 'Test connection'}
          </button>
          {testResult && (
            <span className={`text-[9px] ${testResult.ok ? 'text-green-600' : 'text-red-500'}`}>
              {testResult.ok ? `✓ Connected as ${testResult.user}` : `✕ ${testResult.error}`}
            </span>
          )}
        </div>
        {saveError && (
          <div className="text-[9px] text-red-500">✕ {saveError}</div>
        )}
        <div className="flex items-center justify-end gap-2">
          <button onClick={onCancel} className="text-[10px] text-gray-500 hover:text-gray-700 transition-colors">
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={!canSave || saving}
            className="px-3 py-1 text-[10px] font-medium bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50 transition-all flex items-center gap-1"
          >
            {saving && <Loader size={9} className="animate-spin" />}
            {isEdit ? 'Update' : 'Save'}
          </button>
        </div>
      </div>
    </form>
  )
}

export function SettingsPanel() {
  const { appConfig, appStatus, workspaceInfo, saveConfig, fetchConfig, fetchStatus, setShowSettings, setShowWizard } = useGraphStore()
  const { info: versionInfo, checking: versionChecking, check: checkVersion } = useVersionInfo()

  const [catalogs, setCatalogs] = useState<string[]>([])
  const [allCatalogs, setAllCatalogs] = useState<{ name: string }[]>([])
  const [catalogsLoading, setCatalogsLoading] = useState(false)
  const [schemaLimit, setSchemaLimit] = useState(20)
  const [tableLimit, setTableLimit] = useState(50)
  const [warehouseId, setWarehouseId] = useState('')
  const [saving, setSaving] = useState(false)
  // saved state removed — panel closes immediately on save
  const [statusSection, setStatusSection] = useState(true)
  const [scopeSection, setScopeSection] = useState(true)
  const [advancedSection, setAdvancedSection] = useState(false)
  const [lineageBackfillJobs, setLineageBackfillJobs] = useState(500)
  const [lineageBackfillTables, setLineageBackfillTables] = useState(2000)
  const [lineageQueryLimit, setLineageQueryLimit] = useState(10000)
  const loadedRef = useRef(false)

  // Workspace Profiles state
  const [profiles, setProfiles] = useState<ProfileEntry[]>([])
  const [profilesSection, setProfilesSection] = useState(true)
  const [addingProfile, setAddingProfile] = useState(false)
  const [editingProfile, setEditingProfile] = useState<string | null>(null)
  const [profileForm, setProfileForm] = useState({ name: '', host: '', token: '' })
  const [testResult, setTestResult] = useState<{ ok: boolean; user?: string; error?: string } | null>(null)
  const [testing, setTesting] = useState(false)
  const [profileSaving, setProfileSaving] = useState(false)
  const [deletingProfile, setDeletingProfile] = useState<string | null>(null)
  const [profileSaveError, setProfileSaveError] = useState<string | null>(null)

  const loadProfiles = () => {
    fetch('/api/profiles').then(r => r.json()).then(d => setProfiles(d.profiles ?? [])).catch(() => {})
  }

  useEffect(() => {
    if (!loadedRef.current) {
      loadedRef.current = true
      fetchConfig()
      fetchStatus()
      loadProfiles()
    }
  }, [])

  useEffect(() => {
    if (appConfig) {
      setCatalogs(appConfig.catalogs ?? [])
      setSchemaLimit(appConfig.schema_limit ?? 20)
      setTableLimit(appConfig.table_limit ?? 50)
      setWarehouseId(appConfig.warehouse_id ?? '')
      setLineageBackfillJobs(appConfig.lineage_backfill_jobs ?? 500)
      setLineageBackfillTables(appConfig.lineage_backfill_tables ?? 2000)
      setLineageQueryLimit(appConfig.lineage_query_limit ?? 10000)
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
    await saveConfig({
      catalogs, schema_limit: schemaLimit, table_limit: tableLimit, warehouse_id: warehouseId,
      lineage_backfill_jobs: lineageBackfillJobs, lineage_backfill_tables: lineageBackfillTables,
      lineage_query_limit: lineageQueryLimit,
    })
    setSaving(false)
    setShowSettings(false)
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
                <a
                  href="https://github.com/databricks-field-eng/lattice/releases"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[9px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded font-medium hover:bg-amber-100 transition-colors flex items-center gap-1"
                >
                  {versionInfo.latest?.startsWith('v') ? '' : 'v'}{versionInfo.latest} available <ExternalLink size={7} />
                </a>
              )}
              <button
                onClick={checkVersion}
                disabled={versionChecking}
                className="flex items-center gap-1 text-[9px] text-gray-400 hover:text-indigo-600 transition-colors disabled:opacity-50"
                title="Check for new releases"
              >
                <RefreshCw size={9} className={versionChecking ? 'animate-spin' : ''} />
                {!versionInfo?.update_available && 'Check for updates'}
              </button>
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

          {/* ── Workspace Profiles ── */}
          <div className="px-6 py-4 border-b border-gray-50">
            <div className="flex items-center justify-between mb-1">
              <button
                onClick={() => setProfilesSection(v => !v)}
                className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1"
              >
                Workspace profiles {profilesSection ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
              </button>
              {profilesSection && !addingProfile && !editingProfile && (
                <button
                  onClick={() => { setAddingProfile(true); setProfileForm({ name: '', host: '', token: '' }); setTestResult(null) }}
                  className="flex items-center gap-1 text-[10px] text-indigo-600 hover:text-indigo-800 transition-colors font-medium"
                >
                  <Plus size={10} /> Add
                </button>
              )}
            </div>

            {profilesSection && (
              <div className="mt-2 space-y-1.5">
                {/* Profile list */}
                {profiles.length === 0 && !addingProfile && (
                  <p className="text-[10px] text-gray-400 py-1">No profiles configured. Add one to connect to a workspace.</p>
                )}

                {profiles.map(p => {
                  if (editingProfile === p.name) {
                    return (
                      <ProfileForm
                        key={p.name}
                        form={profileForm}
                        setForm={setProfileForm}
                        testResult={testResult}
                        testing={testing}
                        saving={profileSaving}
                        saveError={profileSaveError}
                        isEdit
                        onTest={async () => {
                          setTesting(true); setTestResult(null); setProfileSaveError(null)
                          try {
                            const r = await fetch('/api/profiles/test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(profileForm) })
                            const d = await r.json()
                            if (d.detail) { const msg = Array.isArray(d.detail) ? d.detail.map((e: any) => e.msg).join('; ') : d.detail; setTestResult({ ok: false, error: msg }) }
                            else { setTestResult(d) }
                          } catch { setTestResult({ ok: false, error: 'Network error' }) }
                          setTesting(false)
                        }}
                        onSave={async () => {
                          setProfileSaving(true); setProfileSaveError(null)
                          try {
                            const r = await fetch('/api/profiles', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(profileForm) })
                            if (r.ok) { loadProfiles(); setEditingProfile(null); setTestResult(null); setProfileSaveError(null) }
                            else { const d = await r.json().catch(() => ({})); const detail = Array.isArray(d.detail) ? d.detail.map((e: any) => e.msg).join('; ') : d.detail; setProfileSaveError(detail || `Save failed (${r.status})`) }
                          } catch (e) { setProfileSaveError('Network error') }
                          setProfileSaving(false)
                        }}
                        onCancel={() => { setEditingProfile(null); setTestResult(null); setProfileSaveError(null) }}
                      />
                    )
                  }

                  return (
                    <div key={p.name} className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${p.active ? 'border-indigo-200 bg-indigo-50/50' : 'border-gray-100 bg-gray-50/30'}`}>
                      <Globe size={10} className={`shrink-0 ${p.active ? 'text-indigo-500' : 'text-gray-400'}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[11px] font-medium ${p.active ? 'text-indigo-700' : 'text-gray-700'}`}>{p.name}</span>
                          {p.active && <span className="text-[8px] bg-indigo-100 text-indigo-600 px-1 py-0.5 rounded font-medium">ACTIVE</span>}
                          <span className={`text-[8px] px-1 py-0.5 rounded ${p.source === 'lattice' ? 'bg-amber-50 text-amber-600' : 'bg-gray-100 text-gray-500'}`}>
                            {p.source === 'lattice' ? 'PAT' : 'CLI'}
                          </span>
                        </div>
                        <div className="text-[9px] text-gray-400 truncate">{p.host}</div>
                      </div>
                      {p.source === 'lattice' && (
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => { setEditingProfile(p.name); setProfileForm({ name: p.name, host: p.host, token: '' }); setTestResult(null) }}
                            className="p-1 text-gray-400 hover:text-indigo-600 rounded hover:bg-indigo-50 transition-all"
                            title="Edit profile"
                          >
                            <Pencil size={10} />
                          </button>
                          {deletingProfile === p.name ? (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={async () => {
                                  await fetch(`/api/profiles/${encodeURIComponent(p.name)}`, { method: 'DELETE' })
                                  loadProfiles(); setDeletingProfile(null)
                                }}
                                className="text-[9px] text-red-600 hover:text-red-800 font-medium"
                              >
                                Confirm
                              </button>
                              <button onClick={() => setDeletingProfile(null)} className="text-[9px] text-gray-400 hover:text-gray-600">
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setDeletingProfile(p.name)}
                              className="p-1 text-gray-400 hover:text-red-500 rounded hover:bg-red-50 transition-all"
                              title="Delete profile"
                            >
                              <Trash2 size={10} />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}

                {/* Add profile form */}
                {addingProfile && (
                  <ProfileForm
                    form={profileForm}
                    setForm={setProfileForm}
                    testResult={testResult}
                    testing={testing}
                    saving={profileSaving}
                    saveError={profileSaveError}
                    onTest={async () => {
                      setTesting(true); setTestResult(null); setProfileSaveError(null)
                      try {
                        const r = await fetch('/api/profiles/test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(profileForm) })
                        setTestResult(await r.json())
                      } catch { setTestResult({ ok: false, error: 'Network error' }) }
                      setTesting(false)
                    }}
                    onSave={async () => {
                      setProfileSaving(true); setProfileSaveError(null)
                      try {
                        const r = await fetch('/api/profiles', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(profileForm) })
                        if (r.ok) { loadProfiles(); setAddingProfile(false); setProfileForm({ name: '', host: '', token: '' }); setTestResult(null); setProfileSaveError(null) }
                        else { const d = await r.json().catch(() => ({})); const detail = Array.isArray(d.detail) ? d.detail.map((e: any) => e.msg).join('; ') : d.detail; setProfileSaveError(detail || `Save failed (${r.status})`) }
                      } catch (e) { setProfileSaveError('Network error') }
                      setProfileSaving(false)
                    }}
                    onCancel={() => { setAddingProfile(false); setTestResult(null) }}
                  />
                )}

                <p className="text-[9px] text-gray-400 leading-relaxed pt-1">
                  Add workspace profiles with a Personal Access Token. CLI profiles from <code className="font-mono">~/.databrickscfg</code> are also listed (read-only).
                </p>
              </div>
            )}
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

          {/* ── Advanced: Lineage limits ── */}
          <div className="px-6 py-4 border-t border-gray-50">
            <button
              onClick={() => setAdvancedSection(v => !v)}
              className="w-full flex items-center justify-between text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1"
            >
              <span className="flex items-center gap-1">Advanced <FlaskConical size={10} /></span>
              {advancedSection ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
            </button>
            {advancedSection && (
              <div className="mt-2 space-y-3">
                <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  <p className="text-[10px] text-amber-800 leading-relaxed">
                    <strong>Increase at your own risk.</strong> Higher limits improve lineage coverage but increase
                    ingestion time, API calls, and memory usage. Large workspaces (10K+ tables) may
                    cause slow rendering or timeouts.
                  </p>
                </div>
                <div>
                  <div className="text-[11px] text-gray-500 mb-1.5">Lineage query limit</div>
                  <p className="text-[9px] text-gray-400 mb-1">
                    Max rows fetched from system.access.table_lineage (table-to-table and job-to-table).
                  </p>
                  <input
                    type="number"
                    min={1000}
                    max={100000}
                    step={1000}
                    value={lineageQueryLimit}
                    onChange={e => setLineageQueryLimit(Number(e.target.value))}
                    className="w-full border border-gray-200 rounded px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-indigo-400"
                  />
                  <p className="text-[9px] text-gray-400 mt-0.5">Default: 10,000 &middot; Range: 1,000 – 100,000</p>
                </div>
                <div className="flex gap-4">
                  <label className="flex-1 text-[10px] text-gray-500">
                    Job backfill limit
                    <p className="text-[9px] text-gray-400 mb-1 font-normal">
                      Max jobs fetched individually to fill lineage gaps.
                    </p>
                    <input
                      type="number"
                      min={0}
                      max={5000}
                      step={100}
                      value={lineageBackfillJobs}
                      onChange={e => setLineageBackfillJobs(Number(e.target.value))}
                      className="w-full border border-gray-200 rounded px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-indigo-400"
                    />
                    <p className="text-[9px] text-gray-400 mt-0.5">Default: 500</p>
                  </label>
                  <label className="flex-1 text-[10px] text-gray-500">
                    Table backfill limit
                    <p className="text-[9px] text-gray-400 mb-1 font-normal">
                      Max tables fetched individually to fill lineage gaps.
                    </p>
                    <input
                      type="number"
                      min={0}
                      max={20000}
                      step={500}
                      value={lineageBackfillTables}
                      onChange={e => setLineageBackfillTables(Number(e.target.value))}
                      className="w-full border border-gray-200 rounded px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-indigo-400"
                    />
                    <p className="text-[9px] text-gray-400 mt-0.5">Default: 2,000</p>
                  </label>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <a
              href="https://github.com/mkahn5/lattice/issues"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] text-gray-400 hover:text-indigo-600 transition-colors whitespace-nowrap flex items-center gap-1"
            >
              <ExternalLink size={8} /> Feedback & bugs
            </a>
            <button
              onClick={() => { setShowSettings(false); setShowWizard(true) }}
              className="text-[10px] text-indigo-500 hover:text-indigo-700 transition-colors whitespace-nowrap"
            >
              Run setup wizard
            </button>
          </div>
          <div className="flex items-center gap-2">
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
              {saving ? 'Saving…' : 'Save & close'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
