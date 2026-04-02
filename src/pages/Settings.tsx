import { useState } from 'react'
import { useApp } from '../context/AppContext'
import Layout from '../components/Layout'
import ConfirmModal from '../components/ui/ConfirmModal'

const PREFS_KEY = 'artisanal_brew_prefs'

interface BrewPrefs {
  dose: number
  water: number
  temp: number
  grindSize: string
  method: string
}

const PREFS_DEFAULTS: BrewPrefs = { dose: 18.5, water: 310, temp: 94, grindSize: '24 clicks (Comandante)', method: 'V60' }

function loadPrefs(): BrewPrefs {
  try { return { ...PREFS_DEFAULTS, ...JSON.parse(localStorage.getItem(PREFS_KEY) || '{}') as Partial<BrewPrefs> } } catch { return { ...PREFS_DEFAULTS } }
}

export default function Settings() {
  const { user, beans, brews, stats, signOut, resetAllData, migrateExtractionValues, supabase } = useApp()
  const [signingOut, setSigningOut] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [resetDone, setResetDone] = useState(false)
  const [migrating, setMigrating] = useState(false)
  const [migrateResult, setMigrateResult] = useState<string | null>(null)
  const [prefs, setPrefs] = useState<BrewPrefs>(loadPrefs)
  const [prefsSaved, setPrefsSaved] = useState(false)

  async function savePrefs() {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs))
    if (supabase && user && !user.is_anonymous) {
      try { await supabase.auth.updateUser({ data: { brew_prefs: prefs } }) } catch {}
    }
    setPrefsSaved(true)
    setTimeout(() => setPrefsSaved(false), 2000)
  }

  const meta = (user?.user_metadata || {}) as Record<string, string>
  const displayName = meta['full_name'] || meta['name'] || 'Brewer'
  const avatarUrl = meta['avatar_url'] || meta['picture']
  const isDemo = user?.is_anonymous || !user?.email

  function exportData() {
    const data = { brews, beans }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'artisanal-brew-export.json'
    a.click()
  }

  async function handleMigrateExtraction() {
    setMigrating(true)
    setMigrateResult(null)
    try {
      const count = await migrateExtractionValues()
      setMigrateResult(count > 0 ? `Fixed ${count} brew${count !== 1 ? 's' : ''}.` : 'All brews already up to date.')
    } catch (err) {
      setMigrateResult('Failed: ' + ((err as Error)?.message || 'unknown error'))
    } finally {
      setMigrating(false)
    }
  }

  async function handleReset() {
    setResetting(true)
    try {
      await resetAllData()
      setResetDone(true)
    } finally {
      setResetting(false)
    }
  }

  async function handleSignOut() {
    setSigningOut(true)
    try {
      await signOut()
    } finally {
      setSigningOut(false)
    }
  }

  const prefFields: { label: string; key: keyof BrewPrefs; type: string; unit: string; min: number; max: number; step: number }[] = [
    { label: 'Default Dose', key: 'dose', type: 'number', unit: 'g', min: 5, max: 40, step: 0.5 },
    { label: 'Default Water', key: 'water', type: 'number', unit: 'g', min: 50, max: 600, step: 10 },
    { label: 'Default Temp', key: 'temp', type: 'number', unit: '°C', min: 60, max: 100, step: 1 },
  ]

  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-4 py-6 md:px-10 md:py-10 space-y-8 md:space-y-10">
        <section className="space-y-1">
          <span className="text-[10px] font-bold tracking-[0.2em] text-on-surface-variant uppercase">Preferences</span>
          <h2 className="font-headline text-5xl font-bold text-primary leading-tight">Settings</h2>
        </section>

        {/* Profile */}
        <section className="bg-surface-container-lowest rounded-2xl p-8 shadow-[0_4px_20px_rgba(62,39,35,0.04)]">
          <h3 className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-6">Account Profile</h3>
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-4 md:gap-6">
            <div className="w-20 h-20 rounded-full bg-surface-container-highest border-2 border-outline-variant/20 flex items-center justify-center overflow-hidden shrink-0">
              {avatarUrl
                ? <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
                : <span className="material-symbols-outlined text-on-surface-variant text-4xl" style={{ fontVariationSettings: "'FILL' 1,'wght' 400,'GRAD' 0,'opsz' 48" }}>account_circle</span>
              }
            </div>
            <div className="flex-1">
              <h4 className="font-headline text-2xl text-primary font-bold">{displayName}</h4>
              <p className="text-sm text-on-surface-variant mt-1">{user?.email || ''}</p>
              <div className="mt-3 inline-flex items-center gap-2 px-3 py-1 bg-tertiary-fixed text-tertiary rounded-full text-[11px] font-bold uppercase tracking-wide">
                <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'FILL' 1,'wght' 400,'GRAD' 0,'opsz' 24" }}>verified</span>
                {isDemo ? 'Demo Account' : 'Google Account'}
              </div>
            </div>
            <button onClick={handleSignOut} disabled={signingOut} className="shrink-0 flex items-center gap-2 px-5 py-2.5 border border-error/30 text-error rounded-xl text-xs font-bold hover:bg-error-container/30 transition-colors disabled:opacity-60">
              {signingOut ? (
                <><span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>Signing out…</>
              ) : (
                <><span className="material-symbols-outlined text-[16px]">logout</span>Sign Out</>
              )}
            </button>
          </div>
        </section>

        {/* Cellar Summary */}
        <section className="bg-surface-container-lowest rounded-2xl p-8 shadow-[0_4px_20px_rgba(62,39,35,0.04)]">
          <h3 className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-6">Cellar Summary</h3>
          <div className="grid grid-cols-3 gap-3 md:gap-4">
            {([
              ['Total Brews', String(stats.totalBrews), 'coffee'],
              ['Avg Rating', stats.avgRating.toFixed(1) + ' / 5', 'star'],
              ['Beans in Cellar', beans.length + ' beans', 'grain'],
            ] as [string, string, string][]).map(([label, value, icon]) => (
              <div key={label} className="bg-surface-container-low rounded-xl p-5 text-center">
                <span className="material-symbols-outlined text-primary mb-2 block" style={{ fontVariationSettings: "'FILL' 1,'wght' 400,'GRAD' 0,'opsz' 24" }}>{icon}</span>
                <p className="font-headline text-2xl font-bold text-primary">{value}</p>
                <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wide mt-1">{label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Brew Preferences */}
        <section className="bg-surface-container-lowest rounded-2xl p-8 shadow-[0_4px_20px_rgba(62,39,35,0.04)]">
          <h3 className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-6">Brew Preferences</h3>
          <p className="text-xs text-on-surface-variant mb-6">These defaults are pre-filled in Brew Setup each time you start a new session.</p>
          <div className="grid grid-cols-2 gap-4 mb-6">
            {prefFields.map(({ label, key, type, unit, min, max, step }) => (
              <div key={key}>
                <label className="block text-[10px] uppercase tracking-widest text-on-surface-variant font-bold mb-1.5">{label}</label>
                <div className="flex items-center gap-2 bg-surface-container rounded-xl px-4 py-3">
                  <input
                    type={type} min={min} max={max} step={step}
                    value={prefs[key] as number}
                    onChange={e => setPrefs(p => ({ ...p, [key]: parseFloat(e.target.value) || p[key] }))}
                    className="flex-1 bg-transparent text-sm font-bold text-on-surface outline-none border-none w-0 min-w-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <span className="text-xs text-on-surface-variant shrink-0">{unit}</span>
                </div>
              </div>
            ))}
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-on-surface-variant font-bold mb-1.5">Default Method</label>
              <select value={prefs.method} onChange={e => setPrefs(p => ({ ...p, method: e.target.value }))} className="w-full bg-surface-container rounded-xl px-4 py-3 text-sm font-bold text-on-surface outline-none border-none focus:ring-1 focus:ring-primary/30">
                {['V60', 'Chemex', 'AeroPress', 'French Press'].map(m => <option key={m}>{m}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-[10px] uppercase tracking-widest text-on-surface-variant font-bold mb-1.5">Default Grind Size</label>
              <input
                value={prefs.grindSize}
                onChange={e => setPrefs(p => ({ ...p, grindSize: e.target.value }))}
                placeholder="e.g. 24 clicks (Comandante)"
                className="w-full bg-surface-container rounded-xl px-4 py-3 text-sm text-on-surface outline-none border-none focus:ring-1 focus:ring-primary/30"
              />
            </div>
          </div>
          <button onClick={savePrefs} className="flex items-center gap-2 px-5 py-2.5 brew-gradient text-white rounded-xl text-xs font-bold hover:opacity-90 transition-all">
            {prefsSaved
              ? <><span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: "'FILL' 1,'wght' 400,'GRAD' 0,'opsz' 24" }}>check_circle</span>Saved</>
              : <><span className="material-symbols-outlined text-[16px]">save</span>Save Preferences</>
            }
          </button>
        </section>

        {/* Data Management */}
        <section className="bg-surface-container-lowest rounded-2xl p-8 shadow-[0_4px_20px_rgba(62,39,35,0.04)]">
          <h3 className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-6">Data Management</h3>
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between p-4 bg-surface-container-low rounded-xl">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-primary">download</span>
                <div>
                  <p className="text-sm font-bold text-primary">Export Brew Data</p>
                  <p className="text-xs text-on-surface-variant">Download all brews as JSON</p>
                </div>
              </div>
              <button onClick={exportData} className="px-4 py-2 bg-surface-container-high text-on-surface rounded-lg text-xs font-bold hover:bg-surface-container-highest transition-colors">Export</button>
            </div>
            <div className="flex items-center justify-between p-4 bg-surface-container-low rounded-xl">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-primary">science</span>
                <div>
                  <p className="text-sm font-bold text-primary">Fix Extraction Values</p>
                  <p className="text-xs text-on-surface-variant">
                    {migrateResult ?? 'Recalculates old brews saved with the incorrect formula (values below 15%)'}
                  </p>
                </div>
              </div>
              <button
                onClick={handleMigrateExtraction}
                disabled={migrating}
                className="px-4 py-2 bg-surface-container-high text-on-surface rounded-lg text-xs font-bold hover:bg-surface-container-highest transition-colors disabled:opacity-60 shrink-0"
              >
                {migrating
                  ? <span className="inline-flex items-center gap-1.5"><span className="material-symbols-outlined text-[14px] animate-spin">progress_activity</span>Fixing…</span>
                  : 'Fix Now'
                }
              </button>
            </div>
            <div className="flex items-center justify-between p-4 bg-error-container/20 rounded-xl border border-error/10">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-error">delete_forever</span>
                <div>
                  <p className="text-sm font-bold text-error">Reset All Data</p>
                  <p className="text-xs text-on-surface-variant">Permanently delete all brews and beans</p>
                </div>
              </div>
              <button onClick={() => setShowResetConfirm(true)} disabled={resetting} className="px-4 py-2 bg-error text-white rounded-lg text-xs font-bold hover:opacity-90 transition-colors disabled:opacity-60">
                {resetting ? (
                  <span className="inline-flex items-center gap-1.5"><span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>Resetting…</span>
                ) : 'Reset'}
              </button>
            </div>
          </div>
        </section>

        {/* About */}
        <section className="bg-surface-container-lowest rounded-2xl p-8 shadow-[0_4px_20px_rgba(62,39,35,0.04)]">
          <h3 className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-4">About</h3>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-primary-container rounded-full flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-white" style={{ fontVariationSettings: "'FILL' 1,'wght' 400,'GRAD' 0,'opsz' 24" }}>coffee</span>
            </div>
            <div>
              <p className="font-headline text-lg text-primary font-bold">The Artisanal Brew</p>
              <p className="text-xs text-on-surface-variant">Modern Cellar Edition &bull; All data synced to cloud</p>
            </div>
          </div>
        </section>
      </div>
    </Layout>

    {showResetConfirm && (
      <ConfirmModal
        title="Reset All Data"
        message="This will permanently delete all your brews and beans. This cannot be undone."
        confirmLabel={resetting ? 'Resetting…' : 'Reset Everything'}
        danger
        onConfirm={() => { setShowResetConfirm(false); handleReset() }}
        onCancel={() => setShowResetConfirm(false)}
      />
    )}
    {resetDone && (
      <ConfirmModal
        message="All data has been reset."
        confirmLabel="OK"
        onConfirm={() => setResetDone(false)}
      />
    )}
  )
}
