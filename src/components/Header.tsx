import { db } from '../db/db'
import type { Day, Mood } from '../db/schema'

interface HeaderProps {
  currentDate: string
  day: Day | null
  onNavigate: (date: string) => void
  currentTaskText?: string | null
}

const MOODS: { value: Mood; emoji: string; label: string }[] = [
  { value: 'tough', emoji: '😮‍💨', label: 'tough' },
  { value: 'meh', emoji: '😐', label: 'meh' },
  { value: 'good', emoji: '🙂', label: 'good' },
  { value: 'fire', emoji: '🔥', label: 'fire' },
]

function nextMood(current: Mood): Mood {
  if (current === null) return 'tough'
  const idx = MOODS.findIndex(m => m.value === current)
  return MOODS[(idx + 1) % MOODS.length].value
}

function formatDisplayDate(date: string): string {
  const d = new Date(date + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function getDayName(date: string): string {
  const d = new Date(date + 'T00:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'long' })
}

function getAdjacentLabel(date: string, offset: number): string {
  const d = new Date(date + 'T00:00:00')
  d.setDate(d.getDate() + offset)
  return d.toLocaleDateString('en-US', { weekday: 'short' })
}

function getTodayISO(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function offsetDate(date: string, days: number): string {
  const d = new Date(date + 'T00:00:00')
  d.setDate(d.getDate() + days)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

export default function Header({ currentDate, day, onNavigate, currentTaskText }: HeaderProps) {
  const dayName = getDayName(currentDate)
  const displayDate = formatDisplayDate(currentDate)
  const isToday = currentDate === getTodayISO()
  const prevLabel = getAdjacentLabel(currentDate, -1)
  const nextLabel = getAdjacentLabel(currentDate, 1)

  const currentMood = day?.mood ?? null
  const moodEntry = MOODS.find(m => m.value === currentMood)
  const currentTaskLabel = currentTaskText || 'no current task'

  function tapMood() {
    if (!day) return
    db.days.update(currentDate, { mood: nextMood(currentMood) })
  }

  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 py-3.5 border-b" style={{ borderColor: '#1e1e1e' }}>

      {/* left: day identity */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex flex-col gap-0.5 leading-none">
          <div className="flex items-center gap-2">
            <span className="text-[20px] font-semibold tracking-tight text-[#e3e3e3] leading-none">
              {dayName}
            </span>
            {day?.stamped && (
              <span
                className="text-[10px] px-1.5 py-0.5 rounded leading-none select-none"
                style={{ background: '#1e1e1e', color: '#555', border: '1px solid #2a2a2a' }}
              >
                stamped
              </span>
            )}
          </div>
          <span className="text-[11px] tnum mt-1" style={{ color: '#484848' }}>
            {displayDate}{isToday ? ' · today' : ''}
          </span>
        </div>

        <button
          type="button"
          onClick={tapMood}
          title={moodEntry ? moodEntry.label : 'set mood'}
          className="h-8 rounded-full flex items-center justify-center gap-1.5 px-2.5 text-[16px] transition-colors shrink-0"
          style={{
            background: moodEntry ? '#1e1e1e' : '#161616',
            border: `1px solid ${moodEntry ? '#2e2e2e' : '#1e1e1e'}`,
          }}
        >
          {moodEntry
            ? (
              <>
                <span>{moodEntry.emoji}</span>
                <span className="text-[10px] font-medium uppercase" style={{ color: '#9a9a9a' }}>
                  {moodEntry.label}
                </span>
              </>
            )
            : <span style={{ fontSize: '9px', color: '#3a3a3a', letterSpacing: '0.02em' }}>mood</span>
          }
        </button>
      </div>

      {/* center: current task */}
      <div className="justify-self-center min-w-0 px-4 max-w-[420px]">
        <div className="flex items-center gap-2">
          <span
            className="w-1.5 h-1.5 rounded-full shrink-0"
            style={{
              background: currentTaskText ? '#6965db' : '#3a3a3a',
              boxShadow: currentTaskText ? '0 0 5px rgba(105,101,219,0.6)' : 'none',
            }}
          />
          <span
            className="text-[13px] font-medium truncate"
            style={{ color: currentTaskText ? '#7b77e0' : '#565656' }}
            title={currentTaskLabel}
          >
            {currentTaskLabel}
          </span>
        </div>
      </div>

      {/* right: navigation */}
      <div className="flex items-center gap-0.5 justify-self-end">
        <button
          type="button"
          onClick={() => onNavigate(offsetDate(currentDate, -1))}
          className="px-3 py-1.5 text-[11px] rounded transition-colors tnum"
          style={{ color: '#484848' }}
          onMouseEnter={e => {
            e.currentTarget.style.color = '#e3e3e3'
            e.currentTarget.style.background = '#1a1a1a'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.color = '#484848'
            e.currentTarget.style.background = 'transparent'
          }}
        >
          ← {prevLabel}
        </button>
        <button
          type="button"
          onClick={() => onNavigate(offsetDate(currentDate, 1))}
          className="px-3 py-1.5 text-[11px] rounded transition-colors tnum"
          style={{ color: '#484848' }}
          onMouseEnter={e => {
            e.currentTarget.style.color = '#e3e3e3'
            e.currentTarget.style.background = '#1a1a1a'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.color = '#484848'
            e.currentTarget.style.background = 'transparent'
          }}
        >
          {nextLabel} →
        </button>
      </div>
    </div>
  )
}
