import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { seeded, shuffle } from '../../data/content'
import { ScratchCanvas } from '../../components/ScratchCanvas'
import { fx } from '../../game/feedback'
import { reportQuestion } from '../../game/profile'
import { normalized, scratchPoints } from '../../game/scoring'
import type { GameProps } from '../../game/types'
import { useCountdown } from '../../game/useCountdown'
import type { Level, ScratchEntry } from '../../types'
import { Timer, TopBar, XpBar, toast } from '../../components/ui'

const HEB = 'אבגדהוזחטיכלמנסעפצקרשת'
const isLetter = (ch: string) => /[א-תA-Za-z0-9]/.test(ch)

interface Slot {
  ch: string
  word: number
  fixed: boolean
  /** index into the pool, or -1 */
  tile: number
  hint: boolean
}

interface Puzzle {
  slots: Slot[]
  pool: string[]
}

const DECOYS: Record<Level, number> = { medium: 4, hard: 6, expert: 8 }
const BRUSH: Record<Level, number> = { medium: 0.075, hard: 0.055, expert: 0.04 }

function buildPuzzle(name: string, level: Level, rand: () => number): Puzzle {
  const slots: Slot[] = []
  let word = 0
  for (const ch of name) {
    if (ch === ' ') {
      word++
      continue
    }
    slots.push({ ch, word, fixed: !isLetter(ch), tile: -1, hint: false })
  }
  const letters = slots.filter((s) => !s.fixed).map((s) => s.ch)
  const room = Math.max(0, 21 - letters.length)
  const decoys = Array.from({ length: Math.min(DECOYS[level], room) }, () => HEB[Math.floor(rand() * HEB.length)])
  return { slots, pool: shuffle([...letters, ...decoys], rand) }
}

/** Image framing per level: closer crop and black-and-white make it harder. */
function framing(level: Level, rand: () => number): CSSProperties {
  if (level === 'medium') return {}
  const scale = level === 'hard' ? 1.3 : 1.55
  const ox = 30 + rand() * 40
  const oy = 25 + rand() * 40
  return { transform: `scale(${scale})`, transformOrigin: `${ox}% ${oy}%`, filter: level === 'expert' ? 'grayscale(1) contrast(1.1)' : undefined }
}

