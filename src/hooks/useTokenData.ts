// Hook to subscribe to main process data updates and drive store refresh
import { useEffect, useCallback } from 'react'
import { useDataStore } from '../stores/dataStore'
import { useSettingsStore } from '../stores/settingsStore'
import { electronApi } from '../lib/ipc'

/**
 * Fetches project list and token data from main process,
 * subscribes to real-time DATA_UPDATED events.
 */
export function useTokenData(): void {
  const setProjects = useDataStore((s) => s.setProjects)
  const currentProject = useDataStore((s) => s.currentProject)
  const setProject = useDataStore((s) => s.setProject)
  const updateData = useDataStore((s) => s.updateData)
  const loadSettings = useSettingsStore((s) => s.loadSettings)

  const fetchTokenData = useCallback(
    async (projectPath: string) => {
      try {
        const data = await electronApi.getTokenData(projectPath)
        updateData(data)
      } catch (err) {
        console.error('Failed to fetch token data:', err)
      }
    },
    [updateData],
  )

  // Load projects and settings on mount
  useEffect(() => {
    const init = async () => {
      try {
        const settings = await electronApi.getSettings()
        loadSettings(settings)

        const projects = await electronApi.getProjects()
        setProjects(projects)

        // Auto-select the most recent project
        if (projects.length > 0 && !currentProject) {
          setProject(projects[0].path)
        }
      } catch (err) {
        console.error('Failed to initialize:', err)
      }
    }
    init()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch data when current project changes
  useEffect(() => {
    if (currentProject) {
      fetchTokenData(currentProject)
    }
  }, [currentProject, fetchTokenData])

  // Subscribe to real-time data updates from main process
  useEffect(() => {
    const unsubscribe = electronApi.onDataUpdated((projectPath) => {
      if (projectPath === currentProject || !currentProject) {
        if (currentProject) {
          fetchTokenData(currentProject)
        }
      }
    })
    return unsubscribe
  }, [currentProject, fetchTokenData])
}
