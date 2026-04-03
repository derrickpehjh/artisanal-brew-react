import { useState } from 'react'
import type { BrewPhase } from '../../types/brew'

interface PhasePreset {
  name: string
  icon: string
  hasWater: boolean
  defaultDuration: number
  instruction: string
}

const PHASE_PRESETS: PhasePreset[] = [
  { name: 'Bloom Pour', icon: 'water_drop', hasWater: true, defaultDuration: 15, instruction: 'Pour in a slow spiral to saturate all grounds evenly.' },
  { name: 'Bloom Rest', icon: 'hourglass_top', hasWater: false, defaultDuration: 45, instruction: 'Wait for CO₂ to degas from the grounds before pouring.' },
  { name: 'Pour', icon: 'water_drop', hasWater: true, defaultDuration: 45, instruction: 'Pour steadily in concentric circles from the centre outward.' },
  { name: 'Draw Down', icon: 'hourglass_bottom', hasWater: false, defaultDuration: 75, instruction: 'Allow the brew to fully drain. Do not disturb the bed.' },
  { name: 'Steep', icon: 'coffee', hasWater: false, defaultDuration: 60, instruction: 'Allow the coffee to steep undisturbed.' },
  { name: 'Press', icon: 'compress', hasWater: false, defaultDuration: 30, instruction: 'Press slowly and evenly. Stop when you hear the hiss.' },
  { name: 'Stir', icon: 'rotate_right', hasWater: false, defaultDuration: 15, instruction: 'Stir gently to saturate all grounds.' },
  { name: 'Fill', icon: 'water_drop', hasWater: true, defaultDuration: 30, instruction: 'Add the remaining water in a steady stream.' },
]

const PHASE_DESCRIPTIONS: Record<string, string> = {
  'Bloom Pour':  'Pre-wet the grounds with a small amount of water (2–3× dose weight) to release trapped CO₂ before the main extraction.',
  'Bloom Rest':  'Pause after blooming so CO₂ fully escapes. Rushing this causes channelling and uneven extraction.',
  'Pour':        'Add water in steady spirals. Controls extraction pace — slower pours give more contact time.',
  'Draw Down':   'Wait for water to drain through the bed. Drain speed is a grind-size indicator: fast = coarse, slow = fine.',
  'Steep':       'Immersion phase — coffee sits in water. Longer steeps increase extraction yield for French Press and AeroPress.',
  'Press':       'Apply even pressure to separate liquid from grounds. Too fast forces bitter fines through; stop at first hiss.',
  'Stir':        'Quick agitation to break dry clumps and ensure every ground is wetted evenly before steeping.',
  'Fill':        'Complete the water addition to the target weight. Keep walls clear of stray dry grounds.',
}

function getPreset(phase: BrewPhase): PhasePreset {
  return (
    PHASE_PRESETS.find(p => p.name === phase.name) ||
    PHASE_PRESETS.find(p => p.icon === phase.icon && (phase.targetWater > 0 ? p.hasWater : !p.hasWater)) ||
    (phase.targetWater > 0 ? PHASE_PRESETS[2] : PHASE_PRESETS[3])
  )
}

function fmtSecs(secs: number): string {
  if (secs < 60) return `${secs}s`
  const m = Math.floor(secs / 60), s = secs % 60
  return s > 0 ? `${m}m ${s}s` : `${m}m`
}

interface Props {
  phases: BrewPhase[]
  totalWater: number
  method: string
  onSave: (phases: BrewPhase[]) => void
  onReset: () => void
  onClose: () => void
}

