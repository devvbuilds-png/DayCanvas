import { useState, useEffect } from 'react'
import { db } from '../db/db'
import type { Todo, Lane } from '../db/schema'

interface StampSheetProps {
  todos: Todo[]
  lanes: Lane[]
  currentDate: string
  onStamped: () => void
  onCancel: () => void
}

function tomorrowISO(fromDate: string): string {
  const d = new Date(fromDate + 'T00:00:00')
  d.setDate(d.getDate() + 1)
  const y  = d.getFullYear()
  const m  = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

async function cloneAsParked(todo: Todo) {
  const now = new Date().toISOString()
  await db.todos.add({
    id: crypto.randomUUID(),
    text: todo.text,
    lane_id: todo.lane_id,
    status: 'parked',
    priority: todo.priority,
    start_time: null,
    duration_minutes: null,
    stickers: [...todo.stickers],
    description: todo.description,
    created_at: now,
    updated_at: now,
  })
}

async function cloneAsScheduled(todo: Todo, targetDate: string) {
  const now = new Date().toISOString()
  await db.todos.add({
    id: crypto.randomUUID(),
    text: todo.text,
    lane_id: todo.lane_id,
    status: 'scheduled',
    priority: todo.priority,
    start_time: new Date(`${targetDate}T09:00:00`).toISOString(),
    duration_minutes: 60,
    stickers: [...todo.stickers],
    description: todo.description,
    created_at: now,
    updated_at: now,
  })
}

interface RowProps {
  todo: Todo
  lane: Lane | undefined
  tomorrow: string
  onResolved: (id: string) => void
}

function StampRow({ todo, lane, tomorrow, onResolved }: RowProps) {
  const [pushMode, setPushMode] = useState(false)
  const [pushDate, setPushDate] = useState(tomorrow)
  const [busy, setBusy]         = useState(false)

  const btnBase  = 'px-2 py-1 text-[11px] rounded border transition-colors disabled:opacity-40'
  const btnMuted = `${btnBase} border-[#2a2a2a] text-[#888] hover:bg-[#252525] hover:text-[#e3e3e3]`
  const btnRed   = `${btnBase} text-[#D85A30] hover:opacity-80`

  async function carryOver() {
    setBusy(true)
    await db.todos.update(todo.id, { status: 'carried', updated_at: new Date().toISOString() })
    await cloneAsParked(todo)
    onResolved(todo.id)
  }

  async function pushTo() {
    if (!pushDate) return
    setBusy(true)
    await db.todos.update(todo.id, { status: 'carried', updated_at: new Date().toISOString() })
    await cloneAsScheduled(todo, pushDate)
    onResolved(todo.id)
  }

  async function killIt() {
    setBusy(true)
    await db.todos.update(todo.id, { status: 'missed', updated_at: new Date().toISOString() })
    onResolved(todo.id)
  }

  return (
    <div className="flex items-center gap-3 py-2.5 border-b last:border-0" style={{ borderColor: '#2a2a2a' }}>
      <span
        className="w-2 h-2 rounded-full shrink-0"
        style={{ backgroundColor: lane?.color ?? '#444' }}
      />
      <span className="flex-1 min-w-0 text-sm text-[#e3e3e3] truncate">{todo.text}</span>

      {pushMode ? (
        <div className="flex items-center gap-1.5 shrink-0">
          <input
            type="date"
            value={pushDate}
            min={tomorrow}
            onChange={e => setPushDate(e.target.value)}
            className="text-[11px] border border-[#2a2a2a] rounded px-1.5 py-1 text-[#e3e3e3] outline-none focus:border-[#534AB7]"
            style={{ background: '#252525' }}
          />
          <button className={btnMuted} onClick={pushTo} disabled={busy}>→</button>
          <button className={btnMuted} onClick={() => setPushMode(false)} disabled={busy}>✕</button>
        </div>
      ) : (
        <div className="flex items-center gap-1.5 shrink-0">
          <button className={btnMuted} onClick={carryOver} disabled={busy}>carry over</button>
          <button className={btnMuted} onClick={() => setPushMode(true)} disabled={busy}>push to…</button>
          <button
            className={btnRed}
            onClick={killIt}
            disabled={busy}
            style={{ background: '#2a1a14', borderColor: '#4a2a1c' }}
          >
            kill it
          </button>
        </div>
      )}
    </div>
  )
}

export default function StampSheet({ todos, lanes, currentDate, onStamped, onCancel }: StampSheetProps) {
  const [resolvedIds, setResolvedIds] = useState<Set<string>>(new Set())

  const laneById   = Object.fromEntries(lanes.map(l => [l.id, l]))
  const tomorrow   = tomorrowISO(currentDate)
  const unresolved = todos.filter(t => !resolvedIds.has(t.id))

  useEffect(() => {
    if (resolvedIds.size > 0 && unresolved.length === 0) onStamped()
  }, [resolvedIds])

  function onResolved(id: string) {
    setResolvedIds(prev => new Set([...prev, id]))
  }

  return (
    <>
      {/* dark overlay */}
      <div className="fixed inset-0 bg-black/60 z-40" onClick={onCancel} />

      {/* bottom sheet */}
      <div
        className="fixed inset-x-0 bottom-0 z-50 rounded-t-xl border-t max-h-[60vh] flex flex-col"
        style={{ background: '#1e1e1e', borderColor: '#2a2a2a' }}
      >
        {/* header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b shrink-0" style={{ borderColor: '#2a2a2a' }}>
          <div>
            <p className="text-sm font-medium text-[#e3e3e3]">before you stamp…</p>
            <p className="text-xs text-[#888] mt-0.5">
              {unresolved.length} unresolved todo{unresolved.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="text-[#555] hover:text-[#e3e3e3] transition-colors text-base leading-none"
          >
            ✕
          </button>
        </div>

        {/* rows */}
        <div className="flex-1 overflow-y-auto px-5">
          {unresolved.map(todo => (
            <StampRow
              key={todo.id}
              todo={todo}
              lane={laneById[todo.lane_id]}
              tomorrow={tomorrow}
              onResolved={onResolved}
            />
          ))}
        </div>
      </div>
    </>
  )
}
