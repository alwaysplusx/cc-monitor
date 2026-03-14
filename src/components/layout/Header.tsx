// Top navigation bar: logo, project selector, theme toggle, monitoring status
import { Monitor, Sun, Moon, Settings, RefreshCw } from 'lucide-react'
import { useDataStore } from '../../stores/dataStore'
import { useTheme } from '../../hooks/useTheme'
import { cn } from '../../lib/utils'

export default function Header() {
  const projects = useDataStore((s) => s.projects)
  const currentProject = useDataStore((s) => s.currentProject)
  const setProject = useDataStore((s) => s.setProject)
  const lastUpdated = useDataStore((s) => s.lastUpdated)
  const { theme, cycleTheme } = useTheme()

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

      {/* Center: Project Selector */}
      <div className="flex items-center gap-2">
        <select
          className="h-8 rounded-md border border-[var(--border)] bg-[var(--background)] px-3 text-xs text-[var(--foreground)] outline-none"
          value={currentProject ?? ''}
          onChange={(e) => setProject(e.target.value || null)}
        >
          <option value="">All Projects</option>
          {projects.map((p) => (
            <option key={p.path} value={p.path}>
              {p.workingDir || p.path}
            </option>
          ))}
        </select>
      </div>

      {/* Right: Status + Theme + Settings */}
      <div className="flex items-center gap-3">
        {/* Monitoring status indicator */}
        <div className="flex items-center gap-1.5 text-xs text-[var(--muted-foreground)]">
          <span className={cn(
            'h-2 w-2 rounded-full',
            lastUpdated ? 'bg-green-500' : 'bg-gray-400',
          )} />
          {lastUpdated ? formatTime(lastUpdated) : 'waiting'}
        </div>

        {/* Refresh button */}
        <button
          className="rounded-md p-1.5 text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
          title="Refresh"
        >
          <RefreshCw className="h-4 w-4" />
        </button>

        {/* Theme toggle */}
        <button
          onClick={cycleTheme}
          className="rounded-md p-1.5 text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
          title={`Theme: ${theme}`}
        >
          {themeIcon}
        </button>

        {/* Settings */}
        <button
          className="rounded-md p-1.5 text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
          title="Settings"
        >
          <Settings className="h-4 w-4" />
        </button>
      </div>
    </header>
  )
}
