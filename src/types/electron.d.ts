// Type declarations for the preload API exposed via contextBridge
import type { ProjectInfo, TokenRecord } from './data'
import type { AppSettings, WatchStatus } from './ipc'

export interface ElectronAPI {
  getProjects(): Promise<ProjectInfo[]>
  getTokenData(projectPath: string): Promise<TokenRecord[]>
  refreshData(): Promise<void>
  selectDirectory(): Promise<string | null>
  exportData(format: 'csv' | 'json', data: object): Promise<string>
  getSettings(): Promise<AppSettings>
  saveSettings(settings: Partial<AppSettings>): Promise<void>
  onDataUpdated(callback: (projectPath: string) => void): () => void
  onWatchStatus(callback: (status: WatchStatus) => void): () => void
}

declare global {
  interface Window {
    api: ElectronAPI
  }
}
