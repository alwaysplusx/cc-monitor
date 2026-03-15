// IPC request handlers registered on ipcMain
import { ipcMain, dialog, shell, BrowserWindow } from 'electron'
import { IPC } from './channels'
import { FileCache } from '../services/cache'
import { scanProjects, getDefaultClaudeDir } from '../services/project-scanner'
import {
  aggregateByMinute,
  aggregateByHour,
  aggregateByDay,
  aggregateByMonth,
  aggregateByModel,
  aggregateBySession,
  detectModelSwitches,
} from '../services/aggregator'
import { readSettings, writeSettings } from '../services/settings'
import { getTurnDetail } from '../services/turn-detail'
import type { AppSettings } from '../../src/types/ipc'

const fileCache = new FileCache()

/**
 * Register all IPC handlers on the main process.
 */
export function registerIpcHandlers(): void {
  ipcMain.handle(IPC.GET_PROJECTS, () => {
    const settings = readSettings()
    return scanProjects(settings.claudeDataDir)
  })

  ipcMain.handle(IPC.GET_TOKEN_DATA, () => {
    // Load all project files under ~/.claude/projects/
    const settings = readSettings()
    const baseDir = settings.claudeDataDir || getDefaultClaudeDir()
    fileCache.loadProjectFiles(baseDir)
    const records = fileCache.getAllRecords()
    const userMessages = fileCache.getUserMessages()
    return {
      records,
      minuteBuckets: aggregateByMinute(records),
      hourBuckets: aggregateByHour(records),
      dayBuckets: aggregateByDay(records),
      monthBuckets: aggregateByMonth(records),
      modelSummaries: aggregateByModel(records),
      sessionSummaries: aggregateBySession(records, userMessages),
      modelSwitches: detectModelSwitches(records),
    }
  })

  ipcMain.handle(IPC.SELECT_DIRECTORY, async () => {
    const win = BrowserWindow.getFocusedWindow()
    if (!win) return null
    const result = await dialog.showOpenDialog(win, {
      properties: ['openDirectory'],
      defaultPath: getDefaultClaudeDir(),
    })
    return result.canceled ? null : result.filePaths[0]
  })

  ipcMain.handle(IPC.GET_SETTINGS, () => {
    return readSettings()
  })

  ipcMain.handle(IPC.SAVE_SETTINGS, (_event, partial: Partial<AppSettings>) => {
    const current = readSettings()
    writeSettings({ ...current, ...partial })
  })

  ipcMain.handle(IPC.OPEN_DIRECTORY, (_event, filePath: string) => {
    shell.showItemInFolder(filePath)
  })

  ipcMain.handle(
    IPC.GET_TURN_DETAIL,
    (_event, params: { fileName: string; sessionId: string; timestamp: string; contentLimit?: number }) => {
      return getTurnDetail(params.fileName, params.sessionId, params.timestamp, params.contentLimit)
    },
  )

  ipcMain.handle(IPC.REFRESH, () => {
    const settings = readSettings()
    return scanProjects(settings.claudeDataDir)
  })
}

/**
 * Get the shared FileCache instance for use by watcher.
 */
export function getFileCache(): FileCache {
  return fileCache
}
