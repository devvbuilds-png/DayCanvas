import { Fragment, useEffect, useRef, useState } from 'react'
import { db } from '../db/db'
import type { Lane } from '../db/schema'
import { applyReorder } from '../lib/lanes'
import TimelineLane from './TimelineLane'

interface TimelineProps {
  lanes: Lane[]
  currentDate: string
  onOpen: (id: string) => void
  stamped: boolean
  gestureArmed: boolean
}

// 6a to 12a (midnight) = 19 markers
const HOURS = Array.from({ length: 19 }, (_, i) => {
  const h = i + 6
  if (h === 12) return '12p'
  if (h === 24) return '12a'
  return h < 12 ? `${h}a` : `${h - 12}p`
})

interface NowState {
  pct: number
  label: string
}

function getNowState(): NowState | null {
  const now = new Date()
  const mins = (now.getHours() - 6) * 60 + now.getMinutes()
  if (mins < 0 || mins >= 1080) return null
  const h = now.getHours()
  const m = now.getMinutes()
  const h12 = h % 12 || 12
  const label = `${h12}:${String(m).padStart(2, '0')}${h >= 12 ? 'p' : 'a'}`
  return { pct: (mins / 1080) * 100, label }
}

export default function Timeline({ lanes, currentDate, onOpen, stamped, gestureArmed }: TimelineProps) {
  const [now, setNow] = useState<NowState | null>(getNowState)

  useEffect(() => {
    const id = setInterval(() => setNow(getNowState()), 60_000)
    return () => clearInterval(id)
  }, [])

  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [overIdx,    setOverIdx]    = useState<number | null>(null)
  const listRef  = useRef<HTMLDivElement>(null)
  const lanesRef = useRef<Lane[]>(lanes)
  const dragState = useRef<{ id: string | null; over: number | null }>({ id: null, over: null })

  useEffect(() => { lanesRef.current = lanes }, [lanes])

  function startLaneDrag(e: React.PointerEvent, laneId: string) {
    e.preventDefault()
    const startX = e.clientX
    const startY = e.clientY
    let dragging = false

    function onMove(ev: PointerEvent) {
      if (!dragging) {
        const dx = ev.clientX - startX
        const dy = ev.clientY - startY
        if (dx * dx + dy * dy < 16) return
        dragging = true
        const fromIdx = lanesRef.current.findIndex(l => l.id === laneId)
        dragState.current = { id: laneId, over: fromIdx }
        setDraggingId(laneId)
        setOverIdx(fromIdx)
      }
      if (!listRef.current) return
      const rows = listRef.current.querySelectorAll('[data-lane-row]')
      let insertBefore = 0
      rows.forEach((row, i) => {
        const rect = row.getBoundingClientRect()
        if (ev.clientY > rect.top + rect.height / 2) insertBefore = i + 1
      })
      dragState.current.over = insertBefore
      setOverIdx(insertBefore)
    }

    async function onUp() {
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup',   onUp)

      const { id: dId, over: finalOver } = dragState.current
      setDraggingId(null)
      setOverIdx(null)
      dragState.current = { id: null, over: null }

      if (!dragging || !dId || finalOver === null) return
      const currentFromIdx = lanesRef.current.findIndex(l => l.id === dId)
      if (currentFromIdx === finalOver || currentFromIdx + 1 === finalOver) return

      const reordered = applyReorder(lanesRef.current, dId, finalOver)
      await Promise.all(reordered.map((lane, i) => db.lanes.update(lane.id, { order: i })))
    }

    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup',   onUp)
  }

  return (
    <div className="rounded-md overflow-hidden" style={{ border: '1px solid #1e1e1e', background: '#161616' }}>
      {/* hour ruler */}
      <div className="flex items-stretch px-3 pt-2" style={{ borderBottom: '1px solid #1e1e1e' }}>
        <div className="w-20 shrink-0" />
        <div className="flex-1 flex justify-between items-end pb-0">
          {HOURS.map((h, i) => (
            <div key={h} className="flex flex-col items-center">
              <span
                className="text-[9px] leading-none mb-1 tnum"
                style={{
                  color: h === '12p' ? '#484848' : '#2e2e2e',
                  fontWeight: h === '12p' ? '500' : '400',
                }}
              >
                {h}
              </span>
              <div
                style={{
                  width: '1px',
                  height: (i === 0 || h === '12p' || h === '12a') ? '6px' : '3px',
                  background: '#252525',
                }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* lane rows */}
      <div ref={listRef} className="flex flex-col gap-1.5 px-3 py-2.5 relative">

        {/* now-line */}
        {now && (
          <div className="absolute inset-0 px-3 flex pointer-events-none">
            <div className="w-20 shrink-0" />
            <div className="flex-1 relative">
              <div
                className="absolute top-0 bottom-0"
                style={{
                  left: `${now.pct}%`,
                  width: '1px',
                  background: '#E24B4A',
                  boxShadow: '0 0 5px rgba(226,75,74,0.3)',
                }}
              >
                <span
                  className="absolute top-2 left-1.5 text-[9px] whitespace-nowrap leading-none select-none tnum"
                  style={{ color: '#c94040' }}
                >
                  {now.label}
                </span>
              </div>
            </div>
          </div>
        )}

        {lanes.map((lane, idx) => (
          <Fragment key={lane.id}>
            {draggingId !== null && overIdx === idx && (
              <div className="h-0.5 rounded bg-[#534AB7]" />
            )}
            <TimelineLane
              lane={lane}
              currentDate={currentDate}
              onOpen={onOpen}
              stamped={stamped}
              gestureArmed={gestureArmed}
              isDragging={draggingId === lane.id}
              onLabelPointerDown={e => startLaneDrag(e, lane.id)}
            />
          </Fragment>
        ))}

        {/* drop line at bottom of list */}
        {draggingId !== null && overIdx === lanes.length && (
          <div className="h-0.5 rounded bg-[#534AB7]" />
        )}
      </div>
    </div>
  )
}
