// Custom title bar: logo, drag area, theme toggle, window controls
import { useState, useEffect, useCallback } from 'react'
import { Monitor, Sun, Moon, Settings, RefreshCw, Minus, Square, X } from 'lucide-react'
import { useDataStore } from '../../stores/dataStore'
import { useTheme } from '../../hooks/useTheme'
import { electronApi } from '../../lib/ipc'
import { cn } from '../../lib/utils'
import { useSettingsStore } from '../../stores/settingsStore'

const api = (window as { api?: { windowMinimize: () => void; windowMaximize: () => void; windowClose: () => void; platform: string } }).api
const isMac = api?.platform === 'darwin'

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

  const updateData = useDataStore((s) => s.updateData)
  const setProjects = useDataStore((s) => s.setProjects)

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true)
    try {
      const projects = await electronApi.refreshData()
      if (projects) setProjects(projects)
      const data = await electronApi.getTokenData('')
      updateData(data)
    } catch (err) {
      console.error('Refresh failed:', err)
    } finally {
      setIsRefreshing(false)
    }
  }, [updateData, setProjects])

  const themeIcon =
    theme === 'dark' ? <Moon className="h-4 w-4" /> :
    theme === 'light' ? <Sun className="h-4 w-4" /> :
    <Monitor className="h-4 w-4" />

  const formatTime = (date: Date | null) => {
    if (!date) return ''
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }

  return (
    <header className="flex h-10 select-none items-center border-b border-[var(--border)] bg-[var(--card)]" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}>
      {/* Left: Logo + Title — extra left padding on macOS for traffic-light buttons */}
      <div className={cn('flex items-center gap-2', isMac ? 'pl-20' : 'pl-3')}>
        <Monitor className="h-5 w-5 text-[var(--primary)]" />
        <span className="text-xs font-semibold text-[var(--foreground)]">CC Monitor</span>
      </div>

      {/* Center: draggable spacer */}
      <div className="flex-1" />

      {/* Right: Status + Actions + Window controls */}
      <div className="flex items-center" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        {/* Monitoring status */}
        <div className="flex items-center gap-1.5 px-2 text-xs text-[var(--muted-foreground)]">
          <span className={cn(
            'h-1.5 w-1.5 rounded-full transition-all',
            lastUpdated ? 'bg-green-500' : 'bg-gray-400',
            isBlinking && 'scale-150 opacity-70',
          )} />
          {lastUpdated ? formatTime(lastUpdated) : '等待中'}
        </div>

        {/* Refresh */}
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="rounded p-1.5 text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)] disabled:opacity-50"
          title="刷新"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', isRefreshing && 'animate-spin')} />
        </button>

        {/* Theme toggle */}
        <button
          onClick={cycleTheme}
          className="rounded p-1.5 text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
          title={`主题: ${theme}`}
        >
          {themeIcon}
        </button>

        {/* Settings */}
        <button
          onClick={() => useSettingsStore.getState().setSettingsOpen(true)}
          className="rounded p-1.5 text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
          title="设置"
        >
          <Settings className="h-3.5 w-3.5" />
        </button>

        {/* Window controls — Windows/Linux only (macOS uses native traffic-light) */}
        {!isMac && (
          <>
            <div className="mx-1.5 h-4 w-px bg-[var(--border)]" />
            <button
              onClick={() => api?.windowMinimize()}
              className="flex h-10 w-10 items-center justify-center text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
              title="最小化"
            >
              <Minus className="h-4 w-4" />
            </button>
            <button
              onClick={() => api?.windowMaximize()}
              className="flex h-10 w-10 items-center justify-center text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
              title="最大化"
            >
              <Square className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => api?.windowClose()}
              className="flex h-10 w-10 items-center justify-center text-[var(--muted-foreground)] hover:bg-red-500/80 hover:text-white"
              title="关闭"
            >
              <X className="h-4 w-4" />
            </button>
          </>
        )}
      </div>
    </header>
  )
}
