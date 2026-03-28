// CLI dashboard entry point — terminal token monitor for Claude Code
import { homedir } from 'os'
import { join, sep } from 'path'
import { existsSync } from 'fs'
import { FileCache } from '../electron/services/cache'
import { aggregateByModel, aggregateBySession, aggregateByHour } from '../electron/services/aggregator'
import { renderDashboard } from './render'
import type { ModelPricingConfig } from '../src/types/ipc'

// --- Default pricing ---
const DEFAULT_PRICING: ModelPricingConfig[] = [
  { match: 'opus', input: 15, output: 75, cacheRead: 1.5 },
  { match: 'sonnet', input: 3, output: 15, cacheRead: 0.3 },
  { match: 'haiku', input: 1, output: 5, cacheRead: 0.1 },
]

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
`)
    process.exit(0)
  }
}

// --- Map cwd to .claude/projects/ path ---
function cwdToProjectDir(): string {
  const cwd = projectFilter || process.cwd()
  const claudeProjectsDir = join(homedir(), '.claude', 'projects')

  // Claude Code encodes paths by replacing path separators with hyphens
  // e.g. /home/user/cc-monitor → -home-user-cc-monitor (Linux/macOS)
  // e.g. C:\Users\user\project → C-Users-user-project (Windows)
  const encoded = cwd.split(sep).join('-').replace(/^-/, '-')
  const projectDir = join(claudeProjectsDir, encoded.startsWith('-') ? encoded : `-${encoded}`)

  if (existsSync(projectDir)) return projectDir

  // Fallback: try to find a matching directory
  const { readdirSync } = require('fs') as typeof import('fs')
  try {
    const dirs = readdirSync(claudeProjectsDir, { withFileTypes: true })
    // Look for directory that matches cwd encoding
    for (const d of dirs) {
      if (!d.isDirectory()) continue
      // Decode: -home-user-cc-monitor → /home/user/cc-monitor
      const decoded = d.name.replace(/-/g, '/')
      if (decoded === cwd || decoded === cwd.replace(/\\/g, '/')) {
        return join(claudeProjectsDir, d.name)
      }
    }
  } catch {
    // ignore
  }

  return projectDir
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
  const records = cache.getAllRecords()
  const userMessages = cache.getUserMessages()

  const now = Date.now()
  const fiveHoursAgo = now - 5 * 60 * 60 * 1000
  const recentRecords = records.filter((r) => r.timestamp.getTime() >= fiveHoursAgo)

  const modelSummaries = aggregateByModel(records)
  const sessionSummaries = aggregateBySession(records, userMessages)
  const hourBuckets = aggregateByHour(recentRecords)

  const output = renderDashboard(
    {
      records,
      modelSummaries,
      sessionSummaries,
      hourBuckets,
      pricing: DEFAULT_PRICING,
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
      // q or Ctrl+C
      cleanup()
    } else if (key === 'r') {
      cache.clear()
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
