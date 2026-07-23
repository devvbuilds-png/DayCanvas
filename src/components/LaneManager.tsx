import { useState, useRef, useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import type { Lane } from '../db/schema'
import { applyReorder } from '../lib/lanes'

interface LaneManagerProps {
  onClose: () => void
}

const PRESET_COLORS = [
  '#534AB7', '#0F6E56', '#D85A30', '#BA7517', '#2D7DD2', '#A84484',
  '#3F9142', '#1E96A8', '#7C3FB0', '#C23B5A', '#9C8F1F',
]
const EMPTY_LANES: Lane[] = []

export default function LaneManager({ onClose }: LaneManagerProps) {
  const lanes = useLiveQuery(() => db.lanes.orderBy('order').toArray(), []) ?? EMPTY_LANES

  const [newName,  setNewName]  = useState('')
  const [newColor, setNewColor] = useState(PRESET_COLORS[4])

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const confirmTodoCount = useLiveQuery(
    async () => confirmDeleteId
      ? db.todos.where('lane_id').equals(confirmDeleteId).count()
      : 0,
    [confirmDeleteId]
  ) ?? 0

  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [overIdx,    setOverIdx]    = useState<number | null>(null)
  const listRef  = useRef<HTMLDivElement>(null)
  const lanesRef = useRef<Lane[]>(lanes)
  const dragState = useRef<{ id: string | null; over: number | null }>({ id: null, over: null })

  useEffect(() => { lanesRef.current = lanes }, [lanes])

  // — Drag ————————————————————————————————————

  function startDrag(e: React.PointerEvent, laneId: string) {
    e.preventDefault()
    const fromIdx = lanesRef.current.findIndex(l => l.id === laneId)
    dragState.current = { id: laneId, over: fromIdx }
    setDraggingId(laneId)
    setOverIdx(fromIdx)

    function onMove(ev: PointerEvent) {
      if (!listRef.current) return
      const rows = listRef.current.querySelectorAll('[data-row]')
      let insertBefore = 0
      rows.forEach((row, i) => {
        const rect = row.getBoundingClientRect()
        if (ev.clientY > rect.top + rect.height / 2) insertBefore = i + 1
      })
      dragState.current.over = insertBefore
      setOverIdx(insertBefore)
    }

    async function onUp() {
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup',   onUp)

      const { id: dId, over: finalOver } = dragState.current
      setDraggingId(null)
      setOverIdx(null)
      dragState.current = { id: null, over: null }

      if (!dId || finalOver === null) return
      const currentFromIdx = lanesRef.current.findIndex(l => l.id === dId)
      if (currentFromIdx === finalOver || currentFromIdx + 1 === finalOver) return

      const reordered = applyReorder(lanesRef.current, dId, finalOver)
      await Promise.all(reordered.map((lane, i) => db.lanes.update(lane.id, { order: i })))
    }

    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup',   onUp)
  }

  // — CRUD ————————————————————————————————————

  async function addLane() {
    const name = newName.trim()
    if (!name) return
    const maxOrder = lanes.length > 0 ? Math.max(...lanes.map(l => l.order)) + 1 : 0
    await db.lanes.add({
      id:    crypto.randomUUID(),
      name:  name.charAt(0).toUpperCase() + name.slice(1),
      color: newColor,
      order: maxOrder,
    })
    setNewName('')
    setNewColor(PRESET_COLORS[4])
  }

  async function renameLane(id: string, value: string) {
    const name = value.trim()
    if (!name) return
    await db.lanes.update(id, { name: name.charAt(0).toUpperCase() + name.slice(1) })
  }

  async function deleteLane(id: string) {
    const now = new Date().toISOString()
    const todos = await db.todos.where('lane_id').equals(id).toArray()
    await Promise.all(
      todos.map(t =>
        db.todos.update(t.id, {
          status:           'parked',
          start_time:       null,
          duration_minutes: null,
          updated_at:       now,
        })
      )
    )
    await db.lanes.delete(id)
    setConfirmDeleteId(null)
  }

  // — Render ——————————————————————————————————

  const btnSmall = 'px-2 py-0.5 text-[11px] rounded border border-[#2a2a2a] text-[#888] hover:bg-[#252525] hover:text-[#e3e3e3] transition-colors'

  return (
    <>
      {/* backdrop */}
      <div className="fixed inset-0 z-40" onClick={onClose} />

      {/* panel */}
      <div
        className="fixed z-50 top-24 right-6 w-[300px] border rounded-lg flex flex-col"
        style={{ background: '#1e1e1e', borderColor: '#2a2a2a' }}
        onClick={e => e.stopPropagation()}
      >
        {/* header */}
        <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: '#2a2a2a' }}>
          <span className="text-sm font-medium text-[#e3e3e3]">manage lanes</span>
          <button
            type="button"
            onClick={onClose}
            className="text-[#555] hover:text-[#e3e3e3] transition-colors leading-none"
          >
            ✕
          </button>
        </div>

        {/* lane list */}
        <div ref={listRef} className="px-2 py-1.5">
          {lanes.map((lane, idx) => {
            const isDragging     = draggingId === lane.id
            const showLineBefore = draggingId !== null && overIdx === idx

            return (
              <div key={lane.id}>
                {showLineBefore && (
                  <div className="h-0.5 bg-[#534AB7] rounded mx-2 my-0.5" />
                )}

                <div
                  data-row
                  className={`flex items-center gap-2 px-2 py-2 rounded transition-opacity ${isDragging ? 'opacity-30' : 'hover:bg-[#252525]'}`}
                >
                  {/* drag handle */}
                  <div
                    onPointerDown={e => startDrag(e, lane.id)}
                    className="text-[#444] hover:text-[#888] cursor-grab active:cursor-grabbing select-none text-sm leading-none shrink-0"
                  >
                    ⠿
                  </div>

                  {/* color dot */}
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: lane.color }}
                  />

                  {/* confirm delete row */}
                  {confirmDeleteId === lane.id ? (
                    <div className="flex-1 flex items-center gap-2 min-w-0">
                      <span className="text-[11px] text-[#888] flex-1 truncate">
                        move {confirmTodoCount} todo{confirmTodoCount !== 1 ? 's' : ''} to parking lot?
                      </span>
                      <button
                        type="button"
                        onClick={() => deleteLane(lane.id)}
                        className="text-[11px] text-white bg-[#D85A30] px-2 py-0.5 rounded hover:bg-[#c04f28] transition-colors shrink-0"
                      >
                        confirm
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(null)}
                        className={`${btnSmall} shrink-0`}
                      >
                        cancel
                      </button>
                    </div>
                  ) : (
                    <>
                      {/* editable name */}
                      <input
                        type="text"
                        defaultValue={lane.name}
                        onBlur={e => renameLane(lane.id, e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
                        className="flex-1 min-w-0 text-sm text-[#e3e3e3] outline-none bg-transparent border-b border-transparent py-0.5"
                        style={{ '--tw-border-opacity': 1 } as React.CSSProperties}
                        onFocus={e => (e.currentTarget.style.borderColor = '#2a2a2a')}
                        onBlurCapture={e => (e.currentTarget.style.borderColor = 'transparent')}
                      />

                      {/* delete trigger */}
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(lane.id)}
                        className="text-[#444] hover:text-[#D85A30] transition-colors text-base leading-none shrink-0"
                      >
                        ×
                      </button>
                    </>
                  )}
                </div>
              </div>
            )
          })}

          {/* drop line at bottom of list */}
          {draggingId !== null && overIdx === lanes.length && (
            <div className="h-0.5 bg-[#534AB7] rounded mx-2 my-0.5" />
          )}
        </div>

        {/* add lane */}
        <div className="border-t px-4 py-3" style={{ borderColor: '#2a2a2a' }}>
          <div className="text-[10px] tracking-wide text-[#555] mb-2">add lane</div>

          {/* color swatches */}
          <div className="flex items-center gap-1.5 mb-2.5">
            {PRESET_COLORS.map(color => (
              <button
                key={color}
                type="button"
                onClick={() => setNewColor(color)}
                title={color}
                className={`w-5 h-5 rounded-full transition-transform ${
                  newColor === color ? 'scale-110' : 'hover:scale-110'
                }`}
                style={{
                  backgroundColor: color,
                  outline: newColor === color ? `2px solid #6965db` : undefined,
                  outlineOffset: newColor === color ? '2px' : undefined,
                }}
              />
            ))}
          </div>

          {/* name + add */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addLane() }}
              placeholder="lane name…"
              className="flex-1 text-sm border rounded px-2 py-1 outline-none text-[#e3e3e3] placeholder:text-[#444]"
              style={{ background: '#252525', borderColor: '#2a2a2a' }}
              onFocus={e => (e.currentTarget.style.borderColor = '#534AB7')}
              onBlur={e => (e.currentTarget.style.borderColor = '#2a2a2a')}
            />
            <button
              type="button"
              onClick={addLane}
              disabled={!newName.trim()}
              className="px-3 py-1 text-xs font-medium bg-[#534AB7] text-white rounded hover:bg-[#4840a3] transition-colors disabled:opacity-40"
            >
              add
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
