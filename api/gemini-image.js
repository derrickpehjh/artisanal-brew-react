const GEMINI_MODEL = 'gemini-2.0-flash'
const RETRY_DELAYS_MS = [5000, 15000, 30000]

async function callGemini(apiKey, body) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`
  const opts = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
  let response = await fetch(url, opts)
  for (const delay of RETRY_DELAYS_MS) {
    if (response.status !== 429) break
    await new Promise(r => setTimeout(r, delay))
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

  try {
    // req.body should be { prompt, images: [{ mimeType, data }, ...] }
    const { prompt, images } = req.body

    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid prompt' })
    }

    if (!Array.isArray(images) || images.length === 0) {
      return res.status(400).json({ error: 'Missing or invalid images array' })
    }

    // Build parts array: image data + text prompt
    const parts = [
      ...images.map(img => ({
        inline_data: {
          mime_type: img.mimeType || 'image/jpeg',
          data: img.data, // Should already be base64
        },
      })),
      { text: prompt },
    ]

    const response = await callGemini(apiKey, {
      contents: [{ parts }],
      generationConfig: { temperature: 0.1 },
    })

    if (!response.ok) {
      const errorBody = await response.text()
      return res.status(response.status).json({ error: `Gemini API error: ${errorBody}` })
    }

    const data = await response.json()
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null
    return res.status(200).json({ text })
  } catch (error) {
    return res.status(500).json({ error: error?.message || 'Unexpected Gemini image proxy error' })
  }
}
