import type { Bean } from '../types/bean'
import type { GrindSuggestion, BrewAnalysis, BrewRecipe, FreshnessResult } from '../types/ai'

const GEMINI_TIMEOUT_MS = 8000

async function callGemini(prompt: string): Promise<string | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS)
  try {
    const response = await fetch('/api/gemini', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
      signal: controller.signal,
    })
    if (!response.ok) {
      const payload = await response.json().catch(() => ({})) as { error?: string }
      const message = payload?.error || `Gemini proxy error ${response.status}`
      throw new Error(message)
    }
    const data = await response.json() as { text?: string }
    return data?.text || null
  } finally {
    clearTimeout(timer)
  }
}

function parseJSON<T>(text: string | null): T | null {
  const match = text?.match(/\{[\s\S]*\}/)
  if (!match) return null
  try { return JSON.parse(match[0]) as T } catch { return null }
}

// Fallback: rule-based grind suggestion when AI is unavailable
function getFallbackGrindSuggestion({ tasteTags = [], extraction }: { rating?: number; tasteTags?: string[]; extraction?: number | null }): GrindSuggestion {
  const tags = tasteTags.map(t => t.toLowerCase())
  const isUnder = tags.some(t => ['sour', 'bright', 'acidic', 'thin'].includes(t)) || (extraction != null && extraction < 18)
  const isOver = tags.some(t => ['bitter', 'astringent', 'harsh', 'dry'].includes(t)) || (extraction != null && extraction > 24)

  if (isUnder) return {
    direction: 'finer',
    amount: '1–2 clicks finer',
    reasoning: 'Sour or thin taste notes suggest under-extraction — a finer grind increases surface area and contact time.',
    tip: 'Also try raising your water temperature by 1–2°C and pouring more slowly to extend extraction.',
  }
  if (isOver) return {
    direction: 'coarser',
    amount: '1–2 clicks coarser',
    reasoning: 'Bitter or astringent notes suggest over-extraction — a coarser grind reduces contact time and harsh compound dissolution.',
    tip: 'Lowering water temperature by 1–2°C alongside the grind adjustment can further tame over-extraction.',
  }
  return {
    direction: 'none',
    amount: 'No change needed',
    reasoning: 'Your current grind size appears well-matched to your brew parameters and taste profile.',
    tip: 'Keep your grind size consistent for the next few sessions to build a reliable baseline before experimenting.',
  }
}

export interface GrindSuggestionParams {
  method: string
  grindSize: string
  dose: number
  water: number
  temp: number
  rating: number
  tasteTags?: string[]
  extraction?: number | null
}

export async function suggestGrindAdjustment(params: GrindSuggestionParams): Promise<GrindSuggestion> {
  const { method, grindSize, dose, water, temp, rating, tasteTags, extraction } = params
  try {
    const text = await callGemini(`You are a coffee extraction expert. A brewer just finished a ${method} brew:
- Grind: ${grindSize}, Dose: ${dose}g, Water: ${water}g, Temp: ${temp}°C
- Rating: ${rating}/5, Taste tags: ${(tasteTags || []).join(', ') || 'none'}, Extraction: ${extraction || '?'}%

Suggest a grind adjustment for next brew. Return ONLY this JSON:
{
  "direction": "finer" | "coarser" | "none",
  "amount": "e.g. '1-2 clicks finer' or 'no change'",
  "reasoning": "one sentence explanation referencing the tasting evidence",
  "tip": "one specific actionable tip for the next brew session"
}`)
    const result = parseJSON<GrindSuggestion>(text)
    return result ?? getFallbackGrindSuggestion({ rating, tasteTags, extraction })
  } catch {
    return getFallbackGrindSuggestion({ rating, tasteTags, extraction })
  }
}

export async function generateBrewRecipe(bean: Bean, method: string): Promise<BrewRecipe | null> {
  const text = await callGemini(`You are a specialty coffee expert. Recommend optimal ${method} brew parameters for:
- Bean: ${bean.name}
- Origin: ${bean.origin}, Process: ${bean.process || 'unknown'}
- Roast: ${bean.roastLevel || 'Medium'}
- Tasting notes: ${bean.notes || 'none'}

The brewer has chosen ${method}. Return ONLY this JSON (method field must be exactly "${method}"):
{
  "method": "${method}",
  "dose": 18.5,
  "water": 300,
  "temp": 93,
  "grindSize": "24 clicks (Comandante)",
  "reasoning": "one sentence explaining why these parameters suit this bean with ${method}"
}`)
  return parseJSON<BrewRecipe>(text)
}

