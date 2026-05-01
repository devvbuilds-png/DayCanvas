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
  pct: number    // 0–100 within 6a–12a window
  label: string  // "now · 10:42a"
}

function getNowState(): NowState | null {
  const now  = new Date()
  const mins = (now.getHours() - 6) * 60 + now.getMinutes()
  if (mins < 0 || mins >= 1080) return null
  const h    = now.getHours()
  const m    = now.getMinutes()
  const h12  = h % 12 || 12
  const label = `now · ${h12}:${String(m).padStart(2, '0')}${h >= 12 ? 'p' : 'a'}`
  return { pct: (mins / 1080) * 100, label }
}

export default function Timeline({ lanes, currentDate, onOpen, stamped, gestureArmed }: TimelineProps) {
  const [now, setNow] = useState<NowState | null>(getNowState)

  useEffect(() => {
    const id = setInterval(() => setNow(getNowState()), 60_000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="border border-[#2a2a2a] rounded-md" style={{ background: '#1e1e1e' }}>
      {/* hour markers */}
      <div className="flex items-end px-3 pt-2 pb-1 border-b border-[#2a2a2a]">
        <div className="w-20 shrink-0" />
        <div className="flex-1 flex justify-between">
          {HOURS.map(h => (
            <span key={h} className="text-[10px] leading-none" style={{ color: '#444' }}>{h}</span>
          ))}
        </div>
      </div>

      {/* lane rows — relative so now-line overlay can use absolute inset */}
      <div className="flex flex-col gap-1.5 px-3 py-2 relative">

        {/* now-line: spans full height of lanes, aligned with track area */}
        {now && (
          <div className="absolute inset-0 px-3 flex pointer-events-none">
            <div className="w-20 shrink-0" />
            <div className="flex-1 relative">
              <div
                className="absolute top-0 bottom-0 w-px"
                style={{ left: `${now.pct}%`, background: '#E24B4A' }}
              >
                <span
                  className="absolute top-1 left-1.5 text-[9px] whitespace-nowrap leading-none select-none"
                  style={{ color: '#E24B4A' }}
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
