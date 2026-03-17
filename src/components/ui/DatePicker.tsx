// Date picker component using react-day-picker with app theme
import React, { useState, useRef, useEffect, useMemo } from 'react'
import { DayPicker } from 'react-day-picker'
import { zhCN } from 'react-day-picker/locale'
import { Calendar } from 'lucide-react'
import { cn } from '../../lib/utils'
import 'react-day-picker/style.css'

interface DatePickerProps {
  value: string // YYYY-MM-DD
  onChange: (date: string) => void
  max?: string // YYYY-MM-DD
  activeDays?: Set<string> // Set of YYYY-MM-DD strings that have activity
}

function fmt(d: Date): string {
  return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`
}

export default function DatePicker({ value, onChange, max, activeDays }: DatePickerProps) {
  const [open, setOpen] = useState(false)
  const [month, setMonth] = useState(() => new Date(value + 'T00:00:00'))
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  useEffect(() => {
    setMonth(new Date(value + 'T00:00:00'))
  }, [value])

  const selected = useMemo(() => new Date(value + 'T00:00:00'), [value])
  const maxDate = max ? new Date(max + 'T00:00:00') : undefined

  // Custom DayButton that shows a green dot for active days
  const CustomDayButton = useMemo(() => {
    const ActiveDayButton = (props: { day: { date: Date }; modifiers: Record<string, boolean>; [key: string]: unknown }) => {
      const { day, modifiers, ...buttonProps } = props
      const btnRef = React.useRef<HTMLButtonElement>(null)
      React.useEffect(() => {
        if (modifiers.focused) btnRef.current?.focus()
      }, [modifiers.focused])

      const dateStr = fmt(day.date)
      const hasActivity = activeDays?.has(dateStr) ?? false
      const isOutside = modifiers.outside

      return (
        <button ref={btnRef} {...buttonProps}>
          {(buttonProps as { children?: React.ReactNode }).children}
          {hasActivity && !isOutside && (
            <span className="absolute bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-green-500" />
          )}
        </button>
      )
    }
    return ActiveDayButton
  }, [activeDays])

  return (
    <div ref={ref} className="relative flex-1">
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          'flex w-full items-center gap-2 rounded-md border px-2 py-1.5 text-xs transition-colors',
          open
            ? 'border-[var(--primary)] text-[var(--foreground)]'
            : 'border-[var(--border)] text-[var(--foreground)] hover:border-[var(--primary)]',
          'bg-[var(--card)]',
        )}
      >
        <Calendar className="h-3.5 w-3.5 text-[var(--muted-foreground)]" />
        <span className="font-mono">{value}</span>
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 rounded-lg border border-[var(--border)] bg-[var(--popover)] p-2 shadow-lg">
          <DayPicker
            mode="single"
            selected={selected}
            month={month}
            onMonthChange={setMonth}
            onSelect={(d) => {
              if (d) {
                onChange(fmt(d))
                setOpen(false)
              }
            }}
            disabled={maxDate ? { after: maxDate } : undefined}
            locale={zhCN}
            weekStartsOn={1}
            components={{
              DayButton: CustomDayButton,
            }}
            classNames={{
              root: 'text-xs text-[var(--foreground)]',
              months: 'flex flex-col',
              month_caption: 'flex items-center justify-center py-1 text-xs font-medium',
              nav: 'flex items-center justify-between',
              button_previous: 'rounded p-1 text-[var(--muted-foreground)] hover:bg-[var(--accent)]',
              button_next: 'rounded p-1 text-[var(--muted-foreground)] hover:bg-[var(--accent)]',
              weekdays: 'grid grid-cols-7',
              weekday: 'text-center text-[10px] text-[var(--muted-foreground)] p-1',
              weeks: '',
              week: 'grid grid-cols-7',
              day: 'text-center',
              day_button: 'relative w-7 h-7 rounded text-xs transition-colors hover:bg-[var(--accent)]',
              selected: '!bg-[var(--primary)] !text-white font-semibold',
              today: 'font-bold text-[var(--primary)]',
              outside: 'opacity-30',
              disabled: 'opacity-20 cursor-not-allowed',
            }}
          />
        </div>
      )}
    </div>
  )
}
