# CC Monitor

Claude Code Token 消耗监控 Electron 桌面应用。

## 技术栈

- Electron + React 19 + TypeScript (strict)
- electron-vite (构建)
- ECharts + echarts-for-react (图表)
- shadcn/ui + Tailwind CSS v4 (UI)
- zustand (状态管理)
- chokidar (文件监控)
- electron-builder (打包)
- pnpm (包管理)

## 对话规范

- 始终使用用户的语言进行对话（用户用中文则回复中文，用英文则回复英文）

## 代码规范

- TypeScript strict mode，所有文件顶部加简要注释说明职责
- React 函数组件 + hooks，禁止 class 组件
- Prettier: semi: false, singleQuote: true, tabWidth: 2, printWidth: 100
- 样式用 Tailwind class，不写内联 style，不写单独 CSS 文件
- 状态用 zustand store，不用 useState 管理跨组件状态
- ECharts 通过 echarts-for-react 集成，声明式 option
- 文件命名：组件 PascalCase.tsx，其他 camelCase.ts
- IPC 通信走 preload contextBridge，渲染进程禁止直接访问 Node API

## 页面结构

- **Header** — 顶部导航栏
- **StatsBar** — 6 个统计卡片（输入/输出/缓存/请求/近 5 小时/活跃时长），带 info tooltip
- **MinuteTimeline** — 时间线柱状图（小时/天/月 tab），tooltip 含模型分布，dataZoom 滑块 25%
- **ModelPie** — 模型分布饼图 + 列表（最多显示 4 条，超出滚动）
- **ProjectPie** — 项目分布饼图 + 列表（<5% 合并为「其他」，最多 4 条，超出滚动）
- **SessionTable** — 会话列表（ID/项目/会话/请求/Token/模型/时间），支持展开 subagent、点击打开目录

## IPC 通道

- `get-projects` / `get-token-data` / `refresh` — 数据获取
- `select-directory` — 选择目录对话框
- `open-directory` — 打开文件所在目录（shell.showItemInFolder）
- `get-settings` / `save-settings` — 设置读写
- `data-updated` / `watch-status` — 主进程推送事件

## 关键文件

- `docs/design.md` — 完整设计文档（架构、数据模型、UI 设计、功能规格）
- `cc-monitor-tasks.json` — 任务计划（26 个 task，含 steps 和验收标准）
- `test/fixtures/*.jsonl` — JSONL 样本数据

执行任务前先读取 cc-monitor-tasks.json 确认当前 task 的 steps 和 acceptance。
需要架构或数据模型细节时读取 docs/design.md 对应章节。
