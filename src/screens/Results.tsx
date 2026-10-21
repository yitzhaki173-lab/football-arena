import { useEffect } from 'react'
import { randomSeed } from '../data/content'
import { levelName, modeName, topicsName } from '../data/meta'
import { achievementById } from '../game/achievements'
import { fx } from '../game/feedback'
import type { GameOutcome } from '../game/types'
import type { GameConfig } from '../types'
import { useNav } from '../nav'

export function Results({ config, outcome, xp, unlocked }: { config: GameConfig; outcome: GameOutcome; xp: number; unlocked: string[] }) {
  const nav = useNav()
  const pct = outcome.total ? Math.round((100 * outcome.correct) / outcome.total) : 0
  useEffect(() => {
    if (pct >= 70) fx.win()
  }, [pct])

  const verdict = pct === 100 ? 'מושלם. אין מה להוסיף' : pct >= 70 ? 'משחק גדול' : pct >= 40 ? 'לא רע, יש על מה לעבוד' : 'יום קשה במגרש'

  return (
    <div className="screen full">
      <div className="spacer" />
      <div className="center col" style={{ alignItems: 'center', gap: 6 }}>
        <div className="muted">
          {modeName(config.mode)} · {topicsName(config.topics)} · {levelName(config.level)}
        </div>
        <div className="big-score">{outcome.score}</div>
        <div style={{ fontWeight: 800, fontSize: 20 }}>{verdict}</div>
      </div>
      <div className="stat-grid">
        <div className="stat">
          <b>
            {outcome.correct}/{outcome.total}
          </b>
          <span>נכונות</span>
        </div>
        <div className="stat">
          <b>{pct}%</b>
          <span>הצלחה</span>
        </div>
        <div className="stat">
          <b>+{xp}</b>
          <span>XP</span>
        </div>
      </div>
      {unlocked.length > 0 && (
        <div className="card col">
          <div className="label" style={{ margin: 0 }}>הישג חדש</div>
          {unlocked.map((id) => {
            const a = achievementById(id)
            if (!a) return null
            return (
              <div key={id} className="ach">
                <div className="ic">{a.icon}</div>
                <div>
                  <div style={{ fontWeight: 700 }}>{a.name}</div>
                  <div className="muted small">{a.desc}</div>
                </div>
              </div>
            )
          })}
        </div>
      )}
      <div className="spacer" />
      <button className="btn primary" onClick={() => nav.replace({ name: 'play', params: { config, seed: randomSeed() } })}>
        שחק שוב
      </button>
      <button className="btn" onClick={() => nav.tab('home')}>
        למסך הבית
      </button>
    </div>
  )
}
