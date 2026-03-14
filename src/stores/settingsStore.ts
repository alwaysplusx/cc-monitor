// Zustand store for user settings: plan type, theme, data directory
import { create } from 'zustand'
import type { AppSettings } from '../types/ipc'

interface SettingsState extends AppSettings {
  setTheme: (theme: AppSettings['theme']) => void
  setPlanType: (planType: AppSettings['planType']) => void
  setCustomTokenLimit: (limit: number) => void
  setClaudeDataDir: (dir: string) => void
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
  setTheme: (theme) => set({ theme }),
  setPlanType: (planType) => set({ planType }),
  setCustomTokenLimit: (limit) => set({ customTokenLimit: limit }),
  setClaudeDataDir: (dir) => set({ claudeDataDir: dir }),
  loadSettings: (settings) => set({ ...settings }),
}))
