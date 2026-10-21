import { MODES } from '../data/meta'
import { useNav } from '../nav'

const ICONS: Record<string, string> = { trivia: '❓', quick: '⚡', who: '🕵️', scratch: '🖌️' }

export function Games() {
  const nav = useNav()
  return (
    <div className="screen">
      <div className="topbar">
        <h1>משחקים</h1>
      </div>
      <div className="tiles">
        {MODES.map((m) => (
          <button key={m.id} className="tile" onClick={() => nav.go({ name: 'setup', params: { mode: m.id } })}>
            <span className="t-icon">{ICONS[m.id]}</span>
            <div>
              <div className="t-name">{m.name}</div>
              <div className="t-desc">{m.desc}</div>
            </div>
          </button>
        ))}
        <button className="tile accent wide" onClick={() => nav.go({ name: 'room-create', params: { tournament: true } })}>
          <span className="t-icon">🏆</span>
          <div>
            <div className="t-name">טורניר</div>
            <div className="t-desc">כל סבב במצב אחר. המקום האחרון יוצא, עד גמר של שניים</div>
          </div>
        </button>
        <button className="tile wide" onClick={() => nav.go({ name: 'room-create', params: { duel: true } })}>
          <span className="t-icon">🤝</span>
          <div>
            <div className="t-name">ראש בראש</div>
            <div className="t-desc">אותן שאלות לשניכם, בזמן אמת או בקישור</div>
          </div>
        </button>
      </div>
    </div>
  )
}
