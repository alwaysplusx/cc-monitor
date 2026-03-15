// Root application component — main layout assembly
import Header from './components/layout/Header'
import StatsBar from './components/layout/StatsBar'
import ActivityHeatmap from './components/charts/ActivityHeatmap'
import MinuteTimeline from './components/charts/MinuteTimeline'
import ModelPie from './components/charts/ModelPie'
import ProjectPie from './components/charts/ProjectPie'
import SessionTable from './components/tables/SessionTable'
import { useTokenData } from './hooks/useTokenData'
import { useTheme } from './hooks/useTheme'

function App(): React.JSX.Element {
  useTokenData()
  useTheme()

  return (
    <div className="flex h-screen flex-col bg-[var(--background)] text-[var(--foreground)]">
      <Header />
      <StatsBar />

      {/* Dashboard Grid */}
      <div className="flex-1 overflow-auto px-4 pb-4">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_320px]">
          {/* Left: Heatmap + Chart */}
          <div className="grid grid-rows-[auto_1fr] gap-3">
            <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-3">
              <ActivityHeatmap />
            </div>
            <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-3">
              <MinuteTimeline />
            </div>
          </div>

          {/* Right: Side panels — equal height */}
          <div className="grid grid-rows-2 gap-3">
            <div className="flex flex-col overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--card)] p-3">
              <ModelPie />
            </div>
            <div className="flex flex-col overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--card)] p-3">
              <ProjectPie />
            </div>
          </div>
        </div>

        {/* Bottom: Session table (full width) */}
        <div className="mt-4 rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
          <SessionTable />
        </div>
      </div>
    </div>
  )
}

export default App
