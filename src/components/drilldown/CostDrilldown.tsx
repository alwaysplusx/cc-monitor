// Cost drilldown panel — fee overview, daily trend, project/model ranking, top sessions
import { useMemo, useState } from 'react'
import ReactECharts from 'echarts-for-react'
import { useDataStore } from '../../stores/dataStore'
import { useSettingsStore } from '../../stores/settingsStore'
import { getModelPricing, CHART_COLORS } from '../../lib/constants'
import { useTheme } from '../../hooks/useTheme'
import type { TokenRecord, SessionSummary } from '../../types/data'

type DateRange = '7d' | '14d' | '30d'

/** Calculate cost breakdown for a set of token records */
function calcCost(
  records: TokenRecord[],
  modelPricing: ReturnType<typeof useSettingsStore.getState>['modelPricing'],
) {
  let inputCost = 0
  let outputCost = 0
  let cacheCost = 0
  for (const r of records) {
    const pricing = getModelPricing(r.model, modelPricing)
    inputCost += (r.inputTokens / 1_000_000) * pricing.input
    outputCost += (r.outputTokens / 1_000_000) * pricing.output
    cacheCost += (r.cacheReadTokens / 1_000_000) * pricing.cacheRead
  }
  return { inputCost, outputCost, cacheCost, total: inputCost + outputCost + cacheCost }
}

/** Get short project name from full path */
function shortProject(path: string): string {
  const parts = path.replace(/\\/g, '/').split('/')
  return parts[parts.length - 1] || path
}

