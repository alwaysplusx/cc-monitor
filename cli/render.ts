// Assemble all dashboard sections into a complete terminal frame
import type { TokenRecord, ModelSummary, SessionSummary, HourBucket } from '../src/types/data'
import type { ModelPricingConfig } from '../src/types/ipc'
import { box } from './ansi'
import { renderHeader, renderStats, renderModels, renderSessions, renderSparkline } from './sections'

export interface DashboardData {
  records: TokenRecord[]
  modelSummaries: ModelSummary[]
  sessionSummaries: SessionSummary[]
  hourBuckets: HourBucket[]
  pricing: ModelPricingConfig[]
}

/** Build the full dashboard string for one render cycle. */
export function renderDashboard(data: DashboardData, termWidth: number): string {
  const innerWidth = Math.min(termWidth - 2, 78) // 2 for box borders

  const sections = [
    renderHeader(new Date()),
    renderStats(data.records, data.pricing),
    renderModels(data.modelSummaries),
    renderSessions(data.sessionSummaries),
    renderSparkline(data.hourBuckets),
  ]

  const lines = box(sections, innerWidth)
  // Footer outside the box
  lines.push('  5s auto-refresh │ q quit │ r refresh')

  return lines.join('\n')
}
