// IPC channel name constants for main-renderer communication
export const IPC = {
  // Renderer → Main (requests)
  GET_PROJECTS: 'get-projects',
  GET_TOKEN_DATA: 'get-token-data',
  SELECT_DIRECTORY: 'select-directory',
  GET_SETTINGS: 'get-settings',
  SAVE_SETTINGS: 'save-settings',
  EXPORT_DATA: 'export-data',
  OPEN_DIRECTORY: 'open-directory',
  REFRESH: 'refresh',
  GET_TURN_DETAIL: 'get-turn-detail',

  // Main → Renderer (push events)
  DATA_UPDATED: 'data-updated',
  WATCH_ERROR: 'watch-error',
  WATCH_STATUS: 'watch-status',
} as const
