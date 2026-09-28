export type Handle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'

export interface Box {
  x: number
  y: number
  width: number
  height: number
  /** Derece, merkez etrafında */
  rotation: number
}

export interface Guides {
  v: number[]
  h: number[]
}

export const MIN_W = 48
export const MIN_H = 36
export const MAX_H = 2400
export const SNAP_THRESHOLD = 6

const HX: Record<Handle, number> = { n: 0, s: 0, e: 1, w: -1, ne: 1, nw: -1, se: 1, sw: -1 }
const HY: Record<Handle, number> = { n: -1, s: 1, e: 0, w: 0, ne: -1, nw: -1, se: 1, sw: 1 }

export const HANDLES: Handle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']
export const isCorner = (h: Handle) => HX[h] !== 0 && HY[h] !== 0

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max)

export function rotatePoint(x: number, y: number, deg: number) {
  const r = (deg * Math.PI) / 180
  const c = Math.cos(r)
  const s = Math.sin(r)
  return { x: x * c - y * s, y: x * s + y * c }
}

/** Döndürülmüş kutunun eksen hizalı sınırları. */
export function boundsOf(b: Box) {
  const r = (b.rotation * Math.PI) / 180
  const c = Math.abs(Math.cos(r))
  const s = Math.abs(Math.sin(r))
  const hw = (b.width * c + b.height * s) / 2
  const hh = (b.width * s + b.height * c) / 2
  const cx = b.x + b.width / 2
  const cy = b.y + b.height / 2
  return { left: cx - hw, right: cx + hw, top: cy - hh, bottom: cy + hh, cx, cy, hw, hh }
}

/** Kutuyu yatayda [0, cw] içinde, dikeyde notun üst kenarının altında tutar. */
export function clampBox(b: Box, cw: number): Box {
  const { cx, cy, hw, hh } = boundsOf(b)
  const ncx = hw * 2 >= cw ? cw / 2 : clamp(cx, hw, cw - hw)
  const ncy = Math.max(cy, hh)
  return { ...b, x: ncx - b.width / 2, y: ncy - b.height / 2 }
}

/**
 * Tutamaçla yeniden boyutlandırma. Karşı kenar/köşe dünya koordinatında
 * sabit kalır; döndürülmüş görsellerde de doğru çalışır.
 */
export function resizeBox(
  start: Box, handle: Handle, dx: number, dy: number, keepRatio: boolean, cw: number,
): Box {
  const hx = HX[handle]
  const hy = HY[handle]
  const local = rotatePoint(dx, dy, -start.rotation)

  let sx = hx === 0 ? 1 : (start.width + hx * local.x) / start.width
  let sy = hy === 0 ? 1 : (start.height + hy * local.y) / start.height

  // Sabit kenar notun dışına taşmasın diye büyümeyi sınırla
  let maxSx = cw / start.width
  let maxSy = MAX_H / start.height
  if (start.rotation === 0) {
    if (hx === 1)  maxSx = (cw - start.x) / start.width
    if (hx === -1) maxSx = (start.x + start.width) / start.width
    if (hy === -1) maxSy = Math.min(maxSy, (start.y + start.height) / start.height)
  }
  const minSx = MIN_W / start.width
  const minSy = MIN_H / start.height

  if (keepRatio && hx !== 0 && hy !== 0) {
    let s = Math.abs(sx - 1) > Math.abs(sy - 1) ? sx : sy
    s = Math.min(Math.max(s, minSx, minSy), maxSx, maxSy)
    sx = s
    sy = s
  } else {
    sx = Math.min(Math.max(sx, minSx), maxSx)
    sy = Math.min(Math.max(sy, minSy), maxSy)
  }

  const width = start.width * sx
  const height = start.height * sy

  const a0 = rotatePoint((-hx * start.width) / 2, (-hy * start.height) / 2, start.rotation)
  const a1 = rotatePoint((-hx * width) / 2, (-hy * height) / 2, start.rotation)
  const cx = start.x + start.width / 2 + a0.x - a1.x
  const cy = start.y + start.height / 2 + a0.y - a1.y

  return { ...start, width, height, x: cx - width / 2, y: cy - height / 2 }
}

/** Merkezden imlece açı (tutamaç yukarıdayken 0°). Shift → 15° adımlar. */
export function angleFrom(cx: number, cy: number, px: number, py: number, stepped: boolean) {
  let deg = (Math.atan2(py - cy, px - cx) * 180) / Math.PI + 90
  if (stepped) {
    deg = Math.round(deg / 15) * 15
  } else {
    const near = Math.round(deg / 90) * 90
    if (Math.abs(deg - near) < 4) deg = near
  }
  deg = ((((deg + 180) % 360) + 360) % 360) - 180
  return Math.round(deg * 10) / 10
}

/** Kutunun kenar/merkezlerini en yakın hedef çizgiye yapıştırır. */
export function snapMove(b: Box, xs: number[], ys: number[]): { box: Box; guides: Guides } {
  const bb = boundsOf(b)
  const pick = (cands: number[], targets: number[]) => {
    let best: { d: number; delta: number; at: number } | null = null
    for (const c of cands) {
      for (const t of targets) {
        const d = Math.abs(t - c)
        if (d <= SNAP_THRESHOLD && (!best || d < best.d)) best = { d, delta: t - c, at: t }
      }
    }
    return best
  }
  const bx = pick([bb.left, bb.cx, bb.right], xs)
  const by = pick([bb.top, bb.cy, bb.bottom], ys)
  return {
    box: { ...b, x: b.x + (bx?.delta ?? 0), y: b.y + (by?.delta ?? 0) },
    guides: { v: bx ? [bx.at] : [], h: by ? [by.at] : [] },
  }
}
