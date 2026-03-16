// Session drilldown panel — session info, request timeline, model breakdown, subagents
import { useMemo, useState, useCallback } from 'react'
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
  const turnContentLimit = useSettingsStore((s) => s.turnContentLimit)
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
        // Extract short model name: claude-opus-4-6 → opus, claude-sonnet-4-6 → sonnet
        const parts = sessionRecords[i].model.split('-')
        const shortName = parts.length >= 2 ? parts.slice(1, -2).join('-') || parts[1] : parts[0]
        modelSwitchLines.push({
          xAxis: i,
          label: {
            formatter: shortName,
            fontSize: 9,
            color: axisLabelColor,
            padding: [0, 4],
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
      grid: { top: 12, right: 12, bottom: sessionRecords.length > 30 ? 44 : 24, left: 44 },
      ...(sessionRecords.length > 30
        ? {
            dataZoom: [
              {
                type: 'slider' as const,
                height: 16,
                bottom: 2,
                startValue: Math.max(0, sessionRecords.length - 30),
                endValue: sessionRecords.length - 1,
                borderColor: 'transparent',
                fillerColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                handleSize: '60%',
                textStyle: { fontSize: 9, color: axisLabelColor },
              },
            ],
          }
        : {}),
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
            ? {
                markLine: {
                  data: modelSwitchLines,
                  silent: true,
                  symbol: ['none', 'none'],
                  lineStyle: { type: 'dashed' as const, color: isDark ? '#475569' : '#94a3b8', width: 1 },
                },
              }
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
        position: 'right',
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

  // Turn detail state
  const [turnDetail, setTurnDetail] = useState<{
    index: number
    userMessage: string
    assistantText: string
    assistantThinking: string
    toolCalls: { name: string; input: string }[]
    model: string
    timestamp: string
  } | null>(null)
  const [turnLoading, setTurnLoading] = useState(false)

  const handleBarClick = useCallback(
    async (params: { dataIndex: number }) => {
      const idx = params.dataIndex
      const record = sessionRecords[idx]
      if (!record) return

      // Toggle off if clicking the same bar
      if (turnDetail?.index === idx) {
        setTurnDetail(null)
        return
      }

      setTurnLoading(true)
      try {
        const result = await window.api.getTurnDetail({
          fileName: record.fileName,
          sessionId: record.sessionId,
          timestamp: record.timestamp.toISOString(),
          contentLimit: turnContentLimit,
        })
        if (result) {
          setTurnDetail({ index: idx, ...result })
        } else {
          setTurnDetail(null)
        }
      } finally {
        setTurnLoading(false)
      }
    },
    [sessionRecords, turnDetail],
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
            onEvents={{ click: handleBarClick }}
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
      {/* Turn detail panel */}
      {turnLoading && (
        <div className="text-center text-xs text-[var(--muted-foreground)]">加载中...</div>
      )}
      {turnDetail && !turnLoading && (
        <div className="space-y-2 rounded-lg border border-[var(--border)] bg-[var(--muted)]/30 p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[var(--muted-foreground)]">
              #{turnDetail.index + 1} 轮次详情
              <span className="ml-2 font-mono opacity-60">{turnDetail.model}</span>
            </span>
            <button
              onClick={() => setTurnDetail(null)}
              className="text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            >
              关闭
            </button>
          </div>
          {(() => {
            const r = sessionRecords[turnDetail.index]
            if (!r) return null
            const pricing = getModelPricing(r.model, modelPricing)
            const turnCost =
              (r.inputTokens / 1_000_000) * pricing.input +
              (r.outputTokens / 1_000_000) * pricing.output +
              (r.cacheReadTokens / 1_000_000) * pricing.cacheRead
            const prevRecord = turnDetail.index > 0 ? sessionRecords[turnDetail.index - 1] : null
            const intervalMs = prevRecord
              ? r.timestamp.getTime() - prevRecord.timestamp.getTime()
              : 0
            const fmtInterval = (ms: number) => {
              if (ms < 1000) return `${ms}ms`
              if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`
              return `${(ms / 60_000).toFixed(1)}min`
            }
            const rows: [string, string, string][] = [
              ['输入', fmtK(r.inputTokens), 'text-blue-500'],
              ['输出', fmtK(r.outputTokens), 'text-purple-500'],
              ['缓存读取', fmtK(r.cacheReadTokens), 'text-cyan-500'],
              ...(r.cacheCreateTokens > 0
                ? [['缓存写入', fmtK(r.cacheCreateTokens), 'text-teal-500'] as [string, string, string]]
                : []),
              ['预估费用', `$${turnCost.toFixed(4)}`, 'text-emerald-500'],
              ['时间', r.timestamp.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }), ''],
              ...(intervalMs > 0
                ? [['距上轮间隔', fmtInterval(intervalMs), ''] as [string, string, string]]
                : []),
            ]
            return (
              <table className="w-full text-xs">
                <tbody>
                  {rows.map(([label, value, color]) => (
                    <tr key={label} className="border-b border-[var(--border)] last:border-b-0">
                      <td className="py-1 pr-4 text-[var(--muted-foreground)]">{label}</td>
                      <td className={`py-1 font-mono font-semibold ${color}`}>{value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          })()}
          {turnDetail.userMessage && (
            <div>
              <div className="mb-1 text-[10px] font-medium text-blue-500">用户输入</div>
              <div className="max-h-48 overflow-y-auto whitespace-pre-wrap rounded-md bg-[var(--card)] p-2 text-xs text-[var(--foreground)]">
                {turnDetail.userMessage}
              </div>
            </div>
          )}
          {turnDetail.assistantText && (
            <div>
              <div className="mb-1 text-[10px] font-medium text-purple-500">模型输出</div>
              <div className="max-h-48 overflow-y-auto whitespace-pre-wrap rounded-md bg-[var(--card)] p-2 text-xs text-[var(--foreground)]">
                {turnDetail.assistantText}
              </div>
            </div>
          )}
          {turnDetail.toolCalls.length > 0 && (
            <div>
              <div className="mb-1 text-[10px] font-medium text-amber-500">
                工具调用 ({turnDetail.toolCalls.length})
              </div>
              <div className="max-h-60 space-y-1 overflow-y-auto">
                {turnDetail.toolCalls.map((t, i) => (
                  <div key={i} className="rounded-md bg-[var(--card)] p-2 text-xs">
                    <span className="font-mono font-semibold text-amber-500">{t.name}</span>
                    <pre className="mt-1 overflow-x-auto whitespace-pre-wrap break-all font-mono text-[10px] text-[var(--muted-foreground)]">
                      {t.input}
                    </pre>
                  </div>
                ))}
              </div>
            </div>
          )}
          {!turnDetail.userMessage && !turnDetail.assistantText && turnDetail.toolCalls.length === 0 && (
            <div className="text-xs text-[var(--muted-foreground)]">未找到该轮次的消息内容</div>
          )}
        </div>
      )}
    </div>
  )
}
