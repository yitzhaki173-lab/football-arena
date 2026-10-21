// Merges the hand-written question files in content-src/ into public/content/
// and checks them. Run: node scripts/build-content.mjs
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { createHash } from 'node:crypto'

const SRC = new URL('../content-src/', import.meta.url).pathname
const OUT = new URL('../public/content/', import.meta.url).pathname
const TOPICS = ['ligat-haal', 'ucl', 'top5', 'national']
const LEVEL = { m: 'medium', h: 'hard', e: 'expert' }
const TYPE = { r: 'regular', c: 'chrono', f: 'final', o: 'odd', n: 'number', k: 'coach', s: 'record', p: 'career' }

let errors = 0
const fail = (where, msg) => {
  errors++
  console.error(`✗ ${where}: ${msg}`)
}

function checkAnswers(where, a, w) {
  if (!a || typeof a !== 'string') fail(where, 'missing answer')
  if (!Array.isArray(w) || w.length !== 5) fail(where, `needs 5 wrong answers, has ${w?.length}`)
  const all = [a, ...(w ?? [])].map((s) => String(s).trim())
  if (new Set(all).size !== all.length) fail(where, `duplicate answers: ${all.join(' | ')}`)
}

// Context images for trivia questions, matched by question text (made by scripts/fetch-question-images.py).
// The ?v= hash lets the service worker cache them forever.
const PUBLIC = new URL('../public/', import.meta.url).pathname
const versioned = (src) => `${src}?v=${createHash('sha1').update(readFileSync(join(PUBLIC, src))).digest('hex').slice(0, 8)}`
const qImages = new Map()
if (existsSync(join(SRC, 'q-images.json'))) {
  for (const it of JSON.parse(readFileSync(join(SRC, 'q-images.json'), 'utf8'))) {
    if (!existsSync(join(PUBLIC, it.img))) fail('q-images.json', `missing file ${it.img}`)
    else qImages.set(it.q.replace(/\s+/g, ' ').trim(), { img: versioned(it.img), imgKind: it.imgKind })
  }
}

const summary = {}
const seenQ = new Map()
for (const topic of TOPICS) {
  const files = readdirSync(SRC).filter((f) => f.startsWith(`q-${topic}-`) && f.endsWith('.json')).sort()
  const out = []
  for (const f of files) {
    const list = JSON.parse(readFileSync(join(SRC, f), 'utf8'))
    list.forEach((it, i) => {
      const where = `${f}#${i + 1}`
      if (!LEVEL[it.l]) fail(where, `bad level ${it.l}`)
      if (!TYPE[it.t]) fail(where, `bad type ${it.t}`)
      if (!it.q) fail(where, 'missing question')
      checkAnswers(where, it.a, it.w)
      const norm = it.q.replace(/\s+/g, ' ').trim()
      if (seenQ.has(norm)) fail(where, `same question as ${seenQ.get(norm)}`)
      seenQ.set(norm, where)
      out.push({ id: `${topic}-${String(out.length + 1).padStart(3, '0')}`, topic, level: LEVEL[it.l], type: TYPE[it.t], q: it.q.trim(), a: it.a.trim(), w: it.w.map((s) => s.trim()), ...(it.x ? { ex: it.x.trim() } : {}), ...qImages.get(norm) })
    })
  }
  writeFileSync(join(OUT, `questions-${topic}.json`), JSON.stringify(out))
  summary[topic] = { total: out.length, medium: 0, hard: 0, expert: 0, img: 0 }
  for (const q of out) {
    summary[topic][q.level]++
    if (q.img) summary[topic].img++
  }
}

