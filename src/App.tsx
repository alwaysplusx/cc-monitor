// Root application component — main layout assembly
import Header from './components/layout/Header'
import StatsBar from './components/layout/StatsBar'
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
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_340px]">
          {/* Left: Main chart */}
          <div className="min-h-[350px] rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
            <MinuteTimeline />
          </div>

          {/* Right: Side panels — equal height */}
          <div className="grid grid-rows-2 gap-4">
            <div className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
              <ModelPie />
            </div>
            <div className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
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
