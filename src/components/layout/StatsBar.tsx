// Top statistics cards row: input/output/cache tokens, requests, active duration
import { useMemo, useState } from 'react'
import { useDataStore } from '../../stores/dataStore'
import { fmtK, fmtN, fmtDuration } from '../../lib/format'
import { cn } from '../../lib/utils'
import { getModelPricing } from '../../lib/constants'
import { useSettingsStore } from '../../stores/settingsStore'

type TimeRange = 'today' | 'week' | 'month' | 'all'
const TIME_RANGE_LABELS: Record<TimeRange, string> = {
  today: '今日',
  week: '本周',
  month: '本月',
  all: '全部',
}

/** Get the start timestamp for a given time range */
function getTimeRangeStart(range: TimeRange): Date | null {
  if (range === 'all') return null
  const d = new Date()
  if (range === 'today') {
    d.setHours(0, 0, 0, 0)
  } else if (range === 'week') {
    const day = d.getDay()
    d.setDate(d.getDate() - (day === 0 ? 6 : day - 1)) // Monday as week start
    d.setHours(0, 0, 0, 0)
  } else if (range === 'month') {
    d.setDate(1)
    d.setHours(0, 0, 0, 0)
  }
  return d
}

/** Get the equivalent previous period start for D-1 comparison */
function getPrevPeriodRange(range: TimeRange): { start: Date; end: Date } | null {
  if (range === 'all') return null
  const now = new Date()
  const start = new Date()
  const end = new Date()
  if (range === 'today') {
    start.setDate(now.getDate() - 1)
    start.setHours(0, 0, 0, 0)
    end.setDate(now.getDate() - 1)
    end.setHours(23, 59, 59, 999)
  } else if (range === 'week') {
    const day = now.getDay()
    const mondayOffset = day === 0 ? 6 : day - 1
    start.setDate(now.getDate() - mondayOffset - 7)
    start.setHours(0, 0, 0, 0)
    end.setDate(now.getDate() - mondayOffset - 1)
    end.setHours(23, 59, 59, 999)
  } else if (range === 'month') {
    start.setMonth(now.getMonth() - 1, 1)
    start.setHours(0, 0, 0, 0)
    end.setMonth(now.getMonth(), 0) // last day of prev month
    end.setHours(23, 59, 59, 999)
  }
  return { start, end }
}

/** Format comparison percentage */
function CompareTag({ current, previous }: { current: number; previous: number }) {
  if (previous <= 0) return <span className="text-[var(--muted-foreground)]">-</span>
  const diff = ((current - previous) / previous) * 100
  const arrow = diff >= 0 ? '↑' : '↓'
  const cls = diff >= 0 ? 'text-green-400' : 'text-rose-400'
  return <span className={cls}>{arrow}{Math.abs(diff).toFixed(0)}%</span>
}

/** SVG sparkline — thin line + gradient fill for 7-day trend */
function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return null
  const h = 28
  const w = 100
  const max = Math.max(...data, 1)
  const pts = data.map((v, i) => ({
    x: (i / (data.length - 1)) * w,
    y: h - (v / max) * (h - 2) - 1,
  }))
  // Build smooth cubic bezier curve
  let line = `M${pts[0].x},${pts[0].y}`
  for (let i = 0; i < pts.length - 1; i++) {
    const cx = (pts[i].x + pts[i + 1].x) / 2
    line += ` C${cx},${pts[i].y} ${cx},${pts[i + 1].y} ${pts[i + 1].x},${pts[i + 1].y}`
  }
  const area = `${line} L${w},${h} L0,${h} Z`
  const gradId = `sp-${color.replace(/[^a-z0-9]/g, '')}`
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="absolute right-0 top-0 h-full w-full overflow-hidden opacity-30" preserveAspectRatio="none">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.4" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradId})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

