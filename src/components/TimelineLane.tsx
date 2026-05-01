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

export default function TimelineLane({ lane, currentDate, onOpen, stamped }: TimelineLaneProps) {
  const { setNodeRef, isOver } = useDroppable({ id: `track-${lane.id}` })

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
        <span className="text-xs font-medium leading-none" style={{ color: lane.color }}>
          {lane.name.toLowerCase()}
        </span>
      </div>

      {/* track — overflow visible so readout tooltips escape upward */}
      <div
        ref={setNodeRef}
        data-dropzone={`lane-${lane.id}`}
        className="flex-1 h-9 rounded relative transition-colors"
        style={{
          background: hexToRgba(lane.color, isOver ? 0.20 : 0.12),
          outline: isOver ? `1px dashed ${lane.color}66` : undefined,
        }}
      >
        {/* gridlines behind pills */}
        <div className="absolute inset-0 pointer-events-none rounded overflow-hidden">
          {GRID_LINES.map(({ pct, isHour }) => (
            <div
              key={pct}
              className="absolute top-0 bottom-0"
              style={{
                left:       `${pct}%`,
                width:      '0.5px',
                background: isHour ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)',
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
          />
        ))}
      </div>
    </div>
  )
}
