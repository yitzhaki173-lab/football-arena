import { useState } from 'react'
import { AVATARS } from '../data/meta'
import { updateProfile } from '../game/profile'

export function Onboarding({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState('')
  const [avatar, setAvatar] = useState(0)
  const ok = name.trim().length >= 2

  return (
    <div className="screen full">
      <div className="spacer" />
      <div className="center col" style={{ alignItems: 'center' }}>
        <div className="avatar lg">{AVATARS[avatar]}</div>
        <h1 style={{ margin: '8px 0 0', fontSize: 30, fontWeight: 900 }}>Football Arena</h1>
        <p className="muted" style={{ margin: 0 }}>טריוויה וגירוד לאנשים שמבינים כדורגל</p>
      </div>
      <div className="card col">
        <div>
          <div className="label">הכינוי שלך</div>
          <input className="field" value={name} maxLength={16} placeholder="איך יקראו לך בחדר?" onChange={(e) => setName(e.target.value)} autoFocus />
        </div>
        <div>
          <div className="label">אווטאר</div>
          <div className="avatar-pick">
            {AVATARS.map((a, i) => (
              <button key={a} className={i === avatar ? 'on' : ''} onClick={() => setAvatar(i)} aria-label={`אווטאר ${i + 1}`}>
                {a}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="spacer" />
      <button
        className="btn primary"
        disabled={!ok}
        onClick={() => {
          updateProfile((p) => ({ ...p, nickname: name.trim(), avatar }))
          onDone()
        }}
      >
        יאללה, למגרש
      </button>
    </div>
  )
}
