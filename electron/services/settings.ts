// Application settings persistence (read/write JSON file)
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import type { AppSettings } from '../../src/types/ipc'
import { getDefaultClaudeDir } from './project-scanner'

function getConfigDir(): string {
  return join(homedir(), '.cc-monitor')
}

function getSettingsPath(): string {
  return join(getConfigDir(), 'settings.json')
}

const defaultSettings: AppSettings = {
  claudeDataDir: getDefaultClaudeDir(),
  watchEnabled: true,
  refreshIntervalMs: 30000,
  theme: 'system',
  planType: 'max20',
  customTokenLimit: 0,
  minimizeToTray: false,
  launchAtStartup: false,
  modelPricing: [
    { match: 'opus', input: 5, output: 25, cacheRead: 0.5 },
    { match: 'sonnet', input: 3, output: 15, cacheRead: 0.3 },
    { match: 'haiku', input: 1, output: 5, cacheRead: 0.1 },
    { match: 'glm', input: 0.38, output: 1.98, cacheRead: 0.19 },
  ],
}

/**
 * Read settings from disk, returning defaults for missing fields.
 */
export function readSettings(): AppSettings {
  const path = getSettingsPath()
  if (!existsSync(path)) return { ...defaultSettings }

  try {
    const raw = readFileSync(path, 'utf-8')
    const saved = JSON.parse(raw) as Partial<AppSettings>
    return { ...defaultSettings, ...saved }
  } catch {
    return { ...defaultSettings }
  }
}

/**
 * Write settings to disk.
 */
export function writeSettings(settings: AppSettings): void {
  const dir = getConfigDir()
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
  writeFileSync(getSettingsPath(), JSON.stringify(settings, null, 2), 'utf-8')
}
