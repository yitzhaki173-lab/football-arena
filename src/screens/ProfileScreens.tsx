import { useState } from 'react'
import { AVATARS, modeName, topicsName } from '../data/meta'
import { ACHIEVEMENTS } from '../game/achievements'
import { rankOf, resetProfile, updateProfile, useProfile } from '../game/profile'
import { useNav } from '../nav'
import { Switch, TopBar, XpBar, toast } from '../components/ui'

export function Profile() {
  const p = useProfile()
  const nav = useNav()
  const rank = rankOf(p.xp)
  const unlocked = new Set(p.achievements)
  return (
    <div className="screen">
      <div className="topbar">
        <h1>פרופיל</h1>
        <button className="icon-btn" aria-label="הגדרות" onClick={() => nav.go({ name: 'settings' })}>
          ⚙️
        </button>
      </div>
      <div className="card col" style={{ alignItems: 'center', textAlign: 'center' }}>
        <div className="avatar lg">{AVATARS[p.avatar]}</div>
        <div style={{ fontWeight: 900, fontSize: 22 }}>{p.nickname}</div>
        <div className="muted">
          רמה {rank.level} · {rank.name} · {p.xp.toLocaleString('he-IL')} XP
        </div>
        <div style={{ width: '100%' }}>
          <XpBar value={rank.progress} />
        </div>
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
          <b>{p.bestStreak}</b>
          <span>רצף שיא</span>
        </div>
        <div className="stat">
          <b>{p.roomWins}</b>
          <span>ניצחונות בחדר</span>
        </div>
        <div className="stat">
          <b>{p.tournamentWins}</b>
          <span>גביעים</span>
        </div>
        <div className="stat">
          <b>{p.perfectGames}</b>
          <span>משחקים מושלמים</span>
        </div>
      </div>
      <button className="card row" style={{ textAlign: 'right' }} onClick={() => nav.go({ name: 'achievements' })}>
        <div className="grow">
          <div style={{ fontWeight: 700 }}>הישגים</div>
          <div className="muted small">
            {unlocked.size} מתוך {ACHIEVEMENTS.length}
          </div>
        </div>
        <div style={{ fontSize: 22 }}>{ACHIEVEMENTS.filter((a) => unlocked.has(a.id)).slice(-4).map((a) => a.icon).join(' ') || '🔒'}</div>
      </button>
      <div className="label">היסטוריית משחקים</div>
      {p.history.length === 0 ? (
        <div className="empty">עוד לא שיחקת. יאללה, למגרש.</div>
      ) : (
        <div className="list">
          {p.history.slice(0, 15).map((h, k) => (
            <div key={k} className="list-row">
              <div className="grow">
                <div style={{ fontWeight: 700 }}>
                  {modeName(h.mode)} · {topicsName(h.topics)} {h.room ? '· חדר' : ''}
                </div>
                <div className="muted small">
                  {new Date(h.at).toLocaleDateString('he-IL')} · {h.correct}/{h.total} נכונות {h.won ? '· ניצחון 🏆' : ''}
                </div>
              </div>
              <b>{h.score}</b>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function Achievements() {
  const p = useProfile()
  const unlocked = new Set(p.achievements)
  return (
    <div className="screen full">
      <TopBar title="הישגים" />
      <div className="list">
        {ACHIEVEMENTS.map((a) => {
          const prog = a.progress?.(p)
          return (
            <div key={a.id} className={`list-row ach ${unlocked.has(a.id) ? '' : 'locked'}`}>
              <div className="ic">{a.icon}</div>
              <div className="grow">
                <div style={{ fontWeight: 700 }}>{a.name}</div>
                <div className="muted small">{a.desc}</div>
                {prog && !unlocked.has(a.id) && (
                  <div style={{ marginTop: 6 }}>
                    <XpBar value={prog[0] / prog[1]} />
                  </div>
                )}
              </div>
              {unlocked.has(a.id) && <span>✅</span>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function Settings() {
  const p = useProfile()
  const nav = useNav()
  const [name, setName] = useState(p.nickname)
  const [confirm, setConfirm] = useState(false)
  const set = (patch: Partial<typeof p.settings>) => updateProfile((x) => ({ ...x, settings: { ...x.settings, ...patch } }))
  return (
    <div className="screen full">
      <TopBar title="הגדרות" />
      <div className="card col">
        <div className="label" style={{ margin: 0 }}>כינוי ואווטאר</div>
        <input className="field" value={name} maxLength={16} onChange={(e) => setName(e.target.value)} onBlur={() => name.trim().length >= 2 && updateProfile((x) => ({ ...x, nickname: name.trim() }))} />
        <div className="avatar-pick">
          {AVATARS.map((a, i) => (
            <button key={a} className={i === p.avatar ? 'on' : ''} onClick={() => updateProfile((x) => ({ ...x, avatar: i }))}>
              {a}
            </button>
          ))}
        </div>
      </div>
      <div className="card col">
        <div className="row">
          <div className="grow">צלילים</div>
          <Switch label="צלילים" on={p.settings.sound} onChange={(v) => set({ sound: v })} />
        </div>
        <div className="row">
          <div className="grow">רטט</div>
          <Switch label="רטט" on={p.settings.vibrate} onChange={(v) => set({ vibrate: v })} />
        </div>
      </div>
      <div className="card col">
        <div className="muted small">ההתקדמות נשמרת רק בטלפון הזה. איפוס מוחק XP, הישגים והיסטוריה.</div>
        {!confirm ? (
          <button className="btn danger" onClick={() => setConfirm(true)}>
            איפוס התקדמות
          </button>
        ) : (
          <div className="row">
            <button
              className="btn danger grow"
              onClick={() => {
                resetProfile()
                toast('ההתקדמות אופסה')
                nav.tab('home')
              }}
            >
              כן, למחוק הכל
            </button>
            <button className="btn grow" onClick={() => setConfirm(false)}>
              ביטול
            </button>
          </div>
        )}
      </div>
      <div className="center muted small">Football Arena · גרסה {__APP_VERSION__}</div>
    </div>
  )
}

export function Rankings() {
  const p = useProfile()
  const rows = [
    { name: p.nickname, avatar: p.avatar, xp: p.xp, wins: p.roomWins + p.tournamentWins, me: true },
    ...Object.entries(p.friends).map(([name, f]) => ({ name, avatar: f.avatar, xp: f.xp, wins: f.wins, me: false })),
  ].sort((a, b) => b.xp - a.xp || b.wins - a.wins)
  return (
    <div className="screen">
      <div className="topbar">
        <h1>דירוג החברים</h1>
      </div>
      <div className="muted small">לפי XP. מתעדכן בכל פעם שמשחקים יחד בחדר.</div>
      <div className="list">
        {rows.map((r, k) => (
          <div key={r.name} className={`list-row ${r.me ? 'me' : ''}`}>
            <div className="pos">{k + 1}</div>
            <div className="avatar" style={{ width: 40, height: 40, fontSize: 22 }}>
              {AVATARS[r.avatar] ?? '⚽'}
            </div>
            <div className="grow">
              <div style={{ fontWeight: 700 }}>
                {r.name} {r.me ? '(אתה)' : ''}
              </div>
              <div className="muted small">{r.wins} ניצחונות</div>
            </div>
            <b>{r.xp.toLocaleString('he-IL')}</b>
          </div>
        ))}
      </div>
      {rows.length === 1 && <div className="empty">שחקו יחד בחדר, והחברים יופיעו כאן.</div>}
    </div>
  )
}