function getFallbackBrewAnalysis({ rating, tasteTags = [], extraction, method = 'V60' }: { rating: number; tasteTags?: string[]; extraction?: number | null; method?: string }): BrewAnalysis {
  const tags = tasteTags.map(t => t.toLowerCase())
  const isUnder = tags.some(t => ['sour', 'bright', 'acidic', 'thin'].includes(t)) || (extraction != null && extraction < 18)
  const isOver = tags.some(t => ['bitter', 'astringent', 'harsh', 'dry'].includes(t)) || (extraction != null && extraction > 24)
  const tier = rating <= 2 ? 'low' : rating === 3 ? 'mid' : 'high'

  if (tier === 'low' && isUnder) return { isFallback: true, headline: '"Significantly under-extracted — this one needs a real fix."', tip: 'The combination of a low rating and sour or thin notes points to a meaningful extraction shortfall. Go 2–3 clicks finer, raise water temperature by 3–4°C, and slow your pour right down.', extractionNote: `A low rating paired with bright or sour tags on a ${method} brew is a strong signal of under-extraction.` }
  if (tier === 'low' && isOver) return { isFallback: true, headline: '"Over-extracted and rough — time for a significant reset."', tip: 'A low rating alongside bitter or astringent notes means extraction ran well past the sweet spot. Go 2–3 clicks coarser, drop water temperature by 3–4°C, and shorten your brew time.', extractionNote: `Bitter or astringent flavours at a low satisfaction rating on a ${method} brew indicate significant over-extraction.` }
  if (tier === 'low') return { isFallback: true, headline: '"Disappointing cup — but the parameters will tell the story."', tip: 'With a low rating and no strong flavour signal, the issue may be recipe-level: check your dose-to-water ratio and water temperature first.', extractionNote: `A low satisfaction score without clear under- or over-extraction tags on a ${method} brew can point to stale beans, poor water quality, or a ratio that\'s significantly off.` }

  if (tier === 'mid' && isUnder) return { isFallback: true, headline: '"Decent, but the brightness is holding it back."', tip: 'A mid rating with sour or bright notes suggests you\'re close but just short of the sweet spot. Try 1–2 clicks finer or nudge water temperature up by 2°C.', extractionNote: `Your ${method} brew is in the right ballpark but shows mild under-extraction.` }
  if (tier === 'mid' && isOver) return { isFallback: true, headline: '"On the right track, but bitterness is creeping in."', tip: 'Mid satisfaction with bitter or astringent notes means you\'re just past the sweet spot. Pull back 1–2 clicks coarser or drop temperature by 2°C.', extractionNote: `The ${method} brew is reasonably extracted but has gone slightly over.` }
  if (tier === 'mid') return { isFallback: true, headline: '"Solid, but there\'s a better cup in these parameters."', tip: 'A 3/5 with no strong flavour signal means the brew is technically sound but not yet singing. Try adjusting your ratio by ±1g of coffee.', extractionNote: `Your ${method} brew is extracting evenly but the cup isn't fully expressing the bean's potential.` }

  if (tier === 'high' && isUnder) return { isFallback: true, headline: '"Great cup — a touch finer could make it exceptional."', tip: 'High satisfaction with bright notes means the extraction is enjoyable but there\'s still sweetness to unlock. A single click finer is enough.', extractionNote: `An enjoyable ${method} brew with a hint of brightness suggests you\'re just shy of the extraction sweet spot.` }
  if (tier === 'high' && isOver) return { isFallback: true, headline: '"Almost perfect — just rein in the bitterness."', tip: 'A high rating despite bitter notes shows a strong base recipe. Back off 1 click coarser.', extractionNote: `A high satisfaction score alongside slight bitterness on a ${method} brew means you\'re extracting well but just clipping the over-extraction range.` }
  return { isFallback: true, headline: '"Dialled in — this one\'s worth saving as a recipe."', tip: 'Your parameters and taste profile are in harmony. Log this as a saved recipe and keep your grind and ratio consistent.', extractionNote: `Your ${method} brew is well-extracted and well-received.` }
}

