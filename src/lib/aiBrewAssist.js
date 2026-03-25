// Shared Gemini caller
async function callGemini(prompt) {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY
  if (!apiKey || apiKey === 'your_key_here') return null
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3 },
      }),
    }
  )
  if (!response.ok) throw new Error(`Gemini API error ${response.status}`)
  const data = await response.json()
  return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null
}

function parseJSON(text) {
  const match = text?.match(/\{[\s\S]*\}/)
  if (!match) return null
  try { return JSON.parse(match[0]) } catch { return null }
}

// Feature 1: grind suggestion after brew
export async function suggestGrindAdjustment({ method, grindSize, dose, water, temp, rating, tasteTags, extraction }) {
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
  return parseJSON(text)
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
