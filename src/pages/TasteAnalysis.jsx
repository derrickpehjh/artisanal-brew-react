import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import Layout from '../components/Layout'
import { suggestGrindAdjustment } from '../lib/aiBrewAssist'

const DEFAULT_TAGS = ['Balanced','Juicy','Bright','Syrupy','Floral','Earthy','Nutty','Chocolate','Citrus','Caramel']

const AI_SUGGESTIONS = [
  { minRating:5, headline:'"A masterclass extraction. Nearly flawless."', body:'Your technique is consistent and the parameters are dialled in. Consider logging this as a saved recipe so you can replicate it precisely.' },
  { minRating:4, tags:['Syrupy','Balanced'], headline:'"The brightness is perfect, but the body could be enhanced."', body:'Based on your tags and rating, try reducing water temperature by 2°C (to {temp-2}°C) and extending the bloom phase by 10 seconds. This will unlock deeper caramel notes without sacrificing juicy acidity.' },
  { minRating:4, headline:'"Solid extraction — small refinements will elevate this."', body:'Your ratio and time look well-calibrated. Try a slightly coarser grind on the next session to open up more sweetness and reduce any astringency.' },
  { minRating:3, tags:['Sour','Bright'], headline:'"Signs of under-extraction. The acidity is excessive."', body:'A sour, bright cup at this rating usually indicates under-extraction. Try grinding finer by 1–2 clicks and maintain a slower, more even pour rate during the bloom phase.' },
  { minRating:3, headline:'"Average cup — worth investigating the variables."', body:'Check your water temperature consistency and grind evenness. A mid-range result often comes from one variable being slightly off. Brew again with the same recipe to isolate the issue.' },
  { minRating:1, headline:'"This one missed the mark — let\'s troubleshoot."', body:'A low rating often comes from significant extraction issues. Review your grind size, water temperature, and pour technique. Consider starting from a baseline recipe for this bean.' },
]

const ROASTERS_NOTES = {
  'V60': 'V60 extractions are sensitive to grind uniformity. Even small inconsistencies in particle size can create channeling during the final drawdown, leading to a thin or bitter finish at the end of the cup.',
  'Chemex': 'The thick Chemex filter removes most oils and fine particles, producing exceptional clarity. If you detect any muddy flavours, check for tears or improper seating of the filter.',
  'AeroPress': 'Aeropress gives you enormous flexibility. Your steep time and press speed are the two biggest levers — a longer steep with a slower press produces a more complex, sweeter cup.',
  'French Press': 'French Press cups often develop a bitterness from 4+ minutes of steep. If you notice harsh finish notes, try a slightly coarser grind and pour off immediately after pressing.',
}

const SAVE_TIMEOUT_MS = 15000

function withTimeout(promise, timeoutMs, errorMessage) {
  let timer
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
    }),
  ]).finally(() => clearTimeout(timer))
}

