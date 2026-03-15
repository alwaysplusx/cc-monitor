// Hook to subscribe to main process data updates and drive store refresh
import { useEffect, useCallback } from 'react'
import { useDataStore } from '../stores/dataStore'
import { useSettingsStore } from '../stores/settingsStore'
import { electronApi } from '../lib/ipc'

/**
 * Fetches all token data from ~/.claude/projects/ on mount,
 * subscribes to real-time DATA_UPDATED events.
 */
export function useTokenData(): void {
  const setProjects = useDataStore((s) => s.setProjects)
  const updateData = useDataStore((s) => s.updateData)
  const loadSettings = useSettingsStore((s) => s.loadSettings)

  const fetchTokenData = useCallback(async () => {
    try {
      const data = await electronApi.getTokenData('')
      updateData(data)
    } catch (err) {
      console.error('Failed to fetch token data:', err)
    }
  }, [updateData])

  // Load settings, projects, and data on mount
  useEffect(() => {
    const init = async () => {
      try {
        const settings = await electronApi.getSettings()
        loadSettings(settings)

        const projects = await electronApi.getProjects()
        setProjects(projects)

        await fetchTokenData()
      } catch (err) {
        console.error('Failed to initialize:', err)
      }
    }
    init()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Subscribe to real-time data updates from main process
  useEffect(() => {
    const unsubscribe = electronApi.onDataUpdated(() => {
      fetchTokenData()
    })
    return unsubscribe
  }, [fetchTokenData])

  // Fallback polling every 5 minutes
  useEffect(() => {
    const timer = setInterval(fetchTokenData, 5 * 60 * 1000)
    return () => clearInterval(timer)
  }, [fetchTokenData])
}