export interface BrewAnalysisParams {
  method: string
  dose: number
  water: number
  temp: number
  ratio?: string
  grindSize?: string
  extraction?: number | null
  rating: number
  tasteTags?: string[]
  beanName?: string
  beanOrigin?: string
  beanProcess?: string
  beanRoastLevel?: string
}

export async function getBrewAnalysis(params: BrewAnalysisParams): Promise<BrewAnalysis> {
  const { method, dose, water, temp, ratio, grindSize, extraction, rating, tasteTags, beanName, beanOrigin, beanProcess, beanRoastLevel } = params
  try {
    const text = await callGemini(`You are a specialty coffee sommelier and extraction expert. Analyse this brew session:

Bean: ${beanName || 'Unknown'}${beanOrigin ? ` (${beanOrigin})` : ''}${beanProcess ? `, ${beanProcess} process` : ''}${beanRoastLevel ? `, ${beanRoastLevel} roast` : ''}
Method: ${method}, Dose: ${dose}g / Water: ${water}g${ratio ? ` (${ratio})` : ''}, Temp: ${temp}°C
Grind: ${grindSize || 'unknown'}, Est. extraction: ${extraction || '?'}%
Rating: ${rating}/5, Taste tags: ${(tasteTags || []).join(', ') || 'none'}

Return ONLY this JSON:
{
  "headline": "A punchy one-liner verdict on this brew in double-quotes, max 12 words",
  "tip": "2-3 sentences: acknowledge what worked well, then give one specific parameter adjustment for the next session",
  "extractionNote": "2-3 sentences of technical analysis: how this method and these parameters interacted, and what the taste tags reveal about the extraction yield"
}`)
    const result = parseJSON<BrewAnalysis>(text)
    return result ?? getFallbackBrewAnalysis({ rating, tasteTags, extraction, method })
  } catch {
    return getFallbackBrewAnalysis({ rating, tasteTags, extraction, method })
  }
}

export function assessFreshness(roastDateStr: string | null | undefined): FreshnessResult | null {
  if (!roastDateStr) return null
  let date = new Date(roastDateStr)
  if (isNaN(date.getTime())) {
    const cleaned = roastDateStr.replace(/\./g, '-').replace(/(\d{2})\/(\d{2})\/(\d{4})/, '$3-$2-$1')
    date = new Date(cleaned)
  }
  if (isNaN(date.getTime())) return null
  const days = Math.floor((Date.now() - date.getTime()) / 86400000)
  if (days < 0) return { days, status: 'future', label: 'Not Yet Roasted', color: 'text-on-surface-variant', bg: 'bg-surface-container' }
  if (days < 7) return { days, status: 'fresh', label: 'Too Fresh', color: 'text-amber-700', bg: 'bg-amber-50' }
  if (days <= 21) return { days, status: 'peak', label: 'Peak Window', color: 'text-tertiary', bg: 'bg-tertiary-fixed/30' }
  if (days <= 45) return { days, status: 'aging', label: 'Aging', color: 'text-amber-700', bg: 'bg-amber-50' }
  return { days, status: 'stale', label: 'Stale', color: 'text-error', bg: 'bg-error-container/30' }
}

export async function getStalenessAdvice(bean: Bean, days: number, status: string): Promise<string | null> {
  const context = status === 'fresh'
    ? `This bean was roasted only ${days} days ago and is still degassing.`
    : status === 'aging'
    ? `This bean was roasted ${days} days ago — past its 7-21 day peak window.`
    : `This bean was roasted ${days} days ago and is significantly stale.`

  const text = await callGemini(`You are a coffee expert. ${context}
Bean: ${bean.name} (${bean.roastLevel || 'Medium'} roast, ${bean.process || 'unknown process'})
Tasting notes on bag: ${bean.notes || 'none'}

Give exactly 2-3 specific, practical brewing parameter adjustments to compensate. Be concise — one short sentence per tip. No intro, no conclusion, just the tips as a plain numbered list.`)
  return text
}
