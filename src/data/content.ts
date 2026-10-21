import type { Level, Question, ScratchEntry, TopicId, WhoEntry } from '../types'
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

/**
 * Picks `count` items from the chosen topics at the requested level. If the level runs short,
 * it fills from the neighbouring levels. Items not in `avoid` come first.
 */
export function pickItems<T extends { id: string; topic: TopicId; alt?: TopicId[]; level: Level }>(
  all: T[],
  topics: TopicId[],
  level: Level,
  count: number,
  rand: () => number,
  avoid: Set<string> = new Set(),
): T[] {
  const inTopic = all.filter((x) => !topics.length || topics.includes(x.topic) || !!x.alt?.some((t) => topics.includes(t)))
  const li = LEVEL_ORDER.indexOf(level)
  const byDistance = [...LEVEL_ORDER].sort((a, b) => Math.abs(LEVEL_ORDER.indexOf(a) - li) - Math.abs(LEVEL_ORDER.indexOf(b) - li))
  const out: T[] = []
  for (const lv of byDistance) {
    const pool = shuffle(inTopic.filter((x) => x.level === lv), rand)
    pool.sort((a, b) => Number(avoid.has(a.id)) - Number(avoid.has(b.id)))
    for (const item of pool) {
      if (out.length >= count) break
      out.push(item)
    }
    if (out.length >= count) break
  }
  return out
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
