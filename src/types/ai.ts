export interface GrindSuggestion {
  direction: 'finer' | 'coarser' | 'none'
  amount: string
  reasoning: string
  tip: string
}

export interface BrewAnalysis {
  headline: string
  tip: string
  extractionNote: string
  isFallback?: boolean
}

export interface BrewRecipe {
  method: string
  dose: number
  water: number
  temp: number
  grindSize: string
  reasoning: string
}

export interface FreshnessResult {
  days: number
  status: 'future' | 'fresh' | 'peak' | 'aging' | 'stale'
  label: string
  color: string
  bg: string
}

export interface BeanScanResult {
  name: string | null
  origin: string | null
  process: string | null
  roastLevel: string | null
  roastDate: string | null
  totalGrams: number | null
  notes: string | null
}
