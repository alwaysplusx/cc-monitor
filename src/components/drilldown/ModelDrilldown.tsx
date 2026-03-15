// Model drilldown panel — usage trend, project distribution, efficiency, sessions
import { useMemo } from 'react'
import ReactECharts from 'echarts-for-react'
import { useDataStore } from '../../stores/dataStore'
import { useTheme } from '../../hooks/useTheme'
import { CHART_COLORS } from '../../lib/constants'
import { fmtK } from '../../lib/format'

const PROJECT_COLORS = ['#3b82f6', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444']

function shortProject(path: string): string {
  return path.replace(/\\/g, '/').split('/').pop() || path
}

export default function ModelDrilldown({ model }: { model: string }) {
  const records = useDataStore((s) => s.tokenRecords)
  const sessionSummaries = useDataStore((s) => s.sessionSummaries)
  const openDrilldown = useDataStore((s) => s.openDrilldown)
  const { isDark } = useTheme()

  const axisLabelColor = isDark ? '#8892a8' : '#64748b'
  const splitLineColor = isDark ? '#151d2e' : '#f1f5f9'
  const axisLineColor = isDark ? '#1e293b' : '#e2e8f0'

  const modelRecords = useMemo(
    () => records.filter((r) => r.model === model),
    [records, model],
  )

  const allRecords = records

  const totalInput = modelRecords.reduce((s, r) => s + r.inputTokens, 0)
  const totalOutput = modelRecords.reduce((s, r) => s + r.outputTokens, 0)
  const totalCache = modelRecords.reduce((s, r) => s + r.cacheReadTokens, 0)
  const totalAll = allRecords.reduce((s, r) => s + r.inputTokens + r.outputTokens, 0)
  const totalModel = totalInput + totalOutput
  const percentage = totalAll > 0 ? ((totalModel / totalAll) * 100).toFixed(1) : '0'

  // Daily trend: 14 days
  const trendOption = useMemo(() => {
    const now = new Date()
    const days: string[] = []
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(d.getDate() - i)
      days.push(d.toISOString().slice(0, 10))
    }

    const modelBuckets = new Map<string, number>()
    const otherBuckets = new Map<string, number>()
    for (const d of days) {
      modelBuckets.set(d, 0)
      otherBuckets.set(d, 0)
    }

    for (const r of allRecords) {
      const day = r.timestamp.toISOString().slice(0, 10)
      const tokens = r.inputTokens + r.outputTokens
      if (r.model === model) {
        modelBuckets.set(day, (modelBuckets.get(day) ?? 0) + tokens)
      } else {
        otherBuckets.set(day, (otherBuckets.get(day) ?? 0) + tokens)
      }
    }

    return {
      tooltip: {
        trigger: 'axis' as const,
        backgroundColor: isDark ? '#111827' : '#ffffff',
        borderColor: isDark ? '#1e293b' : '#e2e8f0',
        textStyle: { color: isDark ? '#c9d1d9' : '#1a202c' },
      },
      legend: { data: [model, '其他模型'], top: 0, textStyle: { fontSize: 10, color: axisLabelColor } },
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
          name: model,
          type: 'line',
          data: days.map((d) => modelBuckets.get(d) ?? 0),
          smooth: true,
          lineStyle: { width: 2 },
          itemStyle: { color: CHART_COLORS.input },
          areaStyle: { opacity: 0.1 },
        },
        {
          name: '其他模型',
          type: 'line',
          data: days.map((d) => otherBuckets.get(d) ?? 0),
          smooth: true,
          lineStyle: { width: 1, type: 'dashed' as const },
          itemStyle: { color: '#888' },
        },
      ],
    }
  }, [allRecords, model, isDark, axisLabelColor, axisLineColor, splitLineColor])

  // Project distribution
  const projectDist = useMemo(() => {
    const map = new Map<string, number>()
    for (const r of modelRecords) {
      const key = r.projectPath
      map.set(key, (map.get(key) ?? 0) + r.inputTokens + r.outputTokens)
    }
    return Array.from(map.entries())
      .map(([path, tokens]) => ({ path, name: shortProject(path), tokens }))
      .sort((a, b) => b.tokens - a.tokens)
  }, [modelRecords])

  const projectBarOption = useMemo(() => {
    if (projectDist.length === 0) return null
    return {
      tooltip: {
        trigger: 'axis' as const,
        axisPointer: { type: 'shadow' as const },
        backgroundColor: isDark ? '#111827' : '#ffffff',
        borderColor: isDark ? '#1e293b' : '#e2e8f0',
        textStyle: { color: isDark ? '#c9d1d9' : '#1a202c' },
      },
      grid: { top: 8, right: 12, bottom: 4, left: 80, containLabel: false },
      xAxis: {
        type: 'value' as const,
        axisLabel: { fontSize: 10, formatter: (v: number) => fmtK(v), color: axisLabelColor },
        axisLine: { lineStyle: { color: axisLineColor } },
        splitLine: { lineStyle: { color: splitLineColor } },
      },
      yAxis: {
        type: 'category' as const,
        data: projectDist.map((p) => p.name).reverse(),
        axisLabel: { fontSize: 10, width: 70, overflow: 'truncate' as const, color: axisLabelColor },
        axisLine: { lineStyle: { color: axisLineColor } },
      },
      series: [
        {
          type: 'bar',
          data: projectDist.map((p, i) => ({
            value: p.tokens,
            itemStyle: { color: PROJECT_COLORS[i % PROJECT_COLORS.length] },
          })).reverse(),
        },
      ],
    }
  }, [projectDist, isDark, axisLabelColor, axisLineColor, splitLineColor])

  // Efficiency metrics
  const avgInput = modelRecords.length > 0 ? Math.round(totalInput / modelRecords.length) : 0
  const avgOutput = modelRecords.length > 0 ? Math.round(totalOutput / modelRecords.length) : 0
  const outputRatio = totalInput > 0 ? (totalOutput / totalInput).toFixed(2) : '-'
  const cacheRate = totalInput + totalCache > 0
    ? ((totalCache / (totalInput + totalCache)) * 100).toFixed(1)
    : '0'

  // Related sessions
  const relatedSessions = useMemo(() => {
    return sessionSummaries
      .filter((s) => !s.isSubagent && s.models.includes(model))
      .sort((a, b) => (b.totalInput + b.totalOutput) - (a.totalInput + a.totalOutput))
      .slice(0, 10)
  }, [sessionSummaries, model])

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="space-y-2">
        <div className="text-sm font-semibold text-[var(--foreground)]">{model}</div>
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Token', value: fmtK(totalModel), color: 'text-blue-500' },
            { label: '请求', value: fmtK(modelRecords.length), color: 'text-green-500' },
            { label: '占比', value: `${percentage}%`, color: 'text-purple-500' },
          ].map((item) => (
            <div key={item.label} className="rounded-md border border-[var(--border)] p-2 text-center">
              <div className="text-[10px] text-[var(--muted-foreground)]">{item.label}</div>
              <div className={`font-mono text-sm font-semibold ${item.color}`}>{item.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Usage trend */}
      <div>
        <h3 className="mb-2 text-xs font-medium text-[var(--muted-foreground)]">使用趋势（近14天）</h3>
        <ReactECharts option={trendOption} style={{ height: 180 }} />
      </div>

      {/* Project distribution */}
      {projectBarOption && (
        <div>
          <h3 className="mb-2 text-xs font-medium text-[var(--muted-foreground)]">项目分布</h3>
          <ReactECharts
            option={projectBarOption}
            style={{ height: Math.max(100, projectDist.length * 28 + 20) }}
          />
        </div>
      )}

      {/* Efficiency metrics */}
      <div>
        <h3 className="mb-2 text-xs font-medium text-[var(--muted-foreground)]">效率指标</h3>
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: '平均输入/次', value: fmtK(avgInput) },
            { label: '平均输出/次', value: fmtK(avgOutput) },
            { label: '输出/输入比', value: outputRatio },
            { label: '缓存命中率', value: `${cacheRate}%` },
          ].map((item) => (
            <div key={item.label} className="rounded-md border border-[var(--border)] px-3 py-2">
              <div className="text-[10px] text-[var(--muted-foreground)]">{item.label}</div>
              <div className="font-mono text-sm">{item.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Related sessions */}
      {relatedSessions.length > 0 && (
        <div>
          <h3 className="mb-2 text-xs font-medium text-[var(--muted-foreground)]">关联会话 Top 10</h3>
          <div className="space-y-1">
            {relatedSessions.map((s, i) => (
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
                <span className="shrink-0 font-mono text-[var(--muted-foreground)]">
                  {fmtK(s.totalInput + s.totalOutput)}
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
