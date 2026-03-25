import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { loadData, setUser as setDataUser, getBeans, getBrews, getStats, addBean as _addBean, updateBean as _updateBean, deleteBean as _deleteBean, saveBrew as _saveBrew, resetAllData as _resetAllData, getPendingBrew, setPendingBrew, clearPendingBrew, getActiveBeanId, setActiveBeanId, formatDate, formatRatio, formatTime, buildChartPath, getTip, getPhases } from '../lib/appData'

const AppContext = createContext(null)

export function AppProvider({ children }) {
  const [user, setUser] = useState(null)
  const [beans, setBeans] = useState([])
  const [brews, setBrews] = useState([])
  const [loading, setLoading] = useState(true)
  const [initialized, setInitialized] = useState(false)

  const refresh = useCallback(async (currentUser) => {
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
    const markInitDone = () => {
      if (!initDone) {
        initDone = true
        setLoading(false)
        setInitialized(true)
      }
    }

    // Safety timeout — guarantees loading always clears even if auth hangs
    const safetyTimer = setTimeout(markInitDone, 10000)

    // onAuthStateChange fires immediately with INITIAL_SESSION in Supabase v2,
    // so this handles both the initial load and subsequent auth events.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const u = session?.user || null
      setUser(u)
      setDataUser(u)
      if (u) {
        await refresh(u)
      } else {
        setBeans([])
        setBrews([])
      }
      markInitDone()
    })

    return () => {
      subscription.unsubscribe()
      clearTimeout(safetyTimer)
    }
  }, [refresh])

  const addBean = useCallback(async (bean) => {
    const added = await _addBean(bean)
    setBeans([...getBeans()])
    return added
  }, [])

  const updateBean = useCallback(async (id, data) => {
    const updated = await _updateBean(id, data)
    setBeans([...getBeans()])
    return updated
  }, [])

  const deleteBean = useCallback(async (id) => {
    const deleted = await _deleteBean(id)
    setBeans([...getBeans()])
    setBrews(getBrews())
    return deleted
  }, [])

  const saveBrew = useCallback(async (brew) => {
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

  const signOut = useCallback(async () => {
    if (supabase) await supabase.auth.signOut()
    localStorage.removeItem('artisanal_pending_brew')
    localStorage.removeItem('artisanal_active_bean')
  }, [])

  const getActiveBean = useCallback(() => {
    const id = getActiveBeanId()
    return beans.find(b => b.id === id) || beans[0] || {}
  }, [beans])

  const getBestBrews = useCallback((n = 2) => {
    return [...brews].sort((a,b) => b.rating - a.rating || new Date(b.date)-new Date(a.date)).slice(0, n)
  }, [brews])

  const stats = getStats(beans, brews)

  const value = {
    user, beans, brews, loading, initialized,
    stats,
    refresh: () => refresh(user),
    addBean, updateBean, deleteBean, saveBrew, resetAllData, signOut,
    getActiveBean, setActiveBeanId, getBestBrews,
    getPendingBrew, setPendingBrew, clearPendingBrew,
    // Utilities
    formatDate, formatRatio, formatTime, buildChartPath, getTip, getPhases,
    isSupabaseConfigured,
    supabase,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used inside AppProvider')
  return ctx
}
