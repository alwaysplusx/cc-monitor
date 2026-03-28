// Assemble dashboard data and delegate to sections for rendering
import type { TokenRecord, SessionSummary, HourBucket } from '../src/types/data'
import type { ModelPricingConfig } from '../src/types/ipc'
import { computeStats, buildDashboard } from './sections'

export interface DashboardData {
  records: TokenRecord[]
  sessionSummaries: SessionSummary[]
  hourBuckets: HourBucket[]
  pricing: ModelPricingConfig[]
  rangeLabel: string
  ranges: string[]
  activeRangeIndex: number
}

/** Build the full dashboard string for one render cycle. */
export function renderDashboard(data: DashboardData, termWidth: number): string {
  const stats = computeStats(data.records, data.pricing)
  return buildDashboard(
    {
      stats,
      sessions: data.sessionSummaries,
      buckets: data.hourBuckets,
      ranges: data.ranges,
      activeRangeIndex: data.activeRangeIndex,
      rangeLabel: data.rangeLabel,
      now: new Date(),
    },
    termWidth,
  )
}
