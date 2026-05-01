import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
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

  const [localText, setLocalText] = useState('')
  const [localDesc, setLocalDesc] = useState('')
  const textRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (todo) {
      setLocalText(todo.text)
      setLocalDesc(todo.description ?? '')
    }
  }, [todo?.id])

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!todo || !lane || !todo.start_time) return null

  const startMins = minutesFrom6am(todo.start_time)
  const duration  = todo.duration_minutes ?? 60
  const endMins   = startMins + duration

  function saveText() {
    const t = localText.trim()
    if (!t || t === todo!.text) return
    db.todos.update(todoId, { text: t, updated_at: new Date().toISOString() })
  }

  function saveDesc() {
    if (localDesc === (todo!.description ?? '')) return
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

  const stepBtn = 'px-2 py-1 text-[10px] text-[#888] border border-[#2a2a2a] rounded hover:bg-[#252525] hover:text-[#e3e3e3] transition-colors'

  return (
    <>
      {/* backdrop */}
      <div className="fixed inset-0 z-20" onClick={onClose} />

      {/* panel */}
      <div
        className="fixed right-0 inset-y-0 w-[280px] border-l z-30 flex flex-col p-4 gap-5 overflow-y-auto"
        style={{ background: '#1e1e1e', borderColor: '#2a2a2a' }}
      >
        {/* todo text */}
        <input
          ref={textRef}
          autoFocus
          type="text"
          value={localText}
          onChange={e => setLocalText(e.target.value)}
          onBlur={saveText}
          onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
          className="text-[15px] font-medium text-[#e3e3e3] outline-none border-b pb-2 w-full bg-transparent"
          style={{ borderColor: '#2a2a2a' }}
        />

        {/* lane indicator */}
        <div className="flex items-center gap-1.5">
          <span
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{ backgroundColor: lane.color }}
          />
          <span className="text-xs text-[#888]">{lane.name.toLowerCase()}</span>
        </div>

        {/* start time */}
        <div>
          <div className="text-[10px] tracking-wide text-[#555] mb-1.5">start</div>
          <div className="flex items-center gap-2">
            <button className={stepBtn} onClick={() => adjustStart(-30)}>– 30m</button>
            <span className="flex-1 text-center text-sm text-[#e3e3e3]">{formatTime(startMins)}</span>
            <button className={stepBtn} onClick={() => adjustStart(30)}>+ 30m</button>
          </div>
        </div>

        {/* end time */}
        <div>
          <div className="text-[10px] tracking-wide text-[#555] mb-1.5">end</div>
          <div className="flex items-center gap-2">
            <button className={stepBtn} onClick={() => adjustEnd(-30)}>– 30m</button>
            <span className="flex-1 text-center text-sm text-[#e3e3e3]">{formatTime(endMins)}</span>
            <button className={stepBtn} onClick={() => adjustEnd(30)}>+ 30m</button>
          </div>
        </div>

        {/* notes */}
        <div className="flex-1 flex flex-col">
          <div className="text-[10px] tracking-wide text-[#555] mb-1.5">notes</div>
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
          {todo.status !== 'missed' && (
            <button
              type="button"
              onClick={() => {
                const newStatus = todo.status === 'done' ? 'scheduled' : 'done'
                db.todos.update(todoId, { status: newStatus, updated_at: new Date().toISOString() })
              }}
              className={`w-full py-1.5 rounded text-xs font-medium transition-colors ${
                todo.status === 'done'
                  ? 'border border-[#2a2a2a] text-[#888] hover:bg-[#252525]'
                  : 'bg-[#534AB7] text-white hover:bg-[#4840a3]'
              }`}
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
              className={`w-full py-1.5 rounded text-xs font-medium transition-colors ${
                todo.status === 'missed'
                  ? 'border text-[#D85A30] hover:opacity-80'
                  : 'border border-[#2a2a2a] text-[#888] hover:bg-[#252525] hover:text-[#D85A30]'
              }`}
              style={todo.status === 'missed' ? { background: '#2a1a14', borderColor: '#4a2a1c' } : {}}
            >
              {todo.status === 'missed' ? 'mark as scheduled' : 'mark missed ✗'}
            </button>
          )}
        </div>
      </div>
    </>
  )
}
