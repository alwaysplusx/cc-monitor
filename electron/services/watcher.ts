// chokidar file watcher service for monitoring JSONL file changes
import { watch, type FSWatcher } from 'chokidar'
import { FileCache } from './cache'

export type WatchCallback = (changedFiles: string[]) => void

export class FileWatcher {
  private watcher: FSWatcher | null = null
  private watchDir: string
  private cache: FileCache
  private callback: WatchCallback
  private pendingChanges = new Set<string>()
  private debounceTimer: ReturnType<typeof setTimeout> | null = null
  private status: 'stopped' | 'watching' | 'error' = 'stopped'

  constructor(watchDir: string, cache: FileCache, callback: WatchCallback) {
    this.watchDir = watchDir
    this.cache = cache
    this.callback = callback
  }

  /**
   * Start watching for JSONL file changes.
   */
  start(): void {
    if (this.watcher) return

    try {
      this.watcher = watch('**/*.jsonl', {
        cwd: this.watchDir,
        awaitWriteFinish: { stabilityThreshold: 300, pollInterval: 100 },
        ignoreInitial: false,
        persistent: true,
      })

      this.watcher.on('add', (relativePath) => {
        const fullPath = `${this.watchDir}/${relativePath}`
        this.cache.getOrParse(fullPath)
        this.scheduleNotify(fullPath)
      })

      this.watcher.on('change', (relativePath) => {
        const fullPath = `${this.watchDir}/${relativePath}`
        this.cache.invalidate(fullPath)
        this.cache.getOrParse(fullPath)
        this.scheduleNotify(fullPath)
      })

      this.watcher.on('unlink', (relativePath) => {
        const fullPath = `${this.watchDir}/${relativePath}`
        this.cache.invalidate(fullPath)
        this.scheduleNotify(fullPath)
      })

      this.watcher.on('error', (err) => {
        console.error('Watcher error:', err)
        this.status = 'error'
      })

      this.watcher.on('ready', () => {
        this.status = 'watching'
      })
    } catch (err) {
      console.error('Failed to start watcher:', err)
      this.status = 'error'
    }
  }

  /**
   * Stop watching.
   */
  async stop(): Promise<void> {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
      this.debounceTimer = null
    }
    if (this.watcher) {
      await this.watcher.close()
      this.watcher = null
    }
    this.status = 'stopped'
  }

  /**
   * Get current watcher status.
   */
  getStatus(): 'stopped' | 'watching' | 'error' {
    return this.status
  }

  /**
   * 500ms debounce: collect changes then notify once.
   */
  private scheduleNotify(filePath: string): void {
    this.pendingChanges.add(filePath)

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
    }

    this.debounceTimer = setTimeout(() => {
      const files = Array.from(this.pendingChanges)
      this.pendingChanges.clear()
      this.callback(files)
    }, 500)
  }
}
