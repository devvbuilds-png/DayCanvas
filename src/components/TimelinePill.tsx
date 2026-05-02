import { useRef, useState } from 'react'
import { useDraggable } from '@dnd-kit/core'
import { db } from '../db/db'
import { minutesFrom6am, formatRange } from '../lib/time'
import type { Todo, Lane } from '../db/schema'

interface TimelinePillProps {
  todo: Todo
  lane: Lane
  currentDate: string
  onOpen: (id: string) => void
  stamped: boolean
  gestureArmed: boolean
}

interface ResizeGesture {
  edge: 'left' | 'right'
  startPointerX: number
  originalStartMins: number
  originalDurationMins: number
  trackWidth: number
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

export default function TimelinePill({
  todo,
  lane,
  currentDate,
  onOpen,
  stamped,
  gestureArmed,
}: TimelinePillProps) {
  const { setNodeRef: dndRef, listeners, attributes, isDragging } = useDraggable({ id: todo.id })

  const containerRef = useRef<HTMLDivElement>(null)
  const gesture = useRef<ResizeGesture | null>(null)
  const liveRef = useRef<{ startMins: number; durationMins: number } | null>(null)
  const clickOrigin = useRef<{ x: number; y: number } | null>(null)

  const [live, setLive] = useState<{ startMins: number; durationMins: number } | null>(null)
  const [isHovering, setHovering] = useState(false)

  const baseStart = minutesFrom6am(todo.start_time!)
  const baseDuration = todo.duration_minutes ?? 60

  const displayStart = live?.startMins ?? baseStart
  const displayDuration = live?.durationMins ?? baseDuration

  const isResizing = live !== null
  const showReadout = isResizing || (isHovering && !isDragging)

  function onHandleDown(e: React.PointerEvent, edge: 'left' | 'right') {
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    gesture.current = {
      edge,
      startPointerX: e.clientX,
      originalStartMins: baseStart,
      originalDurationMins: baseDuration,
      trackWidth: containerRef.current?.parentElement?.getBoundingClientRect().width ?? 1,
    }
  }

  function onHandleMove(e: React.PointerEvent) {
    const g = gesture.current
    if (!g) return

    const snapped = Math.round(((e.clientX - g.startPointerX) / g.trackWidth) * 1080 / 30) * 30
    let newStart = g.originalStartMins
    let newDuration: number

    if (g.edge === 'right') {
      newDuration = Math.max(30, Math.min(g.originalDurationMins + snapped, 1080 - g.originalStartMins))
    } else {
      const maxStart = g.originalStartMins + g.originalDurationMins - 30
      newStart = Math.max(0, Math.min(g.originalStartMins + snapped, maxStart))
      newDuration = g.originalDurationMins - (newStart - g.originalStartMins)
    }

    const next = { startMins: newStart, durationMins: newDuration }
    liveRef.current = next
    setLive(next)
  }

  function onHandleUp(e: React.PointerEvent) {
    e.currentTarget.releasePointerCapture(e.pointerId)
    const final = liveRef.current
    gesture.current = null
    liveRef.current = null
    setLive(null)

    if (!final) return
    if (final.startMins === baseStart && final.durationMins === baseDuration) return

    const base = new Date(`${currentDate}T06:00:00`)
    base.setMinutes(base.getMinutes() + final.startMins)
    db.todos.update(todo.id, {
      start_time: base.toISOString(),
      duration_minutes: final.durationMins,
      updated_at: new Date().toISOString(),
    })
  }

  function onMouseDown(e: React.MouseEvent) {
    clickOrigin.current = { x: e.clientX, y: e.clientY }
  }

  function handleClick(e: React.MouseEvent) {
    if (gestureArmed) return
    if (!clickOrigin.current) return
    const dx = e.clientX - clickOrigin.current.x
    const dy = e.clientY - clickOrigin.current.y
    if (dx * dx + dy * dy > 16) return
    onOpen(todo.id)
  }

  const handleEvents = {
    onPointerMove: onHandleMove,
    onPointerUp: onHandleUp,
  }
  const handleVis = isDragging || gestureArmed
    ? 'opacity-0 pointer-events-none'
    : 'opacity-0 group-hover:opacity-100'

  const isAlt = todo.status === 'done' || todo.status === 'missed' || todo.status === 'carried'

  const pillBg = isAlt
    ? hexToRgba(lane.color, 0.08)
    : hexToRgba(lane.color, 0.18)
  const pillBorder = hexToRgba(lane.color, isAlt ? 0.18 : 0.38)

  return (
    <div
      ref={el => { containerRef.current = el; dndRef(el) }}
      {...(stamped || gestureArmed ? {} : listeners)}
      {...(stamped || gestureArmed ? {} : attributes)}
      title={todo.text}
      data-gesture-target="todo"
      data-todo-id={todo.id}
      data-todo-kind="timeline"
      onMouseDown={onMouseDown}
      onClick={handleClick}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      className={`group absolute top-0.5 bottom-0.5 flex items-center pl-2 pr-1 rounded-md ${stamped ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'}`}
      style={{
        left: `${(displayStart / 1080) * 100}%`,
        width: `${(displayDuration / 1080) * 100}%`,
        background: pillBg,
        border: `1px solid ${pillBorder}`,
        opacity: isDragging ? 0.4 : isAlt ? 0.55 : 1,
      }}
    >
      {showReadout && (
        <div
          className="absolute bottom-full left-0 mb-1.5 px-2 py-1 rounded-md text-[10px] whitespace-nowrap z-50 pointer-events-none tnum"
          style={{ border: '1px solid #252525', background: '#181818', color: '#666' }}
        >
          {formatRange(displayStart, displayDuration)}
        </div>
      )}

      {!stamped && (
        <div
          {...handleEvents}
          onPointerDown={e => onHandleDown(e, 'left')}
          className={`absolute left-0 top-0 bottom-0 w-1.5 cursor-ew-resize z-10 transition-opacity rounded-l-md ${handleVis}`}
          style={{ background: hexToRgba(lane.color, 0.45) }}
        />
      )}

      <span className={`text-[11px] leading-none select-none flex-1 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap ${
        todo.status === 'done' ? 'line-through' :
        todo.status === 'missed' || todo.status === 'carried' ? '' :
        ''
      }`} style={{
        color: todo.status === 'done' ? '#555' :
               todo.status === 'missed' ? '#666' :
               todo.status === 'carried' ? '#555' :
               '#d8d8d8',
      }}>
        {todo.status === 'missed' && <span className="mr-1" style={{ color: '#c0533f' }}>×</span>}
        {todo.status === 'carried' && <span className="mr-1" style={{ color: '#444' }}>↩</span>}
        {todo.text}
      </span>

      {!stamped && (
        <div
          {...handleEvents}
          onPointerDown={e => onHandleDown(e, 'right')}
          className={`absolute right-0 top-0 bottom-0 w-1.5 cursor-ew-resize z-10 transition-opacity rounded-r-md ${handleVis}`}
          style={{ background: hexToRgba(lane.color, 0.45) }}
        />
      )}
    </div>
  )
}
