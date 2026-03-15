// GitHub-style activity heatmap showing daily token consumption
import { useMemo } from 'react'
import ReactECharts from 'echarts-for-react'
import type { EChartsOption } from 'echarts'
import { useDataStore } from '../../stores/dataStore'
import { useTheme } from '../../hooks/useTheme'
import { fmtK } from '../../lib/format'

export default function ActivityHeatmap() {
  const dayBuckets = useDataStore((s) => s.dayBuckets)
  const { isDark } = useTheme()

  const { data, range, max } = useMemo(() => {
    // Build heatmap data: [date, totalTokens]
    const items = dayBuckets.map((b) => {
      const total = b.input + b.output
      return [b.day, total] as [string, number]
    })
    const maxVal = Math.max(...items.map((d) => d[1]), 1)

    // Date range: last 365 days ending today
    const end = new Date()
    const start = new Date(end)
    start.setFullYear(start.getFullYear() - 1)
    const startStr = start.toISOString().slice(0, 10)
    const endStr = end.toISOString().slice(0, 10)

    return { data: items, range: [startStr, endStr], max: maxVal }
  }, [dayBuckets])

  const option: EChartsOption = useMemo(() => {
    const textColor = isDark ? '#8892a8' : '#64748b'
    const bgEmpty = isDark ? '#1e293b' : '#ebedf0'
    const levelColors = isDark
      ? [bgEmpty, '#0e4429', '#006d32', '#26a641', '#39d353']
      : [bgEmpty, '#9be9a8', '#40c463', '#30a14e', '#216e39']

    return {
      tooltip: {
        formatter: (params: unknown) => {
          const p = params as { value: [string, number] }
          if (!p.value[1]) return `${p.value[0]}<br/>无活动`
          return `${p.value[0]}<br/>Token: ${fmtK(p.value[1])}`
        },
        backgroundColor: isDark ? '#111827' : '#ffffff',
        borderColor: isDark ? '#1e293b' : '#e2e8f0',
        textStyle: { color: isDark ? '#e2e8f0' : '#1a202c', fontSize: 11 },
      },
      visualMap: {
        min: 0,
        max,
        show: false,
        inRange: {
          color: levelColors,
        },
      },
      calendar: {
        top: 8,
        left: 30,
        right: 8,
        bottom: 4,
        cellSize: [11, 11],
        range,
        itemStyle: {
          borderWidth: 2,
          borderColor: isDark ? '#0d1117' : '#ffffff',
          color: bgEmpty,
        },
        splitLine: { show: false },
        yearLabel: { show: false },
        monthLabel: {
          color: textColor,
          fontSize: 10,
          nameMap: 'ZH',
        },
        dayLabel: {
          color: textColor,
          fontSize: 9,
          nameMap: 'ZH',
          firstDay: 1,
        },
      },
      series: [
        {
          type: 'heatmap',
          coordinateSystem: 'calendar',
          data,
          emphasis: {
            itemStyle: {
              borderColor: isDark ? '#58a6ff' : '#1f6feb',
              borderWidth: 1,
            },
          },
        },
      ],
    }
  }, [data, range, max, isDark])

  return (
    <div className="flex h-full flex-col">
      <ReactECharts option={option} style={{ flex: 1, minHeight: 120 }} notMerge={false} />
    </div>
  )
}
