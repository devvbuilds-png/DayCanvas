import { useEffect, useState } from 'react'
import type { Lane } from '../db/schema'
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
      <div className="flex flex-col gap-1.5 px-3 py-2.5 relative">

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

        {lanes.map(lane => (
          <TimelineLane
            key={lane.id}
            lane={lane}
            currentDate={currentDate}
            onOpen={onOpen}
            stamped={stamped}
            gestureArmed={gestureArmed}
          />
        ))}
      </div>
    </div>
  )
}
