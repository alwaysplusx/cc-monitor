// Session / Subagent detail table with expandable rows
import { useState, useMemo, Fragment } from 'react'
import { ChevronRight, FolderOpen } from 'lucide-react'
import { useDataStore } from '../../stores/dataStore'
import { electronApi } from '../../lib/ipc'
import { fmtK } from '../../lib/format'
import { cn } from '../../lib/utils'

/** Decode encoded project folder name: C--Users-wuxii-workspaces-foo → foo */
function projectDisplayName(projectPath: string): string {
  const last = projectPath.split(/[/\\]/).pop() || projectPath
  // Encoded folder names use double dash as separator, take the last segment
  const decoded = last.replace(/^C--/, '').split('-').pop() || last
  return decoded || last
}

export default function SessionTable() {
  const sessionSummaries = useDataStore((s) => s.sessionSummaries)
  const highlightedTimeRange = useDataStore((s) => s.highlightedTimeRange)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const { mainSessions, subagentMap } = useMemo(() => {
    const mains = sessionSummaries.filter((s) => !s.isSubagent)
    const subs = sessionSummaries.filter((s) => s.isSubagent)
    const subMap = new Map<string, typeof subs>()
    for (const sub of subs) {
      const list = subMap.get(sub.sessionId) ?? []
      list.push(sub)
      subMap.set(sub.sessionId, list)
    }
    return { mainSessions: mains, subagentMap: subMap }
  }, [sessionSummaries])

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const isHighlighted = (s: { firstTimestamp: Date; lastTimestamp: Date }) => {
    if (!highlightedTimeRange) return false
    const sStart = s.firstTimestamp.toISOString().slice(0, 16)
    const sEnd = s.lastTimestamp.toISOString().slice(0, 16)
    return sStart <= highlightedTimeRange.end && sEnd >= highlightedTimeRange.start
  }

  const formatDateTime = (d: Date) => {
    const date = d.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })
    const time = d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    return `${date} ${time}`
  }

  const hasData = mainSessions.length > 0

  const thCls = 'whitespace-nowrap px-2 py-1.5 text-[var(--muted-foreground)]'
  const tdCls = 'whitespace-nowrap px-2 py-1.5'

  return (
    <div>
      <h3 className="mb-3 text-xs font-semibold text-[var(--foreground)]">会话列表</h3>

      {hasData ? (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[var(--border)] text-left">
                <th className={cn(thCls, 'w-5')} />
                <th className={thCls}>ID</th>
                <th className={thCls}>项目</th>
                <th className={cn(thCls, 'w-full')}>会话</th>
                <th className={cn(thCls, 'text-right text-green-500')}>请求</th>
                <th className={cn(thCls, 'text-right text-blue-500')}>输入</th>
                <th className={cn(thCls, 'text-right text-purple-500')}>输出</th>
                <th className={cn(thCls, 'text-right text-cyan-500')}>缓存</th>
                <th className={thCls}>模型</th>
                <th className={thCls}>开始</th>
                <th className={thCls}>结束</th>
              </tr>
            </thead>
            <tbody>
              {mainSessions.map((session) => {
                const subagents = subagentMap.get(session.sessionId) ?? []
                const hasSubagents = subagents.length > 0
                const isOpen = expanded.has(session.id)
                const highlighted = isHighlighted(session)

                return (
                  <Fragment key={session.id}>
                    <tr
                      className={cn(
                        'border-b border-[var(--border)] transition-colors hover:bg-[var(--accent)]',
                        highlighted && 'bg-blue-500/10',
                      )}
                    >
                      <td className={tdCls}>
                        {hasSubagents && (
                          <button
                            onClick={() => toggleExpand(session.id)}
                            className="text-[var(--muted-foreground)]"
                          >
                            <ChevronRight
                              className={cn('h-3.5 w-3.5 transition-transform', isOpen && 'rotate-90')}
                            />
                          </button>
                        )}
                      </td>
                      <td className={cn(tdCls, 'font-mono text-[var(--muted-foreground)]')} title={session.sessionId}>
                        <div className="flex items-center gap-1">
                          {session.sessionFilePath && (
                            <button
                              onClick={() => electronApi.openDirectory(session.sessionFilePath).catch(console.error)}
                              className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                              title={`打开 ${session.sessionFilePath}`}
                            >
                              <FolderOpen className="h-3 w-3" />
                            </button>
                          )}
                          <span>{session.sessionId.slice(0, 8)}</span>
                        </div>
                      </td>
                      <td className={cn(tdCls, 'text-[var(--muted-foreground)]')}>
                        <button
                          onClick={() => session.projectPath && electronApi.openDirectory(session.projectPath).catch(console.error)}
                          className="hover:text-[var(--foreground)]"
                          title={session.projectPath}
                        >
                          {projectDisplayName(session.projectPath)}
                        </button>
                      </td>
                      <td className={cn(tdCls, 'max-w-[300px] text-[var(--foreground)]')}>
                        <span className="block truncate" title={session.firstUserMessage}>
                          {session.firstUserMessage}
                        </span>
                      </td>
                      <td className={cn(tdCls, 'text-right font-mono text-green-500')}>
                        {session.requestCount}
                      </td>
                      <td className={cn(tdCls, 'text-right font-mono text-blue-500')}>
                        {fmtK(session.totalInput)}
                      </td>
                      <td className={cn(tdCls, 'text-right font-mono text-purple-500')}>
                        {fmtK(session.totalOutput)}
                      </td>
                      <td className={cn(tdCls, 'text-right font-mono text-cyan-500')}>
                        {fmtK(session.totalCacheRead)}
                      </td>
                      <td className={cn(tdCls, 'max-w-[140px] text-[var(--muted-foreground)]')}>
                        <span className="block truncate" title={session.model}>{session.model}</span>
                      </td>
                      <td className={cn(tdCls, 'text-[var(--muted-foreground)]')}>
                        {formatDateTime(session.firstTimestamp)}
                      </td>
                      <td className={cn(tdCls, 'text-[var(--muted-foreground)]')}>
                        {formatDateTime(session.lastTimestamp)}
                      </td>
                    </tr>

                    {/* Subagent rows */}
                    {isOpen &&
                      subagents.map((sub) => (
                        <tr
                          key={sub.id}
                          className="border-b border-[var(--border)] bg-[var(--muted)]/30"
                        >
                          <td className={tdCls} />
                          <td className={tdCls} />
                          <td className={tdCls} />
                          <td className={cn(tdCls, 'pl-4 text-[var(--foreground)]')}>
                            <span className="mr-1.5 rounded bg-purple-500/20 px-1 py-0.5 text-[10px] text-purple-400">
                              subagent
                            </span>
                            {sub.agentId.slice(0, 12)}
                          </td>
                          <td className={cn(tdCls, 'text-right font-mono text-green-500')}>
                            {sub.requestCount}
                          </td>
                          <td className={cn(tdCls, 'text-right font-mono text-blue-500')}>
                            {fmtK(sub.totalInput)}
                          </td>
                          <td className={cn(tdCls, 'text-right font-mono text-purple-500')}>
                            {fmtK(sub.totalOutput)}
                          </td>
                          <td className={cn(tdCls, 'text-right font-mono text-cyan-500')}>
                            {fmtK(sub.totalCacheRead)}
                          </td>
                          <td className={cn(tdCls, 'text-[var(--muted-foreground)]')}>{sub.model}</td>
                          <td className={cn(tdCls, 'text-[var(--muted-foreground)]')}>
                            {formatDateTime(sub.firstTimestamp)}
                          </td>
                          <td className={cn(tdCls, 'text-[var(--muted-foreground)]')}>
                            {formatDateTime(sub.lastTimestamp)}
                          </td>
                        </tr>
                      ))}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="py-8 text-center text-xs text-[var(--muted-foreground)]">
          暂无会话数据
        </div>
      )}
    </div>
  )
}
