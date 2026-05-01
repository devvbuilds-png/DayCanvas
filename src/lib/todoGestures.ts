export interface GesturePoint {
  x: number
  y: number
}

export interface GestureMatch {
  kind: 'tick' | 'cross' | 'strike' | 'priority'
  priority?: number
  label: string
  score: number
}

export interface GestureStroke {
  points: GesturePoint[]
}

interface Template {
  kind: GestureMatch['kind']
  label: string
  priority?: number
  points: GesturePoint[]
}

const TEMPLATE_SIZE = 100
const SAMPLE_COUNT = 48

function line(from: GesturePoint, to: GesturePoint, count: number): GesturePoint[] {
  return Array.from({ length: count }, (_, i) => {
    const t = count === 1 ? 0 : i / (count - 1)
    return {
      x: from.x + (to.x - from.x) * t,
      y: from.y + (to.y - from.y) * t,
    }
  })
}

function polyline(points: GesturePoint[], pointsPerSegment: number): GesturePoint[] {
  const out: GesturePoint[] = []
  for (let i = 0; i < points.length - 1; i += 1) {
    const segment = line(points[i], points[i + 1], pointsPerSegment)
    if (i > 0) segment.shift()
    out.push(...segment)
  }
  return out
}

function pathLength(points: GesturePoint[]): number {
  let total = 0
  for (let i = 1; i < points.length; i += 1) {
    total += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y)
  }
  return total
}

function resample(points: GesturePoint[], count: number): GesturePoint[] {
  if (points.length === 0) return []
  if (points.length === 1) return Array.from({ length: count }, () => points[0])

  const interval = pathLength(points) / (count - 1)
  const sampled = [points[0]]
  let remaining = interval
  let prev = points[0]

  for (let i = 1; i < points.length; i += 1) {
    const current = points[i]
    let distance = Math.hypot(current.x - prev.x, current.y - prev.y)

    while (distance >= remaining && distance > 0) {
      const t = remaining / distance
      const next = {
        x: prev.x + (current.x - prev.x) * t,
        y: prev.y + (current.y - prev.y) * t,
      }
      sampled.push(next)
      prev = next
      distance = Math.hypot(current.x - prev.x, current.y - prev.y)
      remaining = interval
    }

    remaining -= distance
    prev = current
  }

  while (sampled.length < count) sampled.push(points[points.length - 1])
  return sampled
}

function normalize(points: GesturePoint[]): GesturePoint[] {
  const sampled = resample(points, SAMPLE_COUNT)
  const xs = sampled.map(p => p.x)
  const ys = sampled.map(p => p.y)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const width = Math.max(1, maxX - minX)
  const height = Math.max(1, maxY - minY)
  const scale = TEMPLATE_SIZE / Math.max(width, height)

  const scaled = sampled.map(p => ({
    x: (p.x - minX) * scale,
    y: (p.y - minY) * scale,
  }))

  const cx = scaled.reduce((sum, p) => sum + p.x, 0) / scaled.length
  const cy = scaled.reduce((sum, p) => sum + p.y, 0) / scaled.length

  return scaled.map(p => ({ x: p.x - cx, y: p.y - cy }))
}

function averageDistance(a: GesturePoint[], b: GesturePoint[]): number {
  let total = 0
  for (let i = 0; i < a.length; i += 1) {
    total += Math.hypot(a[i].x - b[i].x, a[i].y - b[i].y)
  }
  return total / a.length
}

const DIGIT_TEMPLATES: Record<number, GesturePoint[]> = {
  1: polyline([{ x: 52, y: 24 }, { x: 52, y: 77 }], 14),
  2: polyline([{ x: 30, y: 30 }, { x: 55, y: 22 }, { x: 66, y: 37 }, { x: 34, y: 73 }, { x: 68, y: 73 }], 8),
  3: polyline([{ x: 31, y: 28 }, { x: 63, y: 28 }, { x: 48, y: 49 }, { x: 64, y: 49 }, { x: 45, y: 72 }, { x: 29, y: 70 }], 8),
  4: polyline([{ x: 60, y: 24 }, { x: 60, y: 76 }, { x: 34, y: 50 }, { x: 68, y: 50 }], 10),
  5: polyline([{ x: 66, y: 25 }, { x: 36, y: 25 }, { x: 34, y: 49 }, { x: 57, y: 48 }, { x: 65, y: 58 }, { x: 58, y: 73 }, { x: 33, y: 72 }], 8),
  6: polyline([{ x: 64, y: 28 }, { x: 42, y: 38 }, { x: 34, y: 56 }, { x: 43, y: 74 }, { x: 61, y: 68 }, { x: 58, y: 50 }, { x: 38, y: 50 }], 8),
  7: polyline([{ x: 32, y: 25 }, { x: 67, y: 25 }, { x: 45, y: 75 }], 12),
  8: polyline([{ x: 48, y: 24 }, { x: 33, y: 37 }, { x: 48, y: 51 }, { x: 65, y: 38 }, { x: 48, y: 24 }, { x: 33, y: 61 }, { x: 49, y: 76 }, { x: 65, y: 61 }, { x: 49, y: 51 }], 6),
  9: polyline([{ x: 62, y: 49 }, { x: 45, y: 48 }, { x: 35, y: 36 }, { x: 44, y: 23 }, { x: 63, y: 29 }, { x: 61, y: 71 }, { x: 36, y: 75 }], 8),
}

