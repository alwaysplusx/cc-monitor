// Usage pattern drilldown — hour x weekday heatmap, hourly density, daily active periods
import { useMemo } from 'react'
import ReactECharts from 'echarts-for-react'
import { useDataStore } from '../../stores/dataStore'
import { useTheme } from '../../hooks/useTheme'

const WEEKDAYS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
const HOURS = Array.from({ length: 24 }, (_, i) => `${i}`)

const MODEL_COLORS = ['#3b82f6', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444']

export default function UsagePatternDrilldown() {
  const records = useDataStore((s) => s.tokenRecords)
  const { isDark } = useTheme()

  // Hour x Weekday heatmap data
  const heatmapOption = useMemo(() => {
    // grid[dayOfWeek(0=Mon)][hour] = count
    const grid = Array.from({ length: 7 }, () => Array(24).fill(0) as number[])
    let maxCount = 0

    for (const r of records) {
      const d = r.timestamp
      const hour = d.getHours()
      // getDay: 0=Sun, convert to 0=Mon
      const dow = (d.getDay() + 6) % 7
      grid[dow][hour]++
      if (grid[dow][hour] > maxCount) maxCount = grid[dow][hour]
    }

    // ECharts heatmap data: [x(hour), y(weekday), value]
    const data: [number, number, number][] = []
    for (let dow = 0; dow < 7; dow++) {
      for (let h = 0; h < 24; h++) {
        data.push([h, dow, grid[dow][h]])
      }
    }

    return {
      tooltip: {
        formatter: (params: { value: [number, number, number] }) => {
          const [hour, dow, count] = params.value
          return `${WEEKDAYS[dow]} ${hour}:00 - ${hour + 1}:00<br/>请求数: ${count}`
        },
      },
      grid: { top: 8, right: 32, bottom: 24, left: 44 },
      xAxis: {
        type: 'category' as const,
        data: HOURS,
        splitArea: { show: true },
        axisLabel: { fontSize: 10 },
      },
      yAxis: {
        type: 'category' as const,
        data: WEEKDAYS,
        splitArea: { show: true },
        axisLabel: { fontSize: 10 },
      },
      visualMap: {
        min: 0,
        max: Math.max(maxCount, 1),
        calculable: false,
        orient: 'vertical' as const,
        right: 0,
        top: 8,
        bottom: 24,
        itemWidth: 10,
        itemHeight: 80,
        textStyle: { fontSize: 9 },
        inRange: {
          color: isDark
            ? ['#1a1a2e', '#16213e', '#0f3460', '#3b82f6', '#60a5fa', '#93c5fd']
            : ['#f0f4ff', '#dbeafe', '#bfdbfe', '#93c5fd', '#60a5fa', '#3b82f6'],
        },
      },
      series: [
        {
          type: 'heatmap',
          data,
          label: { show: false },
          emphasis: {
            itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0, 0, 0, 0.5)' },
          },
        },
      ],
    }
  }, [records, isDark])

  // Hourly request density (24 bars, stacked by model)
  const hourlyOption = useMemo(() => {
    const models = [...new Set(records.map((r) => r.model))]
    const modelHours = new Map<string, number[]>()
    for (const m of models) {
      modelHours.set(m, Array(24).fill(0) as number[])
    }

    for (const r of records) {
      const hour = r.timestamp.getHours()
      modelHours.get(r.model)![hour]++
    }

    return {
      tooltip: {
        trigger: 'axis' as const,
        axisPointer: { type: 'shadow' as const },
      },
      legend: {
        data: models,
        bottom: 0,
        type: 'scroll' as const,
        textStyle: { fontSize: 10 },
        pageIconSize: 10,
        pageTextStyle: { fontSize: 10 },
      },
      grid: { top: 12, right: 12, bottom: 36, left: 36 },
      xAxis: {
        type: 'category' as const,
        data: HOURS,
        axisLabel: { fontSize: 10 },
      },
      yAxis: {
        type: 'value' as const,
        axisLabel: { fontSize: 10 },
      },
      series: models.map((model, i) => ({
        name: model,
        type: 'bar',
        stack: 'total',
        data: modelHours.get(model)!,
        itemStyle: { color: MODEL_COLORS[i % MODEL_COLORS.length] },
      })),
    }
  }, [records])

  // Daily active periods (Gantt-style): last 7 days
  const ganttOption = useMemo(() => {
    const now = new Date()
    const days: string[] = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(d.getDate() - i)
      days.push(d.toISOString().slice(0, 10))
    }

    const dayMap = new Map<string, { start: number; end: number }>()
    for (const r of records) {
      const day = r.timestamp.toISOString().slice(0, 10)
      if (!days.includes(day)) continue
      const hourFrac = r.timestamp.getHours() + r.timestamp.getMinutes() / 60
      const entry = dayMap.get(day)
      if (!entry) {
        dayMap.set(day, { start: hourFrac, end: hourFrac })
      } else {
        entry.start = Math.min(entry.start, hourFrac)
        entry.end = Math.max(entry.end, hourFrac)
      }
    }

    const fmtH = (h: number) => {
      const hh = Math.floor(h)
      const mm = Math.round((h - hh) * 60)
      return `${hh.toString().padStart(2, '0')}:${mm.toString().padStart(2, '0')}`
    }

    // renderItem for custom series
    const renderItem = (
      params: { coordSys: { x: number; y: number; width: number; height: number } },
      api: {
        value: (idx: number) => number
        coord: (val: [number, number]) => [number, number]
        size: (val: [number, number]) => [number, number]
      },
    ) => {
      const yIdx = api.value(0)
      const start = api.value(1)
      const end = api.value(2)
      const startCoord = api.coord([start, yIdx])
      const endCoord = api.coord([end, yIdx])
      const barHeight = api.size([0, 1])[1] * 0.5
      return {
        type: 'rect' as const,
        shape: {
          x: startCoord[0],
          y: startCoord[1] - barHeight / 2,
          width: Math.max(endCoord[0] - startCoord[0], 4),
          height: barHeight,
          r: 3,
        },
        style: {
          fill: '#3b82f6',
          opacity: 0.7,
        },
      }
    }

    const data = days.map((day, i) => {
      const entry = dayMap.get(day)
      return [i, entry?.start ?? 0, entry?.end ?? 0, day]
    })

    return {
      tooltip: {
        formatter: (params: { value: [number, number, number, string] }) => {
          const [, start, end, day] = params.value
          if (start === 0 && end === 0) return `${day.slice(5)}: 无活动`
          const duration = end - start
          return `${day.slice(5)}<br/>${fmtH(start)} - ${fmtH(end)}<br/>持续 ${duration.toFixed(1)}h`
        },
      },
      grid: { top: 8, right: 12, bottom: 24, left: 56 },
      xAxis: {
        type: 'value' as const,
        min: 0,
        max: 24,
        interval: 4,
        axisLabel: { fontSize: 10, formatter: (v: number) => `${v}:00` },
      },
      yAxis: {
        type: 'category' as const,
        data: days.map((d) => d.slice(5)),
        axisLabel: { fontSize: 10 },
        inverse: true,
      },
      series: [
        {
          type: 'custom',
          renderItem,
          encode: { x: [1, 2], y: 0 },
          data,
        },
      ],
    }
  }, [records])

  return (
    <div className="space-y-5">
      {/* Hour x Weekday heatmap */}
      <div>
        <h3 className="mb-2 text-xs font-medium text-[var(--muted-foreground)]">
          小时 x 星期 热力图
        </h3>
        <ReactECharts option={heatmapOption} style={{ height: 220 }} />
      </div>

      {/* Hourly request density */}
      <div>
        <h3 className="mb-2 text-xs font-medium text-[var(--muted-foreground)]">
          每小时请求密度
        </h3>
        <ReactECharts option={hourlyOption} style={{ height: 220 }} />
      </div>

      {/* Daily active periods */}
      <div>
        <h3 className="mb-2 text-xs font-medium text-[var(--muted-foreground)]">
          每日活跃时段（近7天）
        </h3>
        <ReactECharts option={ganttOption} style={{ height: 200 }} />
      </div>
    </div>
  )
}
