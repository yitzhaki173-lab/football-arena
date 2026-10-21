import { useEffect, useRef, useState } from 'react'

/** A countdown that ticks on animation frames. Restarts whenever `key` changes. */
export function useCountdown(totalMs: number, running: boolean, key: unknown, onEnd: () => void) {
  const [left, setLeft] = useState(totalMs)
  const endRef = useRef(onEnd)
  endRef.current = onEnd
  const startRef = useRef(0)

  useEffect(() => {
    setLeft(totalMs)
    startRef.current = performance.now()
  }, [key, totalMs])

  useEffect(() => {
    if (!running) return
    let raf = 0
    let fired = false
    const tick = () => {
      const l = totalMs - (performance.now() - startRef.current)
      setLeft(l)
      if (l <= 0) {
        if (!fired) {
          fired = true
          endRef.current()
        }
        return
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [running, key, totalMs])

  const elapsed = () => performance.now() - startRef.current
  return { left, elapsed }
}
