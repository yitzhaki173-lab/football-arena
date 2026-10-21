import { useEffect, useRef, type PointerEvent as RPointerEvent } from 'react'

const GRID = 40

/**
 * An opaque layer over the picture. Dragging a finger erases a circle under it.
 * Revealed area is measured on a fixed grid over the picture, so screen size
 * and finger width don't change the percentage.
 */
export function ScratchCanvas({
  brush,
  onReveal,
  disabled,
  cleared,
  resetKey,
}: {
  /** Brush radius as a fraction of the picture width. */
  brush: number
  onReveal: (pct: number) => void
  disabled: boolean
  cleared: boolean
  resetKey: unknown
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const cells = useRef<Uint8Array>(new Uint8Array(GRID * GRID))
  const count = useRef(0)
  const last = useRef<{ x: number; y: number } | null>(null)
  const revealCb = useRef(onReveal)
  revealCb.current = onReveal

  useEffect(() => {
    const c = ref.current
    if (!c) return
    const paint = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      const w = c.clientWidth
      const h = c.clientHeight
      c.width = Math.round(w * dpr)
      c.height = Math.round(h * dpr)
      const g = c.getContext('2d')!
      g.setTransform(dpr, 0, 0, dpr, 0, 0)
      g.globalCompositeOperation = 'source-over'
      const grad = g.createLinearGradient(0, 0, w, h)
      grad.addColorStop(0, '#1d3b27')
      grad.addColorStop(1, '#0d2216')
      g.fillStyle = grad
      g.fillRect(0, 0, w, h)
      // pitch stripes
      g.fillStyle = 'rgba(255,255,255,0.035)'
      for (let x = 0; x < w; x += w / 8) if (Math.round(x / (w / 8)) % 2 === 0) g.fillRect(x, 0, w / 8, h)
      g.strokeStyle = 'rgba(200,245,96,0.22)'
      g.lineWidth = 2
      g.beginPath()
      g.arc(w / 2, h / 2, w * 0.18, 0, Math.PI * 2)
      g.moveTo(0, h / 2)
      g.lineTo(w, h / 2)
      g.stroke()
      g.fillStyle = 'rgba(200,245,96,0.55)'
      g.font = `900 ${Math.round(w * 0.2)}px Rubik, sans-serif`
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      g.fillText('?', w / 2, h / 2)
      // replay already-scratched cells after a resize
      g.globalCompositeOperation = 'destination-out'
      for (let k = 0; k < GRID * GRID; k++) {
        if (!cells.current[k]) continue
        const cx = ((k % GRID) + 0.5) / GRID
        const cy = (Math.floor(k / GRID) + 0.5) / GRID
        g.fillRect((cx - 0.5 / GRID) * w - 1, (cy - 0.5 / GRID) * h - 1, w / GRID + 2, h / GRID + 2)
      }
    }
    cells.current = new Uint8Array(GRID * GRID)
    count.current = 0
    paint()
    revealCb.current(0)
    const ro = new ResizeObserver(paint)
    ro.observe(c)
    return () => ro.disconnect()
  }, [resetKey])

  const stamp = (nx: number, ny: number) => {
    const c = ref.current!
    const g = c.getContext('2d')!
    const w = c.clientWidth
    const h = c.clientHeight
    g.globalCompositeOperation = 'destination-out'
    g.beginPath()
    g.arc(nx * w, ny * h, brush * w, 0, Math.PI * 2)
    g.fill()
    const r = brush * GRID
    const gx = nx * GRID
    const gy = ny * GRID
    for (let y = Math.max(0, Math.floor(gy - r)); y <= Math.min(GRID - 1, Math.ceil(gy + r)); y++) {
      for (let x = Math.max(0, Math.floor(gx - r)); x <= Math.min(GRID - 1, Math.ceil(gx + r)); x++) {
        const dx = x + 0.5 - gx
        const dy = y + 0.5 - gy
        if (dx * dx + dy * dy <= r * r) {
          const k = y * GRID + x
          if (!cells.current[k]) {
            cells.current[k] = 1
            count.current++
          }
        }
      }
    }
  }

  const pos = (e: RPointerEvent) => {
    const rect = ref.current!.getBoundingClientRect()
    return { x: (e.clientX - rect.left) / rect.width, y: (e.clientY - rect.top) / rect.height }
  }

  const drawTo = (p: { x: number; y: number }) => {
    const from = last.current ?? p
    const dist = Math.hypot(p.x - from.x, p.y - from.y)
    const steps = Math.max(1, Math.ceil(dist / (brush * 0.5)))
    for (let s = 1; s <= steps; s++) stamp(from.x + ((p.x - from.x) * s) / steps, from.y + ((p.y - from.y) * s) / steps)
    last.current = p
    revealCb.current((100 * count.current) / (GRID * GRID))
  }

  return (
    <canvas
      ref={ref}
      style={{ opacity: cleared ? 0 : 1, transition: 'opacity .6s', pointerEvents: disabled ? 'none' : 'auto' }}
      onPointerDown={(e) => {
        ;(e.target as HTMLCanvasElement).setPointerCapture(e.pointerId)
        last.current = null
        drawTo(pos(e))
      }}
      onPointerMove={(e) => {
        if (e.buttons === 0 && e.pointerType === 'mouse') return
        if (last.current) drawTo(pos(e))
      }}
      onPointerUp={() => (last.current = null)}
      onPointerCancel={() => (last.current = null)}
    />
  )
}