export function Scratch({ config, items, seed, onDone, onProgress, onQuit }: GameProps<ScratchEntry>) {
  const msTotal = config.seconds * 1000
  const puzzles = useMemo(() => {
    const r = seeded(seed + 23)
    return items.map((e) => ({ puzzle: buildPuzzle(e.name, e.level, r), frame: framing(e.level, r) }))
  }, [items, seed])

  const [i, setI] = useState(0)
  const [slots, setSlots] = useState<Slot[]>(() => puzzles[0]?.puzzle.slots ?? [])
  const [pct, setPct] = useState(0)
  const [helps, setHelps] = useState(0)
  const [done, setDone] = useState<null | 'ok' | 'skip' | 'time'>(null)
  const [shake, setShake] = useState(false)
  const [gained, setGained] = useState(0)
  const stats = useRef({ score: 0, norm: 0, correct: 0, streak: 0, best: 0, ms: 0, under10: 0 })

  const e = items[i]
  const pz = puzzles[i]
  const pool = pz?.puzzle.pool ?? []
  const used = new Set(slots.filter((s) => s.tile >= 0).map((s) => s.tile))

  const finish = (kind: 'ok' | 'skip' | 'time') => {
    if (done) return
    const s = stats.current
    const pts = kind === 'ok' ? scratchPoints(pct, helps) : 0
    s.score += pts
    s.norm += normalized(pts, 'scratch', e.level)
    s.ms += Math.min(msTotal, timer.elapsed())
    if (kind === 'ok') {
      s.correct++
      s.streak++
      s.best = Math.max(s.best, s.streak)
      if (pct < 10) s.under10++
      fx.correct()
    } else {
      s.streak = 0
      if (kind === 'time') fx.wrong()
    }
    setGained(pts)
    setDone(kind)
    onProgress?.({ index: i + 1, score: s.score, norm: s.norm })
  }

  const timer = useCountdown(msTotal, !done, i, () => finish('time'))

  useEffect(() => {
    const next = items[i + 1]?.img
    if (next) new Image().src = next
  }, [items, i])

  const check = (next: Slot[]) => {
    const open = next.filter((s) => !s.fixed)
    if (open.some((s) => s.tile < 0)) return
    const guess = open.map((s) => pool[s.tile]).join('')
    const truth = open.map((s) => s.ch).join('')
    if (guess === truth) finish('ok')
    else {
      fx.wrong()
      setShake(true)
      setTimeout(() => setShake(false), 400)
    }
  }

  const tapTile = (t: number) => {
    if (done || used.has(t)) return
    const k = slots.findIndex((s) => !s.fixed && s.tile < 0)
    if (k < 0) return
    fx.tap()
    const next = slots.map((s, j) => (j === k ? { ...s, tile: t } : s))
    setSlots(next)
    check(next)
  }

  const tapSlot = (k: number) => {
    const s = slots[k]
    if (done || s.fixed || s.hint || s.tile < 0) return
    setSlots(slots.map((x, j) => (j === k ? { ...x, tile: -1 } : x)))
  }

  const help = () => {
    if (done) return
    // the first slot that is empty or holds a wrong letter
    const k = slots.findIndex((s) => !s.fixed && !s.hint && (s.tile < 0 || pool[s.tile] !== s.ch))
    if (k < 0) return
    const ch = slots[k].ch
    // free a tile with that letter: prefer an unused one, else take it from a wrong slot
    const taken = new Set(slots.filter((s, j) => j !== k && s.tile >= 0).map((s) => s.tile))
    let t = pool.findIndex((c, j) => c === ch && !taken.has(j))
    let next = slots.map((s) => ({ ...s }))
    if (t < 0) {
      const from = next.findIndex((s, j) => j !== k && !s.hint && s.tile >= 0 && pool[s.tile] === ch && s.ch !== ch)
      if (from >= 0) {
        t = next[from].tile
        next[from].tile = -1
      }
    }
    if (t < 0) return
    next = next.map((s, j) => (j === k ? { ...s, tile: t, hint: true } : s))
    setHelps(helps + 1)
    setSlots(next)
    check(next)
  }

  const nextItem = () => {
    if (i + 1 >= items.length) {
      const s = stats.current
      onDone({
        score: s.score,
        norm: s.norm,
        correct: s.correct,
        total: items.length,
        bestStreak: s.best,
        ms: s.ms,
        scratchUnder10: s.under10,
        whoFirstClue: 0,
        seenIds: items.map((x) => x.id),
      })
      return
    }
    setI(i + 1)
    setSlots(puzzles[i + 1].puzzle.slots)
    setHelps(0)
    setPct(0)
    setDone(null)
  }

  if (!e) return null
  const words: { slot: Slot; k: number }[][] = []
  slots.forEach((s, k) => {
    ;(words[s.word] ??= []).push({ slot: s, k })
  })
  const worth = scratchPoints(pct, helps)

  return (
    <div className="screen full">
      <TopBar title={`גרד וגלה · ${i + 1}/${items.length}`} onBack={onQuit} right={<div className="badge">{stats.current.score} נק׳</div>} />
      <div className={`scratch-wrap${!done && e.level === 'expert' ? ' gray' : ''}`}>
        <img className="bg" src={e.img} alt="" draggable={false} />
        <img className="fg" src={e.img} alt="" draggable={false} style={done ? { transition: 'transform .6s, filter .6s' } : pz.frame} />
        <ScratchCanvas brush={BRUSH[e.level]} onReveal={setPct} disabled={!!done} cleared={!!done} resetKey={i} />
      </div>
      <div className="row">
        <div className="reveal-meter grow">
          <span>{Math.round(pct)}%</span>
          <XpBar value={pct / 100} />
          <span className="small muted">{done ? '' : `שווה ${worth}`}</span>
        </div>
        <Timer msLeft={done ? 0 : timer.left} msTotal={msTotal} />
      </div>

      <div className={`slots ${shake ? 'shake' : ''}`}>
        {words.map((w, wi) => (
          <div className="word" key={wi}>
            {w.map(({ slot, k }) => (
              <button key={k} className={`slot ${slot.tile >= 0 || slot.fixed ? 'filled' : ''} ${slot.hint ? 'hint' : ''}`} onClick={() => tapSlot(k)}>
                {done && done !== 'ok' ? slot.ch : slot.fixed ? slot.ch : slot.tile >= 0 ? pool[slot.tile] : ''}
              </button>
            ))}
          </div>
        ))}
      </div>

      {!done ? (
        <>
          <div className="pool">
            {pool.map((c, t) => (
              <button key={t} className={`tile-letter ${used.has(t) ? 'used' : ''}`} onClick={() => tapTile(t)}>
                {c}
              </button>
            ))}
          </div>
          <div className="row">
            <button className="btn grow" onClick={help}>
              💡 עזרה (−15%)
            </button>
            <button className="btn ghost grow" onClick={() => finish('skip')}>
              דלג
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="row">
            <div className="grow" style={{ fontWeight: 800, fontSize: 18 }}>
              {done === 'ok' ? <span className="points-pop">+{gained}</span> : done === 'time' ? 'נגמר הזמן' : 'דילגת'}
              <div className="muted small" style={{ fontWeight: 600 }}>{e.name}</div>
            </div>
            <button
              className="badge"
              onClick={() => {
                reportQuestion(e.id)
                toast('תודה, סומן לבדיקה')
              }}
            >
              ⚠️ שגוי
            </button>
          </div>
          <button className="btn primary" onClick={nextItem}>
            {i + 1 >= items.length ? 'לתוצאות' : 'התמונה הבאה'}
          </button>
        </>
      )}
    </div>
  )
}
