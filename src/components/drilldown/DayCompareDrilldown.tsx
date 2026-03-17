// Day comparison drilldown — compare two days side by side
import { useMemo } from 'react'
import ReactECharts from 'echarts-for-react'
import { useDataStore } from '../../stores/dataStore'
import { useSettingsStore } from '../../stores/settingsStore'
import { useTheme } from '../../hooks/useTheme'
import { getModelPricing, CHART_COLORS } from '../../lib/constants'
import { fmtK } from '../../lib/format'

const MODEL_COLORS = ['#3b82f6', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#6366f1']

interface DayStats {
  input: number
  output: number
  cacheRead: number
  cost: number
  requests: number
}

function computeDayStats(
  records: ReturnType<typeof useDataStore.getState>['tokenRecords'],
  day: string,
  modelPricing: ReturnType<typeof useSettingsStore.getState>['modelPricing'],
): DayStats {
  const dayRecords = records.filter((r) => r.timestamp.toISOString().slice(0, 10) === day)
  let input = 0, output = 0, cacheRead = 0, cost = 0
  for (const r of dayRecords) {
    input += r.inputTokens
    output += r.outputTokens
    cacheRead += r.cacheReadTokens
    const pricing = getModelPricing(r.model, modelPricing)
    cost +=
      (r.inputTokens / 1_000_000) * pricing.input +
      (r.outputTokens / 1_000_000) * pricing.output +
      (r.cacheReadTokens / 1_000_000) * pricing.cacheRead
  }
  return { input, output, cacheRead, cost, requests: dayRecords.length }
}

function DiffBadge({ current, previous }: { current: number; previous: number }) {
  if (previous === 0) return <span className="text-[10px] text-[var(--muted-foreground)]">-</span>
  const diff = ((current - previous) / previous) * 100
  const arrow = diff >= 0 ? '↑' : '↓'
  const cls = diff >= 0 ? 'text-green-500' : 'text-rose-500'
  return <span className={`text-[10px] font-medium ${cls}`}>{arrow}{Math.abs(diff).toFixed(0)}%</span>
}

export default function DayCompareDrilldown({ day, compareDay }: { day: string; compareDay: string }) {
  const records = useDataStore((s) => s.tokenRecords)
  const modelPricing = useSettingsStore((s) => s.modelPricing)
  const { isDark } = useTheme()

  const axisLabelColor = isDark ? '#8892a8' : '#64748b'
  const splitLineColor = isDark ? '#151d2e' : '#f1f5f9'
  const axisLineColor = isDark ? '#1e293b' : '#e2e8f0'

  const current = useMemo(() => computeDayStats(records, day, modelPricing), [records, day, modelPricing])
  const previous = useMemo(() => computeDayStats(records, compareDay, modelPricing), [records, compareDay, modelPricing])

  // Hourly comparison chart
  const hourlyOption = useMemo(() => {
    const hours = Array.from({ length: 24 }, (_, i) => `${i.toString().padStart(2, '0')}:00`)
    const curByHour = new Array(24).fill(0)
    const prevByHour = new Array(24).fill(0)

    const curRecords = records.filter((r) => r.timestamp.toISOString().slice(0, 10) === day)
    const prevRecords = records.filter((r) => r.timestamp.toISOString().slice(0, 10) === compareDay)

    for (const r of curRecords) curByHour[r.timestamp.getHours()] += r.inputTokens + r.outputTokens + r.cacheReadTokens
    for (const r of prevRecords) prevByHour[r.timestamp.getHours()] += r.inputTokens + r.outputTokens + r.cacheReadTokens

    return {
      tooltip: {
        trigger: 'axis' as const,
        backgroundColor: isDark ? '#111827' : '#ffffff',
        borderColor: isDark ? '#1e293b' : '#e2e8f0',
        textStyle: { color: isDark ? '#c9d1d9' : '#1a202c' },
      },
      legend: {
        data: [day.slice(5), compareDay.slice(5)],
        top: 0,
        right: 0,
        textStyle: { color: axisLabelColor, fontSize: 10 },
        itemWidth: 12,
        itemHeight: 8,
      },
      grid: { left: 40, right: 8, top: 28, bottom: 24 },
      xAxis: {
        type: 'category' as const,
        data: hours,
        axisLabel: { fontSize: 9, color: axisLabelColor, interval: 2 },
        axisLine: { lineStyle: { color: axisLineColor } },
      },
      yAxis: {
        type: 'value' as const,
        axisLabel: { fontSize: 9, formatter: (v: number) => fmtK(v), color: axisLabelColor },
        splitLine: { lineStyle: { color: splitLineColor } },
      },
      series: [
        {
          name: day.slice(5),
          type: 'bar',
          data: curByHour,
          itemStyle: { color: CHART_COLORS.input },
        },
        {
          name: compareDay.slice(5),
          type: 'bar',
          data: prevByHour,
          itemStyle: { color: isDark ? '#475569' : '#cbd5e1' },
        },
      ],
    }
  }, [records, day, compareDay, isDark, axisLabelColor, axisLineColor, splitLineColor])

  // Model comparison
  const modelComparison = useMemo(() => {
    const curRecords = records.filter((r) => r.timestamp.toISOString().slice(0, 10) === day)
    const prevRecords = records.filter((r) => r.timestamp.toISOString().slice(0, 10) === compareDay)

    const models = new Set<string>()
    const curMap = new Map<string, number>()
    const prevMap = new Map<string, number>()

    for (const r of curRecords) {
      models.add(r.model)
      curMap.set(r.model, (curMap.get(r.model) ?? 0) + r.inputTokens + r.outputTokens + r.cacheReadTokens)
    }
    for (const r of prevRecords) {
      models.add(r.model)
      prevMap.set(r.model, (prevMap.get(r.model) ?? 0) + r.inputTokens + r.outputTokens + r.cacheReadTokens)
    }

    return Array.from(models)
      .map((model) => ({
        model,
        current: curMap.get(model) ?? 0,
        previous: prevMap.get(model) ?? 0,
      }))
      .sort((a, b) => b.current - a.current)
  }, [records, day, compareDay])

  // Project comparison
  const projectComparison = useMemo(() => {
    const curRecords = records.filter((r) => r.timestamp.toISOString().slice(0, 10) === day)
    const prevRecords = records.filter((r) => r.timestamp.toISOString().slice(0, 10) === compareDay)

    const projects = new Set<string>()
    const curMap = new Map<string, number>()
    const prevMap = new Map<string, number>()

    for (const r of curRecords) {
      const name = (r.projectPath || '未知').split(/[/\\]/).pop() || r.projectPath
      projects.add(name)
      curMap.set(name, (curMap.get(name) ?? 0) + r.inputTokens + r.outputTokens + r.cacheReadTokens)
    }
    for (const r of prevRecords) {
      const name = (r.projectPath || '未知').split(/[/\\]/).pop() || r.projectPath
      projects.add(name)
      prevMap.set(name, (prevMap.get(name) ?? 0) + r.inputTokens + r.outputTokens + r.cacheReadTokens)
    }

    return Array.from(projects)
      .map((name) => ({
        name,
        current: curMap.get(name) ?? 0,
        previous: prevMap.get(name) ?? 0,
      }))
      .sort((a, b) => b.current - a.current)
  }, [records, day, compareDay])

  const curTotal = current.input + current.output + current.cacheRead
  const prevTotal = previous.input + previous.output + previous.cacheRead

  return (
    <div className="space-y-5">
      {/* Summary comparison */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-md border border-[var(--border)] p-3 text-center">
          <div className="text-[10px] text-[var(--muted-foreground)]">{day.slice(5)}</div>
          <div className="font-mono text-lg font-bold text-[var(--foreground)]">{fmtK(curTotal)}</div>
          <div className="text-[10px] text-[var(--muted-foreground)]">${current.cost.toFixed(2)}</div>
        </div>
        <div className="rounded-md border border-[var(--border)] p-3 text-center">
          <div className="text-[10px] text-[var(--muted-foreground)]">{compareDay.slice(5)}</div>
          <div className="font-mono text-lg font-bold text-[var(--muted-foreground)]">{fmtK(prevTotal)}</div>
          <div className="text-[10px] text-[var(--muted-foreground)]">${previous.cost.toFixed(2)}</div>
        </div>
      </div>

      {/* Metric rows */}
      <div className="space-y-1.5">
        {[
          { label: '请求', cur: current.requests, prev: previous.requests, color: 'text-green-500' },
          { label: '输入', cur: current.input, prev: previous.input, color: 'text-blue-500' },
          { label: '输出', cur: current.output, prev: previous.output, color: 'text-purple-500' },
          { label: '缓存', cur: current.cacheRead, prev: previous.cacheRead, color: 'text-cyan-500' },
          { label: '费用', cur: current.cost, prev: previous.cost, color: 'text-emerald-500', isCost: true },
        ].map((m) => (
          <div key={m.label} className="flex items-center gap-2 text-xs">
            <span className="w-8 text-[var(--muted-foreground)]">{m.label}</span>
            <span className={`w-16 text-right font-mono font-semibold ${m.color}`}>
              {m.isCost ? `$${m.cur.toFixed(2)}` : fmtK(m.cur)}
            </span>
            <span className="w-4 text-center text-[var(--muted-foreground)]">→</span>
            <span className="w-16 text-right font-mono text-[var(--muted-foreground)]">
              {m.isCost ? `$${m.prev.toFixed(2)}` : fmtK(m.prev)}
            </span>
            <DiffBadge current={m.cur} previous={m.prev} />
          </div>
        ))}
      </div>

      {/* Hourly comparison chart */}
      <div>
        <h3 className="mb-2 text-xs font-medium text-[var(--muted-foreground)]">小时分布对比</h3>
        <ReactECharts option={hourlyOption} style={{ height: 180 }} />
      </div>

      {/* Model comparison */}
      {modelComparison.length > 0 && (
        <div>
          <h3 className="mb-2 text-xs font-medium text-[var(--muted-foreground)]">模型对比</h3>
          <div className="space-y-1">
            {modelComparison.map((m, i) => (
              <div key={m.model} className="flex items-center gap-2 text-xs">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: MODEL_COLORS[i % MODEL_COLORS.length] }}
                />
                <span className="min-w-0 flex-1 truncate text-[var(--foreground)]">{m.model}</span>
                <span className="font-mono text-[var(--foreground)]">{fmtK(m.current)}</span>
                <span className="font-mono text-[var(--muted-foreground)]">{fmtK(m.previous)}</span>
                <DiffBadge current={m.current} previous={m.previous} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Project comparison */}
      {projectComparison.length > 0 && (
        <div>
          <h3 className="mb-2 text-xs font-medium text-[var(--muted-foreground)]">项目对比</h3>
          <div className="space-y-1">
            {projectComparison.map((p, i) => (
              <div key={p.name} className="flex items-center gap-2 text-xs">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: MODEL_COLORS[i % MODEL_COLORS.length] }}
                />
                <span className="min-w-0 flex-1 truncate text-[var(--foreground)]">{p.name}</span>
                <span className="font-mono text-[var(--foreground)]">{fmtK(p.current)}</span>
                <span className="font-mono text-[var(--muted-foreground)]">{fmtK(p.previous)}</span>
                <DiffBadge current={p.current} previous={p.previous} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
