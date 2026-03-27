/** Deterministic taste profile generator — used as fallback when Gemini is unavailable */

const POSITIVE_TAGS  = ['Balanced', 'Juicy', 'Bright', 'Syrupy', 'Floral', 'Citrus', 'Caramel', 'Chocolate', 'Nutty', 'Smooth']
const NEGATIVE_TAGS  = ['Sour', 'Bitter', 'Thin', 'Astringent', 'Earthy', 'Harsh']

/** Tags that naturally pair with specific origins */
const ORIGIN_TAGS: Record<string, string[]> = {
  Ethiopia:          ['Floral', 'Bright', 'Citrus', 'Juicy'],
  Colombia:          ['Caramel', 'Balanced', 'Citrus', 'Smooth'],
  Kenya:             ['Juicy', 'Bright', 'Citrus'],
  Indonesia:         ['Earthy', 'Chocolate', 'Nutty', 'Smooth'],
  Thailand:          ['Floral', 'Balanced', 'Juicy'],
  Myanmar:           ['Earthy', 'Chocolate', 'Nutty'],
  'El Salvador':     ['Chocolate', 'Nutty', 'Caramel', 'Balanced'],
  'Papua New Guinea': ['Earthy', 'Chocolate', 'Balanced'],
}

function pickRandom<T>(arr: T[], n: number): T[] {
  return [...arr].sort(() => Math.random() - 0.5).slice(0, Math.min(n, arr.length))
}

function dedupe(tags: string[]): string[] {
  return [...new Set(tags)]
}

export interface TasteProfile {
  rating: number
  tags: string[]
}

/**
 * Derive a taste profile from extraction % and bean metadata.
 *
 * Extraction zones:
 *   < 17   → severely under-extracted (sour, thin)
 *   17–19  → slightly under (bright, a touch sour)
 *   19–23  → ideal window  (positive origin-driven tags, high rating)
 *   23–25  → slightly over (bitter creeping in)
 *   > 25   → over-extracted (bitter, astringent)
 */
export function generateTasteProfile(
  extraction: number,
  origin: string,
  roastLevel: string
): TasteProfile {
  const originTags = ORIGIN_TAGS[origin] ?? ['Balanced']
  const darkBonus  = ['Medium-Dark', 'Dark'].includes(roastLevel) ? ['Chocolate'] : []

  if (extraction < 17) {
    return {
      rating: Math.random() < 0.4 ? 2 : 3,
      tags: dedupe(['Sour', 'Thin', ...pickRandom(['Bright', ...originTags], 1)]).slice(0, 3),
    }
  }
  if (extraction < 19) {
    return {
      rating: 3,
      tags: dedupe([...pickRandom(['Bright', 'Sour'], 1), ...pickRandom(originTags, 2)]).slice(0, 3),
    }
  }
  if (extraction <= 23) {
    return {
      rating: Math.random() < 0.65 ? 5 : 4,
      tags: dedupe([
        ...pickRandom(originTags, 2),
        ...pickRandom([...POSITIVE_TAGS, ...darkBonus], 2),
      ]).slice(0, 4),
    }
  }
  if (extraction <= 25) {
    return {
      rating: 3,
      tags: dedupe(['Bitter', ...pickRandom(originTags, 2)]).slice(0, 3),
    }
  }
  return {
    rating: Math.random() < 0.4 ? 2 : 3,
    tags: dedupe(['Bitter', 'Astringent', ...pickRandom(NEGATIVE_TAGS, 1)]).slice(0, 3),
  }
}

/** Rule-based personal notes — used when Gemini is unavailable */
export function generateFallbackNotes(
  beanName: string,
  method: string,
  rating: number,
  tags: string[],
  extraction: number
): string {
  const tagStr = tags.map(t => t.toLowerCase()).join(', ')

  const pools: Record<number, string[]> = {
    5: [
      `Excellent ${method} this morning. The ${beanName} gave a beautiful ${tagStr} cup. Extraction spot on at ${extraction.toFixed(1)}%.`,
      `Really happy with today's brew. ${tagStr.charAt(0).toUpperCase() + tagStr.slice(1)} — exactly what I was hoping for.`,
      `Best cup in a while. The ${beanName} is singing right now. ${method} suits it perfectly.`,
    ],
    4: [
      `Good brew. ${tagStr.charAt(0).toUpperCase() + tagStr.slice(1)}. Extraction at ${extraction.toFixed(1)}% — solid.`,
      `Nice ${method} session. The ${beanName} showed ${tagStr}. A touch of tweaking could push it higher.`,
      `Solid morning cup. ${tagStr.charAt(0).toUpperCase() + tagStr.slice(1)}. Will try grinding slightly finer tomorrow.`,
    ],
    3: [
      `Decent but not great. Got ${tagStr}. Extraction ${extraction.toFixed(1)}% — will adjust.`,
      `Okay cup. ${tagStr.charAt(0).toUpperCase() + tagStr.slice(1)}. The grind probably needs work.`,
      `Not the best I've had from ${beanName}. ${tagStr}. Back to basics tomorrow.`,
    ],
    2: [
      `Rough one today. ${tagStr.charAt(0).toUpperCase() + tagStr.slice(1)}. Grind clearly off — adjusting now.`,
      `Extraction at ${extraction.toFixed(1)}% and it shows — ${tagStr}. Will recalibrate.`,
    ],
    1: [
      `Undrinkable. ${tagStr}. Something went seriously wrong — will troubleshoot.`,
    ],
  }

  const options = pools[rating] ?? pools[3]!
  return options[Math.floor(Math.random() * options.length)]!
}