interface StatCardProps {
  label: string
  value: string
  subtext?: string
  subtextNode?: React.ReactNode
  rightNode?: React.ReactNode
  rightHoverTooltip?: React.ReactNode
  bgNode?: React.ReactNode
  color: string
  sparkColor?: string
  sparkData?: number[]
  tooltip?: string
  tooltipAlign?: 'left' | 'right'
  onClick?: () => void
}

function StatCard({ label, value, subtext, subtextNode, rightNode, rightHoverTooltip, bgNode, color, sparkColor, sparkData, tooltip, tooltipAlign = 'right', onClick }: StatCardProps) {
  return (
    <div
      className={cn(
        'group/card relative flex flex-1 flex-col gap-1 rounded-lg border border-[var(--border)] bg-[var(--card)] p-3 transition-colors hover:border-[var(--primary)]',
        onClick && 'cursor-pointer',
      )}
      onClick={onClick}
    >
      {sparkData && sparkColor && <Sparkline data={sparkData} color={sparkColor} />}
      {bgNode}
      {rightNode && (
        <div className="group/ring absolute -right-px -top-px z-10">
          <div className="overflow-hidden rounded-tr-lg opacity-35 transition-opacity group-hover/ring:opacity-70">{rightNode}</div>
          {rightHoverTooltip && (
            <div className="pointer-events-none absolute right-full top-1 mr-1 hidden rounded-lg border border-[var(--border)] bg-[var(--popover)] px-3 py-2 shadow-lg group-hover/ring:block">
              {rightHoverTooltip}
            </div>
          )}
        </div>
      )}
      <div className="relative flex items-center gap-1">
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
      <span className={cn('relative font-mono text-xl font-bold', color)}>{value}</span>
      <div className="relative flex flex-1 flex-col">
        {subtextNode ?? <span className="text-xs text-[var(--muted-foreground)]">{subtext}</span>}
      </div>
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

/** Format date as local YYYY-MM-DD string (avoids UTC timezone offset from toISOString) */
function localDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Mini 24-hour density heatmap overlay */
function HourDensity({ data }: { data: number[] }) {
  const max = Math.max(...data, 1)
  return (
    <div className="absolute inset-x-0 bottom-0 z-20 flex items-end overflow-hidden rounded-b-lg opacity-25 hover:opacity-60 transition-opacity" style={{ height: '66%' }}>
      {data.map((v, i) => (
        <div
          key={i}
          className="flex-1"
          title={`${i.toString().padStart(2, '0')}:00 - ${(i + 1).toString().padStart(2, '0')}:00  ${v}次`}
          style={{
            height: v > 0 ? `${Math.max(15, (v / max) * 100)}%` : '10%',
            backgroundColor: v > 0 ? '#10b981' : 'var(--muted-foreground)',
            opacity: v > 0 ? 0.3 + (v / max) * 0.7 : 0.15,
          }}
        />
      ))}
    </div>
  )
}

/** Mini 24-day daily active hours overlay */
function DailyActiveHours({ records }: { records: { timestamp: Date }[] }) {
  const data = useMemo(() => {
    const today = new Date()
    const days: { label: string; hours: number }[] = []
    for (let i = 23; i >= 0; i--) {
      const d = new Date(today)
      d.setDate(d.getDate() - i)
      const dayStr = localDateStr(d)
      const dayLabel = d.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })
      const dayRecords = records.filter((r) => localDateStr(r.timestamp) === dayStr)
      let hours = 0
      if (dayRecords.length > 1) {
        const times = dayRecords.map((r) => r.timestamp.getTime())
        hours = (Math.max(...times) - Math.min(...times)) / (1000 * 60 * 60)
      }
      days.push({ label: dayLabel, hours: Math.round(hours * 10) / 10 })
    }
    return days
  }, [records])

  const max = Math.max(...data.map((d) => d.hours), 1)

  return (
    <div className="absolute inset-x-0 bottom-0 z-20 flex items-end overflow-hidden rounded-b-lg opacity-25 hover:opacity-60 transition-opacity" style={{ height: '66%' }}>
      {data.map((d, i) => (
        <div
          key={i}
          className="flex-1"
          title={`${d.label}  ${d.hours > 0 ? `${d.hours}h` : '无活动'}`}
          style={{
            height: d.hours > 0 ? `${Math.max(15, (d.hours / max) * 100)}%` : '10%',
            backgroundColor: d.hours > 0 ? '#f59e0b' : 'var(--muted-foreground)',
            opacity: d.hours > 0 ? 0.3 + (d.hours / max) * 0.7 : 0.15,
          }}
        />
      ))}
    </div>
  )
}

