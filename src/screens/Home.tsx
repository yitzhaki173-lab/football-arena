import { AVATARS, modeName, topicsName } from '../data/meta'
import { rankOf, useProfile } from '../game/profile'
import { useNav } from '../nav'
import { XpBar } from '../components/ui'

export function Home() {
  const p = useProfile()
  const nav = useNav()
  const rank = rankOf(p.xp)
  const last = p.history[0]

  return (
    <div className="screen">
      <div className="card hero col">
        <div className="row">
          <div className="avatar">{AVATARS[p.avatar]}</div>
          <div className="grow">
            <div style={{ fontWeight: 800, fontSize: 19 }}>{p.nickname}</div>
            <div className="muted small">
              רמה {rank.level} · {rank.name}
            </div>
          </div>
          <div className="badge">{p.xp.toLocaleString('he-IL')} XP</div>
        </div>
        <XpBar value={rank.progress} />
        <div className="muted small">{rank.next ? `עוד ${(rank.next.xp - p.xp).toLocaleString('he-IL')} XP לדרגת ${rank.next.name}` : 'הגעת לפסגה'}</div>
      </div>

      <div className="tiles">
        <button className="tile accent wide" onClick={() => nav.go({ name: 'room-create', params: { tournament: true } })}>
          <span className="t-icon">🏆</span>
          <div>
            <div className="t-name">טורניר עם החבר׳ה</div>
            <div className="t-desc">עד 5 שחקנים, סבבים בהדחה עד הגמר</div>
          </div>
        </button>
        <button className="tile" onClick={() => nav.go({ name: 'room-create' })}>
          <span className="t-icon">🏟️</span>
          <div>
            <div className="t-name">פתח חדר</div>
            <div className="t-desc">קוד לחברים ומשחק משותף</div>
          </div>
        </button>
        <button className="tile" onClick={() => nav.go({ name: 'room-join' })}>
          <span className="t-icon">🔑</span>
          <div>
            <div className="t-name">הצטרף לחדר</div>
            <div className="t-desc">יש לך קוד? תיכנס</div>
          </div>
        </button>
        <button className="tile" onClick={() => nav.go({ name: 'setup', params: { mode: 'quick' } })}>
          <span className="t-icon">⚡</span>
          <div>
            <div className="t-name">משחק מהיר</div>
            <div className="t-desc">5 שאלות, בונוס על מהירות</div>
          </div>
        </button>
        <button className="tile" onClick={() => nav.go({ name: 'setup', params: { mode: 'scratch' } })}>
          <span className="t-icon">🖌️</span>
          <div>
            <div className="t-name">גרד וגלה</div>
            <div className="t-desc">כמה צריך לגרד כדי לזהות?</div>
          </div>
        </button>
      </div>

      <div className="stat-grid">
        <div className="stat">
          <b>{p.games}</b>
          <span>משחקים</span>
        </div>
        <div className="stat">
          <b>{p.answered ? Math.round((100 * p.correct) / p.answered) : 0}%</b>
          <span>הצלחה</span>
        </div>
        <div className="stat">
          <b>{p.roomWins + p.tournamentWins}</b>
          <span>ניצחונות</span>
        </div>
      </div>

      {last && (
        <div className="card row">
          <div className="grow">
            <div className="label" style={{ margin: 0 }}>משחק אחרון</div>
            <div style={{ fontWeight: 700 }}>
              {modeName(last.mode)} · {topicsName(last.topics)}
            </div>
          </div>
          <div className="points-pop" style={{ fontSize: 22 }}>{last.score}</div>
        </div>
      )}
    </div>
  )
}
