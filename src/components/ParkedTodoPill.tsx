import { useDraggable } from '@dnd-kit/core'
import type { Todo, Lane } from '../db/schema'

interface ParkedTodoPillProps {
  todo: Todo
  lane: Lane | undefined
  onDelete: (id: string) => void
  gestureArmed: boolean
}

export default function ParkedTodoPill({
  todo,
  lane,
  onDelete,
  gestureArmed,
}: ParkedTodoPillProps) {
  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({ id: todo.id })
  const borderColor = lane?.color ?? '#444'

  return (
    <div
      ref={setNodeRef}
      {...(gestureArmed ? {} : listeners)}
      {...(gestureArmed ? {} : attributes)}
      data-gesture-target="todo"
      data-todo-id={todo.id}
      data-todo-kind="parked"
      className="group relative flex items-center gap-1.5 pl-2.5 pr-6 py-1 rounded text-[11px] text-[#e3e3e3] leading-snug border-l-[3px] select-none cursor-grab active:cursor-grabbing"
      style={{
        borderLeftColor: borderColor,
        background: '#2a2a2a',
        opacity: isDragging ? 0.45 : 1,
      }}
    >
      {todo.priority !== null && (
        <span
          className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] border shrink-0"
          style={{ borderColor: `${borderColor}88`, color: '#e3e3e3' }}
        >
          {todo.priority}
        </span>
      )}

      <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
        {todo.text}
      </span>

      <button
        type="button"
        onPointerDown={e => e.stopPropagation()}
        onClick={() => onDelete(todo.id)}
        className="absolute right-1.5 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 text-[#888] hover:text-[#e3e3e3] text-sm leading-none transition-opacity cursor-pointer"
        aria-label="delete todo"
      >
        x
      </button>
    </div>
  )
}
