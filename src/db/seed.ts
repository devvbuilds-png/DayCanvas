import { db } from './db'
import type { Day } from './schema'

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

export async function seedIfEmpty(): Promise<void> {
  const date = todayISO()
  const existing = await db.days.get(date)
  if (!existing) {
    const day: Day = { date, mood: null, stamped: false, scratch_content: '' }
    await db.days.add(day)
  }
}