/** Mini 24-day daily token consumption overlay */
function DailyTokens({ records }: { records: { timestamp: Date; inputTokens: number; outputTokens: number; cacheReadTokens: number }[] }) {
  const data = useMemo(() => {
    const today = new Date()
    const days: { label: string; tokens: number }[] = []
    for (let i = 23; i >= 0; i--) {
      const d = new Date(today)
      d.setDate(d.getDate() - i)
      const dayStr = localDateStr(d)
      const dayLabel = d.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })
      let tokens = 0
      for (const r of records) {
        if (localDateStr(r.timestamp) === dayStr) {
          tokens += r.inputTokens + r.outputTokens + r.cacheReadTokens
        }
      }
      days.push({ label: dayLabel, tokens })
    }
    return days
  }, [records])

  const max = Math.max(...data.map((d) => d.tokens), 1)

  return (
    <div className="absolute inset-x-0 bottom-0 z-20 flex items-end overflow-hidden rounded-b-lg opacity-25 hover:opacity-60 transition-opacity" style={{ height: '66%' }}>
      {data.map((d, i) => (
        <div
          key={i}
          className="flex-1"
          title={`${d.label}  ${d.tokens > 0 ? fmtK(d.tokens) : '无数据'}`}
          style={{
            height: d.tokens > 0 ? `${Math.max(15, (d.tokens / max) * 100)}%` : '10%',
            backgroundColor: d.tokens > 0 ? '#f97316' : 'var(--muted-foreground)',
            opacity: d.tokens > 0 ? 0.3 + (d.tokens / max) * 0.7 : 0.15,
          }}
        />
      ))}
    </div>
  )
}

/** Mini 24-bar pulse chart for last 4 hours (each bar = 10 min) */
function RecentPulse({ records }: { records: { timestamp: Date; inputTokens: number; outputTokens: number; cacheReadTokens: number }[] }) {
  const data = useMemo(() => {
    const now = Date.now()
    const bucketCount = 24
    const bucketMs = 10 * 60 * 1000
    // Align end to next 10-min boundary so buckets are like 18:00-18:10, 18:10-18:20
    const endAligned = Math.ceil(now / bucketMs) * bucketMs
    const startAligned = endAligned - bucketCount * bucketMs
    const buckets = new Array(bucketCount).fill(0)
    for (const r of records) {
      const t = r.timestamp.getTime()
      if (t >= startAligned && t < endAligned) {
        const idx = Math.floor((t - startAligned) / bucketMs)
        if (idx >= 0 && idx < bucketCount) {
          buckets[idx] += r.inputTokens + r.outputTokens + r.cacheReadTokens
        }
      }
    }
    const fmt = (d: Date) => d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    return buckets.map((tokens, i) => {
      const bucketStart = new Date(startAligned + i * bucketMs)
      const bucketEnd = new Date(startAligned + (i + 1) * bucketMs)
      return { tokens, label: `${fmt(bucketStart)}-${fmt(bucketEnd)}` }
    })
  }, [records])

  const max = Math.max(...data.map((d) => d.tokens), 1)

  return (
    <div className="absolute inset-x-0 bottom-0 z-20 flex items-end overflow-hidden rounded-b-lg opacity-25 hover:opacity-60 transition-opacity" style={{ height: '66%' }}>
      {data.map((d, i) => (
        <div
          key={i}
          className="flex-1"
          title={`${d.label}  ${d.tokens > 0 ? fmtK(d.tokens) : '无活动'}`}
          style={{
            height: d.tokens > 0 ? `${Math.max(15, (d.tokens / max) * 100)}%` : '10%',
            backgroundColor: d.tokens > 0 ? '#f43f5e' : 'var(--muted-foreground)',
            opacity: d.tokens > 0 ? 0.3 + (d.tokens / max) * 0.7 : 0.15,
          }}
        />
      ))}
    </div>
  )
}

