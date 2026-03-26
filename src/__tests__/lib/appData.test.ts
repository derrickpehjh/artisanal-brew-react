import { describe, it, expect } from 'vitest'
import { beanFromDb, beanToDb, brewFromDb, brewToDb } from '../../lib/appData'
import type { BeanDbRow } from '../../types/bean'
import type { BrewDbRow } from '../../types/brew'

const mockBeanRow: BeanDbRow = {
  id: 'bean-1',
  user_id: 'user-1',
  name: 'Ethiopia Yirgacheffe',
  origin: 'Ethiopia',
  process: 'Washed',
  roast_level: 'Light',
  roast_date: '2026-01-15',
  total_grams: 250,
  remaining_grams: 180,
  notes: 'Floral and citrus',
  community_rating: 4.5,
  community_reviews: 12,
}

const mockBrewRow: BrewDbRow = {
  id: 'brew-1',
  user_id: 'user-1',
  bean_id: 'bean-1',
  bean_name: 'Ethiopia Yirgacheffe',
  method: 'V60',
  dose: 18,
  water: 300,
  temp: 94,
  ratio: '1:16.7',
  grind_size: '24 clicks',
  brew_time: '3:15',
  rating: 5,
  taste_tags: ['Floral', 'Bright'],
  notes: 'Outstanding clarity',
  date: '2026-03-01',
  extraction: 22.1,
}

describe('beanFromDb', () => {
  it('maps snake_case DB row to camelCase Bean', () => {
    const bean = beanFromDb(mockBeanRow)
    expect(bean.id).toBe('bean-1')
    expect(bean.name).toBe('Ethiopia Yirgacheffe')
    expect(bean.roastLevel).toBe('Light')
    expect(bean.roastDate).toBe('2026-01-15')
    expect(bean.totalGrams).toBe(250)
    expect(bean.remainingGrams).toBe(180)
    expect(bean.communityRating).toBe(4.5)
    expect(bean.communityReviews).toBe(12)
  })
})

describe('beanToDb', () => {
  it('maps camelCase Bean back to snake_case DB row', () => {
    const bean = beanFromDb(mockBeanRow)
    const row = beanToDb(bean, 'user-1')
    expect(row.user_id).toBe('user-1')
    expect(row.roast_level).toBe('Light')
    expect(row.roast_date).toBe('2026-01-15')
    expect(row.total_grams).toBe(250)
    expect(row.remaining_grams).toBe(180)
  })

  it('roundtrips through beanFromDb without data loss', () => {
    const bean = beanFromDb(mockBeanRow)
    const row = beanToDb(bean, 'user-1')
    expect(row.id).toBe(mockBeanRow.id)
    expect(row.name).toBe(mockBeanRow.name)
    expect(row.origin).toBe(mockBeanRow.origin)
    expect(row.notes).toBe(mockBeanRow.notes)
  })
})

describe('brewFromDb', () => {
  it('maps snake_case DB row to camelCase Brew', () => {
    const brew = brewFromDb(mockBrewRow)
    expect(brew.id).toBe('brew-1')
    expect(brew.beanId).toBe('bean-1')
    expect(brew.beanName).toBe('Ethiopia Yirgacheffe')
    expect(brew.grindSize).toBe('24 clicks')
    expect(brew.brewTime).toBe('3:15')
    expect(brew.tasteTags).toEqual(['Floral', 'Bright'])
    expect(brew.extraction).toBe(22.1)
  })

  it('handles null bean_id gracefully', () => {
    const brew = brewFromDb({ ...mockBrewRow, bean_id: null })
    // mapper uses `r.bean_id ?? undefined` — null becomes undefined
    expect(brew.beanId == null).toBe(true)
  })

  it('defaults tasteTags to empty array when null', () => {
    const brew = brewFromDb({ ...mockBrewRow, taste_tags: null as unknown as string[] })
    expect(brew.tasteTags).toEqual([])
  })
})

describe('brewToDb', () => {
  it('maps camelCase Brew back to snake_case DB row', () => {
    const brew = brewFromDb(mockBrewRow)
    const row = brewToDb(brew, 'user-1')
    expect(row.grind_size).toBe('24 clicks')
    expect(row.brew_time).toBe('3:15')
    expect(row.bean_id).toBe('bean-1')
    expect(row.taste_tags).toEqual(['Floral', 'Bright'])
    expect(row.extraction).toBe(22.1)
  })

  it('handles missing beanId by storing null', () => {
    const brew = brewFromDb({ ...mockBrewRow, bean_id: null })
    const row = brewToDb(brew, 'user-1')
    expect(row.bean_id).toBeNull()
  })

  it('handles missing extraction by storing null', () => {
    const brew = brewFromDb({ ...mockBrewRow, extraction: null })
    const row = brewToDb(brew, 'user-1')
    expect(row.extraction).toBeNull()
  })
})
