// Top navigation bar: logo, theme toggle, monitoring status
import { useState, useEffect, useCallback } from 'react'
import { Monitor, Sun, Moon, Settings, RefreshCw } from 'lucide-react'
import { useDataStore } from '../../stores/dataStore'
import { useTheme } from '../../hooks/useTheme'
import { electronApi } from '../../lib/ipc'
import { cn } from '../../lib/utils'

export default function Header() {
  const lastUpdated = useDataStore((s) => s.lastUpdated)
  const { theme, cycleTheme } = useTheme()
  const [isBlinking, setIsBlinking] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Blink the status dot when data updates
  useEffect(() => {
    if (lastUpdated) {
      setIsBlinking(true)
      const timer = setTimeout(() => setIsBlinking(false), 1000)
      return () => clearTimeout(timer)
    }
    return undefined
  }, [lastUpdated])

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true)
    try {
      await electronApi.refreshData()
    } catch (err) {
      console.error('Refresh failed:', err)
    } finally {
      setIsRefreshing(false)
    }
  }, [])

  const themeIcon =
    theme === 'dark' ? <Moon className="h-4 w-4" /> :
    theme === 'light' ? <Sun className="h-4 w-4" /> :
    <Monitor className="h-4 w-4" />

  const formatTime = (date: Date | null) => {
    if (!date) return ''
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }

  return (
    <header className="flex h-12 items-center justify-between border-b border-[var(--border)] bg-[var(--card)] px-4">
      {/* Left: Logo + Title */}
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-blue-500 to-purple-600 text-xs font-bold text-white">
          CC
        </div>
        <span className="text-sm font-semibold text-[var(--foreground)]">CC Monitor</span>
      </div>

      {/* Center: spacer */}
      <div />

      {/* Right: Status + Theme + Settings */}
      <div className="flex items-center gap-3">
        {/* Monitoring status indicator */}
        <div className="flex items-center gap-1.5 text-xs text-[var(--muted-foreground)]">
          <span className={cn(
            'h-2 w-2 rounded-full transition-all',
            lastUpdated ? 'bg-green-500' : 'bg-gray-400',
            isBlinking && 'scale-150 opacity-70',
          )} />
          {lastUpdated ? formatTime(lastUpdated) : '等待中'}
        </div>

        {/* Refresh button */}
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="rounded-md p-1.5 text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)] disabled:opacity-50"
          title="刷新"
        >
          <RefreshCw className={cn('h-4 w-4', isRefreshing && 'animate-spin')} />
        </button>

        {/* Theme toggle */}
        <button
          onClick={cycleTheme}
          className="rounded-md p-1.5 text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
          title={`主题: ${theme}`}
        >
          {themeIcon}
        </button>

        {/* Settings */}
        <button
          className="rounded-md p-1.5 text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
          title="设置"
        >
          <Settings className="h-4 w-4" />
        </button>
      </div>
    </header>
  )
}
