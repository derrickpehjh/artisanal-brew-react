import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Dashboard from '../../pages/Dashboard'
import * as AppContextModule from '../../context/AppContext'
import type { AppContextValue } from '../../types/context'
import type { Bean } from '../../types/bean'
import type { Brew } from '../../types/brew'

const mockBean: Bean = {
  id: 'bean-1',
  name: 'Kenya Nyeri',
  origin: 'Kenya',
  process: 'Washed',
  roastLevel: 'Medium',
  roastDate: '2026-02-01',
  totalGrams: 300,
  remainingGrams: 200,
  notes: 'Bright and juicy',
}

const mockBrew: Brew = {
  id: 'brew-1',
  beanId: 'bean-1',
  beanName: 'Kenya Nyeri',
  method: 'V60',
  dose: 18,
  water: 300,
  temp: 94,
  ratio: '1:16.7',
  grindSize: '24 clicks',
  brewTime: '3:15',
  rating: 4,
  tasteTags: ['Bright'],
  notes: 'Excellent',
  date: '2026-03-01',
  extraction: 22,
}

function makeContext(overrides: Partial<AppContextValue> = {}): AppContextValue {
  return {
    user: { id: 'u1', email: 'test@example.com' } as AppContextValue['user'],
    beans: [mockBean],
    brews: [mockBrew],
    loading: false,
    initialized: true,
    stats: { avgRating: 4, totalBrews: 1, consistencyPct: 80, weeklyVolumeLiters: 1.5, weeklyYields: [20, 40, 60, 80, 100, 100, 80], trendPct: 5, avgExtraction: null, extractionInRange: 0 },
    isSupabaseConfigured: true,
    supabase: null,
    refresh: vi.fn(),
    addBean: vi.fn(),
    updateBean: vi.fn(),
    deleteBean: vi.fn(),
    saveBrew: vi.fn(),
    resetAllData: vi.fn(),
    signOut: vi.fn(),
    getActiveBean: vi.fn(() => mockBean),
    setActiveBeanId: vi.fn(),
    getBestBrews: vi.fn(() => [mockBrew]),
    getPendingBrew: vi.fn(() => null),
    setPendingBrew: vi.fn(),
    clearPendingBrew: vi.fn(),
    formatDate: vi.fn((d: string) => d),
    formatRatio: vi.fn(() => '1:16.7'),
    formatTime: vi.fn(() => '0:00'),
    buildChartPath: vi.fn(() => ({ rating: '', extraction: '' })),
    getTip: vi.fn(() => 'Pre-infusion tip'),
    getPhases: vi.fn(() => []),
    ...overrides,
  }
}

function renderDashboard(overrides: Partial<AppContextValue> = {}) {
  vi.spyOn(AppContextModule, 'useApp').mockReturnValue(makeContext(overrides))
  return render(<MemoryRouter><Dashboard /></MemoryRouter>)
}

describe('Dashboard page', () => {
  it('renders The Cellar heading', () => {
    renderDashboard()
    expect(screen.getByText(/the cellar/i)).toBeInTheDocument()
  })

  it('shows active bean name', () => {
    renderDashboard()
    expect(screen.getAllByText(/kenya nyeri/i).length).toBeGreaterThan(0)
  })

  it('shows bean stock percentage bar', () => {
    renderDashboard()
    expect(screen.getByText(/remaining/i)).toBeInTheDocument()
  })

  it('renders last brew archive section', () => {
    renderDashboard()
    expect(screen.getByText(/last brew archive/i)).toBeInTheDocument()
  })

  it('shows last brew details', () => {
    renderDashboard()
    expect(screen.getAllByText(/kenya nyeri/i).length).toBeGreaterThan(0)
    expect(screen.getByText('V60')).toBeInTheDocument()
  })

  it('renders efficiency section with consistency rating', () => {
    renderDashboard()
    expect(screen.getByText(/consistency rating/i)).toBeInTheDocument()
    expect(screen.getByText('80%')).toBeInTheDocument()
  })

  it('renders artisan tip', () => {
    renderDashboard()
    expect(screen.getByText(/pre-infusion tip/i)).toBeInTheDocument()
  })

  it('shows "No brews yet" when brews list is empty', () => {
    renderDashboard({ brews: [], getPendingBrew: vi.fn(() => null) })
    expect(screen.getByText(/no brews yet/i)).toBeInTheDocument()
  })

  it('renders start new brew CTA', () => {
    renderDashboard()
    expect(screen.getByText(/start new brew/i)).toBeInTheDocument()
  })
})
