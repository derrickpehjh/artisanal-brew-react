export interface Bean {
  id: string
  name: string
  origin: string
  process: string
  roastLevel: string
  roastDate: string | null
  totalGrams: number
  remainingGrams: number
  notes: string
  communityRating?: number | null
  communityReviews?: number | null
}

export interface BeanDbRow {
  id: string
  user_id: string
  name: string
  origin: string
  process: string
  roast_level: string
  roast_date: string | null
  total_grams: number
  remaining_grams: number
  notes: string
  community_rating: number | null
  community_reviews: number | null
  created_at?: string
}

export type BeanFormState = {
  name: string
  origin: string
  process: string
  roastLevel: string
  roastDate: string
  totalGrams: string
  remainingGrams: string
  notes: string
}

export type RoastLevel = 'Light' | 'Light-Medium' | 'Medium' | 'Medium-Dark' | 'Dark'

export const ROAST_LEVELS: RoastLevel[] = ['Light', 'Light-Medium', 'Medium', 'Medium-Dark', 'Dark']
