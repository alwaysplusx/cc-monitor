// Top statistics cards row: input/output/cache tokens, requests, active duration
import { useMemo } from 'react'
import { useDataStore } from '../../stores/dataStore'
import { fmtK, fmtN, fmtDuration } from '../../lib/format'
import { cn } from '../../lib/utils'
import { getModelPricing } from '../../lib/constants'
import { useSettingsStore } from '../../stores/settingsStore'

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
  color: string
  sparkColor?: string
  sparkData?: number[]
  tooltip?: string
  tooltipAlign?: 'left' | 'right'
}

function StatCard({ label, value, subtext, subtextNode, rightNode, rightHoverTooltip, color, sparkColor, sparkData, tooltip, tooltipAlign = 'right' }: StatCardProps) {
  return (
    <div className="group/card relative flex flex-1 flex-col gap-1 rounded-lg border border-[var(--border)] bg-[var(--card)] p-3 transition-colors hover:border-[var(--primary)]">
      {sparkData && sparkColor && <Sparkline data={sparkData} color={sparkColor} />}
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
  const modelPricing = useSettingsStore((s) => s.modelPricing)

  const totalInput = records.reduce((s, r) => s + r.inputTokens, 0)
  const totalOutput = records.reduce((s, r) => s + r.outputTokens, 0)
  const totalCacheRead = records.reduce((s, r) => s + r.cacheReadTokens, 0)
  const requestCount = records.length

  // Estimated cost by model pricing
  const cost = useMemo(() => {
    let inputCost = 0
    let outputCost = 0
    let cacheCost = 0
    for (const r of records) {
      const pricing = getModelPricing(r.model, modelPricing)
      inputCost += (r.inputTokens / 1_000_000) * pricing.input
      outputCost += (r.outputTokens / 1_000_000) * pricing.output
      cacheCost += (r.cacheReadTokens / 1_000_000) * pricing.cacheRead
    }
    const total = inputCost + outputCost + cacheCost
    return { inputCost, outputCost, cacheCost, total }
  }, [records, modelPricing])

  // Last 7 days sparkline data
  const spark = useMemo(() => {
    const today = new Date()
    const days: string[] = []
    for (let i = 6; i >= 0; i--) {
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
  }, [dayBuckets])

  // Cache hit rate
  const cacheHitRate = totalInput + totalCacheRead > 0
    ? (totalCacheRead / (totalInput + totalCacheRead)) * 100
    : 0

  // Last 5 hours stats
  const fiveHoursAgo = new Date(Date.now() - 5 * 60 * 60 * 1000)
  const recent = records.filter((r) => r.timestamp >= fiveHoursAgo)
  const recentInput = recent.reduce((s, r) => s + r.inputTokens, 0)
  const recentOutput = recent.reduce((s, r) => s + r.outputTokens, 0)
  const recentCache = recent.reduce((s, r) => s + r.cacheReadTokens, 0)
  const recentTotal = recentInput + recentOutput + recentCache

  // Last 24 hours consumption
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const last24h = records.filter((r) => r.timestamp >= twentyFourHoursAgo)
  const todayTotal = last24h.reduce((s, r) => s + r.inputTokens + r.outputTokens + r.cacheReadTokens, 0)
  const todayRequests = last24h.length
  // Recent days for comparison
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
  const yesterdayTotal = recentDays[0].total
  const yesterdayRequests = recentDays[0].requests

  // Calculate active duration: from first to last record timestamp
  const timestamps = records.map((r) => r.timestamp.getTime()).filter((t) => t > 0)
  const activeDurationMs =
    timestamps.length > 1 ? Math.max(...timestamps) - Math.min(...timestamps) : 0

  return (
    <>
    <div className="grid grid-cols-4 gap-3 px-4 pt-4">
      <StatCard
        label="输入 Token"
        value={fmtK(totalInput)}
        subtext={fmtN(totalInput)}
        color="text-blue-500"
        sparkData={spark.input}
        sparkColor="#3b82f6"
        tooltip="发送给模型的 Token 总量（所有项目累计）"
        tooltipAlign="left"
      />
      <StatCard
        label="输出 Token"
        value={fmtK(totalOutput)}
        subtext={fmtN(totalOutput)}
        color="text-purple-500"
        sparkData={spark.output}
        sparkColor="#8b5cf6"
        tooltip="模型生成的 Token 总量（所有项目累计）"
      />
      <StatCard
        label="缓存读取"
        value={fmtK(totalCacheRead)}
        subtext={fmtN(totalCacheRead)}
        color="text-cyan-500"
        sparkData={spark.cache}
        sparkColor="#06b6d4"
        tooltip="从缓存中读取的 Token 总量，不计入实际消耗"
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
        tooltip="根据各模型的官方 API 定价估算总花费（输入+输出+缓存读取）"
      />
    </div>
    <div className="grid grid-cols-4 gap-3 px-4 pb-4 pt-3">
      <StatCard
        label="请求次数"
        value={fmtK(requestCount)}
        subtextNode={
          <div className="flex items-baseline gap-x-2 text-xs">
            <span className="whitespace-nowrap text-[var(--muted-foreground)]">
              {yesterdayRequests > 0
                ? (() => {
                    const diff = ((todayRequests - yesterdayRequests) / yesterdayRequests) * 100
                    const arrow = diff >= 0 ? '↑' : '↓'
                    const cls = diff >= 0 ? 'text-green-400' : 'text-rose-400'
                    return <><span className={cls}>{arrow}{Math.abs(diff).toFixed(0)}%</span></>
                  })()
                : '-'}
            </span>
            {recentDays.map((d, i) => (
              <span key={i} className="flex items-baseline gap-x-2">
                <span className="text-[var(--border)]">|</span>
                <span className="whitespace-nowrap font-mono text-[var(--muted-foreground)]">
                  <span className="opacity-60">{d.label}</span>{' '}
                  <span>{d.requests}</span>
                </span>
              </span>
            ))}
          </div>
        }
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
            <span className="font-mono font-semibold text-green-500">{recent.length}</span>
          </div>
        }
        color="text-rose-500"
        tooltip="最近5小时的输入+输出+缓存 Token 合计"
      />
      <StatCard
        label="近24小时"
        value={fmtK(todayTotal)}
        subtextNode={
          <div className="flex items-baseline gap-x-2 text-xs">
            <span className="whitespace-nowrap text-[var(--muted-foreground)]">
              {yesterdayTotal > 0
                ? (() => {
                    const diff = ((todayTotal - yesterdayTotal) / yesterdayTotal) * 100
                    const arrow = diff >= 0 ? '↑' : '↓'
                    const cls = diff >= 0 ? 'text-green-400' : 'text-rose-400'
                    return <><span className={cls}>{arrow}{Math.abs(diff).toFixed(0)}%</span></>
                  })()
                : '-'}
            </span>
            <span className="text-[var(--border)]">|</span>
            {recentDays.map((d, i) => (
              <span key={i} className="flex items-baseline gap-x-2">
                <span className="text-[var(--border)]">|</span>
                <span className="whitespace-nowrap font-mono text-[var(--muted-foreground)]">
                  <span className="opacity-60">{d.label}</span>{' '}
                  <span>{fmtK(d.total)}</span>
                </span>
              </span>
            ))}
          </div>
        }
        color="text-orange-500"
        tooltip="最近24小时输入+输出+缓存 Token 合计"
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
    </>
  )
}
