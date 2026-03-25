function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result.split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export async function analyzeBeanImage(imageFiles) {
  const files = Array.isArray(imageFiles) ? imageFiles : [imageFiles]
  
  // Convert images to base64 for API
  const images = await Promise.all(
    files.map(async (file) => ({
      mimeType: file.type || 'image/jpeg',
      data: await fileToBase64(file),
    }))
  )

  const prompt = `You are a coffee expert and OCR specialist. Analyse ${files.length > 1 ? 'these coffee bean bag images (different angles of the same bag)' : 'this coffee bean bag image'}. The bag may be printed in ANY language (Japanese, Korean, Chinese, Arabic, Thai, etc.) — read all text carefully and translate everything to English. Use all provided images together to fill in as many fields as possible.

For roastDate: look for any date near words like "roast", "焙煎", "로스팅", "烘焙", "torréfaction", "geröstet", or any date-like number sequence (DD/MM/YYYY, YYYY.MM.DD, etc.).
For totalGrams: look for a weight near "g", "gr", "gram", "oz", "net weight", "内容量", "중량", or any number followed by a weight unit. Convert oz to grams if needed (1 oz = 28.35g). Return as a plain number (e.g. 250).

Return ONLY a valid JSON object with these exact fields (use null for any you cannot determine):
{
  "name": "Full bean name, e.g. 'Ethiopia Yirgacheffe' or 'Colombia Huila El Paraiso'",
  "origin": "Country or region of origin",
  "process": "Processing method, e.g. 'Washed Process', 'Natural Process', 'Honey Process'",
  "roastLevel": "Exactly one of: Light, Light-Medium, Medium, Medium-Dark, Dark",
  "roastDate": "Roast date in YYYY-MM-DD format (e.g. '2024-10-12'). Convert from whatever format is printed. If only month and year are visible, use the 1st of that month (e.g. '2024-10-01').",
  "totalGrams": 250,
  "notes": "Tasting notes or flavour descriptors from the bag, translated to English and written as a short sentence"
}

Return only the JSON object. No explanation, no markdown, no code block.`

  const response = await fetch('/api/gemini-image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, images }),
  })

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}))
    const message = payload?.error || `Image analysis error ${response.status}`
    throw new Error(message)
  }

  const data = await response.json()
  const text = data?.text || ''
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('Could not parse AI response')

  return JSON.parse(jsonMatch[0])
}
