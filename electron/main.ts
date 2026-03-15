// Electron main process entry point
import { app, BrowserWindow, shell } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { registerIpcHandlers, getFileCache } from './ipc/handlers'
import { FileWatcher } from './services/watcher'
import { readSettings } from './services/settings'
import { IPC } from './ipc/channels'

let fileWatcher: FileWatcher | null = null

function createWindow(): BrowserWindow {
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    show: false,
    title: 'CC Monitor',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
    },
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return mainWindow
}

function startFileWatcher(mainWindow: BrowserWindow): void {
  const settings = readSettings()
  if (!settings.watchEnabled) return

  const cache = getFileCache()
  fileWatcher = new FileWatcher(settings.claudeDataDir, cache, (changedFiles) => {
    // Notify renderer that data has been updated
    if (!mainWindow.isDestroyed()) {
      // Send the project path from the first changed file
      const projectPath = changedFiles[0] || ''
      mainWindow.webContents.send(IPC.DATA_UPDATED, projectPath)
      mainWindow.webContents.send(IPC.WATCH_STATUS, fileWatcher?.getStatus() ?? 'stopped')
    }
  })

  fileWatcher.start()
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.ccmonitor.app')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  registerIpcHandlers()
  const mainWindow = createWindow()

  // Start file watcher after window is ready
  mainWindow.webContents.on('did-finish-load', () => {
    startFileWatcher(mainWindow)
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      const win = createWindow()
      win.webContents.on('did-finish-load', () => {
        startFileWatcher(win)
      })
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', async () => {
  if (fileWatcher) {
    await fileWatcher.stop()
    fileWatcher = null
  }
})
