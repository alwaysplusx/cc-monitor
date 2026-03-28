// CLI dashboard entry point — terminal token monitor for Claude Code
import { homedir } from 'os'
import { join } from 'path'
import { existsSync } from 'fs'
import { FileCache } from '../electron/services/cache'
import { aggregateBySession, aggregateByHour } from '../electron/services/aggregator'
import { renderDashboard } from './render'
import type { ModelPricingConfig } from '../src/types/ipc'

// --- Default pricing ---
const DEFAULT_PRICING: ModelPricingConfig[] = [
  { match: 'opus', input: 15, output: 75, cacheRead: 1.5 },
  { match: 'sonnet', input: 3, output: 15, cacheRead: 0.3 },
  { match: 'haiku', input: 1, output: 5, cacheRead: 0.1 },
]

// --- Time ranges ---
const TIME_RANGES = [
  { label: '10m', ms: 10 * 60 * 1000 },
  { label: '30m', ms: 30 * 60 * 1000 },
  { label: '1h', ms: 60 * 60 * 1000 },
  { label: '3h', ms: 3 * 60 * 60 * 1000 },
  { label: '5h', ms: 5 * 60 * 60 * 1000 },
]
let rangeIndex = 4 // default: 5h

// --- Args parsing ---
const args = process.argv.slice(2)
let intervalMs = 5000
let projectFilter = ''
let showAll = false

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--interval' && args[i + 1]) {
    intervalMs = parseInt(args[i + 1], 10) * 1000
    i++
  } else if (args[i] === '--project' && args[i + 1]) {
    projectFilter = args[i + 1]
    i++
  } else if (args[i] === '--all') {
    showAll = true
  } else if (args[i] === '--help' || args[i] === '-h') {
    console.log(`cc-dash — Claude Code token monitor

Usage: cc-dash [options]

Options:
  --interval <seconds>  Refresh interval (default: 5)
  --project <path>      Filter to specific project directory
  --all                 Show all projects (default: current cwd only)
  -h, --help            Show this help

Keys:
  Tab     Cycle time range (10m/30m/1h/3h/5h)
  r       Force refresh
  q       Quit
`)
    process.exit(0)
  }
}

// --- Map cwd to .claude/projects/ path ---
function cwdToProjectDir(): string {
  const cwd = projectFilter || process.cwd()
  const claudeProjectsDir = join(homedir(), '.claude', 'projects')

  // Claude Code encodes paths: /home/user/project → -home-user-project
  const encoded = cwd.replace(/\//g, '-')
  return join(claudeProjectsDir, encoded)
}

// --- Main loop ---
const cache = new FileCache()

function getTermWidth(): number {
  return process.stdout.columns || 80
}

function loadAndRender(): void {
  const projectDir = showAll
    ? join(homedir(), '.claude', 'projects')
    : cwdToProjectDir()

  if (!existsSync(projectDir)) {
    process.stdout.write(
      `\x1b[H\x1b[2J\x1b[33mNo Claude Code data found for:\x1b[0m\n${projectDir}\n\nMake sure Claude Code has been used in this directory.\n`,
    )
    return
  }

  cache.loadProjectFiles(projectDir)
  const allRecords = cache.getAllRecords()
  const userMessages = cache.getUserMessages()

  const range = TIME_RANGES[rangeIndex]
  const cutoff = Date.now() - range.ms
  const records = allRecords.filter((r) => r.timestamp.getTime() >= cutoff)

  const sessionSummaries = aggregateBySession(records, userMessages)
  const hourBuckets = aggregateByHour(records)

  const output = renderDashboard(
    {
      records,
      sessionSummaries,
      hourBuckets,
      pricing: DEFAULT_PRICING,
      rangeLabel: range.label,
      ranges: TIME_RANGES.map((r) => r.label),
      activeRangeIndex: rangeIndex,
    },
    getTermWidth(),
  )

  // Cursor home + clear each line to avoid flicker
  process.stdout.write('\x1b[H' + output.split('\n').map((l) => l + '\x1b[K').join('\n') + '\x1b[J')
}

// --- Enter alternate screen, set up input, start loop ---

// Alternate screen buffer
process.stdout.write('\x1b[?1049h')
// Hide cursor
process.stdout.write('\x1b[?25l')

// Initial render
loadAndRender()

// Auto-refresh
const timer = setInterval(loadAndRender, intervalMs)

// Keyboard input
if (process.stdin.isTTY) {
  process.stdin.setRawMode(true)
  process.stdin.resume()
  process.stdin.setEncoding('utf8')
  process.stdin.on('data', (key: string) => {
    if (key === 'q' || key === '\x03') {
      cleanup()
    } else if (key === 'r') {
      cache.clear()
      loadAndRender()
    } else if (key === '\t') {
      rangeIndex = (rangeIndex + 1) % TIME_RANGES.length
      loadAndRender()
    }
  })
}

function cleanup(): void {
  clearInterval(timer)
  // Show cursor
  process.stdout.write('\x1b[?25h')
  // Leave alternate screen
  process.stdout.write('\x1b[?1049l')
  process.exit(0)
}

// Handle SIGINT/SIGTERM gracefully
process.on('SIGINT', cleanup)
process.on('SIGTERM', cleanup)
