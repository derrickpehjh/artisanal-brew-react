export interface AgentBean {
  id: string
  name: string
  origin: string
  process: string
  roastLevel: string
  roastDate: string | null
  totalGrams: number
  remainingGrams: number
  notes: string
}

export interface AgentBrew {
  id: string
  beanId?: string | null
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
  extraction: number | null
}

export interface BrewParams {
  dose: number
  water: number
  temp: number
  grindSize: string
  brewTime: string
  extraction: number
}

export interface ValidationIssue {
  severity: 'error' | 'warning'
  entityType: 'bean' | 'brew'
  entityId: string
  entityName: string
  field: string
  value: unknown
  message: string
}

export interface AgentReport {
  date: string
  userId: string
  isDryRun: boolean
  beansChecked: number
  beansLow: string[]
  beansPurchased: string[]
  brewedToday: string | null
  validationIssues: ValidationIssue[]
  actionsLog: string[]
  summary: string
}

export type BrewMethod = 'V60' | 'Chemex' | 'AeroPress' | 'French Press'
