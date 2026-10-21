import { useEffect, useState, type ReactNode } from 'react'
import { useNav } from '../nav'

export function TopBar({ title, onBack, right }: { title: string; onBack?: () => void; right?: ReactNode }) {
  const nav = useNav()
  const showBack = onBack || nav.depth > 1
  return (
    <div className="topbar">
      {showBack && (
        <button className="icon-btn" aria-label="חזרה" onClick={onBack ?? nav.back}>
          {/* RTL: back points right */}
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
        </button>
      )}
      <h1>{title}</h1>
      {right}
    </div>
  )
}

export function Timer({ msLeft, msTotal }: { msLeft: number; msTotal: number }) {
  const r = 24
  const c = 2 * Math.PI * r
  const frac = Math.max(0, msLeft) / msTotal
  const color = frac > 0.5 ? 'var(--good)' : frac > 0.2 ? 'var(--gold)' : 'var(--bad)'
  return (
    <div className="timer" aria-label="טיימר">
      <svg width="56" height="56" viewBox="0 0 56 56">
        <circle cx="28" cy="28" r={r} fill="none" stroke="var(--card-2)" strokeWidth="5" />
        <circle cx="28" cy="28" r={r} fill="none" stroke={color} strokeWidth="5" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - frac)} />
      </svg>
      <b>{Math.ceil(Math.max(0, msLeft) / 1000)}</b>
    </div>
  )
}

export function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return <button className={`switch ${on ? 'on' : ''}`} role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} />
}

let showToastFn: ((t: string) => void) | null = null

export function toast(text: string) {
  showToastFn?.(text)
}

export function ToastHost() {
  const [text, setText] = useState<string | null>(null)
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>
    showToastFn = (s) => {
      setText(s)
      clearTimeout(t)
      t = setTimeout(() => setText(null), 2400)
    }
    return () => {
      showToastFn = null
    }
  }, [])
  return text ? <div className="toast" role="status">{text}</div> : null
}

export function XpBar({ value }: { value: number }) {
  return (
    <div className="xpbar">
      <div style={{ width: `${Math.round(Math.min(1, Math.max(0, value)) * 100)}%` }} />
    </div>
  )
}
