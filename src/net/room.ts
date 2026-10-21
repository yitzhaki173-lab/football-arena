import { randomSeed } from '../data/content'
import { getProfile } from '../game/profile'
import type { GameConfig, GameMode, Level, TopicId } from '../types'
import { createFirebaseTransport, markLeaveOnDisconnect, type FirebaseWebConfig } from './firebase'
import { LocalTransport } from './local'
import { MAX_PLAYERS, type RoomKind, type RoomPlayer, type RoomState, type RoomTransport } from './types'

const PID_KEY = 'fa.pid'

export function myId(): string {
  try {
    // with local rooms every tab is its own player, so one browser can test a whole room
    const store = useLocalRooms() ? sessionStorage : localStorage
    let id = store.getItem(PID_KEY)
    if (!id) {
      id = Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)
      store.setItem(PID_KEY, id)
    }
    return id
  } catch {
    return 'guest'
  }
}

let transport: Promise<RoomTransport | null> | null = null
let fbConfig: FirebaseWebConfig | null = null

export function useLocalRooms(): boolean {
  return new URLSearchParams(location.search).has('local')
}

/** Firebase settings live in a JSON file next to the app, so they can change without a rebuild. */
export function getTransport(): Promise<RoomTransport | null> {
  if (!transport) {
    transport = (async () => {
      if (useLocalRooms()) return new LocalTransport()
      try {
        const res = await fetch('./firebase-config.json', { cache: 'no-cache' })
        if (!res.ok) return null
        fbConfig = (await res.json()) as FirebaseWebConfig
        if (!fbConfig?.databaseURL) return null
        return await createFirebaseTransport(fbConfig)
      } catch {
        return null
      }
    })()
  }
  return transport
}

export async function watchDisconnect(code: string) {
  if (fbConfig) await markLeaveOnDisconnect(fbConfig, code, myId())
}

function newPlayer(): RoomPlayer {
  const p = getProfile()
  const now = Date.now()
  return { id: myId(), name: p.nickname, avatar: p.avatar, xp: p.xp, joinedAt: now, last: now, progress: 0, score: 0, norm: 0, correct: 0, ms: 0, done: false, total: 0 }
}

function newCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000))
}

export const TOURNAMENT_MODES: GameMode[] = ['trivia', 'who', 'scratch', 'quick']

/**
 * Round plan for a tournament: one player out per round until a final of two.
 * The final is trivia when it was picked; the rounds before it rotate through the
 * other picked games from a random start, so with few players every game still gets its turn.
 */
export function tournamentPlan(players: number, topics: TopicId[], level: Level, hasScratch: boolean, modes = TOURNAMENT_MODES): GameConfig[] {
  const rounds = Math.max(1, players - 1)
  let picked = TOURNAMENT_MODES.filter((m) => modes.includes(m) && (m !== 'scratch' || hasScratch))
  if (!picked.length) picked = ['trivia']
  const final: GameMode = picked.includes('trivia') ? 'trivia' : picked[picked.length - 1]
  const others = picked.length > 1 ? picked.filter((m) => m !== final) : picked
  const start = Math.floor(Math.random() * others.length)
  const plan: GameConfig[] = []
  for (let r = 0; r < rounds; r++) {
    const isFinal = r === rounds - 1
    const mode = isFinal ? final : others[(start + r) % others.length]
    const base: GameConfig =
      mode === 'who'
        ? { mode, topics, level, count: 3, seconds: 45 }
        : mode === 'scratch'
          ? { mode, topics, level, count: 3, seconds: 60, scratchKind: 'mixed' }
          : mode === 'quick'
            ? { mode, topics, level, count: 5, seconds: 10 }
            : { mode, topics, level: isFinal && level !== 'expert' ? 'hard' : level, count: isFinal ? 7 : 5, seconds: 15 }
    plan.push(base)
  }
  return plan
}

export async function createRoom(kind: RoomKind, config: GameConfig): Promise<string> {
  const t = await getTransport()
  if (!t) throw new Error('no-transport')
  let code = newCode()
  for (let i = 0; i < 5 && (await t.get(code)); i++) code = newCode()
  const me = newPlayer()
  const room: RoomState = {
    code,
    kind,
    host: me.id,
    createdAt: Date.now(),
    status: kind === 'challenge' ? 'playing' : 'lobby',
    round: kind === 'challenge' ? 1 : 0,
    seed: randomSeed(),
    config,
    players: { [me.id]: me },
    custom: null,
    customBy: null,
  }
  await t.create(room)
  return code
}

export type JoinResult = 'ok' | 'notfound' | 'full' | 'started' | 'offline'

export async function joinRoom(code: string): Promise<JoinResult> {
  const t = await getTransport()
  if (!t) return 'offline'
  const room = await t.get(code)
  if (!room) return 'notfound'
  const id = myId()
  const players = room.players ?? {}
  if (players[id]) {
    await t.patch(code, { [`players/${id}/left`]: null, [`players/${id}/last`]: Date.now() })
    return 'ok'
  }
  const cap = room.kind === 'duel' || room.kind === 'challenge' ? 2 : MAX_PLAYERS
  if (Object.values(players).filter((p) => !p.left).length >= cap) return 'full'
  if (room.status !== 'lobby' && room.kind !== 'challenge') return 'started'
  await t.patch(code, { [`players/${id}`]: newPlayer() })
  return 'ok'
}

export function activePlayers(room: RoomState): RoomPlayer[] {
  return Object.values(room.players ?? {})
    .filter((p) => !p.left)
    .sort((a, b) => a.joinedAt - b.joinedAt)
}

