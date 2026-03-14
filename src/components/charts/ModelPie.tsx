// Model usage distribution (ECharts donut chart + detail list)
import { useMemo } from 'react'
import ReactECharts from 'echarts-for-react'
import type { EChartsOption } from 'echarts'
import { useDataStore } from '../../stores/dataStore'
import { useTheme } from '../../hooks/useTheme'
import { echartsLightTheme, echartsDarkTheme } from '../../lib/theme'
import { fmtK } from '../../lib/format'

const MODEL_COLORS = ['#3b82f6', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444']

export default function ModelPie() {
  const modelSummaries = useDataStore((s) => s.modelSummaries)
  const { isDark } = useTheme()

  const totalTokens = useMemo(
    () => modelSummaries.reduce((s, m) => s + m.totalInput + m.totalOutput, 0),
    [modelSummaries],
  )

  const option: EChartsOption = useMemo(() => {
    const themeObj = isDark ? echartsDarkTheme : echartsLightTheme
    const data = modelSummaries.map((m, i) => ({
      name: m.model,
      value: m.totalInput + m.totalOutput,
      itemStyle: { color: MODEL_COLORS[i % MODEL_COLORS.length] },
    }))

    return {
      ...themeObj,
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
          emphasis: {
            scaleSize: 8,
          },
          animationType: 'scale',
          animationEasing: 'elasticOut',
        },
      ],
    }
  }, [modelSummaries, totalTokens, isDark])

  const hasData = modelSummaries.length > 0

  return (
    <div className="flex h-full flex-col">
      <h3 className="mb-2 text-xs font-semibold text-[var(--foreground)]">模型分布</h3>

      {hasData ? (
        <>
          <ReactECharts
            option={option}
            style={{ height: 160 }}
            notMerge={false}
          />

          {/* Model detail list */}
          <div className="mt-2 space-y-1.5">
            {modelSummaries.map((m, i) => (
              <div key={m.model} className="flex items-center gap-2 text-xs">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: MODEL_COLORS[i % MODEL_COLORS.length] }}
                />
                <span className="flex-1 truncate text-[var(--foreground)]">{m.model}</span>
                <span className="font-mono text-[var(--muted-foreground)]">
                  {fmtK(m.totalInput + m.totalOutput)}
                </span>
                <span className="w-10 text-right font-mono text-[var(--muted-foreground)]">
                  {m.percentage.toFixed(0)}%
                </span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="flex flex-1 items-center justify-center text-xs text-[var(--muted-foreground)]">
          暂无模型数据
        </div>
      )}
    </div>
  )
}
