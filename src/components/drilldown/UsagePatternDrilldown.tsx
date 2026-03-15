// Usage pattern drilldown — hour x weekday heatmap, hourly density, daily active periods
import { useMemo, useRef, useCallback, useState } from 'react'
import ReactECharts from 'echarts-for-react'
import { useDataStore } from '../../stores/dataStore'
import { useTheme } from '../../hooks/useTheme'

const WEEKDAYS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
const HOURS = Array.from({ length: 24 }, (_, i) => `${i}`)

const MODEL_COLORS = ['#3b82f6', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444']

/** Horizontally draggable legend strip with click-to-toggle */
function DragScrollLegend({
  models,
  hidden,
  onToggle,
}: {
  models: string[]
  hidden: Set<string>
  onToggle: (model: string) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)
  const moved = useRef(false)
  const startX = useRef(0)
  const scrollLeft = useRef(0)

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    dragging.current = true
    moved.current = false
    startX.current = e.clientX
    scrollLeft.current = ref.current?.scrollLeft ?? 0
    ref.current!.style.cursor = 'grabbing'
  }, [])

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging.current) return
    e.preventDefault()
    const dx = e.clientX - startX.current
    if (Math.abs(dx) > 3) moved.current = true
    ref.current!.scrollLeft = scrollLeft.current - dx
  }, [])

  const onMouseUp = useCallback(() => {
    dragging.current = false
    if (ref.current) ref.current.style.cursor = 'grab'
  }, [])

  const handleClick = useCallback(
    (model: string) => {
      // Only toggle if not dragged
      if (!moved.current) onToggle(model)
    },
    [onToggle],
  )

  const scrollBy = useCallback((dx: number) => {
    ref.current?.scrollBy({ left: dx, behavior: 'smooth' })
  }, [])

  return (
    <div className="mb-1 flex items-center gap-1">
      <button
        onClick={() => scrollBy(-100)}
        className="shrink-0 rounded p-0.5 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M15.41 16.59L10.83 12l4.58-4.59L14 6l-6 6 6 6z"/></svg>
      </button>
      <div
        ref={ref}
        className="min-w-0 flex-1 cursor-grab select-none overflow-x-auto"
        style={{ scrollbarWidth: 'none' }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
      >
        <div className="flex w-max items-center gap-3 px-1 py-1">
          {models.map((model, i) => {
            const isHidden = hidden.has(model)
            return (
              <div
                key={model}
                className="flex shrink-0 cursor-pointer items-center gap-1 text-[10px] transition-opacity"
                style={{ opacity: isHidden ? 0.35 : 1 }}
                onClick={() => handleClick(model)}
              >
                <span
                  className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm"
                  style={{
                    backgroundColor: isHidden
                      ? 'var(--muted-foreground)'
                      : MODEL_COLORS[i % MODEL_COLORS.length],
                  }}
                />
                <span
                  className="whitespace-nowrap"
                  style={{ textDecoration: isHidden ? 'line-through' : 'none' }}
                >
                  {model}
                </span>
              </div>
            )
          })}
        </div>
      </div>
      <button
        onClick={() => scrollBy(100)}
        className="shrink-0 rounded p-0.5 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6z"/></svg>
      </button>
    </div>
  )
}

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
  const hourlyModels = useMemo(() => [...new Set(records.map((r) => r.model))], [records])
  const [hiddenModels, setHiddenModels] = useState<Set<string>>(new Set())
  const toggleModel = useCallback((model: string) => {
    setHiddenModels((prev) => {
      const next = new Set(prev)
      if (next.has(model)) next.delete(model)
      else next.add(model)
      return next
    })
  }, [])

  const hourlyOption = useMemo(() => {
    const modelHours = new Map<string, number[]>()
    for (const m of hourlyModels) {
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
      legend: { show: false },
      grid: { top: 12, right: 12, bottom: 24, left: 36 },
      xAxis: {
        type: 'category' as const,
        data: HOURS,
        axisLabel: { fontSize: 10 },
      },
      yAxis: {
        type: 'value' as const,
        axisLabel: { fontSize: 10 },
      },
      series: hourlyModels.map((model, i) => ({
        name: model,
        type: 'bar',
        stack: 'total',
        data: hiddenModels.has(model)
          ? modelHours.get(model)!.map(() => 0)
          : modelHours.get(model)!,
        itemStyle: { color: MODEL_COLORS[i % MODEL_COLORS.length] },
      })),
    }
  }, [records, hourlyModels, hiddenModels])

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
        {/* Draggable scrolling legend */}
        <DragScrollLegend models={hourlyModels} hidden={hiddenModels} onToggle={toggleModel} />
        <ReactECharts option={hourlyOption} style={{ height: 200 }} />
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
