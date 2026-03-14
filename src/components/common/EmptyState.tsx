// Empty state placeholder with icon and guidance text
import { FolderSearch, BarChart3, AlertCircle } from 'lucide-react'

interface EmptyStateProps {
  type: 'welcome' | 'no-data' | 'error'
  message?: string
}

const configs = {
  welcome: {
    icon: FolderSearch,
    title: 'Welcome to CC Monitor',
    description: 'Monitoring ~/.claude/projects/ for Claude Code token usage data. Start a Claude Code session to see data here.',
  },
  'no-data': {
    icon: BarChart3,
    title: 'No Token Data',
    description: 'This project has no token usage records yet. Use Claude Code in this project to generate data.',
  },
  error: {
    icon: AlertCircle,
    title: 'Something went wrong',
    description: 'An error occurred while loading data.',
  },
}

export default function EmptyState({ type, message }: EmptyStateProps) {
  const config = configs[type]
  const Icon = config.icon

  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12">
      <Icon className="h-10 w-10 text-[var(--muted-foreground)] opacity-50" />
      <h3 className="text-sm font-medium text-[var(--foreground)]">{config.title}</h3>
      <p className="max-w-xs text-center text-xs text-[var(--muted-foreground)]">
        {message || config.description}
      </p>
    </div>
  )
}
