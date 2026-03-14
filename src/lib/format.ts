// Number formatting utilities for token display

/**
 * Format large numbers: >1M → '1.2M', >1K → '45.3K', else raw number.
 */
export function fmtK(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toString()
}

/**
 * Format a number with comma separators.
 */
export function fmtN(n: number): string {
  return n.toLocaleString('en-US')
}

/**
 * Format duration in milliseconds to human-readable string.
 */
export function fmtDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  const seconds = ms / 1000
  if (seconds < 60) return `${seconds.toFixed(1)}s`
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = Math.floor(seconds % 60)
  return `${minutes}m${remainingSeconds}s`
}
