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
        label="Input Tokens"
        value={fmtK(totalInput)}
        subtext={fmtN(totalInput)}
        color="text-blue-500"
      />
      <StatCard
        label="Output Tokens"
        value={fmtK(totalOutput)}
        subtext={fmtN(totalOutput)}
        color="text-purple-500"
      />
      <StatCard
        label="Cache Read"
        value={fmtK(totalCacheRead)}
        subtext={fmtN(totalCacheRead)}
        color="text-cyan-500"
      />
      <StatCard
        label="Requests"
        value={fmtK(requestCount)}
        subtext={`${requestCount} total`}
        color="text-green-500"
      />
      <StatCard
        label="Active Duration"
        value={fmtDuration(activeDurationMs)}
        subtext={timestamps.length > 0
          ? `${new Date(Math.min(...timestamps)).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })} - ${new Date(Math.max(...timestamps)).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`
          : 'No data'}
        color="text-amber-500"
      />
    </div>
  )
}
