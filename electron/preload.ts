// Preload script — exposes safe APIs to renderer via contextBridge
import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from './ipc/channels'

const api = {
  getProjects: () => ipcRenderer.invoke(IPC.GET_PROJECTS),
  getTokenData: (projectPath: string) => ipcRenderer.invoke(IPC.GET_TOKEN_DATA, projectPath),
  refreshData: () => ipcRenderer.invoke(IPC.REFRESH),
  selectDirectory: () => ipcRenderer.invoke(IPC.SELECT_DIRECTORY),
  exportData: (format: 'csv' | 'json', data: object) =>
    ipcRenderer.invoke(IPC.EXPORT_DATA, format, data),
  getSettings: () => ipcRenderer.invoke(IPC.GET_SETTINGS),
  saveSettings: (settings: object) => ipcRenderer.invoke(IPC.SAVE_SETTINGS, settings),
  onDataUpdated: (callback: (projectPath: string) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, projectPath: string) =>
      callback(projectPath)
    ipcRenderer.on(IPC.DATA_UPDATED, handler)
    return () => ipcRenderer.removeListener(IPC.DATA_UPDATED, handler)
  },
  onWatchStatus: (callback: (status: string) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, status: string) => callback(status)
    ipcRenderer.on(IPC.WATCH_STATUS, handler)
    return () => ipcRenderer.removeListener(IPC.WATCH_STATUS, handler)
  },
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('api', api)
  } catch {
    // Context isolation failed
  }
} else {
  ;(window as unknown as Record<string, unknown>).api = api
}
