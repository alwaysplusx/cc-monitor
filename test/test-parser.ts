// Quick verification script for parser against sample JSONL files
import { parseJsonlFile } from '../electron/services/parser'
import { resolve } from 'path'

const fixtures = resolve(__dirname, 'fixtures')

const mainFile = resolve(fixtures, '9b263f22-3312-4ce9-a228-3417516b71f0.jsonl')
const agentFile = resolve(fixtures, 'agent-a0df1a849c5582422.jsonl')

const mainResult = parseJsonlFile(mainFile)
const agentResult = parseJsonlFile(agentFile)

const totalRecords = mainResult.tokenRecords.length + agentResult.tokenRecords.length

console.log(`Main file: ${mainResult.tokenRecords.length} token records`)
console.log(`Agent file: ${agentResult.tokenRecords.length} token records`)
console.log(`Total: ${totalRecords} token records`)
console.log(`User messages (main): ${mainResult.userMessages.size}`)
console.log(`Models found:`, [
  ...new Set([
    ...mainResult.tokenRecords.map((r) => r.model),
    ...agentResult.tokenRecords.map((r) => r.model),
  ]),
])

if (mainResult.tokenRecords.length > 0) {
  const first = mainResult.tokenRecords[0]
  console.log(`First record: model=${first.model}, input=${first.inputTokens}, output=${first.outputTokens}, cache=${first.cacheReadTokens}`)
}
