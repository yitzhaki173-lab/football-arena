import { useEffect, useMemo, useRef, useState } from 'react'
import { arrangeAnswers, seeded } from '../../data/content'
import { topicsName } from '../../data/meta'
import { fx } from '../../game/feedback'
import { reportQuestion } from '../../game/profile'
import { normalized, triviaPoints } from '../../game/scoring'
import type { GameProps } from '../../game/types'
import { useCountdown } from '../../game/useCountdown'
import type { Question } from '../../types'
import { Timer, TopBar, toast } from '../../components/ui'

export function Trivia({ config, items, seed, onDone, onProgress, onQuit }: GameProps<Question>) {
  const quick = config.mode === 'quick'
  const msTotal = config.seconds * 1000
  const arranged = useMemo(() => {
    const r = seeded(seed + 7)
    return items.map((q) => arrangeAnswers(q, r))
  }, [items, seed])

  const [i, setI] = useState(0)
  const [chosen, setChosen] = useState<number | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [marks, setMarks] = useState<('ok' | 'no')[]>([])
  const [gained, setGained] = useState(0)
  const stats = useRef({ score: 0, norm: 0, correct: 0, streak: 0, best: 0, ms: 0 })

  const q = items[i]
  const a = arranged[i]

  // the pictures are small, so load them all up front and no question waits on one
  useEffect(() => {
    for (const it of items) if (it.img) new Image().src = it.img
  }, [items])

  const answer = (choice: number | null) => {
    if (revealed) return
    const used = Math.min(msTotal, timer.elapsed())
    const ok = choice === a.correct
    const pts = ok ? triviaPoints(q.level, quick, msTotal - used, msTotal) : 0
    const s = stats.current
    s.score += pts
    s.norm += normalized(pts, config.mode, q.level)
    s.ms += used
    if (ok) {
      s.correct++
      s.streak++
      s.best = Math.max(s.best, s.streak)
      fx.correct()
    } else {
      s.streak = 0
      fx.wrong()
    }
    setChosen(choice)
    setRevealed(true)
    setGained(pts)
    setMarks((m) => [...m, ok ? 'ok' : 'no'])
    onProgress?.({ index: i + 1, score: s.score, norm: s.norm })
  }

  const timer = useCountdown(msTotal, !revealed, i, () => answer(null))

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
        whoFirstClue: 0,
        seenIds: items.map((x) => x.id),
      })
      return
    }
    setI(i + 1)
    setChosen(null)
    setRevealed(false)
  }

  if (!q) return null

  return (
    <div className="screen full">
      <TopBar
        title={`${topicsName(config.topics)} · ${i + 1}/${items.length}`}
        onBack={onQuit}
        right={<div className="badge">{stats.current.score} נק׳</div>}
      />
      <div className="progress-dots">
        {items.map((_, k) => (
          <i key={k} className={marks[k] ?? (k === i ? 'cur' : '')} />
        ))}
      </div>
      {q.img && (
        <div className={`photo q-img ${q.imgKind ?? 'logo'}`}>
          {q.imgKind === 'photo' && <img className="bg" src={q.img} alt="" draggable={false} />}
          <img className="fg" src={q.img} alt="" draggable={false} />
        </div>
      )}
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <div className="question grow">{q.q}</div>
        <Timer msLeft={revealed ? 0 : timer.left} msTotal={msTotal} />
      </div>
      <div className="answers">
        {a.options.map((opt, k) => {
          let cls = 'answer'
          if (revealed) {
            if (k === a.correct) cls += ' correct'
            else if (k === chosen) cls += ' wrong'
            else cls += ' dim'
          }
          return (
            <button key={k} className={cls} onClick={() => answer(k)} disabled={revealed}>
              {opt}
            </button>
          )
        })}
      </div>
      {revealed && (
        <>
          <div className="row">
            <div className="grow" style={{ fontWeight: 800, fontSize: 18 }}>
              {chosen === a.correct ? <span className="points-pop">+{gained}</span> : chosen === null ? 'נגמר הזמן' : 'לא נכון'}
            </div>
            <button
              className="badge"
              onClick={() => {
                reportQuestion(q.id)
                toast('תודה, השאלה סומנה לבדיקה')
              }}
            >
              ⚠️ שאלה שגויה
            </button>
          </div>
          {q.ex && <div className="explain">{q.ex}</div>}
          <div className="spacer" />
          <button className="btn primary" onClick={next}>
            {i + 1 >= items.length ? 'לתוצאות' : 'השאלה הבאה'}
          </button>
        </>
      )}
    </div>
  )
}
