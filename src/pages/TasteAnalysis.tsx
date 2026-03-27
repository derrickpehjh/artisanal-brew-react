import { useState, useEffect, useCallback } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import Layout from '../components/Layout'
import { suggestGrindAdjustment, getBrewAnalysis } from '../lib/aiBrewAssist'
import RatingPanel from '../components/taste/RatingPanel'
import TasteTagPanel from '../components/taste/TasteTagPanel'
import AISommelierCard from '../components/taste/AISommelierCard'
import GrindSuggestionCard from '../components/taste/GrindSuggestionCard'
import type { BrewAnalysis, GrindSuggestion } from '../types/ai'

const DEFAULT_TAGS = ['Balanced', 'Juicy', 'Bright', 'Syrupy', 'Floral', 'Earthy', 'Nutty', 'Chocolate', 'Citrus', 'Caramel']

const SAVE_TIMEOUT_MS = 15000

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, errorMessage: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
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
  const [tags, setTags] = useState<Set<string>>(new Set(brew?.tasteTags || []))
  const [availTags, setAvailTags] = useState<string[]>(() => {
    try {
      const custom = JSON.parse(localStorage.getItem('artisanal_custom_tags') || '[]') as string[]
      return [...DEFAULT_TAGS, ...custom.filter(t => !DEFAULT_TAGS.includes(t))]
    } catch { return [...DEFAULT_TAGS] }
  })
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [grindSuggestion, setGrindSuggestion] = useState<GrindSuggestion | null>(null)
  const [loadingSuggestion, setLoadingSuggestion] = useState(false)
  const [brewAnalysis, setBrewAnalysis] = useState<BrewAnalysis | null>(null)
  const [loadingAnalysis, setLoadingAnalysis] = useState(true)

  const runBrewAnalysis = useCallback((currentRating: number, currentTags: Set<string>) => {
    setLoadingAnalysis(true)
    getBrewAnalysis({
      method: brew?.method || 'V60',
      dose: brew?.dose || 18,
      water: brew?.water || 300,
      temp: brew?.temp || 94,
      ratio: brew?.ratio,
      grindSize: brew?.grindSize,
      extraction: brew?.extraction,
      rating: currentRating,
      tasteTags: Array.from(currentTags),
      beanName: brew?.beanName || bean?.name,
      beanOrigin: bean?.origin,
      beanProcess: bean?.process,
      beanRoastLevel: bean?.roastLevel,
    })
      .then(result => setBrewAnalysis(result))
      .catch(() => {})
      .finally(() => setLoadingAnalysis(false))
  }, [brew, bean])

  useEffect(() => {
    const timer = setTimeout(() => runBrewAnalysis(rating, tags), 600)
    return () => clearTimeout(timer)
  }, [rating, tags, runBrewAnalysis])

  function toggleTag(tag: string) {
    setTags(prev => {
      const next = new Set(prev)
      next.has(tag) ? next.delete(tag) : next.add(tag)
      return next
    })
  }

  function addCustomTag(tag: string) {
    if (!availTags.includes(tag)) {
      try {
        const stored = JSON.parse(localStorage.getItem('artisanal_custom_tags') || '[]') as string[]
        localStorage.setItem('artisanal_custom_tags', JSON.stringify([...stored, tag]))
      } catch {}
      setAvailTags(prev => [...prev, tag])
    }
    setTags(prev => new Set([...prev, tag]))
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
          method: entry.method ?? 'V60',
          grindSize: entry.grindSize ?? '24 clicks',
          dose: entry.dose ?? 18,
          water: entry.water ?? 300,
          temp: entry.temp ?? 94,
          rating: entry.rating ?? 3,
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
      setSaveError((err as Error)?.message || 'Failed to save brew. Please try again.')
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
    if (rating <= 3 && (tags.has('Sour') || tags.has('Bright'))) updated.temp = Math.max(85, (brew.temp ?? 94) - 2)
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

  const specs: [string, string][] = brew ? [
    ['Method', brew.method ?? '—'],
    ['Ratio', brew.ratio || formatRatio(brew.dose ?? 18, brew.water ?? 300)],
    ['Grind', brew.grindSize ?? '—'],
    ['Extraction Est.', (((brew.water ?? 300) / (brew.dose ?? 18)) * 1.2).toFixed(1) + '%'],
  ] : [['Method', '—'], ['Ratio', '—'], ['Grind', '—'], ['TDS Est.', '—']]

  return (
    <Layout>
      <div className="max-w-[1440px] mx-auto px-4 py-6 md:px-10 md:py-10 space-y-10 md:space-y-12">
        <header className="space-y-3">
          <nav className="flex items-center gap-2 text-sm text-on-surface-variant">
            <Link to="/brew-setup" className="hover:text-primary transition-colors">Brewing</Link>
            <span className="material-symbols-outlined text-[14px]">chevron_right</span>
            <span className="text-primary font-bold">Taste Analysis</span>
          </nav>
          <h2 className="font-headline text-4xl font-bold text-primary tracking-tight">Post-Brew Analysis</h2>
          <p className="text-on-surface-variant font-medium">Refine your palate. Record the sensory journey of today's extraction.</p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 md:gap-8">
          {/* Left: Rating + Tags + Notes */}
          <section className="col-span-1 md:col-span-4 flex flex-col gap-6">
            <RatingPanel rating={rating} onRatingChange={setRating} />
            <TasteTagPanel
              tags={tags}
              availTags={availTags}
              notes={notes}
              onToggleTag={toggleTag}
              onAddCustomTag={addCustomTag}
              onNotesChange={setNotes}
            />
          </section>

          {/* Center: AI Sommelier */}
          <section className="col-span-1 md:col-span-5">
            <AISommelierCard
              brewAnalysis={brewAnalysis}
              loadingAnalysis={loadingAnalysis}
              onRefresh={() => runBrewAnalysis(rating, tags)}
              onApplyToNext={applyToNext}
            />
          </section>

          {/* Right: Today's Roast + Actions */}
          <section className="col-span-1 md:col-span-3 flex flex-col gap-6">
            <div className="bg-surface-container-lowest p-7 rounded-xl shadow-[0_4px_20px_rgba(62,39,35,0.04)]">
              <h3 className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-5">Today's Roast</h3>
              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 rounded-lg overflow-hidden shrink-0 bg-surface-container flex items-center justify-center">
                  <span className="material-symbols-outlined text-primary text-3xl" style={{ fontVariationSettings: "'FILL' 1,'wght' 400,'GRAD' 0,'opsz' 24" }}>eco</span>
                </div>
                <div>
                  <p className="font-bold text-primary text-sm leading-tight">{brew?.beanName || bean?.name}</p>
                  <p className="text-xs text-on-surface-variant font-medium mt-1">{bean?.process || ''} &bull; {bean?.roastLevel || ''}</p>
                </div>
              </div>
              <div>
                {specs.map(([l, v], i) => (
                  <div key={l} className={`flex justify-between items-center py-2.5 ${i < specs.length - 1 ? 'border-b border-outline-variant/10' : ''}`}>
                    <span className="text-xs font-medium text-on-surface-variant">{l}</span>
                    <span className="text-xs font-bold text-primary">{v}</span>
                  </div>
                ))}
              </div>
            </div>

            {!saving && saved ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-tertiary">
                  <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1,'wght' 400,'GRAD' 0,'opsz' 24" }}>check_circle</span>
                  <span className="text-xs font-bold uppercase tracking-widest">Brew saved</span>
                </div>
                <GrindSuggestionCard loadingSuggestion={loadingSuggestion} grindSuggestion={grindSuggestion} />
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

        {/* Deep Extraction Analysis */}
        <section className="space-y-6">
          <h3 className="font-headline text-2xl font-bold text-primary border-l-4 border-primary-container pl-5">Deep Extraction Analysis</h3>
          <div className="bg-surface-container-low p-6 md:p-9 rounded-xl">
            <div className="flex items-center gap-3 mb-4">
              <h4 className="font-headline text-lg italic text-primary">Extraction Analysis</h4>
            </div>
            {loadingAnalysis ? (
              <div className="space-y-2 mb-6">
                <div className="h-4 bg-surface-container rounded animate-pulse w-full"></div>
                <div className="h-4 bg-surface-container rounded animate-pulse w-5/6"></div>
                <div className="h-4 bg-surface-container rounded animate-pulse w-4/5"></div>
              </div>
            ) : (
              <p className="text-on-surface-variant leading-relaxed text-sm mb-6">
                {brewAnalysis?.extractionNote || 'No extraction analysis available.'}
              </p>
            )}
            <button onClick={() => (document.querySelector('textarea') as HTMLTextAreaElement | null)?.focus()} className="flex items-center gap-3 group">
              <div className="w-9 h-9 bg-primary-container rounded-full flex items-center justify-center text-white group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined text-[16px]">edit_note</span>
              </div>
              <span className="text-xs font-bold text-primary uppercase tracking-widest">Add personal tasting notes…</span>
            </button>
          </div>
        </section>
      </div>
    </Layout>
  )
}
