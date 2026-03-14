// Scanner for ~/.claude/projects/ to discover projects and their JSONL files
import { readdirSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import type { ProjectInfo } from '../../src/types/data'
import { parseJsonlFile } from './parser'

/**
 * Get the default Claude data directory based on the current OS.
 */
export function getDefaultClaudeDir(): string {
  return join(homedir(), '.claude', 'projects')
}

/**
 * Recursively find all .jsonl files under a directory.
 */
function findJsonlFiles(dir: string): string[] {
  const results: string[] = []

  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return results
  }

  for (const entry of entries) {
    const fullPath = join(dir, entry.name)
    if (entry.isDirectory()) {
      results.push(...findJsonlFiles(fullPath))
    } else if (entry.isFile() && entry.name.endsWith('.jsonl')) {
      results.push(fullPath)
    }
  }

  return results
}

/**
 * Scan the Claude projects directory and return discovered projects.
 * Each subdirectory containing .jsonl files is treated as a project.
 */
export function scanProjects(baseDir?: string): ProjectInfo[] {
  const dir = baseDir || getDefaultClaudeDir()
  const projects: ProjectInfo[] = []

  let topEntries
  try {
    topEntries = readdirSync(dir, { withFileTypes: true })
  } catch {
    // Directory doesn't exist yet
    return projects
  }

  for (const entry of topEntries) {
    if (!entry.isDirectory()) continue

    const projectDir = join(dir, entry.name)
    const jsonlFiles = findJsonlFiles(projectDir)
    if (jsonlFiles.length === 0) continue

    let totalTokens = 0
    let lastActive = new Date(0)
    let workingDir = ''
    const sessionIds = new Set<string>()

    for (const filePath of jsonlFiles) {
      try {
        const result = parseJsonlFile(filePath)
        for (const record of result.tokenRecords) {
          totalTokens += record.inputTokens + record.outputTokens
          sessionIds.add(record.sessionId)
          if (record.timestamp > lastActive) {
            lastActive = record.timestamp
          }
          if (!workingDir && record.projectPath) {
            workingDir = record.projectPath
          }
        }
      } catch {
        // Skip files that fail to parse
        continue
      }
    }

    projects.push({
      path: projectDir,
      workingDir: workingDir || projectDir,
      sessionCount: sessionIds.size,
      totalTokens,
      lastActive,
    })
  }

  return projects.sort((a, b) => b.lastActive.getTime() - a.lastActive.getTime())
}
