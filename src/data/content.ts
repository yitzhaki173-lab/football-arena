import type { GameConfig, Level, Question, ScratchEntry, TopicId, WhoEntry } from '../types'
import { TOPICS } from './meta'

/**
 * Content lives in /public/content as JSON so it can change on the server
 * without touching the app code. The service worker keeps a copy for offline use.
 */
export interface Content {
  questions: Question[]
  who: WhoEntry[]
  scratch: ScratchEntry[]
}

let cache: Promise<Content> | null = null

async function getJson<T>(path: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(`./content/${path}`, { cache: 'no-cache' })
    if (!res.ok) return fallback
    return (await res.json()) as T
  } catch {
    return fallback
  }
}

export function loadContent(): Promise<Content> {
  if (!cache) {
    cache = (async () => {
      const lists = await Promise.all(TOPICS.map((t) => getJson<Question[]>(`questions-${t.id}.json`, [])))
      const [who, scratch] = await Promise.all([
        getJson<WhoEntry[]>('who.json', []),
        getJson<ScratchEntry[]>('scratch.json', []),
      ])
      return { questions: lists.flat(), who, scratch }
    })()
  }
  return cache
}

const LEVEL_ORDER: Level[] = ['medium', 'hard', 'expert']

/** When each item was last shown on this phone (ms), keyed by id. Missing means never. */
export type SeenMap = Record<string, number>

/**
 * Picks `count` items from the chosen topics, freshest first: items this phone never showed
 * come before anything it did, and of those it did, the ones shown longest ago come first.
 * An unseen item one level away beats a repeat at the requested level; two levels away only
 * after the repeats at the requested level.
 */
export function pickItems<T extends { id: string; topic: TopicId; alt?: TopicId[]; level: Level }>(
  all: T[],
  topics: TopicId[],
  level: Level,
  count: number,
  rand: () => number,
  seen: SeenMap = {},
): T[] {
  const inTopic = all.filter((x) => !topics.length || topics.includes(x.topic) || !!x.alt?.some((t) => topics.includes(t)))
  const li = LEVEL_ORDER.indexOf(level)
  const dist = (x: T) => Math.abs(LEVEL_ORDER.indexOf(x.level) - li)
  // tiers: unseen here, unseen next level, repeats here, unseen two away, repeats next level, repeats two away
  const tier = (x: T) => (seen[x.id] ? [2, 4, 5][dist(x)] : [0, 1, 3][dist(x)])
  return shuffle(inTopic, rand)
    .map((x) => ({ x, t: tier(x), at: seen[x.id] ?? 0 }))
    .sort((a, b) => a.t - b.t || a.at - b.at)
    .slice(0, count)
    .map((e) => e.x)
}

export type Items = { kind: 'q'; list: Question[] } | { kind: 'who'; list: WhoEntry[] } | { kind: 'scratch'; list: ScratchEntry[] }

/** The items for one game. With the same seed and seen-map every phone gets the same list. */
export function selectItems(content: Content, cfg: GameConfig, seed: number, seen?: SeenMap): Items {
  const r = seeded(seed)
  if (cfg.mode === 'who') return { kind: 'who', list: pickItems(content.who, cfg.topics, cfg.level, cfg.count, r, seen) }
  if (cfg.mode === 'scratch') {
    const pool = content.scratch.filter((s) => !cfg.scratchKind || cfg.scratchKind === 'mixed' || s.kind === cfg.scratchKind)
    return { kind: 'scratch', list: pickItems(pool, cfg.topics, cfg.level, cfg.count, r, seen) }
  }
  return { kind: 'q', list: pickItems(content.questions, cfg.topics, cfg.level, cfg.count, r, seen) }
}

export function shuffle<T>(arr: T[], rand: () => number): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** Small seeded PRNG so every phone in a room gets the same order. */
export function seeded(seed: number): () => number {
  let s = seed >>> 0 || 1
  return () => {
    s |= 0
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function randomSeed(): number {
  return Math.floor(Math.random() * 2 ** 31)
}

/** Answers for a question in display order, plus the index of the right one. */
export function arrangeAnswers(q: { a: string; w: string[] }, rand: () => number): { options: string[]; correct: number } {
  const options = shuffle([q.a, ...q.w.slice(0, 5)], rand)
  return { options, correct: options.indexOf(q.a) }
}