export default function CostDrilldown() {
  const records = useDataStore((s) => s.tokenRecords)
  const sessionSummaries = useDataStore((s) => s.sessionSummaries)
  const openDrilldown = useDataStore((s) => s.openDrilldown)
  const modelPricing = useSettingsStore((s) => s.modelPricing)
  const { isDark } = useTheme()
  const [dateRange, setDateRange] = useState<DateRange>('14d')
  const splitLineColor = isDark ? '#1e293b' : '#e2e8f0'

  const cost = useMemo(() => calcCost(records, modelPricing), [records, modelPricing])

  // Active days count
  const activeDays = useMemo(() => {
    const days = new Set(records.map((r) => r.timestamp.toISOString().slice(0, 10)))
    return Math.max(days.size, 1)
  }, [records])

  // Daily cost trend data
  const dailyTrend = useMemo(() => {
    const days = dateRange === '7d' ? 7 : dateRange === '14d' ? 14 : 30
    const now = new Date()
    const dateLabels: string[] = []
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(d.getDate() - i)
      dateLabels.push(d.toISOString().slice(0, 10))
    }

    const buckets = new Map<string, { input: number; output: number; cache: number }>()
    for (const label of dateLabels) {
      buckets.set(label, { input: 0, output: 0, cache: 0 })
    }

    for (const r of records) {
      const day = r.timestamp.toISOString().slice(0, 10)
      const bucket = buckets.get(day)
      if (!bucket) continue
      const pricing = getModelPricing(r.model, modelPricing)
      bucket.input += (r.inputTokens / 1_000_000) * pricing.input
      bucket.output += (r.outputTokens / 1_000_000) * pricing.output
      bucket.cache += (r.cacheReadTokens / 1_000_000) * pricing.cacheRead
    }

    return {
      dates: dateLabels.map((d) => d.slice(5)), // MM-DD
      input: dateLabels.map((d) => +(buckets.get(d)?.input ?? 0).toFixed(4)),
      output: dateLabels.map((d) => +(buckets.get(d)?.output ?? 0).toFixed(4)),
      cache: dateLabels.map((d) => +(buckets.get(d)?.cache ?? 0).toFixed(4)),
    }
  }, [records, modelPricing, dateRange])

  // Project cost ranking
  const projectRanking = useMemo(() => {
    const map = new Map<string, TokenRecord[]>()
    for (const r of records) {
      const key = r.projectPath
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(r)
    }
    const items = Array.from(map.entries()).map(([path, recs]) => ({
      path,
      name: shortProject(path),
      ...calcCost(recs, modelPricing),
    }))
    items.sort((a, b) => b.total - a.total)
    if (items.length > 10) {
      const others = items.slice(10)
      const merged = others.reduce(
        (acc, item) => ({
          inputCost: acc.inputCost + item.inputCost,
          outputCost: acc.outputCost + item.outputCost,
          cacheCost: acc.cacheCost + item.cacheCost,
          total: acc.total + item.total,
        }),
        { inputCost: 0, outputCost: 0, cacheCost: 0, total: 0 },
      )
      return [
        ...items.slice(0, 10),
        { path: '', name: '其他', ...merged },
      ]
    }
    return items
  }, [records, modelPricing])

  // Model cost ranking
  const modelRanking = useMemo(() => {
    const map = new Map<string, TokenRecord[]>()
    for (const r of records) {
      if (!map.has(r.model)) map.set(r.model, [])
      map.get(r.model)!.push(r)
    }
    const items = Array.from(map.entries()).map(([model, recs]) => ({
      model,
      ...calcCost(recs, modelPricing),
    }))
    items.sort((a, b) => b.total - a.total)
    return items
  }, [records, modelPricing])

  // Top 10 most expensive sessions
  const topSessions = useMemo(() => {
    const map = new Map<string, TokenRecord[]>()
    for (const r of records) {
      if (!map.has(r.sessionId)) map.set(r.sessionId, [])
      map.get(r.sessionId)!.push(r)
    }
    const sessionMap = new Map<string, SessionSummary>()
    for (const s of sessionSummaries) {
      sessionMap.set(s.sessionId, s)
    }

    const items = Array.from(map.entries()).map(([sessionId, recs]) => {
      const summary = sessionMap.get(sessionId)
      return {
        sessionId,
        summary: summary?.firstUserMessage || sessionId.slice(0, 8),
        project: summary ? shortProject(summary.projectPath) : '-',
        model: summary?.models[0] || '-',
        time: summary?.firstTimestamp || recs[0].timestamp,
        ...calcCost(recs, modelPricing),
      }
    })
    items.sort((a, b) => b.total - a.total)
    return items.slice(0, 10)
  }, [records, sessionSummaries, modelPricing])

  // ECharts options
  const trendOption = useMemo(
    () => ({
      tooltip: {
        trigger: 'axis' as const,
        formatter: (params: { seriesName: string; value: number; axisValue: string }[]) => {
          const date = params[0].axisValue
          const total = params.reduce((s, p) => s + p.value, 0)
          return `<b>${date}</b><br/>${params
            .map((p) => `${p.seriesName}: $${p.value.toFixed(4)}`)
            .join('<br/>')}<br/><b>合计: $${total.toFixed(4)}</b>`
        },
      },
      legend: { data: ['输入', '输出', '缓存'], top: 0, textStyle: { fontSize: 11 } },
      grid: { top: 30, right: 12, bottom: 24, left: 44 },
      xAxis: { type: 'category' as const, data: dailyTrend.dates, axisLabel: { fontSize: 10 }, splitLine: { show: false } },
      yAxis: {
        type: 'value' as const,
        axisLabel: { fontSize: 10, formatter: (v: number) => `$${v}` },
        splitLine: { lineStyle: { color: splitLineColor } },
      },
      series: [
        {
          name: '输入',
          type: 'line',
          data: dailyTrend.input,
          smooth: true,
          lineStyle: { width: 2 },
          itemStyle: { color: CHART_COLORS.input },
          areaStyle: { opacity: 0.1 },
        },
        {
          name: '输出',
          type: 'line',
          data: dailyTrend.output,
          smooth: true,
          lineStyle: { width: 2 },
          itemStyle: { color: CHART_COLORS.output },
          areaStyle: { opacity: 0.1 },
        },
        {
          name: '缓存',
          type: 'line',
          data: dailyTrend.cache,
          smooth: true,
          lineStyle: { width: 2 },
          itemStyle: { color: CHART_COLORS.cacheRead },
          areaStyle: { opacity: 0.1 },
        },
      ],
    }),
    [dailyTrend, splitLineColor],
  )

  const projectBarOption = useMemo(
    () => ({
      tooltip: {
        trigger: 'axis' as const,
        axisPointer: { type: 'shadow' as const },
        formatter: (params: { seriesName: string; value: number; name: string }[]) => {
          const name = params[0].name
          const total = params.reduce((s, p) => s + p.value, 0)
          return `<b>${name}</b><br/>${params
            .map((p) => `${p.seriesName}: $${p.value.toFixed(4)}`)
            .join('<br/>')}<br/><b>合计: $${total.toFixed(4)}</b>`
        },
      },
      legend: { data: ['输入', '输出', '缓存'], top: 0, textStyle: { fontSize: 11 } },
      grid: { top: 30, right: 12, bottom: 4, left: 80, containLabel: false },
      xAxis: {
        type: 'value' as const,
        axisLabel: { fontSize: 10, formatter: (v: number) => `$${v}` },
        splitLine: { lineStyle: { color: splitLineColor } },
      },
      yAxis: {
        type: 'category' as const,
        data: projectRanking.map((p) => p.name).reverse(),
        axisLabel: { fontSize: 10, width: 70, overflow: 'truncate' as const },
        splitLine: { show: false },
      },
      series: [
        {
          name: '输入',
          type: 'bar',
          stack: 'cost',
          data: projectRanking.map((p) => +p.inputCost.toFixed(4)).reverse(),
          itemStyle: { color: CHART_COLORS.input },
        },
        {
          name: '输出',
          type: 'bar',
          stack: 'cost',
          data: projectRanking.map((p) => +p.outputCost.toFixed(4)).reverse(),
          itemStyle: { color: CHART_COLORS.output },
        },
        {
          name: '缓存',
          type: 'bar',
          stack: 'cost',
          data: projectRanking.map((p) => +p.cacheCost.toFixed(4)).reverse(),
          itemStyle: { color: CHART_COLORS.cacheRead },
        },
      ],
    }),
    [projectRanking, splitLineColor],
  )

  const modelBarOption = useMemo(
    () => ({
      tooltip: {
        trigger: 'axis' as const,
        axisPointer: { type: 'shadow' as const },
        formatter: (params: { seriesName: string; value: number; name: string }[]) => {
          const name = params[0].name
          const total = params.reduce((s, p) => s + p.value, 0)
          return `<b>${name}</b><br/>${params
            .map((p) => `${p.seriesName}: $${p.value.toFixed(4)}`)
            .join('<br/>')}<br/><b>合计: $${total.toFixed(4)}</b>`
        },
      },
      legend: { data: ['输入', '输出', '缓存'], top: 0, textStyle: { fontSize: 11 } },
      grid: { top: 30, right: 12, bottom: 4, left: 100, containLabel: false },
      xAxis: {
        type: 'value' as const,
        axisLabel: { fontSize: 10, formatter: (v: number) => `$${v}` },
        splitLine: { lineStyle: { color: splitLineColor } },
      },
      yAxis: {
        type: 'category' as const,
        data: modelRanking.map((m) => m.model).reverse(),
        axisLabel: { fontSize: 10, width: 90, overflow: 'truncate' as const },
        splitLine: { show: false },
      },
      series: [
        {
          name: '输入',
          type: 'bar',
          stack: 'cost',
          data: modelRanking.map((m) => +m.inputCost.toFixed(4)).reverse(),
          itemStyle: { color: CHART_COLORS.input },
        },
        {
          name: '输出',
          type: 'bar',
          stack: 'cost',
          data: modelRanking.map((m) => +m.outputCost.toFixed(4)).reverse(),
          itemStyle: { color: CHART_COLORS.output },
        },
        {
          name: '缓存',
          type: 'bar',
          stack: 'cost',
          data: modelRanking.map((m) => +m.cacheCost.toFixed(4)).reverse(),
          itemStyle: { color: CHART_COLORS.cacheRead },
        },
      ],
    }),
    [modelRanking, splitLineColor],
  )

  return (
    <div className="space-y-5">
      {/* Fee overview header */}
      <div className="space-y-3">
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-3xl font-bold text-emerald-500">
            ${cost.total.toFixed(2)}
          </span>
          <span className="text-sm text-[var(--muted-foreground)]">
            日均 ${(cost.total / activeDays).toFixed(2)}
          </span>
        </div>
        <div className="space-y-2">
          {[
            { label: '输入', value: cost.inputCost, color: CHART_COLORS.input },
            { label: '输出', value: cost.outputCost, color: CHART_COLORS.output },
            { label: '缓存', value: cost.cacheCost, color: CHART_COLORS.cacheRead },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-2">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              <span className="w-8 text-xs text-[var(--muted-foreground)]">{item.label}</span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--border)]">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${cost.total > 0 ? (item.value / cost.total) * 100 : 0}%`,
                    backgroundColor: item.color,
                  }}
                />
              </div>
              <span className="w-16 text-right font-mono text-xs">${item.value.toFixed(2)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Daily cost trend */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-xs font-medium text-[var(--muted-foreground)]">每日费用趋势</h3>
          <div className="flex gap-1">
            {(['7d', '14d', '30d'] as DateRange[]).map((range) => (
              <button
                key={range}
                onClick={() => setDateRange(range)}
                className={`rounded px-2 py-0.5 text-xs transition-colors ${
                  dateRange === range
                    ? 'bg-[var(--primary)] text-[var(--primary-foreground)]'
                    : 'text-[var(--muted-foreground)] hover:bg-[var(--muted)]'
                }`}
              >
                {range}
              </button>
            ))}
          </div>
        </div>
        <ReactECharts option={trendOption} style={{ height: 200 }} />
      </div>

      {/* Project cost ranking */}
      {projectRanking.length > 0 && (
        <div>
          <h3 className="mb-2 text-xs font-medium text-[var(--muted-foreground)]">
            按项目费用排行
          </h3>
          <ReactECharts
            option={projectBarOption}
            style={{ height: Math.max(120, projectRanking.length * 28 + 40) }}
          />
        </div>
      )}

      {/* Model cost ranking */}
      {modelRanking.length > 0 && (
        <div>
          <h3 className="mb-2 text-xs font-medium text-[var(--muted-foreground)]">
            按模型费用排行
          </h3>
          <ReactECharts
            option={modelBarOption}
            style={{ height: Math.max(120, modelRanking.length * 28 + 40) }}
          />
        </div>
      )}

      {/* Top 10 most expensive sessions */}
      {topSessions.length > 0 && (
        <div>
          <h3 className="mb-2 text-xs font-medium text-[var(--muted-foreground)]">
            最贵会话 Top 10
          </h3>
          <div className="space-y-1">
            {topSessions.map((s, i) => (
              <div
                key={s.sessionId}
                onClick={() => openDrilldown('session', { sessionId: s.sessionId })}
                className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors hover:bg-[var(--muted)]"
              >
                <span className="w-4 shrink-0 text-right font-mono text-[var(--muted-foreground)]">
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1 truncate" title={s.summary}>
                  {s.summary}
                </span>
                <span className="shrink-0 text-[var(--muted-foreground)]">{s.project}</span>
                <span className="w-16 shrink-0 text-right font-mono font-semibold text-emerald-500">
                  ${s.total.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
