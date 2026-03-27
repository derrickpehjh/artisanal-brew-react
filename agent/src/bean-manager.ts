import { PERSONA, BEAN_CATALOG } from './persona.js'
import type { AgentBean } from './types.js'

export interface LowBeanInfo {
  bean: AgentBean
  isCritical: boolean
}

/** Beans at or below the low/critical thresholds */
export function checkLowBeans(beans: AgentBean[]): LowBeanInfo[] {
  return beans
    .filter(b => b.remainingGrams <= PERSONA.lowThreshold)
    .map(b => ({ bean: b, isCritical: b.remainingGrams <= PERSONA.criticalThreshold }))
}

/**
 * Choose which bean to brew today.
 *
 * Scoring:
 * - Penalise near-empty beans (< criticalThreshold)
 * - Favour beans in the peak freshness window (7–28 days post-roast)
 * - Slightly favour beans with more remaining grams to avoid waste
 */
export function selectBeanForBrew(beans: AgentBean[]): AgentBean | null {
  const available = beans.filter(b => b.remainingGrams > 0)
  if (available.length === 0) return null

  const now = Date.now()
  const scored = available.map(b => {
    let score = 0

    // Penalise near-empty
    score += b.remainingGrams > PERSONA.criticalThreshold ? 10 : 2

    // Freshness bonus
    if (b.roastDate) {
      const days = (now - new Date(b.roastDate).getTime()) / 86_400_000
      if (days >= 7 && days <= 28)  score += 8  // peak window
      else if (days < 7)            score += 3  // too fresh — degassing
      else if (days <= 45)          score += 3  // acceptable
      else                          score -= 2  // going stale
    }

    // Slight preference for larger remaining stock to rotate evenly
    score += Math.min(b.remainingGrams / 50, 3)

    return { bean: b, score }
  })

  scored.sort((a, b) => b.score - a.score)
  return scored[0]!.bean
}

/**
 * Generate data for a new bean bag purchase.
 * Picks a catalog entry not currently in active inventory.
 * Roast date is 3–7 days ago (freshly received from roaster).
 */
export function generateNewBean(existingBeans: AgentBean[]): Omit<AgentBean, 'id'> {
  const existingNames = new Set(existingBeans.map(b => b.name))
  const pool = BEAN_CATALOG.filter(b => !existingNames.has(b.name))
  const source = pool.length > 0 ? pool : BEAN_CATALOG

  const template = source[Math.floor(Math.random() * source.length)]!

  const roastDaysAgo = 3 + Math.floor(Math.random() * 5)
  const roastDate = new Date(Date.now() - roastDaysAgo * 86_400_000)
    .toISOString()
    .split('T')[0]!

  const grams = Math.random() < 0.3 ? 250 : 200

  return {
    name: template.name,
    origin: template.origin,
    process: template.process,
    roastLevel: template.roastLevel,
    roastDate,
    totalGrams: grams,
    remainingGrams: grams,
    notes: `${template.notes} (from ${template.roaster})`,
  }
}
