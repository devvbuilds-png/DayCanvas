import { useState } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import type { Lane } from '../db/schema'
import TodoComposer from './TodoComposer'
import ParkedTodoPill from './ParkedTodoPill'
import LaneManager from './LaneManager'

interface ParkingLotProps {
  lanes: Lane[]
  stamped: boolean
  gestureArmed: boolean
  gestureLatched: boolean
  onToggleGestureMode: () => void
  canUndoGesture: boolean
  onUndoGesture: () => void
}

function compareParkedTodos(a: { priority: number | null; created_at: string }, b: { priority: number | null; created_at: string }) {
  if (a.priority === null && b.priority !== null) return 1
  if (a.priority !== null && b.priority === null) return -1
  if (a.priority !== null && b.priority !== null && a.priority !== b.priority) return a.priority - b.priority
  return a.created_at.localeCompare(b.created_at)
}

export default function ParkingLot({
  lanes,
  stamped,
  gestureArmed,
  gestureLatched,
  onToggleGestureMode,
  canUndoGesture,
  onUndoGesture,
}: ParkingLotProps) {
  const [composing, setComposing] = useState(false)
  const [managingLanes, setManagingLanes] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const { setNodeRef, isOver } = useDroppable({ id: 'parking-lot' })

  const parkedTodos = useLiveQuery(
    () => db.todos.where('status').equals('parked').toArray().then(todos => todos.sort(compareParkedTodos)),
    [],
  ) ?? []

  const laneById = Object.fromEntries(lanes.map(lane => [lane.id, lane]))

  async function handleSave(text: string, laneId: string) {
    const now = new Date().toISOString()
    await db.todos.add({
      id: crypto.randomUUID(),
      text,
      lane_id: laneId,
      status: 'parked',
      priority: null,
      start_time: null,
      duration_minutes: null,
      stickers: [],
      description: '',
      created_at: now,
      updated_at: now,
    })
    setComposing(false)
  }

  async function handleDelete(id: string) {
    await db.todos.delete(id)
  }

  return (
    <>
      <div
        ref={setNodeRef}
        data-dropzone="parking-lot"
        className="rounded-md transition-colors"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{
          background: isOver ? '#1b1b1f' : isHovered ? '#191919' : '#161616',
          border: `1px solid ${isOver ? '#6965db44' : '#1e1e1e'}`,
          outline: isOver ? '1px solid #6965db44' : undefined,
        }}
      >
        <div className="flex items-center justify-between px-3 py-2" style={{ borderBottom: '1px solid #1e1e1e' }}>
          {/* left: headline + add */}
          <div className="flex items-center gap-2.5">
            <span className="text-[12px] font-semibold" style={{ color: '#888' }}>
              Parking lot
            </span>
            {parkedTodos.length > 0 && (
              <span className="text-[11px]" style={{ color: '#444' }}>
                {parkedTodos.length}
              </span>
            )}
            <div className="flex items-center gap-1.5 ml-1">
              {lanes.map(lane => (
                <span
                  key={lane.id}
                  className="w-[6px] h-[6px] rounded-sm inline-block shrink-0"
                  style={{ backgroundColor: lane.color, opacity: 0.65 }}
                  title={lane.name}
                />
              ))}
            </div>
            {!stamped && (
              <button
                type="button"
                onClick={() => setComposing(true)}
                className="px-2 py-0.5 text-[11px] rounded transition-colors"
                style={{ color: '#484848', border: '1px solid #222' }}
                onMouseEnter={e => {
                  e.currentTarget.style.color = '#d4d4d4'
                  e.currentTarget.style.background = '#1e1e1e'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.color = '#484848'
                  e.currentTarget.style.background = 'transparent'
                }}
              >
                + task
              </button>
            )}
          </div>

          {/* right: lanes, undo, gesture */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setManagingLanes(true)}
              className="px-2 py-0.5 text-[11px] rounded transition-colors"
              style={{ color: '#484848', border: '1px solid #222' }}
              onMouseEnter={e => {
                e.currentTarget.style.color = '#d4d4d4'
                e.currentTarget.style.background = '#1e1e1e'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.color = '#484848'
                e.currentTarget.style.background = 'transparent'
              }}
              title="manage lanes"
            >
              lanes
            </button>

            {!stamped && (
              <button
                type="button"
                onClick={onUndoGesture}
                disabled={!canUndoGesture}
                className="w-6 h-6 inline-flex items-center justify-center rounded transition-colors disabled:opacity-25 disabled:cursor-default"
                style={{
                  color: canUndoGesture ? '#555' : '#333',
                  border: '1px solid #222',
                  background: 'transparent',
                }}
                title="undo last gesture"
              >
                <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                  <path d="M4.25 3.25L1.75 5.75L4.25 8.25" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M2.1 5.75H6.7C8.633 5.75 10.2 7.317 10.2 9.25" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            )}

            {!stamped && (
              <button
                type="button"
                onClick={onToggleGestureMode}
                className="w-6 h-6 inline-flex items-center justify-center rounded text-sm transition-colors"
                style={{
                  color: gestureArmed ? '#e3e3e3' : '#444',
                  background: gestureLatched ? '#252525' : 'transparent',
                  border: '1px solid #222',
                }}
                title="gesture mode"
              >
                ✎
              </button>
            )}
          </div>
        </div>

        <div className="min-h-[56px] px-3 py-2.5 flex flex-col gap-2">
          {composing && !stamped && (
            <TodoComposer
              lanes={lanes}
              onSave={handleSave}
              onCancel={() => setComposing(false)}
            />
          )}

          {parkedTodos.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {parkedTodos.map(todo => (
                <ParkedTodoPill
                  key={todo.id}
                  todo={todo}
                  lane={laneById[todo.lane_id]}
                  onDelete={handleDelete}
                  gestureArmed={gestureArmed}
                />
              ))}
            </div>
          ) : (
            !composing && (
              <p className="text-[11px] italic" style={{ color: '#2e2e2e' }}>
                add a todo or drag one here
              </p>
            )
          )}
        </div>
      </div>

      {managingLanes && <LaneManager onClose={() => setManagingLanes(false)} />}
    </>
  )
}
