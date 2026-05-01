export type TodoStatus = 'parked' | 'scheduled' | 'done' | 'missed' | 'carried'
export type Mood = 'tough' | 'meh' | 'good' | 'fire' | null

export interface Todo {
  id: string
  text: string
  lane_id: string
  status: TodoStatus
  priority: number | null
  start_time: string | null   // ISO datetime, null when parked
  duration_minutes: number | null
  stickers: string[]
  description: string         // freeform notes, editable in detail panel
  created_at: string          // ISO datetime
  updated_at: string          // ISO datetime
}

export interface Lane {
  id: string
  name: string
  color: string               // hex
  order: number
}

export interface Day {
  date: string                // YYYY-MM-DD, primary key
  mood: Mood
  stamped: boolean
  scratch_content: string
}
