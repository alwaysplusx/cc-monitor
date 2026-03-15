// Session / Subagent detail table with expandable rows
import { useState, useMemo, Fragment } from 'react'
import { ChevronRight, FolderOpen } from 'lucide-react'
import { useDataStore } from '../../stores/dataStore'
import { electronApi } from '../../lib/ipc'
import { cn } from '../../lib/utils'

/** Split formatted number into value and unit parts */
function splitUnit(n: number): { num: string; unit: string } {
  if (n >= 1_000_000) return { num: (n / 1_000_000).toFixed(1), unit: 'M' }
  if (n >= 1_000) return { num: (n / 1_000).toFixed(1), unit: 'K' }
  return { num: n.toString(), unit: '' }
}

/** Token cell with number+unit separation and mini bar */
function TokenCell({ value, max, color, barColor }: { value: number; max: number; color: string; barColor: string }) {
  const { num, unit } = splitUnit(value)
  const ratio = max > 0 ? value / max : 0
  return (
    <div className="flex flex-col items-end gap-0.5">
      <span className={cn('font-mono', color)}>
        <span className="font-semibold">{num}</span>
        {unit && <span className="text-[10px] opacity-60">{unit}</span>}
      </span>
      <div className="h-[2px] w-full rounded-full bg-[var(--border)]">
        <div className="h-full rounded-full" style={{ width: `${ratio * 100}%`, backgroundColor: barColor }} />
      </div>
    </div>
  )
}

