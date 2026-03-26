import type { VercelRequest, VercelResponse } from '@vercel/node'
import type { GeminiTextRequest, GeminiResponse, ApiErrorResponse } from '../server/types'

const GEMINI_MODEL = 'gemini-2.5-flash-lite'
const RETRY_DELAYS_MS = [5000, 15000, 30000]

async function callGemini(apiKey: string, body: unknown): Promise<Response> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`
  const opts: RequestInit = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
  let response = await fetch(url, opts)
  for (const delay of RETRY_DELAYS_MS) {
    if (response.status !== 429) break
    await new Promise(r => setTimeout(r, delay))
    response = await fetch(url, opts)
  }
  return response
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    res.status(500).json({ error: 'Server is missing GEMINI_API_KEY' })
    return
  }

  const body = req.body as Partial<GeminiTextRequest>
  const prompt = typeof body?.prompt === 'string' ? body.prompt.trim() : ''
  if (!prompt) {
    res.status(400).json({ error: 'Missing prompt' })
    return
  }

  try {
    const response = await callGemini(apiKey, {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.3, maxOutputTokens: 512 },
    })

    if (!response.ok) {
      const errorBody = await response.text()
      res.status(response.status).json({ error: `Gemini API error: ${errorBody}` })
      return
    }

    const data = await response.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] }
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null
    res.status(200).json({ text })
  } catch (error) {
    res.status(500).json({ error: (error as Error)?.message || 'Unexpected Gemini proxy error' })
  }
}
