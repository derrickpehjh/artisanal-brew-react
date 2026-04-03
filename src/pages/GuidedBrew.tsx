import { useState, useEffect, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import ConfirmModal from '../components/ui/ConfirmModal'
import Sidebar from '../components/Sidebar'
import { parseBrewTime, scalePhasesToDuration } from '../lib/brewUtils'
import type { BrewPhase } from '../types/brew'

// Extended tips shown in the phase info sheet
const PHASE_TIPS: Record<string, { why: string; tip: string }> = {
  'Bloom Pour': {
    why: 'Fresh coffee releases trapped CO₂. Pre-wetting forces this gas out before the main extraction so water can flow evenly through the entire bed without channelling.',
    tip: 'Use 2–3× the dose weight (e.g. 45–55g for 18g dose). Pour in a slow spiral from centre outward — every ground must be saturated.',
  },
  'Bloom & Stir': {
    why: 'The AeroPress is forgiving, but a quick stir during the bloom ensures no dry pockets of coffee remain, giving you even saturation before the main steep.',
    tip: 'Stir 3–5 times aggressively. You should see all the grounds darken and absorb water within the first 10 seconds.',
  },
  'Bloom Rest': {
    why: 'Rushing past the degas phase introduces CO₂ bubbles into the extraction, which creates uneven flow paths and a thinner, less nuanced cup.',
    tip: 'Watch the surface — vigorous bubbling means the beans are fresh (roasted within 2–3 weeks). Wait until activity slows before pouring.',
  },
  'First Pour': {
    why: 'The first main pour builds extraction momentum. A steady, controlled pour maintains even saturation and avoids agitating the bed, which can cause channelling.',
    tip: 'Keep the stream thin and low. Concentric circles from inside out — never break the surface with a heavy stream.',
  },
  'Second Pour': {
    why: 'The second pour finishes the extraction and washes the remaining solubles through the bed uniformly.',
    tip: 'Match your pour rate to your first pour. Maintain the same rhythm — consistency in rate matters more than speed.',
  },
  'Final Pour': {
    why: 'A high pour on the Chemex increases turbulence in the final phase, which brightens the cup and improves clarity.',
    tip: 'Raise the kettle slightly higher than usual for this pour to introduce gentle agitation without over-disturbing the bed.',
  },
  'Fill': {
    why: 'Filling to the target weight completes the water addition. For immersion methods, the key is ensuring no dry grounds remain on the walls.',
    tip: 'For French Press and AeroPress, give the sides a quick scrape with a spoon after filling to wash down any stray grounds.',
  },
  'Steep': {
    why: 'Immersion steeping gives even, diffusion-based extraction — the longer the steep, the higher the extraction yield.',
    tip: 'Do not stir. Breaking the crust during steeping accelerates extraction unevenly. Stay hands-off.',
  },
  'Draw Down': {
    why: 'The draw down is where the last solubles drain through the bed. The speed of drain indicates grind size — too fast means coarse, too slow means fine.',
    tip: 'A clean, flat coffee bed at the end (no craters) means the extraction was even. A dip in the centre suggests channelling.',
  },
  'Press': {
    why: 'Pressing too hard extracts harsh, bitter compounds from the puck. Pressing too fast forces fines through the filter.',
    tip: 'Apply about 500g of force — roughly the weight of a full water bottle on the plunger. Stop as soon as you hear the hiss.',
  },
  'Press & Pour': {
    why: 'Leaving a plunged French Press sitting means the grounds continue to extract even after pressing, which adds bitterness over time.',
    tip: 'Press and pour in one motion. Decant everything into a serving vessel immediately to stop extraction.',
  },
}

function getPhaseTip(phase: BrewPhase): { why: string; tip: string } | null {
  if (PHASE_TIPS[phase.name]) return PHASE_TIPS[phase.name]
  // Fallback by icon type
  if (phase.icon === 'hourglass_top' || phase.icon === 'hourglass_bottom')
    return { why: 'Waiting allows the coffee to fully saturate and degas before the next pour.', tip: 'Keep the timer running and resist the urge to disturb the bed.' }
  if (phase.icon === 'water_drop' && phase.targetWater > 0)
    return { why: 'Controlled water addition is the foundation of even extraction.', tip: 'Pour in slow, deliberate concentric circles from the centre outward.' }
  if (phase.icon === 'compress')
    return { why: 'The press phase separates the liquid from the grounds.', tip: 'Apply slow, even pressure and stop before forcing the puck dry.' }
  return null
}

export default function GuidedBrew() {
  const { getPendingBrew, setPendingBrew, getPhases, formatTime, signOut, user } = useApp()
  const navigate = useNavigate()
  const brew = getPendingBrew()

  // Use custom phases from BrewSetup if provided, otherwise derive from method + water
  const rawPhases: BrewPhase[] = brew
    ? (brew.customPhases?.length ? brew.customPhases : getPhases(brew.method ?? 'V60', brew.water))
    : []
  const configuredSecs = brew?.brewTime ? parseBrewTime(brew.brewTime) : 0
  const phases: BrewPhase[] = configuredSecs > 0 ? scalePhasesToDuration(rawPhases, configuredSecs) : rawPhases

  const [currentPhase, setCurrentPhase] = useState(0)
  const [totalSecs, setTotalSecs] = useState(0)
  const [phaseSecs, setPhaseSecs] = useState(0)
  const [running, setRunning] = useState(true)
  const [menuOpen, setMenuOpen] = useState(false)
  const [showExitConfirm, setShowExitConfirm] = useState(false)
  const [showParamsModal, setShowParamsModal] = useState(false)
  const [showPhaseInfo, setShowPhaseInfo] = useState(false)

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const totalSecsRef = useRef(0)
  const phaseSecsRef = useRef(0)
  const runningRef = useRef(true)
  const currentPhaseRef = useRef(0)

  const meta = (user?.user_metadata || {}) as Record<string, string>
  const avatarUrl = meta['avatar_url'] || meta['picture']

  useEffect(() => {
    if (!brew) {
      navigate('/brew-setup')
      return
    }
    intervalRef.current = setInterval(() => {
      if (!runningRef.current) return
      totalSecsRef.current++
      phaseSecsRef.current++
      setTotalSecs(totalSecsRef.current)
      setPhaseSecs(phaseSecsRef.current)

      const ph = phases[currentPhaseRef.current]
      if (ph && phaseSecsRef.current >= ph.duration) {
        if (currentPhaseRef.current < phases.length - 1) {
          currentPhaseRef.current++
          setCurrentPhase(currentPhaseRef.current)
          phaseSecsRef.current = 0
          setPhaseSecs(0)
        } else {
          clearInterval(intervalRef.current!)
          finishBrew()
        }
      }
    }, 1000)
    return () => clearInterval(intervalRef.current!)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function finishBrew() {
    const pending = getPendingBrew()
    if (pending) {
      pending.brewTime = formatTime(totalSecsRef.current)
      setPendingBrew(pending)
    }
    navigate('/taste-analysis')
  }

  function togglePause() {
    runningRef.current = !runningRef.current
    setRunning(runningRef.current)
  }

  function nextPhase() {
    if (currentPhaseRef.current < phases.length - 1) {
      currentPhaseRef.current++
      setCurrentPhase(currentPhaseRef.current)
      phaseSecsRef.current = 0
      setPhaseSecs(0)
    } else {
      clearInterval(intervalRef.current!)
      finishBrew()
    }
  }

  function restartPhase() {
    phaseSecsRef.current = 0
    setPhaseSecs(0)
  }

  function exitBrew() {
    setShowExitConfirm(true)
  }

  function showBrewSettings() {
    setShowParamsModal(true)
  }

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  if (!brew || !phases.length) return null

  const ph = phases[currentPhase]
  const nextPh = phases[currentPhase + 1]
  const phaseTip = getPhaseTip(ph)
  const phasePct = ph.duration > 0 ? Math.min((phaseSecs / ph.duration) * 100, 100) : 100
  const arcOffset = 653.5 * (1 - phasePct / 100)

  const prevCumulative = currentPhase > 0
    ? [...phases].slice(0, currentPhase).reverse().find(p => p.targetWater > 0)?.targetWater || 0
    : 0
  const phaseIncrement = ph.targetWater - prevCumulative
  const poured = ph.targetWater > 0
    ? prevCumulative + Math.round((phaseSecs / ph.duration) * phaseIncrement)
    : prevCumulative
  const pouredClamped = Math.min(poured, ph.targetWater || prevCumulative)
  const weightBarPct = Math.min((pouredClamped / (brew.water || 300)) * 100, 100)

  const totalDuration = phases.reduce((s, p) => s + p.duration, 0)
  const timeRemaining = Math.max(0, totalDuration - totalSecs)

  return (
    <>
    <div className="bg-background text-on-background overflow-hidden">
      {/* Sidebar */}
      <Sidebar showCta={false} />

      {/* Top Bar */}
      <header className="fixed top-0 right-0 left-0 md:left-64 h-16 z-40 glass-panel shadow-[0_12px_40px_rgba(62,39,35,0.08)]">
        <div className="flex justify-between items-center px-4 md:px-12 h-full max-w-[1440px] mx-auto w-full">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1,'wght' 400,'GRAD' 0,'opsz' 24" }}>timer</span>
            <span className="font-headline font-bold text-primary text-base tracking-tight">Guided Brew Mode</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex gap-2">
              {phases.map((_, i) => (
                <div key={i} className={`w-2 h-2 rounded-full transition-all duration-300 ${i === currentPhase ? 'bg-primary scale-125' : i < currentPhase ? 'bg-primary/40' : 'bg-outline-variant/40'}`}></div>
              ))}
            </div>
            <span className="text-on-surface-variant/40" aria-label="No new notifications">
              <span className="material-symbols-outlined">notifications</span>
            </span>
            <div className="relative">
              <button onClick={() => setMenuOpen(v => !v)} className="w-8 h-8 rounded-full bg-surface-container-highest flex items-center justify-center border border-outline-variant/15 overflow-hidden hover:ring-2 hover:ring-primary/20 transition-all">
                {avatarUrl ? <img src={avatarUrl} alt="" className="w-full h-full object-cover" /> : <span className="material-symbols-outlined text-on-surface-variant" style={{ fontVariationSettings: "'FILL' 1,'wght' 400,'GRAD' 0,'opsz' 24" }}>account_circle</span>}
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-10 bg-surface-container-lowest rounded-xl shadow-xl border border-outline-variant/15 w-52 py-2 z-50">
                  <div className="px-4 py-3 border-b border-outline-variant/10">
                    <p className="text-xs font-bold text-primary truncate">{meta['full_name'] || meta['name'] || 'Brewer'}</p>
                    <p className="text-[11px] text-on-surface-variant truncate">{user?.email || ''}</p>
                  </div>
                  <Link to="/settings" onClick={() => setMenuOpen(false)} className="flex items-center gap-3 px-4 py-2.5 text-sm text-on-surface-variant hover:text-primary hover:bg-surface-container-high transition-colors">
                    <span className="material-symbols-outlined text-[18px]">manage_accounts</span>Profile &amp; Settings
                  </Link>
                  <button onClick={handleSignOut} className="w-full text-left flex items-center gap-3 px-4 py-2.5 text-sm text-error hover:bg-error-container/30 transition-colors">
                    <span className="material-symbols-outlined text-[18px]">logout</span>Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="ml-0 md:ml-64 pt-16 flex flex-col bg-surface min-h-screen md:h-screen md:overflow-hidden">
        <div className="flex-1 flex flex-col md:flex-row w-full max-w-[1440px] mx-auto md:min-h-0 overflow-y-auto md:overflow-visible">

          {/* Left: Timer & Weight */}
          <section className="flex-1 flex flex-col items-center justify-center border-b md:border-b-0 md:border-r border-outline-variant/15 px-6 md:px-10 py-8">
            <div className="text-center">
              <p className="text-xs uppercase tracking-widest text-on-surface-variant mb-5 font-bold">Total Time</p>
              <div className="timer-display" style={{ fontSize: 'clamp(5rem,10vw,11rem)' }}>{formatTime(totalSecs)}</div>
            </div>
            <div className="mt-14 w-full max-w-xs">
              <div className="flex justify-between items-end mb-4">
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-on-surface-variant mb-1 font-bold">Water Poured</p>
                  <div className="flex items-baseline gap-1">
                    <span className="font-headline text-6xl font-bold text-primary italic leading-none">{pouredClamped}</span>
                    <span className="text-xl text-on-surface-variant not-italic ml-1">g</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[10px] uppercase tracking-widest text-on-surface-variant mb-1 font-bold">Target</p>
                  <div className="flex items-baseline gap-1 justify-end">
                    <span className="font-headline text-3xl font-medium text-on-surface-variant leading-none">{brew.water}</span>
                    <span className="text-sm text-on-surface-variant">g</span>
                  </div>
                </div>
              </div>
              <div className="h-2 w-full bg-surface-container-highest rounded-full overflow-hidden">
                <div className="h-full brew-gradient rounded-full transition-all duration-500" style={{ width: weightBarPct + '%' }}></div>
              </div>
              <div className="flex justify-between mt-2 text-[10px] text-on-surface-variant font-bold">
                <span>{pouredClamped}g poured</span>
                {ph.targetWater > 0 && phaseIncrement > 0
                  ? <span>pour to <span className="text-primary">{ph.targetWater}g</span></span>
                  : phaseIncrement === 0 && ph.targetWater > 0
                    ? <span className="text-on-surface-variant/60">don't pour — wait</span>
                    : <span>{Math.max(0, (brew.water || 300) - pouredClamped)}g remaining</span>
                }
              </div>
            </div>
          </section>

          {/* Center: Phase */}
          <section className="w-full md:w-[420px] shrink-0 flex flex-col items-center justify-center px-6 md:px-10 py-8 bg-surface-container-lowest">
            <div className="relative w-56 h-56 mb-10">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 224 224">
                <circle cx="112" cy="112" r="104" fill="transparent" stroke="#e4e2de" strokeWidth="2"/>
                <circle cx="112" cy="112" r="104" fill="transparent" stroke="#271310" strokeWidth="7" strokeLinecap="round" strokeDasharray="653.5" strokeDashoffset={arcOffset} className="transition-all duration-1000"/>
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="material-symbols-outlined text-primary mb-1" style={{ fontSize: '44px', fontVariationSettings: "'FILL' 1,'wght' 300,'GRAD' 0,'opsz' 48" }}>{ph.icon}</span>
                <p className="font-label font-bold text-base text-primary leading-tight">{ph.name}</p>
                <p className="font-headline italic text-on-surface-variant text-sm">Phase {currentPhase + 1} of {phases.length}</p>
              </div>
            </div>
            <div className="text-center space-y-4 max-w-xs">
              <h2 className="font-headline text-2xl font-bold text-primary leading-tight">{ph.instruction}</h2>
              {phaseTip && (
                <button
                  onClick={() => setShowPhaseInfo(v => !v)}
                  className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-[11px] font-bold uppercase tracking-wider transition-all ${showPhaseInfo ? 'bg-primary text-on-primary shadow-md' : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'}`}
                >
                  <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'FILL' 1,'wght' 400,'GRAD' 0,'opsz' 24" }}>tips_and_updates</span>
                  Why this phase?
                </button>
              )}
              {nextPh && (
                <div className="pt-3">
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-tertiary-fixed rounded-full text-on-tertiary-fixed text-[11px] font-bold uppercase tracking-wider">
                    <span className="material-symbols-outlined text-[14px]">info</span>
                    <span>Next: {nextPh.name}{nextPh.targetWater > ph.targetWater ? ` → ${nextPh.targetWater}g` : ''}</span>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Right: Live Data */}
          <section className="flex-1 flex flex-col justify-center px-6 md:px-10 py-8 space-y-8 md:space-y-10">
            <div className="group border-l-2 border-outline-variant/30 pl-7 hover:border-primary transition-colors duration-200">
              <p className="text-[10px] uppercase tracking-widest text-on-surface-variant mb-2 font-bold">Brew Temp</p>
              <div className="flex items-baseline gap-2">
                <span className="font-headline text-5xl font-bold text-primary leading-none">{brew.temp}</span>
                <span className="font-headline text-xl text-on-surface-variant">°C</span>
              </div>
              <div className="flex items-center gap-1.5 mt-2 text-tertiary font-bold text-xs">
                <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'FILL' 1,'wght' 400,'GRAD' 0,'opsz' 24" }}>check_circle</span>
                Optimal Range
              </div>
            </div>
            <div className="group border-l-2 border-outline-variant/30 pl-7 hover:border-primary transition-colors duration-200">
              <p className="text-[10px] uppercase tracking-widest text-on-surface-variant mb-2 font-bold">Phase Timer</p>
              <div className="flex items-baseline gap-2">
                <span className="font-headline text-5xl font-bold text-primary leading-none">{formatTime(phaseSecs)}</span>
              </div>
              <div className="mt-4 h-1.5 w-full bg-surface-container-highest rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full transition-all duration-1000" style={{ width: phasePct + '%' }}></div>
              </div>
            </div>
            <div className="p-5 bg-surface-container-low rounded-xl">
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 flex items-center justify-center bg-surface-container-lowest rounded-lg border border-outline-variant/15 shrink-0">
                  <span className="material-symbols-outlined text-primary text-[20px]">settings_input_component</span>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-on-surface-variant font-bold mb-0.5">Grind Reference</p>
                  <p className="font-headline font-bold text-primary text-sm">Setting: {brew.grindSize}</p>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Bottom Bar */}
        <footer className="shrink-0 bg-surface-container-lowest flex items-center justify-between px-4 md:px-12 py-3 md:py-0 md:h-24 shadow-[0_-12px_40px_rgba(62,39,35,0.05)] gap-2 md:gap-0">
          <div className="flex items-center gap-3 md:gap-4">
            <button onClick={exitBrew} className="w-11 h-11 flex items-center justify-center rounded-full bg-surface-container-high text-on-surface hover:bg-surface-container-highest transition-colors active:scale-95">
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
            <div className="h-7 w-px bg-outline-variant/25 hidden md:block"></div>
            <div className="hidden md:flex flex-col">
              <span className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold mb-0.5">Recipe</span>
              <span className="font-headline font-bold text-primary italic text-sm">{brew.beanName} {brew.method}</span>
            </div>
          </div>
          <div className="flex items-center gap-3 md:gap-8">
            <button onClick={restartPhase} className="hidden md:flex items-center gap-2 text-sm font-bold text-on-surface-variant hover:text-primary transition-colors">
              <span className="material-symbols-outlined text-[18px]">replay</span>
              <span className="uppercase tracking-widest text-[11px]">Restart Phase</span>
            </button>
            <button onClick={restartPhase} className="md:hidden w-11 h-11 flex items-center justify-center rounded-full bg-surface-container-high text-on-surface-variant hover:text-primary transition-colors active:scale-95">
              <span className="material-symbols-outlined text-[20px]">replay</span>
            </button>
            <div className="flex items-center gap-2 md:gap-3">
              <button onClick={togglePause} className="w-12 h-12 md:w-14 md:h-14 flex items-center justify-center rounded-full bg-surface-container-high text-primary hover:bg-surface-container-highest transition-all active:scale-95">
                <span className="material-symbols-outlined text-[24px] md:text-[28px]">{running ? 'pause' : 'play_arrow'}</span>
              </button>
              <button onClick={nextPhase} className="brew-gradient text-white px-4 md:px-7 h-12 md:h-14 flex items-center gap-2 rounded-full font-bold tracking-widest uppercase text-xs hover:opacity-90 transition-all shadow-lg active:scale-[0.98]">
                <span className="hidden sm:inline">Skip to Next</span>
                <span className="sm:hidden">Skip</span>
                <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1,'wght' 400,'GRAD' 0,'opsz' 24" }}>skip_next</span>
              </button>
            </div>
          </div>
          <div className="flex items-center gap-3 md:gap-5">
            <div className="text-right hidden md:block">
              <p className="text-[10px] font-bold uppercase text-on-surface-variant tracking-widest mb-0.5">Remaining</p>
              <p className="font-headline text-primary font-bold">{formatTime(timeRemaining)}</p>
            </div>
            <div className="h-7 w-px bg-outline-variant/25 hidden md:block"></div>
            <button onClick={showBrewSettings} className="w-11 h-11 flex items-center justify-center rounded-full bg-surface-container-high text-on-surface hover:bg-surface-container-highest transition-colors active:scale-95">
              <span className="material-symbols-outlined text-[20px]">tune</span>
            </button>
          </div>
        </footer>
      </main>
    </div>

    {showPhaseInfo && phaseTip && (
      <div className="fixed inset-x-0 bottom-0 z-[150] md:bottom-28 md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:w-[420px]">
        <div className="bg-surface-container-lowest rounded-t-2xl md:rounded-2xl shadow-2xl border border-outline-variant/15">
          <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-outline-variant/10">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-primary text-[18px]" style={{ fontVariationSettings: "'FILL' 1,'wght' 400,'GRAD' 0,'opsz' 24" }}>{ph.icon}</span>
              </div>
              <div>
                <p className="font-bold text-sm text-primary leading-tight">{ph.name}</p>
                <p className="text-[10px] text-on-surface-variant">Phase guide</p>
              </div>
            </div>
            <button
              onClick={() => setShowPhaseInfo(false)}
              className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-surface-container-high transition-colors"
            >
              <span className="material-symbols-outlined text-on-surface-variant text-[18px]">close</span>
            </button>
          </div>
          <div className="px-5 py-4 space-y-4">
            <div>
              <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1.5">Why this phase</p>
              <p className="text-sm text-on-surface leading-relaxed">{phaseTip.why}</p>
            </div>
            <div className="bg-surface-container-low rounded-xl px-4 py-3 flex gap-3">
              <span className="material-symbols-outlined text-primary text-[18px] shrink-0 mt-0.5" style={{ fontVariationSettings: "'FILL' 1,'wght' 400,'GRAD' 0,'opsz' 24" }}>tips_and_updates</span>
              <p className="text-sm text-on-surface leading-relaxed">{phaseTip.tip}</p>
            </div>
          </div>
        </div>
      </div>
    )}

    {showExitConfirm && (
      <ConfirmModal
        message="Exit the guided brew? Your timer progress will be lost."
        confirmLabel="Exit"
        danger
        onConfirm={() => { clearInterval(intervalRef.current!); navigate('/brew-setup') }}
        onCancel={() => setShowExitConfirm(false)}
      />
    )}

    {showParamsModal && brew && (
      <ConfirmModal
        title="Brew Parameters"
        message={[
          `Bean: ${brew.beanName}`,
          `Method: ${brew.method}`,
          `Dose: ${brew.dose}g`,
          `Water: ${brew.water}g`,
          `Temp: ${brew.temp}°C`,
          `Grind: ${brew.grindSize}`,
        ].join(' · ')}
        confirmLabel="Close"
        onConfirm={() => setShowParamsModal(false)}
      />
    )}
    </>
  )
}
