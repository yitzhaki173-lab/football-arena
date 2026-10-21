import { useSyncExternalStore } from 'react'
import type { GameResult } from '../types'
import { checkAchievements } from './achievements'

/** Everything about the player lives on their own phone. */
export interface Profile {
  nickname: string
  avatar: number
  xp: number
  games: number
  roomGames: number
  roomWins: number
  tournamentWins: number
  correct: number
  answered: number
  bestStreak: number
  perfectGames: number
  scratchUnder10: number
  whoFirstClue: number
  achievements: string[]
  history: GameResult[]
  seen: string[]
  reported: string[]
  settings: { sound: boolean; vibrate: boolean }
  /** Friends' last known scores, keyed by nickname, from rooms played together. */
  friends: Record<string, { avatar: number; xp: number; wins: number; at: number }>
}

const KEY = 'fa.profile.v1'

const empty: Profile = {
  nickname: '',
  avatar: 0,
  xp: 0,
  games: 0,
  roomGames: 0,
  roomWins: 0,
  tournamentWins: 0,
  correct: 0,
  answered: 0,
  bestStreak: 0,
  perfectGames: 0,
  scratchUnder10: 0,
  whoFirstClue: 0,
  achievements: [],
  history: [],
  seen: [],
  reported: [],
  settings: { sound: true, vibrate: true },
  friends: {},
}

function read(): Profile {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { ...empty }
    const p = JSON.parse(raw) as Partial<Profile>
    return { ...empty, ...p, settings: { ...empty.settings, ...p.settings } }
  } catch {
    return { ...empty }
  }
}

let state: Profile = read()
const listeners = new Set<() => void>()

function write(next: Profile) {
  state = next
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    /* storage full or blocked: keep the in-memory copy */
  }
  listeners.forEach((l) => l())
}

export function getProfile(): Profile {
  return state
}

export function updateProfile(fn: (p: Profile) => Profile) {
  write(fn(state))
}

export function resetProfile() {
  write({ ...empty })
}

export function useProfile(): Profile {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => state,
  )
}

export const RANKS = [
  { xp: 0, name: 'שחקן נוער' },
  { xp: 500, name: 'שחקן ספסל' },
  { xp: 1500, name: 'שחקן הרכב' },
  { xp: 3500, name: 'קפטן' },
  { xp: 7000, name: 'כוכב' },
  { xp: 12000, name: 'אגדה' },
]

export function rankOf(xp: number) {
  let i = 0
  while (i + 1 < RANKS.length && xp >= RANKS[i + 1].xp) i++
  const cur = RANKS[i]
  const next = RANKS[i + 1]
  const progress = next ? (xp - cur.xp) / (next.xp - cur.xp) : 1
  return { level: i + 1, name: cur.name, next, progress }
}

export function xpFor(r: GameResult): number {
  return Math.round(r.score / 10) + 20 + (r.won ? 50 : 0)
}

export interface RecordExtras {
  streak?: number
  scratchUnder10?: number
  whoFirstClue?: number
  seenIds?: string[]
  tournamentWin?: boolean
}

/** Saves a finished game. Returns XP earned and any new achievements. */
export function recordGame(r: GameResult, extras: RecordExtras = {}): { xp: number; unlocked: string[] } {
  const xp = xpFor(r)
  let unlocked: string[] = []
  updateProfile((p) => {
    const seen = [...new Set([...(extras.seenIds ?? []), ...p.seen])].slice(0, 1500)
    const next: Profile = {
      ...p,
      xp: p.xp + xp,
      games: p.games + 1,
      roomGames: p.roomGames + (r.room ? 1 : 0),
      roomWins: p.roomWins + (r.room && r.won ? 1 : 0),
      tournamentWins: p.tournamentWins + (extras.tournamentWin ? 1 : 0),
      correct: p.correct + r.correct,
      answered: p.answered + r.total,
      bestStreak: Math.max(p.bestStreak, extras.streak ?? 0),
      perfectGames: p.perfectGames + (r.total >= 5 && r.correct === r.total ? 1 : 0),
      scratchUnder10: p.scratchUnder10 + (extras.scratchUnder10 ?? 0),
      whoFirstClue: p.whoFirstClue + (extras.whoFirstClue ?? 0),
      history: [r, ...p.history].slice(0, 40),
      seen,
    }
    unlocked = checkAchievements(next).filter((id) => !p.achievements.includes(id))
    next.achievements = [...p.achievements, ...unlocked]
    return next
  })
  return { xp, unlocked }
}

export function reportQuestion(id: string) {
  updateProfile((p) => (p.reported.includes(id) ? p : { ...p, reported: [...p.reported, id] }))
}

export function rememberFriends(list: { name: string; avatar: number; xp: number; won: boolean }[]) {
  updateProfile((p) => {
    const friends = { ...p.friends }
    for (const f of list) {
      if (!f.name || f.name === p.nickname) continue
      const prev = friends[f.name]
      friends[f.name] = { avatar: f.avatar, xp: f.xp, wins: (prev?.wins ?? 0) + (f.won ? 1 : 0), at: Date.now() }
    }
    return { ...p, friends }
  })
}
