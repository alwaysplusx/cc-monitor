// Top statistics cards row: input/output/cache tokens, requests, active duration
import { useDataStore } from '../../stores/dataStore'
import { fmtK, fmtN, fmtDuration } from '../../lib/format'
import { cn } from '../../lib/utils'

interface StatCardProps {
  label: string
  value: string
  subtext: string
  color: string
}

function StatCard({ label, value, subtext, color }: StatCardProps) {
  return (
    <div className="group flex flex-1 flex-col gap-1 rounded-lg border border-[var(--border)] bg-[var(--card)] p-3 transition-colors hover:border-[var(--primary)]">
      <span className="text-xs text-[var(--muted-foreground)]">{label}</span>
      <span className={cn('font-mono text-xl font-bold', color)}>{value}</span>
      <span className="text-xs text-[var(--muted-foreground)]">{subtext}</span>
    </div>
  )
}

export default function StatsBar() {
  const records = useDataStore((s) => s.tokenRecords)

  const totalInput = records.reduce((s, r) => s + r.inputTokens, 0)
  const totalOutput = records.reduce((s, r) => s + r.outputTokens, 0)
  const totalCacheRead = records.reduce((s, r) => s + r.cacheReadTokens, 0)
  const requestCount = records.length

  // Calculate active duration: from first to last record timestamp
  const timestamps = records.map((r) => r.timestamp.getTime()).filter((t) => t > 0)
  const activeDurationMs =
    timestamps.length > 1 ? Math.max(...timestamps) - Math.min(...timestamps) : 0

  return (
    <div className="flex gap-3 p-4">
      <StatCard
        label="输入 Token"
        value={fmtK(totalInput)}
        subtext={fmtN(totalInput)}
        color="text-blue-500"
      />
      <StatCard
        label="输出 Token"
        value={fmtK(totalOutput)}
        subtext={fmtN(totalOutput)}
        color="text-purple-500"
      />
      <StatCard
        label="缓存读取"
        value={fmtK(totalCacheRead)}
        subtext={fmtN(totalCacheRead)}
        color="text-cyan-500"
      />
      <StatCard
        label="请求次数"
        value={fmtK(requestCount)}
        subtext={`共 ${requestCount} 次`}
        color="text-green-500"
      />
      <StatCard
        label="活跃时长"
        value={fmtDuration(activeDurationMs)}
        subtext={timestamps.length > 0
          ? (() => {
              const minDate = new Date(Math.min(...timestamps))
              const maxDate = new Date(Math.max(...timestamps))
              const fmt = (d: Date) => d.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })
              const fmtTime = (d: Date) => d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
              if (fmt(minDate) === fmt(maxDate)) {
                return `${fmtTime(minDate)} - ${fmtTime(maxDate)}`
              }
              return `${fmt(minDate)} - ${fmt(maxDate)}`
            })()
          : '暂无数据'}
        color="text-amber-500"
      />
    </div>
  )
}
