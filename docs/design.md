# CC Monitor — 项目设计文档

> Claude Code Token 消耗监控桌面应用
> 版本：v0.1.0 Draft
> 日期：2026-03-14

---

## 1. 项目概述

### 1.1 是什么

CC Monitor 是一款开源的 Electron 桌面应用，用于实时监控和分析 Claude Code 的 token 消耗情况。它通过解析 Claude Code 本地 JSONL 日志文件，提供分钟级粒度的 token 用量可视化、模型用量分布、session/subagent 分析和 5 小时窗口额度预测。

### 1.2 为什么

Claude Code 的 Pro/Max 订阅用户缺乏直观的 token 消耗监控手段。现有工具存在以下不足：

- `/cost` 命令：仅显示当前 session 的汇总数据，无历史趋势
- `/context` 命令：仅显示上下文窗口使用情况
- ccusage CLI：仅支持日/月/session 粒度的命令行报表，无实时监控，无可视化界面
- Claude-Code-Usage-Monitor：终端 TUI，功能单一

CC Monitor 要解决的核心问题：**让用户随时看到自己的 token 在哪里、以什么速率被消耗，并预测剩余额度。**

### 1.3 给谁用

- Claude Code Pro / Max 订阅用户
- 使用 custom model 的 Claude Code 用户
- 需要管理团队 Claude Code 用量的 Tech Lead

### 1.4 核心特性

| 编号 | 特性 | 优先级 | 说明 |
|------|------|--------|------|
| F1 | 多粒度 Token 消耗时间线 | P0 | 堆叠面积图，小时/天/月三级视图，支持缩放和框选 |
| F2 | 模型用量分布 | P0 | 环形图 + 列表，联动时间线，含模型切换标注 |
| F3 | Session / Subagent 分组对比 | P0 | 可展开表格，树形层级，subagent 折叠 |
| F4 | 5 小时窗口额度预测 | P0 | 环形进度图，手动指定窗口，告警变色 |
| F5 | 实时文件监控 | P0 | 自动监控 + 增量解析 + 静默刷新 |
| F6 | 亮/暗主题切换 | P1 | Light / Dark / System 三模式 |
| F7 | 多项目支持 | P1 | 扫描 ~/.claude/projects/ 下所有项目，支持切换和筛选 |
| F8 | 数据导出 | P2 | 导出 CSV / JSON 格式的用量报告 |
| F9 | 历史趋势 | P2 | 日/周/月维度的用量趋势图 |
| F10 | 系统托盘常驻 | P2 | 最小化到系统托盘，后台持续监控 |

### 1.5 核心功能详细规格

#### F1: 多粒度 Token 消耗时间线

**图表类型:** ECharts 堆叠面积图

**时间级别与粒度:**

| 视图 | 默认时间范围 | 每个数据点粒度 | 切换方式 |
|------|-------------|---------------|---------|
| 小时级 | 最近 10 小时 | 1 分钟 | Tab 切换 |
| 天级 | 最近 7 天 | 1 小时 | Tab 切换 |
| 月级 | 最近 3 个月 | 1 天 | Tab 切换 |

切换时间级别时，同一个图表组件完全重新查询数据并渲染。

**数据层:**
- 默认显示 input + output 两层（堆叠面积）
- cache_read 层默认隐藏，可通过图例勾选显示
- 隐藏 cache 的原因：cache_read 通常占总量 95%+，直接堆叠会导致 input/output 几乎不可见

**交互:**
- hover：显示 tooltip，内容为该时间点的 input / output / cache_read / 请求数
- 鼠标框选：放大选中的时间段（ECharts brush + dataZoom 联动）
- 点击：点击某个时间点，下方 Session 表格自动筛选并高亮该时间段内活跃的 session
- 模型切换标注：在时间线上用 markLine 竖线标注模型切换时间点（如从 sonnet 切到 opus）

**边界条件:**
- 无数据的时间段填 0，保持时间轴连续性
- 数据量 > 1440 个点（24h 分钟级）时，dataZoom 默认显示最近 2 小时
- 仅有一个数据点时，显示单柱 + 提示文字

---

#### F2: 模型用量分布

**图表形式:** ECharts 环形图（中间显示总 token 数）+ 下方详情列表

**数据范围:** 跟随 F1 时间线当前展示的时间范围联动。F1 切换视图或框选缩放时，F2 自动重新聚合。

