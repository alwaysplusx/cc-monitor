// IPC communication request/response types and settings

// Watch status reported from main process
export type WatchStatus = 'watching' | 'stopped' | 'error'

// Application settings persisted to disk
export interface AppSettings {
  claudeDataDir: string
  watchEnabled: boolean
  refreshIntervalMs: number
  theme: 'light' | 'dark' | 'system'
  planType: 'pro' | 'max5' | 'max20' | 'custom'
  customTokenLimit: number
  minimizeToTray: boolean
  launchAtStartup: boolean
}

// IPC channel name constants (mirrored from electron/ipc/channels.ts)
export const IPC_CHANNELS = {
  GET_PROJECTS: 'get-projects',
  GET_TOKEN_DATA: 'get-token-data',
  SELECT_DIRECTORY: 'select-directory',
  GET_SETTINGS: 'get-settings',
  SAVE_SETTINGS: 'save-settings',
  EXPORT_DATA: 'export-data',
  REFRESH: 'refresh',
  DATA_UPDATED: 'data-updated',
  WATCH_ERROR: 'watch-error',
  WATCH_STATUS: 'watch-status',
} as const
