// On-demand turn detail parser — reads JSONL to extract user input & assistant output for a specific turn
import { readFileSync } from 'fs'
import type { RawRecord, ContentBlock } from '../../src/types/data'

export interface TurnDetail {
  userMessage: string
  assistantText: string
  assistantThinking: string
  toolCalls: { name: string; input: string }[]
  model: string
  timestamp: string
}

/** Extract readable text from content blocks */
function extractText(content: ContentBlock[] | string | undefined): {
  text: string
  thinking: string
  tools: { name: string; input: string }[]
} {
  if (!content) return { text: '', thinking: '', tools: [] }
  if (typeof content === 'string') return { text: content, thinking: '', tools: [] }

  let text = ''
  let thinking = ''
  const tools: { name: string; input: string }[] = []

  for (const block of content) {
    if (block.type === 'text') {
      text += (text ? '\n' : '') + block.text
    } else if (block.type === 'thinking') {
      thinking += (thinking ? '\n' : '') + block.thinking
    } else if (block.type === 'tool_use') {
      const inputStr = typeof block.input === 'string'
        ? block.input
        : JSON.stringify(block.input, null, 2)
      tools.push({ name: block.name, input: inputStr.slice(0, 500) })
    }
  }

  return { text, thinking, tools }
}

/**
 * Find the turn detail for a specific assistant record in a JSONL file.
 * Matches by sessionId + timestamp, then looks backward for the preceding user message.
 */
export function getTurnDetail(
  fileName: string,
  sessionId: string,
  timestamp: string,
  contentLimit = 1000,
): TurnDetail | null {
  let content: string
  try {
    content = readFileSync(fileName, 'utf-8')
  } catch {
    return null
  }

  const lines = content.split('\n')
  const records: RawRecord[] = []

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue
    try {
      records.push(JSON.parse(trimmed) as RawRecord)
    } catch {
      continue
    }
  }

  // Find the target assistant record by sessionId + timestamp
  const targetTime = new Date(timestamp).getTime()
  let targetIdx = -1

  for (let i = 0; i < records.length; i++) {
    const r = records[i]
    if (
      r.type === 'assistant' &&
      r.sessionId === sessionId &&
      r.message?.usage &&
      Math.abs(new Date(r.timestamp).getTime() - targetTime) < 2000
    ) {
      // Pick the last assistant record near this timestamp (the one with final usage)
      if (r.message.usage.input_tokens > 0 || r.message.usage.output_tokens > 0) {
        targetIdx = i
      }
    }
  }

  if (targetIdx === -1) return null

  const targetRecord = records[targetIdx]

  // Collect all assistant content blocks for this turn (same parentUuid chain)
  let assistantText = ''
  let assistantThinking = ''
  const toolCalls: { name: string; input: string }[] = []

  // Walk backward from targetIdx to find all assistant records in this turn
  // They share the same message id or are sequential assistant records before the target
  const turnAssistantRecords: RawRecord[] = []
  for (let i = targetIdx; i >= 0; i--) {
    const r = records[i]
    if (r.sessionId !== sessionId) continue
    if (r.type === 'assistant') {
      turnAssistantRecords.unshift(r)
    } else if (r.type === 'user') {
      // Hit the user message that triggered this turn
      break
    }
  }

  for (const r of turnAssistantRecords) {
    const extracted = extractText(r.message?.content)
    if (extracted.text) assistantText += (assistantText ? '\n' : '') + extracted.text
    if (extracted.thinking) assistantThinking += (assistantThinking ? '\n' : '') + extracted.thinking
    toolCalls.push(...extracted.tools)
  }

  // Find the preceding user message
  let userMessage = ''
  for (let i = targetIdx - 1; i >= 0; i--) {
    const r = records[i]
    if (r.sessionId !== sessionId) continue
    if (r.type === 'user' && r.message?.role === 'user') {
      const msgContent = r.message.content
      if (typeof msgContent === 'string') {
        userMessage = msgContent
        break
      } else if (Array.isArray(msgContent)) {
        const textBlock = msgContent.find((b) => b.type === 'text')
        if (textBlock && 'text' in textBlock) {
          userMessage = textBlock.text
          break
        }
        // Skip tool_result type user messages, keep looking
        const hasToolResult = msgContent.some((b) => b.type === 'tool_result')
        if (hasToolResult) continue
      }
      break
    }
  }

  return {
    userMessage: userMessage.slice(0, contentLimit),
    assistantText: assistantText.slice(0, contentLimit),
    assistantThinking: assistantThinking.slice(0, Math.floor(contentLimit / 2)),
    toolCalls: toolCalls.slice(0, 10),
    model: targetRecord.message?.model || 'unknown',
    timestamp: targetRecord.timestamp,
  }
}
