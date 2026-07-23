import { useState } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import type { Lane } from '../db/schema'
import TimelinePill from './TimelinePill'

interface TimelineLaneProps {
  lane: Lane
  currentDate: string
  onOpen: (id: string) => void
  stamped: boolean
  gestureArmed: boolean
  isDragging?: boolean
  onLabelPointerDown?: (e: React.PointerEvent) => void
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

// 6a–12a = 18 hours = 36 half-hour intervals → 35 internal gridlines
const GRID_LINES = Array.from({ length: 35 }, (_, i) => {
  const interval = i + 1
  return { pct: (interval / 36) * 100, isHour: interval % 2 === 0 }
})

export default function TimelineLane({ lane, currentDate, onOpen, stamped, gestureArmed, isDragging, onLabelPointerDown }: TimelineLaneProps) {
  const { setNodeRef, isOver } = useDroppable({ id: `track-${lane.id}` })
  const [isEditing, setIsEditing] = useState(false)

  async function commitRename(value: string) {
    setIsEditing(false)
    const name = value.trim()
    if (!name || name === lane.name) return
    await db.lanes.update(lane.id, { name: name.charAt(0).toUpperCase() + name.slice(1) })
  }

  const scheduledTodos = useLiveQuery(
    () =>
      db.todos
        .where('lane_id')
        .equals(lane.id)
        .filter(
          t =>
            (t.status === 'scheduled' || t.status === 'done' || t.status === 'missed' || t.status === 'carried') &&
            (t.start_time?.startsWith(currentDate) ?? false)
        )
        .toArray(),
    [lane.id, currentDate]
  ) ?? []

  return (
    <div
      data-lane-row
      className="flex items-stretch transition-opacity"
      style={{ opacity: isDragging ? 0.35 : 1 }}
    >
      {/* label gutter */}
      <div className="w-20 shrink-0 flex items-center pr-3">
        {isEditing ? (
          <input
            type="text"
            autoFocus
            defaultValue={lane.name}
            onFocus={e => e.currentTarget.select()}
            onBlur={e => commitRename(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') e.currentTarget.blur()
              if (e.key === 'Escape') { e.currentTarget.value = lane.name; e.currentTarget.blur() }
            }}
            className="w-full min-w-0 text-[11px] font-medium leading-none tracking-wide bg-transparent outline-none border-b py-0.5"
            style={{ color: lane.color, borderColor: hexToRgba(lane.color, 0.4) }}
          />
        ) : (
          <span
            onPointerDown={onLabelPointerDown}
            onDoubleClick={() => setIsEditing(true)}
            title={lane.name}
            className="text-[11px] font-medium leading-none tracking-wide cursor-grab active:cursor-grabbing select-none truncate"
            style={{ color: hexToRgba(lane.color, 0.75) }}
          >
            {lane.name}
          </span>
        )}
      </div>

      {/* track */}
      <div
        ref={setNodeRef}
        data-dropzone={`lane-${lane.id}`}
        className="flex-1 h-10 rounded-md relative transition-colors"
        style={{
          background: hexToRgba(lane.color, isOver ? 0.22 : 0.10),
          outline: isOver ? `1px dashed ${hexToRgba(lane.color, 0.5)}` : undefined,
        }}
      >
        {/* gridlines */}
        <div className="absolute inset-0 pointer-events-none rounded-md overflow-hidden">
          {GRID_LINES.map(({ pct, isHour }) => (
            <div
              key={pct}
              className="absolute top-0 bottom-0"
              style={{
                left: `${pct}%`,
                width: '0.5px',
                background: isHour ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.025)',
              }}
            />
          ))}
        </div>

        {scheduledTodos.map(todo => (
          <TimelinePill
            key={todo.id}
            todo={todo}
            lane={lane}
            currentDate={currentDate}
            onOpen={onOpen}
            stamped={stamped}
            gestureArmed={gestureArmed}
          />
        ))}
      </div>
    </div>
  )
}
