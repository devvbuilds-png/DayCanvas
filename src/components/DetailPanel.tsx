import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import type { Lane, Todo } from '../db/schema'
import { minutesFrom6am, formatTime } from '../lib/time'

interface DetailPanelProps {
  todoId: string
  currentDate: string
  onClose: () => void
}

export default function DetailPanel({ todoId, currentDate, onClose }: DetailPanelProps) {
  const todo = useLiveQuery(() => db.todos.get(todoId), [todoId])
  const lane = useLiveQuery(
    () => todo ? db.lanes.get(todo.lane_id) : undefined,
    [todo?.lane_id]
  )

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!todo || !lane || !todo.start_time) return null
  const scheduledTodo = todo as Todo & { start_time: string }

  return (
    <DetailPanelContent
      key={scheduledTodo.id}
      todo={scheduledTodo}
      lane={lane}
      todoId={todoId}
      currentDate={currentDate}
      onClose={onClose}
    />
  )
}

interface DetailPanelContentProps {
  todo: Todo & { start_time: string }
  lane: Lane
  todoId: string
  currentDate: string
  onClose: () => void
}

function DetailPanelContent({ todo, lane, todoId, currentDate, onClose }: DetailPanelContentProps) {
  const [localText, setLocalText] = useState(todo.text)
  const [localDesc, setLocalDesc] = useState(todo.description ?? '')

  const startMins = minutesFrom6am(todo.start_time)
  const duration  = todo.duration_minutes ?? 60
  const endMins   = startMins + duration

  function saveText() {
    const t = localText.trim()
    if (!t || t === todo.text) return
    db.todos.update(todoId, { text: t, updated_at: new Date().toISOString() })
  }

  function saveDesc() {
    if (localDesc === todo.description) return
    db.todos.update(todoId, { description: localDesc, updated_at: new Date().toISOString() })
  }

  function adjustStart(delta: number) {
    const newStart = Math.max(0, Math.min(startMins + delta, 1080 - duration))
    if (newStart === startMins) return
    const base = new Date(`${currentDate}T06:00:00`)
    base.setMinutes(base.getMinutes() + newStart)
    db.todos.update(todoId, { start_time: base.toISOString(), updated_at: new Date().toISOString() })
  }

  function adjustEnd(delta: number) {
    const newDuration = Math.max(30, Math.min(duration + delta, 1080 - startMins))
    if (newDuration === duration) return
    db.todos.update(todoId, { duration_minutes: newDuration, updated_at: new Date().toISOString() })
  }

  const stepBtn = 'px-2 py-1 text-[10px] rounded transition-colors tnum'

  return (
    <>
      {/* backdrop */}
      <div className="fixed inset-0 z-20" onClick={onClose} />

      {/* panel */}
      <div
        className="fixed right-0 inset-y-0 w-[280px] z-30 flex flex-col p-5 gap-5 overflow-y-auto"
        style={{ background: '#161616', borderLeft: '1px solid #1e1e1e' }}
      >
        {/* todo text */}
        <input
          autoFocus
          type="text"
          value={localText}
          onChange={e => setLocalText(e.target.value)}
          onBlur={saveText}
          onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
          className="text-[15px] font-semibold text-[#d8d8d8] outline-none border-b pb-2.5 w-full bg-transparent tracking-tight"
          style={{ borderColor: '#222' }}
        />

        {/* lane indicator */}
        <div className="flex items-center gap-1.5">
          <span
            className="w-[6px] h-[6px] rounded-sm shrink-0"
            style={{ backgroundColor: lane.color, opacity: 0.85 }}
          />
          <span className="text-[11px]" style={{ color: '#555' }}>{lane.name}</span>
        </div>

        {/* start time */}
        <div>
          <div className="text-[10px] tracking-widest uppercase text-[#383838] mb-1.5">start</div>
          <div className="flex items-center gap-2">
            <button
              className={stepBtn}
              style={{ color: '#555', border: '1px solid #222' }}
              onMouseEnter={e => { e.currentTarget.style.color = '#e3e3e3'; e.currentTarget.style.background = '#1e1e1e' }}
              onMouseLeave={e => { e.currentTarget.style.color = '#555'; e.currentTarget.style.background = 'transparent' }}
              onClick={() => adjustStart(-30)}
            >– 30m</button>
            <span className="flex-1 text-center text-[13px] tnum" style={{ color: '#c8c8c8' }}>{formatTime(startMins)}</span>
            <button
              className={stepBtn}
              style={{ color: '#555', border: '1px solid #222' }}
              onMouseEnter={e => { e.currentTarget.style.color = '#e3e3e3'; e.currentTarget.style.background = '#1e1e1e' }}
              onMouseLeave={e => { e.currentTarget.style.color = '#555'; e.currentTarget.style.background = 'transparent' }}
              onClick={() => adjustStart(30)}
            >+ 30m</button>
          </div>
        </div>

        {/* end time */}
        <div>
          <div className="text-[10px] tracking-widest uppercase text-[#383838] mb-1.5">end</div>
          <div className="flex items-center gap-2">
            <button
              className={stepBtn}
              style={{ color: '#555', border: '1px solid #222' }}
              onMouseEnter={e => { e.currentTarget.style.color = '#e3e3e3'; e.currentTarget.style.background = '#1e1e1e' }}
              onMouseLeave={e => { e.currentTarget.style.color = '#555'; e.currentTarget.style.background = 'transparent' }}
              onClick={() => adjustEnd(-30)}
            >– 30m</button>
            <span className="flex-1 text-center text-[13px] tnum" style={{ color: '#c8c8c8' }}>{formatTime(endMins)}</span>
            <button
              className={stepBtn}
              style={{ color: '#555', border: '1px solid #222' }}
              onMouseEnter={e => { e.currentTarget.style.color = '#e3e3e3'; e.currentTarget.style.background = '#1e1e1e' }}
              onMouseLeave={e => { e.currentTarget.style.color = '#555'; e.currentTarget.style.background = 'transparent' }}
              onClick={() => adjustEnd(30)}
            >+ 30m</button>
          </div>
        </div>

        {/* notes */}
        <div className="flex-1 flex flex-col">
          <div className="text-[10px] tracking-widest uppercase text-[#383838] mb-1.5">notes</div>
          <textarea
            value={localDesc}
            onChange={e => setLocalDesc(e.target.value)}
            onBlur={saveDesc}
            placeholder="add a note…"
            className="flex-1 min-h-[80px] text-xs text-[#e3e3e3] placeholder:text-[#444] resize-none outline-none bg-transparent leading-relaxed"
          />
        </div>

        {/* action buttons */}
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={async () => {
              onClose()
              await db.todos.delete(todoId)
            }}
            className="w-full py-1.5 rounded-md text-[11px] font-medium transition-colors"
            style={{ border: '1px solid #222', color: '#555' }}
            onMouseEnter={e => { e.currentTarget.style.color = '#c05040'; e.currentTarget.style.background = '#1e1412'; e.currentTarget.style.borderColor = '#3a1e18' }}
            onMouseLeave={e => { e.currentTarget.style.color = '#555'; e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = '#222' }}
          >
            delete task
          </button>
          {todo.status !== 'missed' && (
            <button
              type="button"
              onClick={() => {
                const newStatus = todo.status === 'done' ? 'scheduled' : 'done'
                db.todos.update(todoId, { status: newStatus, updated_at: new Date().toISOString() })
              }}
              className="w-full py-1.5 rounded-md text-[11px] font-medium transition-colors"
              style={
                todo.status === 'done'
                  ? { border: '1px solid #222', color: '#555' }
                  : { background: '#4b47a8', color: '#fff', border: '1px solid transparent' }
              }
            >
              {todo.status === 'done' ? 'mark incomplete' : 'mark done ✓'}
            </button>
          )}

          {todo.status !== 'done' && (
            <button
              type="button"
              onClick={() => {
                const newStatus = todo.status === 'missed' ? 'scheduled' : 'missed'
                db.todos.update(todoId, { status: newStatus, updated_at: new Date().toISOString() })
              }}
              className="w-full py-1.5 rounded-md text-[11px] font-medium transition-colors"
              style={
                todo.status === 'missed'
                  ? { background: '#1e1210', border: '1px solid #3a1e18', color: '#b04530' }
                  : { border: '1px solid #222', color: '#555' }
              }
            >
              {todo.status === 'missed' ? 'mark as scheduled' : 'mark missed ✗'}
            </button>
          )}
        </div>
      </div>
    </>
  )
}
