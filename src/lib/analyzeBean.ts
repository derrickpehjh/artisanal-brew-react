import type { BeanScanResult } from '../types/ai'

const MAX_IMAGE_PX = 768

function sampleCornerBg(data: Uint8ClampedArray, w: number, h: number): [number, number, number] {
  const px = (x: number, y: number): [number, number, number] => {
    const i = (y * w + x) * 4
    return [data[i], data[i + 1], data[i + 2]]
  }
  const corners = [px(0, 0), px(w - 1, 0), px(0, h - 1), px(w - 1, h - 1)]
  return corners[0].map((_, c) => Math.round(corners.reduce((s, p) => s + p[c], 0) / 4)) as [number, number, number]
}

interface ContentBounds { x: number; y: number; w: number; h: number }

function detectContentBounds(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, tolerance = 32): ContentBounds | null {
  const { width: w, height: h } = canvas
  const data = ctx.getImageData(0, 0, w, h).data
  const [bgR, bgG, bgB] = sampleCornerBg(data, w, h)
  const isBg = (i: number) =>
    Math.abs(data[i] - bgR) < tolerance &&
    Math.abs(data[i + 1] - bgG) < tolerance &&
    Math.abs(data[i + 2] - bgB) < tolerance

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

  if (cw * ch >= w * h * 0.95) return null
  return { x: cx, y: cy, w: cw, h: ch }
}

function resizeAndEncodeImage(file: File): Promise<string> {
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
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, w, h)

      const crop = detectContentBounds(canvas, ctx)
      if (crop) {
        const cropped = document.createElement('canvas')
        cropped.width = crop.w
        cropped.height = crop.h
        cropped.getContext('2d')!.drawImage(canvas, crop.x, crop.y, crop.w, crop.h, 0, 0, crop.w, crop.h)
        resolve(cropped.toDataURL('image/jpeg', 0.85).split(',')[1])
      } else {
        resolve(canvas.toDataURL('image/jpeg', 0.85).split(',')[1])
      }
    }
    img.onerror = reject
    img.src = url
  })
}

export async function analyzeBeanImage(imageFiles: File | File[]): Promise<BeanScanResult> {
  const files = Array.isArray(imageFiles) ? imageFiles : [imageFiles]

  const images = await Promise.all(
    files.map(async (file) => ({
      mimeType: 'image/jpeg',
      data: await resizeAndEncodeImage(file),
    }))
  )

  const prompt = `You are a coffee expert and OCR specialist. Analyse ${files.length > 1 ? 'these coffee bean bag images (different angles of the same bag)' : 'this coffee bean bag image'}. The label may be in any language — read all text, apply your coffee knowledge, and extract the fields below. Translate everything to English.

Return ONLY a valid JSON object with these exact fields (use null for any you cannot determine):
{
  "name": "Full bean name including any variety or farm",
  "origin": "Country or region of origin",
  "process": "Processing method in English (e.g. 'Washed', 'Natural', 'Honey', 'Double Anaerobic'). Check the entire label including the product name — it is often embedded there.",
  "roastLevel": "Exactly one of: Light, Light-Medium, Medium, Medium-Dark, Dark",
  "roastDate": "Roast date in YYYY-MM-DD format. If only month and year are visible use the 1st of that month.",
  "totalGrams": 250,
  "notes": "Tasting notes or flavour descriptors translated to English as a short sentence"
}

Return only the JSON object. No explanation, no markdown, no code block.`

  const response = await fetch('/api/gemini-image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, images }),
  })

  if (!response.ok) {
    const payload = await response.json().catch(() => ({})) as { error?: string }
    const message = payload?.error || `Image analysis error ${response.status}`
    throw new Error(message)
  }

  const data = await response.json() as { text?: string }
  const text = data?.text || ''
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('Could not parse AI response')

  return JSON.parse(jsonMatch[0]) as BeanScanResult
}
