import type { User, SupabaseClient } from '@supabase/supabase-js'
import type { Bean } from './bean'
import type { Brew, BrewStats, BrewPhase } from './brew'

export interface AppContextValue {
  user: User | null
  beans: Bean[]
  brews: Brew[]
  loading: boolean
  initialized: boolean
  stats: BrewStats
  isSupabaseConfigured: boolean
  supabase: SupabaseClient | null
  refresh: () => Promise<void>
  addBean: (bean: Omit<Bean, 'id'> & { id?: string }) => Promise<Bean>
  updateBean: (id: string, data: Partial<Bean>) => Promise<Bean | undefined>
  deleteBean: (id: string) => Promise<Bean | undefined>
  saveBrew: (brew: Partial<Brew>) => Promise<Brew>
  resetAllData: () => Promise<void>
  migrateExtractionValues: () => Promise<number>
  signOut: () => Promise<void>
  getActiveBean: () => Bean | null
  setActiveBeanId: (id: string) => void
  getBestBrews: (n?: number) => Brew[]
  getPendingBrew: () => Partial<Brew> | null
  setPendingBrew: (brew: Partial<Brew>) => void
  clearPendingBrew: () => void
  formatDate: (iso: string) => string
  formatRatio: (dose: number, water: number) => string
  formatTime: (secs: number) => string
  getTip: () => string
  getPhases: (method: string, water?: number) => BrewPhase[]
}
