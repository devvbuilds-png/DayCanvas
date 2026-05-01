import { useEffect, useRef, useState } from 'react'
import { db } from '../db/db'
import {
  recognizeTodoGesture,
  type GestureMatch,
  type GesturePoint,
  type GestureStroke,
} from '../lib/todoGestures'

interface TodoGestureOverlayProps {
  onGestureFinish: () => void
  onGestureApplied: (payload: {
    todoId: string
    previousStatus: 'parked' | 'scheduled' | 'done' | 'missed' | 'carried'
    previousPriority: number | null
  }) => void
}

interface FeedbackState {
  color: string
  text: string
  x: number
  y: number
}

interface GestureTarget {
  todoId: string
  kind: 'parked' | 'timeline'
}

const IDLE_MS = 520

function getTargetAtPoint(clientX: number, clientY: number): GestureTarget | null {
  const hit = document
    .elementsFromPoint(clientX, clientY)
    .find((node): node is HTMLElement => node instanceof HTMLElement && node.dataset.gestureTarget === 'todo')

  if (!hit?.dataset.todoId || !hit.dataset.todoKind) return null
  if (hit.dataset.todoKind !== 'parked' && hit.dataset.todoKind !== 'timeline') return null

  return {
    todoId: hit.dataset.todoId,
    kind: hit.dataset.todoKind,
  }
}

function mergeStrokes(strokes: GestureStroke[]): GesturePoint[] {
  const merged: GesturePoint[] = []
  for (const stroke of strokes) {
    if (stroke.points.length === 0) continue
    if (merged.length > 0 && stroke.points.length > 1) merged.push(stroke.points[0])
    merged.push(...stroke.points)
  }
  return merged
}

