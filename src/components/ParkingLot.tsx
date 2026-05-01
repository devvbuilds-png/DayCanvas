import { useState } from 'react'
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
      <div data-dropzone="parking-lot" className="border border-[#2a2a2a] rounded-md" style={{ background: '#1e1e1e' }}>
        <div className="flex items-center justify-between px-3 py-2 border-b border-[#2a2a2a]">
          <span className="text-xs tracking-wide text-[#555]">
            parking lot · {parkedTodos.length} unscheduled
          </span>

          <div className="flex items-center gap-3">
            {lanes.map(lane => (
              <div key={lane.id} className="flex items-center gap-1">
                <span
                  className="w-2 h-2 rounded-full inline-block shrink-0"
                  style={{ backgroundColor: lane.color }}
                />
                <span className="text-xs text-[#888]">{lane.name.toLowerCase()}</span>
              </div>
            ))}

            <button
              type="button"
              onClick={() => setManagingLanes(true)}
              className="px-2 py-0.5 text-xs text-[#888] hover:text-[#e3e3e3] transition-colors"
              title="manage lanes"
            >
              lanes
            </button>

            {!stamped && (
              <button
                type="button"
                onClick={onUndoGesture}
                disabled={!canUndoGesture}
                className="w-6 h-6 inline-flex items-center justify-center border border-[#2a2a2a] rounded transition-colors disabled:opacity-40 disabled:cursor-default"
                style={{
                  color: canUndoGesture ? '#888' : '#555',
                  background: 'transparent',
                }}
                title="undo last gesture"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                  <path
                    d="M4.25 3.25L1.75 5.75L4.25 8.25"
                    stroke="currentColor"
                    strokeWidth="1.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M2.1 5.75H6.7C8.633 5.75 10.2 7.317 10.2 9.25"
                    stroke="currentColor"
                    strokeWidth="1.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            )}

            {!stamped && (
              <button
                type="button"
                onClick={onToggleGestureMode}
                className="px-2 py-0.5 text-xs border border-[#2a2a2a] rounded transition-colors"
              style={{
                color: gestureArmed ? '#e3e3e3' : '#888',
                background: gestureLatched ? '#252525' : 'transparent',
              }}
              title="gesture mode"
            >
              ✎
            </button>
          )}

            {!stamped && (
              <button
                type="button"
                onClick={() => setComposing(true)}
                className="px-2 py-0.5 text-xs text-[#888] border border-[#2a2a2a] rounded hover:bg-[#252525] hover:text-[#e3e3e3] transition-colors"
              >
                + add
              </button>
            )}
          </div>
        </div>

        <div className="min-h-[60px] px-3 py-2 flex flex-col gap-2">
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
              <p className="text-xs text-[#444] italic">
                drop todos here or hit + to add
              </p>
            )
          )}
        </div>
      </div>

      {managingLanes && <LaneManager onClose={() => setManagingLanes(false)} />}
    </>
  )
}
