import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api } from '../api'

const AppContext = createContext(null)

export function AppProvider({ children }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const refresh = useCallback(async (silent = true) => {
    if (!silent) setLoading(true)
    try {
      const next = await api.bootstrap()
      setData(next)
      setError('')
      return next
    } catch (err) {
      setError(err.message || 'Не удалось подключиться к backend')
      throw err
    } finally {
      if (!silent) setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh(false).catch(() => {})
  }, [refresh])

  const setLanguage = useCallback(
    async (language) => {
      await api.updateSettings({ language })
      await refresh(true)
    },
    [refresh],
  )

  const value = useMemo(
    () => ({
      data,
      loading,
      error,
      refresh,
      setLanguage,
      lang: data?.settings?.language || 'ru',
      settings: data?.settings || {},
      stats: data?.stats || {},
    }),
    [data, error, loading, refresh, setLanguage],
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const value = useContext(AppContext)
  if (!value) throw new Error('useApp must be used inside AppProvider')
  return value
}

export function useBi() {
  const { lang } = useApp()
  return useCallback((ru, kg) => (lang === 'kg' ? kg : ru), [lang])
}
