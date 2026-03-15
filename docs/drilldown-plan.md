# 数据下钻功能规划

## 概述

为 CC Monitor 各模块添加数据下钻能力，用户可从概览卡片/图表点击进入详情面板，逐层深入分析 Token 消耗、费用、使用模式等数据。

## 交互模式

所有下钻统一采用 **右侧滑出面板（Drawer）** 形式：
- 从右侧滑入，宽度 480px，覆盖在主界面之上
- 顶部显示标题 + 关闭按钮
- 面板内可滚动，支持多个图表/表格纵向排列
- 点击遮罩层或关闭按钮收回
- 面板内容根据触发来源动态渲染

共享组件：`DrilldownDrawer.tsx` — 通用 Drawer 容器，接收 title + children。

---

## P0: 预估花费下钻

### 触发方式
点击 StatsBar「预估花费」卡片

### 面板内容

#### 1. 费用总览头部
- 总花费金额（大字）+ 输入/输出/缓存分项金额
- 日均花费 = 总花费 / 活跃天数

#### 2. 每日花费趋势（折线图）
- 横轴：日期（近 14 天）
- 纵轴：花费（$）
- 三条线：输入费用、输出费用、缓存费用
- 可切换 7d / 14d / 30d 范围

#### 3. 按项目费用排行（横向柱状图）
- 每个项目一行：项目名 + 柱状条 + 金额
- 按费用降序排列，最多显示 10 个，其余合并为「其他」
- 柱状条内按输入/输出/缓存分色堆叠

#### 4. 按模型费用排行（横向柱状图）
- 每个模型一行：模型名 + 柱状条 + 金额
- 按费用降序排列

#### 5. 最贵会话 Top 10（表格）
- 列：会话摘要 | 项目 | 模型 | 费用 | 时间
- 按单次会话总费用降序

### 数据来源
- `TokenRecord[]` 逐条计算费用（model + pricing config）
- `DayBucket[]` 按天聚合
- `SessionSummary[]` 按会话聚合

---

## P1: 会话详情下钻

### 触发方式
点击 SessionTable 中某一行会话

### 面板内容

#### 1. 会话信息头部
- 会话 ID（完整）、项目名、首条消息摘要
- 开始时间、持续时长、请求次数

#### 2. 请求时间线（散点/柱状图）
- 横轴：时间
- 纵轴：Token 消耗
- 每个点代表一次请求，颜色区分输入/输出
- 悬浮显示该请求的模型、Token 明细

#### 3. Token 消耗分布（堆叠柱状图）
- 将会话内的请求按时间顺序排列
- 每个柱子 = 一次请求，堆叠输入/输出/缓存

#### 4. 模型使用明细
- 该会话使用了哪些模型，各自的请求次数和 Token 占比
- 如有模型切换，标注切换时间点

#### 5. Subagent 关系（如有）
- 主会话与 subagent 的父子关系列表
- 每个 subagent 的 Token 消耗、请求数
- 占主会话总消耗的百分比

### 数据来源
- `TokenRecord[]` 按 `sessionId` 过滤
- `SessionSummary` 当前会话 + 关联 subagent

---

## P2-A: 模型详情下钻

### 触发方式
点击 ModelPie 饼图扇区或模型列表中的某一行

### 面板内容

#### 1. 模型信息头部
- 模型名称、总 Token、总请求数、占比

#### 2. 使用趋势（折线图）
- 该模型近 14 天的每日 Token 消耗趋势
- 对比线：其他模型合计（虚线）

#### 3. 项目分布（横向柱状图）
- 该模型在各项目中的使用量排行

#### 4. 效率指标
- 平均每次请求的输入/输出 Token
- 输出/输入比率（模型"话多"程度）
- 缓存命中率

#### 5. 关联会话列表
- 使用该模型的会话列表（简化版 SessionTable）
- 按 Token 消耗降序，最多 10 条

### 数据来源
- `TokenRecord[]` 按 `model` 过滤
- `DayBucket` 需扩展为按模型分组（或从 TokenRecord 实时聚合）
- `SessionSummary[]` 按 models 过滤

---

## P2-B: 项目详情下钻

### 触发方式
点击 ProjectPie 饼图扇区或项目列表中的某一行

### 面板内容

#### 1. 项目信息头部
- 项目名称（完整路径）、总 Token、会话数、活跃时间范围

#### 2. 消耗趋势（折线图）
- 该项目近 14 天的每日 Token 消耗
- 堆叠面积图：输入/输出/缓存

#### 3. 模型分布（饼图 + 列表）
- 该项目使用了哪些模型，各自占比

#### 4. 费用明细
- 该项目的预估总花费
- 按模型拆分的费用

#### 5. 关联会话列表
- 该项目下的会话列表
- 按时间降序，最多 10 条

### 数据来源
- `TokenRecord[]` 按 `projectPath` 过滤
- `SessionSummary[]` 按 `projectPath` 过滤

---

## P3: 使用模式下钻

### 触发方式
点击 StatsBar「请求次数」卡片

### 面板内容

#### 1. 小时 x 星期 热力图
- 横轴：小时（0-23）
- 纵轴：星期（Mon-Sun）
- 颜色深浅：请求次数
- 快速识别使用高峰时段

#### 2. 每小时请求密度（柱状图）
- 24 根柱子，展示全时段请求分布
- 柱内按模型分色

#### 3. 每日活跃时段（甘特图风格）
- 近 7 天每天的活跃起止时间段
- 条形长度 = 活跃时长

### 数据来源
- `TokenRecord[]` 按 timestamp 的 hour/dayOfWeek 聚合
- `MinuteBucket[]` 按小时聚合

---

## 实现计划

### Phase 1: 基础设施
1. 创建 `DrilldownDrawer` 通用组件（滑出面板容器）
2. 在 `dataStore` 中添加 drilldown 状态管理（当前打开的面板类型 + 参数）
3. 在 `App.tsx` 中挂载 Drawer

### Phase 2: P0 预估花费下钻
4. 实现费用总览头部
5. 实现每日费用趋势图
6. 实现按项目费用排行
7. 实现按模型费用排行
8. 实现最贵会话 Top 10

### Phase 3: P1 会话详情下钻
9. SessionTable 行点击触发 Drawer
10. 实现会话信息头部
11. 实现请求时间线
12. 实现 Token 分布图
13. 实现 subagent 关系展示

### Phase 4: P2 模型 & 项目下钻
14. ModelPie 点击触发下钻
15. 实现模型详情面板
16. ProjectPie 点击触发下钻
17. 实现项目详情面板

### Phase 5: P3 使用模式下钻
18. 请求次数卡片点击触发
19. 实现小时 x 星期热力图
20. 实现请求密度图
21. 实现每日活跃时段图

---

## 文件结构

```
src/components/
  drilldown/
    DrilldownDrawer.tsx       # 通用 Drawer 容器
    CostDrilldown.tsx         # P0: 花费下钻
    SessionDrilldown.tsx      # P1: 会话下钻
    ModelDrilldown.tsx        # P2-A: 模型下钻
    ProjectDrilldown.tsx      # P2-B: 项目下钻
    UsagePatternDrilldown.tsx # P3: 使用模式下钻
```

## 状态管理

在 `dataStore` 中新增：

```typescript
// 下钻面板状态
drilldown: {
  type: 'cost' | 'session' | 'model' | 'project' | 'usage-pattern' | null
  params: {
    sessionId?: string    // P1: 具体会话
    model?: string        // P2-A: 具体模型
    projectPath?: string  // P2-B: 具体项目
  }
} | null

openDrilldown: (type, params?) => void
closeDrilldown: () => void
```
