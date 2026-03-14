// Minute-level token consumption timeline (ECharts stacked area chart)
import { useMemo, useCallback, useRef } from 'react'
import ReactECharts from 'echarts-for-react'
import type { EChartsOption } from 'echarts'
import { useDataStore } from '../../stores/dataStore'
import { useTheme } from '../../hooks/useTheme'
import { echartsLightTheme, echartsDarkTheme } from '../../lib/theme'
import { fmtK } from '../../lib/format'
import { CHART_COLORS, type TimeView } from '../../lib/constants'

export default function MinuteTimeline() {
  const minuteBuckets = useDataStore((s) => s.minuteBuckets)
  const dayBuckets = useDataStore((s) => s.dayBuckets)
  const monthBuckets = useDataStore((s) => s.monthBuckets)
  const modelSwitches = useDataStore((s) => s.modelSwitches)
  const timeView = useDataStore((s) => s.timeView)
  const setTimeView = useDataStore((s) => s.setTimeView)
  const setHighlightedTimeRange = useDataStore((s) => s.setHighlightedTimeRange)
  const { isDark } = useTheme()
  const chartRef = useRef<ReactECharts>(null)

  const tabs: { key: TimeView; label: string }[] = [
    { key: 'hour', label: '小时' },
    { key: 'day', label: '天' },
    { key: 'month', label: '月' },
  ]

  const { xData, inputData, outputData, cacheData, defaultStartPct } = useMemo(() => {
    const p2 = (n: number) => n.toString().padStart(2, '0')
    const fmtSlotKey = (d: Date) =>
      `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}T${p2(d.getHours())}:${p2(d.getMinutes())}`
    const fmtDayKey = (d: Date) =>
      `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`
    const fmtMonthKey = (d: Date) =>
      `${d.getFullYear()}-${p2(d.getMonth() + 1)}`

    if (timeView === 'hour') {
      // All data as 30-min slots, gap-filled from earliest to now
      const now = new Date()
      const slotMap = new Map<string, { input: number; output: number; cache: number }>()
      for (const b of minuteBuckets) {
        const min = parseInt(b.minute.slice(14, 16), 10)
        const slot = min < 30 ? '00' : '30'
        const key = b.minute.slice(0, 14) + slot
        const existing = slotMap.get(key) ?? { input: 0, output: 0, cache: 0 }
        existing.input += b.input
        existing.output += b.output
        existing.cache += b.cacheRead
        slotMap.set(key, existing)
      }

      if (slotMap.size === 0) {
        return { xData: [] as string[], inputData: [] as number[], outputData: [] as number[], cacheData: [] as number[], defaultStartPct: 0 }
      }

      // Fill from earliest slot to now
      const earliest = Array.from(slotMap.keys()).sort()[0]
      const cursor = new Date(earliest.slice(0, 10) + 'T' + earliest.slice(11, 16) + ':00')
      const slots: Array<{ key: string; input: number; output: number; cache: number }> = []
      while (cursor <= now) {
        const key = fmtSlotKey(cursor)
        const data = slotMap.get(key) ?? { input: 0, output: 0, cache: 0 }
        slots.push({ key, ...data })
        cursor.setMinutes(cursor.getMinutes() + 30)
      }

      // Default view: last 6 hours (12 slots)
      const defaultSlots = 12
      const startPct = slots.length > defaultSlots
        ? Math.max(0, ((slots.length - defaultSlots) / slots.length) * 100)
        : 0

      return {
        xData: slots.map((s) => s.key),
        inputData: slots.map((s) => s.input),
        outputData: slots.map((s) => s.output),
        cacheData: slots.map((s) => s.cache),
        defaultStartPct: startPct,
      }
    } else if (timeView === 'day') {
      // All days from earliest to today, gap-filled
      const now = new Date()
      const dayMap = new Map<string, { input: number; output: number; cache: number }>()
      for (const b of dayBuckets) {
        dayMap.set(b.day, { input: b.input, output: b.output, cache: b.cacheRead })
      }

      if (dayMap.size === 0) {
        return { xData: [] as string[], inputData: [] as number[], outputData: [] as number[], cacheData: [] as number[], defaultStartPct: 0 }
      }

      const earliest = Array.from(dayMap.keys()).sort()[0]
      const cursor = new Date(earliest + 'T00:00:00')
      const today = new Date(now)
      today.setHours(0, 0, 0, 0)
      const days: Array<{ key: string; input: number; output: number; cache: number }> = []
      while (cursor <= today) {
        const key = fmtDayKey(cursor)
        const data = dayMap.get(key) ?? { input: 0, output: 0, cache: 0 }
        days.push({ key, ...data })
        cursor.setDate(cursor.getDate() + 1)
      }

      // Default view: last 14 days
      const defaultDays = 14
      const startPct = days.length > defaultDays
        ? Math.max(0, ((days.length - defaultDays) / days.length) * 100)
        : 0

      return {
        xData: days.map((d) => d.key),
        inputData: days.map((d) => d.input),
        outputData: days.map((d) => d.output),
        cacheData: days.map((d) => d.cache),
        defaultStartPct: startPct,
      }
    } else {
      // All months from earliest to current, gap-filled
      const now = new Date()
      const monthMap = new Map<string, { input: number; output: number; cache: number }>()
      for (const b of monthBuckets) {
        monthMap.set(b.month, { input: b.input, output: b.output, cache: b.cacheRead })
      }

      if (monthMap.size === 0) {
        return { xData: [] as string[], inputData: [] as number[], outputData: [] as number[], cacheData: [] as number[], defaultStartPct: 0 }
      }

      const earliest = Array.from(monthMap.keys()).sort()[0]
      const cursor = new Date(parseInt(earliest.slice(0, 4)), parseInt(earliest.slice(5, 7)) - 1, 1)
      const months: Array<{ key: string; input: number; output: number; cache: number }> = []
      while (cursor.getFullYear() < now.getFullYear() || (cursor.getFullYear() === now.getFullYear() && cursor.getMonth() <= now.getMonth())) {
        const key = fmtMonthKey(cursor)
        const data = monthMap.get(key) ?? { input: 0, output: 0, cache: 0 }
        months.push({ key, ...data })
        cursor.setMonth(cursor.getMonth() + 1)
      }

      // Default view: last 12 months
      const defaultMonths = 12
      const startPct = months.length > defaultMonths
        ? Math.max(0, ((months.length - defaultMonths) / months.length) * 100)
        : 0

      return {
        xData: months.map((m) => m.key),
        inputData: months.map((m) => m.input),
        outputData: months.map((m) => m.output),
        cacheData: months.map((m) => m.cache),
        defaultStartPct: startPct,
      }
    }
  }, [timeView, minuteBuckets, dayBuckets, monthBuckets])

  const markLines = useMemo(() => {
    return modelSwitches.map((sw) => ({
      xAxis: sw.timestamp.toISOString().slice(0, 16),
      label: {
        formatter: `${sw.toModel}`,
        fontSize: 10,
      },
    }))
  }, [modelSwitches])

  const option: EChartsOption = useMemo(() => {
    const themeObj = isDark ? echartsDarkTheme : echartsLightTheme

    return {
      ...themeObj,
      grid: { left: 50, right: 55, top: 30, bottom: 60 },
      tooltip: {
        trigger: 'axis',
        ...themeObj.tooltip,
        formatter: (params: unknown) => {
          const items = params as Array<{ seriesName: string; value: number; axisValue: string }>
          if (!items.length) return ''
          const time = items[0].axisValue.replace('T', ' ')
          let html = `<div style="font-size:12px"><b>${time}</b><br/>`
          for (const item of items) {
            html += `${item.seriesName}: ${fmtK(item.value)}<br/>`
          }
          html += '</div>'
          return html
        },
      },
      legend: {
        ...themeObj.legend,
        show: true,
        top: 0,
        right: 0,
        itemWidth: 12,
        itemHeight: 12,
        textStyle: { ...((themeObj.legend as Record<string, unknown>)?.textStyle as Record<string, unknown>), fontSize: 11 },
      },
      xAxis: {
        type: 'category',
        data: xData,
        ...themeObj.categoryAxis,
        axisLabel: {
          ...themeObj.categoryAxis?.axisLabel,
          fontSize: 10,
          rotate: 0,
          formatter: (v: string) => {
            if (timeView === 'hour') {
              // 30-min slots: "HH:mm"
              return v.length >= 16 ? v.slice(11, 16) : v
            }
            if (timeView === 'day') {
              // dayBucket key is "YYYY-MM-DD", show "MM/DD"
              return v.length >= 10 ? v.slice(5, 10) : v
            }
            // month view: key is "YYYY-MM"
            return v
          },
          interval: (_index: number) => {
            if (timeView === 'hour' || timeView === 'day') {
              return true
            }
            // month view: thin out labels
            return _index % Math.max(1, Math.ceil(xData.length / 15)) === 0
          },
        },
      },
      yAxis: [
        {
          type: 'value',
          ...themeObj.valueAxis,
          axisLabel: {
            ...themeObj.valueAxis?.axisLabel,
            formatter: (v: number) => fmtK(v),
          },
        },
        {
          type: 'value',
          ...themeObj.valueAxis,
          splitLine: { show: false },
          axisLabel: {
            ...themeObj.valueAxis?.axisLabel,
            formatter: (v: number) => fmtK(v),
          },
        },
      ],
      dataZoom: [
        {
          type: 'slider',
          bottom: 5,
          height: 20,
          start: defaultStartPct,
          end: 100,
        },
      ],
      series: [
        {
          name: '输入',
          type: 'bar',
          stack: 'tokens',
          yAxisIndex: 0,
          itemStyle: { color: CHART_COLORS.input },
          data: inputData,
          barMaxWidth: 20,
          markLine: markLines.length > 0
            ? {
                data: markLines,
                lineStyle: { type: 'dashed', color: '#f59e0b' },
                symbol: 'none',
              }
            : undefined,
        },
        {
          name: '输出',
          type: 'bar',
          stack: 'tokens',
          yAxisIndex: 0,
          itemStyle: { color: CHART_COLORS.output },
          data: outputData,
          barMaxWidth: 20,
        },
        {
          name: '缓存读取',
          type: 'bar',
          yAxisIndex: 1,
          itemStyle: { color: CHART_COLORS.cacheRead, opacity: 0.25 },
          barGap: '-100%',
          data: cacheData,
          z: 0,
          barMaxWidth: 20,
        },
      ],
    }
  }, [xData, inputData, outputData, cacheData, markLines, isDark, defaultStartPct, timeView])

  const onChartClick = useCallback(
    (params: { dataIndex?: number }) => {
      if (params.dataIndex !== undefined && xData[params.dataIndex]) {
        const clicked = xData[params.dataIndex]
        setHighlightedTimeRange({ start: clicked, end: clicked })
      }
    },
    [xData, setHighlightedTimeRange],
  )

  const hasData = xData.length > 0

  return (
    <div className="flex h-full flex-col">
      {/* Time view tabs */}
      <div className="mb-2 flex gap-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setTimeView(tab.key)}
            className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
              timeView === tab.key
                ? 'bg-[var(--primary)] text-white'
                : 'text-[var(--muted-foreground)] hover:bg-[var(--accent)]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Chart */}
      {hasData ? (
        <ReactECharts
          ref={chartRef}
          option={option}
          style={{ flex: 1, minHeight: 250 }}
          notMerge={false}
          onEvents={{ click: onChartClick }}
        />
      ) : (
        <div className="flex flex-1 items-center justify-center text-sm text-[var(--muted-foreground)]">
          暂无数据
        </div>
      )}
    </div>
  )
}
