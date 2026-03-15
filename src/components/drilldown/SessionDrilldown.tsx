// Session drilldown panel — session info, request timeline, model breakdown, subagents
import { useMemo } from 'react'
import ReactECharts from 'echarts-for-react'
import { useDataStore } from '../../stores/dataStore'
import { useSettingsStore } from '../../stores/settingsStore'
import { useTheme } from '../../hooks/useTheme'
import { getModelPricing, CHART_COLORS } from '../../lib/constants'
import { fmtK, fmtDuration } from '../../lib/format'

const MODEL_COLORS = [
  '#3b82f6',
  '#8b5cf6',
  '#06b6d4',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#ec4899',
  '#6366f1',
]

export default function SessionDrilldown({ sessionId }: { sessionId: string }) {
  const records = useDataStore((s) => s.tokenRecords)
  const sessionSummaries = useDataStore((s) => s.sessionSummaries)
  const modelPricing = useSettingsStore((s) => s.modelPricing)
  const { isDark } = useTheme()

  const axisLabelColor = isDark ? '#8892a8' : '#64748b'
  const splitLineColor = isDark ? '#151d2e' : '#f1f5f9'
  const axisLineColor = isDark ? '#1e293b' : '#e2e8f0'

  // Filter records for this session
  const sessionRecords = useMemo(
    () =>
      records
        .filter((r) => r.sessionId === sessionId)
        .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime()),
    [records, sessionId],
  )

  // Session summary
  const session = useMemo(
    () => sessionSummaries.find((s) => s.sessionId === sessionId && !s.isSubagent),
    [sessionSummaries, sessionId],
  )

  // Cost calculation
  const cost = useMemo(() => {
    let total = 0
    for (const r of sessionRecords) {
      const pricing = getModelPricing(r.model, modelPricing)
      total +=
        (r.inputTokens / 1_000_000) * pricing.input +
        (r.outputTokens / 1_000_000) * pricing.output +
        (r.cacheReadTokens / 1_000_000) * pricing.cacheRead
    }
    return total
  }, [sessionRecords, modelPricing])

  // Duration
  const durationMs = session
    ? session.lastTimestamp.getTime() - session.firstTimestamp.getTime()
    : 0

  const totalTokens = session
    ? session.totalInput + session.totalOutput + session.totalCacheRead
    : 0

  // Request timeline chart
  const timelineOption = useMemo(() => {
    if (sessionRecords.length === 0) return null
    const models = [...new Set(sessionRecords.map((r) => r.model))]
    const modelSwitchLines = []

    // Detect model switches
    for (let i = 1; i < sessionRecords.length; i++) {
      if (sessionRecords[i].model !== sessionRecords[i - 1].model) {
        modelSwitchLines.push({
          xAxis: i,
          label: {
            formatter: sessionRecords[i].model.split('-').pop() || '',
            fontSize: 9,
          },
        })
      }
    }

    return {
      tooltip: {
        trigger: 'axis' as const,
        backgroundColor: isDark ? '#111827' : '#ffffff',
        borderColor: isDark ? '#1e293b' : '#e2e8f0',
        textStyle: { color: isDark ? '#c9d1d9' : '#1a202c' },
        formatter: (
          params: { seriesName: string; value: number; dataIndex: number }[],
        ) => {
          const idx = params[0].dataIndex
          const r = sessionRecords[idx]
          const time = r.timestamp.toLocaleTimeString('zh-CN', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          })
          return `<b>#${idx + 1}</b> ${time}<br/>
模型: ${r.model}<br/>
${params.map((p) => `${p.seriesName}: ${fmtK(p.value)}`).join('<br/>')}`
        },
      },
      grid: { top: 12, right: 12, bottom: 24, left: 44 },
      xAxis: {
        type: 'category' as const,
        data: sessionRecords.map((_, i) => `#${i + 1}`),
        axisLabel: { fontSize: 10, color: axisLabelColor },
        axisLine: { lineStyle: { color: axisLineColor } },
      },
      yAxis: {
        type: 'value' as const,
        axisLabel: { fontSize: 10, formatter: (v: number) => fmtK(v), color: axisLabelColor },
        axisLine: { lineStyle: { color: axisLineColor } },
        splitLine: { lineStyle: { color: splitLineColor } },
      },
      series: [
        {
          name: '输入',
          type: 'bar',
          stack: 'token',
          data: sessionRecords.map((r) => r.inputTokens),
          itemStyle: { color: CHART_COLORS.input },
          ...(modelSwitchLines.length > 0
            ? { markLine: { data: modelSwitchLines, silent: true, lineStyle: { type: 'dashed' as const, color: '#888' } } }
            : {}),
        },
        {
          name: '输出',
          type: 'bar',
          stack: 'token',
          data: sessionRecords.map((r) => r.outputTokens),
          itemStyle: { color: CHART_COLORS.output },
        },
        {
          name: '缓存',
          type: 'bar',
          stack: 'token',
          data: sessionRecords.map((r) => r.cacheReadTokens),
          itemStyle: { color: CHART_COLORS.cacheRead },
        },
      ],
    }
  }, [sessionRecords, isDark, axisLabelColor, axisLineColor, splitLineColor])

  // Model breakdown pie
  const modelBreakdown = session?.modelBreakdown ?? []
  const modelPieOption = useMemo(() => {
    if (modelBreakdown.length === 0) return null
    return {
      tooltip: {
        trigger: 'item' as const,
        formatter: '{b}: {c}次 ({d}%)',
        backgroundColor: isDark ? '#111827' : '#ffffff',
        borderColor: isDark ? '#1e293b' : '#e2e8f0',
        textStyle: { color: isDark ? '#c9d1d9' : '#1a202c' },
      },
      series: [
        {
          type: 'pie',
          radius: ['40%', '65%'],
          center: ['50%', '50%'],
          data: modelBreakdown.map((b, i) => ({
            name: b.model,
            value: b.count,
            itemStyle: { color: MODEL_COLORS[i % MODEL_COLORS.length] },
          })),
          label: { fontSize: 10, color: axisLabelColor },
        },
      ],
    }
  }, [modelBreakdown, isDark, axisLabelColor])

  // Subagents
  const subagents = useMemo(
    () => sessionSummaries.filter((s) => s.isSubagent && s.sessionId === sessionId),
    [sessionSummaries, sessionId],
  )

  if (!session) {
    return (
      <div className="py-8 text-center text-sm text-[var(--muted-foreground)]">
        未找到会话数据
      </div>
    )
  }

  const fmtTime = (d: Date) =>
    d.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })

  return (
    <div className="space-y-5">
      {/* Session info header */}
      <div className="space-y-2">
        <div className="text-sm text-[var(--foreground)]">{session.firstUserMessage}</div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--muted-foreground)]">
          <span title={session.sessionId}>
            ID: <span className="font-mono">{session.sessionId.slice(0, 12)}</span>
          </span>
          <span>{fmtTime(session.firstTimestamp)}</span>
          <span>{fmtDuration(durationMs)}</span>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: '请求', value: fmtK(session.requestCount), color: 'text-green-500' },
            { label: '输入', value: fmtK(session.totalInput), color: 'text-blue-500' },
            { label: '输出', value: fmtK(session.totalOutput), color: 'text-purple-500' },
            { label: '缓存', value: fmtK(session.totalCacheRead), color: 'text-cyan-500' },
          ].map((item) => (
            <div key={item.label} className="rounded-md border border-[var(--border)] p-2 text-center">
              <div className="text-[10px] text-[var(--muted-foreground)]">{item.label}</div>
              <div className={`font-mono text-sm font-semibold ${item.color}`}>{item.value}</div>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-[var(--muted-foreground)]">预估费用:</span>
          <span className="font-mono font-semibold text-emerald-500">${cost.toFixed(4)}</span>
          <span className="text-[var(--muted-foreground)]">|</span>
          <span className="text-[var(--muted-foreground)]">Token 合计:</span>
          <span className="font-mono">{fmtK(totalTokens)}</span>
        </div>
      </div>

      {/* Request timeline */}
      {timelineOption && (
        <div>
          <h3 className="mb-2 text-xs font-medium text-[var(--muted-foreground)]">请求时间线</h3>
          <ReactECharts
            option={timelineOption}
            style={{ height: 200 }}
          />
        </div>
      )}

      {/* Model breakdown */}
      {modelPieOption && (
        <div>
          <h3 className="mb-2 text-xs font-medium text-[var(--muted-foreground)]">模型使用明细</h3>
          <div className="flex items-start gap-4">
            <ReactECharts option={modelPieOption} style={{ height: 160, width: 160 }} />
            <div className="flex-1 space-y-1 pt-2">
              {modelBreakdown.map((b, i) => (
                <div key={b.model} className="flex items-center gap-2 text-xs">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: MODEL_COLORS[i % MODEL_COLORS.length] }}
                  />
                  <span className="min-w-0 flex-1 truncate">{b.model}</span>
                  <span className="font-mono text-[var(--muted-foreground)]">{b.count}次</span>
                  <span className="font-mono text-[var(--muted-foreground)]">
                    {session.requestCount > 0
                      ? `${((b.count / session.requestCount) * 100).toFixed(0)}%`
                      : '-'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Subagent relationships */}
      {subagents.length > 0 && (
        <div>
          <h3 className="mb-2 text-xs font-medium text-[var(--muted-foreground)]">
            Subagent ({subagents.length})
          </h3>
          <div className="space-y-1">
            {subagents.map((sub) => {
              const subTotal = sub.totalInput + sub.totalOutput + sub.totalCacheRead
              const pct = totalTokens > 0 ? ((subTotal / totalTokens) * 100).toFixed(1) : '0'
              return (
                <div
                  key={sub.id}
                  className="flex items-center gap-2 rounded-md border border-[var(--border)] px-3 py-2 text-xs"
                >
                  <span className="rounded bg-purple-500/20 px-1 py-0.5 text-[10px] text-purple-400">
                    subagent
                  </span>
                  <span className="min-w-0 flex-1 truncate font-mono text-[var(--muted-foreground)]">
                    {sub.agentId.slice(0, 16)}
                  </span>
                  <span className="text-green-500">{sub.requestCount}次</span>
                  <span className="font-mono">{fmtK(subTotal)}</span>
                  <span className="text-[var(--muted-foreground)]">{pct}%</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