export default function TodoGestureOverlay({
  onGestureFinish,
  onGestureApplied,
}: TodoGestureOverlayProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const pointerIdRef = useRef<number | null>(null)
  const currentStrokeRef = useRef<GesturePoint[]>([])
  const strokesRef = useRef<GestureStroke[]>([])
  const targetRef = useRef<GestureTarget | null>(null)
  const targetHitsRef = useRef<Map<string, { target: GestureTarget; hits: number }>>(new Map())
  const feedbackTimerRef = useRef<number | null>(null)
  const idleTimerRef = useRef<number | null>(null)

  const [strokes, setStrokes] = useState<GestureStroke[]>([])
  const [feedback, setFeedback] = useState<FeedbackState | null>(null)

  useEffect(() => {
    return () => {
      clearIdleTimer()
      pointerIdRef.current = null
      currentStrokeRef.current = []
      strokesRef.current = []
      targetRef.current = null
      targetHitsRef.current = new Map()
      if (feedbackTimerRef.current !== null) window.clearTimeout(feedbackTimerRef.current)
    }
  }, [])

  function clearFeedbackLater() {
    if (feedbackTimerRef.current !== null) window.clearTimeout(feedbackTimerRef.current)
    feedbackTimerRef.current = window.setTimeout(() => {
      setFeedback(null)
      feedbackTimerRef.current = null
    }, 900)
  }

  function clearIdleTimer() {
    if (idleTimerRef.current !== null) {
      window.clearTimeout(idleTimerRef.current)
      idleTimerRef.current = null
    }
  }

  function resetSession(shouldNotify: boolean) {
    clearIdleTimer()
    pointerIdRef.current = null
    currentStrokeRef.current = []
    strokesRef.current = []
    targetRef.current = null
    targetHitsRef.current.clear()
    setStrokes([])
    if (shouldNotify) onGestureFinish()
  }

  function getLocalPoint(e: React.PointerEvent<HTMLDivElement>): GesturePoint | null {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return null
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  function trackTarget(clientX: number, clientY: number) {
    const target = getTargetAtPoint(clientX, clientY)
    if (!target) return

    const key = `${target.kind}:${target.todoId}`
    const current = targetHitsRef.current.get(key)
    targetHitsRef.current.set(key, {
      target,
      hits: (current?.hits ?? 0) + 1,
    })

    let best: { target: GestureTarget; hits: number } | null = null
    for (const entry of targetHitsRef.current.values()) {
      if (!best || entry.hits > best.hits) best = entry
    }
    targetRef.current = best?.target ?? null
  }

  async function applyGesture(match: GestureMatch, target: GestureTarget) {
    const todo = await db.todos.get(target.todoId)
    if (!todo) return false

    const updated_at = new Date().toISOString()

    if (match.kind === 'tick' || match.kind === 'strike') {
      await db.todos.update(target.todoId, { status: 'done', updated_at })
      onGestureApplied({
        todoId: target.todoId,
        previousStatus: todo.status,
        previousPriority: todo.priority,
      })
      return true
    }

    if (match.kind === 'cross') {
      await db.todos.update(target.todoId, { status: 'missed', updated_at })
      onGestureApplied({
        todoId: target.todoId,
        previousStatus: todo.status,
        previousPriority: todo.priority,
      })
      return true
    }

    if (match.kind === 'priority' && match.priority && target.kind === 'parked') {
      await db.todos.update(target.todoId, { priority: match.priority, updated_at })
      onGestureApplied({
        todoId: target.todoId,
        previousStatus: todo.status,
        previousPriority: todo.priority,
      })
      return true
    }

    return false
  }

  async function finalizeSession() {
    clearIdleTimer()

    const target = targetRef.current
    const merged = mergeStrokes(strokesRef.current)
    const lastPoint = merged[merged.length - 1]
    const match = target ? recognizeTodoGesture(strokesRef.current, target.kind) : null

    if (match && target && (match.kind !== 'priority' || target.kind === 'parked')) {
      const color = match.kind === 'cross' ? '#D85A30' : '#6965db'
      setFeedback({
        color,
        text: match.kind === 'priority' ? `priority ${match.priority}` : match.label,
        x: lastPoint?.x ?? 0,
        y: lastPoint?.y ?? 0,
      })
      await applyGesture(match, target)
    } else {
      setFeedback({
        color: '#888',
        text: target ? 'no match' : 'no target',
        x: lastPoint?.x ?? 0,
        y: lastPoint?.y ?? 0,
      })
    }

    clearFeedbackLater()
    resetSession(true)
  }

  function scheduleFinalize() {
    clearIdleTimer()
    idleTimerRef.current = window.setTimeout(() => {
      void finalizeSession()
    }, IDLE_MS)
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (pointerIdRef.current !== null) return
    e.preventDefault()
    e.stopPropagation()
    clearIdleTimer()
    setFeedback(null)

    const point = getLocalPoint(e)
    if (!point) return

    pointerIdRef.current = e.pointerId
    currentStrokeRef.current = [point]
    strokesRef.current = [...strokesRef.current, { points: [point] }]
    setStrokes([...strokesRef.current])
    trackTarget(e.clientX, e.clientY)
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (pointerIdRef.current !== e.pointerId) return
    e.preventDefault()
    e.stopPropagation()

    const point = getLocalPoint(e)
    if (!point) return

    currentStrokeRef.current = [...currentStrokeRef.current, point]
    strokesRef.current = [
      ...strokesRef.current.slice(0, -1),
      { points: currentStrokeRef.current },
    ]
    setStrokes([...strokesRef.current])
    trackTarget(e.clientX, e.clientY)
  }

  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (pointerIdRef.current !== e.pointerId) return
    e.preventDefault()
    e.stopPropagation()
    e.currentTarget.releasePointerCapture(e.pointerId)
    pointerIdRef.current = null
    currentStrokeRef.current = []
    scheduleFinalize()
  }

  function onPointerCancel(e: React.PointerEvent<HTMLDivElement>) {
    if (pointerIdRef.current !== e.pointerId) return
    e.preventDefault()
    e.stopPropagation()
    pointerIdRef.current = null
    currentStrokeRef.current = []
    scheduleFinalize()
  }

  return (
    <div
      ref={containerRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      className="absolute inset-0 pointer-events-auto cursor-crosshair"
      style={{ background: 'rgba(105, 101, 219, 0.04)' }}
    >
      {(feedback || strokes.length > 0) && (
        <svg className="absolute inset-0 w-full h-full overflow-visible pointer-events-none">
          {strokes.map((stroke, index) => (
            stroke.points.length > 1 ? (
              <polyline
                key={index}
                points={stroke.points.map(point => `${point.x},${point.y}`).join(' ')}
                fill="none"
                stroke="#6965db"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ) : null
          ))}
        </svg>
      )}

      {feedback && (
        <div
          className="absolute px-1.5 py-0.5 rounded text-[10px] whitespace-nowrap pointer-events-none"
          style={{
            left: feedback.x,
            top: feedback.y - 20,
            transform: 'translate(-50%, -100%)',
            background: '#1e1e1e',
            border: `1px solid ${feedback.color}55`,
            color: feedback.color,
          }}
        >
          {feedback.text}
        </div>
      )}
    </div>
  )
}
