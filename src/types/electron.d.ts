// Type declarations for the preload API exposed via contextBridge
import type {
  ProjectInfo,
  TokenRecord,
  MinuteBucket,
  HourBucket,
  DayBucket,
  MonthBucket,
  ModelSummary,
  SessionSummary,
  ModelSwitch,
} from './data'
import type { AppSettings, WatchStatus } from './ipc'

export interface ElectronAPI {
  getProjects(): Promise<ProjectInfo[]>
  getTokenData(projectPath: string): Promise<{
    records: TokenRecord[]
    minuteBuckets: MinuteBucket[]
    hourBuckets: HourBucket[]
    dayBuckets: DayBucket[]
    monthBuckets: MonthBucket[]
    modelSummaries: ModelSummary[]
    sessionSummaries: SessionSummary[]
    modelSwitches: ModelSwitch[]
  }>
  refreshData(): Promise<void>
  selectDirectory(): Promise<string | null>
  exportData(format: 'csv' | 'json', data: object): Promise<string>
  openDirectory(dirPath: string): Promise<void>
  getTurnDetail(params: {
    fileName: string
    sessionId: string
    timestamp: string
    contentLimit?: number
  }): Promise<{
    userMessage: string
    assistantText: string
    assistantThinking: string
    toolCalls: { name: string; input: string }[]
    model: string
    timestamp: string
  } | null>
  getSettings(): Promise<AppSettings>
  saveSettings(settings: Partial<AppSettings>): Promise<void>
  onDataUpdated(callback: (projectPath: string) => void): () => void
  onWatchStatus(callback: (status: WatchStatus) => void): () => void
  windowMinimize(): void
  windowMaximize(): void
  windowClose(): void
}

declare global {
  interface Window {
    api: ElectronAPI
  }
}
