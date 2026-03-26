import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Mock localStorage
const localStorageStore: Record<string, string> = {}
const localStorageMock = {
  getItem: (key: string) => localStorageStore[key] ?? null,
  setItem: (key: string, value: string) => { localStorageStore[key] = value },
  removeItem: (key: string) => { delete localStorageStore[key] },
  clear: () => { Object.keys(localStorageStore).forEach(k => delete localStorageStore[k]) },
  get length() { return Object.keys(localStorageStore).length },
  key: (i: number) => Object.keys(localStorageStore)[i] ?? null,
}
Object.defineProperty(window, 'localStorage', { value: localStorageMock })

// Mock fetch
global.fetch = vi.fn()

// Mock navigator.share / clipboard
Object.defineProperty(navigator, 'share', { value: undefined, writable: true })
Object.defineProperty(navigator, 'clipboard', {
  value: { writeText: vi.fn().mockResolvedValue(undefined) },
  writable: true,
})

// Silence console.warn in tests
vi.spyOn(console, 'warn').mockImplementation(() => {})
