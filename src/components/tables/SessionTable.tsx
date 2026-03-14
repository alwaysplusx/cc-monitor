// Session / Subagent detail table with expandable rows
import { useState, useMemo } from 'react'
import { ChevronRight } from 'lucide-react'
import { useDataStore } from '../../stores/dataStore'
import { fmtK } from '../../lib/format'
import { cn } from '../../lib/utils'
import { CHART_COLORS } from '../../lib/constants'

export default function SessionTable() {
  const sessionSummaries = useDataStore((s) => s.sessionSummaries)
  const highlightedTimeRange = useDataStore((s) => s.highlightedTimeRange)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  // Group sessions: main sessions with their subagents
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

  const formatTimeRange = (first: Date, last: Date) => {
    const fmt = (d: Date) => d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    return `${fmt(first)}-${fmt(last)}`
  }

  const totalAllTokens = useMemo(
    () => sessionSummaries.reduce((s, r) => s + r.totalInput + r.totalOutput + r.totalCacheRead, 0),
    [sessionSummaries],
  )

  const renderPercentBar = (input: number, output: number, cache: number) => {
    const total = input + output + cache
    if (total === 0 || totalAllTokens === 0) return null
    const pct = (total / totalAllTokens) * 100
    const inputPct = (input / total) * 100
    const outputPct = (output / total) * 100

    return (
      <div className="flex items-center gap-1.5">
        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-[var(--muted)]">
          <div className="flex h-full">
            <div style={{ width: `${inputPct}%`, backgroundColor: CHART_COLORS.input }} />
            <div style={{ width: `${outputPct}%`, backgroundColor: CHART_COLORS.output }} />
            <div style={{ width: `${100 - inputPct - outputPct}%`, backgroundColor: CHART_COLORS.cacheRead }} />
          </div>
        </div>
        <span className="text-xs text-[var(--muted-foreground)]">{pct.toFixed(1)}%</span>
      </div>
    )
  }

  const hasData = mainSessions.length > 0

  return (
    <div>
      <h3 className="mb-3 text-xs font-semibold text-[var(--foreground)]">会话列表</h3>

      {hasData ? (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[var(--border)] text-left text-[var(--muted-foreground)]">
                <th className="w-8 p-2" />
                <th className="p-2">会话</th>
                <th className="w-[100px] p-2">时间</th>
                <th className="w-[80px] p-2">模型</th>
                <th className="w-[70px] p-2 text-right">输入</th>
                <th className="w-[70px] p-2 text-right">输出</th>
                <th className="w-[70px] p-2 text-right">缓存</th>
                <th className="w-[50px] p-2 text-right">请求</th>
                <th className="w-[100px] p-2">占比</th>
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
                      <td className="p-2">
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
                      <td className="max-w-[200px] truncate p-2 text-[var(--foreground)]">
                        {session.firstUserMessage.slice(0, 60)}
                      </td>
                      <td className="p-2 text-[var(--muted-foreground)]">
                        {formatTimeRange(session.firstTimestamp, session.lastTimestamp)}
                      </td>
                      <td className="p-2 text-[var(--muted-foreground)]">{session.model}</td>
                      <td className="p-2 text-right font-mono text-blue-500">
                        {fmtK(session.totalInput)}
                      </td>
                      <td className="p-2 text-right font-mono text-purple-500">
                        {fmtK(session.totalOutput)}
                      </td>
                      <td className="p-2 text-right font-mono text-cyan-500">
                        {fmtK(session.totalCacheRead)}
                      </td>
                      <td className="p-2 text-right text-[var(--muted-foreground)]">
                        {session.requestCount}
                      </td>
                      <td className="p-2">
                        {renderPercentBar(session.totalInput, session.totalOutput, session.totalCacheRead)}
                      </td>
                    </tr>

                    {/* Subagent rows */}
                    {isOpen &&
                      subagents.map((sub) => (
                        <tr
                          key={sub.id}
                          className="border-b border-[var(--border)] bg-[var(--muted)]/30"
                        >
                          <td className="p-2" />
                          <td className="p-2 pl-8 text-[var(--foreground)]">
                            <span className="mr-1.5 rounded bg-purple-500/20 px-1 py-0.5 text-[10px] text-purple-400">
                              subagent
                            </span>
                            {sub.agentId.slice(0, 12)}
                          </td>
                          <td className="p-2 text-[var(--muted-foreground)]">
                            {formatTimeRange(sub.firstTimestamp, sub.lastTimestamp)}
                          </td>
                          <td className="p-2 text-[var(--muted-foreground)]">{sub.model}</td>
                          <td className="p-2 text-right font-mono text-blue-500">
                            {fmtK(sub.totalInput)}
                          </td>
                          <td className="p-2 text-right font-mono text-purple-500">
                            {fmtK(sub.totalOutput)}
                          </td>
                          <td className="p-2 text-right font-mono text-cyan-500">
                            {fmtK(sub.totalCacheRead)}
                          </td>
                          <td className="p-2 text-right text-[var(--muted-foreground)]">
                            {sub.requestCount}
                          </td>
                          <td className="p-2">
                            {renderPercentBar(sub.totalInput, sub.totalOutput, sub.totalCacheRead)}
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

// Need Fragment import
import { Fragment } from 'react'
