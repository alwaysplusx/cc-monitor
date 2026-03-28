// ANSI escape code utilities for terminal rendering
// Zero dependencies — uses only built-in Unicode and escape sequences

// --- Colors & styles ---
export const bold = (s: string) => `\x1b[1m${s}\x1b[22m`
export const dim = (s: string) => `\x1b[2m${s}\x1b[22m`
export const cyan = (s: string) => `\x1b[36m${s}\x1b[39m`
export const green = (s: string) => `\x1b[32m${s}\x1b[39m`
export const red = (s: string) => `\x1b[31m${s}\x1b[39m`
export const yellow = (s: string) => `\x1b[33m${s}\x1b[39m`
export const magenta = (s: string) => `\x1b[35m${s}\x1b[39m`
export const blue = (s: string) => `\x1b[34m${s}\x1b[39m`
export const reset = '\x1b[0m'

// --- ANSI-aware string helpers ---

const ANSI_RE = /\x1b\[[0-9;]*m/g

/** Strip ANSI escape codes to get visible character count. */
export function stripAnsi(s: string): string {
  return s.replace(ANSI_RE, '')
}

/** Check if a character is a wide (CJK) character that takes 2 columns. */
function isWide(code: number): boolean {
  return (
    (code >= 0x1100 && code <= 0x115f) || // Hangul Jamo
    (code >= 0x2e80 && code <= 0x303e) || // CJK Radicals
    (code >= 0x3040 && code <= 0x33bf) || // Japanese, CJK Compatibility
    (code >= 0x3400 && code <= 0x4dbf) || // CJK Unified Ext A
    (code >= 0x4e00 && code <= 0xa4cf) || // CJK Unified
    (code >= 0xac00 && code <= 0xd7af) || // Hangul Syllables
    (code >= 0xf900 && code <= 0xfaff) || // CJK Compatibility Ideographs
    (code >= 0xfe30 && code <= 0xfe6f) || // CJK Compatibility Forms
    (code >= 0xff01 && code <= 0xff60) || // Fullwidth Forms
    (code >= 0xffe0 && code <= 0xffe6) || // Fullwidth Signs
    (code >= 0x20000 && code <= 0x2fffd) // CJK Unified Ext B+
  )
}

/** Visible width of a string (ignoring ANSI codes, accounting for CJK). */
export function visibleLen(s: string): number {
  const plain = stripAnsi(s)
  let width = 0
  for (let i = 0; i < plain.length; i++) {
    const code = plain.codePointAt(i)!
    if (code > 0xffff) i++ // skip surrogate pair
    width += isWide(code) ? 2 : 1
  }
  return width
}

/** Pad string to `len` visible characters on the right. */
export function padRight(s: string, len: number): string {
  const diff = len - visibleLen(s)
  return diff > 0 ? s + ' '.repeat(diff) : s
}

/** Pad string to `len` visible characters on the left. */
export function padLeft(s: string, len: number): string {
  const diff = len - visibleLen(s)
  return diff > 0 ? ' '.repeat(diff) + s : s
}

/** Truncate to `maxLen` visible columns, adding … if truncated. */
export function truncate(s: string, maxLen: number): string {
  const plain = stripAnsi(s)
  if (visibleLen(s) <= maxLen) return s
  let width = 0
  let result = ''
  for (let i = 0; i < plain.length; i++) {
    const code = plain.codePointAt(i)!
    if (code > 0xffff) i++ // skip surrogate pair
    const charWidth = isWide(code) ? 2 : 1
    if (width + charWidth + 1 > maxLen) break // +1 for …
    result += String.fromCodePoint(code)
    width += charWidth
  }
  return result + '…'
}

// --- Visual elements ---

const BAR_FULL = '█'
const BAR_EMPTY = '░'

/** Render a progress bar like ████████░░░░ */
export function progressBar(ratio: number, width: number): string {
  const clamped = Math.max(0, Math.min(1, ratio))
  const filled = Math.round(clamped * width)
  return BAR_FULL.repeat(filled) + BAR_EMPTY.repeat(width - filled)
}

const SPARK_CHARS = '▁▂▃▄▅▆▇█'

/** Render a sparkline from numeric values. */
export function sparkline(values: number[], width: number): string {
  if (values.length === 0) return ' '.repeat(width)
  // Resample to fit width
  const resampled: number[] = []
  for (let i = 0; i < width; i++) {
    const idx = Math.floor((i / width) * values.length)
    resampled.push(values[Math.min(idx, values.length - 1)])
  }
  const max = Math.max(...resampled, 1)
  return resampled
    .map((v) => {
      const idx = Math.min(Math.floor((v / max) * (SPARK_CHARS.length - 1)), SPARK_CHARS.length - 1)
      return SPARK_CHARS[idx]
    })
    .join('')
}

// --- Box drawing ---

/** Wrap lines in a Unicode box-drawing frame of given inner width. */
export function box(sections: string[][], innerWidth: number): string[] {
  const top = '┌' + '─'.repeat(innerWidth) + '┐'
  const sep = '├' + '─'.repeat(innerWidth) + '┤'
  const bot = '└' + '─'.repeat(innerWidth) + '┘'

  const result: string[] = [top]
  for (let si = 0; si < sections.length; si++) {
    if (si > 0) result.push(sep)
    for (const line of sections[si]) {
      const padded = padRight(line, innerWidth - 4)
      result.push(`│  ${padded}  │`)
    }
  }
  result.push(bot)
  return result
}
