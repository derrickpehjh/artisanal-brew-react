export interface Brew {
  id: string
  beanId?: string
  beanName: string
  method: string
  dose: number
  water: number
  temp: number
  ratio: string
  grindSize: string
  brewTime: string
  rating: number
  tasteTags: string[]
  notes: string
  date: string
  extraction?: number | null
  customPhases?: BrewPhase[]
}

export interface BrewDbRow {
  id: string
  user_id: string
  bean_id: string | null
  bean_name: string
  method: string
  dose: number
  water: number
  temp: number
  ratio: string
  grind_size: string
  brew_time: string
  rating: number
  taste_tags: string[]
  notes: string
  date: string
  extraction: number | null
  created_at?: string
}

export interface BrewStats {
  avgRating: number
  totalBrews: number
  consistencyPct: number
  weeklyVolumeLiters: number
  trendPct: number
  avgExtraction: number | null
  extractionInRange: number
}

export type BrewMethod = 'V60' | 'Chemex' | 'AeroPress' | 'French Press'

export interface BrewPhase {
  name: string
  icon: string
  targetWater: number
  duration: number
  instruction: string
}

export type PhasesMap = Record<BrewMethod, BrewPhase[]>
