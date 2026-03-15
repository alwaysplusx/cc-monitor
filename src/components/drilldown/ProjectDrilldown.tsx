// Project drilldown panel — consumption trend, model distribution, cost, sessions
import { useMemo } from 'react'
import ReactECharts from 'echarts-for-react'
import { useDataStore } from '../../stores/dataStore'
import { useSettingsStore } from '../../stores/settingsStore'
import { useTheme } from '../../hooks/useTheme'
import { getModelPricing, CHART_COLORS } from '../../lib/constants'
import { fmtK } from '../../lib/format'

const MODEL_COLORS = ['#3b82f6', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444']

export default function ProjectDrilldown({ projectPath }: { projectPath: string }) {
  const records = useDataStore((s) => s.tokenRecords)
  const sessionSummaries = useDataStore((s) => s.sessionSummaries)
  const openDrilldown = useDataStore((s) => s.openDrilldown)
  const modelPricing = useSettingsStore((s) => s.modelPricing)
  const { isDark } = useTheme()

  const axisLabelColor = isDark ? '#8892a8' : '#64748b'
  const splitLineColor = isDark ? '#151d2e' : '#f1f5f9'
  const axisLineColor = isDark ? '#1e293b' : '#e2e8f0'

  const projectRecords = useMemo(
    () => records.filter((r) => r.projectPath === projectPath),
    [records, projectPath],
  )

  const projectName = projectPath.replace(/\\/g, '/').split('/').pop() || projectPath

  const totalInput = projectRecords.reduce((s, r) => s + r.inputTokens, 0)
  const totalOutput = projectRecords.reduce((s, r) => s + r.outputTokens, 0)
  const totalCache = projectRecords.reduce((s, r) => s + r.cacheReadTokens, 0)
  const totalTokens = totalInput + totalOutput + totalCache

  // Session count
  const projectSessions = useMemo(
    () => sessionSummaries.filter((s) => !s.isSubagent && s.projectPath === projectPath),
    [sessionSummaries, projectPath],
  )

  // Active range
  const timestamps = projectRecords.map((r) => r.timestamp.getTime())
  const firstTime = timestamps.length > 0 ? new Date(Math.min(...timestamps)) : null
  const lastTime = timestamps.length > 0 ? new Date(Math.max(...timestamps)) : null
  const fmtDate = (d: Date) =>
    d.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })

  // Daily trend: 14 days stacked area
  const trendOption = useMemo(() => {
    const now = new Date()
    const days: string[] = []
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(d.getDate() - i)
      days.push(d.toISOString().slice(0, 10))
    }

    const buckets = new Map<string, { input: number; output: number; cache: number }>()
    for (const d of days) buckets.set(d, { input: 0, output: 0, cache: 0 })

    for (const r of projectRecords) {
      const day = r.timestamp.toISOString().slice(0, 10)
      const bucket = buckets.get(day)
      if (!bucket) continue
      bucket.input += r.inputTokens
      bucket.output += r.outputTokens
      bucket.cache += r.cacheReadTokens
    }

    return {
      tooltip: {
        trigger: 'axis' as const,
        backgroundColor: isDark ? '#111827' : '#ffffff',
        borderColor: isDark ? '#1e293b' : '#e2e8f0',
        textStyle: { color: isDark ? '#c9d1d9' : '#1a202c' },
      },
      legend: { data: ['输入', '输出', '缓存'], top: 0, textStyle: { fontSize: 10, color: axisLabelColor } },
      grid: { top: 30, right: 12, bottom: 24, left: 44 },
      xAxis: {
        type: 'category' as const,
        data: days.map((d) => d.slice(5)),
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
          type: 'line',
          stack: 'total',
          data: days.map((d) => buckets.get(d)?.input ?? 0),
          smooth: true,
          areaStyle: { opacity: 0.4 },
          lineStyle: { width: 1 },
          itemStyle: { color: CHART_COLORS.input },
        },
        {
          name: '输出',
          type: 'line',
          stack: 'total',
          data: days.map((d) => buckets.get(d)?.output ?? 0),
          smooth: true,
          areaStyle: { opacity: 0.4 },
          lineStyle: { width: 1 },
          itemStyle: { color: CHART_COLORS.output },
        },
        {
          name: '缓存',
          type: 'line',
          stack: 'total',
          data: days.map((d) => buckets.get(d)?.cache ?? 0),
          smooth: true,
          areaStyle: { opacity: 0.4 },
          lineStyle: { width: 1 },
          itemStyle: { color: CHART_COLORS.cacheRead },
        },
      ],
    }
  }, [projectRecords, isDark, axisLabelColor, axisLineColor, splitLineColor])

  // Model distribution
  const modelDist = useMemo(() => {
    const map = new Map<string, number>()
    for (const r of projectRecords) {
      map.set(r.model, (map.get(r.model) ?? 0) + r.inputTokens + r.outputTokens)
    }
    return Array.from(map.entries())
      .map(([model, tokens]) => ({ model, tokens }))
      .sort((a, b) => b.tokens - a.tokens)
  }, [projectRecords])

  const modelPieOption = useMemo(() => {
    if (modelDist.length === 0) return null
    const total = modelDist.reduce((s, m) => s + m.tokens, 0)
    return {
      tooltip: {
        trigger: 'item' as const,
        backgroundColor: isDark ? '#111827' : '#ffffff',
        borderColor: isDark ? '#1e293b' : '#e2e8f0',
        textStyle: { color: isDark ? '#c9d1d9' : '#1a202c' },
        formatter: (params: { name: string; value: number; percent: number }) =>
          `${params.name}<br/>${fmtK(params.value)} (${params.percent.toFixed(1)}%)`,
      },
      series: [
        {
          type: 'pie',
          radius: ['40%', '65%'],
          center: ['50%', '50%'],
          data: modelDist.map((m, i) => ({
            name: m.model,
            value: m.tokens,
            itemStyle: { color: MODEL_COLORS[i % MODEL_COLORS.length] },
          })),
          label: { fontSize: 10, color: axisLabelColor },
        },
      ],
    }
  }, [modelDist, isDark, axisLabelColor])

  // Cost by model
  const costByModel = useMemo(() => {
    const map = new Map<string, { input: number; output: number; cache: number }>()
    for (const r of projectRecords) {
      const pricing = getModelPricing(r.model, modelPricing)
      const entry = map.get(r.model) ?? { input: 0, output: 0, cache: 0 }
      entry.input += (r.inputTokens / 1_000_000) * pricing.input
      entry.output += (r.outputTokens / 1_000_000) * pricing.output
      entry.cache += (r.cacheReadTokens / 1_000_000) * pricing.cacheRead
      map.set(r.model, entry)
    }
    return Array.from(map.entries())
      .map(([model, c]) => ({ model, ...c, total: c.input + c.output + c.cache }))
      .sort((a, b) => b.total - a.total)
  }, [projectRecords, modelPricing])

  const totalCost = costByModel.reduce((s, c) => s + c.total, 0)

  // Related sessions (sorted by time desc)
  const topSessions = useMemo(
    () =>
      projectSessions
        .sort((a, b) => b.firstTimestamp.getTime() - a.firstTimestamp.getTime())
        .slice(0, 10),
    [projectSessions],
  )

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="space-y-2">
        <div className="text-sm font-semibold text-[var(--foreground)]">{projectName}</div>
        <div className="text-[10px] font-mono text-[var(--muted-foreground)] truncate" title={projectPath}>
          {projectPath}
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Token', value: fmtK(totalTokens), color: 'text-blue-500' },
            { label: '会话', value: `${projectSessions.length}`, color: 'text-green-500' },
            { label: '费用', value: `$${totalCost.toFixed(2)}`, color: 'text-emerald-500' },
          ].map((item) => (
            <div key={item.label} className="rounded-md border border-[var(--border)] p-2 text-center">
              <div className="text-[10px] text-[var(--muted-foreground)]">{item.label}</div>
              <div className={`font-mono text-sm font-semibold ${item.color}`}>{item.value}</div>
            </div>
          ))}
        </div>
        {firstTime && lastTime && (
          <div className="text-xs text-[var(--muted-foreground)]">
            活跃范围: {fmtDate(firstTime)} - {fmtDate(lastTime)}
          </div>
        )}
      </div>

      {/* Daily trend */}
      <div>
        <h3 className="mb-2 text-xs font-medium text-[var(--muted-foreground)]">消耗趋势（近14天）</h3>
        <ReactECharts option={trendOption} style={{ height: 180 }} />
      </div>

      {/* Model distribution */}
      {modelPieOption && (
        <div>
          <h3 className="mb-2 text-xs font-medium text-[var(--muted-foreground)]">模型分布</h3>
          <div className="flex items-start gap-4">
            <ReactECharts option={modelPieOption} style={{ height: 150, width: 150 }} />
            <div className="flex-1 space-y-1 pt-2">
              {modelDist.map((m, i) => {
                const total = modelDist.reduce((s, x) => s + x.tokens, 0)
                return (
                  <div key={m.model} className="flex items-center gap-2 text-xs">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: MODEL_COLORS[i % MODEL_COLORS.length] }}
                    />
                    <span className="min-w-0 flex-1 truncate">{m.model}</span>
                    <span className="font-mono text-[var(--muted-foreground)]">
                      {total > 0 ? `${((m.tokens / total) * 100).toFixed(0)}%` : '-'}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Cost by model */}
      {costByModel.length > 0 && (
        <div>
          <h3 className="mb-2 text-xs font-medium text-[var(--muted-foreground)]">
            费用明细 <span className="font-mono font-semibold text-emerald-500">${totalCost.toFixed(2)}</span>
          </h3>
          <div className="space-y-1">
            {costByModel.map((c) => (
              <div key={c.model} className="flex items-center gap-2 text-xs">
                <span className="min-w-0 flex-1 truncate">{c.model}</span>
                <span className="font-mono text-blue-500">${c.input.toFixed(2)}</span>
                <span className="text-[var(--muted-foreground)]">/</span>
                <span className="font-mono text-purple-500">${c.output.toFixed(2)}</span>
                <span className="text-[var(--muted-foreground)]">/</span>
                <span className="font-mono text-cyan-500">${c.cache.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Related sessions */}
      {topSessions.length > 0 && (
        <div>
          <h3 className="mb-2 text-xs font-medium text-[var(--muted-foreground)]">关联会话</h3>
          <div className="space-y-1">
            {topSessions.map((s, i) => (
              <div
                key={s.id}
                onClick={() => openDrilldown('session', { sessionId: s.sessionId })}
                className="group/row flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors hover:bg-[var(--muted)]"
              >
                <span className="w-5 shrink-0 font-mono text-[var(--muted-foreground)]">
                  #{i + 1}
                </span>
                <span className="w-20 shrink-0 truncate font-mono text-[var(--muted-foreground)]" title={s.sessionId}>
                  {s.sessionId.slice(0, 8)}
                </span>
                <span className="min-w-0 flex-1 truncate">{s.firstUserMessage}</span>
                <span className="shrink-0 text-[var(--muted-foreground)]">
                  {s.firstTimestamp.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })}
                </span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 text-[var(--muted-foreground)] opacity-0 transition-opacity group-hover/row:opacity-100"><path d="m9 18 6-6-6-6" /></svg>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
