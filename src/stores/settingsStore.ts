// Zustand store for user settings: plan type, theme, data directory, pricing
import { create } from 'zustand'
import type { AppSettings, ModelPricingConfig } from '../types/ipc'

interface SettingsState extends AppSettings {
  settingsOpen: boolean
  setSettingsOpen: (open: boolean) => void
  setTheme: (theme: AppSettings['theme']) => void
  setPlanType: (planType: AppSettings['planType']) => void
  setCustomTokenLimit: (limit: number) => void
  setClaudeDataDir: (dir: string) => void
  setModelPricing: (pricing: ModelPricingConfig[]) => void
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
  modelPricing: [
    { match: 'opus', input: 5, output: 25, cacheRead: 0.5 },
    { match: 'sonnet', input: 3, output: 15, cacheRead: 0.3 },
    { match: 'haiku', input: 1, output: 5, cacheRead: 0.1 },
    { match: 'glm', input: 0.38, output: 1.98, cacheRead: 0.19 },
  ],
  settingsOpen: false,
  setSettingsOpen: (open) => set({ settingsOpen: open }),
  setTheme: (theme) => set({ theme }),
  setPlanType: (planType) => set({ planType }),
  setCustomTokenLimit: (limit) => set({ customTokenLimit: limit }),
  setClaudeDataDir: (dir) => set({ claudeDataDir: dir }),
  setModelPricing: (pricing) => set({ modelPricing: pricing }),
  loadSettings: (settings) => set({ ...settings }),
}))
