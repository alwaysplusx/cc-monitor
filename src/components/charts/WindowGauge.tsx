// 5-hour window usage gauge with plan selector
import { useMemo, useEffect } from 'react'
import ReactECharts from 'echarts-for-react'
import type { EChartsOption } from 'echarts'
import { useDataStore } from '../../stores/dataStore'
import { useSettingsStore } from '../../stores/settingsStore'
import { useTheme } from '../../hooks/useTheme'
import { fmtK } from '../../lib/format'
import { PLAN_LIMITS, WINDOW_DURATION_MS } from '../../lib/constants'
import { electronApi } from '../../lib/ipc'

function getGaugeColor(pct: number): string {
  if (pct >= 95) return '#ef4444'
  if (pct >= 80) return '#f97316'
  if (pct >= 50) return '#eab308'
  return '#10b981'
}

export default function WindowGauge() {
  const records = useDataStore((s) => s.tokenRecords)
  const setWindowUsage = useDataStore((s) => s.setWindowUsage)
  const planType = useSettingsStore((s) => s.planType)
  const customTokenLimit = useSettingsStore((s) => s.customTokenLimit)
  const windowStartTime = useSettingsStore((s) => s.windowStartTime)
  const setPlanType = useSettingsStore((s) => s.setPlanType)
  const setCustomTokenLimit = useSettingsStore((s) => s.setCustomTokenLimit)
  const setWindowStartTime = useSettingsStore((s) => s.setWindowStartTime)
  const { isDark } = useTheme()

  const limit = planType === 'custom' ? customTokenLimit : (PLAN_LIMITS[planType] ?? 220000)

  const usage = useMemo(() => {
    if (!windowStartTime) return null
    const start = new Date(windowStartTime)
    const end = new Date(start.getTime() + WINDOW_DURATION_MS)
    const now = new Date()
    const isExpired = now > end

    const inWindow = records.filter(
      (r) => r.timestamp >= start && r.timestamp <= end,
    )
    const used = inWindow.reduce((s, r) => s + r.inputTokens + r.outputTokens, 0)
    const percentage = limit > 0 ? (used / limit) * 100 : 0

    return { used, limit, percentage: Math.min(percentage, 100), isExpired }
  }, [records, windowStartTime, limit])

  useEffect(() => {
    setWindowUsage(usage)
  }, [usage, setWindowUsage])

  const remaining = usage ? Math.max(0, 100 - usage.percentage) : 100

  const option: EChartsOption = useMemo(() => {
    const pct = usage?.percentage ?? 0
    const color = getGaugeColor(pct)

    return {
      series: [
        {
          type: 'gauge',
          startAngle: 225,
          endAngle: -45,
          radius: '90%',
          min: 0,
          max: 100,
          pointer: { show: false },
          axisLine: {
            lineStyle: {
              width: 14,
              color: [
                [pct / 100, color],
                [1, isDark ? '#1e293b' : '#e2e8f0'],
              ],
            },
          },
          axisTick: { show: false },
          splitLine: { show: false },
          axisLabel: { show: false },
          detail: {
            offsetCenter: [0, '-5%'],
            formatter: () =>
              usage?.isExpired
                ? '已过期'
                : `${remaining.toFixed(0)}%`,
            fontSize: 22,
            fontWeight: 'bold',
            fontFamily: 'JetBrains Mono, monospace',
            color: usage?.isExpired
              ? (isDark ? '#4a5568' : '#94a3b8')
              : color,
          },
          title: {
            offsetCenter: [0, '20%'],
            fontSize: 11,
            color: isDark ? '#8892a8' : '#64748b',
          },
          data: [{ value: pct, name: usage?.isExpired ? '窗口已过期' : '剩余' }],
        },
      ],
    }
  }, [usage, remaining, isDark])

  const handlePlanChange = (newPlan: string) => {
    setPlanType(newPlan as typeof planType)
    electronApi.saveSettings({ planType: newPlan as typeof planType }).catch(console.error)
  }

  return (
    <div className="flex h-full flex-col">
      <h3 className="mb-2 text-xs font-semibold text-[var(--foreground)]">5小时窗口用量</h3>

      {/* Gauge chart */}
      <ReactECharts option={option} style={{ height: 120 }} notMerge={false} />

      {/* Usage summary */}
      {usage && (
        <div className="mb-2 text-center text-xs text-[var(--muted-foreground)]">
          <span className="font-mono">{fmtK(usage.used)}</span>
          {' / '}
          <span className="font-mono">{fmtK(usage.limit)}</span>
        </div>
      )}

      {/* Controls */}
      <div className="space-y-2">
        {/* Window start time */}
        <div className="flex items-center gap-2">
          <label className="text-xs text-[var(--muted-foreground)] whitespace-nowrap">起始:</label>
          <input
            type="datetime-local"
            className="h-7 flex-1 rounded border border-[var(--border)] bg-[var(--background)] px-2 text-xs text-[var(--foreground)]"
            value={windowStartTime ?? ''}
            onChange={(e) => setWindowStartTime(e.target.value || null)}
          />
        </div>

        {/* Plan selector */}
        <div className="flex items-center gap-2">
          <label className="text-xs text-[var(--muted-foreground)] whitespace-nowrap">套餐:</label>
          <select
            className="h-7 flex-1 rounded border border-[var(--border)] bg-[var(--background)] px-2 text-xs text-[var(--foreground)]"
            value={planType}
            onChange={(e) => handlePlanChange(e.target.value)}
          >
            <option value="pro">Pro (44K)</option>
            <option value="max5">Max5 (88K)</option>
            <option value="max20">Max20 (220K)</option>
            <option value="custom">自定义</option>
          </select>
          {planType === 'custom' && (
            <input
              type="number"
              className="h-7 w-20 rounded border border-[var(--border)] bg-[var(--background)] px-2 text-xs text-[var(--foreground)]"
              value={customTokenLimit}
              onChange={(e) => setCustomTokenLimit(Number(e.target.value))}
              placeholder="上限"
            />
          )}
        </div>
      </div>
    </div>
  )
}
