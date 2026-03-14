// Project-level token usage distribution (ECharts donut chart + detail list)
import { useMemo } from 'react'
import ReactECharts from 'echarts-for-react'
import type { EChartsOption } from 'echarts'
import { useDataStore } from '../../stores/dataStore'
import { useTheme } from '../../hooks/useTheme'
import { echartsLightTheme, echartsDarkTheme } from '../../lib/theme'
import { fmtK } from '../../lib/format'

const PROJECT_COLORS = ['#3b82f6', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#6366f1']

interface ProjectUsage {
  name: string
  input: number
  output: number
  cacheRead: number
  total: number
  percentage: number
}

export default function ProjectPie() {
  const tokenRecords = useDataStore((s) => s.tokenRecords)
  const { isDark } = useTheme()

  const { projects, totalTokens } = useMemo(() => {
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
        return { name, input: e.input, output: e.output, cacheRead: e.cacheRead, total: t, percentage: total > 0 ? (t / total) * 100 : 0 }
      })
      .sort((a, b) => b.total - a.total)

    const major = all.filter((p) => p.percentage >= 5)
    const minor = all.filter((p) => p.percentage < 5)
    if (minor.length > 0) {
      const merged: ProjectUsage = {
        name: '其他',
        input: minor.reduce((s, p) => s + p.input, 0),
        output: minor.reduce((s, p) => s + p.output, 0),
        cacheRead: minor.reduce((s, p) => s + p.cacheRead, 0),
        total: minor.reduce((s, p) => s + p.total, 0),
        percentage: minor.reduce((s, p) => s + p.percentage, 0),
      }
      major.push(merged)
    }

    return { projects: major, totalTokens: total }
  }, [tokenRecords])

  const option: EChartsOption = useMemo(() => {
    const themeObj = isDark ? echartsDarkTheme : echartsLightTheme
    const data = projects.map((p, i) => ({
      name: p.name,
      value: p.total,
      itemStyle: { color: PROJECT_COLORS[i % PROJECT_COLORS.length] },
    }))

    return {
      ...themeObj,
      legend: { show: false },
      tooltip: {
        trigger: 'item',
        ...themeObj.tooltip,
        formatter: (params: unknown) => {
          const p = params as { name: string; value: number; percent: number }
          return `${p.name}<br/>${fmtK(p.value)} (${p.percent.toFixed(1)}%)`
        },
      },
      graphic: [
        {
          type: 'text',
          left: 'center',
          top: '35%',
          style: {
            text: fmtK(totalTokens),
            fontSize: 16,
            fontWeight: 'bold',
            fontFamily: 'JetBrains Mono, monospace',
            fill: isDark ? '#e2e8f0' : '#1a202c',
            textAlign: 'center',
          },
        },
        {
          type: 'text',
          left: 'center',
          top: '48%',
          style: {
            text: '总计',
            fontSize: 10,
            fill: isDark ? '#8892a8' : '#64748b',
            textAlign: 'center',
          },
        },
      ],
      series: [
        {
          type: 'pie',
          radius: ['45%', '70%'],
          center: ['50%', '42%'],
          data,
          label: { show: false },
          emphasis: { scaleSize: 8 },
          animationType: 'scale',
          animationEasing: 'elasticOut',
        },
      ],
    }
  }, [projects, totalTokens, isDark])

  const hasData = projects.length > 0

  return (
    <div className="flex h-full flex-col">
      <h3 className="mb-2 text-xs font-semibold text-[var(--foreground)]">项目分布</h3>

      {hasData ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <ReactECharts option={option} style={{ height: 160 }} notMerge={false} />

          <div className="mt-2 max-h-[88px] space-y-1.5 overflow-y-auto">
            {projects.map((p, i) => (
              <div key={p.name} className="flex items-center gap-2 text-xs">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: PROJECT_COLORS[i % PROJECT_COLORS.length] }}
                />
                <span className="flex-1 truncate text-[var(--foreground)]" title={p.name}>
                  {p.name}
                </span>
                <span className="font-mono text-[var(--muted-foreground)]">
                  {fmtK(p.total)}
                </span>
                <span className="w-10 text-right font-mono text-[var(--muted-foreground)]">
                  {p.percentage.toFixed(0)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center text-xs text-[var(--muted-foreground)]">
          暂无项目数据
        </div>
      )}
    </div>
  )
}
