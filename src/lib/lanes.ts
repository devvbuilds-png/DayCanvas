import type { Lane } from '../db/schema'

export function applyReorder(lanes: Lane[], dragId: string, insertBefore: number): Lane[] {
  const fromIdx = lanes.findIndex(l => l.id === dragId)
  if (fromIdx === -1) return lanes
  const arr = [...lanes]
  const [item] = arr.splice(fromIdx, 1)
  const adjusted = insertBefore > fromIdx ? insertBefore - 1 : insertBefore
  arr.splice(adjusted, 0, item)
  return arr
}
