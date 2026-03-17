// Day drilldown panel — daily summary with hourly chart, model/project breakdown, sessions
import { useMemo, useState } from 'react'
import ReactECharts from 'echarts-for-react'
import { useDataStore } from '../../stores/dataStore'
import { useSettingsStore } from '../../stores/settingsStore'
import { useTheme } from '../../hooks/useTheme'
import { getModelPricing, CHART_COLORS } from '../../lib/constants'
import { fmtK, fmtDuration } from '../../lib/format'
import DatePicker from '../ui/DatePicker'

const MODEL_COLORS = ['#3b82f6', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#6366f1']
const PROJECT_COLORS = ['#3b82f6', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#6366f1']

export default function DayDrilldown({ day }: { day: string }) {
  const records = useDataStore((s) => s.tokenRecords)
  const dayBuckets = useDataStore((s) => s.dayBuckets)
  const sessionSummaries = useDataStore((s) => s.sessionSummaries)
  const openDrilldown = useDataStore((s) => s.openDrilldown)
  const modelPricing = useSettingsStore((s) => s.modelPricing)
  const { isDark } = useTheme()

  // Days with activity for the date picker
  const activeDays = useMemo(
    () => new Set(dayBuckets.filter((b) => b.input + b.output > 0).map((b) => b.day)),
    [dayBuckets],
  )

  const axisLabelColor = isDark ? '#8892a8' : '#64748b'
  const splitLineColor = isDark ? '#151d2e' : '#f1f5f9'
  const axisLineColor = isDark ? '#1e293b' : '#e2e8f0'

  // Filter records for this day
  const dayRecords = useMemo(
    () => records.filter((r) => r.timestamp.toISOString().slice(0, 10) === day),
    [records, day],
  )

  // Summary stats
  const stats = useMemo(() => {
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
  }, [dayRecords, modelPricing])

  // Hourly distribution chart
  const hourlyOption = useMemo(() => {
    const hours = Array.from({ length: 24 }, (_, i) => `${i.toString().padStart(2, '0')}:00`)
    const inputByHour = new Array(24).fill(0)
    const outputByHour = new Array(24).fill(0)
    const cacheByHour = new Array(24).fill(0)

    for (const r of dayRecords) {
      const h = r.timestamp.getHours()
      inputByHour[h] += r.inputTokens
      outputByHour[h] += r.outputTokens
      cacheByHour[h] += r.cacheReadTokens
    }

    return {
      tooltip: {
        trigger: 'axis' as const,
        backgroundColor: isDark ? '#111827' : '#ffffff',
        borderColor: isDark ? '#1e293b' : '#e2e8f0',
        textStyle: { color: isDark ? '#c9d1d9' : '#1a202c' },
      },
      grid: { left: 40, right: 8, top: 8, bottom: 24 },
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
        { name: '输入', type: 'bar', stack: 'token', data: inputByHour, itemStyle: { color: CHART_COLORS.input } },
        { name: '输出', type: 'bar', stack: 'token', data: outputByHour, itemStyle: { color: CHART_COLORS.output } },
        { name: '缓存', type: 'bar', stack: 'token', data: cacheByHour, itemStyle: { color: CHART_COLORS.cacheRead } },
      ],
    }
  }, [dayRecords, isDark, axisLabelColor, axisLineColor, splitLineColor])

  // Model breakdown
  const modelBreakdown = useMemo(() => {
    const map = new Map<string, { count: number; input: number; output: number }>()
    for (const r of dayRecords) {
      const entry = map.get(r.model) ?? { count: 0, input: 0, output: 0 }
      entry.count++
      entry.input += r.inputTokens
      entry.output += r.outputTokens
      map.set(r.model, entry)
    }
    return Array.from(map.entries())
      .map(([model, v]) => ({ model, ...v, total: v.input + v.output }))
      .sort((a, b) => b.total - a.total)
  }, [dayRecords])

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
          radius: ['35%', '60%'],
          center: ['50%', '50%'],
          data: modelBreakdown.map((b, i) => ({
            name: b.model,
            value: b.count,
            itemStyle: { color: MODEL_COLORS[i % MODEL_COLORS.length] },
          })),
          label: { show: false },
        },
      ],
    }
  }, [modelBreakdown, isDark])

  // Project breakdown
  const projectBreakdown = useMemo(() => {
    const map = new Map<string, { input: number; output: number }>()
    for (const r of dayRecords) {
      const key = r.projectPath || '未知项目'
      const entry = map.get(key) ?? { input: 0, output: 0 }
      entry.input += r.inputTokens
      entry.output += r.outputTokens
      map.set(key, entry)
    }
    return Array.from(map.entries())
      .map(([path, v]) => ({
        path,
        name: path.split(/[/\\]/).pop() || path,
        total: v.input + v.output,
      }))
      .sort((a, b) => b.total - a.total)
  }, [dayRecords])

  // Sessions for this day
  const daySessions = useMemo(
    () =>
      sessionSummaries
        .filter((s) => !s.isSubagent && s.firstTimestamp.toISOString().slice(0, 10) === day)
        .sort((a, b) => b.firstTimestamp.getTime() - a.firstTimestamp.getTime()),
    [sessionSummaries, day],
  )

  // Active duration
  const activeDuration = useMemo(() => {
    if (dayRecords.length < 2) return 0
    const sorted = dayRecords.map((r) => r.timestamp.getTime()).sort((a, b) => a - b)
    return sorted[sorted.length - 1] - sorted[0]
  }, [dayRecords])

  const totalTokens = stats.input + stats.output

  if (dayRecords.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-[var(--muted-foreground)]">
        {day} 无活动数据
      </div>
    )
  }

  // Compare date state, default to previous day
  const defaultCompareDay = useMemo(() => {
    const d = new Date(day)
    d.setDate(d.getDate() - 1)
    return d.toISOString().slice(0, 10)
  }, [day])
  const [compareDay, setCompareDay] = useState(defaultCompareDay)

  return (
    <div className="space-y-5">
      {/* Compare picker */}
      <div className="flex items-center gap-2">
        <DatePicker value={compareDay} onChange={setCompareDay} max={new Date().toISOString().slice(0, 10)} activeDays={activeDays} />
        <button
          onClick={() => openDrilldown('day-compare', { day, compareDay })}
          disabled={compareDay === day}
          className="rounded-md bg-[var(--primary)] px-3 py-1.5 text-xs text-white transition-colors hover:opacity-90 disabled:opacity-40"
        >
          对比
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: '请求', value: fmtK(stats.requests), color: 'text-green-500' },
          { label: '输入', value: fmtK(stats.input), color: 'text-blue-500' },
          { label: '输出', value: fmtK(stats.output), color: 'text-purple-500' },
          { label: '缓存', value: fmtK(stats.cacheRead), color: 'text-cyan-500' },
        ].map((item) => (
          <div key={item.label} className="rounded-md border border-[var(--border)] p-2 text-center">
            <div className="text-[10px] text-[var(--muted-foreground)]">{item.label}</div>
            <div className={`font-mono text-sm font-semibold ${item.color}`}>{item.value}</div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 text-xs">
        <span className="text-[var(--muted-foreground)]">预估费用:</span>
        <span className="font-mono font-semibold text-emerald-500">${stats.cost.toFixed(4)}</span>
        <span className="text-[var(--muted-foreground)]">|</span>
        <span className="text-[var(--muted-foreground)]">Token 合计:</span>
        <span className="font-mono">{fmtK(totalTokens)}</span>
        <span className="text-[var(--muted-foreground)]">|</span>
        <span className="text-[var(--muted-foreground)]">活跃时长:</span>
        <span className="font-mono">{fmtDuration(activeDuration)}</span>
      </div>

      {/* Hourly distribution */}
      <div>
        <h3 className="mb-2 text-xs font-medium text-[var(--muted-foreground)]">小时分布</h3>
        <ReactECharts option={hourlyOption} style={{ height: 160 }} />
      </div>

      {/* Model breakdown */}
      {modelPieOption && (
        <div>
          <h3 className="mb-2 text-xs font-medium text-[var(--muted-foreground)]">模型分布</h3>
          <div className="flex items-start gap-4">
            <ReactECharts option={modelPieOption} style={{ height: 120, width: 120 }} />
            <div className="flex-1 space-y-1 pt-2">
              {modelBreakdown.map((b, i) => (
                <div
                  key={b.model}
                  className="flex cursor-pointer items-center gap-2 text-xs hover:text-[var(--foreground)]"
                  onClick={() => openDrilldown('model', { model: b.model })}
                >
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: MODEL_COLORS[i % MODEL_COLORS.length] }}
                  />
                  <span className="min-w-0 flex-1 truncate">{b.model}</span>
                  <span className="font-mono text-[var(--muted-foreground)]">{b.count}次</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Project breakdown */}
      {projectBreakdown.length > 0 && (
        <div>
          <h3 className="mb-2 text-xs font-medium text-[var(--muted-foreground)]">项目分布</h3>
          <div className="space-y-1">
            {projectBreakdown.map((p, i) => {
              const pct = totalTokens > 0 ? ((p.total / totalTokens) * 100).toFixed(0) : '0'
              return (
                <div
                  key={p.path}
                  className="flex cursor-pointer items-center gap-2 rounded-sm px-1 py-0.5 text-xs transition-colors hover:bg-[var(--accent)]"
                  onClick={() => p.path !== '未知项目' && openDrilldown('project', { projectPath: p.path })}
                >
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: PROJECT_COLORS[i % PROJECT_COLORS.length] }}
                  />
                  <span className="min-w-0 flex-1 truncate text-[var(--foreground)]">{p.name}</span>
                  <span className="font-mono text-[var(--muted-foreground)]">{fmtK(p.total)}</span>
                  <span className="w-8 text-right font-mono text-[var(--muted-foreground)]">{pct}%</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Sessions */}
      {daySessions.length > 0 && (
        <div>
          <h3 className="mb-2 text-xs font-medium text-[var(--muted-foreground)]">
            会话 ({daySessions.length})
          </h3>
          <div className="space-y-1">
            {daySessions.map((s) => {
              const time = s.firstTimestamp.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
              const dur = s.lastTimestamp.getTime() - s.firstTimestamp.getTime()
              const total = s.totalInput + s.totalOutput
              return (
                <div
                  key={s.id}
                  className="flex cursor-pointer items-center gap-2 rounded-md border border-[var(--border)] px-3 py-2 text-xs transition-colors hover:border-[var(--primary)]"
                  onClick={() => openDrilldown('session', { sessionId: s.sessionId })}
                >
                  <span className="font-mono text-[var(--muted-foreground)]">{time}</span>
                  <span className="min-w-0 flex-1 truncate text-[var(--foreground)]">
                    {s.firstUserMessage || s.sessionId.slice(0, 12)}
                  </span>
                  <span className="font-mono text-green-500">{s.requestCount}次</span>
                  <span className="font-mono">{fmtK(total)}</span>
                  <span className="text-[var(--muted-foreground)]">{fmtDuration(dur)}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
