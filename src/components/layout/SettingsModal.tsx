// Settings modal: data directory, pricing config, system options
import { useState, useEffect, useCallback } from 'react'
import { X, Plus, Trash2, FolderOpen } from 'lucide-react'
import { useSettingsStore } from '../../stores/settingsStore'
import { electronApi } from '../../lib/ipc'
import type { ModelPricingConfig, AppSettings } from '../../types/ipc'

function PricingRow({
  config,
  onChange,
  onDelete,
}: {
  config: ModelPricingConfig
  onChange: (updated: ModelPricingConfig) => void
  onDelete: () => void
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        className="w-24 rounded border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-xs text-[var(--foreground)] outline-none focus:border-[var(--primary)]"
        value={config.match}
        onChange={(e) => onChange({ ...config, match: e.target.value })}
        placeholder="模型关键词"
      />
      <input
        type="number"
        className="w-16 rounded border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-right text-xs text-[var(--foreground)] outline-none focus:border-[var(--primary)]"
        value={config.input}
        onChange={(e) => onChange({ ...config, input: Number(e.target.value) })}
        step="0.01"
        min="0"
      />
      <input
        type="number"
        className="w-16 rounded border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-right text-xs text-[var(--foreground)] outline-none focus:border-[var(--primary)]"
        value={config.output}
        onChange={(e) => onChange({ ...config, output: Number(e.target.value) })}
        step="0.01"
        min="0"
      />
      <input
        type="number"
        className="w-16 rounded border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-right text-xs text-[var(--foreground)] outline-none focus:border-[var(--primary)]"
        value={config.cacheRead}
        onChange={(e) => onChange({ ...config, cacheRead: Number(e.target.value) })}
        step="0.01"
        min="0"
      />
      <button
        onClick={onDelete}
        className="rounded p-1 text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-rose-500"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

export default function SettingsModal() {
  const open = useSettingsStore((s) => s.settingsOpen)
  const setOpen = useSettingsStore((s) => s.setSettingsOpen)
  const loadSettings = useSettingsStore((s) => s.loadSettings)
  const storeSettings = useSettingsStore()

  // Local draft state
  const [claudeDataDir, setClaudeDataDir] = useState('')
  const [watchEnabled, setWatchEnabled] = useState(true)
  const [refreshIntervalMs, setRefreshIntervalMs] = useState(30000)
  const [minimizeToTray, setMinimizeToTray] = useState(false)
  const [launchAtStartup, setLaunchAtStartup] = useState(false)
  const [recentHours, setRecentHours] = useState(5)
  const [projectMergeThreshold, setProjectMergeThreshold] = useState(1)
  const [turnContentLimit, setTurnContentLimit] = useState(1000)
  const [pricing, setPricing] = useState<ModelPricingConfig[]>([])
  const [saving, setSaving] = useState(false)

  // Sync from store when modal opens
  useEffect(() => {
    if (open) {
      setClaudeDataDir(storeSettings.claudeDataDir)
      setWatchEnabled(storeSettings.watchEnabled)
      setRefreshIntervalMs(storeSettings.refreshIntervalMs)
      setMinimizeToTray(storeSettings.minimizeToTray)
      setLaunchAtStartup(storeSettings.launchAtStartup)
      setRecentHours(storeSettings.recentHours)
      setProjectMergeThreshold(storeSettings.projectMergeThreshold)
      setTurnContentLimit(storeSettings.turnContentLimit)
      setPricing(storeSettings.modelPricing.map((p) => ({ ...p })))
    }
  }, [open])

  const handleSelectDir = useCallback(async () => {
    const dir = await electronApi.selectDirectory()
    if (dir) setClaudeDataDir(dir)
  }, [])

  const handleAddPricing = useCallback(() => {
    setPricing((prev) => [...prev, { match: '', input: 3, output: 15, cacheRead: 0.3 }])
  }, [])

  const handleSave = useCallback(async () => {
    setSaving(true)
    try {
      const settings: AppSettings = {
        claudeDataDir,
        watchEnabled,
        refreshIntervalMs,
        theme: storeSettings.theme,
        planType: storeSettings.planType,
        customTokenLimit: storeSettings.customTokenLimit,
        minimizeToTray,
        launchAtStartup,
        recentHours,
        projectMergeThreshold,
        turnContentLimit,
        modelPricing: pricing.filter((p) => p.match.trim() !== ''),
      }
      await electronApi.saveSettings(settings)
      loadSettings(settings)
      setOpen(false)
    } finally {
      setSaving(false)
    }
  }, [storeSettings, claudeDataDir, watchEnabled, refreshIntervalMs, minimizeToTray, launchAtStartup, recentHours, projectMergeThreshold, turnContentLimit, pricing, loadSettings, setOpen])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setOpen(false)}>
      <div
        className="w-[520px] rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-3">
          <h2 className="text-sm font-semibold text-[var(--foreground)]">设置</h2>
          <button
            onClick={() => setOpen(false)}
            className="rounded-md p-1 text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="max-h-[60vh] space-y-5 overflow-y-auto px-5 py-4">
          {/* Data directory */}
          <section>
            <h3 className="mb-2 text-xs font-semibold text-[var(--muted-foreground)]">数据目录</h3>
            <div className="flex items-center gap-2">
              <input
                className="flex-1 rounded border border-[var(--border)] bg-[var(--background)] px-2.5 py-1.5 text-xs text-[var(--foreground)] outline-none focus:border-[var(--primary)]"
                value={claudeDataDir}
                onChange={(e) => setClaudeDataDir(e.target.value)}
                placeholder="Claude 数据目录路径"
              />
              <button
                onClick={handleSelectDir}
                className="rounded border border-[var(--border)] p-1.5 text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
              >
                <FolderOpen className="h-4 w-4" />
              </button>
            </div>
          </section>

          {/* Watch & polling */}
          <section>
            <h3 className="mb-2 text-xs font-semibold text-[var(--muted-foreground)]">监控与刷新</h3>
            <div className="space-y-2">
              <label className="flex cursor-pointer items-center gap-2 text-xs text-[var(--foreground)]">
                <input
                  type="checkbox"
                  checked={watchEnabled}
                  onChange={(e) => setWatchEnabled(e.target.checked)}
                  className="accent-[var(--primary)]"
                />
                启用文件变更自动监控
              </label>
              <div className="flex items-center gap-2 text-xs text-[var(--foreground)]">
                <span className="w-20 text-[var(--muted-foreground)]">轮询间隔</span>
                <select
                  value={refreshIntervalMs}
                  onChange={(e) => setRefreshIntervalMs(Number(e.target.value))}
                  className="rounded border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-xs text-[var(--foreground)] outline-none focus:border-[var(--primary)]"
                >
                  <option value={15000}>15 秒</option>
                  <option value={30000}>30 秒</option>
                  <option value={60000}>1 分钟</option>
                  <option value={180000}>3 分钟</option>
                  <option value={300000}>5 分钟</option>
                </select>
              </div>
            </div>
          </section>

          {/* System behavior */}
          <section>
            <h3 className="mb-2 text-xs font-semibold text-[var(--muted-foreground)]">系统行为</h3>
            <div className="space-y-2">
              <label className="flex cursor-pointer items-center gap-2 text-xs text-[var(--foreground)]">
                <input
                  type="checkbox"
                  checked={minimizeToTray}
                  onChange={(e) => setMinimizeToTray(e.target.checked)}
                  className="accent-[var(--primary)]"
                />
                关闭窗口时最小化到系统托盘
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-xs text-[var(--foreground)]">
                <input
                  type="checkbox"
                  checked={launchAtStartup}
                  onChange={(e) => setLaunchAtStartup(e.target.checked)}
                  className="accent-[var(--primary)]"
                />
                开机自动启动
              </label>
            </div>
          </section>

          {/* Display preferences */}
          <section>
            <h3 className="mb-2 text-xs font-semibold text-[var(--muted-foreground)]">显示偏好</h3>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-[var(--foreground)]">
                <span className="w-28 text-[var(--muted-foreground)]">近 N 小时窗口</span>
                <select
                  value={recentHours}
                  onChange={(e) => setRecentHours(Number(e.target.value))}
                  className="rounded border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-xs text-[var(--foreground)] outline-none focus:border-[var(--primary)]"
                >
                  <option value={1}>1 小时</option>
                  <option value={2}>2 小时</option>
                  <option value={3}>3 小时</option>
                  <option value={5}>5 小时</option>
                  <option value={8}>8 小时</option>
                </select>
              </div>
              <div className="flex items-center gap-2 text-xs text-[var(--foreground)]">
                <span className="w-28 text-[var(--muted-foreground)]">项目合并阈值</span>
                <select
                  value={projectMergeThreshold}
                  onChange={(e) => setProjectMergeThreshold(Number(e.target.value))}
                  className="rounded border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-xs text-[var(--foreground)] outline-none focus:border-[var(--primary)]"
                >
                  <option value={1}>{'< 1%'}</option>
                  <option value={3}>{'< 3%'}</option>
                  <option value={5}>{'< 5%'}</option>
                </select>
                <span className="text-[10px] text-[var(--muted-foreground)]">合并为「其他」</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-[var(--foreground)]">
                <span className="w-28 text-[var(--muted-foreground)]">轮次内容长度</span>
                <select
                  value={turnContentLimit}
                  onChange={(e) => setTurnContentLimit(Number(e.target.value))}
                  className="rounded border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-xs text-[var(--foreground)] outline-none focus:border-[var(--primary)]"
                >
                  <option value={500}>500 字</option>
                  <option value={1000}>1000 字</option>
                  <option value={2000}>2000 字</option>
                  <option value={5000}>5000 字</option>
                </select>
              </div>
            </div>
          </section>

          {/* Model pricing */}
          <section>
            <h3 className="mb-2 text-xs font-semibold text-[var(--muted-foreground)]">模型定价 ($/MTok)</h3>
            <div className="space-y-2">
              {/* Header */}
              <div className="flex items-center gap-2 text-[10px] text-[var(--muted-foreground)]">
                <span className="w-24">关键词</span>
                <span className="w-16 text-right">输入</span>
                <span className="w-16 text-right">输出</span>
                <span className="w-16 text-right">缓存</span>
                <span className="w-6" />
              </div>
              {pricing.map((p, i) => (
                <PricingRow
                  key={i}
                  config={p}
                  onChange={(updated) => {
                    const next = [...pricing]
                    next[i] = updated
                    setPricing(next)
                  }}
                  onDelete={() => setPricing(pricing.filter((_, j) => j !== i))}
                />
              ))}
              <button
                onClick={handleAddPricing}
                className="flex items-center gap-1 rounded px-2 py-1 text-xs text-[var(--primary)] hover:bg-[var(--accent)]"
              >
                <Plus className="h-3.5 w-3.5" />
                添加模型
              </button>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-[var(--border)] px-5 py-3">
          <button
            onClick={() => setOpen(false)}
            className="rounded-md border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--foreground)] hover:bg-[var(--accent)]"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-md bg-[var(--primary)] px-3 py-1.5 text-xs text-[var(--primary-foreground)] hover:opacity-90 disabled:opacity-50"
          >
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  )
}
