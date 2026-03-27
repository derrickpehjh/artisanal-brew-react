import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import {
  loadData, setUser as setDataUser, getBeans, getBrews, getStats,
  addBean as _addBean, updateBean as _updateBean, deleteBean as _deleteBean,
  saveBrew as _saveBrew, resetAllData as _resetAllData, migrateExtractionValues as _migrateExtractionValues,
  getPendingBrew, setPendingBrew, clearPendingBrew,
  getActiveBeanId,
  formatDate, formatRatio, formatTime, buildChartPath, getTip, getPhases,
} from '../lib/appData'
import type { User } from '@supabase/supabase-js'
import type { Bean } from '../types/bean'
import type { Brew } from '../types/brew'
import type { AppContextValue } from '../types/context'

const AppContext = createContext<AppContextValue | null>(null)

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [beans, setBeans] = useState<Bean[]>([])
  const [brews, setBrews] = useState<Brew[]>([])
  const [loading, setLoading] = useState(true)
  const [initialized, setInitialized] = useState(false)
  const [activeBeanId, setActiveBeanIdState] = useState<string>(() => getActiveBeanId() || '')

  const refresh = useCallback(async (currentUser: User) => {
    if (!currentUser) return
    try {
      const data = await loadData(currentUser)
      setBeans([...data.beans])
      setBrews([...data.brews])
    } catch (e) {
      console.error('Data load failed:', e)
    }
  }, [])

  useEffect(() => {
    if (!supabase) {
      setLoading(false)
      setInitialized(true)
      return
    }

    let initDone = false
    let loadedUserId: string | null = null
    const markInitDone = () => {
      if (!initDone) {
        initDone = true
        setLoading(false)
        setInitialized(true)
      }
    }

    const safetyTimer = setTimeout(markInitDone, 10000)

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const u = session?.user || null
      const uid = u?.id || null

      if (uid !== loadedUserId) {
        loadedUserId = uid
        setUser(u)
        setDataUser(u)
        if (u) {
          if (u.user_metadata?.brew_prefs) {
            try { localStorage.setItem('artisanal_brew_prefs', JSON.stringify(u.user_metadata.brew_prefs)) } catch { /* ignore */ }
          }
          await refresh(u)
        } else {
          setBeans([])
          setBrews([])
        }
      }

      markInitDone()
    })

    return () => {
      subscription.unsubscribe()
      clearTimeout(safetyTimer)
    }
  }, [refresh])

  const addBean = useCallback(async (bean: Omit<Bean, 'id'> & { id?: string }) => {
    const added = await _addBean(bean)
    setBeans([...getBeans()])
    return added
  }, [])

  const updateBean = useCallback(async (id: string, data: Partial<Bean>) => {
    const updated = await _updateBean(id, data)
    setBeans([...getBeans()])
    return updated
  }, [])

  const deleteBean = useCallback(async (id: string) => {
    const deleted = await _deleteBean(id)
    setBeans([...getBeans()])
    setBrews(getBrews())
    return deleted
  }, [])

  const saveBrew = useCallback(async (brew: Partial<Brew>) => {
    const saved = await _saveBrew(brew)
    setBeans([...getBeans()])
    setBrews(getBrews())
    return saved
  }, [])

  const resetAllData = useCallback(async () => {
    if (!user) return
    await _resetAllData(user.id)
    setBeans([])
    setBrews([])
  }, [user])

  const migrateExtractionValues = useCallback(async () => {
    const count = await _migrateExtractionValues()
    if (count > 0) setBrews(getBrews())
    return count
  }, [])

  const signOut = useCallback(async () => {
    if (supabase) await supabase.auth.signOut()
    localStorage.removeItem('artisanal_pending_brew')
    localStorage.removeItem('artisanal_active_bean')
  }, [])

  const setActiveBeanId = useCallback((id: string) => {
    localStorage.setItem('artisanal_active_bean', id)
    setActiveBeanIdState(id)
  }, [])

  const getActiveBean = useCallback((): Bean => {
    return beans.find(b => b.id === activeBeanId) || beans[0] || ({} as Bean)
  }, [beans, activeBeanId])

  const getBestBrews = useCallback((n = 2): Brew[] => {
    return [...brews].sort((a, b) => b.rating - a.rating || new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, n)
  }, [brews])

  const stats = useMemo(() => getStats(beans, brews), [beans, brews])

  const value: AppContextValue = {
    user, beans, brews, loading, initialized,
    stats,
    refresh: () => (user ? refresh(user) : Promise.resolve()),
    addBean, updateBean, deleteBean, saveBrew, resetAllData, migrateExtractionValues, signOut,
    getActiveBean, setActiveBeanId, getBestBrews,
    getPendingBrew, setPendingBrew, clearPendingBrew,
    formatDate, formatRatio, formatTime, buildChartPath, getTip, getPhases,
    isSupabaseConfigured,
    supabase,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used inside AppProvider')
  return ctx
}
