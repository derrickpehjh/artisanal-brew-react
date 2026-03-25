function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result.split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export async function analyzeBeanImage(imageFiles) {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY
  if (!apiKey || apiKey === 'your_key_here') {
    throw new Error('Add your free Gemini API key to .env.local as VITE_GEMINI_API_KEY — get one at aistudio.google.com/app/apikey')
  }

  const files = Array.isArray(imageFiles) ? imageFiles : [imageFiles]
  const imageParts = await Promise.all(
    files.map(async (file) => ({
      inline_data: { mime_type: file.type || 'image/jpeg', data: await fileToBase64(file) },
    }))
  )

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            ...imageParts,
            {
              text: `You are a coffee expert and OCR specialist. Analyse ${files.length > 1 ? 'these coffee bean bag images (different angles of the same bag)' : 'this coffee bean bag image'}. The bag may be printed in ANY language (Japanese, Korean, Chinese, Arabic, Thai, etc.) — read all text carefully and translate everything to English. Use all provided images together to fill in as many fields as possible.

For roastDate: look for any date near words like "roast", "焙煎", "로스팅", "烘焙", "torréfaction", "geröstet", or any date-like number sequence (DD/MM/YYYY, YYYY.MM.DD, etc.).
For totalGrams: look for a weight near "g", "gr", "gram", "oz", "net weight", "内容量", "중량", or any number followed by a weight unit. Convert oz to grams if needed (1 oz = 28.35g). Return as a plain number (e.g. 250).

Return ONLY a valid JSON object with these exact fields (use null for any you cannot determine):
{
  "name": "Full bean name, e.g. 'Ethiopia Yirgacheffe' or 'Colombia Huila El Paraiso'",
  "origin": "Country or region of origin",
  "process": "Processing method, e.g. 'Washed Process', 'Natural Process', 'Honey Process'",
  "roastLevel": "Exactly one of: Light, Light-Medium, Medium, Medium-Dark, Dark",
  "roastDate": "Roast date as printed on the bag (any format is fine, e.g. '2024.10.12' or 'Oct 12 2024')",
  "totalGrams": 250,
  "notes": "Tasting notes or flavour descriptors from the bag, translated to English and written as a short sentence"
}

Return only the JSON object. No explanation, no markdown, no code block.`,
            },
          ],
        }],
        generationConfig: { temperature: 0.1 },
      }),
    }
  )

  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(err.error?.message || `API error ${response.status}`)
  }

  const data = await response.json()
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || ''
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('Could not parse AI response')

  return JSON.parse(jsonMatch[0])
}
