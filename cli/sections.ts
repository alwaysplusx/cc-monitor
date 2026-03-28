// Dashboard section renderers — dual-column bordered layout
import type { TokenRecord, SessionSummary, HourBucket } from '../src/types/data'
import type { ModelPricingConfig } from '../src/types/ipc'
import { getModelPricing } from '../src/lib/constants'
import { fmtK, fmtDuration } from '../src/lib/format'
import {
  bold, dim, cyan, green, yellow, magenta,
  padRight, padLeft, truncate, sparkline,
  borderTop, borderBottom, borderMid, borderMidFull,
  row, rowSplit,
} from './ansi'

// --- Stats computation ---

export interface StatValues {
  input: number
  output: number
  cacheRead: number
  requests: number
  cost: number
  activeMs: number
}

export function computeStats(records: TokenRecord[], pricing: ModelPricingConfig[]): StatValues {
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

  const ACTIVE_GAP_MS = 15 * 60 * 1000
  const timestamps = records.map((r) => r.timestamp.getTime()).sort((a, b) => a - b)
  let activeMs = 0
  for (let i = 1; i < timestamps.length; i++) {
    const gap = timestamps[i] - timestamps[i - 1]
    if (gap <= ACTIVE_GAP_MS) activeMs += gap
  }

  return { input, output, cacheRead, requests: records.length, cost, activeMs }
}

// --- Build stat rows for left column ---

export function statLines(stats: StatValues): string[] {
  return [
    dim('IN  ') + padRight(cyan(bold(fmtK(stats.input))), 9) + dim('CACHE ') + cyan(bold(fmtK(stats.cacheRead))),
    dim('OUT ') + padRight(magenta(bold(fmtK(stats.output))), 9) + dim('REQ   ') + green(bold(String(stats.requests))),
    dim('ACT ') + bold(fmtDuration(stats.activeMs)),
  ]
}

// --- Build session rows for right column ---

export function sessionLines(summaries: SessionSummary[], maxWidth: number, maxRows: number): string[] {
  const top = summaries
    .filter((s) => !s.isSubagent)
    .sort((a, b) => b.lastTimestamp.getTime() - a.lastTimestamp.getTime())
    .slice(0, maxRows)

  if (top.length === 0) return [dim('No sessions')]

  const titleW = Math.max(maxWidth - 14, 8)
  return top.map((s) => {
    const title = truncate(s.firstUserMessage, titleW)
    const dur = fmtDuration(s.lastTimestamp.getTime() - s.firstTimestamp.getTime())
    const tokens = fmtK(s.totalInput + s.totalOutput + s.totalCacheRead)
    return dim('▸ ') + padRight(title, titleW) + padLeft(dim(dur), 5) + padLeft(tokens, 6)
  })
}

// --- Tab bar ---

export function tabBar(ranges: string[], activeIndex: number): string {
  return ranges
    .map((r, i) => (i === activeIndex ? cyan(bold(r)) : dim(r)))
    .join(dim(' │ '))
}

// --- Full dashboard assembly ---

export interface DashboardInput {
  stats: StatValues
  sessions: SessionSummary[]
  buckets: HourBucket[]
  ranges: string[]
  activeRangeIndex: number
  rangeLabel: string
  now: Date
}

export function buildDashboard(input: DashboardInput, termWidth: number): string {
  const W = Math.min(Math.max(termWidth, 40), 65)
  const leftW = 22
  const { stats, sessions, buckets, ranges, activeRangeIndex, rangeLabel, now } = input

  const ts = now.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })

  // Header
  const title = bold('CC Monitor') + dim('  ' + ts)
  const cost = yellow(bold(`$${stats.cost.toFixed(2)}`))
  const lines: string[] = [borderTop(W, title, cost)]

  // Tab bar
  lines.push(row(tabBar(ranges, activeRangeIndex), W))

  // Mid separator with dual column labels
  lines.push(borderMid(W, dim('Stats'), dim('Sessions'), true))

  // Dual column: stats left, sessions right
  const sLines = statLines(stats)
  const rightInner = W - leftW - 3 // inner width of right column
  const sessLines = sessionLines(sessions, rightInner, Math.max(sLines.length, 4))

  const rowCount = Math.max(sLines.length, sessLines.length)
  for (let i = 0; i < rowCount; i++) {
    const left = sLines[i] || ''
    const right = sessLines[i] || ''
    lines.push(rowSplit(left, right, leftW, W))
  }

  // Merge separator
  lines.push(borderMidFull(W, leftW))

  // Sparkline row
  const values = buckets.map((b) => b.input + b.output + b.cacheRead)
  const chartW = Math.max(W - 8, 10)
  const chart = sparkline(values, chartW)
  lines.push(row(chart + dim(` ${rangeLabel}`), W))

  // Bottom border with keybindings
  lines.push(borderBottom(W, dim('tab range · r refresh · q quit')))

  return lines.join('\n')
}
