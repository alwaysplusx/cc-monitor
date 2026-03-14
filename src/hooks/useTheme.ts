// Hook for light/dark/system theme management
import { useEffect, useCallback } from 'react'
import { useSettingsStore } from '../stores/settingsStore'
import { electronApi } from '../lib/ipc'

type ThemeMode = 'light' | 'dark' | 'system'

function applyTheme(mode: ThemeMode): void {
  const root = document.documentElement
  let isDark: boolean

  if (mode === 'system') {
    isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  } else {
    isDark = mode === 'dark'
  }

  root.classList.toggle('dark', isDark)
  root.setAttribute('data-theme', isDark ? 'dark' : 'light')
}

export function useTheme() {
  const theme = useSettingsStore((s) => s.theme)
  const setTheme = useSettingsStore((s) => s.setTheme)

  // Apply theme on change
  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  // Listen to system preference changes when in 'system' mode
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => {
      if (theme === 'system') {
        applyTheme('system')
      }
    }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [theme])

  const cycleTheme = useCallback(() => {
    const modes: ThemeMode[] = ['light', 'dark', 'system']
    const nextIndex = (modes.indexOf(theme) + 1) % modes.length
    const next = modes[nextIndex]
    setTheme(next)
    electronApi.saveSettings({ theme: next }).catch(console.error)
  }, [theme, setTheme])

  const isDark =
    theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)

  return { theme, isDark, cycleTheme }
}
