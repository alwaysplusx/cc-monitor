// Top statistics cards row: input/output/cache tokens, requests, active duration
import { useDataStore } from '../../stores/dataStore'
import { fmtK, fmtN, fmtDuration } from '../../lib/format'
import { cn } from '../../lib/utils'

interface StatCardProps {
  label: string
  value: string
  subtext?: string
  subtextNode?: React.ReactNode
  color: string
  tooltip?: string
  tooltipAlign?: 'left' | 'right'
}

function StatCard({ label, value, subtext, subtextNode, color, tooltip, tooltipAlign = 'right' }: StatCardProps) {
  return (
    <div className="relative flex flex-1 flex-col gap-1 rounded-lg border border-[var(--border)] bg-[var(--card)] p-3 transition-colors hover:border-[var(--primary)]">
      <div className="flex items-center gap-1">
        <span className="text-xs text-[var(--muted-foreground)]">{label}</span>
        {tooltip && (
          <span className="group/tip relative cursor-help text-[var(--muted-foreground)] opacity-50 transition-opacity hover:opacity-100">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 16v-4" />
              <path d="M12 8h.01" />
            </svg>
            <span className={`pointer-events-none absolute top-5 z-50 hidden w-44 rounded-md border border-[var(--border)] bg-[var(--popover)] px-2.5 py-1.5 text-xs leading-relaxed text-[var(--popover-foreground)] shadow-md group-hover/tip:block ${tooltipAlign === 'left' ? 'left-0' : 'right-0'}`}>
              {tooltip}
            </span>
          </span>
        )}
      </div>
      <span className={cn('font-mono text-xl font-bold', color)}>{value}</span>
      {subtextNode ?? <span className="text-xs text-[var(--muted-foreground)]">{subtext}</span>}
    </div>
  )
}

/** Split number into value + unit for colored display */
function fmtSplit(n: number): { num: string; unit: string } {
  if (n >= 1_000_000) return { num: (n / 1_000_000).toFixed(1), unit: 'M' }
  if (n >= 1_000) return { num: (n / 1_000).toFixed(1), unit: 'K' }
  return { num: n.toString(), unit: '' }
}

function ColoredToken({ value, color }: { value: number; color: string }) {
  const { num, unit } = fmtSplit(value)
  return (
    <span className={cn('font-mono', color)}>
      <span className="font-semibold">{num}</span>
      {unit && <span className="text-[10px] opacity-60">{unit}</span>}
    </span>
  )
}

export default function StatsBar() {
  const records = useDataStore((s) => s.tokenRecords)

  const totalInput = records.reduce((s, r) => s + r.inputTokens, 0)
  const totalOutput = records.reduce((s, r) => s + r.outputTokens, 0)
  const totalCacheRead = records.reduce((s, r) => s + r.cacheReadTokens, 0)
  const requestCount = records.length

  // Last 5 hours stats
  const fiveHoursAgo = new Date(Date.now() - 5 * 60 * 60 * 1000)
  const recent = records.filter((r) => r.timestamp >= fiveHoursAgo)
  const recentInput = recent.reduce((s, r) => s + r.inputTokens, 0)
  const recentOutput = recent.reduce((s, r) => s + r.outputTokens, 0)
  const recentCache = recent.reduce((s, r) => s + r.cacheReadTokens, 0)
  const recentTotal = recentInput + recentOutput + recentCache

  // Calculate active duration: from first to last record timestamp
  const timestamps = records.map((r) => r.timestamp.getTime()).filter((t) => t > 0)
  const activeDurationMs =
    timestamps.length > 1 ? Math.max(...timestamps) - Math.min(...timestamps) : 0

  return (
    <div className="grid grid-cols-6 gap-3 p-4">
      <StatCard
        label="输入 Token"
        value={fmtK(totalInput)}
        subtext={fmtN(totalInput)}
        color="text-blue-500"
        tooltip="发送给模型的 Token 总量（所有项目累计）"
        tooltipAlign="left"
      />
      <StatCard
        label="输出 Token"
        value={fmtK(totalOutput)}
        subtext={fmtN(totalOutput)}
        color="text-purple-500"
        tooltip="模型生成的 Token 总量（所有项目累计）"
      />
      <StatCard
        label="缓存读取"
        value={fmtK(totalCacheRead)}
        subtext={fmtN(totalCacheRead)}
        color="text-cyan-500"
        tooltip="从缓存中读取的 Token 总量，不计入实际消耗"
      />
      <StatCard
        label="请求次数"
        value={fmtK(requestCount)}
        subtext={`共 ${requestCount} 次`}
        color="text-green-500"
        tooltip="所有项目的 API 请求次数累计"
        tooltipAlign="left"
      />
      <StatCard
        label="近5小时"
        value={fmtK(recentTotal)}
        subtextNode={
          <div className="flex items-center gap-1.5 text-xs">
            <ColoredToken value={recentInput} color="text-blue-500" />
            <span className="text-[var(--muted-foreground)]">/</span>
            <ColoredToken value={recentOutput} color="text-purple-500" />
            <span className="text-[var(--muted-foreground)]">/</span>
            <ColoredToken value={recentCache} color="text-cyan-500" />
            <span className="text-[var(--muted-foreground)]">/</span>
            <span className="font-mono text-green-500">
              <span className="font-semibold">{recent.length}</span>
              <span className="text-[10px] opacity-60">次</span>
            </span>
          </div>
        }
        color="text-rose-500"
        tooltip="最近5小时的输入+输出+缓存 Token 合计"
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
        tooltip="最早记录到最新记录的时间跨度（非实际使用时长）"
      />
    </div>
  )
}
