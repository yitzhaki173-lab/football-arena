import { getProfile } from './profile'

let ctx: AudioContext | null = null

function beep(freq: number, ms: number, type: OscillatorType = 'sine', gain = 0.08) {
  try {
    ctx ??= new AudioContext()
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = type
    o.frequency.value = freq
    g.gain.value = gain
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + ms / 1000)
    o.connect(g).connect(ctx.destination)
    o.start()
    o.stop(ctx.currentTime + ms / 1000)
  } catch {
    /* audio not available */
  }
}

function vibrate(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern)
  } catch {
    /* ignore */
  }
}

export const fx = {
  correct() {
    const s = getProfile().settings
    if (s.sound) {
      beep(660, 120)
      setTimeout(() => beep(990, 160), 90)
    }
    if (s.vibrate) vibrate(30)
  },
  wrong() {
    const s = getProfile().settings
    if (s.sound) beep(180, 260, 'square', 0.05)
    if (s.vibrate) vibrate([60, 40, 60])
  },
  tap() {
    if (getProfile().settings.sound) beep(520, 40, 'triangle', 0.04)
  },
  win() {
    const s = getProfile().settings
    if (s.sound) [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => beep(f, 180), i * 120))
    if (s.vibrate) vibrate([40, 60, 40, 60, 120])
  },
}
