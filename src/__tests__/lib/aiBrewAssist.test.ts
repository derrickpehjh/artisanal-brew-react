import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { suggestGrindAdjustment, getBrewAnalysis, assessFreshness } from '../../lib/aiBrewAssist'

const mockFetch = vi.fn()
global.fetch = mockFetch

function mockGeminiResponse(text: string) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ text }),
  })
}

function mockGeminiNetworkError() {
  mockFetch.mockRejectedValueOnce(new Error('Network error'))
}

function mockGeminiApiError(status = 429) {
  mockFetch.mockResolvedValue({ ok: false, status, json: async () => ({ error: 'Rate limited' }), text: async () => 'Rate limited' })
}

const baseGrindParams = {
  method: 'V60',
  grindSize: '24 clicks',
  dose: 18,
  water: 300,
  temp: 94,
  rating: 3,
}

describe('suggestGrindAdjustment', () => {
  beforeEach(() => mockFetch.mockReset())

  it('returns parsed AI response when Gemini succeeds', async () => {
    const aiResult = { direction: 'finer', amount: '1 click finer', reasoning: 'Sour notes indicate under-extraction', tip: 'Also raise temp' }
    mockGeminiResponse(JSON.stringify(aiResult))
    const result = await suggestGrindAdjustment(baseGrindParams)
    expect(result.direction).toBe('finer')
    expect(result.amount).toBe('1 click finer')
  })

  it('falls back to rule-based result on network error', async () => {
    mockGeminiNetworkError()
    const result = await suggestGrindAdjustment({ ...baseGrindParams, tasteTags: ['Sour'] })
    expect(result.direction).toBe('finer')
  })

  it('falls back to rule-based result when Gemini returns invalid JSON', async () => {
    mockGeminiResponse('not valid json at all')
    const result = await suggestGrindAdjustment({ ...baseGrindParams, tasteTags: ['Bitter'] })
    expect(result.direction).toBe('coarser')
  })

  it('fallback suggests finer grind for sour taste tags', async () => {
    mockGeminiNetworkError()
    const result = await suggestGrindAdjustment({ ...baseGrindParams, tasteTags: ['Sour', 'Bright'] })
    expect(result.direction).toBe('finer')
  })

  it('fallback suggests coarser grind for bitter taste tags', async () => {
    mockGeminiNetworkError()
    const result = await suggestGrindAdjustment({ ...baseGrindParams, tasteTags: ['Bitter', 'Astringent'] })
    expect(result.direction).toBe('coarser')
  })

  it('fallback suggests no change when taste is balanced', async () => {
    mockGeminiNetworkError()
    const result = await suggestGrindAdjustment({ ...baseGrindParams, tasteTags: ['Balanced', 'Caramel'], extraction: 22 })
    expect(result.direction).toBe('none')
  })

  it('fallback detects under-extraction from extraction % alone', async () => {
    mockGeminiNetworkError()
    const result = await suggestGrindAdjustment({ ...baseGrindParams, extraction: 16 })
    expect(result.direction).toBe('finer')
  })

  it('fallback detects over-extraction from extraction % alone', async () => {
    mockGeminiNetworkError()
    const result = await suggestGrindAdjustment({ ...baseGrindParams, extraction: 26 })
    expect(result.direction).toBe('coarser')
  })
})

describe('getBrewAnalysis', () => {
  beforeEach(() => mockFetch.mockReset())

  const baseAnalysisParams = {
    method: 'V60', dose: 18, water: 300, temp: 94,
    rating: 4, tasteTags: ['Floral', 'Bright'],
  }

  it('returns parsed AI response when Gemini succeeds', async () => {
    const aiResult = { headline: '"A bright, floral delight."', tip: 'Try 1 click finer.', extractionNote: 'Well extracted.' }
    mockGeminiResponse(JSON.stringify(aiResult))
    const result = await getBrewAnalysis(baseAnalysisParams)
    expect(result.headline).toBe('"A bright, floral delight."')
  })

  it('falls back gracefully on network error', async () => {
    mockGeminiNetworkError()
    const result = await getBrewAnalysis(baseAnalysisParams)
    expect(result).toHaveProperty('headline')
    expect(result).toHaveProperty('tip')
    expect(result).toHaveProperty('extractionNote')
    expect(result.isFallback).toBe(true)
  })

  it('fallback headline reflects high rating with no extraction issues', async () => {
    mockGeminiNetworkError()
    const result = await getBrewAnalysis({ ...baseAnalysisParams, rating: 5, tasteTags: ['Balanced'], extraction: 22 })
    expect(result.isFallback).toBe(true)
    expect(result.headline).toContain('worth saving')
  })

  it('fallback handles low rating with under-extraction tags', async () => {
    mockGeminiNetworkError()
    const result = await getBrewAnalysis({ ...baseAnalysisParams, rating: 1, tasteTags: ['Sour', 'Thin'] })
    expect(result.headline).toContain('under-extracted')
  })
})

describe('assessFreshness', () => {
  it('returns null for null input', () => {
    expect(assessFreshness(null)).toBeNull()
  })

  it('returns null for undefined input', () => {
    expect(assessFreshness(undefined)).toBeNull()
  })

  it('returns null for invalid date string', () => {
    expect(assessFreshness('not-a-date')).toBeNull()
  })

  it('detects a fresh roast (3-7 days old)', () => {
    const fourDaysAgo = new Date()
    fourDaysAgo.setDate(fourDaysAgo.getDate() - 4)
    const result = assessFreshness(fourDaysAgo.toISOString().split('T')[0])
    expect(result?.status).toBe('fresh')
  })

  it('detects a peak roast (7-21 days old)', () => {
    const tenDaysAgo = new Date()
    tenDaysAgo.setDate(tenDaysAgo.getDate() - 10)
    const result = assessFreshness(tenDaysAgo.toISOString().split('T')[0])
    expect(result?.status).toBe('peak')
  })

  it('detects a stale roast (over 60 days)', () => {
    const ninetyDaysAgo = new Date()
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)
    const result = assessFreshness(ninetyDaysAgo.toISOString().split('T')[0])
    expect(result?.status).toBe('stale')
  })

  it('returns days count correctly', () => {
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    const result = assessFreshness(sevenDaysAgo.toISOString().split('T')[0])
    expect(result?.days).toBeGreaterThanOrEqual(6)
    expect(result?.days).toBeLessThanOrEqual(8)
  })
})
