import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import TasteAnalysis from '../../pages/TasteAnalysis'
import * as AppContextModule from '../../context/AppContext'
import type { AppContextValue } from '../../types/context'
import type { Brew } from '../../types/brew'
import type { Bean } from '../../types/bean'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

// Mock AI lib to avoid real fetch calls
vi.mock('../../lib/aiBrewAssist', () => ({
  getBrewAnalysis: vi.fn().mockResolvedValue({
    headline: '"Mocked headline"',
    tip: 'Mocked tip',
    extractionNote: 'Mocked extraction note',
  }),
  suggestGrindAdjustment: vi.fn().mockResolvedValue({
    direction: 'finer',
    amount: '1 click finer',
    reasoning: 'Mocked reasoning',
    tip: 'Mocked tip',
  }),
}))

const mockBrew: Brew = {
  id: 'brew-1',
  beanId: 'bean-1',
  beanName: 'Ethiopia Yirgacheffe',
  method: 'V60',
  dose: 18,
  water: 300,
  temp: 94,
  ratio: '1:16.7',
  grindSize: '24 clicks',
  brewTime: '3:15',
  rating: 4,
  tasteTags: ['Floral'],
  notes: '',
  date: '2026-03-01',
  extraction: 22.1,
}

const mockBean: Bean = {
  id: 'bean-1',
  name: 'Ethiopia Yirgacheffe',
  origin: 'Ethiopia',
  process: 'Washed',
  roastLevel: 'Light',
  roastDate: '2026-01-15',
  totalGrams: 250,
  remainingGrams: 180,
  notes: 'Floral',
}

function makeContext(overrides: Partial<AppContextValue> = {}): AppContextValue {
  return {
    user: { id: 'u1', email: 'test@example.com' } as AppContextValue['user'],
    beans: [mockBean],
    brews: [],
    loading: false,
    initialized: true,
    stats: { avgRating: 4, totalBrews: 1, consistencyPct: 80, weeklyVolumeLiters: 1, weeklyYields: [], trendPct: 5, avgExtraction: null, extractionInRange: 0 },
    isSupabaseConfigured: true,
    supabase: null,
    refresh: vi.fn(),
    addBean: vi.fn(),
    updateBean: vi.fn(),
    deleteBean: vi.fn(),
    saveBrew: vi.fn().mockResolvedValue(mockBrew),
    resetAllData: vi.fn(),
    migrateExtractionValues: vi.fn().mockResolvedValue(0),
    signOut: vi.fn(),
    getActiveBean: vi.fn(() => mockBean),
    setActiveBeanId: vi.fn(),
    getBestBrews: vi.fn(() => []),
    getPendingBrew: vi.fn(() => mockBrew),
    setPendingBrew: vi.fn(),
    clearPendingBrew: vi.fn(),
    formatDate: vi.fn((d: string) => d),
    formatRatio: vi.fn(() => '1:16.7'),
    formatTime: vi.fn(() => '0:00'),
    buildChartPath: vi.fn(() => ({ rating: '', extraction: '' })),
    getTip: vi.fn(() => 'A tip'),
    getPhases: vi.fn(() => []),
    ...overrides,
  }
}

function renderTasteAnalysis(overrides: Partial<AppContextValue> = {}) {
  vi.spyOn(AppContextModule, 'useApp').mockReturnValue(makeContext(overrides))
  return render(<MemoryRouter><TasteAnalysis /></MemoryRouter>)
}

describe('TasteAnalysis page', () => {
  beforeEach(() => {
    mockNavigate.mockReset()
  })

  it('renders the post-brew analysis heading', () => {
    renderTasteAnalysis()
    expect(screen.getByText(/post-brew analysis/i)).toBeInTheDocument()
  })

  it('renders overall satisfaction section', () => {
    renderTasteAnalysis()
    expect(screen.getByText(/overall satisfaction/i)).toBeInTheDocument()
  })

  it('renders taste profile section', () => {
    renderTasteAnalysis()
    expect(screen.getByText(/taste profile/i)).toBeInTheDocument()
  })

  it('renders the save to history button', () => {
    renderTasteAnalysis()
    expect(screen.getByText(/save to history/i)).toBeInTheDocument()
  })

  it('renders bean name in today\'s roast section', () => {
    renderTasteAnalysis()
    expect(screen.getAllByText(/ethiopia yirgacheffe/i).length).toBeGreaterThan(0)
  })

  it('renders default taste tags', () => {
    renderTasteAnalysis()
    expect(screen.getByText('Balanced')).toBeInTheDocument()
    expect(screen.getByText('Floral')).toBeInTheDocument()
  })

  it('toggles a taste tag when clicked', () => {
    renderTasteAnalysis()
    const tag = screen.getByText('Nutty')
    // Should be inactive before click
    expect(tag.className).not.toContain('tag-active')
    fireEvent.click(tag)
    expect(tag.className).toContain('tag-active')
    // Click again to deactivate
    fireEvent.click(tag)
    expect(tag.className).not.toContain('tag-active')
  })

  it('shows discard confirmation prompt on discard click', () => {
    const confirmMock = vi.spyOn(window, 'confirm').mockReturnValue(false)
    renderTasteAnalysis()
    fireEvent.click(screen.getByText(/discard session/i))
    expect(confirmMock).toHaveBeenCalled()
    confirmMock.mockRestore()
  })

  it('navigates away after discard confirmation', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    renderTasteAnalysis()
    fireEvent.click(screen.getByText(/discard session/i))
    expect(mockNavigate).toHaveBeenCalledWith('/')
  })

  it('saves brew and shows grind suggestion after saving', async () => {
    renderTasteAnalysis()
    fireEvent.click(screen.getByText(/save to history/i))
    await waitFor(() => {
      expect(screen.getByText(/brew saved/i)).toBeInTheDocument()
    })
  })

  it('shows save error when saveBrew rejects', async () => {
    const ctx = makeContext({ saveBrew: vi.fn().mockRejectedValue(new Error('DB unavailable')) })
    vi.spyOn(AppContextModule, 'useApp').mockReturnValue(ctx)
    render(<MemoryRouter><TasteAnalysis /></MemoryRouter>)
    fireEvent.click(screen.getByText(/save to history/i))
    await waitFor(() => {
      expect(screen.getByText(/db unavailable/i)).toBeInTheDocument()
    })
  })
})
