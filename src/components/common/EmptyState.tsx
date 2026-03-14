// Empty state placeholder with icon and guidance text
import { FolderSearch, BarChart3, AlertCircle } from 'lucide-react'

interface EmptyStateProps {
  type: 'welcome' | 'no-data' | 'error'
  message?: string
}

const configs = {
  welcome: {
    icon: FolderSearch,
    title: '欢迎使用 CC Monitor',
    description: '正在监控 ~/.claude/projects/ 下的 Claude Code Token 用量数据。启动一个 Claude Code 会话即可在此查看数据。',
  },
  'no-data': {
    icon: BarChart3,
    title: '暂无 Token 数据',
    description: '当前没有 Token 用量记录。使用 Claude Code 后将自动生成数据。',
  },
  error: {
    icon: AlertCircle,
    title: '出错了',
    description: '加载数据时发生错误。',
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
