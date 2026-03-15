// Right-side sliding drawer container for drilldown panels, supports drag-to-resize
import { useEffect, useCallback, useState, useRef } from 'react'

interface DrilldownDrawerProps {
  open: boolean
  onClose: () => void
  title: string
  width?: number
  children: React.ReactNode
}

const MIN_WIDTH = 360
const MAX_WIDTH_RATIO = 0.85

export default function DrilldownDrawer({
  open,
  onClose,
  title,
  width: defaultWidth = 480,
  children,
}: DrilldownDrawerProps) {
  const [drawerWidth, setDrawerWidth] = useState(defaultWidth)
  const dragging = useRef(false)
  const startX = useRef(0)
  const startWidth = useRef(0)

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    },
    [onClose],
  )

  useEffect(() => {
    if (open) {
      document.addEventListener('keydown', handleKeyDown)
      return () => document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, handleKeyDown])

  // Reset width when drawer opens
  useEffect(() => {
    if (open) setDrawerWidth(defaultWidth)
  }, [open, defaultWidth])

  // Drag-to-resize handlers
  const onDragStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      dragging.current = true
      startX.current = e.clientX
      startWidth.current = drawerWidth
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
    },
    [drawerWidth],
  )

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!dragging.current) return
      const delta = startX.current - e.clientX
      const maxWidth = window.innerWidth * MAX_WIDTH_RATIO
      const newWidth = Math.min(Math.max(startWidth.current + delta, MIN_WIDTH), maxWidth)
      setDrawerWidth(newWidth)
    }

    const onMouseUp = () => {
      if (!dragging.current) return
      dragging.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
    return () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }
  }, [])

  return (
    <>
      {/* Backdrop overlay */}
      <div
        className={`fixed inset-0 z-40 bg-black/50 transition-opacity duration-300 ${
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={onClose}
      />

      {/* Drawer panel */}
      <div
        className={`fixed right-0 top-0 z-50 flex h-full flex-col border-l border-[var(--border)] bg-[var(--background)] shadow-2xl transition-transform duration-300 ease-in-out ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
        style={{ width: drawerWidth }}
      >
        {/* Drag handle on left edge */}
        <div
          className="absolute left-0 top-0 z-10 h-full w-1.5 cursor-col-resize hover:bg-[var(--primary)]/30 active:bg-[var(--primary)]/50"
          onMouseDown={onDragStart}
        />

        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
          <h2 className="text-sm font-semibold text-[var(--foreground)]">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-4 py-4">{children}</div>
      </div>
    </>
  )
}
