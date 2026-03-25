import { useState, useEffect, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useApp } from '../context/AppContext'

export default function GuidedBrew() {
  const { getPendingBrew, setPendingBrew, getPhases, formatTime, signOut, user } = useApp()
  const navigate = useNavigate()
  const brew = getPendingBrew()

  const phases = brew ? getPhases(brew.method) : []

  const [currentPhase, setCurrentPhase] = useState(0)
  const [totalSecs, setTotalSecs] = useState(0)
  const [phaseSecs, setPhaseSecs] = useState(0)
  const [running, setRunning] = useState(true)
  const [menuOpen, setMenuOpen] = useState(false)

  const intervalRef = useRef(null)
  const totalSecsRef = useRef(0)
  const phaseSecsRef = useRef(0)
  const runningRef = useRef(true)
  const currentPhaseRef = useRef(0)

  const meta = user?.user_metadata || {}
  const avatarUrl = meta.avatar_url || meta.picture

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
          clearInterval(intervalRef.current)
          finishBrew()
        }
      }
    }, 1000)
    return () => clearInterval(intervalRef.current)
  }, []) // eslint-disable-line

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
      clearInterval(intervalRef.current)
      finishBrew()
    }
  }

  function restartPhase() {
    phaseSecsRef.current = 0
    setPhaseSecs(0)
  }

  function exitBrew() {
    if (confirm('Exit the guided brew? Your timer progress will be lost.')) {
      clearInterval(intervalRef.current)
      navigate('/brew-setup')
    }
  }

  function showBrewSettings() {
    if (!brew) return
    const details = [
      `Bean: ${brew.beanName}`,
      `Method: ${brew.method}`,
      `Dose: ${brew.dose}g`,
      `Water: ${brew.water}g`,
      `Temp: ${brew.temp}°C`,
      `Grind: ${brew.grindSize}`,
    ].join('\n')
    alert('Current Brew Parameters:\n\n' + details)
  }

  if (!brew || !phases.length) return null

  const ph = phases[currentPhase]
  const nextPh = phases[currentPhase + 1]
  const phasePct = ph.duration > 0 ? Math.min((phaseSecs / ph.duration) * 100, 100) : 100
  const arcOffset = 653.5 * (1 - phasePct / 100)

  // Simulated water poured
  const prevTarget = phases.slice(0, currentPhase).reduce((s, p) => s + p.targetWater, 0)
  const poured = ph.targetWater > 0
    ? prevTarget + Math.round((phaseSecs / ph.duration) * ph.targetWater)
    : prevTarget
  const pouredClamped = Math.min(poured, prevTarget + ph.targetWater)
  const weightBarPct = Math.min((pouredClamped / (brew.water || 310)) * 100, 100)

  const remaining = phases.slice(currentPhase).reduce((s, p) => s + p.duration, 0)
  const estCompletion = formatTime(totalSecs + remaining)

  return (
    <div className="bg-background text-on-background overflow-hidden">
      {/* Sidebar */}
      <aside className="h-screen w-64 fixed left-0 top-0 bg-surface-container-low flex flex-col py-8 gap-y-8 z-50">
        <div className="px-8">
          <h1 className="font-headline text-xl tracking-tight text-primary">The Artisanal Brew</h1>
          <p className="text-[10px] tracking-widest uppercase text-on-surface-variant mt-1">Modern Cellar Edition</p>
        </div>
        <nav className="flex-1 flex flex-col">
          {[
            { to:'/', icon:'home', label:'Home' },
            { to:'/brew-setup', icon:'coffee_maker', label:'Log Brew', active:true, fill:true },
            { to:'/beans', icon:'grain', label:'Beans' },
            { to:'/analytics', icon:'insert_chart', label:'Analytics' },
            { to:'/recipes', icon:'menu_book', label:'Recipes' },
          ].map(link => (
            <Link key={link.to} to={link.to} className={`flex items-center gap-3 py-3 px-6 transition-colors ${link.active ? 'border-l-2 border-primary font-bold text-primary bg-surface-container-high/50' : 'text-on-surface-variant font-medium hover:bg-surface-container-high hover:text-primary'}`}>
              <span className="material-symbols-outlined text-[20px]" style={link.fill?{fontVariationSettings:"'FILL' 1,'wght' 600,'GRAD' 0,'opsz' 24"}:{}}>{link.icon}</span>
              <span className="text-sm">{link.label}</span>
            </Link>
          ))}
          <Link to="/settings" className="mt-auto flex items-center gap-3 py-3 px-6 text-on-surface-variant font-medium hover:bg-surface-container-high hover:text-primary transition-colors">
            <span className="material-symbols-outlined text-[20px]">settings</span>
            <span className="text-sm">Settings</span>
          </Link>
        </nav>
      </aside>

      {/* Top Bar */}
      <header className="fixed top-0 right-0 left-64 h-16 z-40 glass-panel shadow-[0_12px_40px_rgba(62,39,35,0.08)]">
        <div className="flex justify-between items-center px-12 h-full max-w-[1440px] mx-auto w-full">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-primary" style={{fontVariationSettings:"'FILL' 1,'wght' 400,'GRAD' 0,'opsz' 24"}}>timer</span>
            <span className="font-headline font-bold text-primary text-base tracking-tight">Guided Brew Mode</span>
          </div>
          <div className="flex items-center gap-4">
            {/* Phase dots */}
            <div className="flex gap-2">
              {phases.map((_, i) => (
                <div key={i} className={`w-2 h-2 rounded-full transition-all duration-300 ${i===currentPhase?'bg-primary scale-125':i<currentPhase?'bg-primary/40':'bg-outline-variant/40'}`}></div>
              ))}
            </div>
            <button onClick={() => alert('No new notifications.')} className="text-on-surface-variant hover:text-primary transition-colors">
              <span className="material-symbols-outlined">notifications</span>
            </button>
            <div className="relative">
              <button onClick={() => setMenuOpen(v => !v)} className="w-8 h-8 rounded-full bg-surface-container-highest flex items-center justify-center border border-outline-variant/15 overflow-hidden hover:ring-2 hover:ring-primary/20 transition-all">
                {avatarUrl ? <img src={avatarUrl} alt="" className="w-full h-full object-cover" /> : <span className="material-symbols-outlined text-on-surface-variant" style={{fontVariationSettings:"'FILL' 1,'wght' 400,'GRAD' 0,'opsz' 24"}}>account_circle</span>}
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-10 bg-surface-container-lowest rounded-xl shadow-xl border border-outline-variant/15 w-52 py-2 z-50">
                  <div className="px-4 py-3 border-b border-outline-variant/10">
                    <p className="text-xs font-bold text-primary truncate">{meta.full_name || meta.name || 'Brewer'}</p>
                    <p className="text-[11px] text-on-surface-variant truncate">{user?.email || ''}</p>
                  </div>
                  <Link to="/settings" onClick={() => setMenuOpen(false)} className="flex items-center gap-3 px-4 py-2.5 text-sm text-on-surface-variant hover:text-primary hover:bg-surface-container-high transition-colors">
                    <span className="material-symbols-outlined text-[18px]">manage_accounts</span>Profile &amp; Settings
                  </Link>
                  <button onClick={signOut} className="w-full text-left flex items-center gap-3 px-4 py-2.5 text-sm text-error hover:bg-error-container/30 transition-colors">
                    <span className="material-symbols-outlined text-[18px]">logout</span>Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="ml-64 pt-16 h-screen overflow-hidden flex flex-col bg-surface">
        <div className="flex-1 flex w-full max-w-[1440px] mx-auto min-h-0">

          {/* Left: Timer & Weight */}
          <section className="flex-1 flex flex-col items-center justify-center border-r border-outline-variant/15 px-10 py-8">
            <div className="text-center">
              <p className="text-xs uppercase tracking-widest text-on-surface-variant mb-5 font-bold">Total Time</p>
              <div className="timer-display" style={{fontSize:'clamp(5rem,10vw,11rem)'}}>{formatTime(totalSecs)}</div>
            </div>
            <div className="mt-14 w-full max-w-xs">
              <div className="flex justify-between items-end mb-4">
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-on-surface-variant mb-1 font-bold">Water Poured</p>
                  <div className="flex items-baseline gap-1">
                    <span className="font-headline text-6xl font-bold text-primary italic leading-none">{ph.targetWater > 0 ? pouredClamped : prevTarget}</span>
                    <span className="text-xl text-on-surface-variant not-italic ml-1">g</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[10px] uppercase tracking-widest text-on-surface-variant mb-1 font-bold">Target</p>
                  <div className="flex items-baseline gap-1 justify-end">
                    <span className="font-headline text-3xl font-medium text-on-surface-variant leading-none">{ph.targetWater > 0 ? prevTarget + ph.targetWater : '—'}</span>
                    {ph.targetWater > 0 && <span className="text-sm text-on-surface-variant">g</span>}
                  </div>
                </div>
              </div>
              <div className="h-2 w-full bg-surface-container-highest rounded-full overflow-hidden">
                <div className="h-full brew-gradient rounded-full transition-all duration-500" style={{width: weightBarPct+'%'}}></div>
              </div>
              <div className="flex justify-between mt-2 text-[10px] text-on-surface-variant font-bold">
                <span>{ph.targetWater > 0 ? pouredClamped : prevTarget}g poured</span>
                <span>{Math.max(0, (brew.water||310) - (ph.targetWater > 0 ? pouredClamped : prevTarget))}g remaining</span>
              </div>
            </div>
          </section>

          {/* Center: Phase */}
          <section className="w-[420px] shrink-0 flex flex-col items-center justify-center px-10 py-8 bg-surface-container-lowest">
            <div className="relative w-56 h-56 mb-10">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 224 224">
                <circle cx="112" cy="112" r="104" fill="transparent" stroke="#e4e2de" strokeWidth="2"/>
                <circle cx="112" cy="112" r="104" fill="transparent" stroke="#271310" strokeWidth="7" strokeLinecap="round" strokeDasharray="653.5" strokeDashoffset={arcOffset} className="transition-all duration-1000"/>
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="material-symbols-outlined text-primary mb-1" style={{fontSize:'44px',fontVariationSettings:"'FILL' 1,'wght' 300,'GRAD' 0,'opsz' 48"}}>{ph.icon}</span>
                <p className="font-label font-bold text-base text-primary leading-tight">{ph.name}</p>
                <p className="font-headline italic text-on-surface-variant text-sm">Phase {currentPhase+1} of {phases.length}</p>
              </div>
            </div>
            <div className="text-center space-y-4 max-w-xs">
              <h2 className="font-headline text-2xl font-bold text-primary leading-tight">{ph.instruction}</h2>
              {nextPh && (
                <div className="pt-3">
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-tertiary-fixed rounded-full text-on-tertiary-fixed text-[11px] font-bold uppercase tracking-wider">
                    <span className="material-symbols-outlined text-[14px]">info</span>
                    <span>Next: {nextPh.name}{nextPh.targetWater ? ` (${nextPh.targetWater}g)` : ''}</span>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Right: Live Data */}
          <section className="flex-1 flex flex-col justify-center px-10 py-8 space-y-10">
            <div className="group border-l-2 border-outline-variant/30 pl-7 hover:border-primary transition-colors duration-200">
              <p className="text-[10px] uppercase tracking-widest text-on-surface-variant mb-2 font-bold">Brew Temp</p>
              <div className="flex items-baseline gap-2">
                <span className="font-headline text-5xl font-bold text-primary leading-none">{brew.temp}</span>
                <span className="font-headline text-xl text-on-surface-variant">°C</span>
              </div>
              <div className="flex items-center gap-1.5 mt-2 text-tertiary font-bold text-xs">
                <span className="material-symbols-outlined text-[14px]" style={{fontVariationSettings:"'FILL' 1,'wght' 400,'GRAD' 0,'opsz' 24"}}>check_circle</span>
                Optimal Range
              </div>
            </div>
            <div className="group border-l-2 border-outline-variant/30 pl-7 hover:border-primary transition-colors duration-200">
              <p className="text-[10px] uppercase tracking-widest text-on-surface-variant mb-2 font-bold">Phase Timer</p>
              <div className="flex items-baseline gap-2">
                <span className="font-headline text-5xl font-bold text-primary leading-none">{formatTime(phaseSecs)}</span>
              </div>
              <div className="mt-4 h-1.5 w-full bg-surface-container-highest rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full transition-all duration-1000" style={{width: phasePct+'%'}}></div>
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
        <footer className="h-24 shrink-0 bg-surface-container-lowest flex items-center justify-between px-12 shadow-[0_-12px_40px_rgba(62,39,35,0.05)]">
          <div className="flex items-center gap-4">
            <button onClick={exitBrew} className="w-11 h-11 flex items-center justify-center rounded-full bg-surface-container-high text-on-surface hover:bg-surface-container-highest transition-colors active:scale-95">
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
            <div className="h-7 w-px bg-outline-variant/25"></div>
            <div className="flex flex-col">
              <span className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold mb-0.5">Recipe</span>
              <span className="font-headline font-bold text-primary italic text-sm">{brew.beanName} {brew.method}</span>
            </div>
          </div>
          <div className="flex items-center gap-8">
            <button onClick={restartPhase} className="flex items-center gap-2 text-sm font-bold text-on-surface-variant hover:text-primary transition-colors">
              <span className="material-symbols-outlined text-[18px]">replay</span>
              <span className="uppercase tracking-widest text-[11px]">Restart Phase</span>
            </button>
            <div className="flex items-center gap-3">
              <button onClick={togglePause} className="w-14 h-14 flex items-center justify-center rounded-full bg-surface-container-high text-primary hover:bg-surface-container-highest transition-all active:scale-95">
                <span className="material-symbols-outlined text-[28px]">{running ? 'pause' : 'play_arrow'}</span>
              </button>
              <button onClick={nextPhase} className="brew-gradient text-white px-7 h-14 flex items-center gap-2.5 rounded-full font-bold tracking-widest uppercase text-xs hover:opacity-90 transition-all shadow-lg active:scale-[0.98]">
                Skip to Next
                <span className="material-symbols-outlined text-[18px]" style={{fontVariationSettings:"'FILL' 1,'wght' 400,'GRAD' 0,'opsz' 24"}}>skip_next</span>
              </button>
            </div>
          </div>
          <div className="flex items-center gap-5">
            <div className="text-right">
              <p className="text-[10px] font-bold uppercase text-on-surface-variant tracking-widest mb-0.5">Est. Completion</p>
              <p className="font-headline text-primary font-bold">{estCompletion}</p>
            </div>
            <div className="h-7 w-px bg-outline-variant/25"></div>
            <button onClick={showBrewSettings} className="w-11 h-11 flex items-center justify-center rounded-full bg-surface-container-high text-on-surface hover:bg-surface-container-highest transition-colors active:scale-95">
              <span className="material-symbols-outlined text-[20px]">tune</span>
            </button>
          </div>
        </footer>
      </main>
    </div>
  )
}
