import { useEffect, useRef, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db/db'
import { seedIfEmpty } from './db/seed'
import { minutesFrom6am } from './lib/time'
import type { Todo, TodoStatus } from './db/schema'
import Header from './components/Header'
import ParkingLot from './components/ParkingLot'
import Timeline from './components/Timeline'
import Footer from './components/Footer'
import DetailPanel from './components/DetailPanel'
import StampSheet from './components/StampSheet'
import Whiteboard from './components/Whiteboard'
import TodoGestureOverlay from './components/TodoGestureOverlay'

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

interface GestureUndoState {
  todoId: string
  previousStatus: TodoStatus
  previousPriority: number | null
}

export default function App() {
  const [currentDate,    setCurrentDate]    = useState(todayISO)
  const [activeDragId,   setActiveDragId]   = useState<string | null>(null)
  const [selectedTodoId, setSelectedTodoId] = useState<string | null>(null)
  const [showStampSheet, setShowStampSheet] = useState(false)
  const [stampTodos,     setStampTodos]     = useState<Todo[]>([])
  const [isShiftPressed, setShiftPressed]   = useState(false)
  const [gestureLatched, setGestureLatched] = useState(false)
  const [lastGestureUndo, setLastGestureUndo] = useState<GestureUndoState | null>(null)
  const todoContentRef = useRef<HTMLDivElement>(null)

  useEffect(() => { seedIfEmpty() }, [])
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Shift') setShiftPressed(true)
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') setShiftPressed(false)
    }
    const onBlur = () => setShiftPressed(false)

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
    }
  }, [])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } })
  )

  const lanes    = useLiveQuery(() => db.lanes.orderBy('order').toArray(), []) ?? []
  const day      = useLiveQuery(() => db.days.get(currentDate), [currentDate]) ?? null
  const laneById = Object.fromEntries(lanes.map(l => [l.id, l]))

  const activeTodo = useLiveQuery(
    () => activeDragId ? db.todos.get(activeDragId) : undefined,
    [activeDragId]
  )
  const activeLane = activeTodo ? laneById[activeTodo.lane_id] : undefined

  const stamped = day?.stamped ?? false
  const gestureArmed = !stamped && (isShiftPressed || gestureLatched)

  async function handleStamp() {
    if (!day || stamped) return
    const unresolved = await db.todos
      .filter(t =>
        (t.status === 'scheduled' || t.status === 'missed') &&
        (t.start_time?.startsWith(currentDate) ?? false)
      )
      .toArray()
    if (unresolved.length === 0) {
      await db.days.update(currentDate, { stamped: true })
    } else {
      setStampTodos(unresolved)
      setShowStampSheet(true)
    }
  }

  async function handleStamped() {
    await db.days.update(currentDate, { stamped: true })
    setShowStampSheet(false)
    setStampTodos([])
  }

  async function navigate(date: string) {
    const existing = await db.days.get(date)
    if (!existing) {
      await db.days.add({ date, mood: null, stamped: false, scratch_content: '' })
    }
    setCurrentDate(date)
  }

  function onDragStart({ active }: DragStartEvent) {
    setActiveDragId(String(active.id))
  }

  function onDragEnd({ active, over, delta, activatorEvent }: DragEndEvent) {
    setActiveDragId(null)
    if (!over || !activeTodo) return

    const overId = String(over.id)
    if (!overId.startsWith('track-')) return

    const laneId    = overId.slice(6)
    const startX    = (activatorEvent as PointerEvent).clientX
    const dropX     = startX + delta.x
    const relativeX = Math.max(0, dropX - over.rect.left)
    const snapped   = Math.round((relativeX / over.rect.width) * 1080 / 30) * 30
    const clampedMin = Math.max(0, Math.min(snapped, 1050))

    if (
      activeTodo.status === 'scheduled' &&
      activeTodo.lane_id === laneId &&
      activeTodo.start_time !== null &&
      minutesFrom6am(activeTodo.start_time) === clampedMin
    ) return

    const base = new Date(`${currentDate}T06:00:00`)
    base.setMinutes(base.getMinutes() + clampedMin)

    db.todos.update(String(active.id), {
      status:           'scheduled',
      start_time:       base.toISOString(),
      duration_minutes: activeTodo.status === 'parked' ? 60 : (activeTodo.duration_minutes ?? 60),
      lane_id:          laneId,
      updated_at:       new Date().toISOString(),
    })
  }

  function handleGestureFinish() {
    if (gestureLatched) setGestureLatched(false)
  }

  function handleGestureApplied(payload: GestureUndoState) {
    setLastGestureUndo(payload)
  }

  async function handleUndoGesture() {
    if (!lastGestureUndo) return

    await db.todos.update(lastGestureUndo.todoId, {
      status: lastGestureUndo.previousStatus,
      priority: lastGestureUndo.previousPriority,
      updated_at: new Date().toISOString(),
    })

    setLastGestureUndo(null)
  }

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <div className="h-screen flex flex-col overflow-hidden" style={{ background: '#121212' }}>

        {/* todo section */}
        <div className="flex flex-col shrink-0 relative">
          <div
            ref={todoContentRef}
            className="px-6 flex flex-col"
          >
            <Header currentDate={currentDate} day={day} onNavigate={navigate} />
            <div className="mt-2">
              <ParkingLot
                lanes={lanes}
                stamped={stamped}
                gestureArmed={gestureArmed}
                gestureLatched={gestureLatched}
                canUndoGesture={lastGestureUndo !== null}
                onUndoGesture={handleUndoGesture}
                onToggleGestureMode={() => setGestureLatched(value => !value)}
              />
            </div>
            <div className="mt-2">
              <Timeline
                lanes={lanes}
                currentDate={currentDate}
                onOpen={setSelectedTodoId}
                stamped={stamped}
                gestureArmed={gestureArmed}
              />
            </div>
            <Footer stamped={stamped} onStamp={handleStamp} />
          </div>
          {gestureArmed && (
            <TodoGestureOverlay
              onGestureFinish={handleGestureFinish}
              onGestureApplied={handleGestureApplied}
            />
          )}
        </div>

        {/* whiteboard */}
        <div className="flex-1 overflow-hidden">
          <Whiteboard lanes={lanes} currentDate={currentDate} />
        </div>

      </div>

      <DragOverlay dropAnimation={null}>
        {activeTodo && activeLane ? (
          <div
            className="flex items-center pl-2.5 pr-4 py-1 rounded text-[11px] leading-snug border-l-[3px] select-none cursor-grabbing"
            style={{
              borderLeftColor: activeLane.color,
              background: activeTodo.status === 'parked' ? '#2a2a2a' : '#1e1e1e',
              color: '#e3e3e3',
            }}
          >
            {activeTodo.text}
          </div>
        ) : null}
      </DragOverlay>

      {selectedTodoId && (
        <DetailPanel
          todoId={selectedTodoId}
          currentDate={currentDate}
          onClose={() => setSelectedTodoId(null)}
        />
      )}

      {showStampSheet && (
        <StampSheet
          todos={stampTodos}
          lanes={lanes}
          currentDate={currentDate}
          onStamped={handleStamped}
          onCancel={() => { setShowStampSheet(false); setStampTodos([]) }}
        />
      )}
    </DndContext>
  )
}