const MODEL_COLORS = ['#3b82f6', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#6366f1']

/** Mini donut ring for model proportions */
function MiniDonut({ breakdown, total, size = 16 }: { breakdown: { model: string; count: number }[]; total: number; size?: number }) {
  const r = (size - 3) / 2
  const circumference = 2 * Math.PI * r
  let offset = 0
  return (
    <svg width={size} height={size} className="shrink-0">
      {breakdown.map((b, i) => {
        const ratio = total > 0 ? b.count / total : 0
        const dash = ratio * circumference
        const el = (
          <circle
            key={b.model}
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={MODEL_COLORS[i % MODEL_COLORS.length]}
            strokeWidth={3}
            strokeDasharray={`${dash} ${circumference - dash}`}
            strokeDashoffset={-offset}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        )
        offset += dash
        return el
      })}
    </svg>
  )
}

/** Model cell with mini donut + model name */
function ModelCell({ breakdown, total }: { breakdown: { model: string; count: number }[]; total: number }) {
  const tooltip = breakdown.map((b) => `${b.model}: ${b.count}次 (${((b.count / total) * 100).toFixed(0)}%)`).join('\n')
  return (
    <div className="flex items-center gap-1.5" title={tooltip}>
      <MiniDonut breakdown={breakdown} total={total} />
      <span className="truncate text-[var(--muted-foreground)]">
        {breakdown[0].model}
        {breakdown.length > 1 && (
          <span className="ml-1 rounded bg-[var(--muted)] px-1 py-0.5 text-[10px]">
            +{breakdown.length - 1}
          </span>
        )}
      </span>
    </div>
  )
}

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
  const [page, setPage] = useState(0)
  const pageSize = 10

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

  // Max values for mini bar scaling
  const maxInput = useMemo(() => Math.max(...sessionSummaries.map((s) => s.totalInput), 1), [sessionSummaries])
  const maxOutput = useMemo(() => Math.max(...sessionSummaries.map((s) => s.totalOutput), 1), [sessionSummaries])
  const maxCache = useMemo(() => Math.max(...sessionSummaries.map((s) => s.totalCacheRead), 1), [sessionSummaries])
  const maxReq = useMemo(() => Math.max(...sessionSummaries.map((s) => s.requestCount), 1), [sessionSummaries])

  const totalPages = Math.max(1, Math.ceil(mainSessions.length / pageSize))
  const safePage = Math.min(page, totalPages - 1)
  const pagedSessions = mainSessions.slice(safePage * pageSize, (safePage + 1) * pageSize)

  const hasData = mainSessions.length > 0

  const thCls = 'whitespace-nowrap px-2 py-1.5 text-[var(--muted-foreground)]'
  const tdCls = 'whitespace-nowrap px-2 py-1.5'

  return (
    <div>
      <h3 className="mb-3 text-xs font-semibold text-[var(--foreground)]">会话列表</h3>

      {hasData ? (
        <div className="flex min-h-[396px] flex-col overflow-x-auto">
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
              {pagedSessions.map((session) => {
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
                          className="flex items-center gap-1 hover:text-[var(--foreground)]"
                          title={session.projectPath}
                        >
                          <FolderOpen className="h-3 w-3 shrink-0" />
                          {projectDisplayName(session.projectPath)}
                        </button>
                      </td>
                      <td className={cn(tdCls, 'max-w-[300px] text-[var(--foreground)]')}>
                        <span className="block truncate" title={session.firstUserMessage}>
                          {session.firstUserMessage}
                        </span>
                      </td>
                      <td className={cn(tdCls, 'min-w-[48px]')}>
                        <TokenCell value={session.requestCount} max={maxReq} color="text-green-500" barColor="#22c55e" />
                      </td>
                      <td className={cn(tdCls, 'min-w-[60px]')}>
                        <TokenCell value={session.totalInput} max={maxInput} color="text-blue-500" barColor="#3b82f6" />
                      </td>
                      <td className={cn(tdCls, 'min-w-[60px]')}>
                        <TokenCell value={session.totalOutput} max={maxOutput} color="text-purple-500" barColor="#8b5cf6" />
                      </td>
                      <td className={cn(tdCls, 'min-w-[60px]')}>
                        <TokenCell value={session.totalCacheRead} max={maxCache} color="text-cyan-500" barColor="#06b6d4" />
                      </td>
                      <td className={cn(tdCls, 'max-w-[160px]')}>
                        <ModelCell breakdown={session.modelBreakdown} total={session.requestCount} />
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
                          <td className={cn(tdCls, 'min-w-[48px]')}>
                            <TokenCell value={sub.requestCount} max={maxReq} color="text-green-500" barColor="#22c55e" />
                          </td>
                          <td className={cn(tdCls, 'min-w-[60px]')}>
                            <TokenCell value={sub.totalInput} max={maxInput} color="text-blue-500" barColor="#3b82f6" />
                          </td>
                          <td className={cn(tdCls, 'min-w-[60px]')}>
                            <TokenCell value={sub.totalOutput} max={maxOutput} color="text-purple-500" barColor="#8b5cf6" />
                          </td>
                          <td className={cn(tdCls, 'min-w-[60px]')}>
                            <TokenCell value={sub.totalCacheRead} max={maxCache} color="text-cyan-500" barColor="#06b6d4" />
                          </td>
                          <td className={cn(tdCls, 'max-w-[160px]')}>
                            <ModelCell breakdown={sub.modelBreakdown} total={sub.requestCount} />
                          </td>
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

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-auto flex items-center justify-between border-t border-[var(--border)] px-2 py-2 text-xs text-[var(--muted-foreground)]">
              <span>
                共 {mainSessions.length} 个会话，第 {safePage + 1}/{totalPages} 页
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage(0)}
                  disabled={safePage === 0}
                  className="rounded px-1.5 py-0.5 hover:bg-[var(--accent)] disabled:opacity-30"
                >
                  «
                </button>
                <button
                  onClick={() => setPage(safePage - 1)}
                  disabled={safePage === 0}
                  className="rounded px-1.5 py-0.5 hover:bg-[var(--accent)] disabled:opacity-30"
                >
                  ‹
                </button>
                {Array.from({ length: totalPages }, (_, i) => i)
                  .filter((i) => i === 0 || i === totalPages - 1 || Math.abs(i - safePage) <= 1)
                  .reduce<number[]>((acc, i) => {
                    if (acc.length > 0 && i - acc[acc.length - 1] > 1) acc.push(-1)
                    acc.push(i)
                    return acc
                  }, [])
                  .map((i, idx) =>
                    i === -1 ? (
                      <span key={`dot-${idx}`} className="px-1">…</span>
                    ) : (
                      <button
                        key={i}
                        onClick={() => setPage(i)}
                        className={cn(
                          'min-w-[24px] rounded px-1.5 py-0.5',
                          i === safePage
                            ? 'bg-[var(--primary)] text-[var(--primary-foreground)]'
                            : 'hover:bg-[var(--accent)]',
                        )}
                      >
                        {i + 1}
                      </button>
                    ),
                  )}
                <button
                  onClick={() => setPage(safePage + 1)}
                  disabled={safePage >= totalPages - 1}
                  className="rounded px-1.5 py-0.5 hover:bg-[var(--accent)] disabled:opacity-30"
                >
                  ›
                </button>
                <button
                  onClick={() => setPage(totalPages - 1)}
                  disabled={safePage >= totalPages - 1}
                  className="rounded px-1.5 py-0.5 hover:bg-[var(--accent)] disabled:opacity-30"
                >
                  »
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="py-8 text-center text-xs text-[var(--muted-foreground)]">
          暂无会话数据
        </div>
      )}
    </div>
  )
}
