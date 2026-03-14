// JSONL incremental parser for extracting token records from Claude Code logs
import { readFileSync } from 'fs'
import type { RawRecord, TokenRecord } from '../../src/types/data'

export interface ParseResult {
  tokenRecords: TokenRecord[]
  userMessages: Map<string, string> // sessionId → first user text message
  turnDurations: Map<string, number[]> // sessionId → durationMs values
}

/**
 * Parse a JSONL file and extract token records, user messages, and turn durations.
 * Supports incremental parsing by skipping the first `startLine` lines.
 */
export function parseJsonlFile(filePath: string, startLine = 0): ParseResult {
  const content = readFileSync(filePath, 'utf-8')
  const lines = content.split('\n')

  const tokenRecords: TokenRecord[] = []
  const userMessages = new Map<string, string>()
  const turnDurations = new Map<string, number[]>()
  const fileName = filePath

  for (let i = startLine; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    let record: RawRecord
    try {
      record = JSON.parse(line) as RawRecord
    } catch {
      // Skip malformed lines
      continue
    }

    // Extract user plain text messages (for session titles)
    if (record.type === 'user' && record.message?.content) {
      const content = record.message.content
      if (typeof content === 'string' && !userMessages.has(record.sessionId)) {
        userMessages.set(record.sessionId, content)
      } else if (Array.isArray(content)) {
        const textBlock = content.find((b) => b.type === 'text')
        if (textBlock && 'text' in textBlock && !userMessages.has(record.sessionId)) {
          userMessages.set(record.sessionId, textBlock.text)
        }
      }
    }

    // Extract system turn_duration records
    if (
      record.type === 'system' &&
      record.subtype === 'turn_duration' &&
      record.durationMs != null
    ) {
      const durations = turnDurations.get(record.sessionId) ?? []
      durations.push(record.durationMs)
      turnDurations.set(record.sessionId, durations)
    }

    // Extract assistant records with non-zero token usage
    if (record.type === 'assistant' && record.message?.usage) {
      const usage = record.message.usage
      const hasTokens =
        usage.input_tokens > 0 ||
        usage.output_tokens > 0 ||
        usage.cache_read_input_tokens > 0 ||
        usage.cache_creation_input_tokens > 0

      if (!hasTokens) continue

      const projectPath = record.cwd || ''

      tokenRecords.push({
        timestamp: new Date(record.timestamp),
        sessionId: record.sessionId,
        model: record.message.model || 'unknown',
        inputTokens: usage.input_tokens,
        outputTokens: usage.output_tokens,
        cacheReadTokens: usage.cache_read_input_tokens,
        cacheCreateTokens: usage.cache_creation_input_tokens,
        isSubagent: !!record.agentId,
        agentId: record.agentId || '',
        projectPath,
        fileName,
      })
    }
  }

  return { tokenRecords, userMessages, turnDurations }
}

/**
 * Count total lines in a file (for incremental parsing tracking).
 */
export function countLines(filePath: string): number {
  const content = readFileSync(filePath, 'utf-8')
  return content.split('\n').length
}