/** Horizontal progress bar for percentage display */
function ProgressBar({ percent, color }: { percent: number; color: string }) {
  return (
    <div className="mt-0.5 h-[4px] w-full overflow-hidden rounded-full bg-[var(--border)]">
      <div
        className="h-full rounded-full transition-all"
        style={{ width: `${Math.min(percent, 100)}%`, backgroundColor: color }}
      />
    </div>
  )
}

/** Corner half-donut ring for cost breakdown — hangs at top-right corner */
function CostDonut({ segments }: { segments: { value: number; color: string; label: string }[] }) {
  const viewSize = 84
  const r = 62
  const stroke = 9
  const C = 2 * Math.PI * r
  const total = segments.reduce((s, seg) => s + seg.value, 0)
  if (total === 0) return null

  const visibleArc = C * 0.25
  let segOffset = C * 0.5

  return (
    <svg width={viewSize} height={viewSize} viewBox={`0 0 ${viewSize} ${viewSize}`} style={{ cursor: 'pointer' }}>
      <g transform={`translate(${viewSize}, 0)`}>
        <circle cx={0} cy={0} r={r + stroke} fill="transparent" />
        {segments.map((seg, i) => {
          const dash = (seg.value / total) * visibleArc
          const currentOffset = segOffset
          segOffset += dash
          return (
            <circle
              key={i}
              cx={0}
              cy={0}
              r={r}
              fill="none"
              stroke={seg.color}
              strokeWidth={stroke}
              strokeDasharray={`${dash} ${C - dash}`}
              strokeDashoffset={-currentOffset}
              transform="rotate(-90 0 0)"
              className="pointer-events-none"
            />
          )
        })}
      </g>
    </svg>
  )
}

