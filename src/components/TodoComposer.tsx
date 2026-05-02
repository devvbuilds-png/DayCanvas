import { useState, useEffect, useRef } from 'react'
import type { Lane } from '../db/schema'

interface TodoComposerProps {
  lanes: Lane[]
  onSave: (text: string, laneId: string) => void
  onCancel: () => void
}

export default function TodoComposer({ lanes, onSave, onCancel }: TodoComposerProps) {
  const [text, setText] = useState('')
  const [selectedLaneId, setSelectedLaneId] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  function handleSave() {
    const trimmed = text.trim()
    if (!trimmed || !selectedLaneId) return
    onSave(trimmed, selectedLaneId)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') handleSave()
    if (e.key === 'Escape') onCancel()
  }

  const canSave = text.trim().length > 0 && selectedLaneId !== null

  return (
    <div
      className="flex flex-col gap-2 p-2 rounded"
      style={{ border: '1px solid #2a2a2a', background: '#252525' }}
    >
      {/* text input */}
      <input
        ref={inputRef}
        type="text"
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="what needs doing?"
        className="w-full text-xs text-[#e3e3e3] placeholder:text-[#444] bg-transparent outline-none"
      />

      {/* lane selector + actions row */}
      <div className="flex items-center justify-between gap-2">
        {/* lane selector */}
        <div className="flex items-center gap-1 flex-wrap">
          {lanes.map(lane => {
            const selected = selectedLaneId === lane.id
            return (
              <button
                key={lane.id}
                type="button"
                onClick={() => setSelectedLaneId(lane.id)}
                className="flex items-center gap-1 px-2 py-0.5 rounded text-xs transition-colors"
                style={
                  selected
                    ? {
                        border: `1.5px solid ${lane.color}`,
                        background: `${lane.color}22`,
                        color: lane.color,
                      }
                    : {
                        border: '1.5px solid #2a2a2a',
                        background: '#1e1e1e',
                        color: '#888',
                      }
                }
              >
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ backgroundColor: lane.color }}
                />
                {lane.name}
              </button>
            )
          })}
        </div>

        {/* save / cancel */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={onCancel}
            className="px-2 py-1 text-xs text-[#888] hover:text-[#e3e3e3] rounded hover:bg-[#2a2a2a] transition-colors"
          >
            cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave}
            className="px-2 py-1 text-xs text-white rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ backgroundColor: '#534AB7' }}
          >
            save
          </button>
        </div>
      </div>
    </div>
  )
}
