/** Minutes elapsed since 6:00 am local time for a given ISO datetime string. */
export function minutesFrom6am(isoString: string): number {
  const d = new Date(isoString)
  return (d.getHours() - 6) * 60 + d.getMinutes()
}

/** Format minutes-from-6am as a 12h clock string: "9:30 am", "1:00 pm", "12:00 am". */
export function formatTime(minsFrom6am: number): string {
  const total = 6 * 60 + minsFrom6am
  const h     = Math.floor(total / 60)
  const m     = total % 60
  // h=24 → midnight → treat as 0 for period/12h calc
  const h24   = h % 24
  const h12   = h24 % 12 || 12
  const period = (h24 >= 12 && h24 !== 0) ? 'pm' : 'am'
  return `${h12}:${String(m).padStart(2, '0')} ${period}`
}

/** Format a duration in minutes as a human string: "30m", "1h", "1h 30m". */
export function formatDuration(mins: number): string {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

/** "9:00 am – 10:30 am · 1h 30m" */
export function formatRange(startMins: number, durationMins: number): string {
  return `${formatTime(startMins)} – ${formatTime(startMins + durationMins)} · ${formatDuration(durationMins)}`
}
