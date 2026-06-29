import { useEffect, useRef } from 'react'

/* ─── Bezier control points — shape of the ribbon ─────────── */
interface Point { x: number; y: number }

function lerp(a: Point, b: Point, t: number): Point {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
}

/* Baseline anchor points (as % of canvas size) */
const P0A: Point = { x: -0.08, y:  0.05 }
const P1A: Point = { x:  0.35, y: -0.08 }
const P2A: Point = { x:  0.70, y:  0.90 }
const P3A: Point = { x:  1.10, y:  0.72 }

/* Slightly shifted set (where the path drifts to) */
const P0B: Point = { x: -0.08, y:  0.18 }
const P1B: Point = { x:  0.45, y:  0.28 }
const P2B: Point = { x:  0.55, y:  1.00 }
const P3B: Point = { x:  1.10, y:  0.52 }

/* Draw a single-pass neon stroke: outer glow → mid glow → bright core */
function drawNeonPath(
  ctx: CanvasRenderingContext2D,
  p0: Point, p1: Point, p2: Point, p3: Point,
  w: number, h: number,
) {
  const X = (p: Point) => p.x * w
  const Y = (p: Point) => p.y * h

  function stroke(color: string, lineWidth: number, blur: number, alpha: number) {
    ctx.save()
    ctx.beginPath()
    ctx.moveTo(X(p0), Y(p0))
    ctx.bezierCurveTo(X(p1), Y(p1), X(p2), Y(p2), X(p3), Y(p3))
    ctx.strokeStyle = color
    ctx.lineWidth   = lineWidth
    ctx.globalAlpha = alpha
    ctx.filter      = `blur(${blur}px)`
    ctx.stroke()
    ctx.restore()
  }

  /* Layer 1 — Wide purple aura */
  stroke('rgba(124, 58, 237, 1)', lineWidth(w, 80), blur(w, 70), 0.22)

  /* Layer 2 — Mid blue glow */
  stroke('rgba(77, 141, 255, 1)', lineWidth(w, 48), blur(w, 36), 0.40)

  /* Layer 3 — Tight bright core */
  stroke('rgba(200, 210, 255, 1)', lineWidth(w, 14), blur(w, 10), 0.60)

  /* Layer 4 — Ultra-thin white hot center */
  stroke('rgba(240, 244, 255, 1)', lineWidth(w,  4), blur(w,  2), 0.90)
}

/* Scale blur/lineWidth relative to canvas width so it looks right on all screens */
function blur(w: number, base: number) { return base * (w / 1000) }
function lineWidth(w: number, base: number) { return base * (w / 1000) }

export function HeroRibbon() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef    = useRef<number>(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    /* Keep canvas pixel-perfect on resize */
    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      canvas.width  = rect.width  * window.devicePixelRatio
      canvas.height = rect.height * window.devicePixelRatio
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio)
    }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(canvas)

    const startTime = performance.now()
    const CYCLE = 20_000 // 20 second full cycle

    function draw() {
      const rect  = canvas!.getBoundingClientRect()
      const W     = rect.width
      const H     = rect.height
      const t     = ((performance.now() - startTime) % CYCLE) / CYCLE
      // smooth ease-in-out ping-pong 0→1→0
      const ease  = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2

      ctx!.clearRect(0, 0, W, H)

      const p0 = lerp(P0A, P0B, ease)
      const p1 = lerp(P1A, P1B, ease)
      const p2 = lerp(P2A, P2B, ease)
      const p3 = lerp(P3A, P3B, ease)

      drawNeonPath(ctx!, p0, p1, p2, p3, W, H)

      rafRef.current = requestAnimationFrame(draw)
    }

    draw()

    return () => {
      cancelAnimationFrame(rafRef.current)
      observer.disconnect()
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position:      'absolute',
        top:           0,
        left:          0,
        width:         '100%',
        height:        '100%',
        pointerEvents: 'none',
        zIndex:        0,
      }}
    />
  )
}
