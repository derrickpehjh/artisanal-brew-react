import type { BrewMethod } from './types.js'

export const PERSONA = {
  name: 'Wei Liang',
  location: 'Singapore',
  timezone: 'Asia/Singapore',

  /** Resolved at runtime from AGENT_USER_ID env var; falls back to a fixed demo UUID */
  get userId(): string {
    return process.env.AGENT_USER_ID ?? 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
  },

  /** Preferred brew method by day of week */
  preferredMethods: {
    weekday: 'V60' as BrewMethod,
    saturday: 'Chemex' as BrewMethod,
    sunday: 'AeroPress' as BrewMethod,
  },

  /** Grams remaining at which Wei Liang places a new order */
  lowThreshold: 150,
  /** Grams remaining at which it is considered urgent — brew sparingly */
  criticalThreshold: 50,

  /** Brew window in Singapore time (hour range, 24h) */
  brewHourRange: [7, 8] as [number, number],
}

/** Singapore specialty roasters Wei Liang rotates through */
export const SINGAPORE_ROASTERS = [
  'Nylon Coffee Roasters',
  'The Roastery by Bonanza',
  'Homeground Coffee Roasters',
  'PPP Coffee',
  'Chye Seng Huat Hardware',
  'Common Man Coffee Roasters',
]

/** Bean catalog — rotating selection of single-origin bags Wei Liang buys */
export interface BeanTemplate {
  name: string
  origin: string
  process: string
  roastLevel: string
  notes: string
  roaster: string
}

export const BEAN_CATALOG: BeanTemplate[] = [
  {
    name: 'Yirgacheffe Natural G1',
    origin: 'Ethiopia',
    process: 'Natural',
    roastLevel: 'Light',
    roaster: 'Nylon Coffee Roasters',
    notes: 'Blueberry, jasmine, bergamot. Vivid and expressive.',
  },
  {
    name: 'Huila Honey Process',
    origin: 'Colombia',
    process: 'Honey',
    roastLevel: 'Light-Medium',
    roaster: 'PPP Coffee',
    notes: 'Stone fruit, brown sugar, milk chocolate. Sweet and approachable.',
  },
  {
    name: 'Kirinyaga AA Washed',
    origin: 'Kenya',
    process: 'Washed',
    roastLevel: 'Light',
    roaster: 'Homeground Coffee Roasters',
    notes: 'Blackcurrant, tomato, lemon zest. Bright and juicy.',
  },
  {
    name: 'Gayo Mountain Anaerobic',
    origin: 'Indonesia',
    process: 'Anaerobic',
    roastLevel: 'Medium',
    roaster: 'Chye Seng Huat Hardware',
    notes: 'Dark cherry, cocoa, earthy spice. Complex and full-bodied.',
  },
  {
    name: 'Doi Chang Single Estate',
    origin: 'Thailand',
    process: 'Washed',
    roastLevel: 'Light-Medium',
    roaster: 'The Roastery by Bonanza',
    notes: 'Peach, oolong tea, sweet citrus. Delicate and clean.',
  },
  {
    name: 'Cauca Washed',
    origin: 'Colombia',
    process: 'Washed',
    roastLevel: 'Light',
    roaster: 'Common Man Coffee Roasters',
    notes: 'Red apple, caramel, floral. Clean and structured.',
  },
  {
    name: 'Sidama Natural',
    origin: 'Ethiopia',
    process: 'Natural',
    roastLevel: 'Light',
    roaster: 'Nylon Coffee Roasters',
    notes: 'Strawberry, rose, tropical fruit. Funky and expressive.',
  },
  {
    name: 'Antigua SHB Washed',
    origin: 'El Salvador',
    process: 'Washed',
    roastLevel: 'Medium',
    roaster: 'PPP Coffee',
    notes: 'Walnut, dark chocolate, dried fruit. Balanced and rich.',
  },
  {
    name: 'Flores Bajawa Washed',
    origin: 'Indonesia',
    process: 'Washed',
    roastLevel: 'Medium',
    roaster: 'Homeground Coffee Roasters',
    notes: 'Brown sugar, cedar, gentle spice. Smooth and clean.',
  },
  {
    name: 'Guji Natural',
    origin: 'Ethiopia',
    process: 'Natural',
    roastLevel: 'Light',
    roaster: 'Chye Seng Huat Hardware',
    notes: 'Peach, jasmine, creamy mouthfeel. Elegant and sweet.',
  },
]
