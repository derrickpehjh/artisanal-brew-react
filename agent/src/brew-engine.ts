import type { AgentBean, BrewMethod, BrewParams } from './types.js'

interface MethodProfile {
  doseRange: [number, number]
  ratio: number
  tempRange: [number, number]
  grindBase: number
  grindSpread: number
  brewTimeRange: [number, number] // seconds
}

const PROFILES: Record<BrewMethod, MethodProfile> = {
  V60: {
    doseRange: [17, 20],
    ratio: 16,
    tempRange: [91, 94],
    grindBase: 24,
    grindSpread: 4,
    brewTimeRange: [165, 210], // 2:45 – 3:30
  },
  Chemex: {
    doseRange: [28, 32],
    ratio: 15,
    tempRange: [92, 95],
    grindBase: 30,
    grindSpread: 4,
    brewTimeRange: [240, 300], // 4:00 – 5:00
  },
  AeroPress: {
    doseRange: [14, 16],
    ratio: 13,
    tempRange: [85, 91],
    grindBase: 18,
    grindSpread: 4,
    brewTimeRange: [90, 150], // 1:30 – 2:30
  },
  'French Press': {
    doseRange: [22, 28],
    ratio: 16,
    tempRange: [94, 96],
    grindBase: 36,
    grindSpread: 4,
    brewTimeRange: [240, 270], // 4:00 – 4:30
  },
}

function randFloat(min: number, max: number, decimals = 1): number {
  const v = Math.random() * (max - min) + min
  return Math.round(v * Math.pow(10, decimals)) / Math.pow(10, decimals)
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function secsToTime(secs: number): string {
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

/**
 * Roast-level adjustments applied on top of method base values.
 * Lighter roasts → slightly lower temp, finer grind.
 * Darker roasts → slightly higher temp, coarser grind.
 */
function roastOffset(roastLevel: string): { temp: number; grind: number } {
  switch (roastLevel) {
    case 'Light':        return { temp: -1, grind: -1 }
    case 'Light-Medium': return { temp:  0, grind:  0 }
    case 'Medium':       return { temp:  1, grind:  0 }
    case 'Medium-Dark':  return { temp:  2, grind:  1 }
    case 'Dark':         return { temp:  3, grind:  2 }
    default:             return { temp:  0, grind:  0 }
  }
}

export function generateBrewParams(bean: AgentBean, method: BrewMethod): BrewParams {
  const p = PROFILES[method]
  const offset = roastOffset(bean.roastLevel)

  const dose  = randFloat(p.doseRange[0], p.doseRange[1])
  const water = Math.round(dose * p.ratio)
  const temp  = randInt(p.tempRange[0] + offset.temp, p.tempRange[1] + offset.temp)

  const grindMin = p.grindBase + offset.grind - Math.floor(p.grindSpread / 2)
  const grindMax = p.grindBase + offset.grind + Math.ceil(p.grindSpread / 2)
  const grind = randInt(grindMin, grindMax)

  const brewSecs = randInt(p.brewTimeRange[0], p.brewTimeRange[1])

  // Extraction: finer grind → higher extraction (roughly ±0.4% per click)
  const grindDelta = grind - p.grindBase
  const extraction = Math.round(
    (21 - grindDelta * 0.4 + randFloat(-0.8, 0.8)) * 10
  ) / 10

  return {
    dose,
    water,
    temp,
    grindSize: `${grind} clicks`,
    brewTime: secsToTime(brewSecs),
    extraction,
  }
}

export function formatRatio(dose: number, water: number): string {
  return `1:${(water / dose).toFixed(1)}`
}
