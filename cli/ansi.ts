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

const SPARK_CHARS = '▁▂▃▄▅▆▇█'

/** Render a sparkline with time-based gradient coloring. */
export function sparkline(values: number[], width: number): string {
  if (values.length === 0) return dim('▁'.repeat(width))
  const resampled: number[] = []
  for (let i = 0; i < width; i++) {
    const idx = Math.floor((i / width) * values.length)
    resampled.push(values[Math.min(idx, values.length - 1)])
  }
  const max = Math.max(...resampled, 1)
  const gradientColors = [dim, dim, blue, blue, magenta, magenta, cyan, cyan, green, green]
  return resampled
    .map((v, i) => {
      const charIdx = Math.min(
        Math.floor((v / max) * (SPARK_CHARS.length - 1)),
        SPARK_CHARS.length - 1,
      )
      const colorIdx = Math.floor((i / resampled.length) * gradientColors.length)
      const colorFn = gradientColors[Math.min(colorIdx, gradientColors.length - 1)]
      return v === 0 ? dim(SPARK_CHARS[0]) : colorFn(SPARK_CHARS[charIdx])
    })
    .join('')
}

// --- Box drawing helpers ---

/** Top border with embedded title: ┌ Title ──────── value ┐ */
export function borderTop(width: number, left: string, right: string): string {
  const leftLen = visibleLen(left)
  const rightLen = visibleLen(right)
  const fill = width - 2 - leftLen - rightLen - 2 // 2 for ┌┐, 2 for spaces around fill
  return dim('┌') + ' ' + left + ' ' + dim('─'.repeat(Math.max(fill, 1))) + ' ' + right + dim(' ┐')
}

/** Bottom border with embedded text: └─ text ──────────────┘ */
export function borderBottom(width: number, text: string): string {
  const textLen = visibleLen(text)
  const fill = width - 2 - textLen - 3 // 2 for └┘, 3 for ─ + spaces
  return dim('└─') + ' ' + text + ' ' + dim('─'.repeat(Math.max(fill, 1)) + '┘')
}

/** Mid separator with label: ├ Label ───────┬─────────────┤ */
export function borderMid(width: number, left: string, right: string, hasSplit: boolean): string {
  const leftLen = visibleLen(left)
  const rightLen = visibleLen(right)
  if (hasSplit) {
    const leftW = leftLen + 2
    const rightW = rightLen + 2
    const totalFill = width - 2 - leftW - rightW - 1 // -1 for ┬
    const leftFill = Math.floor(totalFill / 2)
    const rightFill = totalFill - leftFill
    return (
      dim('├') + ' ' + left + ' ' + dim('─'.repeat(Math.max(leftFill, 0))) +
      dim('┬') + ' ' + right + ' ' + dim('─'.repeat(Math.max(rightFill, 0)) + '┤')
    )
  }
  const fill = width - 2 - leftLen - rightLen - 3
  return dim('├') + ' ' + left + ' ' + dim('─'.repeat(Math.max(fill, 1))) + ' ' + right + dim(' ┤')
}

/** Full-width mid separator: ├──────────────┴──────────────┤ */
export function borderMidFull(width: number, splitPos?: number): string {
  if (splitPos !== undefined) {
    return dim('├' + '─'.repeat(splitPos) + '┴' + '─'.repeat(width - 2 - splitPos - 1) + '┤')
  }
  return dim('├' + '─'.repeat(width - 2) + '┤')
}

/** Row with left border: │ content                     │ */
export function row(content: string, width: number): string {
  return dim('│') + ' ' + padRight(content, width - 4) + ' ' + dim('│')
}

/** Row with mid split: │ left      │ right             │ */
export function rowSplit(
  left: string,
  right: string,
  leftWidth: number,
  totalWidth: number,
): string {
  // leftWidth includes left │ + space, rightWidth includes right space + │
  // │ <left pad to lw-2> │ <right pad to rw-2> │
  const rightInner = totalWidth - leftWidth - 3 // subtract │ + space + │
  return (
    dim('│') + ' ' + padRight(left, leftWidth - 2) +
    dim('│') + ' ' + padRight(right, rightInner) + dim('│')
  )
}
