import { useEffect, useMemo, useRef, useState } from 'react'
import { arrangeAnswers, seeded } from '../../data/content'
import { fx } from '../../game/feedback'
import { reportQuestion } from '../../game/profile'
import { normalized, whoPoints } from '../../game/scoring'
import type { GameProps } from '../../game/types'
import { useCountdown } from '../../game/useCountdown'
import type { Level, WhoEntry } from '../../types'
import { Timer, TopBar, toast } from '../../components/ui'

/** Photo blur in px for each clue shown. Expert also stays black and white until the answer. */
const BLUR: Record<Level, number[]> = {
  medium: [14, 9, 5, 2, 0],
  hard: [18, 12, 8, 4, 1],
  expert: [22, 16, 11, 7, 3],
}

export function Who({ config, items, seed, onDone, onProgress, onQuit }: GameProps<WhoEntry>) {
  const msTotal = config.seconds * 1000
  const arranged = useMemo(() => {
    const r = seeded(seed + 11)
    return items.map((e) => arrangeAnswers({ a: e.answer, w: e.w }, r))
  }, [items, seed])

  const [i, setI] = useState(0)
  const [shown, setShown] = useState(1)
  const [chosen, setChosen] = useState<number | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [gained, setGained] = useState(0)
  const stats = useRef({ score: 0, norm: 0, correct: 0, streak: 0, best: 0, ms: 0, first: 0 })

  const e = items[i]
  const a = arranged[i]

  const answer = (choice: number | null) => {
    if (revealed) return
    const ok = choice === a.correct
    const pts = ok ? whoPoints(shown) : 0
    const s = stats.current
    s.score += pts
    s.norm += normalized(pts, 'who', e.level)
    s.ms += Math.min(msTotal, timer.elapsed())
    if (ok) {
      s.correct++
      s.streak++
      s.best = Math.max(s.best, s.streak)
      if (shown === 1) s.first++
      fx.correct()
    } else {
      s.streak = 0
      fx.wrong()
    }
    setChosen(choice)
    setGained(pts)
    setRevealed(true)
    onProgress?.({ index: i + 1, score: s.score, norm: s.norm })
  }

  const timer = useCountdown(msTotal, !revealed, i, () => answer(null))

  // load the next photo while this one is being played
  useEffect(() => {
    const next = items[i + 1]?.img
    if (next) new Image().src = next
  }, [items, i])

  const next = () => {
    if (i + 1 >= items.length) {
      const s = stats.current
      onDone({
        score: s.score,
        norm: s.norm,
        correct: s.correct,
        total: items.length,
        bestStreak: s.best,
        ms: s.ms,
        scratchUnder10: 0,
        whoFirstClue: s.first,
        seenIds: items.map((x) => x.id),
      })
      return
    }
    setI(i + 1)
    setShown(1)
    setChosen(null)
    setRevealed(false)
  }

  if (!e) return null
  const clues = revealed ? e.clues : e.clues.slice(0, shown)
  const blur = revealed ? 'none' : `blur(${BLUR[e.level][shown - 1]}px)${e.level === 'expert' ? ' grayscale(1)' : ''}`

  return (
    <div className="screen full">
      <TopBar title={`מי השחקן · ${i + 1}/${items.length}`} onBack={onQuit} right={<div className="badge">{stats.current.score} נק׳</div>} />
      <div className="row">
        <div className="grow">
          <div style={{ fontWeight: 800, fontSize: 18 }}>שווה עכשיו {whoPoints(shown)} נק׳</div>
          <div className="muted small">רמז {shown} מתוך {e.clues.length}. ניחוש אחד בלבד</div>
        </div>
        <Timer msLeft={revealed ? 0 : timer.left} msTotal={msTotal} />
      </div>
      {e.img && (
        <div className={`photo who-photo${!revealed && e.level === 'expert' ? ' gray' : ''}`}>
          <img className="bg" src={e.img} alt="" draggable={false} />
          <img className="fg" src={e.img} alt="" draggable={false} style={{ filter: blur }} />
        </div>
      )}
      <div className="col" style={{ gap: 8 }}>
        {clues.map((c, k) => (
          <div key={k} className="clue">
            <b>{k + 1}</b>
            {c}
          </div>
        ))}
      </div>
      {!revealed && shown < e.clues.length && (
        <button className="btn" onClick={() => setShown(shown + 1)}>
          רמז נוסף (−100)
        </button>
      )}
      <div className="answers">
        {a.options.map((opt, k) => {
          let cls = 'answer'
          if (revealed) {
            if (k === a.correct) cls += ' correct'
            else if (k === chosen) cls += ' wrong'
            else cls += ' dim'
          }
          return (
            <button key={k} className={cls} disabled={revealed} onClick={() => answer(k)}>
              {opt}
            </button>
          )
        })}
      </div>
      {revealed && (
        <>
          <div className="row">
            <div className="grow" style={{ fontWeight: 800, fontSize: 18 }}>
              {chosen === a.correct ? <span className="points-pop">+{gained}</span> : `התשובה: ${e.answer}`}
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
          <div className="spacer" />
          <button className="btn primary" onClick={next}>
            {i + 1 >= items.length ? 'לתוצאות' : 'הבא'}
          </button>
        </>
      )}
    </div>
  )
}
