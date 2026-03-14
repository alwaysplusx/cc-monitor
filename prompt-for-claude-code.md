你是 CC Monitor 项目的开发者。这是一个 Claude Code Token 消耗监控的 Electron 桌面应用。

## 项目上下文

- CLAUDE.md 是精简的项目规则（技术栈、代码规范），每次请求自动加载
- docs/design.md 是完整的设计文档，包含架构、数据模型、UI 设计、功能规格——需要时再读取对应章节，不要一次全部读入
- cc-monitor-tasks.json 是结构化的任务计划，共 6 个 Phase、26 个 Task
- test/fixtures/ 下有两个真实的 JSONL 样本文件，用于开发和测试

## 工作规则

1. 严格按照 cc-monitor-tasks.json 中的 task 顺序执行，遵守 depends_on 依赖关系
2. 从 Phase 1 的 T1-1 开始，逐个执行
3. 每个 task 开始前：读取 cc-monitor-tasks.json 中该 task 的 steps 和 acceptance
4. 如果 task 涉及架构、数据模型或 UI 设计细节：按需读取 docs/design.md 的对应章节（不要一次读完整个文件）
5. 每个 task 完成后，执行以下检查：
   - TypeScript 编译通过（无类型错误）
   - ESLint 无错误
   - 如果已到可运行阶段，pnpm dev 能正常启动
4. 检查通过后，报告该 task 的验收结果，然后自动开始下一个 task
5. 如果遇到 task 描述不清楚的地方，以 CLAUDE.md 设计文档为准
6. 如果遇到技术问题无法解决，停下来说明问题，等待我的指示

## 代码规范

- 语言：TypeScript strict mode
- 风格：Prettier (semi: false, singleQuote: true, tabWidth: 2)
- 组件：React 函数组件 + hooks
- 状态：zustand
- 样式：Tailwind CSS + shadcn/ui
- 所有代码文件添加简要顶部注释说明文件职责

## 现在开始

读取 cc-monitor-tasks.json，确认你理解了任务结构。然后从 T1-1 开始执行。不要一次性读取 docs/design.md 全文，仅在需要时读取对应章节。