**环形图:**
- 中心大字：总 token 数（input + output，不含 cache）
- 外环：按模型分色，hover 时扇区微微外扩 + 显示详细 tooltip
- 渐变色填充，非纯色

**详情列表（每个模型一行）:**

| 字段 | 说明 |
|------|------|
| 模型名 | 如 `glm-4.7`、`claude-sonnet-4-6` |
| Token 总量 | input + output 合计 |
| 占比 | 百分比 |
| 请求数 | 该模型的请求次数 |
| 平均 token/请求 | 总量 / 请求数 |

**模型切换时间节点:**
- 不在 F2 环形图中展示
- 在 F1 时间线上用 markLine 竖线标注，标签显示"→ modelName"
- 检测逻辑：相邻两条 assistant 记录的 model 字段不同时，视为一次模型切换

**边界条件:**
- 仅一个模型时：环形图满环，列表仅一行，不显示切换标注
- 模型名为空或 unknown：归类到 "unknown" 组

---

#### F3: Session / Subagent 分组对比

**展示形式:** 可展开行的表格

**表格列定义:**

| 列 | 宽度 | 说明 |
|----|------|------|
| 展开箭头 | 32px | 有 subagent 时显示 ▶，无则不显示 |
| Session 标题 | flex | 首条用户纯文本消息，截断到 60 字符；subagent 行显示 agentId 前 12 位 + 标签 |
| 时间范围 | 120px | HH:mm ~ HH:mm 格式 |
| 模型 | 100px | 模型名，带对应颜色 |
| Input | 80px | input_tokens 总量，格式 fmtK |
| Output | 80px | output_tokens 总量，格式 fmtK |
| Cache | 80px | cache_read_tokens 总量，格式 fmtK |
| 请求数 | 60px | 数字 |
| 平均耗时 | 80px | 从 system.turn_duration 计算，格式 "Xs" |
| 占比 | 120px | 堆叠百分比条（input 蓝 / output 紫 / cache 青）+ 百分比文字 |

**层级关系:**
- 主 Session 为第一层级行
- 点击展开箭头，在下方缩进显示该 session 的所有 subagent 行
- subagent 行左侧缩进 24px，带 "subagent" 紫色标签
- 默认全部折叠

**排序:** 默认按首条记录时间倒序（最新 session 在上）

**边界条件:**
- session 无 subagent：不显示展开箭头
- session 无用户纯文本消息（全是 tool_result）：标题显示 sessionId 前 12 位
- 空状态：显示 "暂无 session 数据" 引导文字

---

#### F4: 5 小时窗口额度预测

**可视化:** ECharts 环形进度图（gauge 的 ring 变体）

