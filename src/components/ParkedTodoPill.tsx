import { useDraggable } from '@dnd-kit/core'
import type { Todo, Lane } from '../db/schema'

interface ParkedTodoPillProps {
  todo: Todo
  lane: Lane | undefined
  onDelete: (id: string) => void
  gestureArmed: boolean
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

export default function ParkedTodoPill({
  todo,
  lane,
  onDelete,
  gestureArmed,
}: ParkedTodoPillProps) {
  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({ id: todo.id })
  const laneColor = lane?.color ?? '#555'

  return (
    <div
      ref={setNodeRef}
      {...(gestureArmed ? {} : listeners)}
      {...(gestureArmed ? {} : attributes)}
      title={todo.text}
      data-gesture-target="todo"
      data-todo-id={todo.id}
      data-todo-kind="parked"
      className="group relative flex items-center gap-1.5 px-2 py-1.5 rounded-md text-[11px] text-[#d4d4d4] leading-snug select-none cursor-grab active:cursor-grabbing"
      style={{
        background: hexToRgba(laneColor, 0.07),
        border: `1px solid ${hexToRgba(laneColor, 0.28)}`,
        opacity: isDragging ? 0.4 : 1,
      }}
    >
      {todo.priority !== null && (
        <span
          className="inline-flex items-center justify-center w-[18px] h-[18px] rounded-full text-[9px] font-semibold shrink-0"
          style={{
            background: hexToRgba(laneColor, 0.18),
            color: laneColor,
          }}
        >
          {todo.priority}
        </span>
      )}

      <span
        className="w-[5px] h-[5px] rounded-sm shrink-0"
        style={{ backgroundColor: laneColor, opacity: 0.85 }}
      />

      <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap pr-4">
        {todo.text}
      </span>

      <button
        type="button"
        onPointerDown={e => e.stopPropagation()}
        onClick={() => onDelete(todo.id)}
        className="absolute right-1.5 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer leading-none"
        style={{ color: '#444', fontSize: '13px' }}
        onMouseEnter={e => (e.currentTarget.style.color = '#888')}
        onMouseLeave={e => (e.currentTarget.style.color = '#444')}
        aria-label="delete todo"
      >
        ×
      </button>
    </div>
  )
}
