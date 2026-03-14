// File-level data cache to avoid re-parsing unchanged JSONL files
import { statSync, readdirSync } from 'fs'
import { join } from 'path'
import type { TokenRecord } from '../../src/types/data'
import { parseJsonlFile } from './parser'

interface CacheEntry {
  lastSize: number
  lastModified: number
  records: TokenRecord[]
  lineCount: number
  userMessages: Map<string, string>
}

export class FileCache {
  private cache = new Map<string, CacheEntry>()

  /**
   * Get records from cache if file unchanged, otherwise parse (incrementally if possible).
   */
  getOrParse(filePath: string): TokenRecord[] {
    let stat
    try {
      stat = statSync(filePath)
    } catch {
      // File doesn't exist — remove from cache
      this.cache.delete(filePath)
      return []
    }

    const existing = this.cache.get(filePath)

    // Cache hit: file unchanged
    if (existing && existing.lastSize === stat.size && existing.lastModified === stat.mtimeMs) {
      return existing.records
    }

    // Incremental parse: file grew (new lines appended)
    if (existing && stat.size > existing.lastSize) {
      const result = parseJsonlFile(filePath, existing.lineCount)
      const mergedRecords = [...existing.records, ...result.tokenRecords]
      const mergedMessages = new Map([...existing.userMessages, ...result.userMessages])

      this.cache.set(filePath, {
        lastSize: stat.size,
        lastModified: stat.mtimeMs,
        records: mergedRecords,
        lineCount: this.estimateLineCount(filePath, existing.lineCount),
        userMessages: mergedMessages,
      })
      return mergedRecords
    }

    // Full parse: new file or file was modified in unexpected way
    const result = parseJsonlFile(filePath)
    this.cache.set(filePath, {
      lastSize: stat.size,
      lastModified: stat.mtimeMs,
      records: result.tokenRecords,
      lineCount: this.estimateLineCount(filePath, 0),
      userMessages: result.userMessages,
    })
    return result.tokenRecords
  }

  /**
   * Remove a specific file from cache.
   */
  invalidate(filePath: string): void {
    this.cache.delete(filePath)
  }

  /**
   * Return all cached TokenRecords across all files.
   */
  getAllRecords(): TokenRecord[] {
    const all: TokenRecord[] = []
    for (const entry of this.cache.values()) {
      all.push(...entry.records)
    }
    return all
  }

  /**
   * Recursively find and load all JSONL files under a project directory into cache.
   */
  loadProjectFiles(projectDir: string): void {
    const findAndLoad = (dir: string): void => {
      let entries
      try {
        entries = readdirSync(dir, { withFileTypes: true })
      } catch {
        return
      }
      for (const entry of entries) {
        const fullPath = join(dir, entry.name)
        if (entry.isDirectory()) {
          findAndLoad(fullPath)
        } else if (entry.isFile() && entry.name.endsWith('.jsonl')) {
          this.getOrParse(fullPath)
        }
      }
    }
    findAndLoad(projectDir)
  }

  /**
   * Return records filtered by project path (matched against cached file paths).
   * projectPath is the ~/.claude/projects/<encoded-dir> path.
   */
  getRecordsByProject(projectPath: string): TokenRecord[] {
    const normalized = projectPath.replace(/\\/g, '/')
    const records: TokenRecord[] = []
    for (const [filePath, entry] of this.cache.entries()) {
      const normalizedFile = filePath.replace(/\\/g, '/')
      if (normalizedFile.startsWith(normalized + '/') || normalizedFile.startsWith(normalized + '\\')) {
        records.push(...entry.records)
      }
    }
    return records
  }

  /**
   * Get cached user messages map (sessionId → first user text).
   */
  getUserMessages(): Map<string, string> {
    const merged = new Map<string, string>()
    for (const entry of this.cache.values()) {
      for (const [k, v] of entry.userMessages) {
        if (!merged.has(k)) merged.set(k, v)
      }
    }
    return merged
  }

  private estimateLineCount(filePath: string, fallback: number): number {
    try {
      const { countLines } = require('./parser') as typeof import('./parser')
      return countLines(filePath)
    } catch {
      return fallback
    }
  }
}
