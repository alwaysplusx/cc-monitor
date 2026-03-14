// Data aggregation: minute/hour/day/model/session bucketing and window usage
import type {
  TokenRecord,
  MinuteBucket,
  HourBucket,
  DayBucket,
  MonthBucket,
  ModelSummary,
  SessionSummary,
  ModelSwitch,
  WindowUsage,
} from '../../src/types/data'

function filterByTimeRange(
  records: TokenRecord[],
  start?: Date,
  end?: Date,
): TokenRecord[] {
  return records.filter((r) => {
    if (start && r.timestamp < start) return false
    if (end && r.timestamp > end) return false
    return true
  })
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`
}

function formatMinute(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function formatHour(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}`
}

function formatDay(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function formatMonth(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
}

/**
 * Aggregate records by minute.
 */
export function aggregateByMinute(
  records: TokenRecord[],
  start?: Date,
  end?: Date,
): MinuteBucket[] {
  const filtered = filterByTimeRange(records, start, end)
  const bucketMap = new Map<string, MinuteBucket>()

  for (const r of filtered) {
    const key = formatMinute(r.timestamp)
    const bucket = bucketMap.get(key) ?? {
      minute: key,
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheCreate: 0,
      requestCount: 0,
    }
    bucket.input += r.inputTokens
    bucket.output += r.outputTokens
    bucket.cacheRead += r.cacheReadTokens
    bucket.cacheCreate += r.cacheCreateTokens
    bucket.requestCount += 1
    bucketMap.set(key, bucket)
  }

  return Array.from(bucketMap.values()).sort((a, b) => a.minute.localeCompare(b.minute))
}

/**
 * Aggregate records by hour.
 */
export function aggregateByHour(
  records: TokenRecord[],
  start?: Date,
  end?: Date,
): HourBucket[] {
  const filtered = filterByTimeRange(records, start, end)
  const bucketMap = new Map<string, HourBucket>()

  for (const r of filtered) {
    const key = formatHour(r.timestamp)
    const bucket = bucketMap.get(key) ?? {
      hour: key,
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheCreate: 0,
      requestCount: 0,
    }
    bucket.input += r.inputTokens
    bucket.output += r.outputTokens
    bucket.cacheRead += r.cacheReadTokens
    bucket.cacheCreate += r.cacheCreateTokens
    bucket.requestCount += 1
    bucketMap.set(key, bucket)
  }

  return Array.from(bucketMap.values()).sort((a, b) => a.hour.localeCompare(b.hour))
}

/**
 * Aggregate records by day. Fills gaps so every day from first to last is present.
 */
export function aggregateByDay(
  records: TokenRecord[],
  start?: Date,
  end?: Date,
): DayBucket[] {
  const filtered = filterByTimeRange(records, start, end)
  const bucketMap = new Map<string, DayBucket>()

  for (const r of filtered) {
    const key = formatDay(r.timestamp)
    const bucket = bucketMap.get(key) ?? {
      day: key,
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheCreate: 0,
      requestCount: 0,
    }
    bucket.input += r.inputTokens
    bucket.output += r.outputTokens
    bucket.cacheRead += r.cacheReadTokens
    bucket.cacheCreate += r.cacheCreateTokens
    bucket.requestCount += 1
    bucketMap.set(key, bucket)
  }

  // Fill gaps: every day from first to last
  if (bucketMap.size > 0) {
    const keys = Array.from(bucketMap.keys()).sort()
    const cursor = new Date(keys[0] + 'T00:00:00')
    const endDate = new Date(keys[keys.length - 1] + 'T00:00:00')
    while (cursor <= endDate) {
      const key = formatDay(cursor)
      if (!bucketMap.has(key)) {
        bucketMap.set(key, { day: key, input: 0, output: 0, cacheRead: 0, cacheCreate: 0, requestCount: 0 })
      }
      cursor.setDate(cursor.getDate() + 1)
    }
  }

  return Array.from(bucketMap.values()).sort((a, b) => a.day.localeCompare(b.day))
}

/**
 * Aggregate records by month.
 */
export function aggregateByMonth(
  records: TokenRecord[],
): MonthBucket[] {
  const bucketMap = new Map<string, MonthBucket>()

  for (const r of records) {
    const key = formatMonth(r.timestamp)
    const bucket = bucketMap.get(key) ?? {
      month: key,
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheCreate: 0,
      requestCount: 0,
    }
    bucket.input += r.inputTokens
    bucket.output += r.outputTokens
    bucket.cacheRead += r.cacheReadTokens
    bucket.cacheCreate += r.cacheCreateTokens
    bucket.requestCount += 1
    bucketMap.set(key, bucket)
  }

  return Array.from(bucketMap.values()).sort((a, b) => a.month.localeCompare(b.month))
}

/**
 * Aggregate records by model with percentage calculation.
 */
export function aggregateByModel(records: TokenRecord[]): ModelSummary[] {
  const modelMap = new Map<string, Omit<ModelSummary, 'percentage'>>()

  for (const r of records) {
    const existing = modelMap.get(r.model) ?? {
      model: r.model,
      totalInput: 0,
      totalOutput: 0,
      totalCacheRead: 0,
      requestCount: 0,
    }
    existing.totalInput += r.inputTokens
    existing.totalOutput += r.outputTokens
    existing.totalCacheRead += r.cacheReadTokens
    existing.requestCount += 1
    modelMap.set(r.model, existing)
  }

  const totalTokens = Array.from(modelMap.values()).reduce(
    (sum, m) => sum + m.totalInput + m.totalOutput,
    0,
  )

  return Array.from(modelMap.values())
    .map((m) => ({
      ...m,
      percentage: totalTokens > 0 ? ((m.totalInput + m.totalOutput) / totalTokens) * 100 : 0,
    }))
    .sort((a, b) => b.percentage - a.percentage)
}

/**
 * Aggregate records by session (and subagent).
 */
export function aggregateBySession(
  records: TokenRecord[],
  userMessages: Map<string, string>,
): SessionSummary[] {
  // Group by sessionId + agentId
  const groupMap = new Map<string, TokenRecord[]>()

  for (const r of records) {
    const key = r.isSubagent ? `${r.sessionId}:${r.agentId}` : r.sessionId
    const group = groupMap.get(key) ?? []
    group.push(r)
    groupMap.set(key, group)
  }

  const summaries: SessionSummary[] = []

  for (const [key, group] of groupMap) {
    const sorted = group.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
    const first = sorted[0]
    const last = sorted[sorted.length - 1]

    summaries.push({
      id: key,
      sessionId: first.sessionId,
      isSubagent: first.isSubagent,
      agentId: first.agentId,
      model: first.model,
      firstTimestamp: first.timestamp,
      lastTimestamp: last.timestamp,
      firstUserMessage: userMessages.get(first.sessionId) || first.sessionId.slice(0, 12),
      totalInput: group.reduce((s, r) => s + r.inputTokens, 0),
      totalOutput: group.reduce((s, r) => s + r.outputTokens, 0),
      totalCacheRead: group.reduce((s, r) => s + r.cacheReadTokens, 0),
      requestCount: group.length,
    })
  }

  return summaries.sort((a, b) => b.firstTimestamp.getTime() - a.firstTimestamp.getTime())
}

/**
 * Detect model switch events from chronologically ordered records.
 */
export function detectModelSwitches(records: TokenRecord[]): ModelSwitch[] {
  const sorted = [...records].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
  const switches: ModelSwitch[] = []

  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].model !== sorted[i - 1].model) {
      switches.push({
        timestamp: sorted[i].timestamp,
        fromModel: sorted[i - 1].model,
        toModel: sorted[i].model,
      })
    }
  }

  return switches
}

/**
 * Calculate token usage within a sliding time window.
 */
export function calculateWindowUsage(
  records: TokenRecord[],
  windowStart: Date,
  windowDurationMs: number,
  planLimit: number,
): WindowUsage {
  const windowEnd = new Date(windowStart.getTime() + windowDurationMs)
  const now = new Date()
  const isExpired = now > windowEnd

  const inWindow = records.filter(
    (r) => r.timestamp >= windowStart && r.timestamp <= windowEnd,
  )

  const used = inWindow.reduce((s, r) => s + r.inputTokens + r.outputTokens, 0)

  return {
    used,
    limit: planLimit,
    percentage: planLimit > 0 ? (used / planLimit) * 100 : 0,
    isExpired,
  }
}
