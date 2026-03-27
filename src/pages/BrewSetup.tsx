import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import Layout from '../components/Layout'
import { generateBrewRecipe } from '../lib/aiBrewAssist'
import { PHASES } from '../lib/appData'
import type { BrewPhase } from '../types/brew'

interface BrewPrefs {
  dose: number
  water: number
  temp: number
  grindSize: string
  method: string
}

function loadBrewPrefs(): BrewPrefs {
  try { return JSON.parse(localStorage.getItem('artisanal_brew_prefs') || '{}') as BrewPrefs } catch { return {} as BrewPrefs }
}

function phasesDuration(method: string): string {
  const phases: BrewPhase[] = (PHASES as Record<string, BrewPhase[]>)[method] || (PHASES as Record<string, BrewPhase[]>)['V60']
  const secs = phases.reduce((s, p) => s + p.duration, 0)
  const m = Math.floor(secs / 60), s = secs % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

const METHODS = [
  { id: 'V60', pattern: 'Bloom + 35s degas + 2 pours + draw down' },
  { id: 'Chemex', pattern: 'Bloom + 40s degas + 2 pours + draw down' },
  { id: 'AeroPress', pattern: 'Full fill + 1min steep + 30s press' },
  { id: 'French Press', pattern: 'Bloom + 30s degas + fill + 4min steep + press' },
]

export default function BrewSetup() {
  const { beans, brews, getActiveBean, setActiveBeanId, setPendingBrew, getPendingBrew, clearPendingBrew, formatDate, formatRatio, getTip } = useApp()
  const navigate = useNavigate()

  const pending = getPendingBrew()
  const activeBean = getActiveBean()

  const savedPrefs = loadBrewPrefs()
  const [selectedBeanId, setSelectedBeanId] = useState(pending?.beanId || activeBean?.id || '')
  const [selectedMethod, setSelectedMethod] = useState(pending?.method || savedPrefs.method || 'V60')
  const [dose, setDose] = useState(pending?.dose || savedPrefs.dose || 18.5)
  const [water, setWater] = useState(pending?.water || savedPrefs.water || 310)
  const [temp, setTemp] = useState(pending?.temp || savedPrefs.temp || 94)
  const [grind, setGrind] = useState(pending?.grindSize || savedPrefs.grindSize || '24 clicks (Comandante)')
  const [showBeanPicker, setShowBeanPicker] = useState(false)
  const [showTip, setShowTip] = useState(false)
  const [generatingRecipe, setGeneratingRecipe] = useState(false)
  const [recipeNote, setRecipeNote] = useState<string | null>(null)

  useEffect(() => {
    clearPendingBrew()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!pending && activeBean?.id) setSelectedBeanId(activeBean.id)
  }, [activeBean]) // eslint-disable-line react-hooks/exhaustive-deps

  const selectedBean = beans.find(b => b.id === selectedBeanId) || activeBean
  const ratio = formatRatio(dose, water)
  const fillDose = Math.min((dose / 40) * 100, 100)
  const fillWater = Math.min((water / 600) * 100, 100)
  const fillTemp = Math.min(((temp - 60) / 40) * 100, 100)
  const method = METHODS.find(m => m.id === selectedMethod) || METHODS[0]
  const estExtraction = (water / dose) * 1.2
  const lastBrew = brews[0] || null
  const brewsLeft = selectedBean?.remainingGrams ? Math.floor(selectedBean.remainingGrams / dose) : 0
  const beanBrews = brews.filter(b => b.beanId === selectedBeanId)
  const myBeanAvgRating = beanBrews.length ? (beanBrews.reduce((s, b) => s + b.rating, 0) / beanBrews.length).toFixed(1) : null

  async function handleGenerateRecipe() {
    const bean = beans.find(b => b.id === selectedBeanId) || activeBean
    if (!bean?.name) return
    setGeneratingRecipe(true)
    setRecipeNote(null)
    try {
      const recipe = await generateBrewRecipe(bean)
      if (recipe) {
        if (recipe.method && METHODS.find(m => m.id === recipe.method)) setSelectedMethod(recipe.method)
        if (recipe.dose) setDose(recipe.dose)
        if (recipe.water) setWater(recipe.water)
        if (recipe.temp) setTemp(recipe.temp)
        if (recipe.grindSize) setGrind(recipe.grindSize)
        if (recipe.reasoning) setRecipeNote(recipe.reasoning)
      }
    } catch {
      setRecipeNote('Could not generate recipe. Check your API key.')
    } finally {
      setGeneratingRecipe(false)
    }
  }

  function pickBean(id: string) {
    setSelectedBeanId(id)
    setActiveBeanId(id)
    setShowBeanPicker(false)
  }

  function startGuidedMode() {
    const bean = beans.find(b => b.id === selectedBeanId) || activeBean
    setPendingBrew({
      beanId: selectedBeanId,
      beanName: bean?.name || 'Unknown Bean',
      method: selectedMethod,
      dose, water, temp,
      ratio: formatRatio(dose, water),
      grindSize: grind,
      brewTime: phasesDuration(selectedMethod),
      extraction: Number(((water / dose) * 1.2).toFixed(1)),
    })
    navigate('/guided-brew')
  }

  return (
    <Layout>
      <div className="max-w-[1440px] mx-auto px-4 py-6 md:px-10 md:py-10 space-y-8 md:space-y-10">
        <section className="space-y-1">
          <span className="text-[10px] font-bold tracking-[0.2em] text-on-primary-container uppercase">Phase 01: Configuration</span>
          <h2 className="font-headline text-5xl font-bold text-primary leading-tight">Brew Setup</h2>
        </section>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 md:gap-8 items-start">
          {/* Left: Bean + Method */}
          <div className="col-span-1 md:col-span-3 space-y-6">
            <div className="bg-surface-container-lowest p-6 rounded-xl shadow-[0_4px_20px_rgba(62,39,35,0.04)]">
              <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-4">Origin Select</p>
              <div className="relative rounded-lg overflow-hidden mb-4 cursor-pointer group" onClick={() => setShowBeanPicker(true)}>
                <img src="https://images.unsplash.com/photo-1447933601403-0c6688de566e?w=500&q=80" alt="Bean" className="w-full h-40 object-cover group-hover:scale-105 transition-transform duration-700" />
                <div className="absolute inset-0 bg-primary/30 flex items-end p-4">
                  <span className="text-white font-headline font-bold text-lg leading-tight">{selectedBean?.name || 'Select Bean'}</span>
                </div>
              </div>
              <p className="text-xs text-on-surface-variant leading-relaxed mb-4">{selectedBean?.notes || ''}</p>
              <button onClick={() => setShowBeanPicker(true)} className="w-full py-2.5 bg-surface-container-high text-on-surface rounded-md text-xs font-bold uppercase tracking-wider hover:bg-surface-container-highest transition-colors">
                Change Bean
              </button>
            </div>

            <div className="bg-surface-container-lowest p-6 rounded-xl shadow-[0_4px_20px_rgba(62,39,35,0.04)]">
              <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-4">Extraction Method</p>
              <div className="space-y-2.5">
                {METHODS.map(m => (
                  <button
                    key={m.id}
                    onClick={() => setSelectedMethod(m.id)}
                    className={`w-full flex items-center justify-between p-3.5 rounded-lg text-sm font-medium transition-colors ${m.id === selectedMethod ? 'border border-primary/20 bg-surface-bright text-primary font-bold' : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high'}`}
                  >
                    <span>{m.id}</span>
                    {m.id === selectedMethod && <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1,'wght' 400,'GRAD' 0,'opsz' 24" }}>check_circle</span>}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Center: Parameters */}
          <div className="col-span-1 md:col-span-6">
            <div className="bg-surface-container-lowest p-10 rounded-xl shadow-[0_12px_40px_rgba(62,39,35,0.06)] relative overflow-hidden">
              <div className="absolute -right-8 -bottom-8 opacity-[0.03] pointer-events-none select-none">
                <span className="material-symbols-outlined" style={{ fontSize: '280px', fontVariationSettings: "'FILL' 1,'wght' 400,'GRAD' 0,'opsz' 48" }}>coffee</span>
              </div>
              <div className="flex items-center justify-between mb-10">
                <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Brew Parameters</p>
                <button
                  type="button"
                  onClick={handleGenerateRecipe}
                  disabled={generatingRecipe || !selectedBeanId}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-container-high text-primary text-[10px] font-bold uppercase tracking-wide hover:bg-surface-container-highest transition-colors disabled:opacity-40"
                >
                  {generatingRecipe
                    ? <><span className="material-symbols-outlined text-[14px] animate-spin">progress_activity</span>Generating…</>
                    : <><span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'FILL' 1,'wght' 400,'GRAD' 0,'opsz' 24" }}>auto_awesome</span>Generate with AI</>
                  }
                </button>
              </div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-8 md:gap-x-10 md:gap-y-10">
                <div>
                  <label className="flex items-center gap-2 text-sm font-bold text-on-surface mb-4">
                    <span className="material-symbols-outlined text-[18px]">scale</span>Dose
                  </label>
                  <div className="flex items-baseline gap-2">
                    <input type="number" value={dose} min="5" max="40" step="0.5" onChange={e => setDose(parseFloat(e.target.value) || 18.5)} className="param-input" style={{ maxWidth: '160px' }} />
                    <span className="font-headline text-2xl text-on-surface-variant italic">g</span>
                  </div>
                  <div className="param-track mt-3"><div className="param-fill" style={{ width: fillDose + '%' }}></div></div>
                </div>
                <div>
                  <label className="flex items-center gap-2 text-sm font-bold text-on-surface mb-4">
                    <span className="material-symbols-outlined text-[18px]">water_drop</span>Water
                  </label>
                  <div className="flex items-baseline gap-2">
                    <input type="number" value={water} min="50" max="600" step="10" onChange={e => setWater(parseFloat(e.target.value) || 310)} className="param-input" style={{ maxWidth: '160px' }} />
                    <span className="font-headline text-2xl text-on-surface-variant italic">g</span>
                  </div>
                  <div className="param-track mt-3"><div className="param-fill" style={{ width: fillWater + '%' }}></div></div>
                </div>
                <div>
                  <label className="flex items-center gap-2 text-sm font-bold text-on-surface mb-4">
                    <span className="material-symbols-outlined text-[18px]">thermostat</span>Temp
                  </label>
                  <div className="flex items-baseline gap-2">
                    <input type="number" value={temp} min="60" max="100" step="1" onChange={e => setTemp(parseFloat(e.target.value) || 94)} className="param-input" style={{ maxWidth: '160px' }} />
                    <span className="font-headline text-2xl text-on-surface-variant italic">°C</span>
                  </div>
                  <div className="param-track mt-3"><div className="param-fill" style={{ width: fillTemp + '%' }}></div></div>
                </div>
                <div>
                  <label className="flex items-center gap-2 text-sm font-bold text-on-surface mb-4">
                    <span className="material-symbols-outlined text-[18px]">balance</span>Ratio
                  </label>
                  <div className="font-headline text-[4.5rem] font-bold leading-none text-primary">{ratio}</div>
                  <p className="text-xs text-on-surface-variant font-medium italic mt-3">Standard golden ratio for high-clarity extractions.</p>
                </div>
              </div>
              {recipeNote && (
                <div className="mt-4 flex items-start gap-2 p-3 bg-surface-container rounded-xl">
                  <span className="material-symbols-outlined text-primary text-[16px] mt-0.5" style={{ fontVariationSettings: "'FILL' 1,'wght' 400,'GRAD' 0,'opsz' 24" }}>auto_awesome</span>
                  <p className="text-xs text-on-surface-variant leading-relaxed italic">{recipeNote}</p>
                </div>
              )}
            </div>
          </div>

          {/* Right: Recipe Summary */}
          <div className="col-span-1 md:col-span-3">
            <div className="brew-gradient text-white p-8 rounded-xl relative overflow-hidden flex flex-col gap-8 min-h-[480px]">
              <div className="absolute -right-20 -top-20 w-64 h-64 bg-tertiary-container/20 rounded-full blur-[80px] pointer-events-none"></div>
              <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary-container to-primary opacity-40 pointer-events-none"></div>
              <div className="relative z-10 space-y-5">
                <p className="text-[10px] font-bold text-on-primary-container uppercase tracking-widest">Recipe Summary</p>
                <div className="space-y-4">
                  <div>
                    <p className="text-[10px] opacity-60 uppercase tracking-wide mb-1">Total Brew Time</p>
                    <p className="font-headline text-xl">{phasesDuration(selectedMethod)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] opacity-60 uppercase tracking-wide mb-1">Grind Size</p>
                    <input value={grind} onChange={e => setGrind(e.target.value)} className="font-headline text-xl bg-transparent border-none focus:ring-0 text-white placeholder:text-white/40 w-full p-0 outline-none" placeholder="e.g. 24 clicks" />
                  </div>
                  <div>
                    <p className="text-[10px] opacity-60 uppercase tracking-wide mb-1">Pour Pattern</p>
                    <p className="font-headline text-xl leading-snug">{method.pattern}</p>
                  </div>
                </div>
              </div>
              <div className="relative z-10 space-y-3 mt-auto">
                <button onClick={startGuidedMode} className="w-full bg-surface-bright text-primary py-4 rounded-md font-bold flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-95 shadow-xl transition-all text-sm uppercase tracking-widest">
                  Enter Guided Mode
                  <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1,'wght' 400,'GRAD' 0,'opsz' 24" }}>play_arrow</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer stats */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-5 md:gap-8 pt-8 border-t border-outline-variant/15">
          {[
            { icon: 'history', label: 'Last brewed', value: lastBrew ? formatDate(lastBrew.date) : 'Never' },
            { icon: 'monitoring', label: 'Est. Extraction', value: `${(estExtraction * 0.9).toFixed(1)}% – ${(estExtraction * 1.1).toFixed(1)}%` },
            { icon: 'inventory_2', label: 'Bean Stock', value: `~${brewsLeft} brews left (${selectedBean?.remainingGrams || 0}g)` },
            { icon: 'star', label: 'My Rating', value: myBeanAvgRating ? `${myBeanAvgRating} / 5 (${beanBrews.length} brew${beanBrews.length !== 1 ? 's' : ''})` : 'No brews yet', fill: true },
          ].map(s => (
            <div key={s.label} className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-surface-container-high flex items-center justify-center text-primary shrink-0">
                <span className="material-symbols-outlined" style={s.fill ? { fontVariationSettings: "'FILL' 1,'wght' 400,'GRAD' 0,'opsz' 24" } : {}}>{s.icon}</span>
              </div>
              <div>
                <p className="text-xs text-on-surface-variant font-medium">{s.label}</p>
                <p className="font-bold text-sm">{s.value}</p>
              </div>
            </div>
          ))}
        </section>
      </div>

      {/* Bean Picker Modal */}
      {showBeanPicker && (
        <div className="fixed inset-0 z-[100]">
          <div className="absolute inset-0 bg-primary/40 backdrop-blur-sm" onClick={() => setShowBeanPicker(false)}></div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-surface-container-lowest rounded-2xl shadow-2xl w-[calc(100vw-2rem)] md:w-[480px] max-h-[80vh] overflow-y-auto">
            <div className="p-6 border-b border-outline-variant/15 flex justify-between items-center">
              <h3 className="font-headline text-xl text-primary">Select Bean</h3>
              <button onClick={() => setShowBeanPicker(false)} className="text-on-surface-variant hover:text-primary transition-colors">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="p-4 space-y-3">
              {beans.map(b => (
                <div key={b.id} onClick={() => pickBean(b.id)} className={`p-4 rounded-xl cursor-pointer hover:bg-surface-container-high transition-colors flex items-center gap-4 ${b.id === selectedBeanId ? 'bg-surface-container-high border border-primary/15' : 'bg-surface-container-low'}`}>
                  <div className="w-10 h-10 rounded-lg bg-surface-container-highest flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1,'wght' 400,'GRAD' 0,'opsz' 24" }}>eco</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-primary truncate">{b.name}</p>
                    <p className="text-xs text-on-surface-variant">{b.process} &bull; {b.remainingGrams}g remaining</p>
                  </div>
                  {b.id === selectedBeanId && <span className="material-symbols-outlined text-primary text-[18px]" style={{ fontVariationSettings: "'FILL' 1,'wght' 400,'GRAD' 0,'opsz' 24" }}>check_circle</span>}
                </div>
              ))}
            </div>
            <div className="p-4 border-t border-outline-variant/15">
              <Link to="/beans" className="flex items-center gap-2 text-xs font-bold text-primary uppercase tracking-widest hover:underline">
                <span className="material-symbols-outlined text-[16px]">add</span>Add New Bean
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Tip FAB */}
      <div className="fixed bottom-20 right-6 md:bottom-10 md:right-10 z-50">
        {showTip && (
          <div className="absolute bottom-16 right-0 bg-surface-container-lowest p-4 rounded-xl shadow-xl border border-outline-variant/15 w-60">
            <p className="text-xs font-bold mb-2 text-primary">Brew Tip</p>
            <p className="text-[11px] text-on-surface-variant leading-relaxed">{getTip()}</p>
          </div>
        )}
        <button onClick={() => setShowTip(v => !v)} className="w-14 h-14 brew-gradient text-white rounded-full shadow-2xl flex items-center justify-center active:scale-90 transition-transform hover:opacity-90">
          <span className="material-symbols-outlined">lightbulb</span>
        </button>
      </div>
    </Layout>
  )
}