const NORMALIZED_DIGIT_TEMPLATES: Record<number, GesturePoint[]> = Object.fromEntries(
  Object.entries(DIGIT_TEMPLATES).map(([priority, points]) => [Number(priority), normalize(points)]),
) as Record<number, GesturePoint[]>

function makePriorityTemplate(priority: number): Template {
  return {
    kind: 'priority',
    label: `priority ${priority}`,
    priority,
    points: normalize(DIGIT_TEMPLATES[priority]),
  }
}

const TEMPLATES: Template[] = [
  {
    kind: 'tick',
    label: 'done',
    points: normalize(polyline([{ x: 20, y: 52 }, { x: 38, y: 72 }, { x: 76, y: 24 }], 14)),
  },
  {
    kind: 'cross',
    label: 'missed',
    points: normalize(polyline([{ x: 20, y: 24 }, { x: 78, y: 78 }, { x: 24, y: 78 }, { x: 78, y: 20 }], 14)),
  },
  {
    kind: 'strike',
    label: 'done',
    points: normalize(line({ x: 18, y: 50 }, { x: 82, y: 50 }, 36)),
  },
  ...Array.from({ length: 9 }, (_, i) => makePriorityTemplate(i + 1)),
]

function getBounds(points: GesturePoint[]) {
  const xs = points.map(p => p.x)
  const ys = points.map(p => p.y)
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys),
  }
}

function lineDistance(point: GesturePoint, start: GesturePoint, end: GesturePoint) {
  const baseline = Math.hypot(end.x - start.x, end.y - start.y) || 1
  return Math.abs(
    (end.y - start.y) * point.x -
    (end.x - start.x) * point.y +
    end.x * start.y -
    end.y * start.x,
  ) / baseline
}

function strokeStraightness(points: GesturePoint[]) {
  if (points.length < 2) return 0
  const first = points[0]
  const last = points[points.length - 1]
  const bounds = getBounds(points)
  let drift = 0
  for (const point of points) drift = Math.max(drift, lineDistance(point, first, last))
  return 1 - Math.min(1, drift / Math.max(8, Math.min(bounds.width, bounds.height) + 4))
}

function intersectSegments(a1: GesturePoint, a2: GesturePoint, b1: GesturePoint, b2: GesturePoint) {
  const denominator = (a1.x - a2.x) * (b1.y - b2.y) - (a1.y - a2.y) * (b1.x - b2.x)
  if (Math.abs(denominator) < 0.001) return null

  const determinantA = a1.x * a2.y - a1.y * a2.x
  const determinantB = b1.x * b2.y - b1.y * b2.x

  const x = (determinantA * (b1.x - b2.x) - (a1.x - a2.x) * determinantB) / denominator
  const y = (determinantA * (b1.y - b2.y) - (a1.y - a2.y) * determinantB) / denominator

  const within = (value: number, start: number, end: number) =>
    value >= Math.min(start, end) - 0.5 && value <= Math.max(start, end) + 0.5

  if (
    within(x, a1.x, a2.x) &&
    within(y, a1.y, a2.y) &&
    within(x, b1.x, b2.x) &&
    within(y, b1.y, b2.y)
  ) {
    return { x, y }
  }

  return null
}

function recognizeCross(strokes: GestureStroke[]): GestureMatch | null {
  if (strokes.length < 2) return null
  const viable = strokes
    .filter(stroke => stroke.points.length >= 2)
    .map(stroke => ({
      stroke,
      straightness: strokeStraightness(stroke.points),
      bounds: getBounds(stroke.points),
    }))
    .filter(entry => entry.straightness > 0.68 && entry.bounds.width > 12 && entry.bounds.height > 12)
    .sort((a, b) => b.stroke.points.length - a.stroke.points.length)

  for (let i = 0; i < viable.length; i += 1) {
    for (let j = i + 1; j < viable.length; j += 1) {
      const a = viable[i]
      const b = viable[j]
      const aStart = a.stroke.points[0]
      const aEnd = a.stroke.points[a.stroke.points.length - 1]
      const bStart = b.stroke.points[0]
      const bEnd = b.stroke.points[b.stroke.points.length - 1]
      const intersection = intersectSegments(aStart, aEnd, bStart, bEnd)
      if (!intersection) continue

      const angleA = Math.atan2(aEnd.y - aStart.y, aEnd.x - aStart.x)
      const angleB = Math.atan2(bEnd.y - bStart.y, bEnd.x - bStart.x)
      let angle = Math.abs(angleA - angleB)
      if (angle > Math.PI) angle = Math.PI * 2 - angle
      const degrees = (angle * 180) / Math.PI
      if (degrees < 35 || degrees > 145) continue

      const bounds = {
        minX: Math.min(a.bounds.minX, b.bounds.minX),
        maxX: Math.max(a.bounds.maxX, b.bounds.maxX),
        minY: Math.min(a.bounds.minY, b.bounds.minY),
        maxY: Math.max(a.bounds.maxY, b.bounds.maxY),
      }
      const centerX = (bounds.minX + bounds.maxX) / 2
      const centerY = (bounds.minY + bounds.maxY) / 2
      const maxOffset = Math.max(10, Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY) * 0.22)
      const centerOffset = Math.hypot(intersection.x - centerX, intersection.y - centerY)
      if (centerOffset > maxOffset) continue

      const score = Math.min(0.98, (a.straightness + b.straightness) / 2)
      return { kind: 'cross', label: 'missed', score }
    }
  }

  return null
}

