const GEMINI_TIMEOUT_MS = 8000

// Shared Gemini caller
async function callGemini(prompt) {
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
      const payload = await response.json().catch(() => ({}))
      const message = payload?.error || `Gemini proxy error ${response.status}`
      throw new Error(message)
    }
    const data = await response.json()
    return data?.text || null
  } finally {
    clearTimeout(timer)
  }
}

function parseJSON(text) {
  const match = text?.match(/\{[\s\S]*\}/)
  if (!match) return null
  try { return JSON.parse(match[0]) } catch { return null }
}

// Fallback: rule-based grind suggestion when AI is unavailable
function getFallbackGrindSuggestion({ rating, tasteTags = [], extraction }) {
  const tags = tasteTags.map(t => t.toLowerCase())
  const isUnder = tags.some(t => ['sour', 'bright', 'acidic', 'thin'].includes(t)) || (extraction && extraction < 18)
  const isOver  = tags.some(t => ['bitter', 'astringent', 'harsh', 'dry'].includes(t)) || (extraction && extraction > 24)

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

// Feature 1: grind suggestion after brew
export async function suggestGrindAdjustment({ method, grindSize, dose, water, temp, rating, tasteTags, extraction }) {
  try {
    const text = await callGemini(`You are a coffee extraction expert. A brewer just finished a ${method} brew:
- Grind: ${grindSize}, Dose: ${dose}g, Water: ${water}g, Temp: ${temp}°C
- Rating: ${rating}/5, Taste tags: ${(tasteTags||[]).join(', ') || 'none'}, Extraction: ${extraction || '?'}%

Suggest a grind adjustment for next brew. Return ONLY this JSON:
{
  "direction": "finer" | "coarser" | "none",
  "amount": "e.g. '1-2 clicks finer' or 'no change'",
  "reasoning": "one sentence explanation referencing the tasting evidence",
  "tip": "one specific actionable tip for the next brew session"
}`)
    const result = parseJSON(text)
    return result ?? getFallbackGrindSuggestion({ rating, tasteTags, extraction })
  } catch {
    return getFallbackGrindSuggestion({ rating, tasteTags, extraction })
  }
}

// Feature 2: recipe generator
export async function generateBrewRecipe(bean) {
  const text = await callGemini(`You are a specialty coffee expert. Recommend optimal brew parameters for:
- Bean: ${bean.name}
- Origin: ${bean.origin}, Process: ${bean.process || 'unknown'}
- Roast: ${bean.roastLevel || 'Medium'}
- Tasting notes: ${bean.notes || 'none'}

Return ONLY this JSON (method must be exactly one of: V60, Chemex, AeroPress, French Press):
{
  "method": "V60",
  "dose": 18.5,
  "water": 300,
  "temp": 93,
  "grindSize": "24 clicks (Comandante)",
  "reasoning": "one sentence explaining why these parameters suit this bean"
}`)
  return parseJSON(text)
}

// Fallback: rule-based brew analysis when AI is unavailable
function getFallbackBrewAnalysis({ rating, tasteTags = [], extraction, method = 'V60' }) {
  const tags = tasteTags.map(t => t.toLowerCase())
  const isUnder = tags.some(t => ['sour', 'bright', 'acidic', 'thin'].includes(t)) || (extraction && extraction < 18)
  const isOver  = tags.some(t => ['bitter', 'astringent', 'harsh', 'dry'].includes(t)) || (extraction && extraction > 24)

  if (isUnder) return {
    isFallback: true,
    headline: '"Bright and lively — but there\'s more to unlock."',
    tip: 'Sour or thin notes point to under-extraction. Try going 1–2 clicks finer on your grind or raise water temperature by 2–3°C. A slower, more even pour will also extend contact time and improve solubles yield.',
    extractionNote: `Your ${method} brew shows signs of under-extraction — dominant bright or sour flavours indicate not enough solubles were dissolved. Grinding finer, raising brew temperature, or extending total brew time should push the extraction further into the sweet spot and round out the cup.`,
  }
  if (isOver) return {
    isFallback: true,
    headline: '"Bold and full — but bitterness is stealing the show."',
    tip: 'Bitter or astringent notes typically signal over-extraction. Go 1–2 clicks coarser and consider dropping your water temperature by 2–3°C. Reducing total steep time can also help dial back the harsh compounds.',
    extractionNote: `The ${method} brew has extracted past the optimal window — bitter or astringent flavours suggest over-solubles dissolution. Coarsening the grind or lowering brew temperature should bring the extraction back into balance and restore sweetness and clarity.`,
  }
  if (rating >= 4) return {
    isFallback: true,
    headline: '"A well-dialled extraction — textbook balance."',
    tip: 'Your parameters are working well together. Keep your grind size consistent and consider logging this as a saved recipe. A small ±1°C water temperature experiment could further enhance clarity or sweetness.',
    extractionNote: `Your ${method} brew shows strong parameter alignment. The balanced taste profile suggests an extraction yield in the sweet spot with good solubles distribution. Taste tags indicate complete development without harsh over-extraction — a solid baseline to build on.`,
  }
  return {
    isFallback: true,
    headline: '"Solid brew with room to refine."',
    tip: 'Your brew is on track. Fine-tuning grind size by one click and keeping water temperature consistent between sessions will help you dial in more precisely. Keep tracking your parameters for faster iteration.',
    extractionNote: `This ${method} brew shows reasonable extraction. The taste profile suggests some room to optimise — small, incremental adjustments to grind size and brew temperature will help you consistently hit the sweet spot for this bean.`,
  }
}

// Feature 2b: post-brew sommelier analysis + extraction note
export async function getBrewAnalysis({ method, dose, water, temp, ratio, grindSize, extraction, rating, tasteTags, beanName, beanOrigin, beanProcess, beanRoastLevel }) {
  try {
    const text = await callGemini(`You are a specialty coffee sommelier and extraction expert. Analyse this brew session:

Bean: ${beanName || 'Unknown'}${beanOrigin ? ` (${beanOrigin})` : ''}${beanProcess ? `, ${beanProcess} process` : ''}${beanRoastLevel ? `, ${beanRoastLevel} roast` : ''}
Method: ${method}, Dose: ${dose}g / Water: ${water}g${ratio ? ` (${ratio})` : ''}, Temp: ${temp}°C
Grind: ${grindSize || 'unknown'}, Est. extraction: ${extraction || '?'}%
Rating: ${rating}/5, Taste tags: ${(tasteTags||[]).join(', ') || 'none'}

Return ONLY this JSON:
{
  "headline": "A punchy one-liner verdict on this brew in double-quotes, max 12 words",
  "tip": "2-3 sentences: acknowledge what worked well, then give one specific parameter adjustment for the next session",
  "extractionNote": "2-3 sentences of technical analysis: how this method and these parameters interacted, and what the taste tags reveal about the extraction yield"
}`)
    const result = parseJSON(text)
    return result ?? getFallbackBrewAnalysis({ rating, tasteTags, extraction, method })
  } catch {
    return getFallbackBrewAnalysis({ rating, tasteTags, extraction, method })
  }
}

// Feature 3: freshness assessment (pure JS, no AI)
export function assessFreshness(roastDateStr) {
  if (!roastDateStr) return null
  let date = new Date(roastDateStr)
  // handle "Oct 12, 2023", "2023.10.12", "12/10/2023" etc
  if (isNaN(date.getTime())) {
    const cleaned = roastDateStr.replace(/\./g, '-').replace(/(\d{2})\/(\d{2})\/(\d{4})/, '$3-$2-$1')
    date = new Date(cleaned)
  }
  if (isNaN(date.getTime())) return null
  const days = Math.floor((Date.now() - date.getTime()) / 86400000)
  if (days < 0)  return { days, status: 'future',  label: 'Not Yet Roasted', color: 'text-on-surface-variant', bg: 'bg-surface-container' }
  if (days < 7)  return { days, status: 'fresh',   label: 'Too Fresh',       color: 'text-amber-700',         bg: 'bg-amber-50' }
  if (days <= 21) return { days, status: 'peak',   label: 'Peak Window',     color: 'text-tertiary',          bg: 'bg-tertiary-fixed/30' }
  if (days <= 45) return { days, status: 'aging',  label: 'Aging',           color: 'text-amber-700',         bg: 'bg-amber-50' }
  return              { days, status: 'stale',  label: 'Stale',           color: 'text-error',             bg: 'bg-error-container/30' }
}

// Feature 3: AI compensation tips for non-peak beans
export async function getStalenessAdvice(bean, days, status) {
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
