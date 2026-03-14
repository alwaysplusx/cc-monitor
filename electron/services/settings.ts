// Application settings persistence (read/write JSON file)
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { app } from 'electron'
import type { AppSettings } from '../../src/types/ipc'
import { getDefaultClaudeDir } from './project-scanner'

function getSettingsPath(): string {
  return join(app.getPath('userData'), 'settings.json')
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
  const path = getSettingsPath()
  const dir = dirname(path)
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
  writeFileSync(path, JSON.stringify(settings, null, 2), 'utf-8')
}