export function contenders(room: RoomState): RoomPlayer[] {
  return activePlayers(room).filter((p) => !p.out && !p.spectator)
}

/**
 * The phone that moves the room forward: the creator while connected,
 * otherwise the earliest player still around.
 */
export function effectiveHost(room: RoomState, now = Date.now()): string | null {
  const fresh = (p: RoomPlayer) => !p.left && now - (p.last ?? 0) < 20000
  const host = room.players?.[room.host]
  if (host && fresh(host)) return host.id
  const next = activePlayers(room).find(fresh)
  return next?.id ?? null
}

function resetRoundFields(room: RoomState, spectator: string | null): Record<string, unknown> {
  const u: Record<string, unknown> = {}
  for (const p of Object.values(room.players ?? {})) {
    u[`players/${p.id}/progress`] = 0
    u[`players/${p.id}/score`] = 0
    u[`players/${p.id}/norm`] = 0
    u[`players/${p.id}/correct`] = 0
    u[`players/${p.id}/ms`] = 0
    u[`players/${p.id}/done`] = false
    u[`players/${p.id}/spectator`] = spectator === p.id ? true : null
  }
  return u
}

export async function startRound(room: RoomState, hasScratch: boolean) {
  const t = (await getTransport())!
  const round = room.round + 1
  let config = room.config
  let plan = room.plan
  if (room.kind === 'tournament') {
    if (!plan || room.round === 0) plan = tournamentPlan(activePlayers(room).length, room.config.topics, room.config.level, hasScratch, room.config.modes)
    config = plan[Math.min(round - 1, plan.length - 1)]
  }
  const useCustom = !!room.custom && config.mode === 'scratch'
  await t.patch(room.code, {
    ...resetRoundFields(room, useCustom ? (room.customBy ?? null) : null),
    status: 'playing',
    round,
    seed: randomSeed(),
    config,
    plan: plan ?? null,
  })
}

export async function reportProgress(code: string, p: { index: number; score: number; norm: number }) {
  const t = await getTransport()
  const id = myId()
  await t?.patch(code, { [`players/${id}/progress`]: p.index, [`players/${id}/score`]: p.score, [`players/${id}/norm`]: p.norm, [`players/${id}/last`]: Date.now() })
}

export async function reportDone(code: string, o: { score: number; norm: number; correct: number; ms: number }) {
  const t = await getTransport()
  const id = myId()
  await t?.patch(code, {
    [`players/${id}/score`]: o.score,
    [`players/${id}/norm`]: o.norm,
    [`players/${id}/correct`]: o.correct,
    [`players/${id}/ms`]: Math.round(o.ms),
    [`players/${id}/done`]: true,
    [`players/${id}/last`]: Date.now(),
  })
}

export async function heartbeat(code: string) {
  const t = await getTransport()
  const id = myId()
  await t?.patch(code, { [`players/${id}/last`]: Date.now(), [`players/${id}/left`]: null })
}

export async function leaveRoom(code: string) {
  const t = await getTransport()
  await t?.patch(code, { [`players/${myId()}/left`]: true })
}

/** Higher normalized score wins; on a tie, less time. */
export function rankRound(players: RoomPlayer[]): RoomPlayer[] {
  return [...players].sort((a, b) => b.norm - a.norm || a.ms - b.ms)
}

/** Called by the effective host whenever the room changes during a round. */
export async function maybeEndRound(room: RoomState) {
  if (room.status !== 'playing') return
  const playing = contenders(room)
  const need = room.kind === 'challenge' ? 2 : 1
  if (playing.length < need || !playing.every((p) => p.done)) return
  const t = (await getTransport())!
  const ranked = rankRound(playing)
  const rec: Record<string, unknown> = {
    [`history/r${room.round}`]: { round: room.round, mode: room.config.mode, scores: Object.fromEntries(ranked.map((p) => [p.id, p.norm])) },
  }
  for (const p of ranked) rec[`players/${p.id}/total`] = (p.total ?? 0) + p.norm

  if (room.kind === 'tournament') {
    const last = ranked[ranked.length - 1]
    const remaining = ranked.length - 1
    if (ranked.length > 1) {
      rec[`players/${last.id}/out`] = true
      rec[`history/r${room.round}/out`] = last.id
    }
    rec.status = remaining <= 1 ? 'finished' : 'roundEnd'
  } else {
    rec.status = 'finished'
  }
  await t.patch(room.code, rec)
}

export async function setCustomPuzzle(code: string, img: string, name: string) {
  const t = (await getTransport())!
  await t.patch(code, {
    custom: { id: `custom-${Date.now()}`, topic: 'ligat-haal', kind: 'player', level: 'medium', name, img },
    customBy: myId(),
  })
}

export async function clearCustomPuzzle(code: string) {
  const t = (await getTransport())!
  await t.patch(code, { custom: null, customBy: null })
}

export async function updateRoomConfig(code: string, config: GameConfig) {
  const t = (await getTransport())!
  await t.patch(code, { config })
}

export async function backToLobby(room: RoomState) {
  const t = (await getTransport())!
  const u: Record<string, unknown> = { ...resetRoundFields(room, null), status: 'lobby', round: 0, plan: null, history: null }
  for (const p of Object.values(room.players ?? {})) {
    u[`players/${p.id}/out`] = null
    u[`players/${p.id}/total`] = 0
  }
  await t.patch(room.code, u)
}

export function inviteLink(code: string): string {
  const url = new URL(location.href)
  url.search = ''
  url.hash = ''
  url.searchParams.set('join', code)
  if (useLocalRooms()) url.searchParams.set('local', '1')
  return url.toString()
}
