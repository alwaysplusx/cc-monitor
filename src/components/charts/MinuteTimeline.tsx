// Minute-level token consumption timeline (ECharts stacked area chart)
import { useMemo, useCallback, useRef } from 'react'
import ReactECharts from 'echarts-for-react'
import type { EChartsOption } from 'echarts'
import { useDataStore } from '../../stores/dataStore'
import { useTheme } from '../../hooks/useTheme'
import { echartsLightTheme, echartsDarkTheme } from '../../lib/theme'
import { fmtK } from '../../lib/format'
import { CHART_COLORS, type TimeView } from '../../lib/constants'

const MODEL_COLORS = ['#3b82f6', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444']

export default function MinuteTimeline() {
  const minuteBuckets = useDataStore((s) => s.minuteBuckets)
  const dayBuckets = useDataStore((s) => s.dayBuckets)
  const monthBuckets = useDataStore((s) => s.monthBuckets)
  const tokenRecords = useDataStore((s) => s.tokenRecords)
  const modelSwitches = useDataStore((s) => s.modelSwitches)
  const timeView = useDataStore((s) => s.timeView)
  const setTimeView = useDataStore((s) => s.setTimeView)
  const setHighlightedTimeRange = useDataStore((s) => s.setHighlightedTimeRange)
  const { isDark } = useTheme()
  const chartRef = useRef<ReactECharts>(null)

  const tabs: { key: TimeView; label: string }[] = [
    { key: 'minute', label: '分钟' },
    { key: 'hour', label: '小时' },
    { key: 'day', label: '天' },
    { key: 'month', label: '月' },
  ]

  const { xData, inputData, outputData, cacheData, defaultStartPct, modelBreakdownMap } = useMemo(() => {
    const p2 = (n: number) => n.toString().padStart(2, '0')
    const fmtSlotKey = (d: Date) =>
      `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}T${p2(d.getHours())}:${p2(d.getMinutes())}`
    const fmtDayKey = (d: Date) =>
      `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`
    const fmtMonthKey = (d: Date) =>
      `${d.getFullYear()}-${p2(d.getMonth() + 1)}`

    // Build model breakdown map from tokenRecords
    type ModelEntry = { model: string; input: number; output: number }
    const mbMap = new Map<string, Map<string, ModelEntry>>()
    const addToMb = (key: string, model: string, input: number, output: number) => {
      let models = mbMap.get(key)
      if (!models) { models = new Map(); mbMap.set(key, models) }
      const entry = models.get(model) ?? { model, input: 0, output: 0 }
      entry.input += input
      entry.output += output
      models.set(model, entry)
    }
    for (const r of tokenRecords) {
      const d = r.timestamp
      // Add to all granularities
      addToMb(fmtSlotKey(d), r.model, r.inputTokens, r.outputTokens)
      const slotMin = d.getMinutes() < 30 ? '00' : '30'
      const halfHourKey = `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}T${p2(d.getHours())}:${slotMin}`
      addToMb(halfHourKey, r.model, r.inputTokens, r.outputTokens)
      addToMb(fmtDayKey(d), r.model, r.inputTokens, r.outputTokens)
      addToMb(fmtMonthKey(d), r.model, r.inputTokens, r.outputTokens)
    }

    if (timeView === 'minute') {
      // Per-minute view, range = 4h (4x default 1h), slider = 25%
      const now = new Date()
      const minMap = new Map<string, { input: number; output: number; cache: number }>()
      for (const b of minuteBuckets) {
        minMap.set(b.minute, { input: b.input, output: b.output, cache: b.cacheRead })
      }

      if (minMap.size === 0) {
        return { xData: [] as string[], inputData: [] as number[], outputData: [] as number[], cacheData: [] as number[], defaultStartPct: 0 }
      }

      const cursor = new Date(now)
      cursor.setMinutes(cursor.getMinutes() - 4 * 60)
      cursor.setSeconds(0, 0)

      const slots: Array<{ key: string; input: number; output: number; cache: number }> = []
      while (cursor <= now) {
        const key = fmtSlotKey(cursor)
        const data = minMap.get(key) ?? { input: 0, output: 0, cache: 0 }
        slots.push({ key, ...data })
        cursor.setMinutes(cursor.getMinutes() + 1)
      }

      return {
        xData: slots.map((s) => s.key),
        inputData: slots.map((s) => s.input),
        outputData: slots.map((s) => s.output),
        cacheData: slots.map((s) => s.cache),
        defaultStartPct: 75,
        modelBreakdownMap: mbMap,
      }
    }

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

      // Total range = 24h (4x default 6h), slider = 25%
      const defaultSlots = 12
      const cursor = new Date(now)
      cursor.setMinutes(cursor.getMinutes() - defaultSlots * 4 * 30)
      // Align to 30-min boundary
      cursor.setMinutes(cursor.getMinutes() < 30 ? 0 : 30, 0, 0)

      const slots: Array<{ key: string; input: number; output: number; cache: number }> = []
      while (cursor <= now) {
        const key = fmtSlotKey(cursor)
        const data = slotMap.get(key) ?? { input: 0, output: 0, cache: 0 }
        slots.push({ key, ...data })
        cursor.setMinutes(cursor.getMinutes() + 30)
      }

      const startPct = 75

      return {
        xData: slots.map((s) => s.key),
        inputData: slots.map((s) => s.input),
        outputData: slots.map((s) => s.output),
        cacheData: slots.map((s) => s.cache),
        defaultStartPct: startPct,
        modelBreakdownMap: mbMap,
      }
    } else if (timeView === 'day') {
      // All days from earliest to today, gap-filled, minimum 14 days
      const now = new Date()
      const dayMap = new Map<string, { input: number; output: number; cache: number }>()
      for (const b of dayBuckets) {
        dayMap.set(b.day, { input: b.input, output: b.output, cache: b.cacheRead })
      }

      if (dayMap.size === 0) {
        return { xData: [] as string[], inputData: [] as number[], outputData: [] as number[], cacheData: [] as number[], defaultStartPct: 0 }
      }

      // Total range = 56d (4x default 14d), slider = 25%
      const today = new Date(now)
      today.setHours(0, 0, 0, 0)
      const defaultDays = 14
      const cursor = new Date(today)
      cursor.setDate(cursor.getDate() - defaultDays * 4 + 1)

      const days: Array<{ key: string; input: number; output: number; cache: number }> = []
      while (cursor <= today) {
        const key = fmtDayKey(cursor)
        const data = dayMap.get(key) ?? { input: 0, output: 0, cache: 0 }
        days.push({ key, ...data })
        cursor.setDate(cursor.getDate() + 1)
      }

      const startPct = 75

      return {
        xData: days.map((d) => d.key),
        inputData: days.map((d) => d.input),
        outputData: days.map((d) => d.output),
        cacheData: days.map((d) => d.cache),
        defaultStartPct: startPct,
        modelBreakdownMap: mbMap,
      }
    } else {
      // All months from earliest to current, gap-filled, minimum 12 months
      const now = new Date()
      const monthMap = new Map<string, { input: number; output: number; cache: number }>()
      for (const b of monthBuckets) {
        monthMap.set(b.month, { input: b.input, output: b.output, cache: b.cacheRead })
      }

      if (monthMap.size === 0) {
        return { xData: [] as string[], inputData: [] as number[], outputData: [] as number[], cacheData: [] as number[], defaultStartPct: 0 }
      }

      // Total range = 48m (4x default 12m), slider = 25%
      const defaultMonths = 12
      const cursor = new Date(now.getFullYear(), now.getMonth() - defaultMonths * 4 + 1, 1)

      const months: Array<{ key: string; input: number; output: number; cache: number }> = []
      while (cursor.getFullYear() < now.getFullYear() || (cursor.getFullYear() === now.getFullYear() && cursor.getMonth() <= now.getMonth())) {
        const key = fmtMonthKey(cursor)
        const data = monthMap.get(key) ?? { input: 0, output: 0, cache: 0 }
        months.push({ key, ...data })
        cursor.setMonth(cursor.getMonth() + 1)
      }

      const startPct = 75

      return {
        xData: months.map((m) => m.key),
        inputData: months.map((m) => m.input),
        outputData: months.map((m) => m.output),
        cacheData: months.map((m) => m.cache),
        defaultStartPct: startPct,
        modelBreakdownMap: mbMap,
      }
    }
  }, [timeView, minuteBuckets, dayBuckets, monthBuckets, tokenRecords])

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
          const axisKey = items[0].axisValue
          const time = axisKey.replace('T', ' ')
          let html = `<div style="font-size:12px"><b>${time}</b><br/>`
          for (const item of items) {
            html += `${item.seriesName}: ${fmtK(item.value)}<br/>`
          }
          // Model breakdown
          const models = modelBreakdownMap.get(axisKey)
          if (models && models.size > 0) {
            const sorted = Array.from(models.values()).sort((a, b) => (b.input + b.output) - (a.input + a.output))
            const total = sorted.reduce((s, m) => s + m.input + m.output, 0)
            html += `<br/><b>模型分布</b><br/>`
            sorted.forEach((m, i) => {
              const pct = total > 0 ? ((m.input + m.output) / total * 100).toFixed(0) : '0'
              const color = MODEL_COLORS[i % MODEL_COLORS.length]
              html += `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${color};margin-right:4px"></span>`
              html += `${m.model} <span style="float:right;margin-left:12px">${pct}%  ${fmtK(m.input)}/${fmtK(m.output)}</span><br/>`
            })
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
            if (timeView === 'minute' || timeView === 'hour') {
              // "YYYY-MM-DDTHH:mm" → "HH:mm"
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
            if (timeView === 'minute') {
              // Per-minute: show label every 10 minutes
              const step = 10
              return _index % step === 0 || _index === xData.length - 1
            }
            if (timeView === 'hour' || timeView === 'day') {
              return true
            }
            // month view: thin out labels, always show last (current month)
            const step = Math.max(1, Math.ceil(xData.length / 15))
            return _index % step === 0 || _index === xData.length - 1
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
          zoomLock: true,
          borderColor: isDark ? '#1e293b' : '#d1d5db',
          backgroundColor: isDark ? '#0f1420' : '#f9fafb',
          fillerColor: isDark ? 'rgba(59,130,246,0.15)' : 'rgba(59,130,246,0.1)',
          handleStyle: {
            color: isDark ? '#1e293b' : '#e5e7eb',
            borderColor: isDark ? '#334155' : '#9ca3af',
          },
          dataBackground: {
            lineStyle: { color: isDark ? '#1e293b' : '#d1d5db' },
            areaStyle: { color: isDark ? '#151d2e' : '#f1f5f9' },
          },
          selectedDataBackground: {
            lineStyle: { color: isDark ? '#334155' : '#93c5fd' },
            areaStyle: { color: isDark ? '#1e293b' : '#dbeafe' },
          },
          textStyle: {
            color: isDark ? '#8892a8' : '#64748b',
            fontSize: 10,
          },
          labelFormatter: (_: number, value: string) => {
            if (timeView === 'minute' || timeView === 'hour') {
              // "YYYY-MM-DDTHH:mm" → "MM-DD HH:mm"
              return value.length >= 16 ? `${value.slice(5, 10)} ${value.slice(11, 16)}` : value
            }
            if (timeView === 'day') {
              // "YYYY-MM-DD" → "MM-DD"
              return value.length >= 10 ? value.slice(5, 10) : value
            }
            // "YYYY-MM" → keep as is
            return value
          },
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
          itemStyle: { color: CHART_COLORS.cacheRead },
          barGap: '-100%',
          data: cacheData,
          z: 0,
          barMaxWidth: 20,
        },
      ],
    }
  }, [xData, inputData, outputData, cacheData, markLines, isDark, defaultStartPct, timeView, modelBreakdownMap])

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
          key={timeView}
          ref={chartRef}
          option={option}
          style={{ flex: 1, minHeight: 180 }}
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
