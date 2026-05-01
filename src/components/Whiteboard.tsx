import { useEffect, useMemo, useRef, useState } from 'react'
import { Tldraw, type Editor, type TLComponents, type TLShape, type TLShapeId } from 'tldraw'
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

interface BridgeDrag {
  x: number
  y: number
  text: string
}

interface DragCandidate {
  shapeId: TLShapeId
  text: string
  originalShape: TLShape
  editor: Editor
}

function getPlainText(editor: Editor, shape: TLShape): string {
  if (shape.type !== 'text') return ''
  const util = editor.getShapeUtil(shape) as { getText?: (shape: TLShape) => string }
  return util.getText?.(shape).trim() ?? ''
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
  const [bridgeDrag, setBridgeDrag] = useState<BridgeDrag | null>(null)
  const currentDateRef = useRef(currentDate)
  const bridgeDragRef = useRef<DragCandidate | null>(null)
  const cleanupRef = useRef<(() => void) | null>(null)
  const components = useMemo<TLComponents>(() => ({
    PageMenu: null,
    NavigationPanel: null,
    ZoomMenu: null,
    MainMenu: null,
    HelpMenu: null,
    QuickActions: null,
    HelperButtons: null,
    DebugMenu: null,
    DebugPanel: null,
    MenuPanel: null,
    TopPanel: null,
    SharePanel: null,
  }), [])

  useEffect(() => { currentDateRef.current = currentDate }, [currentDate])
  useEffect(() => () => { cleanupRef.current?.() }, [])

  function getDropTarget(screenX: number, screenY: number) {
    const zones = document.querySelectorAll<HTMLElement>('[data-dropzone]')
    for (const zone of zones) {
      const rect = zone.getBoundingClientRect()
      if (screenX < rect.left || screenX > rect.right || screenY < rect.top || screenY > rect.bottom) continue
      return { rect, zoneId: zone.dataset.dropzone! }
    }
    return null
  }

  async function createScheduledTodo(text: string, laneId: string, rect: DOMRect, screenX: number) {
    const relX = Math.max(0, screenX - rect.left)
    const snapped = Math.round((relX / rect.width) * 1080 / 30) * 30
    const mins = Math.max(0, Math.min(snapped, 1050))
    const base = new Date(`${currentDateRef.current}T06:00:00`)
    base.setMinutes(base.getMinutes() + mins)
    const now = new Date().toISOString()

    await db.todos.add({
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
  }

  function restoreOriginalShape(candidate: DragCandidate) {
    const current = candidate.editor.getShape(candidate.shapeId)
    if (!current) return
    candidate.editor.updateShapes([candidate.originalShape])
    candidate.editor.setSelectedShapes([candidate.shapeId])
  }

  return (
    <div className="whiteboard-surface" style={{ width: '100%', height: '100%', position: 'relative' }}>
      <Tldraw
        components={components}
        persistenceKey="day-canvas-whiteboard"
        onMount={(editor: Editor) => {
          editor.user.updateUserPreferences({ colorScheme: 'dark' })

          let candidate: DragCandidate | null = null
          let isBridgeActive = false

          const readCandidateFromSelection = (): DragCandidate | null => {
            if (candidate) return candidate
            if (!editor.isIn('select.translating')) return null

            const selected = editor.getSelectedShapes()
            if (selected.length !== 1) return null

            const shape = selected[0]
            if (shape.type !== 'text') return null

            const text = getPlainText(editor, shape)
            if (!text) return null

            candidate = { shapeId: shape.id, text, originalShape: shape, editor }
            return candidate
          }

          const cleanupStoreListener = editor.store.listen(() => {
            if (isBridgeActive || candidate || !editor.isIn('select.translating')) return
            readCandidateFromSelection()
          })

          const beginBridgeDrag = (drag: DragCandidate, x: number, y: number) => {
            isBridgeActive = true
            bridgeDragRef.current = drag
            setBridgeDrag({ text: drag.text, x, y })

            editor.interrupt()
            restoreOriginalShape(drag)
          }

          const onPointerMove = (e: PointerEvent) => {
            if (bridgeDragRef.current) {
              setBridgeDrag(prev => prev ? { ...prev, x: e.clientX, y: e.clientY } : prev)
              return
            }

            const drag = readCandidateFromSelection()
            if (!drag) return

            const viewport = editor.getViewportScreenBounds()
            if (e.clientY >= viewport.y) return

            beginBridgeDrag(drag, e.clientX, e.clientY)
          }

          const onPointerUp = (e: PointerEvent) => {
            const bridged = bridgeDragRef.current
            if (bridged) {
              const target = getDropTarget(e.clientX, e.clientY)
              setBridgeDrag(null)
              bridgeDragRef.current = null
              isBridgeActive = false
              candidate = null

              if (!target) {
                restoreOriginalShape(bridged)
                return
              }

              if (target.zoneId === 'parking-lot') {
                setPendingDrop({
                  x: e.clientX,
                  y: e.clientY,
                  text: bridged.text,
                  shapeId: bridged.shapeId,
                  editor: bridged.editor,
                })
                return
              }

              if (target.zoneId.startsWith('lane-')) {
                const laneId = target.zoneId.slice(5)
                createScheduledTodo(bridged.text, laneId, target.rect, e.clientX)
                bridged.editor.deleteShapes([bridged.shapeId])
                return
              }

              restoreOriginalShape(bridged)
              return
            }

            candidate = null
          }

          const onPointerCancel = () => {
            const bridged = bridgeDragRef.current
            setBridgeDrag(null)
            bridgeDragRef.current = null
            isBridgeActive = false
            candidate = null
            if (bridged) restoreOriginalShape(bridged)
          }

          window.addEventListener('pointermove', onPointerMove, { capture: true })
          window.addEventListener('pointerup', onPointerUp, { capture: true })
          window.addEventListener('pointercancel', onPointerCancel, { capture: true })
          cleanupRef.current = () => {
            cleanupStoreListener()
            window.removeEventListener('pointermove', onPointerMove, { capture: true })
            window.removeEventListener('pointerup', onPointerUp, { capture: true })
            window.removeEventListener('pointercancel', onPointerCancel, { capture: true })
          }
        }}
      />

      {bridgeDrag && (
        <div
          style={{
            position: 'fixed',
            left: bridgeDrag.x,
            top: bridgeDrag.y,
            transform: 'translate(-50%, -50%)',
            zIndex: 9997,
            pointerEvents: 'none',
            maxWidth: 260,
            padding: '5px 10px',
            borderRadius: 6,
            border: '1px solid #6965db',
            background: '#2a2a2a',
            color: '#e3e3e3',
            fontSize: 12,
            lineHeight: 1.25,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {bridgeDrag.text}
        </div>
      )}

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
          onCancel={() => {
            const shape = pendingDrop.editor.getShape(pendingDrop.shapeId)
            if (shape) pendingDrop.editor.setSelectedShapes([pendingDrop.shapeId])
            setPendingDrop(null)
          }}
        />
      )}
    </div>
  )
}
