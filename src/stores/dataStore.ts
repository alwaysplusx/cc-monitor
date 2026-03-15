// Zustand store for token data, projects, and aggregated results
import { create } from 'zustand'
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
} from '../types/data'
import type { TimeView } from '../lib/constants'

export type DrilldownType = 'cost' | 'session' | 'model' | 'project' | 'usage-pattern'

export interface DrilldownState {
  type: DrilldownType
  params: {
    sessionId?: string
    model?: string
    projectPath?: string
  }
}

interface DataState {
  // Project data
  projects: ProjectInfo[]
  currentProject: string | null

  // Token records
  tokenRecords: TokenRecord[]

  // Aggregated data
  minuteBuckets: MinuteBucket[]
  hourBuckets: HourBucket[]
  dayBuckets: DayBucket[]
  monthBuckets: MonthBucket[]
  modelSummaries: ModelSummary[]
  sessionSummaries: SessionSummary[]
  modelSwitches: ModelSwitch[]
  // Drilldown state
  drilldown: DrilldownState | null

  // View state
  timeView: TimeView
  lastUpdated: Date | null
  highlightedTimeRange: { start: string; end: string } | null

  // Actions
  setProjects: (projects: ProjectInfo[]) => void
  setProject: (path: string | null) => void
  updateData: (data: {
    records: TokenRecord[]
    minuteBuckets: MinuteBucket[]
    hourBuckets: HourBucket[]
    dayBuckets: DayBucket[]
    monthBuckets: MonthBucket[]
    modelSummaries: ModelSummary[]
    sessionSummaries: SessionSummary[]
    modelSwitches: ModelSwitch[]
  }) => void
  openDrilldown: (type: DrilldownType, params?: DrilldownState['params']) => void
  closeDrilldown: () => void
  setTimeView: (view: TimeView) => void
  setHighlightedTimeRange: (range: { start: string; end: string } | null) => void
  setLastUpdated: (date: Date) => void
}

export const useDataStore = create<DataState>((set) => ({
  projects: [],
  currentProject: null,
  tokenRecords: [],
  minuteBuckets: [],
  hourBuckets: [],
  dayBuckets: [],
  monthBuckets: [],
  modelSummaries: [],
  sessionSummaries: [],
  modelSwitches: [],
  drilldown: null,
  timeView: 'hour',
  lastUpdated: null,
  highlightedTimeRange: null,

  setProjects: (projects) => set({ projects }),

  setProject: (path) => set({ currentProject: path }),

  updateData: (data) =>
    set({
      tokenRecords: data.records,
      minuteBuckets: data.minuteBuckets,
      hourBuckets: data.hourBuckets,
      dayBuckets: data.dayBuckets,
      monthBuckets: data.monthBuckets,
      modelSummaries: data.modelSummaries,
      sessionSummaries: data.sessionSummaries,
      modelSwitches: data.modelSwitches,
      lastUpdated: new Date(),
    }),

  openDrilldown: (type, params = {}) => set({ drilldown: { type, params } }),

  closeDrilldown: () => set({ drilldown: null }),

  setTimeView: (view) => set({ timeView: view }),

  setHighlightedTimeRange: (range) => set({ highlightedTimeRange: range }),

  setLastUpdated: (date) => set({ lastUpdated: date }),
}))
