import type { GameConfig } from '../types'

export interface GameOutcome {
  score: number
  /** Score scaled so each item is worth up to 100, for rooms that mix modes. */
  norm: number
  correct: number
  total: number
  bestStreak: number
  /** Total thinking time, used to break ties. */
  ms: number
  scratchUnder10: number
  whoFirstClue: number
  seenIds: string[]
}

export interface GameProps<T> {
  config: GameConfig
  items: T[]
  seed: number
  onDone: (o: GameOutcome) => void
  /** Called after every item, so a room can show live scores. */
  onProgress?: (p: { index: number; score: number; norm: number }) => void
  onQuit?: () => void
}
