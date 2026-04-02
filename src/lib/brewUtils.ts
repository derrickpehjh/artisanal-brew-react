import { PHASES } from './appData'
import type { BrewPhase } from '../types/brew'

// parseBrewTime — "3:30" → 210 (seconds)
export function parseBrewTime(mmss: string): number {
  const parts = String(mmss || '').split(':')
  const m = parseInt(parts[0] || '0', 10)
  const s = parseInt(parts[1] || '0', 10)
  return (isNaN(m) ? 0 : m) * 60 + (isNaN(s) ? 0 : s)
}

// scalePhasesToDuration — proportionally adjusts phase durations to sum to targetSecs
export function scalePhasesToDuration(phases: BrewPhase[], targetSecs: number): BrewPhase[] {
  const defaultTotal = phases.reduce((s, p) => s + p.duration, 0)
  if (!defaultTotal || defaultTotal === targetSecs) return phases
  const scale = targetSecs / defaultTotal
  return phases.map(p => ({ ...p, duration: Math.max(1, Math.round(p.duration * scale)) }))
}

// BrewPrefs — shared between BrewSetup and Settings
export interface BrewPrefs {
  dose: number
  water: number
  temp: number
  grindSize: string
  method: string
}

export const BREW_PREFS_KEY = 'artisanal_brew_prefs'
export const BREW_PREFS_DEFAULTS: BrewPrefs = {
  dose: 18.5,
  water: 310,
  temp: 94,
  grindSize: '24 clicks (Comandante)',
  method: 'V60',
}

export function loadBrewPrefs(): BrewPrefs {
  try {
    return { ...BREW_PREFS_DEFAULTS, ...JSON.parse(localStorage.getItem(BREW_PREFS_KEY) || '{}') as Partial<BrewPrefs> }
  } catch {
    return { ...BREW_PREFS_DEFAULTS }
  }
}

// phasesDuration — total brew time string for a given method
export function phasesDuration(method: string): string {
  const phases: BrewPhase[] = (PHASES as Record<string, BrewPhase[]>)[method] || PHASES['V60']
  const secs = phases.reduce((s, p) => s + p.duration, 0)
  const m = Math.floor(secs / 60), s = secs % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

// withTimeout — wrap a promise with a rejection timeout
export function withTimeout<T>(promise: Promise<T>, timeoutMs: number, errorMessage: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      timer = setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
    }),
  ]).finally(() => clearTimeout(timer))
}
