// Root application component
function App(): React.JSX.Element {
  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-[var(--primary)]">CC Monitor</h1>
          <p className="mt-2 text-[var(--muted-foreground)]">
            Claude Code Token consumption monitor
          </p>
        </div>
      </div>
    </div>
  )
}

export default App
