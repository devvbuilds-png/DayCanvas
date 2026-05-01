import { db } from '../db/db'
import type { Day, Mood } from '../db/schema'

interface HeaderProps {
  currentDate: string   // YYYY-MM-DD
  day: Day | null
  onNavigate: (date: string) => void
}

const MOODS: { value: Mood; emoji: string; label: string }[] = [
  { value: 'tough', emoji: '😮‍💨', label: 'tough' },
  { value: 'meh',   emoji: '😐',   label: 'meh'   },
  { value: 'good',  emoji: '🙂',   label: 'good'  },
  { value: 'fire',  emoji: '🔥',   label: 'fire'  },
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
  return d.toLocaleDateString('en-US', { weekday: 'short' }).toLowerCase()
}

function getTodayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

function offsetDate(date: string, days: number): string {
  const d = new Date(date + 'T00:00:00')
  d.setDate(d.getDate() + days)
  const y  = d.getFullYear()
  const m  = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

export default function Header({ currentDate, day, onNavigate }: HeaderProps) {
  const dayName    = getDayName(currentDate).toLowerCase()
  const displayDate = formatDisplayDate(currentDate)
  const isToday    = currentDate === getTodayISO()
  const prevLabel  = getAdjacentLabel(currentDate, -1)
  const nextLabel  = getAdjacentLabel(currentDate, 1)

  const currentMood = day?.mood ?? null
  const moodEntry   = MOODS.find(m => m.value === currentMood)

  function tapMood() {
    if (!day) return
    db.days.update(currentDate, { mood: nextMood(currentMood) })
  }

  return (
    <div className="flex items-center justify-between py-3 border-b border-[#2a2a2a]">
      {/* left: day name + date + mood */}
      <div className="flex items-center gap-3">
        <span className="text-lg font-medium text-[#e3e3e3] leading-none">{dayName}</span>
        <span className="text-xs text-[#888]">
          {displayDate}{isToday ? ' · today' : ''}
        </span>
        {day?.stamped && (
          <span className="text-[10px] text-[#888] border border-[#2a2a2a] rounded-full px-1.5 py-0.5 leading-none select-none">
            stamped ✓
          </span>
        )}
        <button
          type="button"
          onClick={tapMood}
          className={`px-2 py-0.5 rounded-full border text-xs leading-5 select-none transition-colors ${
            moodEntry
              ? 'border-[#2a2a2a] text-[#e3e3e3] hover:bg-[#252525]'
              : 'border-[#2a2a2a] text-[#555] hover:bg-[#252525] hover:text-[#888]'
          }`}
        >
          {moodEntry ? `${moodEntry.emoji} ${moodEntry.label}` : '· mood'}
        </button>
      </div>

      {/* right: prev/next + quick add */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onNavigate(offsetDate(currentDate, -1))}
          className="px-2 py-1 text-xs text-[#888] hover:text-[#e3e3e3] rounded hover:bg-[#252525] transition-colors"
        >
          ‹ {prevLabel}
        </button>
        <button
          type="button"
          onClick={() => onNavigate(offsetDate(currentDate, 1))}
          className="px-2 py-1 text-xs text-[#888] hover:text-[#e3e3e3] rounded hover:bg-[#252525] transition-colors"
        >
          {nextLabel} ›
        </button>
        <div className="ml-2 px-2 py-0.5 rounded border border-[#2a2a2a] text-xs text-[#555] leading-5 select-none">
          / quick add
        </div>
      </div>
    </div>
  )
}