// who-is-the-player
const who = []
for (const f of readdirSync(SRC).filter((f) => f.startsWith('who-') && f.endsWith('.json')).sort()) {
  const list = JSON.parse(readFileSync(join(SRC, f), 'utf8'))
  list.forEach((it, i) => {
    const where = `${f}#${i + 1}`
    if (!TOPICS.includes(it.topic)) fail(where, `bad topic ${it.topic}`)
    if (!LEVEL[it.l]) fail(where, `bad level ${it.l}`)
    if (!Array.isArray(it.clues) || it.clues.length !== 5) fail(where, 'needs 5 clues')
    checkAnswers(where, it.a, it.w)
    who.push({ id: `who-${String(who.length + 1).padStart(3, '0')}`, topic: it.topic, level: LEVEL[it.l], answer: it.a, clues: it.clues, w: it.w })
  })
}
// scratch pictures: content-src/scratch.json lists files under public/content/scratch/
let scratch = []
const scratchSrc = join(SRC, 'scratch.json')
if (existsSync(scratchSrc)) {
  scratch = JSON.parse(readFileSync(scratchSrc, 'utf8'))
  scratch.forEach((s, i) => {
    const file = join(OUT, s.img.replace(/^\.\/content\//, ''))
    if (!existsSync(file)) fail(`scratch#${i + 1}`, `missing image ${s.img}`)
    if (!/^[א-ת' \-"]+$/.test(s.name)) fail(`scratch#${i + 1}`, `name should be Hebrew letters: ${s.name}`)
  })
}

// player photos: content-src/players.json feeds both "who is the player" and scratch.
// Photos come from scripts/build-player-images.py; the ?v= hash makes a changed photo a new URL.
const playersSrc = join(SRC, 'players.json')
if (existsSync(playersSrc)) {
  const players = JSON.parse(readFileSync(playersSrc, 'utf8'))
  const byId = new Map(players.map((p) => [p.id, p]))
  for (const p of players) {
    const where = `players.json ${p.id}`
    const file = join(OUT, 'players', `${p.id}.webp`)
    if (!existsSync(file)) {
      fail(where, `missing photo ${file}`)
      continue
    }
    const img = `./content/players/${p.id}.webp?v=${createHash('sha1').update(readFileSync(file)).digest('hex').slice(0, 8)}`
    // a second photo of a player already listed: scratch only
    const base = p.same ? byId.get(p.same) : p
    if (!base) {
      fail(where, `unknown player ${p.same}`)
      continue
    }
    if (!TOPICS.includes(base.topic)) fail(where, `bad topic ${base.topic}`)
    if ((base.alt ?? []).some((t) => !TOPICS.includes(t) || t === base.topic)) fail(where, `bad alt topics ${base.alt}`)
    if (!LEVEL[base.l]) fail(where, `bad level ${base.l}`)
    if (!/^[א-ת' ]+$/.test(base.scratch ?? '')) fail(where, `scratch name should be Hebrew letters: ${base.scratch}`)
    const common = { topic: base.topic, ...(base.alt?.length ? { alt: base.alt } : {}), level: LEVEL[base.l] }
    if (!p.same) {
      if (!Array.isArray(p.clues) || p.clues.length !== 5) fail(where, 'needs 5 clues')
      checkAnswers(where, p.answer, p.w)
      // no clue may name him
      const parts = p.answer.split(/[\s־-]+/).map((x) => x.replace(/['"״]/g, '')).filter((x) => x.length >= 3)
      for (const c of p.clues ?? []) {
        const plain = c.replace(/['"״]/g, '')
        for (const part of parts) if (plain.includes(part)) fail(where, `clue gives away "${part}": ${c}`)
      }
      who.push({ id: `who-${p.id}`, ...common, answer: p.answer, clues: p.clues, w: p.w, img })
    }
    scratch.push({ id: `scr-${p.id}`, ...common, kind: 'player', name: base.scratch, img })
  }
}
writeFileSync(join(OUT, 'who.json'), JSON.stringify(who))
writeFileSync(join(OUT, 'scratch.json'), JSON.stringify(scratch))

console.table(summary)
console.log(`who: ${who.length}, scratch: ${scratch.length}`)
if (errors) {
  console.error(`${errors} problem(s)`)
  process.exit(1)
}
