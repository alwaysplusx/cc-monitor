// JSONL incremental parser for extracting token records from Claude Code logs
import { readFileSync, openSync, readSync, fstatSync, closeSync } from 'fs'
import type { RawRecord, TokenRecord } from '../../src/types/data'

export interface ParseResult {
  tokenRecords: TokenRecord[]
  userMessages: Map<string, string> // sessionId → first user text message
  turnDurations: Map<string, number[]> // sessionId → durationMs values
  bytesRead: number // total bytes consumed (for byte-offset tracking)
}

/**
 * Parse a JSONL file and extract token records, user messages, and turn durations.
 * Supports incremental parsing by reading from `byteOffset` onwards.
 */
export function parseJsonlFile(filePath: string, byteOffset = 0): ParseResult {
  let content: string

  if (byteOffset > 0) {
    // Incremental: read only from byteOffset to end of file
    const fd = openSync(filePath, 'r')
    try {
      const stat = fstatSync(fd)
      const remaining = stat.size - byteOffset
      if (remaining <= 0) {
        return { tokenRecords: [], userMessages: new Map(), turnDurations: new Map(), bytesRead: stat.size }
      }
      const buf = Buffer.alloc(remaining)
      readSync(fd, buf, 0, remaining, byteOffset)
      content = buf.toString('utf-8')
    } finally {
      closeSync(fd)
    }
  } else {
    content = readFileSync(filePath, 'utf-8')
  }

  const totalBytesRead = byteOffset + Buffer.byteLength(content, 'utf-8')
  const lines = content.split('\n')

  const tokenRecords: TokenRecord[] = []
  const userMessages = new Map<string, string>()
  const turnDurations = new Map<string, number[]>()
  const fileName = filePath

  for (let i = 0; i < lines.length; i++) {
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

  return { tokenRecords, userMessages, turnDurations, bytesRead: totalBytesRead }
}