function isLoopStroke(points: GesturePoint[]) {
  if (points.length < 8) return false
  const first = points[0]
  const last = points[points.length - 1]
  const bounds = getBounds(points)
  const closeDistance = Math.hypot(last.x - first.x, last.y - first.y)
  const perimeter = pathLength(points) || 1
  const aspect = bounds.width / Math.max(1, bounds.height)
  return closeDistance < Math.max(bounds.width, bounds.height) * 0.45 &&
    perimeter > Math.max(bounds.width, bounds.height) * 2 &&
    aspect > 0.65 &&
    aspect < 1.45
}

function recognizePriority(strokes: GestureStroke[]): GestureMatch | null {
  const candidates: GesturePoint[][] = []
  const merged = strokes.flatMap((stroke, index) => {
    if (index > 0 && stroke.points.length > 0) return [stroke.points[0], ...stroke.points]
    return stroke.points
  })

  if (merged.length >= 8) candidates.push(merged)

  const nonLoop = strokes.filter(stroke => !isLoopStroke(stroke.points))
  const mergedNonLoop = nonLoop.flatMap((stroke, index) => {
    if (index > 0 && stroke.points.length > 0) return [stroke.points[0], ...stroke.points]
    return stroke.points
  })
  if (mergedNonLoop.length >= 8 && mergedNonLoop.length !== merged.length) candidates.push(mergedNonLoop)

  for (const stroke of strokes) {
    if (stroke.points.length >= 8) candidates.push(stroke.points)
  }

  let best: GestureMatch | null = null

  for (const candidate of candidates) {
    const normalized = normalize(candidate)
    for (let priority = 1; priority <= 9; priority += 1) {
      const score = Math.max(0, 1 - averageDistance(normalized, NORMALIZED_DIGIT_TEMPLATES[priority]) / (TEMPLATE_SIZE * 0.55))
      if (score < 0.7) continue
      if (!best || score > best.score) {
        best = {
          kind: 'priority',
          priority,
          label: `priority ${priority}`,
          score,
        }
      }
    }
  }

  return best
}

function recognizeStrike(points: GesturePoint[]): GestureMatch | null {
  const { width, height } = getBounds(points)
  if (width < 24 || width < height * 2.4) return null

  const first = points[0]
  const last = points[points.length - 1]
  let drift = 0
  for (const point of points) drift = Math.max(drift, lineDistance(point, first, last))

  const straightness = 1 - Math.min(1, drift / Math.max(8, height + 4))
  const horizontalness = 1 - Math.min(1, Math.abs(last.y - first.y) / Math.max(10, height + 4))
  const score = straightness * 0.6 + horizontalness * 0.4
  if (score < 0.72) return null

  return { kind: 'strike', label: 'done', score }
}

function recognizeTick(points: GesturePoint[]): GestureMatch | null {
  if (points.length < 10) return null

  const strike = recognizeStrike(points)
  if (strike) return null

  const normalized = normalize(points)
  let bestTemplate: Template | null = null
  let bestDistance = Number.POSITIVE_INFINITY

  for (const template of TEMPLATES.filter(template => template.kind === 'tick')) {
    const distance = averageDistance(normalized, template.points)
    if (distance < bestDistance) {
      bestDistance = distance
      bestTemplate = template
    }
  }

  if (!bestTemplate) return null

  const score = Math.max(0, 1 - bestDistance / (TEMPLATE_SIZE * 0.6))
  if (score < 0.76) return null
  return { kind: bestTemplate.kind, label: bestTemplate.label, score }
}

function mergeStrokePoints(strokes: GestureStroke[]) {
  const merged: GesturePoint[] = []
  for (const stroke of strokes) {
    if (stroke.points.length === 0) continue
    if (merged.length > 0 && stroke.points.length > 1) merged.push(stroke.points[0])
    merged.push(...stroke.points)
  }
  return merged
}

export function recognizeTodoGesture(
  strokes: GestureStroke[],
  targetKind: 'parked' | 'timeline',
): GestureMatch | null {
  const merged = mergeStrokePoints(strokes)
  if (merged.length < 10) return null

  const strike = recognizeStrike(merged)
  if (strike) return strike

  const cross = recognizeCross(strokes)
  if (cross) return cross

  if (targetKind === 'parked') {
    const priority = recognizePriority(strokes)
    if (priority) return priority
  }

  return recognizeTick(merged)
}
