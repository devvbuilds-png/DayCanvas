import Dexie, { type Table } from 'dexie'
import type { Todo, Lane, Day } from './schema'

class DayCanvasDB extends Dexie {
  todos!: Table<Todo, string>
  lanes!: Table<Lane, string>
  days!: Table<Day, string>

  constructor() {
    super('day-canvas')
    this.version(1).stores({
      todos: 'id, lane_id, status',
      lanes: 'id, order',
      days: 'date',
    })
    this.version(2).stores({
      todos: 'id, lane_id, status',
      lanes: 'id, order',
      days: 'date',
    }).upgrade(tx =>
      tx.table('todos').toCollection().modify((todo: Record<string, unknown>) => {
        if (todo.description === undefined) todo.description = ''
      })
    )
  }
}

export const db = new DayCanvasDB()