export default function TasteAnalysis() {
  const { beans, getPendingBrew, setPendingBrew, clearPendingBrew, saveBrew, getActiveBean, formatRatio } = useApp()
  const navigate = useNavigate()

  const brew = getPendingBrew()
  const bean = brew ? (beans.find(b => b.id === brew.beanId) || getActiveBean()) : getActiveBean()

  const [rating, setRating] = useState(4)
  const [tags, setTags] = useState(new Set(brew?.tasteTags || []))
  const [availTags, setAvailTags] = useState(() => {
    try {
      const custom = JSON.parse(localStorage.getItem('artisanal_custom_tags') || '[]')
      return [...DEFAULT_TAGS, ...custom.filter(t => !DEFAULT_TAGS.includes(t))]
    } catch { return [...DEFAULT_TAGS] }
  })
  const [customTagInput, setCustomTagInput] = useState('')
  const [showCustomTagInput, setShowCustomTagInput] = useState(false)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const [grindSuggestion, setGrindSuggestion] = useState(null)
  const [loadingSuggestion, setLoadingSuggestion] = useState(false)

  function toggleTag(tag) {
    setTags(prev => {
      const next = new Set(prev)
      next.has(tag) ? next.delete(tag) : next.add(tag)
      return next
    })
  }

  function submitCustomTag() {
    const t = customTagInput.trim()
    if (!t) return
    if (!availTags.includes(t)) {
      try {
        const stored = JSON.parse(localStorage.getItem('artisanal_custom_tags') || '[]')
        localStorage.setItem('artisanal_custom_tags', JSON.stringify([...stored, t]))
      } catch {}
      setAvailTags(prev => [...prev, t])
    }
    setTags(prev => new Set([...prev, t]))
    setCustomTagInput('')
    setShowCustomTagInput(false)
  }

  function getAI() {
    const temp = brew?.temp || 94
    const suggestion = AI_SUGGESTIONS.find(s => rating >= s.minRating && (!s.tags || s.tags.some(t => tags.has(t)))) || AI_SUGGESTIONS[AI_SUGGESTIONS.length-1]
    return { ...suggestion, body: suggestion.body.replace('{temp-2}', temp-2) }
  }

  function getRoastersNotes() { return ROASTERS_NOTES[brew?.method || 'V60'] || ROASTERS_NOTES['V60'] }

  function getScores() {
    const dose = brew?.dose || 18, water = brew?.water || 300
    const acidity = Math.min(5, Math.max(1, 6 - rating + (tags.has('Bright') || tags.has('Sour') ? 1 : 0)))
    const body = Math.min(5, Math.max(1, rating - (tags.has('Thin') ? 1 : 0) + (tags.has('Syrupy') || tags.has('Rich Body') ? 1 : 0)))
    const complexity = Math.round((rating + (tags.size > 3 ? 1 : 0)) / 2 * 10) / 10
    const finish = Math.round(((rating + body) / 2) * 10) / 10
    return { acidity, body, complexity, finish }
  }

  async function handleSave() {
    if (!brew && !confirm('No active brew session. Save a demo entry?')) return
    setSaving(true)
    setSaveError(null)
    const entry = {
      ...(brew || {
        beanId: bean?.id, beanName: bean?.name,
        method: 'V60', dose: 18.5, water: 296, temp: 94,
        ratio: '1:16', grindSize: '24 clicks', brewTime: '3:15', extraction: 22.1,
      }),
      rating, tasteTags: Array.from(tags), notes: notes.trim() || 'No notes recorded.',
    }
    try {
      await withTimeout(
        saveBrew(entry),
        SAVE_TIMEOUT_MS,
        'Save request timed out. Please try again.'
      )
      setSaved(true)
      setLoadingSuggestion(true)
      try {
        const result = await suggestGrindAdjustment({
          method: entry.method,
          grindSize: entry.grindSize,
          dose: entry.dose,
          water: entry.water,
          temp: entry.temp,
          rating: entry.rating,
          tasteTags: entry.tasteTags,
          extraction: entry.extraction,
        })
        setGrindSuggestion(result)
      } catch {
        setGrindSuggestion(null)
      } finally {
        setLoadingSuggestion(false)
      }
    } catch (err) {
      setSaveError(err?.message || 'Failed to save brew. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  function discard() {
    if (confirm('Discard this brew session? It will not be saved.')) {
      clearPendingBrew()
      navigate('/')
    }
  }

  function applyToNext() {
    if (!brew) { navigate('/brew-setup'); return }
    const updated = { ...brew }
    if (rating <= 3 && (tags.has('Sour') || tags.has('Bright'))) updated.temp = Math.max(85, brew.temp - 2)
    setPendingBrew(updated)
    navigate('/brew-setup')
  }

  function shareBrewLog() {
    const beanName = brew?.beanName || bean?.name
    const method = brew?.method || 'V60'
    const text = `☕ Brew Log — ${beanName} (${method})\nRating: ${rating}/5\nTags: ${[...tags].join(', ') || 'None'}\nNotes: ${notes.trim() || 'None'}`
    if (navigator.share) {
      navigator.share({ title: 'My Brew Log', text }).catch(() => {})
    } else {
      navigator.clipboard.writeText(text).then(() => alert('Brew log copied to clipboard!')).catch(() => alert(text))
    }
  }

  const ai = getAI()
  const scores = getScores()
  const specs = brew ? [
    ['Method', brew.method],
    ['Ratio', brew.ratio || formatRatio(brew.dose, brew.water)],
    ['Grind', brew.grindSize],
    ['TDS Est.', ((brew.dose/brew.water)*100*1.2).toFixed(2)+'%'],
  ] : [['Method','—'],['Ratio','—'],['Grind','—'],['TDS Est.','—']]

  return (
    <Layout>
      <div className="max-w-[1440px] mx-auto px-4 py-6 md:px-10 md:py-10 space-y-10 md:space-y-12">
        {/* Header */}
        <header className="space-y-3">
          <nav className="flex items-center gap-2 text-sm text-on-surface-variant">
            <Link to="/brew-setup" className="hover:text-primary transition-colors">Brewing</Link>
            <span className="material-symbols-outlined text-[14px]">chevron_right</span>
            <span className="text-primary font-bold">Taste Analysis</span>
          </nav>
          <h2 className="font-headline text-4xl font-bold text-primary tracking-tight">Post-Brew Analysis</h2>
          <p className="text-on-surface-variant font-medium">Refine your palate. Record the sensory journey of today's extraction.</p>
        </header>

        {/* Bento grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 md:gap-8">
          {/* Left: Ratings + Tags + Notes */}
          <section className="col-span-1 md:col-span-4 flex flex-col gap-6">
            {/* Cup Rating */}
            <div className="bg-surface-container-lowest p-7 rounded-xl shadow-[0_4px_20px_rgba(62,39,35,0.04)]">
              <h3 className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-6">Overall Satisfaction</h3>
              <div className="flex justify-between items-end gap-1">
                {[1,2,3,4,5].map(s => (
                  <button key={s} onClick={() => setRating(s)} className={`group flex flex-col items-center gap-2 transition-all ${s===rating?'scale-110':'opacity-30 grayscale hover:opacity-100 hover:grayscale-0'}`}>
                    <span className={`material-symbols-outlined text-primary transition-all group-hover:scale-110 ${s===rating?'text-4xl drop-shadow-[0_0_8px_rgba(39,19,16,0.3)]':'text-3xl'}`} style={{fontVariationSettings:`'FILL' ${s<=rating?1:0},'wght' 400,'GRAD' 0,'opsz' 24`}}>coffee</span>
                    <span className={`text-[10px] font-bold ${s===rating?'text-primary':'text-on-surface-variant'}`}>{s}</span>
                  </button>
                ))}
              </div>
              <p className="text-center mt-4 text-xs text-on-surface-variant font-medium">Rating: {rating} / 5</p>
            </div>

            {/* Taste Tags */}
            <div className="bg-surface-container-lowest p-7 rounded-xl shadow-[0_4px_20px_rgba(62,39,35,0.04)]">
              <h3 className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-5">Taste Profile</h3>
              <div className="flex flex-wrap gap-2.5">
                {availTags.map(t => (
                  <button key={t} onClick={() => toggleTag(t)} className={`px-4 py-2 text-xs font-bold rounded-full transition-all active:scale-95 ${tags.has(t)?'tag-active':'tag-inactive hover:bg-surface-container-highest'}`}>{t}</button>
                ))}
                {showCustomTagInput ? (
                  <div className="flex items-center gap-1.5 w-full mt-1">
                    <input
                      autoFocus
                      value={customTagInput}
                      onChange={e => setCustomTagInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') submitCustomTag(); if (e.key === 'Escape') { setShowCustomTagInput(false); setCustomTagInput('') } }}
                      placeholder="e.g. Berry"
                      className="flex-1 bg-surface-container rounded-full px-4 py-2 text-xs text-on-surface outline-none focus:ring-1 focus:ring-primary/30 border-none"
                    />
                    <button onClick={submitCustomTag} className="px-3 py-2 bg-primary text-white text-xs font-bold rounded-full hover:opacity-90 transition-opacity">Add</button>
                    <button onClick={() => { setShowCustomTagInput(false); setCustomTagInput('') }} className="px-3 py-2 bg-surface-container-high text-on-surface-variant text-xs font-bold rounded-full hover:bg-surface-container-highest transition-colors">Cancel</button>
                  </div>
                ) : (
                  <button onClick={() => setShowCustomTagInput(true)} className="px-4 py-2 border border-dashed border-outline-variant text-on-surface-variant text-xs font-bold rounded-full flex items-center gap-1 hover:border-outline hover:text-primary transition-colors">
                    <span className="material-symbols-outlined text-[14px]">add</span>Add Custom
                  </button>
                )}
              </div>
            </div>

            {/* Notes */}
            <div className="bg-surface-container-lowest p-7 rounded-xl shadow-[0_4px_20px_rgba(62,39,35,0.04)]">
              <h3 className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-4">Tasting Notes</h3>
              <textarea rows="4" value={notes} onChange={e=>setNotes(e.target.value)} className="w-full bg-surface-container-low rounded-lg p-3 text-sm text-on-surface resize-none border-none focus:ring-1 focus:ring-primary/30 outline-none placeholder:text-on-surface-variant/50 italic" placeholder="Describe the flavour, body, finish..." />
            </div>
          </section>

          {/* Center: AI Sommelier */}
          <section className="col-span-1 md:col-span-5">
            <div className="relative h-full min-h-[560px] rounded-xl overflow-hidden bg-primary-container shadow-2xl">
              <img src="https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800&q=80" alt="Coffee steam" className="absolute inset-0 w-full h-full object-cover opacity-30 mix-blend-overlay"/>
              <div className="absolute inset-0 bg-gradient-to-t from-primary via-primary/70 to-transparent"></div>
              <div className="relative h-full flex flex-col justify-end p-9">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-11 h-11 rounded-full bg-tertiary flex items-center justify-center">
                    <span className="material-symbols-outlined text-tertiary-fixed text-[20px]" style={{fontVariationSettings:"'FILL' 1,'wght' 400,'GRAD' 0,'opsz' 24"}}>auto_awesome</span>
                  </div>
                  <div>
                    <h4 className="font-headline text-lg text-white">AI Sommelier</h4>
                    <p className="text-xs text-on-primary-container">Predictive Brewing Tip</p>
                  </div>
                </div>
                <h3 className="font-headline text-2xl leading-snug text-white mb-5">{ai.headline}</h3>
                <p className="text-white/75 text-sm leading-relaxed mb-7">{ai.body}</p>
                <button onClick={applyToNext} className="w-full py-4 bg-white text-primary font-bold rounded-md hover:bg-surface-bright transition-colors text-xs uppercase tracking-widest">
                  Apply to Next Brew
                </button>
              </div>
            </div>
          </section>

          {/* Right: Today's Roast + Actions */}
          <section className="col-span-1 md:col-span-3 flex flex-col gap-6">
            <div className="bg-surface-container-lowest p-7 rounded-xl shadow-[0_4px_20px_rgba(62,39,35,0.04)]">
              <h3 className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-5">Today's Roast</h3>
              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 rounded-lg overflow-hidden shrink-0 bg-surface-container flex items-center justify-center">
                  <span className="material-symbols-outlined text-primary text-3xl" style={{fontVariationSettings:"'FILL' 1,'wght' 400,'GRAD' 0,'opsz' 24"}}>eco</span>
                </div>
                <div>
                  <p className="font-bold text-primary text-sm leading-tight">{brew?.beanName || bean?.name}</p>
                  <p className="text-xs text-on-surface-variant font-medium mt-1">{(bean?.process||'')} &bull; {(bean?.roastLevel||'')}</p>
                </div>
              </div>
              <div>
                {specs.map(([l,v],i) => (
                  <div key={l} className={`flex justify-between items-center py-2.5 ${i<specs.length-1?'border-b border-outline-variant/10':''}`}>
                    <span className="text-xs font-medium text-on-surface-variant">{l}</span>
                    <span className="text-xs font-bold text-primary">{v}</span>
                  </div>
                ))}
              </div>
            </div>
            {!saving && saved ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-tertiary">
                  <span className="material-symbols-outlined text-[18px]" style={{fontVariationSettings:"'FILL' 1,'wght' 400,'GRAD' 0,'opsz' 24"}}>check_circle</span>
                  <span className="text-xs font-bold uppercase tracking-widest">Brew saved</span>
                </div>
                {loadingSuggestion ? (
                  <div className="bg-surface-container rounded-xl p-4 flex items-center gap-3">
                    <span className="material-symbols-outlined text-primary animate-spin text-[18px]">progress_activity</span>
                    <span className="text-xs text-on-surface-variant font-medium">Getting AI grind tip…</span>
                  </div>
                ) : grindSuggestion ? (
                  <div className="bg-surface-container rounded-xl p-4 space-y-2">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="material-symbols-outlined text-[16px]" style={{fontVariationSettings:"'FILL' 1,'wght' 400,'GRAD' 0,'opsz' 24"}}>auto_awesome</span>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">AI Grind Tip</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`material-symbols-outlined text-xl ${grindSuggestion.direction === 'finer' ? 'text-tertiary' : grindSuggestion.direction === 'coarser' ? 'text-amber-700' : 'text-primary'}`} style={{fontVariationSettings:"'FILL' 1,'wght' 400,'GRAD' 0,'opsz' 24"}}>
                        {grindSuggestion.direction === 'finer' ? 'arrow_upward' : grindSuggestion.direction === 'coarser' ? 'arrow_downward' : 'check'}
                      </span>
                      <span className="font-bold text-sm text-primary">{grindSuggestion.amount}</span>
                    </div>
                    <p className="text-xs text-on-surface-variant leading-relaxed">{grindSuggestion.reasoning}</p>
                    <p className="text-xs text-primary font-medium border-t border-outline-variant/20 pt-2">{grindSuggestion.tip}</p>
                  </div>
                ) : null}
                <button onClick={() => navigate('/brew-setup')} className="w-full brew-gradient text-white py-4 rounded-md font-bold text-xs uppercase tracking-widest hover:opacity-90 transition-all">
                  Start Next Brew
                </button>
                <button onClick={() => navigate('/')} className="w-full bg-surface-container-high text-on-surface-variant py-3 rounded-md font-bold text-xs uppercase tracking-widest hover:bg-surface-container-highest transition-colors">
                  Back to Dashboard
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {saveError && (
                  <div className="bg-error-container/30 border border-error/20 rounded-lg px-4 py-3 text-xs text-error font-medium leading-snug">
                    {saveError}
                  </div>
                )}
                <button onClick={handleSave} disabled={saving} className="w-full brew-gradient text-white py-5 rounded-md font-bold text-xs uppercase tracking-widest shadow-lg hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-60">
                  {saving
                    ? <span className="inline-flex items-center gap-1.5"><span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>Saving…</span>
                    : 'Save to History'}
                </button>
                <button onClick={discard} className="w-full bg-surface-container-high text-primary py-5 rounded-md font-bold text-xs uppercase tracking-widest hover:bg-surface-container-highest transition-colors">
                  Discard Session
                </button>
                <button onClick={shareBrewLog} className="pt-3 flex items-center gap-2 text-on-surface-variant hover:text-primary transition-colors w-full">
                  <span className="material-symbols-outlined text-[18px]">share</span>
                  <span className="text-[10px] font-bold uppercase tracking-widest">Share Brew Log</span>
                </button>
              </div>
            )}
          </section>
        </div>

        {/* Deep analysis */}
        <section className="space-y-6">
          <h3 className="font-headline text-2xl font-bold text-primary border-l-4 border-primary-container pl-5">Deep Extraction Analysis</h3>
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 md:gap-8 items-start">
            <div className="col-span-1 md:col-span-7 bg-surface-container-low p-6 md:p-9 rounded-xl">
              <h4 className="font-headline text-lg mb-4 italic text-primary">The Roaster's Notes</h4>
              <p className="text-on-surface-variant leading-relaxed text-sm mb-6">{getRoastersNotes()}</p>
              <button onClick={() => document.querySelector('textarea')?.focus()} className="flex items-center gap-3 group">
                <div className="w-9 h-9 bg-primary-container rounded-full flex items-center justify-center text-white group-hover:scale-110 transition-transform">
                  <span className="material-symbols-outlined text-[16px]">edit_note</span>
                </div>
                <span className="text-xs font-bold text-primary uppercase tracking-widest">Add personal tasting notes…</span>
              </button>
            </div>
            <div className="col-span-1 md:col-span-5 grid grid-cols-2 gap-4">
              {[
                ['Acidity', scores.acidity.toFixed(1), 'border-tertiary', 'text-tertiary'],
                ['Body', scores.body.toFixed(1), 'border-primary-container', 'text-primary'],
                ['Complexity', scores.complexity.toFixed(1), 'border-outline', 'text-on-surface-variant'],
                ['Finish', scores.finish.toFixed(1), 'border-primary', 'text-primary'],
              ].map(([l,v,border,color]) => (
                <div key={l} className={`bg-surface-container-lowest p-6 rounded-xl text-center border-b-2 ${border} shadow-[0_4px_20px_rgba(62,39,35,0.04)]`}>
                  <p className="text-[10px] font-bold text-on-surface-variant uppercase mb-2">{l}</p>
                  <p className={`font-headline text-4xl font-bold ${color}`}>{v}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </Layout>
  )
}
