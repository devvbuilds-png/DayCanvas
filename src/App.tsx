import { useEffect, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
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
  const [currentDate, setCurrentDate] = useState(todayISO)
  const [activeDragId, setActiveDragId] = useState<string | null>(null)
  const [selectedTodoId, setSelectedTodoId] = useState<string | null>(null)
  const [showStampSheet, setShowStampSheet] = useState(false)
  const [stampTodos, setStampTodos] = useState<Todo[]>([])
  const [isShiftPressed, setShiftPressed] = useState(false)
  const [gestureLatched, setGestureLatched] = useState(false)
  const [lastGestureUndo, setLastGestureUndo] = useState<GestureUndoState | null>(null)
  const [nowTick, setNowTick] = useState(() => Date.now())

  useEffect(() => {
    seedIfEmpty()
  }, [])

  useEffect(() => {
    const id = window.setInterval(() => setNowTick(Date.now()), 60_000)
    return () => window.clearInterval(id)
  }, [])

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
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  )

  const lanes = useLiveQuery(() => db.lanes.orderBy('order').toArray(), []) ?? []
  const day = useLiveQuery(() => db.days.get(currentDate), [currentDate]) ?? null
  const laneById = Object.fromEntries(lanes.map(lane => [lane.id, lane]))

  const activeTodo = useLiveQuery(
    () => activeDragId ? db.todos.get(activeDragId) : undefined,
    [activeDragId],
  )
  const activeLane = activeTodo ? laneById[activeTodo.lane_id] : undefined

  const currentTask = useLiveQuery(async () => {
    const now = new Date(nowTick)
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    if (currentDate !== today) return null

    const currentMinutes = (now.getHours() - 6) * 60 + now.getMinutes()
    if (currentMinutes < 0 || currentMinutes >= 1080) return null

    const scheduled = await db.todos
      .where('status')
      .equals('scheduled')
      .filter(todo => todo.start_time?.startsWith(currentDate) ?? false)
      .toArray()

    return scheduled.find(todo => {
      const start = minutesFrom6am(todo.start_time!)
      const duration = todo.duration_minutes ?? 60
      return currentMinutes >= start && currentMinutes < start + duration
    }) ?? null
  }, [currentDate, nowTick]) ?? null

  const stamped = day?.stamped ?? false
  const gestureArmed = !stamped && (isShiftPressed || gestureLatched)
  const currentTaskText = currentTask?.text ?? null

  async function handleStamp() {
    if (!day || stamped) return

    const unresolved = await db.todos
      .filter(todo =>
        (todo.status === 'scheduled' || todo.status === 'missed') &&
        (todo.start_time?.startsWith(currentDate) ?? false),
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

    if (overId === 'parking-lot') {
      if (activeTodo.status !== 'scheduled') return
      db.todos.update(String(active.id), {
        status: 'parked',
        start_time: null,
        duration_minutes: null,
        updated_at: new Date().toISOString(),
      })
      return
    }

    if (!overId.startsWith('track-')) return

    const laneId = overId.slice(6)
    const startX = (activatorEvent as PointerEvent).clientX
    const dropX = startX + delta.x
    const relativeX = Math.max(0, dropX - over.rect.left)
    const snapped = Math.round((relativeX / over.rect.width) * 1080 / 30) * 30
    const clampedMin = Math.max(0, Math.min(snapped, 1050))

    if (
      activeTodo.status === 'scheduled' &&
      activeTodo.lane_id === laneId &&
      activeTodo.start_time !== null &&
      minutesFrom6am(activeTodo.start_time) === clampedMin
    ) {
      return
    }

    const base = new Date(`${currentDate}T06:00:00`)
    base.setMinutes(base.getMinutes() + clampedMin)

    db.todos.update(String(active.id), {
      status: 'scheduled',
      start_time: base.toISOString(),
      duration_minutes: activeTodo.status === 'parked' ? 60 : (activeTodo.duration_minutes ?? 60),
      lane_id: laneId,
      updated_at: new Date().toISOString(),
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

  function jumpToWhiteboard() {
    document.getElementById('whiteboard-start')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <div className="min-h-screen flex flex-col" style={{ background: '#121212' }}>
        <div className="flex flex-col shrink-0 relative">
          <div className="px-6 flex flex-col">
            <Header
              currentDate={currentDate}
              day={day}
              onNavigate={navigate}
              currentTaskText={currentTaskText}
            />
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
            <Footer
              stamped={stamped}
              onStamp={handleStamp}
              onJumpToWhiteboard={jumpToWhiteboard}
            />
          </div>
          {gestureArmed && (
            <TodoGestureOverlay
              onGestureFinish={handleGestureFinish}
              onGestureApplied={handleGestureApplied}
            />
          )}
        </div>

        <div id="whiteboard-start" className="h-screen shrink-0 overflow-hidden">
          <Whiteboard lanes={lanes} currentDate={currentDate} />
        </div>
      </div>

      <DragOverlay dropAnimation={null}>
        {activeTodo && activeLane ? (
          <div
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] leading-snug select-none cursor-grabbing"
            style={{
              background: `rgba(${parseInt(activeLane.color.slice(1,3),16)},${parseInt(activeLane.color.slice(3,5),16)},${parseInt(activeLane.color.slice(5,7),16)},${activeTodo.status === 'parked' ? 0.1 : 0.18})`,
              border: `1px solid rgba(${parseInt(activeLane.color.slice(1,3),16)},${parseInt(activeLane.color.slice(3,5),16)},${parseInt(activeLane.color.slice(5,7),16)},0.3)`,
              color: '#d8d8d8',
            }}
          >
            <span
              className="w-[5px] h-[5px] rounded-sm shrink-0"
              style={{ backgroundColor: activeLane.color, opacity: 0.85 }}
            />
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
          onCancel={() => {
            setShowStampSheet(false)
            setStampTodos([])
          }}
        />
      )}
    </DndContext>
  )
}
