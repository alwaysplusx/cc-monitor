// Root application component — main layout assembly
import Header from './components/layout/Header'
import StatsBar from './components/layout/StatsBar'
import ActivityHeatmap from './components/charts/ActivityHeatmap'
import MinuteTimeline from './components/charts/MinuteTimeline'
import ModelPie from './components/charts/ModelPie'
import ProjectPie from './components/charts/ProjectPie'
import SessionTable from './components/tables/SessionTable'
import SettingsModal from './components/layout/SettingsModal'
import DrilldownDrawer from './components/drilldown/DrilldownDrawer'
import CostDrilldown from './components/drilldown/CostDrilldown'
import SessionDrilldown from './components/drilldown/SessionDrilldown'
import ModelDrilldown from './components/drilldown/ModelDrilldown'
import ProjectDrilldown from './components/drilldown/ProjectDrilldown'
import UsagePatternDrilldown from './components/drilldown/UsagePatternDrilldown'
import DayDrilldown from './components/drilldown/DayDrilldown'
import DayCompareDrilldown from './components/drilldown/DayCompareDrilldown'
import { useDataStore } from './stores/dataStore'
import { useTokenData } from './hooks/useTokenData'
import { useTheme } from './hooks/useTheme'

const drilldownTitles: Record<string, string> = {
  cost: '费用分析',
  session: '会话详情',
  model: '模型详情',
  project: '项目详情',
  'usage-pattern': '使用模式',
  day: '日详情',
  'day-compare': '日对比',
}

function App(): React.JSX.Element {
  useTokenData()
  useTheme()
  const drilldown = useDataStore((s) => s.drilldown)
  const drilldownHistory = useDataStore((s) => s.drilldownHistory)
  const closeDrilldown = useDataStore((s) => s.closeDrilldown)
  const goBackDrilldown = useDataStore((s) => s.goBackDrilldown)

  return (
    <div className="flex h-screen flex-col bg-[var(--background)] text-[var(--foreground)]">
      <Header />
      <StatsBar />

      {/* Dashboard Grid */}
      <div className="flex-1 overflow-auto px-4 pb-4">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_320px]">
          {/* Left: Heatmap + Chart */}
          <div className="grid min-w-0 grid-rows-[auto_1fr] gap-3">
            <div className="min-w-0 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--card)] p-3">
              <ActivityHeatmap />
            </div>
            <div className="min-w-0 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--card)] p-3">
              <MinuteTimeline />
            </div>
          </div>

          {/* Right: Side panels — equal height */}
          <div className="grid grid-rows-2 gap-3">
            <div className="flex flex-col overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--card)] p-3">
              <ModelPie />
            </div>
            <div className="flex flex-col rounded-lg border border-[var(--border)] bg-[var(--card)] p-3">
              <ProjectPie />
            </div>
          </div>
        </div>

        {/* Bottom: Session table (full width) */}
        <div className="mt-4 rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
          <SessionTable />
        </div>
      </div>
      <SettingsModal />
      <DrilldownDrawer
        open={drilldown !== null}
        onClose={closeDrilldown}
        onBack={goBackDrilldown}
        canGoBack={drilldownHistory.length > 0}
        title={drilldown ? (
          drilldown.type === 'day' && drilldown.params.day ? `${drilldown.params.day} 日详情` :
          drilldown.type === 'day-compare' && drilldown.params.day ? `${drilldown.params.day} vs ${drilldown.params.compareDay}` :
          drilldownTitles[drilldown.type]
        ) : ''}
      >
        {drilldown?.type === 'cost' && <CostDrilldown />}
        {drilldown?.type === 'session' && drilldown.params.sessionId && (
          <SessionDrilldown sessionId={drilldown.params.sessionId} />
        )}
        {drilldown?.type === 'model' && drilldown.params.model && (
          <ModelDrilldown model={drilldown.params.model} />
        )}
        {drilldown?.type === 'project' && drilldown.params.projectPath && (
          <ProjectDrilldown projectPath={drilldown.params.projectPath} />
        )}
        {drilldown?.type === 'usage-pattern' && <UsagePatternDrilldown />}
        {drilldown?.type === 'day' && drilldown.params.day && (
          <DayDrilldown day={drilldown.params.day} />
        )}
        {drilldown?.type === 'day-compare' && drilldown.params.day && drilldown.params.compareDay && (
          <DayCompareDrilldown day={drilldown.params.day} compareDay={drilldown.params.compareDay} />
        )}
      </DrilldownDrawer>
    </div>
  )
}

export default App