**环形进度图设计:**
- 中心大字：剩余百分比（如 "62%"）
- 中心副文字："剩余额度"
- 外圈：渐变色跟随使用率变化
  - 0~50%：绿色 (#10b981)
  - 50~80%：渐变到黄色 (#f59e0b)
  - 80~95%：渐变到橙色 (#f97316)
  - 95~100%：红色 (#ef4444)

**窗口起始时间:**
- 用户手动指定（时间选择器）
- 默认值：当天最近一个 session 的首条消息时间（自动检测）
- 窗口长度固定 5 小时

**数据项:**

| 数据项 | 位置 | 说明 |
|--------|------|------|
| 已消耗 / 总额度 | 环形图下方 | 如 "45.2K / 220K" |
| 使用率 | 环形图中心 | 如 "62%" |
| 额度告警 | 环形图颜色 | >80% 变橙，>95% 变红 |

**Plan 选择:**
- 下拉选择器：Pro(44K) / Max5(88K) / Max20(220K) / Custom
- 选 Custom 时出现输入框，手动输入 token 上限（单位 K）
- 持久化到设置

**计算逻辑:**
- 已消耗 = 窗口时间范围内所有 input_tokens + output_tokens（不含 cache_read）
- 使用率 = 已消耗 / Plan 上限
- cache_read 不计入消耗（Pro/Max 的限额通常不计 cache tokens）

**边界条件:**
- 窗口已过期（当前时间 > 起始时间 + 5h）：环形图灰色，中心显示"已过期"，下方显示窗口时间范围
- 未设置起始时间且无法自动检测：显示提示"请设置窗口起始时间"
- 已消耗 > 总额度：环形图满圈红色，中心显示"已超限"

---

#### F5: 实时文件监控

**启动方式:**
- 应用启动时自动检测并监控 `~/.claude/projects/` 目录
- 默认路径可在设置中修改
- Windows 路径自动适配：`%USERPROFILE%\.claude\projects\`

**监控范围:**
- `~/.claude/projects/*/` 下所有 `.jsonl` 文件（递归，包括 subagents/ 子目录）
- 使用 chokidar 监听 `add`（新文件）和 `change`（文件内容变化）事件

**增量解析:**
- 每个文件记录已解析的行数（lineCount）
- 文件变化时：读取文件 → 跳过前 lineCount 行 → 仅解析新行
- 文件被删除：从缓存中移除该文件的数据
- 文件被截断（大小变小）：全量重新解析

**通知方式:**
- 静默更新：数据变化后直接刷新图表，不弹窗不打断
- Header 状态栏：绿色圆点闪烁 1 秒 + 文字 "已更新 HH:mm:ss"
- 监控出错时：状态栏显示黄色警告图标 + 错误简述

**性能策略:**
- 文件变化 500ms 防抖，合并短时间内多次写入
- chokidar 配置 `awaitWriteFinish: { stabilityThreshold: 300 }`
- 首次启动全量扫描时显示 loading 进度条

---

#### F6: 亮/暗主题切换

**三种模式:** Light / Dark / System（跟随操作系统）

**默认:** System

**切换方式:**
- Header 右侧按钮，图标随当前主题变化
- 点击循环切换：System（🖥️）→ Light（☀️）→ Dark（🌙）→ System
- 快捷键：Ctrl+Shift+T（可选，P2）

**持久化:** 存入应用设置文件（Electron app.getPath('userData')）

**实现:**
- HTML root 元素设置 `data-theme="light|dark"` 属性
- Tailwind CSS 的 `dark:` 变体 + CSS 变量
- ECharts：Light 和 Dark 各一套自定义 theme，切换时调用 `echartsInstance.setOption()` 重绘
- 切换时图表平滑重绘，不闪烁

---

## 2. 技术架构

### 2.1 技术栈

| 层面 | 选型 | 版本 | 选型理由 |
|------|------|------|----------|
| 运行时 | Electron | 35+ | 跨平台桌面应用框架 |
| 构建工具 | electron-vite | latest | Electron 专用 Vite 封装，开发体验最佳 |
| 前端框架 | React | 19 | 生态成熟，开源项目贡献者最易上手 |
| 类型系统 | TypeScript | 5.7+ | 类型安全，代码可维护性 |
| 图表库 | ECharts | 5.6+ | 视觉效果最佳，内置 dark theme，交互丰富（dataZoom/brush） |
| ECharts 集成 | echarts-for-react | latest | React 封装，声明式 API |
| UI 组件 | shadcn/ui | latest | 高质感、可定制、轻量 |
| CSS 方案 | Tailwind CSS | 4 | 原子化 CSS，配合 shadcn/ui |
| 状态管理 | zustand | 5+ | 轻量级，API 简洁，比 Redux 少 80% 样板代码 |
| 文件监控 | chokidar | 4+ | Node.js 文件监控标准库，跨平台稳定 |
| 打包发布 | electron-builder | latest | 支持 Windows(.exe)/macOS(.dmg)/Linux(.AppImage) |
| 代码规范 | ESLint + Prettier | latest | 统一代码风格 |
| 包管理器 | pnpm | 9+ | 速度快，磁盘效率高 |

### 2.2 架构总览

```
┌─────────────────────────────────────────────────────┐
│                    Electron App                      │
│                                                      │
│  ┌──────────────────┐    IPC     ┌────────────────┐  │
│  │   Main Process   │◄─────────►│ Renderer Process│  │
│  │                  │           │                  │  │
│  │  ┌────────────┐  │           │  ┌────────────┐ │  │
│  │  │  Watcher   │  │  events   │  │   React    │ │  │
│  │  │ (chokidar) │──┼──────────►│  │    App     │ │  │
│  │  └────────────┘  │           │  └─────┬──────┘ │  │
│  │  ┌────────────┐  │           │        │        │  │
│  │  │   JSONL    │  │  query    │  ┌─────▼──────┐ │  │
│  │  │  Parser    │◄─┼──────────►│  │  zustand   │ │  │
│  │  └────────────┘  │           │  │   Store    │ │  │
│  │  ┌────────────┐  │           │  └─────┬──────┘ │  │
│  │  │   Data     │  │           │        │        │  │
│  │  │   Cache    │  │           │  ┌─────▼──────┐ │  │
│  │  └────────────┘  │           │  │  ECharts   │ │  │
│  │                  │           │  │  Dashboard │ │  │
│  └──────────────────┘           │  └────────────┘ │  │
│                                 └────────────────┘  │
└─────────────────────────────────────────────────────┘
          │
          ▼
  ~/.claude/projects/
  ├── <project-hash-1>/sessions/*.jsonl
  ├── <project-hash-2>/sessions/*.jsonl
  └── ...
```

### 2.3 进程模型

**Main Process（主进程）** 负责：
- 文件系统访问和 JSONL 文件发现
- chokidar 文件监控（监听新文件和文件追加写入）
- JSONL 解析和数据聚合（CPU 密集型操作放主进程，避免阻塞 UI）
- 数据缓存（避免重复解析未变化的文件）
- 系统托盘管理
- 应用生命周期管理

**Renderer Process（渲染进程）** 负责：
- React UI 渲染
- ECharts 图表
- 用户交互
- 主题管理

**Preload Script（预加载脚本）** 负责：
- 通过 contextBridge 暴露安全 API
- 渲染进程不直接访问 Node.js API（Electron 安全最佳实践）

### 2.4 数据流

```
JSONL 文件变化
    │
    ▼
chokidar 检测到变化
    │
    ▼
主进程增量解析新行
    │
    ▼
更新内存缓存（Map<filePath, ParsedRecord[]>）
    │
    ▼
通过 IPC 发送 'data-updated' 事件
    │
    ▼
渲染进程 zustand store 更新
    │
    ▼
React 组件响应式重渲染
    │
    ▼
ECharts 图表更新（增量更新，不重建）
```

---

## 3. 数据模型

### 3.1 JSONL 原始记录类型

基于对实际 JSONL 文件的分析（参见附录 A），Claude Code 的日志包含以下记录类型：

```typescript
// JSONL 文件中的一行记录
interface RawRecord {
  type: 'user' | 'assistant' | 'progress' | 'system' | 'queue-operation' | 'file-history-snapshot';
  timestamp: string;        // ISO-8601，精确到毫秒
  sessionId: string;
  uuid: string;
  parentUuid: string | null;
  cwd: string;              // 工作目录，可用于识别 project
  version: string;          // Claude Code 版本
  gitBranch?: string;
  agentId?: string;         // Subagent 专有
  message?: {
    role: 'user' | 'assistant';
    model?: string;          // 如 'claude-sonnet-4-6', 'glm-4.7' 等
    content: ContentBlock[];
    usage?: UsageData;
  };
  // system 类型专有
  subtype?: 'turn_duration' | 'compact_boundary';
  durationMs?: number;
  // file-history-snapshot 专有
  snapshot?: object;
}

interface UsageData {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens: number;
  cache_creation_input_tokens: number;
  server_tool_use?: {
    web_search_requests: number;
    web_fetch_requests: number;
  };
  service_tier?: string;
  speed?: string;
}

type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'thinking'; thinking: string }
  | { type: 'tool_use'; id: string; name: string; input: object }
  | { type: 'tool_result'; tool_use_id: string; content: string };
```

### 3.2 应用内部数据模型

```typescript
// 解析后的单条 token 消耗记录
interface TokenRecord {
  timestamp: Date;
  sessionId: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreateTokens: number;
  isSubagent: boolean;
  agentId: string;
  projectPath: string;       // 从 cwd 推断
  fileName: string;          // 源文件名
}

// 分钟级聚合桶
interface MinuteBucket {
  minute: string;            // 'YYYY-MM-DDTHH:mm'
  input: number;
  output: number;
  cacheRead: number;
  cacheCreate: number;
  requestCount: number;
}

// Session 聚合
interface SessionSummary {
  id: string;
  sessionId: string;
  isSubagent: boolean;
  agentId: string;
  model: string;
  firstTimestamp: Date;
  lastTimestamp: Date;
  firstUserMessage: string;
  totalInput: number;
  totalOutput: number;
  totalCacheRead: number;
  requestCount: number;
}

// 模型聚合
interface ModelSummary {
  model: string;
  totalInput: number;
  totalOutput: number;
  totalCacheRead: number;
  requestCount: number;
  percentage: number;
}

// 项目信息
interface ProjectInfo {
  path: string;              // ~/.claude/projects/<hash>
  workingDir: string;        // 从 cwd 推断的实际项目路径
  sessionCount: number;
  totalTokens: number;
  lastActive: Date;
}
```

### 3.3 缓存策略

```typescript
// 文件级缓存，避免重复解析
interface FileCache {
  filePath: string;
  lastSize: number;          // 上次解析时的文件大小
  lastModified: number;      // 上次修改时间
  records: TokenRecord[];    // 已解析的记录
  lineCount: number;         // 已解析的行数
}
```

增量解析策略：
- 文件大小增长 → 仅解析新增行（从 lineCount 位置开始读取）
- 文件大小不变 → 跳过
- 文件被删除 → 从缓存中移除

---

## 4. 目录结构

```
cc-monitor/
├── electron/                      # ── Electron 主进程 ──
│   ├── main.ts                    # 主进程入口，窗口创建，应用生命周期
│   ├── preload.ts                 # contextBridge API 定义
│   ├── services/
│   │   ├── watcher.ts             # chokidar 文件监控服务
│   │   ├── parser.ts              # JSONL 增量解析器
│   │   ├── cache.ts               # 文件级数据缓存
│   │   ├── aggregator.ts          # 数据聚合（分钟/模型/session）
│   │   ├── project-scanner.ts     # ~/.claude/projects/ 目录扫描
│   │   └── tray.ts                # 系统托盘
│   └── ipc/
│       ├── channels.ts            # IPC 频道名常量
│       └── handlers.ts            # IPC 请求处理器
│
├── src/                           # ── React 渲染进程 ──
│   ├── main.tsx                   # React 入口
│   ├── App.tsx                    # 根组件，路由/布局
│   │
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Header.tsx         # 顶栏：logo、项目选择器、主题切换
│   │   │   ├── Sidebar.tsx        # 侧栏：项目列表（v0.2+）
│   │   │   └── StatsBar.tsx       # 顶部统计卡片行
│   │   ├── charts/
│   │   │   ├── MinuteTimeline.tsx  # 分钟级 token 时间线（ECharts 堆叠面积图）
│   │   │   ├── ModelPie.tsx        # 模型用量分布（ECharts 环形图）
│   │   │   └── WindowGauge.tsx     # 5小时窗口仪表盘
│   │   ├── tables/
│   │   │   └── SessionTable.tsx    # Session / Subagent 明细表
│   │   └── common/
│   │       ├── TokenBadge.tsx      # Token 数值展示组件
│   │       └── EmptyState.tsx      # 空状态引导
│   │
│   ├── hooks/
│   │   ├── useTokenData.ts        # 订阅主进程数据更新
│   │   ├── useProjects.ts         # 项目列表和切换
│   │   └── useTheme.ts            # 主题管理
│   │
│   ├── stores/
│   │   ├── dataStore.ts           # zustand: token 数据 store
│   │   └── settingsStore.ts       # zustand: 用户设置（plan、主题等）
│   │
│   ├── lib/
│   │   ├── ipc.ts                 # 封装 preload API 调用
│   │   ├── format.ts              # 数字格式化工具（fmtK, fmtN 等）
│   │   ├── theme.ts               # ECharts 主题定义（dark/light）
│   │   └── constants.ts           # Plan 限额、颜色常量等
│   │
│   ├── types/
│   │   ├── data.ts                # 数据模型类型（TokenRecord 等）
│   │   ├── ipc.ts                 # IPC 通信类型
│   │   └── electron.d.ts          # preload API 类型声明
│   │
│   └── styles/
│       └── globals.css            # Tailwind 入口 + 全局样式
│
├── resources/                     # ── 静态资源 ──
│   ├── icon.png                   # 应用图标 1024x1024
│   ├── icon.ico                   # Windows 图标
│   ├── icon.icns                  # macOS 图标
│   └── tray-icon.png              # 托盘图标 16x16 / 32x32
│
├── package.json
├── pnpm-lock.yaml
├── tsconfig.json                  # 根 TS 配置
├── tsconfig.node.json             # 主进程 TS 配置
├── tsconfig.web.json              # 渲染进程 TS 配置
├── electron.vite.config.ts        # electron-vite 配置
├── tailwind.config.ts
├── components.json                # shadcn/ui 配置
├── electron-builder.yml           # 打包配置
├── .eslintrc.cjs
├── .prettierrc
├── .gitignore
├── LICENSE                        # MIT
├── README.md
├── CHANGELOG.md
└── .github/
    └── workflows/
        ├── ci.yml                 # PR 检查：lint + type-check + build
        └── release.yml            # tag 触发：构建 + 发布 GitHub Release
```

---

## 5. IPC 通信设计

### 5.1 频道定义

```typescript
// electron/ipc/channels.ts

export const IPC = {
  // ── 渲染进程 → 主进程（请求） ──
  GET_PROJECTS: 'get-projects',           // 获取项目列表
  GET_TOKEN_DATA: 'get-token-data',       // 获取指定项目的 token 数据
  SELECT_DIRECTORY: 'select-directory',   // 打开目录选择对话框
  GET_SETTINGS: 'get-settings',           // 读取用户设置
  SAVE_SETTINGS: 'save-settings',         // 保存用户设置
  EXPORT_DATA: 'export-data',            // 导出数据
  REFRESH: 'refresh',                     // 手动刷新

  // ── 主进程 → 渲染进程（推送事件） ──
  DATA_UPDATED: 'data-updated',           // 数据有更新
  WATCH_ERROR: 'watch-error',             // 监控出错
  WATCH_STATUS: 'watch-status',           // 监控状态变化
} as const;
```

### 5.2 Preload API

```typescript
// electron/preload.ts
// 通过 contextBridge 暴露给渲染进程的安全 API

export interface ElectronAPI {
  // 数据查询
  getProjects(): Promise<ProjectInfo[]>;
  getTokenData(projectPath: string): Promise<TokenRecord[]>;
  refreshData(): Promise<void>;

  // 文件操作
  selectDirectory(): Promise<string | null>;
  exportData(format: 'csv' | 'json', data: object): Promise<string>;

  // 设置
  getSettings(): Promise<AppSettings>;
  saveSettings(settings: Partial<AppSettings>): Promise<void>;

  // 事件监听
  onDataUpdated(callback: (projectPath: string) => void): () => void;
  onWatchStatus(callback: (status: WatchStatus) => void): () => void;
}
```

### 5.3 设置数据结构

```typescript
interface AppSettings {
  // 监控设置
  claudeDataDir: string;          // 默认 ~/.claude/projects/
  watchEnabled: boolean;          // 是否启动文件监控
  refreshIntervalMs: number;      // 轮询间隔（作为 chokidar 的补充）

  // 显示设置
  theme: 'light' | 'dark' | 'system';
  planType: 'pro' | 'max5' | 'max20' | 'custom';
  customTokenLimit: number;       // 自定义 plan 的 token 上限

  // 窗口设置
  minimizeToTray: boolean;
  launchAtStartup: boolean;
}
```

---

## 6. 核心模块详设

### 6.1 文件监控服务 (watcher.ts)

```
启动流程:
1. 扫描 claudeDataDir 下的所有项目目录
2. 对每个项目的 sessions/ 和 subagents/ 目录建立 chokidar 监控
3. 监听 'add' (新文件) 和 'change' (文件变化) 事件
4. 文件变化时触发增量解析

监控范围:
~/.claude/projects/
├── <hash-1>/
│   ├── <session-id>.jsonl          ← 监控
│   └── subagents/
│       └── agent-<id>.jsonl        ← 监控
├── <hash-2>/
│   └── ...
└── ...

性能策略:
- chokidar 的 awaitWriteFinish 选项，等待文件写入完成后再触发
- 100ms 防抖，合并短时间内的多次变化
- 仅解析新增行（通过记录已解析的字节偏移量）
```

### 6.2 JSONL 增量解析器 (parser.ts)

```
解析策略:
1. 读取文件 → 按行分割 → JSON.parse 每行
2. 仅提取 type='assistant' 且 usage > 0 的记录（token 数据源）
3. 同时提取 type='user' 的纯文本消息（用于 session 标题）
4. 同时提取 type='system' 的 turn_duration（用于效率分析）
5. 忽略 progress / file-history-snapshot / queue-operation

增量解析:
- 记录每个文件的已解析偏移量（字节数）
- 下次解析时从偏移量位置开始读取
- 如果文件被截断（偏移量 > 当前文件大小），全量重新解析

错误处理:
- 单行 JSON.parse 失败 → 跳过该行，继续解析
- 文件读取失败 → 记录错误，不影响其他文件
- 编码问题 → 统一 UTF-8 处理
```

### 6.3 数据聚合器 (aggregator.ts)

```
输入: TokenRecord[]
输出:

1. aggregateByMinute(records, timeRange?) → MinuteBucket[]
   - 按 timestamp 截取到分钟
   - 填充时间间隙（无数据的分钟填 0）
   - 可选 timeRange 筛选

2. aggregateByModel(records) → ModelSummary[]
   - 按 model 字段分组
   - 计算各模型的 token 总量和占比

3. aggregateBySession(records, allRecords) → SessionSummary[]
   - 主 session 和 subagent 分别聚合
   - 从 user 记录中提取首条用户消息作为 session 标题

4. calculateBurnRate(records) → BurnRateInfo
   - 计算最近 N 分钟的平均消耗速率
   - 基于速率预测剩余额度耗尽时间
   - 输出: { tokensPerMinute, estimatedMinutesLeft, usedPercentage }
```

---

## 7. UI 设计

### 7.1 页面布局

```
┌─────────────────────────────────────────────────────────┐
│ [Logo] CC Monitor    [项目选择器 ▼]  [☀️/🌙] [⚙️]       │  ← Header
├─────────────────────────────────────────────────────────┤
│ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐               │
│ │Input│ │Outpt│ │Cache│ │ Req │ │Time │               │  ← StatsBar
│ │152K │ │ 66K │ │15.7M│ │ 174 │ │59min│               │
│ └─────┘ └─────┘ └─────┘ └─────┘ └─────┘               │
├────────────────────────────────┬────────────────────────┤
│                                │                        │
│   分钟级 Token 时间线           │   模型用量分布           │  ← 左：主图表
│   (ECharts 堆叠面积图)          │   (ECharts 环形图)      │     右：辅助面板
│   [dataZoom 滚动条]            │                        │
│                                ├────────────────────────┤
│                                │                        │
│                                │   5 小时窗口预测         │
│                                │   [进度条 + 详情]        │
│                                │                        │
├────────────────────────────────┴────────────────────────┤
│                                                         │
│   Session / Subagent 明细表                               │  ← 底部表格
│   [Session] [时间范围] [模型] [Input] [Output] [Cache]    │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 7.2 ECharts 图表配置要点

**分钟级时间线 (MinuteTimeline.tsx):**
- 类型: 堆叠面积图 (stacked area)
- 三层: cache_read (底) → input (中) → output (顶)
- 渐变填充 + 细描边线
- 底部 dataZoom 滑动条，支持框选放大
- hover 时显示详细 tooltip（分钟、各 token 数、请求数）
- 平滑过渡动画

**模型分布 (ModelPie.tsx):**
- 类型: 环形图 (doughnut)
- 中心显示总 token 数
- hover 时外环微微放大 + 显示详情
- 使用 nightingale 玫瑰图模式（面积 = 数值）

**5小时窗口 (WindowGauge.tsx):**
- 进度条 + 渐变色（绿 → 黄 → 红）
- 数据项: 已消耗/上限、使用率、burn rate、预计耗尽时间

### 7.3 主题设计

**Dark Theme:**
- 背景: #0a0e17 → #111827 → #151d2e（三层递进）
- 文字: #e2e8f0 / #8892a8 / #4a5568
- 强调色: blue #3b82f6, purple #8b5cf6, cyan #06b6d4, green #10b981
- 卡片: 无阴影，1px 边框

**Light Theme:**
- 背景: #f5f7fa → #ffffff
- 文字: #1a202c / #64748b / #94a3b8
- 强调色: 同 dark 但饱和度微调
- 卡片: 柔和阴影 + 1px 浅色边框

---

## 8. 打包与分发

### 8.1 electron-builder 配置

```yaml
# electron-builder.yml
appId: com.ccmonitor.app
productName: CC Monitor
directories:
  output: dist
  buildResources: resources

win:
  target:
    - target: nsis
      arch: [x64, arm64]
  icon: resources/icon.ico

mac:
  target:
    - target: dmg
      arch: [x64, arm64]
  icon: resources/icon.icns
  category: public.app-category.developer-tools

linux:
  target:
    - target: AppImage
      arch: [x64, arm64]
  icon: resources/icon.png
  category: Development

nsis:
  oneClick: false
  allowToChangeInstallationDirectory: true
  createDesktopShortcut: true
```

### 8.2 GitHub Actions 自动发布

触发条件: 推送 `v*` 格式的 tag

流程:
1. 在 Windows / macOS / Linux 三个 runner 上并行构建
2. 签名（可选，需要 code signing certificate）
3. 上传到 GitHub Release 页面
4. 自动生成 changelog

---

## 9. 开发计划

### Phase 1 — MVP (v0.1.0)

目标: 可用的桌面应用，核心四大功能可用。

任务列表:

1. **项目初始化**
   - electron-vite 项目脚手架
   - TypeScript 配置
   - Tailwind CSS + shadcn/ui 集成
   - ECharts 集成
   - ESLint + Prettier 配置

2. **主进程核心**
   - JSONL 解析器（含类型定义）
   - 文件监控服务
   - 数据缓存和增量解析
   - 数据聚合器
   - IPC 通信层

3. **渲染进程 UI**
   - 布局组件（Header, StatsBar）
   - 分钟级时间线图表
   - 模型分布图表
   - 5 小时窗口预测
   - Session / Subagent 表格
   - 亮暗主题切换

4. **打包与测试**
   - electron-builder 打包配置
   - Windows 安装包测试
   - README 文档

预计工作量: 3-5 天

### Phase 2 — 增强 (v0.2.0)

- 多项目支持 + 侧栏切换
- 数据导出 (CSV / JSON)
- 系统托盘常驻
- 日/周/月趋势视图
- 设置页面（自定义 data 目录、plan 上限等）

### Phase 3 — 打磨 (v0.3.0)

- 开机自启动
- 自动更新 (electron-updater)
- 国际化 (i18n, 英/中)
- 性能优化（虚拟列表、Web Worker 解析）
- GitHub Actions CI/CD

---

## 10. 开源相关

### 10.1 仓库信息

- 仓库名: `cc-monitor`
- License: MIT
- 语言: TypeScript

### 10.2 README 结构

```markdown
# CC Monitor
> Real-time token usage monitor for Claude Code

[截图]

## Features
## Download
## Quick Start
## Development
## Contributing
## License
```

### 10.3 贡献指南

- Issue 模板（Bug Report / Feature Request）
- PR 模板
- 代码风格: ESLint + Prettier 强制

---

## 附录 A: JSONL 数据分析报告

基于用户提供的实际 JSONL 样本（session `9b263f22-3312-4ce9-a228-3417516b71f0`）：

| 指标 | 数值 |
|------|------|
| 总记录数 | 1,653 行 |
| assistant 记录 | 473 条 |
| 有 usage>0 的记录 | 174 条 |
| user 记录 | 247 条（26 条纯文本，221 条工具结果）|
| progress 记录 | 868 条 |
| system 记录 | 14 条 |
| 时间范围 | 13:23 ~ 14:22（约 59 分钟）|
| 活跃分钟数 | 47 分钟 |
| 总 Input Tokens | 151,954 |
| 总 Output Tokens | 66,384 |
| 总 Cache Read Tokens | 15,752,704 |
| Subagent 数量 | 15 个 |
| 模型 | glm-4.7（custom model）|
| Claude Code 版本 | 2.1.63 |
| timestamp 精度 | 毫秒级 |

---

## 附录 B: 竞品对比

| 工具 | 类型 | 分钟级 | 实时 | 可视化 | 多项目 | subagent |
|------|------|--------|------|--------|--------|----------|
| /cost 命令 | CLI | ✗ | ✗ | ✗ | ✗ | ✗ |
| ccusage | CLI | ✗ | ✗ | ✗ | ✓ | ✗ |
| Claude-Code-Usage-Monitor | TUI | ✓ | ✓ | 有限 | ✗ | ✗ |
| **CC Monitor (本项目)** | **桌面应用** | **✓** | **✓** | **✓** | **✓** | **✓** |
