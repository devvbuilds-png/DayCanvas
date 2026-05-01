import { db } from './db'
import type { Lane, Day } from './schema'

const DEFAULT_LANES: Lane[] = [
  { id: 'lane-kaizen',    name: 'Kaizen',    color: '#534AB7', order: 0 },
  { id: 'lane-sohailcab', name: 'SohailCab', color: '#0F6E56', order: 1 },
  { id: 'lane-interview', name: 'Interview', color: '#D85A30', order: 2 },
  { id: 'lane-reading',   name: 'Reading',   color: '#BA7517', order: 3 },
]

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

export async function seedIfEmpty(): Promise<void> {
  const laneCount = await db.lanes.count()
  if (laneCount === 0) {
    await db.lanes.bulkAdd(DEFAULT_LANES)
  }

  const date = todayISO()
  const existing = await db.days.get(date)
  if (!existing) {
    const day: Day = { date, mood: null, stamped: false, scratch_content: '' }
    await db.days.add(day)
  }
}
