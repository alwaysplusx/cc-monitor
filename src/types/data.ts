// Data model types for JSONL records, aggregation buckets, and project info

// JSONL raw record content block types
export type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'thinking'; thinking: string }
  | { type: 'tool_use'; id: string; name: string; input: object }
  | { type: 'tool_result'; tool_use_id: string; content: string }

// Token usage data from assistant messages
export interface UsageData {
  input_tokens: number
  output_tokens: number
  cache_read_input_tokens: number
  cache_creation_input_tokens: number
  server_tool_use?: {
    web_search_requests: number
    web_fetch_requests: number
  }
  service_tier?: string
  speed?: string
}

// Raw JSONL record as written by Claude Code
export interface RawRecord {
  type:
    | 'user'
    | 'assistant'
    | 'progress'
    | 'system'
    | 'queue-operation'
    | 'file-history-snapshot'
  timestamp: string
  sessionId: string
  uuid: string
  parentUuid: string | null
  cwd: string
  version: string
  gitBranch?: string
  agentId?: string
  message?: {
    role: 'user' | 'assistant'
    model?: string
    content: ContentBlock[]
    usage?: UsageData
  }
  subtype?: 'turn_duration' | 'compact_boundary'
  durationMs?: number
  snapshot?: object
}

// Parsed single token consumption record
export interface TokenRecord {
  timestamp: Date
  sessionId: string
  model: string
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheCreateTokens: number
  isSubagent: boolean
  agentId: string
  projectPath: string
  fileName: string
}

// Minute-level aggregation bucket
export interface MinuteBucket {
  minute: string // 'YYYY-MM-DDTHH:mm'
  input: number
  output: number
  cacheRead: number
  cacheCreate: number
  requestCount: number
}

// Hour-level aggregation bucket
export interface HourBucket {
  hour: string // 'YYYY-MM-DDTHH'
  input: number
  output: number
  cacheRead: number
  cacheCreate: number
  requestCount: number
}

// Day-level aggregation bucket
export interface DayBucket {
  day: string // 'YYYY-MM-DD'
  input: number
  output: number
  cacheRead: number
  cacheCreate: number
  requestCount: number
}

// Month-level aggregation bucket
export interface MonthBucket {
  month: string // 'YYYY-MM'
  input: number
  output: number
  cacheRead: number
  cacheCreate: number
  requestCount: number
}

// Session-level aggregation summary
export interface SessionSummary {
  id: string
  sessionId: string
  isSubagent: boolean
  agentId: string
  model: string
  projectPath: string
  sessionFilePath: string
  firstTimestamp: Date
  lastTimestamp: Date
  firstUserMessage: string
  totalInput: number
  totalOutput: number
  totalCacheRead: number
  requestCount: number
  avgDurationMs?: number
}

// Model-level aggregation summary
export interface ModelSummary {
  model: string
  totalInput: number
  totalOutput: number
  totalCacheRead: number
  requestCount: number
  percentage: number
}

// Project information
export interface ProjectInfo {
  path: string
  workingDir: string
  sessionCount: number
  totalTokens: number
  lastActive: Date
}

// File-level cache entry
export interface FileCacheEntry {
  filePath: string
  lastSize: number
  lastModified: number
  records: TokenRecord[]
  lineCount: number
}

// Model switch event
export interface ModelSwitch {
  timestamp: Date
  fromModel: string
  toModel: string
}
