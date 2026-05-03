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

export default function TimelineLane({ lane, currentDate, onOpen, stamped, gestureArmed }: TimelineLaneProps) {
  const { setNodeRef, isOver } = useDroppable({ id: `track-${lane.id}` })
  const [isHovered, setIsHovered] = useState(false)

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
    <div className="flex items-stretch">
      {/* label gutter */}
      <div className="w-20 shrink-0 flex items-center pr-3">
        <span
          className="text-[11px] font-medium leading-none tracking-wide"
          style={{ color: hexToRgba(lane.color, 0.75) }}
        >
          {lane.name}
        </span>
      </div>

      {/* track */}
      <div
        ref={setNodeRef}
        data-dropzone={`lane-${lane.id}`}
        className="flex-1 h-10 rounded-md relative transition-colors"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{
          background: hexToRgba(lane.color, isOver ? 0.22 : isHovered ? 0.16 : 0.10),
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
