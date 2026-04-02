import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Login from '../../pages/Login'
import * as AppContextModule from '../../context/AppContext'
import type { AppContextValue } from '../../types/context'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

function makeContext(overrides: Partial<AppContextValue> = {}): AppContextValue {
  return {
    user: null,
    beans: [],
    brews: [],
    loading: false,
    initialized: true,
    stats: { avgRating: 0, totalBrews: 0, consistencyPct: 0, weeklyVolumeLiters: 0, trendPct: 0, avgExtraction: null, extractionInRange: 0 },
    isSupabaseConfigured: true,
    supabase: null,
    refresh: vi.fn(),
    addBean: vi.fn(),
    updateBean: vi.fn(),
    deleteBean: vi.fn(),
    saveBrew: vi.fn(),
    resetAllData: vi.fn(),
    migrateExtractionValues: vi.fn().mockResolvedValue(0),
    signOut: vi.fn(),
    getActiveBean: vi.fn(() => null),
    setActiveBeanId: vi.fn(),
    getBestBrews: vi.fn(() => []),
    getPendingBrew: vi.fn(() => null),
    setPendingBrew: vi.fn(),
    clearPendingBrew: vi.fn(),
    formatDate: vi.fn((d: string) => d),
    formatRatio: vi.fn(() => '1:16'),
    formatTime: vi.fn(() => '0:00'),
    getTip: vi.fn(() => 'A tip'),
    getPhases: vi.fn(() => []),
    ...overrides,
  }
}

vi.spyOn(AppContextModule, 'useApp').mockImplementation(() => makeContext())

function renderLogin(contextOverrides: Partial<AppContextValue> = {}) {
  vi.spyOn(AppContextModule, 'useApp').mockReturnValue(makeContext(contextOverrides))
  return render(<MemoryRouter><Login /></MemoryRouter>)
}

describe('Login page', () => {
  beforeEach(() => {
    mockNavigate.mockReset()
    localStorage.clear()
  })

  it('renders sign-in heading', () => {
    renderLogin()
    expect(screen.getByText(/sign in to your cellar/i)).toBeInTheDocument()
  })

  it('renders Google sign-in button', () => {
    renderLogin()
    expect(screen.getByText(/continue with google/i)).toBeInTheDocument()
  })

  it('renders demo mode button', () => {
    renderLogin()
    expect(screen.getByText(/continue in demo mode/i)).toBeInTheDocument()
  })

  it('shows Supabase not configured warning when isSupabaseConfigured is false', () => {
    renderLogin({ isSupabaseConfigured: false })
    expect(screen.getByText(/authentication is not configured/i)).toBeInTheDocument()
  })

  it('redirects to / when user is already logged in', () => {
    renderLogin({ user: { id: 'u1', email: 'test@example.com' } as AppContextValue['user'] })
    expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true })
  })

  it('shows last google email hint when stored', () => {
    localStorage.setItem('artisanal_last_google_email', 'previous@example.com')
    renderLogin()
    expect(screen.getByText(/previous@example.com/)).toBeInTheDocument()
  })

  it('shows error when clicking Google sign-in with no supabase', async () => {
    const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {})
    renderLogin({ supabase: null, isSupabaseConfigured: false })
    fireEvent.click(screen.getByText(/continue with google/i))
    await waitFor(() => {
      expect(alertMock).toHaveBeenCalledWith(expect.stringContaining('not configured'))
    })
    alertMock.mockRestore()
  })

  it('shows error when clicking demo with no supabase', async () => {
    const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {})
    renderLogin({ supabase: null })
    fireEvent.click(screen.getByText(/continue in demo mode/i))
    await waitFor(() => {
      expect(alertMock).toHaveBeenCalledWith(expect.stringContaining('not configured'))
    })
    alertMock.mockRestore()
  })
})
