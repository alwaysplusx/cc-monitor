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
  const hourBuckets = useDataStore((s) => s.hourBuckets)
  const dayBuckets = useDataStore((s) => s.dayBuckets)
  const modelSwitches = useDataStore((s) => s.modelSwitches)
  const timeView = useDataStore((s) => s.timeView)
  const setTimeView = useDataStore((s) => s.setTimeView)
  const setHighlightedTimeRange = useDataStore((s) => s.setHighlightedTimeRange)
  const { isDark } = useTheme()
  const chartRef = useRef<ReactECharts>(null)

  const tabs: { key: TimeView; label: string }[] = [
    { key: 'hour', label: 'Hours' },
    { key: 'day', label: 'Days' },
    { key: 'month', label: 'Months' },
  ]

  const { xData, inputData, outputData, cacheData } = useMemo(() => {
    if (timeView === 'hour') {
      return {
        xData: minuteBuckets.map((b) => b.minute),
        inputData: minuteBuckets.map((b) => b.input),
        outputData: minuteBuckets.map((b) => b.output),
        cacheData: minuteBuckets.map((b) => b.cacheRead),
      }
    } else if (timeView === 'day') {
      return {
        xData: hourBuckets.map((b) => b.hour),
        inputData: hourBuckets.map((b) => b.input),
        outputData: hourBuckets.map((b) => b.output),
        cacheData: hourBuckets.map((b) => b.cacheRead),
      }
    } else {
      return {
        xData: dayBuckets.map((b) => b.day),
        inputData: dayBuckets.map((b) => b.input),
        outputData: dayBuckets.map((b) => b.output),
        cacheData: dayBuckets.map((b) => b.cacheRead),
      }
    }
  }, [timeView, minuteBuckets, hourBuckets, dayBuckets])

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
      grid: { left: 50, right: 20, top: 10, bottom: 60 },
      tooltip: {
        trigger: 'axis',
        ...themeObj.tooltip,
        formatter: (params: unknown) => {
          const items = params as Array<{ seriesName: string; value: number; axisValue: string }>
          if (!items.length) return ''
          let html = `<div style="font-size:12px"><b>${items[0].axisValue}</b><br/>`
          for (const item of items) {
            html += `${item.seriesName}: ${fmtK(item.value)}<br/>`
          }
          html += '</div>'
          return html
        },
      },
      legend: {
        show: true,
        bottom: 30,
        selected: { 'Cache Read': false },
        ...themeObj.legend,
      },
      xAxis: {
        type: 'category',
        data: xData,
        ...themeObj.categoryAxis,
        axisLabel: {
          ...themeObj.categoryAxis?.axisLabel,
          fontSize: 10,
          rotate: xData.length > 20 ? 45 : 0,
        },
      },
      yAxis: {
        type: 'value',
        ...themeObj.valueAxis,
        axisLabel: {
          ...themeObj.valueAxis?.axisLabel,
          formatter: (v: number) => fmtK(v),
        },
      },
      dataZoom: [
        {
          type: 'slider',
          bottom: 5,
          height: 20,
          start: Math.max(0, 100 - (xData.length > 0 ? (120 / xData.length) * 100 : 100)),
          end: 100,
        },
      ],
      series: [
        {
          name: 'Input',
          type: 'line',
          stack: 'tokens',
          areaStyle: {
            color: {
              type: 'linear',
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: CHART_COLORS.input + '80' },
                { offset: 1, color: CHART_COLORS.input + '10' },
              ],
            },
          },
          lineStyle: { color: CHART_COLORS.input, width: 1.5 },
          itemStyle: { color: CHART_COLORS.input },
          data: inputData,
          smooth: true,
          showSymbol: false,
          markLine: markLines.length > 0
            ? {
                data: markLines,
                lineStyle: { type: 'dashed', color: '#f59e0b' },
                symbol: 'none',
              }
            : undefined,
        },
        {
          name: 'Output',
          type: 'line',
          stack: 'tokens',
          areaStyle: {
            color: {
              type: 'linear',
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: CHART_COLORS.output + '80' },
                { offset: 1, color: CHART_COLORS.output + '10' },
              ],
            },
          },
          lineStyle: { color: CHART_COLORS.output, width: 1.5 },
          itemStyle: { color: CHART_COLORS.output },
          data: outputData,
          smooth: true,
          showSymbol: false,
        },
        {
          name: 'Cache Read',
          type: 'line',
          stack: 'tokens',
          areaStyle: {
            color: {
              type: 'linear',
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: CHART_COLORS.cacheRead + '80' },
                { offset: 1, color: CHART_COLORS.cacheRead + '10' },
              ],
            },
          },
          lineStyle: { color: CHART_COLORS.cacheRead, width: 1.5 },
          itemStyle: { color: CHART_COLORS.cacheRead },
          data: cacheData,
          smooth: true,
          showSymbol: false,
        },
      ],
    }
  }, [xData, inputData, outputData, cacheData, markLines, isDark])

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
          No data available
        </div>
      )}
    </div>
  )
}
