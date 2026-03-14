// Quick verification for aggregator against sample data
import { parseJsonlFile } from '../electron/services/parser'
import { aggregateByMinute, aggregateByModel, aggregateBySession } from '../electron/services/aggregator'
import { resolve } from 'path'

const fixtures = resolve(__dirname, 'fixtures')
const mainResult = parseJsonlFile(resolve(fixtures, '9b263f22-3312-4ce9-a228-3417516b71f0.jsonl'))
const agentResult = parseJsonlFile(resolve(fixtures, 'agent-a0df1a849c5582422.jsonl'))

const allRecords = [...mainResult.tokenRecords, ...agentResult.tokenRecords]
const allMessages = new Map([...mainResult.userMessages, ...agentResult.userMessages])

const minutes = aggregateByMinute(allRecords)
const models = aggregateByModel(allRecords)
const sessions = aggregateBySession(allRecords, allMessages)

console.log(`Active minute buckets: ${minutes.length}`)
console.log(`Models:`, models.map((m) => `${m.model} (${m.percentage.toFixed(1)}%)`))
console.log(`Sessions: ${sessions.length}`)
console.log(`Subagent sessions: ${sessions.filter((s) => s.isSubagent).length}`)