export default function StatsBar() {
  const records = useDataStore((s) => s.tokenRecords)
  const dayBuckets = useDataStore((s) => s.dayBuckets)
  const hourBuckets = useDataStore((s) => s.hourBuckets)
  const monthBuckets = useDataStore((s) => s.monthBuckets)
  const openDrilldown = useDataStore((s) => s.openDrilldown)
  const modelPricing = useSettingsStore((s) => s.modelPricing)
  const [timeRange, setTimeRange] = useState<TimeRange>('today')

  // Filter records by selected time range
  const rangeStart = useMemo(() => getTimeRangeStart(timeRange), [timeRange])
  const filteredRecords = useMemo(
    () => (rangeStart ? records.filter((r) => r.timestamp >= rangeStart) : records),
    [records, rangeStart],
  )

  // Previous period records for comparison
  const prevRecords = useMemo(() => {
    const prev = getPrevPeriodRange(timeRange)
    if (!prev) return []
    return records.filter((r) => r.timestamp >= prev.start && r.timestamp <= prev.end)
  }, [records, timeRange])

  const totalInput = filteredRecords.reduce((s, r) => s + r.inputTokens, 0)
  const totalOutput = filteredRecords.reduce((s, r) => s + r.outputTokens, 0)
  const totalCacheRead = filteredRecords.reduce((s, r) => s + r.cacheReadTokens, 0)
  const requestCount = filteredRecords.length

  const prevInput = prevRecords.reduce((s, r) => s + r.inputTokens, 0)
  const prevOutput = prevRecords.reduce((s, r) => s + r.outputTokens, 0)
  const prevCacheRead = prevRecords.reduce((s, r) => s + r.cacheReadTokens, 0)

  // Estimated cost by model pricing (filtered)
  const cost = useMemo(() => {
    let inputCost = 0
    let outputCost = 0
    let cacheCost = 0
    for (const r of filteredRecords) {
      const pricing = getModelPricing(r.model, modelPricing)
      inputCost += (r.inputTokens / 1_000_000) * pricing.input
      outputCost += (r.outputTokens / 1_000_000) * pricing.output
      cacheCost += (r.cacheReadTokens / 1_000_000) * pricing.cacheRead
    }
    const total = inputCost + outputCost + cacheCost
    return { inputCost, outputCost, cacheCost, total }
  }, [filteredRecords, modelPricing])

  // Previous period cost for comparison
  const prevCost = useMemo(() => {
    let total = 0
    for (const r of prevRecords) {
      const pricing = getModelPricing(r.model, modelPricing)
      total += (r.inputTokens / 1_000_000) * pricing.input
      total += (r.outputTokens / 1_000_000) * pricing.output
      total += (r.cacheReadTokens / 1_000_000) * pricing.cacheRead
    }
    return total
  }, [prevRecords, modelPricing])

  // Sparkline data adapted to time range
  const spark = useMemo(() => {
    if (timeRange === 'today') {
      // Today: 24 hourly points
      const todayStr = localDateStr(new Date())
      const bucketMap = new Map(hourBuckets.map((b) => [b.hour, b]))
      const hours: string[] = []
      for (let i = 0; i < 24; i++) {
        hours.push(`${todayStr}T${String(i).padStart(2, '0')}`)
      }
      return {
        input: hours.map((h) => bucketMap.get(h)?.input ?? 0),
        output: hours.map((h) => bucketMap.get(h)?.output ?? 0),
        cache: hours.map((h) => bucketMap.get(h)?.cacheRead ?? 0),
        requests: hours.map((h) => bucketMap.get(h)?.requestCount ?? 0),
        total: hours.map((h) => {
          const b = bucketMap.get(h)
          return b ? b.input + b.output + b.cacheRead : 0
        }),
      }
    }
    if (timeRange === 'all') {
      // All: 12 monthly points
      const today = new Date()
      const months: string[] = []
      for (let i = 11; i >= 0; i--) {
        const d = new Date(today.getFullYear(), today.getMonth() - i, 1)
        months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
      }
      const bucketMap = new Map(monthBuckets.map((b) => [b.month, b]))
      return {
        input: months.map((m) => bucketMap.get(m)?.input ?? 0),
        output: months.map((m) => bucketMap.get(m)?.output ?? 0),
        cache: months.map((m) => bucketMap.get(m)?.cacheRead ?? 0),
        requests: months.map((m) => bucketMap.get(m)?.requestCount ?? 0),
        total: months.map((m) => {
          const b = bucketMap.get(m)
          return b ? b.input + b.output + b.cacheRead : 0
        }),
      }
    }
    // Week / Month: use day buckets
    const today = new Date()
    const numDays = timeRange === 'week' ? 7 : 30
    const days: string[] = []
    for (let i = numDays - 1; i >= 0; i--) {
      const d = new Date(today)
      d.setDate(d.getDate() - i)
      days.push(d.toISOString().slice(0, 10))
    }
    const bucketMap = new Map(dayBuckets.map((b) => [b.day, b]))
    return {
      input: days.map((d) => bucketMap.get(d)?.input ?? 0),
      output: days.map((d) => bucketMap.get(d)?.output ?? 0),
      cache: days.map((d) => bucketMap.get(d)?.cacheRead ?? 0),
      requests: days.map((d) => bucketMap.get(d)?.requestCount ?? 0),
      total: days.map((d) => {
        const b = bucketMap.get(d)
        return b ? b.input + b.output + b.cacheRead : 0
      }),
    }
  }, [dayBuckets, hourBuckets, monthBuckets, timeRange])

  // Comparison label for tooltip
  const compareLabel = timeRange === 'today' ? '昨日' : timeRange === 'week' ? '上周' : timeRange === 'month' ? '上月' : ''

  // Total cost across all records (for "累计花费" card)
  const totalCost = useMemo(() => {
    let total = 0
    for (const r of records) {
      const pricing = getModelPricing(r.model, modelPricing)
      total += (r.inputTokens / 1_000_000) * pricing.input
      total += (r.outputTokens / 1_000_000) * pricing.output
      total += (r.cacheReadTokens / 1_000_000) * pricing.cacheRead
    }
    return total
  }, [records, modelPricing])

  // Previous period request count for comparison
  const prevRequestCount = prevRecords.length

  // Recent N hours stats (configurable)
  const recentHours = useSettingsStore((s) => s.recentHours)
  const recentCutoff = new Date(Date.now() - recentHours * 60 * 60 * 1000)
  const recent = records.filter((r) => r.timestamp >= recentCutoff)
  const recentInput = recent.reduce((s, r) => s + r.inputTokens, 0)
  const recentOutput = recent.reduce((s, r) => s + r.outputTokens, 0)
  const recentCache = recent.reduce((s, r) => s + r.cacheReadTokens, 0)
  const recentTotal = recentInput + recentOutput + recentCache

  // Recent days for comparison (used in second row)
  const recentDays = useMemo(() => {
    const bucketMap = new Map(dayBuckets.map((b) => [b.day, b]))
    return [1, 2].map((offset) => {
      const d = new Date()
      d.setDate(d.getDate() - offset)
      const dayStr = d.toISOString().slice(0, 10)
      const label = offset === 1 ? 'D-1' : 'D-2'
      const bucket = bucketMap.get(dayStr)
      const total = bucket ? bucket.input + bucket.output + bucket.cacheRead : 0
      const requests = bucket ? bucket.requestCount : 0
      return { label, total, requests }
    })
  }, [dayBuckets])

  // Hourly request density (follows time range filter)
  const hourDensity = useMemo(() => {
    const hours = new Array(24).fill(0)
    for (const r of filteredRecords) {
      hours[r.timestamp.getHours()]++
    }
    return hours
  }, [filteredRecords])

  // Calculate active duration: sum of active segments (gap > 5min = inactive)
  const ACTIVE_GAP_MS = 5 * 60 * 1000
  const timestamps = records.map((r) => r.timestamp.getTime()).filter((t) => t > 0).sort((a, b) => a - b)
  const activeDurationMs = useMemo(() => {
    if (timestamps.length < 2) return 0
    let total = 0
    for (let i = 1; i < timestamps.length; i++) {
      const gap = timestamps[i] - timestamps[i - 1]
      if (gap <= ACTIVE_GAP_MS) total += gap
    }
    return total
  }, [timestamps.length > 0 ? timestamps[0] : 0, timestamps.length > 0 ? timestamps[timestamps.length - 1] : 0, timestamps.length])

  return (
    <>
    <div className="flex items-center gap-1.5 px-4 pt-4 pb-2">
      {(Object.keys(TIME_RANGE_LABELS) as TimeRange[]).map((key) => (
        <button
          key={key}
          className={cn(
            'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
            timeRange === key
              ? 'bg-[var(--primary)] text-[var(--primary-foreground)]'
              : 'text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]',
          )}
          onClick={() => setTimeRange(key)}
        >
          {TIME_RANGE_LABELS[key]}
        </button>
      ))}
    </div>
    <div className="grid grid-cols-4 gap-3 px-4">
      <StatCard
        label="输入 Token"
        value={fmtK(totalInput)}
        subtextNode={
          <div className="flex items-baseline gap-2 text-xs">
            <span className="text-[var(--muted-foreground)]">{fmtN(totalInput)}</span>
            {timeRange !== 'all' && (
              <>
                <span className="text-[var(--border)]">|</span>
                <CompareTag current={totalInput} previous={prevInput} />
              </>
            )}
          </div>
        }
        color="text-blue-500"
        sparkData={spark.input}
        sparkColor="#3b82f6"
        tooltip={`${TIME_RANGE_LABELS[timeRange]}发送给模型的 Token 量${compareLabel ? `（vs ${compareLabel}）` : ''}`}
        tooltipAlign="left"
      />
      <StatCard
        label="输出 Token"
        value={fmtK(totalOutput)}
        subtextNode={
          <div className="flex items-baseline gap-2 text-xs">
            <span className="text-[var(--muted-foreground)]">{fmtN(totalOutput)}</span>
            {timeRange !== 'all' && (
              <>
                <span className="text-[var(--border)]">|</span>
                <CompareTag current={totalOutput} previous={prevOutput} />
              </>
            )}
          </div>
        }
        color="text-purple-500"
        sparkData={spark.output}
        sparkColor="#8b5cf6"
        tooltip={`${TIME_RANGE_LABELS[timeRange]}模型生成的 Token 量${compareLabel ? `（vs ${compareLabel}）` : ''}`}
      />
      <StatCard
        label="缓存读取"
        value={fmtK(totalCacheRead)}
        subtextNode={
          <div className="flex items-baseline gap-2 text-xs">
            <span className="text-[var(--muted-foreground)]">{fmtN(totalCacheRead)}</span>
            <span className="text-[var(--border)]">|</span>
            <span className="font-mono font-semibold text-cyan-500">
              {totalCacheRead + totalInput > 0
                ? `${((totalCacheRead / (totalCacheRead + totalInput)) * 100).toFixed(1)}%`
                : '0%'}
            </span>
            <span className="text-[10px] text-[var(--muted-foreground)]">命中率</span>
            {timeRange !== 'all' && (
              <>
                <span className="text-[var(--border)]">|</span>
                <CompareTag current={totalCacheRead} previous={prevCacheRead} />
              </>
            )}
          </div>
        }
        color="text-cyan-500"
        sparkData={spark.cache}
        sparkColor="#06b6d4"
        tooltip={`${TIME_RANGE_LABELS[timeRange]}从缓存中读取的 Token 量。命中率 = 缓存读取 / (缓存读取 + 输入)`}
      />
      <StatCard
        label="预估花费"
        value={`$${cost.total.toFixed(2)}`}
        subtextNode={
          <div className="flex items-center gap-1.5 text-xs">
            <span className="font-mono font-semibold text-blue-500">${cost.inputCost.toFixed(2)}</span>
            <span className="text-[var(--muted-foreground)]">/</span>
            <span className="font-mono font-semibold text-purple-500">${cost.outputCost.toFixed(2)}</span>
            <span className="text-[var(--muted-foreground)]">/</span>
            <span className="font-mono font-semibold text-cyan-500">${cost.cacheCost.toFixed(2)}</span>
            {timeRange !== 'all' && (
              <>
                <span className="text-[var(--border)]">|</span>
                <CompareTag current={cost.total} previous={prevCost} />
              </>
            )}
          </div>
        }
        rightNode={
          <CostDonut segments={[
            { value: cost.inputCost, color: '#3b82f6', label: '输入' },
            { value: cost.outputCost, color: '#8b5cf6', label: '输出' },
            { value: cost.cacheCost, color: '#06b6d4', label: '缓存' },
          ]} />
        }
        rightHoverTooltip={
          <div className="space-y-1.5">
            {[
              { label: '输入', color: '#3b82f6', pct: cost.total > 0 ? (cost.inputCost / cost.total) * 100 : 0 },
              { label: '输出', color: '#8b5cf6', pct: cost.total > 0 ? (cost.outputCost / cost.total) * 100 : 0 },
              { label: '缓存', color: '#06b6d4', pct: cost.total > 0 ? (cost.cacheCost / cost.total) * 100 : 0 },
            ].map((seg, i) => (
              <div key={i} className="flex items-center gap-2 whitespace-nowrap text-xs">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: seg.color }} />
                <span className="text-[var(--muted-foreground)]">{seg.label}</span>
                <span className="font-mono font-semibold text-[var(--popover-foreground)]">{seg.pct.toFixed(1)}%</span>
              </div>
            ))}
          </div>
        }
        color="text-emerald-500"
        tooltip={`${TIME_RANGE_LABELS[timeRange]}根据官方 API 定价估算花费`}
        onClick={() => openDrilldown('cost')}
      />
    </div>
    <div className="grid grid-cols-4 gap-3 px-4 pb-4 pt-3">
      <StatCard
        label="请求次数"
        value={fmtK(requestCount)}
        bgNode={<HourDensity data={hourDensity} />}
        subtextNode={
          <div className="flex items-baseline gap-x-2 text-xs">
            {timeRange !== 'all' ? (
              <CompareTag current={requestCount} previous={prevRequestCount} />
            ) : (
              <>
                {recentDays.map((d, i) => (
                  <span key={i} className="flex items-baseline gap-x-2">
                    {i > 0 && <span className="text-[var(--border)]">|</span>}
                    <span className="whitespace-nowrap font-mono text-[var(--muted-foreground)]">
                      <span className="opacity-60">{d.label}</span>{' '}
                      <span>{d.requests}</span>
                    </span>
                  </span>
                ))}
              </>
            )}
          </div>
        }
        color="text-green-500"
        tooltip={`${TIME_RANGE_LABELS[timeRange]} API 请求次数`}
        tooltipAlign="left"
        onClick={() => openDrilldown('usage-pattern')}
      />
      <StatCard
        label={`近${recentHours}小时`}
        value={fmtK(recentTotal)}
        bgNode={<RecentPulse records={records} />}
        subtextNode={
          <div className="flex items-center gap-1.5 text-xs">
            <ColoredToken value={recentInput} color="text-blue-500" />
            <span className="text-[var(--muted-foreground)]">/</span>
            <ColoredToken value={recentOutput} color="text-purple-500" />
            <span className="text-[var(--muted-foreground)]">/</span>
            <ColoredToken value={recentCache} color="text-cyan-500" />
            <span className="text-[var(--muted-foreground)]">/</span>
            <span className="font-mono font-semibold text-green-500">{recent.length}</span>
          </div>
        }
        color="text-rose-500"
        tooltip={`最近${recentHours}小时的输入+输出+缓存 Token 合计`}
      />
      <StatCard
        label="累计花费"
        value={`$${totalCost.toFixed(2)}`}
        bgNode={<DailyTokens records={records} />}
        subtextNode={
          <div className="flex items-baseline gap-x-2 text-xs">
            <span className="whitespace-nowrap font-mono text-[var(--muted-foreground)]">
              {records.length} 次请求
            </span>
            <span className="text-[var(--border)]">|</span>
            <span className="whitespace-nowrap font-mono text-[var(--muted-foreground)]">
              {fmtK(records.reduce((s, r) => s + r.inputTokens + r.outputTokens + r.cacheReadTokens, 0))} tokens
            </span>
          </div>
        }
        color="text-orange-500"
        tooltip="所有历史记录的预估总花费"
        onClick={() => openDrilldown('cost')}
      />
      <StatCard
        label="活跃时长"
        value={fmtDuration(activeDurationMs)}
        bgNode={<DailyActiveHours records={records} />}
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
        tooltip="活跃使用时长（相邻请求间隔超过5分钟视为不活跃）"
      />
    </div>
    </>
  )
}
