// Preload script — exposes safe APIs to renderer via contextBridge
import { contextBridge } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
  } catch {
    // Context isolation failed
  }
} else {
  window.electron = electronAPI
}
