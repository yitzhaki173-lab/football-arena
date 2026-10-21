import type { GameConfig, ScratchEntry } from '../types'

export type RoomKind = 'room' | 'tournament' | 'duel' | 'challenge'
export type RoomStatus = 'lobby' | 'playing' | 'roundEnd' | 'finished'

export interface RoomPlayer {
  id: string
  name: string
  avatar: number
  xp: number
  joinedAt: number
  /** heartbeat, ms since epoch */
  last: number
  out?: boolean
  left?: boolean
  /** Sits out this round (wrote the personal puzzle). */
  spectator?: boolean
  progress: number
  score: number
  norm: number
  correct: number
  ms: number
  done: boolean
  /** tournament: sum of normalized round scores */
  total: number
}

export interface RoundRecord {
  round: number
  mode: GameConfig['mode']
  scores: Record<string, number>
  out?: string
}

export interface RoomState {
  code: string
  kind: RoomKind
  host: string
  createdAt: number
  status: RoomStatus
  round: number
  seed: number
  config: GameConfig
  /** tournament round plan */
  plan?: GameConfig[]
  players: Record<string, RoomPlayer>
  history?: Record<string, RoundRecord>
  custom?: ScratchEntry | null
  /** set by whoever wrote the personal puzzle */
  customBy?: string | null
}

export const MAX_PLAYERS = 5

export interface RoomTransport {
  readonly name: string
  get(code: string): Promise<RoomState | null>
  create(room: RoomState): Promise<void>
  subscribe(code: string, cb: (room: RoomState | null) => void): () => void
  /** Multi-path update: keys are paths like "players/abc/score". */
  patch(code: string, updates: Record<string, unknown>): Promise<void>
}
