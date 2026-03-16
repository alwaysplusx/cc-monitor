// Project-level token usage distribution (ECharts treemap + detail list)
import { useMemo, useCallback } from 'react'
import ReactECharts from 'echarts-for-react'
import type { EChartsOption } from 'echarts'
import { useDataStore } from '../../stores/dataStore'
import { useSettingsStore } from '../../stores/settingsStore'
import { useTheme } from '../../hooks/useTheme'
import { echartsLightTheme, echartsDarkTheme } from '../../lib/theme'
import { fmtK } from '../../lib/format'

const PROJECT_COLORS = ['#3b82f6', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#6366f1']

interface ProjectUsage {
  path: string
  name: string
  input: number
  output: number
  cacheRead: number
  total: number
  percentage: number
}

export default function ProjectPie() {
  const tokenRecords = useDataStore((s) => s.tokenRecords)
  const openDrilldown = useDataStore((s) => s.openDrilldown)
  const { isDark } = useTheme()
  const mergeThreshold = useSettingsStore((s) => s.projectMergeThreshold)

  const { chartProjects, allProjects, totalTokens } = useMemo(() => {
    const map = new Map<string, { input: number; output: number; cacheRead: number }>()
    for (const r of tokenRecords) {
      const key = r.projectPath || '未知项目'
      const entry = map.get(key) ?? { input: 0, output: 0, cacheRead: 0 }
      entry.input += r.inputTokens
      entry.output += r.outputTokens
      entry.cacheRead += r.cacheReadTokens
      map.set(key, entry)
    }

    const total = Array.from(map.values()).reduce((s, e) => s + e.input + e.output, 0)
    const all: ProjectUsage[] = Array.from(map.entries())
      .map(([path, e]) => {
        const t = e.input + e.output
        const name = path.split(/[/\\]/).pop() || path
        return { path, name, input: e.input, output: e.output, cacheRead: e.cacheRead, total: t, percentage: total > 0 ? (t / total) * 100 : 0 }
      })
      .sort((a, b) => b.total - a.total)

    // Chart data: merge below threshold into "其他"
    const chartMajor = all.filter((p) => p.percentage >= mergeThreshold)
    const chartMinor = all.filter((p) => p.percentage < mergeThreshold)
    const chartProjects = [...chartMajor]
    if (chartMinor.length > 0) {
      chartProjects.push({
        path: '',
        name: '其他',
        input: chartMinor.reduce((s, p) => s + p.input, 0),
        output: chartMinor.reduce((s, p) => s + p.output, 0),
        cacheRead: chartMinor.reduce((s, p) => s + p.cacheRead, 0),
        total: chartMinor.reduce((s, p) => s + p.total, 0),
        percentage: chartMinor.reduce((s, p) => s + p.percentage, 0),
      })
    }

    return { chartProjects, allProjects: all, totalTokens: total }
  }, [tokenRecords, mergeThreshold])

  const option: EChartsOption = useMemo(() => {
    const themeObj = isDark ? echartsDarkTheme : echartsLightTheme
    const data = chartProjects.map((p, i) => ({
      name: p.name,
      value: p.total,
      itemStyle: { color: PROJECT_COLORS[i % PROJECT_COLORS.length] },
    }))

    return {
      backgroundColor: 'transparent',
      tooltip: {
        ...themeObj.tooltip,
        formatter: (params: unknown) => {
          const p = params as { name: string; value: number }
          const pct = totalTokens > 0 ? ((p.value / totalTokens) * 100).toFixed(1) : '0'
          return `${p.name}<br/>${fmtK(p.value)} (${pct}%)`
        },
      },
      series: [
        {
          type: 'treemap',
          left: 0,
          right: 0,
          top: 0,
          bottom: 0,
          roam: false,
          nodeClick: false,
          breadcrumb: { show: false },
          label: {
            show: true,
            fontSize: 11,
            fontWeight: 'bold',
            color: '#fff',
            formatter: (params: unknown) => {
              const p = params as { name: string; value: number }
              const pct = totalTokens > 0 ? ((p.value / totalTokens) * 100).toFixed(0) : '0'
              return `${p.name}\n${fmtK(p.value)}  ${pct}%`
            },
          },
          itemStyle: {
            borderColor: isDark ? '#1e293b' : '#ffffff',
            borderWidth: 2,
            gapWidth: 2,
            borderRadius: 4,
          },
          emphasis: {
            itemStyle: { shadowBlur: 6, shadowColor: 'rgba(0,0,0,0.3)' },
          },
          data,
        },
      ],
    }
  }, [chartProjects, totalTokens, isDark])

  const nameToPath = useMemo(() => {
    const map = new Map<string, string>()
    for (const p of allProjects) map.set(p.name, p.path)
    return map
  }, [allProjects])

  const onChartClick = useCallback(
    (params: { name: string }) => {
      if (params.name === '其他') return
      const path = nameToPath.get(params.name)
      if (path) openDrilldown('project', { projectPath: path })
    },
    [openDrilldown, nameToPath],
  )

  const hasData = allProjects.length > 0

  return (
    <div className="flex h-full flex-col">
      <div className="mb-1 flex items-baseline justify-between">
        <h3 className="text-xs font-semibold text-[var(--foreground)]">项目分布</h3>
        <span className="font-mono text-xs text-[var(--muted-foreground)]">{fmtK(totalTokens)}</span>
      </div>

      {hasData ? (
        <div className="min-h-0 flex-1">
          <ReactECharts option={option} style={{ height: '100%' }} notMerge={false} onEvents={{ click: onChartClick }} />
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center text-xs text-[var(--muted-foreground)]">
          暂无项目数据
        </div>
      )}
    </div>
  )
}
