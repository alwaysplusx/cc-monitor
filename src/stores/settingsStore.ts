// Zustand store for user settings: plan type, theme, data directory
import { create } from 'zustand'
import type { AppSettings } from '../types/ipc'

interface SettingsState extends AppSettings {
  windowStartTime: string | null // ISO-8601 datetime for 5h window start
  setTheme: (theme: AppSettings['theme']) => void
  setPlanType: (planType: AppSettings['planType']) => void
  setCustomTokenLimit: (limit: number) => void
  setClaudeDataDir: (dir: string) => void
  setWindowStartTime: (time: string | null) => void
  loadSettings: (settings: AppSettings) => void
}

export const useSettingsStore = create<SettingsState>((set) => ({
  claudeDataDir: '',
  watchEnabled: true,
  refreshIntervalMs: 30000,
  theme: 'system',
  planType: 'max20',
  customTokenLimit: 0,
  minimizeToTray: false,
  launchAtStartup: false,
  windowStartTime: null,

  setTheme: (theme) => set({ theme }),
  setPlanType: (planType) => set({ planType }),
  setCustomTokenLimit: (limit) => set({ customTokenLimit: limit }),
  setClaudeDataDir: (dir) => set({ claudeDataDir: dir }),
  setWindowStartTime: (time) => set({ windowStartTime: time }),
  loadSettings: (settings) => set({ ...settings }),
}))
