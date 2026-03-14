// Wrapper for preload API calls from renderer process
import type { ElectronAPI } from '../types/electron'

/**
 * Get the preload API. Throws if not available (e.g. in browser dev mode).
 */
function getApi(): ElectronAPI {
  const api = (window as { api?: ElectronAPI }).api
  if (!api) {
    throw new Error('Electron API not available. Running outside Electron?')
  }
  return api
}

export const electronApi = {
  getProjects: () => getApi().getProjects(),
  getTokenData: (projectPath: string) => getApi().getTokenData(projectPath),
  refreshData: () => getApi().refreshData(),
  selectDirectory: () => getApi().selectDirectory(),
  getSettings: () => getApi().getSettings(),
  saveSettings: (settings: Parameters<ElectronAPI['saveSettings']>[0]) =>
    getApi().saveSettings(settings),
  onDataUpdated: (callback: (projectPath: string) => void) => getApi().onDataUpdated(callback),
  onWatchStatus: (callback: (status: string) => void) =>
    getApi().onWatchStatus(callback as Parameters<ElectronAPI['onWatchStatus']>[0]),
}
