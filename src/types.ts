export type TopicId = 'ligat-haal' | 'ucl' | 'top5' | 'national'
export type Level = 'medium' | 'hard' | 'expert'

export type QType = 'regular' | 'chrono' | 'final' | 'odd' | 'number' | 'coach' | 'record' | 'career'

/** A trivia question. `a` is the correct answer, `w` the five wrong ones. */
export interface Question {
  id: string
  topic: TopicId
  level: Level
  type: QType
  q: string
  a: string
  w: string[]
  ex?: string
  /** A context picture that never shows the answer: a crest, a flag, a competition logo or a player photo. */
  img?: string
  imgKind?: 'logo' | 'flag' | 'photo'
}

/** "Who is the player": a blurred photo and five clues from hardest to easiest. */
export interface WhoEntry {
  id: string
  topic: TopicId
  /** Other topics this player also belongs to. */
  alt?: TopicId[]
  level: Level
  answer: string
  clues: string[]
  w: string[]
  img?: string
}

export interface ScratchEntry {
  id: string
  topic: TopicId
  alt?: TopicId[]
  kind: 'player' | 'team'
  level: Level
  /** The name the player completes from letter tiles. */
  name: string
  img: string
}

export type GameMode = 'trivia' | 'quick' | 'who' | 'scratch'

export interface GameConfig {
  mode: GameMode
  /** One or more topics; all four means everything. */
  topics: TopicId[]
  level: Level
  count: number
  seconds: number
  scratchKind?: 'player' | 'team' | 'mixed'
  /** Tournament only: the games its rounds rotate through. */
  modes?: GameMode[]
}

export interface GameResult {
  mode: GameMode
  topics: TopicId[]
  level: Level
  score: number
  correct: number
  total: number
  at: number
  room?: boolean
  won?: boolean
}
