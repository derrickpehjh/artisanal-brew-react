/**
 * Direct Gemini API wrapper for the agent.
 * Calls the REST API with an 8-second timeout; returns null on any failure
 * so callers can fall back to rule-based logic.
 */

const GEMINI_MODEL   = 'gemini-2.5-flash-lite'
const TIMEOUT_MS     = 8_000

interface GeminiCandidate {
  content?: { parts?: Array<{ text?: string }> }
}
interface GeminiApiResponse {
  candidates?: GeminiCandidate[]
}

export async function callGemini(prompt: string): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return null  // graceful skip — no key configured

  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/` +
    `${GEMINI_MODEL}:generateContent?key=${apiKey}`

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.8, maxOutputTokens: 300 },
      }),
    })

    if (!res.ok) return null

    const json = (await res.json()) as GeminiApiResponse
    return json.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? null
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

// ---------------------------------------------------------------------------
// Agent-specific prompts
// ---------------------------------------------------------------------------

/**
 * Ask Gemini to write a short brew journal entry in Wei Liang's voice.
 * Falls back to the rule-based note from taste-engine if Gemini is unavailable.
 */
export async function generateBrewNotes(params: {
  beanName: string
  origin: string
  method: string
  dose: number
  water: number
  temp: number
  grindSize: string
  brewTime: string
  extraction: number
  rating: number
  tags: string[]
}): Promise<string | null> {
  const tagStr = params.tags.join(', ')
  const prompt =
    `You are Wei Liang, a specialty coffee enthusiast in Singapore. ` +
    `Write a single short brew journal entry (2–3 sentences max, casual tone, ` +
    `no hashtags, no emojis) for this morning's cup:\n` +
    `Bean: ${params.beanName} (${params.origin})\n` +
    `Method: ${params.method} — ${params.dose}g / ${params.water}g @ ${params.temp}°C\n` +
    `Grind: ${params.grindSize}, brew time ${params.brewTime}\n` +
    `Extraction: ${params.extraction}%\n` +
    `Taste: ${tagStr}\n` +
    `Rating: ${params.rating}/5`

  return callGemini(prompt)
}

/**
 * Ask Gemini to write a brief reason for purchasing a new bag.
 */
export async function generatePurchaseNote(params: {
  beanName: string
  origin: string
  process: string
  roaster: string
  triggerBean: string
  triggerRemaining: number
}): Promise<string | null> {
  const prompt =
    `You are Wei Liang, a specialty coffee enthusiast in Singapore. ` +
    `Write one casual sentence (no emojis) explaining why you just ordered ` +
    `a new bag of ${params.beanName} from ${params.roaster} ` +
    `(${params.origin}, ${params.process} process). ` +
    `Context: your ${params.triggerBean} is almost gone (${params.triggerRemaining}g left).`

  return callGemini(prompt)
}
