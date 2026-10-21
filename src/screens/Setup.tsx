import { useState } from 'react'
import { ALL_TOPICS, LEVELS, TOPICS, modeName } from '../data/meta'
import { randomSeed } from '../data/content'
import type { GameConfig, GameMode, Level, TopicId } from '../types'
import { TopBar } from '../components/ui'
import { useNav } from '../nav'

export function defaultConfig(mode: GameMode): GameConfig {
  switch (mode) {
    case 'quick':
      return { mode, topics: ALL_TOPICS, level: 'medium', count: 5, seconds: 10 }
    case 'who':
      return { mode, topics: ALL_TOPICS, level: 'medium', count: 5, seconds: 45 }
    case 'scratch':
      return { mode, topics: ALL_TOPICS, level: 'medium', count: 5, seconds: 60, scratchKind: 'mixed' }
    default:
      return { mode: 'trivia', topics: ALL_TOPICS, level: 'medium', count: 10, seconds: 15 }
  }
}

const TOPIC_ICON: Record<TopicId, string> = { 'ligat-haal': '🇮🇱', ucl: '⭐', top5: '🏟️', national: '🌍' }

/**
 * Several topics can be on at once. From "everything", a tap picks just that
 * topic; after that each tap adds or removes one. At least one stays on.
 */
export function TopicPicker({ value, onChange, compact = false }: { value: TopicId[]; onChange: (t: TopicId[]) => void; compact?: boolean }) {
  const all = value.length === 0 || value.length === ALL_TOPICS.length
  const toggle = (id: TopicId) => {
    if (all) return onChange([id])
    const next = value.includes(id) ? value.filter((x) => x !== id) : [...value, id]
    onChange(next.length ? ALL_TOPICS.filter((x) => next.includes(x)) : value)
  }
  const isOn = (id: TopicId) => all || value.includes(id)

  if (compact)
    return (
      <div className="chips">
        <button className={`chip ${all ? 'on' : ''}`} onClick={() => onChange(ALL_TOPICS)}>
          🎲 הכל
        </button>
        {TOPICS.map((t) => (
          <button key={t.id} className={`chip ${!all && isOn(t.id) ? 'on' : ''}`} onClick={() => toggle(t.id)}>
            {TOPIC_ICON[t.id]} {t.name}
          </button>
        ))}
      </div>
    )

  return (
    <div className="col" style={{ gap: 8 }}>
      <button className={`topic ${all ? 'on' : ''}`} onClick={() => onChange(ALL_TOPICS)}>
        <span className="dot" style={{ background: '#eab30822', border: '1px solid #eab30866' }}>
          🎲
        </span>
        <span className="grow">
          <div style={{ fontWeight: 700 }}>כל הנושאים</div>
          <div className="muted small">שאלות מכל הארבעה</div>
        </span>
      </button>
      {TOPICS.map((t) => (
        <button key={t.id} className={`topic ${!all && isOn(t.id) ? 'on' : ''}`} onClick={() => toggle(t.id)}>
          <span className="dot" style={{ background: `${t.color}22`, border: `1px solid ${t.color}66` }}>
            {TOPIC_ICON[t.id]}
          </span>
          <span className="grow">
            <div style={{ fontWeight: 700 }}>{t.name}</div>
            <div className="muted small">{t.sub}</div>
          </span>
          {!all && isOn(t.id) && <span className="tick">✓</span>}
        </button>
      ))}
    </div>
  )
}

export function ConfigForm({ value, onChange, lockMode = true }: { value: GameConfig; onChange: (c: GameConfig) => void; lockMode?: boolean }) {
  const set = (patch: Partial<GameConfig>) => onChange({ ...value, ...patch })
  const counts = value.mode === 'trivia' ? [5, 10, 15] : value.mode === 'quick' ? [5, 10] : [3, 5, 8]

  return (
    <div className="col" style={{ gap: 16 }}>
      {!lockMode && (
        <div>
          <div className="label">מצב משחק</div>
          <div className="chips">
            {(['trivia', 'quick', 'who', 'scratch'] as GameMode[]).map((m) => (
              <button key={m} className={`chip ${value.mode === m ? 'on' : ''}`} onClick={() => onChange({ ...defaultConfig(m), topics: value.topics, level: value.level })}>
                {modeName(m)}
              </button>
            ))}
          </div>
        </div>
      )}
      <div>
        <div className="label">נושאים · אפשר לסמן כמה</div>
        <TopicPicker value={value.topics} onChange={(topics) => set({ topics })} />
      </div>
      <div>
        <div className="label">רמה</div>
        <div className="chips">
          {LEVELS.map((l) => (
            <button key={l.id} className={`chip ${value.level === l.id ? 'on' : ''}`} onClick={() => set({ level: l.id as Level })}>
              {l.name}
            </button>
          ))}
        </div>
      </div>
      {value.mode === 'scratch' && (
        <div>
          <div className="label">מה מגרדים</div>
          <div className="chips">
            {(
              [
                ['player', 'שחקנים'],
                ['team', 'סמלים'],
                ['mixed', 'מעורב'],
              ] as const
            ).map(([k, n]) => (
              <button key={k} className={`chip ${value.scratchKind === k ? 'on' : ''}`} onClick={() => set({ scratchKind: k })}>
                {n}
              </button>
            ))}
          </div>
        </div>
      )}
      <div>
        <div className="label">{value.mode === 'trivia' || value.mode === 'quick' ? 'כמות שאלות' : 'כמות סבבים'}</div>
        <div className="chips">
          {counts.map((n) => (
            <button key={n} className={`chip ${value.count === n ? 'on' : ''}`} onClick={() => set({ count: n })}>
              {n}
            </button>
          ))}
        </div>
      </div>
      {value.mode === 'trivia' && (
        <div>
          <div className="label">זמן לשאלה</div>
          <div className="chips">
            {[10, 15, 20].map((s) => (
              <button key={s} className={`chip ${value.seconds === s ? 'on' : ''}`} onClick={() => set({ seconds: s })}>
                {s} שניות
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export function Setup({ mode }: { mode: GameMode }) {
  const nav = useNav()
  const [cfg, setCfg] = useState<GameConfig>(() => defaultConfig(mode))
  return (
    <div className="screen full">
      <TopBar title={modeName(mode)} />
      <ConfigForm value={cfg} onChange={setCfg} />
      <div className="spacer" />
      <button className="btn primary" onClick={() => nav.replace({ name: 'play', params: { config: cfg, seed: randomSeed() } })}>
        התחל
      </button>
    </div>
  )
}
