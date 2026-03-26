const MAX_IMAGE_PX = 768

// Detect the background color from the four corner pixels
function sampleCornerBg(data, w, h) {
  const px = (x, y) => { const i = (y * w + x) * 4; return [data[i], data[i+1], data[i+2]] }
  const corners = [px(0,0), px(w-1,0), px(0,h-1), px(w-1,h-1)]
  return corners[0].map((_, c) => Math.round(corners.reduce((s, p) => s + p[c], 0) / 4))
}

// Return content bounding box, or null if crop saves less than 5%
function detectContentBounds(canvas, ctx, tolerance = 32) {
  const { width: w, height: h } = canvas
  const data = ctx.getImageData(0, 0, w, h).data
  const [bgR, bgG, bgB] = sampleCornerBg(data, w, h)
  const isBg = i =>
    Math.abs(data[i]   - bgR) < tolerance &&
    Math.abs(data[i+1] - bgG) < tolerance &&
    Math.abs(data[i+2] - bgB) < tolerance

  let top = 0, bottom = h - 1, left = 0, right = w - 1

  outer: for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (!isBg((y * w + x) * 4)) { top = y; break outer }

  outer: for (let y = h - 1; y >= 0; y--)
    for (let x = 0; x < w; x++)
      if (!isBg((y * w + x) * 4)) { bottom = y; break outer }

  outer: for (let x = 0; x < w; x++)
    for (let y = 0; y < h; y++)
      if (!isBg((y * w + x) * 4)) { left = x; break outer }

  outer: for (let x = w - 1; x >= 0; x--)
    for (let y = 0; y < h; y++)
      if (!isBg((y * w + x) * 4)) { right = x; break outer }

  const pad = Math.round(Math.min(w, h) * 0.04)
  const cx = Math.max(0, left - pad), cy = Math.max(0, top - pad)
  const cw = Math.min(w, right + pad + 1) - cx
  const ch = Math.min(h, bottom + pad + 1) - cy

  // Skip crop if it reduces area by less than 5%
  if (cw * ch >= w * h * 0.95) return null
  return { x: cx, y: cy, w: cw, h: ch }
}

function resizeAndEncodeImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const scale = Math.min(1, MAX_IMAGE_PX / Math.max(img.width, img.height))
      const w = Math.round(img.width * scale)
      const h = Math.round(img.height * scale)
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0, w, h)

      const crop = detectContentBounds(canvas, ctx)
      if (crop) {
        const cropped = document.createElement('canvas')
        cropped.width = crop.w
        cropped.height = crop.h
        cropped.getContext('2d').drawImage(canvas, crop.x, crop.y, crop.w, crop.h, 0, 0, crop.w, crop.h)
        resolve(cropped.toDataURL('image/jpeg', 0.85).split(',')[1])
      } else {
        resolve(canvas.toDataURL('image/jpeg', 0.85).split(',')[1])
      }
    }
    img.onerror = reject
    img.src = url
  })
}

export async function analyzeBeanImage(imageFiles) {
  const files = Array.isArray(imageFiles) ? imageFiles : [imageFiles]

  const images = await Promise.all(
    files.map(async (file) => ({
      mimeType: 'image/jpeg',
      data: await resizeAndEncodeImage(file),
    }))
  )

  const prompt = `You are a coffee expert and OCR specialist. Analyse ${files.length > 1 ? 'these coffee bean bag images (different angles of the same bag)' : 'this coffee bean bag image'}. The bag may be printed in ANY language (Japanese, Korean, Chinese, Arabic, Thai, etc.) — read all text carefully and translate everything to English. Use all provided images together to fill in as many fields as possible.

For process: look for words like "washed", "natural", "honey", "anaerobic", "wet", "dry", "pulped", "lavado", "naturel", "miel", "水洗", "日晒", "蜜处理", "ナチュラル", "ウォッシュド", "워시드", "내추럴", "허니". Map to the closest English name (e.g. "水洗" → "Washed Process", "日晒" → "Natural Process"). If the bag only states a country/farm with no process mentioned, return null.
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