export default function PourPatternEditor({ phases: initial, totalWater, method, onSave, onReset, onClose }: Props) {
  const [phases, setPhases] = useState<BrewPhase[]>(initial.map(p => ({ ...p })))
  const [editingIndex, setEditingIndex] = useState<number | null>(null)

  const totalDuration = phases.reduce((s, p) => s + p.duration, 0)
  const totalMins = Math.floor(totalDuration / 60)
  const totalSecs = totalDuration % 60

  const lastPourTarget = [...phases].reverse().find(p => p.targetWater > 0)?.targetWater ?? 0
  const hasWaterMismatch = lastPourTarget > 0 && lastPourTarget !== totalWater

  function updatePhase(index: number, updates: Partial<BrewPhase>) {
    setPhases(prev => prev.map((p, i) => i === index ? { ...p, ...updates } : p))
  }

  function removePhase(index: number) {
    setPhases(prev => prev.filter((_, i) => i !== index))
    setEditingIndex(null)
  }

  function addPhase(preset: PhasePreset) {
    const lastWater = [...phases].reverse().find(p => p.targetWater > 0)?.targetWater ?? 0
    const defaultWater = preset.hasWater
      ? Math.min(totalWater, lastWater + Math.round(totalWater * 0.25))
      : 0
    const newPhase: BrewPhase = {
      name: preset.name,
      icon: preset.icon,
      targetWater: defaultWater,
      duration: preset.defaultDuration,
      instruction: preset.instruction,
    }
    setPhases(prev => [...prev, newPhase])
    setEditingIndex(phases.length)
  }

  function changePhaseType(index: number, preset: PhasePreset) {
    setPhases(prev => prev.map((p, i) => i === index ? {
      ...p,
      name: preset.name,
      icon: preset.icon,
      targetWater: preset.hasWater ? (p.targetWater || 0) : 0,
      instruction: preset.instruction,
    } : p))
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-end md:items-center justify-center">
      <div className="absolute inset-0 bg-primary/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-surface-container-lowest rounded-t-2xl md:rounded-2xl w-full md:w-[600px] max-h-[90vh] md:max-h-[85vh] flex flex-col shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-outline-variant/15 shrink-0">
          <div>
            <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">{method}</p>
            <h3 className="font-headline text-xl font-bold text-primary">Customise Pour Pattern</h3>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-[10px] text-on-surface-variant uppercase tracking-widest font-bold">Total</p>
              <p className="font-headline font-bold text-sm text-primary tabular-nums">
                {totalMins}:{String(totalSecs).padStart(2, '0')}
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-surface-container-high transition-colors"
            >
              <span className="material-symbols-outlined text-on-surface-variant text-[20px]">close</span>
            </button>
          </div>
        </div>

        {/* Phase list */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2 min-h-0">
          {phases.map((phase, i) => {
            const preset = getPreset(phase)
            const isEditing = editingIndex === i
            const prevWater = i > 0 ? Math.max(0, ...phases.slice(0, i).map(p => p.targetWater)) : 0
            const increment = phase.targetWater > 0 ? phase.targetWater - prevWater : 0

            return (
              <div key={i} className="bg-surface-container-low rounded-xl overflow-hidden" title={PHASE_DESCRIPTIONS[phase.name]}>
                {/* Row summary */}
                <div className="flex items-center gap-3 px-4 py-3">
                  <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-primary/10 shrink-0">
                    <span
                      className="material-symbols-outlined text-primary text-[16px]"
                      style={{ fontVariationSettings: "'FILL' 1,'wght' 400,'GRAD' 0,'opsz' 24" }}
                    >{phase.icon}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-on-surface leading-tight">{phase.name}</p>
                    <p className="text-[11px] text-on-surface-variant leading-tight">
                      {fmtSecs(phase.duration)}
                      {phase.targetWater > 0 && (
                        <span className="ml-2 text-primary font-semibold">
                          → {phase.targetWater}g
                          {increment > 0 && increment !== phase.targetWater && (
                            <span className="text-on-surface-variant/50 font-normal ml-1">(+{increment}g)</span>
                          )}
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => setEditingIndex(isEditing ? null : i)}
                      className={`w-8 h-8 flex items-center justify-center rounded-full transition-colors ${isEditing ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:bg-surface-container-high'}`}
                    >
                      <span className="material-symbols-outlined text-[16px]">{isEditing ? 'expand_less' : 'edit'}</span>
                    </button>
                    {phases.length > 1 && (
                      <button
                        onClick={() => removePhase(i)}
                        className="w-8 h-8 flex items-center justify-center rounded-full text-on-surface-variant hover:text-error hover:bg-error-container/20 transition-colors"
                      >
                        <span className="material-symbols-outlined text-[16px]">delete</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Inline editor panel */}
                {isEditing && (
                  <div className="border-t border-outline-variant/10 px-4 pt-3 pb-4 space-y-3 bg-surface-container-lowest/50">

                    {/* Phase type chips */}
                    <div>
                      <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-2">Phase Type</p>
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {PHASE_PRESETS.map(p => (
                          <button
                            key={p.name}
                            onClick={() => changePhaseType(i, p)}
                            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] font-bold transition-colors ${
                              phase.name === p.name
                                ? 'bg-primary text-on-primary'
                                : 'bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest'
                            }`}
                          >
                            <span
                              className="material-symbols-outlined text-[12px]"
                              style={{ fontVariationSettings: "'FILL' 1,'wght' 400,'GRAD' 0,'opsz' 24" }}
                            >{p.icon}</span>
                            {p.name}
                          </button>
                        ))}
                      </div>
                      {PHASE_DESCRIPTIONS[phase.name] && (
                        <p className="text-[11px] text-on-surface-variant leading-relaxed bg-surface-container rounded-lg px-3 py-2">
                          {PHASE_DESCRIPTIONS[phase.name]}
                        </p>
                      )}
                    </div>

                    {/* Duration + Water side by side */}
                    <div className="grid grid-cols-2 gap-3">
                      {/* Duration */}
                      <div>
                        <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-2">Duration (s)</p>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => updatePhase(i, { duration: Math.max(5, phase.duration - 5) })}
                            className="w-7 h-7 flex items-center justify-center rounded-lg bg-surface-container-high hover:bg-surface-container-highest transition-colors text-on-surface-variant"
                          >
                            <span className="material-symbols-outlined text-[16px]">remove</span>
                          </button>
                          <input
                            type="number"
                            value={phase.duration}
                            min={5}
                            max={600}
                            onChange={e => updatePhase(i, { duration: Math.max(5, parseInt(e.target.value) || 5) })}
                            className="flex-1 min-w-0 text-center bg-surface-container-high rounded-lg py-1.5 text-sm font-bold text-primary border-none focus:ring-1 focus:ring-primary/30 outline-none"
                          />
                          <button
                            onClick={() => updatePhase(i, { duration: Math.min(600, phase.duration + 5) })}
                            className="w-7 h-7 flex items-center justify-center rounded-lg bg-surface-container-high hover:bg-surface-container-highest transition-colors text-on-surface-variant"
                          >
                            <span className="material-symbols-outlined text-[16px]">add</span>
                          </button>
                        </div>
                      </div>

                      {/* Water target */}
                      <div>
                        <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-2">
                          {preset.hasWater || phase.targetWater > 0 ? `Target (g, max ${totalWater})` : 'Water'}
                        </p>
                        {preset.hasWater || phase.targetWater > 0 ? (
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => updatePhase(i, { targetWater: Math.max(prevWater + 1, phase.targetWater - 10) })}
                              className="w-7 h-7 flex items-center justify-center rounded-lg bg-surface-container-high hover:bg-surface-container-highest transition-colors text-on-surface-variant"
                            >
                              <span className="material-symbols-outlined text-[16px]">remove</span>
                            </button>
                            <input
                              type="number"
                              value={phase.targetWater}
                              min={prevWater + 1}
                              max={totalWater}
                              onChange={e => updatePhase(i, {
                                targetWater: Math.max(prevWater + 1, Math.min(totalWater, parseInt(e.target.value) || 0)),
                              })}
                              className="flex-1 min-w-0 text-center bg-surface-container-high rounded-lg py-1.5 text-sm font-bold text-primary border-none focus:ring-1 focus:ring-primary/30 outline-none"
                            />
                            <button
                              onClick={() => updatePhase(i, { targetWater: Math.min(totalWater, phase.targetWater + 10) })}
                              className="w-7 h-7 flex items-center justify-center rounded-lg bg-surface-container-high hover:bg-surface-container-highest transition-colors text-on-surface-variant"
                            >
                              <span className="material-symbols-outlined text-[16px]">add</span>
                            </button>
                          </div>
                        ) : (
                          <div className="h-[34px] flex items-center">
                            <span className="text-[11px] text-on-surface-variant italic">No pour in this phase</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Add phase strip */}
        <div className="px-4 py-3 border-t border-outline-variant/10 shrink-0">
          <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-2">Add Phase</p>
          <div className="flex flex-wrap gap-1.5">
            {PHASE_PRESETS.filter(p => p.name !== 'Stir').map(preset => (
              <button
                key={preset.name}
                onClick={() => addPhase(preset)}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-surface-container-high rounded-full text-[11px] font-bold text-on-surface hover:bg-surface-container-highest transition-colors"
              >
                <span className="material-symbols-outlined text-[12px] text-primary">add</span>
                {preset.name}
              </button>
            ))}
          </div>
        </div>

        {/* Water mismatch warning */}
        {hasWaterMismatch && (
          <div className="mx-4 px-3 py-2 bg-surface-container-high rounded-lg text-[11px] text-on-surface-variant flex items-center gap-2">
            <span className="material-symbols-outlined text-[14px] text-primary shrink-0">info</span>
            Last pour target ({lastPourTarget}g) ≠ total water ({totalWater}g). Guided mode will scale water targets accordingly.
          </div>
        )}

        {/* Footer */}
        <div className="px-5 py-4 border-t border-outline-variant/15 flex items-center justify-between shrink-0">
          <button
            onClick={onReset}
            className="flex items-center gap-1.5 text-xs font-bold text-on-surface-variant hover:text-primary transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">refresh</span>
            Reset to Default
          </button>
          <button
            onClick={() => onSave(phases)}
            className="brew-gradient text-white px-6 py-2.5 rounded-full text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-all shadow-md"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
