# CC Monitor

Claude Code Token consumption monitor - an Electron desktop app for real-time monitoring and analysis of Claude Code token usage.

## Features

- **Multi-granularity Token Timeline** - Stacked area chart with hour/day/month views, zoom and brush selection
- **Model Usage Distribution** - Donut chart with model detail list, linked to timeline
- **Session / Subagent Analysis** - Expandable table with tree hierarchy and subagent grouping
- **5-Hour Window Prediction** - Gauge chart with plan-based quota tracking and alert coloring
- **Real-time File Monitoring** - Auto-watch `~/.claude/projects/` with incremental parsing
- **Light / Dark / System Theme** - Three-mode theme switching
- **Multi-project Support** - Scan and switch between all Claude Code projects

## Screenshot

> Screenshots will be added after the first release.

## Download

> Prebuilt binaries will be available on [GitHub Releases](https://github.com/user/cc-monitor/releases) after the first release.

## Quick Start

1. Download and install from the [Releases](https://github.com/user/cc-monitor/releases) page
2. Launch CC Monitor
3. The app automatically scans `~/.claude/projects/` for Claude Code JSONL log files
4. Use Claude Code as normal - token usage data appears in real-time

## Development

### Prerequisites

- [Node.js](https://nodejs.org/) >= 18
- [pnpm](https://pnpm.io/) >= 9

### Setup

```bash
git clone https://github.com/user/cc-monitor.git
cd cc-monitor
pnpm install
pnpm dev
```

### Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start in development mode with hot reload |
| `pnpm build` | Build and package for production |
| `pnpm build:vite` | Build without packaging |
| `pnpm lint` | Run ESLint |
| `pnpm format` | Format code with Prettier |
| `pnpm typecheck` | Run TypeScript type checking |

## Tech Stack

| Category | Technology |
|----------|-----------|
| Framework | Electron + React 19 |
| Language | TypeScript (strict mode) |
| Build Tool | electron-vite |
| Charts | ECharts + echarts-for-react |
| UI | shadcn/ui + Tailwind CSS v4 |
| State Management | Zustand |
| File Watching | chokidar |
| Packaging | electron-builder |
| Package Manager | pnpm |

## Project Structure

```
cc-monitor/
  electron/           # Main process
    main.ts           # Entry point
    preload.ts        # Context bridge
    services/         # Parser, cache, aggregator, watcher, settings
    ipc/              # IPC channels and handlers
  src/                # Renderer process
    components/       # React components (layout, charts, tables, common)
    hooks/            # Custom hooks (useTokenData, useTheme, useProjects)
    stores/           # Zustand stores (dataStore, settingsStore)
    lib/              # Utilities (format, theme, constants, ipc)
    types/            # TypeScript type definitions
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Commit your changes (`git commit -m 'Add my feature'`)
4. Push to the branch (`git push origin feature/my-feature`)
5. Open a Pull Request

Please ensure your code passes `pnpm lint` and `pnpm typecheck` before submitting.

## License

[MIT](LICENSE)
