import type { Level } from '../types'

/** Points for a correct trivia answer. Quick mode adds up to 50 for speed. */
export function triviaPoints(level: Level, quick: boolean, msLeft: number, msTotal: number): number {
  const base = level === 'expert' ? 150 : 100
  if (!quick) return base
  return base + Math.round(50 * Math.max(0, msLeft) / msTotal)
}

/** Who-is-the-player: 500 on the first clue, 100 less for each extra clue. */
export function whoPoints(cluesShown: number): number {
  return Math.max(100, 600 - 100 * cluesShown)
}

/** Scratch & Guess: by how much of the picture was revealed, minus 15% per help letter. */
export function scratchPoints(revealedPct: number, helps: number): number {
  let base = 100
  if (revealedPct <= 10) base = 500
  else if (revealedPct <= 25) base = 350
  else if (revealedPct <= 50) base = 200
  return Math.max(0, Math.round(base * (1 - 0.15 * helps)))
}

export const SCRATCH_MAX = 500

/** Rooms and tournaments compare different modes, so each item counts up to 100. */
export function normalized(points: number, mode: 'trivia' | 'quick' | 'who' | 'scratch', level: Level): number {
  const max = mode === 'who' || mode === 'scratch' ? 500 : mode === 'quick' ? (level === 'expert' ? 200 : 150) : level === 'expert' ? 150 : 100
  return Math.round((100 * points) / max)
}
