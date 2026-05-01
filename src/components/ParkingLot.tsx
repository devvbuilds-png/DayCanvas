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
}

export default function ParkingLot({ lanes, stamped }: ParkingLotProps) {
  const [composing,     setComposing]     = useState(false)
  const [managingLanes, setManagingLanes] = useState(false)

  const parkedTodos = useLiveQuery(
    () => db.todos.where('status').equals('parked').toArray(),
    []
  ) ?? []

  const laneById = Object.fromEntries(lanes.map(l => [l.id, l]))

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
      {/* top row */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#2a2a2a]">
        <span className="text-xs tracking-wide text-[#555]">
          parking lot · {parkedTodos.length} unscheduled
        </span>
        <div className="flex items-center gap-3">
          {/* lane legend */}
          {lanes.map(lane => (
            <div key={lane.id} className="flex items-center gap-1">
              <span
                className="w-2 h-2 rounded-full inline-block shrink-0"
                style={{ backgroundColor: lane.color }}
              />
              <span className="text-xs text-[#888]">{lane.name.toLowerCase()}</span>
            </div>
          ))}
          {/* manage lanes */}
          <button
            type="button"
            onClick={() => setManagingLanes(true)}
            className="px-2 py-0.5 text-xs text-[#888] hover:text-[#e3e3e3] transition-colors"
            title="manage lanes"
          >
            ⚙
          </button>

          {/* add button — hidden when stamped */}
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

      {/* body */}
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
