// Plan token limits and color constants

export const PLAN_LIMITS: Record<string, number> = {
  pro: 44000,
  max5: 88000,
  max20: 220000,
}

export const WINDOW_DURATION_MS = 5 * 60 * 60 * 1000 // 5 hours

export const CHART_COLORS = {
  input: '#3b82f6', // blue
  output: '#8b5cf6', // purple
  cacheRead: '#06b6d4', // cyan
  green: '#10b981',
}

export type TimeView = 'hour' | 'day' | 'month'
