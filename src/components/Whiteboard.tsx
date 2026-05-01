import { useEffect, useRef, useState } from 'react'
import { Tldraw, type Editor, type TLShapeId } from 'tldraw'
import 'tldraw/tldraw.css'
import { db } from '../db/db'
import type { Lane } from '../db/schema'

interface Props {
  lanes: Lane[]
  currentDate: string
}

interface PendingDrop {
  x: number
  y: number
  text: string
  shapeId: TLShapeId
  editor: Editor
}

function LanePicker({ lanes, x, y, onPick, onCancel }: {
  lanes: Lane[]
  x: number
  y: number
  onPick: (laneId: string) => void
  onCancel: () => void
}) {
  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel() }
    document.addEventListener('keydown', fn)
    return () => document.removeEventListener('keydown', fn)
  }, [onCancel])

  const showAbove = y > 220

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onClick={onCancel} />
      <div
        style={{
          position: 'fixed',
          left: x,
          top: showAbove ? y - 8 : y + 8,
          transform: showAbove ? 'translate(-50%, -100%)' : 'translate(-50%, 0)',
          zIndex: 9999,
          background: '#1e1e1e',
          border: '1px solid #2a2a2a',
          borderRadius: 8,
          padding: 8,
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          minWidth: 140,
        }}
      >
        <div style={{ fontSize: 10, color: '#555', marginBottom: 4, padding: '0 4px' }}>
          add to lane
        </div>
        {lanes.map(lane => (
          <button
            key={lane.id}
            onClick={(e) => { e.stopPropagation(); onPick(lane.id) }}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '5px 8px', borderRadius: 5, border: 'none',
              background: 'transparent', color: '#e3e3e3',
              fontSize: 12, cursor: 'pointer', textAlign: 'left', width: '100%',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#2a2a2a' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
          >
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: lane.color, flexShrink: 0 }} />
            {lane.name.toLowerCase()}
          </button>
        ))}
      </div>
    </>
  )
}

export default function Whiteboard({ lanes, currentDate }: Props) {
  const [pendingDrop, setPendingDrop] = useState<PendingDrop | null>(null)
  const currentDateRef = useRef(currentDate)
  const cleanupRef = useRef<() => void>()

  useEffect(() => { currentDateRef.current = currentDate }, [currentDate])
  useEffect(() => () => { cleanupRef.current?.() }, [])

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <Tldraw
        persistenceKey="day-canvas-whiteboard"
        onMount={(editor: Editor) => {
          editor.user.updateUserPreferences({ colorScheme: 'dark' })

          let draggingShapeId: TLShapeId | null = null

          // Track which text shape is being translated via store mutations during drag
          editor.store.listen(() => {
            if (!editor.isIn('select.translating')) return
            if (draggingShapeId) return
            const selected = editor.getSelectedShapes().filter(s => s.type === 'text')
            if (selected.length === 1) draggingShapeId = selected[0].id
          })

          // window + capture:true fires before tldraw's bubble-phase handlers,
          // even if tldraw calls stopPropagation inside its container listener.
          const onPointerUp = (e: PointerEvent) => {
            // At capture time tldraw hasn't processed this event yet,
            // so fall back to reading editor state directly if store.listen
            // hasn't had a chance to fire yet.
            let shapeId = draggingShapeId
            if (!shapeId && editor.isIn('select.translating')) {
              const textShapes = editor.getSelectedShapes().filter(s => s.type === 'text')
              if (textShapes.length === 1) shapeId = textShapes[0].id
            }

            draggingShapeId = null
            if (!shapeId) return

            // Capture coordinates now — they're correct at this moment.
            const capturedX = e.clientX
            const capturedY = e.clientY

            // Defer processing so tldraw can finish its own pointer-up handling
            // before we touch the shape (delete it).
            setTimeout(() => {
              const shape = editor.getShape(shapeId)
              if (!shape || shape.type !== 'text') return
              const text = (shape.props as { text: string }).text?.trim()
              if (!text) return

              const zones = document.querySelectorAll<HTMLElement>('[data-dropzone]')
              for (const zone of zones) {
                const r = zone.getBoundingClientRect()
                if (capturedX < r.left || capturedX > r.right || capturedY < r.top || capturedY > r.bottom) continue

                const zoneId = zone.dataset.dropzone!
                if (zoneId === 'parking-lot') {
                  setPendingDrop({ x: capturedX, y: capturedY, text, shapeId, editor })
                } else if (zoneId.startsWith('lane-')) {
                  const laneId = zoneId.slice(5)
                  const relX = Math.max(0, capturedX - r.left)
                  const snapped = Math.round((relX / r.width) * 1080 / 30) * 30
                  const mins = Math.max(0, Math.min(snapped, 1050))
                  const base = new Date(`${currentDateRef.current}T06:00:00`)
                  base.setMinutes(base.getMinutes() + mins)
                  const now = new Date().toISOString()
                  db.todos.add({
                    id: crypto.randomUUID(),
                    text,
                    lane_id: laneId,
                    status: 'scheduled',
                    priority: null,
                    start_time: base.toISOString(),
                    duration_minutes: 60,
                    stickers: [],
                    description: '',
                    created_at: now,
                    updated_at: now,
                  })
                  editor.deleteShapes([shapeId])
                }
                break
              }
            }, 0)
          }

          window.addEventListener('pointerup', onPointerUp, { capture: true })
          cleanupRef.current = () => window.removeEventListener('pointerup', onPointerUp, { capture: true })
        }}
      />

      {pendingDrop && (
        <LanePicker
          lanes={lanes}
          x={pendingDrop.x}
          y={pendingDrop.y}
          onPick={(laneId) => {
            const now = new Date().toISOString()
            db.todos.add({
              id: crypto.randomUUID(),
              text: pendingDrop.text,
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
            pendingDrop.editor.deleteShapes([pendingDrop.shapeId])
            setPendingDrop(null)
          }}
          onCancel={() => setPendingDrop(null)}
        />
      )}
    </div>
  )
}
