// Dashboard section renderers — each returns an array of plain strings (with ANSI codes)
import type { TokenRecord, ModelSummary, SessionSummary, HourBucket } from '../src/types/data'
import type { ModelPricingConfig } from '../src/types/ipc'
import { getModelPricing } from '../src/lib/constants'
import { fmtK, fmtDuration } from '../src/lib/format'
import { bold, dim, cyan, green, red, magenta, blue, yellow, padRight, padLeft, truncate, progressBar, sparkline } from './ansi'

// --- Header ---

export function renderHeader(now: Date): string[] {
  const ts = now.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  return [bold('CC Monitor CLI') + dim('  ' + ts)]
}

// --- Stats + comparison ---

interface StatValues {
  input: number
  output: number
  cacheRead: number
  requests: number
  cost: number
  activeMs: number
}

function computeStats(records: TokenRecord[], pricing: ModelPricingConfig[]): StatValues {
  let input = 0, output = 0, cacheRead = 0, cost = 0
  for (const r of records) {
    input += r.inputTokens
    output += r.outputTokens
    cacheRead += r.cacheReadTokens
    const p = getModelPricing(r.model, pricing)
    cost +=
      (r.inputTokens / 1_000_000) * p.input +
      (r.outputTokens / 1_000_000) * p.output +
      (r.cacheReadTokens / 1_000_000) * p.cacheRead
  }

  // Active duration: sum segments where gap <= 15min
  const ACTIVE_GAP_MS = 15 * 60 * 1000
  const timestamps = records.map((r) => r.timestamp.getTime()).sort((a, b) => a - b)
  let activeMs = 0
  for (let i = 1; i < timestamps.length; i++) {
    const gap = timestamps[i] - timestamps[i - 1]
    if (gap <= ACTIVE_GAP_MS) activeMs += gap
  }

  return { input, output, cacheRead, requests: records.length, cost, activeMs }
}

function fmtChange(curr: number, prev: number): string {
  if (prev === 0) return ''
  const pct = ((curr - prev) / prev) * 100
  if (Math.abs(pct) < 0.5) return ''
  const sign = pct > 0 ? '↑' : '↓'
  const color = pct > 0 ? green : red
  return color(`${sign}${Math.abs(pct).toFixed(1)}%`)
}

export function renderStats(records: TokenRecord[], pricing: ModelPricingConfig[]): string[] {
  const all = computeStats(records, pricing)

  // Split records into two halves by time for comparison
  const sorted = [...records].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
  let prevStats: StatValues | null = null
  if (sorted.length >= 4) {
    const mid = Math.floor(sorted.length / 2)
    prevStats = computeStats(sorted.slice(0, mid), pricing)
  }
  const currHalf = prevStats ? computeStats(sorted.slice(Math.floor(sorted.length / 2)), pricing) : null

  const cols = [
    { label: 'INPUT', value: cyan(bold(fmtK(all.input))), change: currHalf && prevStats ? fmtChange(currHalf.input, prevStats.input) : '' },
    { label: 'OUTPUT', value: magenta(bold(fmtK(all.output))), change: currHalf && prevStats ? fmtChange(currHalf.output, prevStats.output) : '' },
    { label: 'CACHE RD', value: cyan(bold(fmtK(all.cacheRead))), change: currHalf && prevStats ? fmtChange(currHalf.cacheRead, prevStats.cacheRead) : '' },
    { label: 'REQUESTS', value: green(bold(String(all.requests))), change: currHalf && prevStats ? fmtChange(currHalf.requests, prevStats.requests) : '' },
    { label: 'COST', value: yellow(bold(`$${all.cost.toFixed(2)}`)), change: currHalf && prevStats ? fmtChange(currHalf.cost, prevStats.cost) : '' },
    { label: 'ACTIVE', value: bold(fmtDuration(all.activeMs)), change: '' },
  ]

  const colWidth = 12
  const labelLine = cols.map((c) => padRight(dim(c.label), colWidth)).join('')
  const valueLine = cols.map((c) => padRight(c.value, colWidth)).join('')
  const changeLine = cols.map((c) => padRight(c.change, colWidth)).join('')

  const lines = [labelLine, valueLine]
  if (cols.some((c) => c.change !== '')) {
    lines.push(changeLine)
  }
  return lines
}

// --- Model breakdown ---

const MODEL_COLORS = [cyan, magenta, blue, green, yellow, red]

export function renderModels(summaries: ModelSummary[]): string[] {
  const lines: string[] = [dim('MODEL BREAKDOWN')]
  const top = summaries.slice(0, 6)
  for (let i = 0; i < top.length; i++) {
    const m = top[i]
    const colorFn = MODEL_COLORS[i % MODEL_COLORS.length]
    const name = truncate(m.model, 26)
    const pct = `${m.percentage.toFixed(0)}%`
    const bar = colorFn(progressBar(m.percentage / 100, 20))
    const req = `${m.requestCount} req`
    lines.push(`${padRight(name, 28)} ${padLeft(pct, 4)}  ${bar}  ${padLeft(req, 7)}`)
  }
  return lines
}

// --- Recent sessions ---

export function renderSessions(summaries: SessionSummary[], maxRows = 5): string[] {
  const lines: string[] = [dim('RECENT SESSIONS')]
  const top = summaries
    .filter((s) => !s.isSubagent)
    .sort((a, b) => b.lastTimestamp.getTime() - a.lastTimestamp.getTime())
    .slice(0, maxRows)

  for (let i = 0; i < top.length; i++) {
    const s = top[i]
    const num = dim(`#${i + 1}`)
    const title = truncate(`"${s.firstUserMessage}"`, 36)
    const dur = fmtDuration(s.lastTimestamp.getTime() - s.firstTimestamp.getTime())
    // Short model name: claude-opus-4-6 → Opus
    const modelShort = (() => {
      const m = s.models[0] || 'unknown'
      if (m.includes('opus')) return 'Opus'
      if (m.includes('sonnet')) return 'Sonnet'
      if (m.includes('haiku')) return 'Haiku'
      return truncate(m, 8)
    })()
    const tokens = fmtK(s.totalInput + s.totalOutput + s.totalCacheRead)
    lines.push(
      `${padRight(num, 4)} ${padRight(title, 38)} ${padLeft(dur, 6)}  ${padRight(modelShort, 7)} ${padLeft(tokens, 6)}`,
    )
  }

  if (top.length === 0) {
    lines.push(dim('  No sessions found'))
  }
  return lines
}

// --- Sparkline ---

export function renderSparkline(buckets: HourBucket[]): string[] {
  const values = buckets.map((b) => b.input + b.output + b.cacheRead)
  const chart = sparkline(values, 30)
  return [cyan(chart) + dim('  last 5h token volume')]
}
