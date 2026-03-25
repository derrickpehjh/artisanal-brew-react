const GEMINI_MODEL = 'gemini-2.5-flash'

async function callGemini(apiKey, body) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`
  const opts = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
  let response = await fetch(url, opts)
  if (response.status === 429) {
    await new Promise(r => setTimeout(r, 5000))
    response = await fetch(url, opts)
  }
  return response
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'Server is missing GEMINI_API_KEY' })
  }

  const prompt = typeof req.body?.prompt === 'string' ? req.body.prompt.trim() : ''
  if (!prompt) {
    return res.status(400).json({ error: 'Missing prompt' })
  }

  try {
    const response = await callGemini(apiKey, {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.3 },
    })

    if (!response.ok) {
      const errorBody = await response.text()
      return res.status(response.status).json({ error: `Gemini API error: ${errorBody}` })
    }

    const data = await response.json()
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null
    return res.status(200).json({ text })
  } catch (error) {
    return res.status(500).json({ error: error?.message || 'Unexpected Gemini proxy error' })
  }
}
