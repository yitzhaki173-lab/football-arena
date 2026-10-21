import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { AVATARS, LEVELS, levelName, modeName, topicsName } from '../data/meta'
import { loadContent } from '../data/content'
import { fx } from '../game/feedback'
import { recordGame, rememberFriends, useProfile } from '../game/profile'
import {
  activePlayers,
  backToLobby,
  clearCustomPuzzle,
  contenders,
  createRoom,
  effectiveHost,
  getTransport,
  heartbeat,
  inviteLink,
  joinRoom,
  leaveRoom,
  maybeEndRound,
  myId,
  rankRound,
  reportDone,
  reportProgress,
  setCustomPuzzle,
  startRound,
  updateRoomConfig,
  watchDisconnect,
  type JoinResult,
} from '../net/room'
import type { RoomKind, RoomPlayer, RoomState } from '../net/types'
import type { GameConfig, Level, TopicId } from '../types'
import { useNav } from '../nav'
import { TopBar, toast } from '../components/ui'
import { ConfigForm, TopicPicker, defaultConfig } from './Setup'
import { GameHost } from './Play'

const KIND_NAME: Record<RoomKind, string> = { room: 'חדר', tournament: 'טורניר', duel: 'ראש בראש', challenge: 'אתגר בקישור' }

function useRoomsReady() {
  const [ready, setReady] = useState<boolean | null>(null)
  useEffect(() => {
    getTransport().then((t) => setReady(!!t))
  }, [])
  return ready
}

function NotReady() {
  return (
    <div className="card col">
      <div style={{ fontWeight: 800 }}>החדרים עוד לא מחוברים</div>
      <div className="muted small" style={{ lineHeight: 1.6 }}>
        כדי לשחק בין טלפונים צריך לחבר שרת חינמי (Firebase). ברגע שהוא יחובר, החדרים, הטורנירים והאתגרים יעבדו אצל כולם בלי להתקין כלום מחדש.
      </div>
    </div>
  )
}

export function Friends() {
  const nav = useNav()
  const p = useProfile()
  const ready = useRoomsReady()
  const friends = Object.entries(p.friends).sort((a, b) => b[1].at - a[1].at)
  return (
    <div className="screen">
      <div className="topbar">
        <h1>חברים</h1>
      </div>
      {ready === false && <NotReady />}
      <div className="tiles">
        <button className="tile accent wide" onClick={() => nav.go({ name: 'room-create', params: { tournament: true } })}>
          <span className="t-icon">🏆</span>
          <div>
            <div className="t-name">טורניר</div>
            <div className="t-desc">עד 5 שחקנים בהדחה</div>
          </div>
        </button>
        <button className="tile" onClick={() => nav.go({ name: 'room-create' })}>
          <span className="t-icon">🏟️</span>
          <div>
            <div className="t-name">פתח חדר</div>
            <div className="t-desc">משחק אחד לכולם</div>
          </div>
        </button>
        <button className="tile" onClick={() => nav.go({ name: 'room-join' })}>
          <span className="t-icon">🔑</span>
          <div>
            <div className="t-name">הצטרף בקוד</div>
            <div className="t-desc">6 ספרות מהחבר</div>
          </div>
        </button>
        <button className="tile" onClick={() => nav.go({ name: 'room-create', params: { duel: true } })}>
          <span className="t-icon">🤝</span>
          <div>
            <div className="t-name">ראש בראש</div>
            <div className="t-desc">אחד על אחד בזמן אמת</div>
          </div>
        </button>
        <button className="tile" onClick={() => nav.go({ name: 'room-create', params: { challenge: true } })}>
          <span className="t-icon">🔗</span>
          <div>
            <div className="t-name">אתגר בקישור</div>
            <div className="t-desc">כל אחד משחק מתי שנוח לו</div>
          </div>
        </button>
      </div>
      <div className="label">שיחקת איתם</div>
      {friends.length === 0 ? (
        <div className="empty">עוד אין. החברים יופיעו כאן אחרי משחק משותף בחדר.</div>
      ) : (
        <div className="list">
          {friends.map(([name, f]) => (
            <div key={name} className="list-row">
              <div className="avatar" style={{ width: 40, height: 40, fontSize: 22 }}>
                {AVATARS[f.avatar] ?? '⚽'}
              </div>
              <div className="grow">
                <div style={{ fontWeight: 700 }}>{name}</div>
                <div className="muted small">
                  {f.xp.toLocaleString('he-IL')} XP · {f.wins} ניצחונות
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function RoomCreate({ tournament, duel, challenge }: { tournament?: boolean; duel?: boolean; challenge?: boolean }) {
  const nav = useNav()
  const ready = useRoomsReady()
  const [kind, setKind] = useState<RoomKind>(tournament ? 'tournament' : duel ? 'duel' : challenge ? 'challenge' : 'room')
  const [cfg, setCfg] = useState<GameConfig>(defaultConfig('trivia'))
  const [busy, setBusy] = useState(false)

  const create = async () => {
    setBusy(true)
    try {
      const code = await createRoom(kind, cfg)
      nav.replace({ name: 'room', params: { code } })
    } catch {
      toast('לא הצלחתי לפתוח חדר. בדוק חיבור לאינטרנט')
      setBusy(false)
    }
  }

  return (
    <div className="screen full">
      <TopBar title="משחק עם חברים" />
      {ready === false && <NotReady />}
      <div>
        <div className="label">סוג</div>
        <div className="chips">
          {(Object.keys(KIND_NAME) as RoomKind[]).map((k) => (
            <button key={k} className={`chip ${kind === k ? 'on' : ''}`} onClick={() => setKind(k)}>
              {KIND_NAME[k]}
            </button>
          ))}
        </div>
      </div>
      {kind === 'tournament' ? (
        <TournamentForm topics={cfg.topics} level={cfg.level} onChange={(topics, level) => setCfg({ ...cfg, topics, level })} />
      ) : (
        <ConfigForm value={cfg} onChange={setCfg} lockMode={false} />
      )}
      <div className="spacer" />
      <button className="btn primary" disabled={busy || ready === false} onClick={create}>
        {kind === 'challenge' ? 'שחק ושלח לחבר' : 'פתח חדר'}
      </button>
    </div>
  )
}

function TournamentForm({ topics, level, onChange }: { topics: TopicId[]; level: Level; onChange: (t: TopicId[], l: Level) => void }) {
  return (
    <div className="col" style={{ gap: 14 }}>
      <div className="card muted small" style={{ lineHeight: 1.6 }}>
        כל סבב במצב אחר: טריוויה, מי השחקן, גירוד ומשחק מהיר. בסוף כל סבב המקום האחרון יוצא, עד גמר של שניים בטריוויה. כל סבב שווה אותו דבר, כך שאף מצב לא מכריע לבד.
      </div>
      <div>
        <div className="label">נושאים · אפשר לסמן כמה</div>
        <TopicPicker compact value={topics} onChange={(t) => onChange(t, level)} />
      </div>
      <div>
        <div className="label">רמה</div>
        <div className="chips">
          {LEVELS.map((l) => (
            <button key={l.id} className={`chip ${level === l.id ? 'on' : ''}`} onClick={() => onChange(topics, l.id)}>
              {l.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export function RoomJoin({ code: initial }: { code?: string }) {
  const nav = useNav()
  const [code, setCode] = useState(initial ?? '')
  const [busy, setBusy] = useState(false)
  const msg: Record<Exclude<JoinResult, 'ok'>, string> = {
    notfound: 'לא מצאתי חדר עם הקוד הזה',
    full: 'החדר מלא',
    started: 'המשחק בחדר כבר התחיל',
    offline: 'החדרים עוד לא מחוברים',
  }
  const join = async (c = code) => {
    setBusy(true)
    const r = await joinRoom(c)
    setBusy(false)
    if (r === 'ok') nav.replace({ name: 'room', params: { code: c } })
    else toast(msg[r])
  }
  useEffect(() => {
    if (initial && initial.length === 6) join(initial)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return (
    <div className="screen full">
      <TopBar title="הצטרפות לחדר" />
      <div className="spacer" />
      <div className="card col">
        <div className="label center">קוד החדר</div>
        <input
          className="field code-input"
          inputMode="numeric"
          maxLength={6}
          value={code}
          autoFocus
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, '').slice(0, 6)
            setCode(v)
            if (v.length === 6) join(v)
          }}
        />
      </div>
      <div className="spacer" />
      <button className="btn primary" disabled={code.length !== 6 || busy} onClick={() => join()}>
        הצטרף
      </button>
    </div>
  )
}

/* ---------------- the room itself ---------------- */

export function Room({ code }: { code: string }) {
  const nav = useNav()
  const [room, setRoom] = useState<RoomState | null | undefined>(undefined)
  const [hasScratch, setHasScratch] = useState(false)
  const me = myId()

  useEffect(() => {
    let off = () => {}
    getTransport().then((t) => {
      if (!t) return setRoom(null)
      off = t.subscribe(code, setRoom)
      watchDisconnect(code)
    })
    loadContent().then((c) => setHasScratch(c.scratch.length >= 6))
    heartbeat(code)
    const hb = setInterval(() => heartbeat(code), 5000)
    return () => {
      off()
      clearInterval(hb)
    }
  }, [code])

  // The effective host closes rounds once everyone is done.
  useEffect(() => {
    if (room && effectiveHost(room) === me) maybeEndRound(room)
  }, [room, me])

  if (room === undefined)
    return (
      <div className="splash">
        <div className="ball">⚽</div>
      </div>
    )
  if (room === null)
    return (
      <div className="screen full">
        <TopBar title="החדר לא קיים" />
        <div className="empty">אולי הקוד שגוי, או שהחדר נסגר.</div>
      </div>
    )

  const self = room.players?.[me]
  const quit = async () => {
    await leaveRoom(code)
    nav.tab('home')
  }

  if (room.status === 'lobby') return <Lobby room={room} hasScratch={hasScratch} onQuit={quit} />
  if (room.status === 'playing') {
    if (!self || self.out || self.spectator || self.done) return <Waiting room={room} onQuit={quit} />
    return (
      <GameHost
        key={`${room.round}-${room.seed}`}
        config={room.config}
        seed={room.seed}
        shared
        custom={room.config.mode === 'scratch' ? room.custom : null}
        onProgress={(p) => reportProgress(code, p)}
        onDone={(o) => reportDone(code, o)}
        onQuit={quit}
      />
    )
  }
  if (room.status === 'roundEnd') return <RoundEnd room={room} hasScratch={hasScratch} onQuit={quit} />
  return <Finished room={room} onQuit={quit} />
}

function PlayerRow({ p, room, right, pos }: { p: RoomPlayer; room: RoomState; right?: ReactNode; pos?: number }) {
  const me = myId()
  return (
    <div className={`list-row ${p.id === me ? 'me' : ''} ${p.out ? 'out' : ''}`}>
      {pos !== undefined && <div className="pos">{pos}</div>}
      <div className="avatar" style={{ width: 40, height: 40, fontSize: 22 }}>
        {AVATARS[p.avatar] ?? '⚽'}
      </div>
      <div className="grow">
        <div style={{ fontWeight: 700 }}>
          {p.name} {p.id === room.host ? '👑' : ''} {p.id === me ? '(אתה)' : ''}
        </div>
        <div className="muted small">{p.out ? 'הודח' : p.spectator ? 'כתב את החידה' : `${p.xp.toLocaleString('he-IL')} XP`}</div>
      </div>
      {right}
    </div>
  )
}

async function share(code: string, kind: RoomKind) {
  const link = inviteLink(code)
  const text = kind === 'challenge' ? `אתגרתי אותך ב־Football Arena. בוא נראה מי יודע יותר: ${link}` : `בוא ל־Football Arena. קוד החדר: ${code}\n${link}`
  try {
    if (navigator.share) {
      await navigator.share({ text })
      return
    }
  } catch {
    /* cancelled */
  }
  try {
    await navigator.clipboard.writeText(text)
    toast('הקישור הועתק')
  } catch {
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
  }
}

function Lobby({ room, hasScratch, onQuit }: { room: RoomState; hasScratch: boolean; onQuit: () => void }) {
  const me = myId()
  const isHost = effectiveHost(room) === me
  const players = activePlayers(room)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<GameConfig>(room.config)
  const [puzzleName, setPuzzleName] = useState('')
  const [puzzleImg, setPuzzleImg] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const min = 2

  const pickImage = async (f: File) => {
    const url = await resizeImage(f, 640)
    setPuzzleImg(url)
  }

  return (
    <div className="screen full">
      <TopBar title={KIND_NAME[room.kind]} onBack={onQuit} />
      <div className="card center">
        <div className="label">קוד החדר</div>
        <div className="code">{room.code}</div>
        <button className="btn" style={{ width: '100%' }} onClick={() => share(room.code, room.kind)}>
          📲 שלח לחברים
        </button>
      </div>
      <div className="card col" style={{ gap: 6 }}>
        <div className="row">
          <div className="grow" style={{ fontWeight: 700 }}>
            {room.kind === 'tournament' ? `טורניר · ${topicsName(room.config.topics)} · ${levelName(room.config.level)}` : `${modeName(room.config.mode)} · ${topicsName(room.config.topics)} · ${levelName(room.config.level)}`}
          </div>
          {isHost && room.kind !== 'tournament' && (
            <button className="badge" onClick={() => setEditing(!editing)}>
              {editing ? 'סגור' : 'שנה'}
            </button>
          )}
        </div>
        {room.custom && <div className="muted small">🖼️ חידה אישית מוכנה לסבב הגירוד</div>}
      </div>
      {editing && (
        <div className="card col">
          <ConfigForm value={draft} onChange={setDraft} lockMode={false} />
          <button
            className="btn primary"
            onClick={() => {
              updateRoomConfig(room.code, draft)
              setEditing(false)
            }}
          >
            שמור
          </button>
        </div>
      )}
      <div className="label">
        שחקנים ({players.length}/{room.kind === 'duel' ? 2 : 5})
      </div>
      <div className="list">
        {players.map((p) => (
          <PlayerRow key={p.id} p={p} room={room} />
        ))}
      </div>

      {(room.kind === 'room' || room.kind === 'tournament') && (
        <div className="card col">
          <div style={{ fontWeight: 700 }}>חידת גירוד אישית</div>
          <div className="muted small">בוחרים תמונה מהגלריה וכותבים את התשובה. מי שכתב יושב בחוץ בסבב הזה.</div>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && pickImage(e.target.files[0])} />
          {room.custom && room.customBy === me ? (
            <button className="btn" onClick={() => clearCustomPuzzle(room.code)}>
              הסר את החידה שלי
            </button>
          ) : puzzleImg ? (
            <>
              <img src={puzzleImg} alt="" style={{ width: '100%', borderRadius: 14 }} />
              <input className="field" placeholder="מה התשובה?" value={puzzleName} maxLength={24} onChange={(e) => setPuzzleName(e.target.value)} />
              <button
                className="btn primary"
                disabled={puzzleName.trim().length < 2}
                onClick={() => {
                  setCustomPuzzle(room.code, puzzleImg, puzzleName.trim())
                  setPuzzleImg(null)
                  setPuzzleName('')
                  if (room.kind === 'room' && room.config.mode !== 'scratch' && isHost) updateRoomConfig(room.code, { ...defaultConfig('scratch'), count: 1 })
                  toast('החידה נשמרה')
                }}
              >
                שמור חידה
              </button>
            </>
          ) : (
            <button className="btn" onClick={() => fileRef.current?.click()}>
              🖼️ בחר תמונה
            </button>
          )}
        </div>
      )}

      <div className="spacer" />
      {isHost ? (
        <button className="btn primary" disabled={players.length < min} onClick={() => startRound(room, hasScratch)}>
          {players.length < min ? 'מחכים לחברים…' : 'התחל'}
        </button>
      ) : (
        <div className="center muted">מחכים שהמארח יתחיל…</div>
      )}
    </div>
  )
}

function Waiting({ room, onQuit }: { room: RoomState; onQuit: () => void }) {
  const me = myId()
  const self = room.players?.[me]
  const playing = contenders(room)
  const hidden = room.kind === 'challenge'
  const total = room.config.count
  return (
    <div className="screen full">
      <TopBar title={self?.out ? 'אתה צופה' : self?.spectator ? 'החידה שלך במשחק' : 'סיימת'} onBack={onQuit} />
      <div className="card center col" style={{ alignItems: 'center' }}>
        {self?.done && <div className="big-score">{self.score}</div>}
        <div className="muted">
          {hidden ? 'התוצאות ייחשפו כששניכם תסיימו. שלח לחבר את הקישור אם עוד לא שלחת.' : 'מחכים שכולם יסיימו…'}
        </div>
        {hidden && (
          <button className="btn" onClick={() => share(room.code, room.kind)}>
            📲 שלח את האתגר
          </button>
        )}
      </div>
      <div className="list">
        {playing.map((p) => (
          <PlayerRow
            key={p.id}
            p={p}
            room={room}
            right={hidden && p.id !== me ? <span className="muted small">{p.done ? 'סיים' : 'משחק…'}</span> : <b>{p.done ? p.norm : `${p.progress}/${total}`}</b>}
          />
        ))}
      </div>
    </div>
  )
}

function RoundEnd({ room, hasScratch, onQuit }: { room: RoomState; hasScratch: boolean; onQuit: () => void }) {
  const me = myId()
  const isHost = effectiveHost(room) === me
  const rec = room.history?.[`r${room.round}`]
  const ranked = rankRound(activePlayers(room).filter((p) => rec?.scores?.[p.id] !== undefined))
  const outP = rec?.out ? room.players[rec.out] : null
  const next = room.plan?.[room.round]
  useEffect(() => {
    if (outP?.id === me) fx.wrong()
  }, [outP?.id, me])
  return (
    <div className="screen full">
      <TopBar title={`סוף סבב ${room.round}`} onBack={onQuit} />
      {outP && (
        <div className="card center">
          <div style={{ fontSize: 34 }}>🟥</div>
          <div style={{ fontWeight: 800, fontSize: 18 }}>{outP.id === me ? 'הודחת. אפשר להמשיך לצפות' : `${outP.name} הודח`}</div>
        </div>
      )}
      <div className="list">
        {ranked.map((p, k) => (
          <PlayerRow key={p.id} p={p} room={room} pos={k + 1} right={<b>{rec?.scores?.[p.id] ?? 0}</b>} />
        ))}
      </div>
      {next && (
        <div className="card muted small">
          הסבב הבא: <b style={{ color: 'var(--text)' }}>{modeName(next.mode)}</b> · {next.count} {next.mode === 'trivia' || next.mode === 'quick' ? 'שאלות' : 'סבבים'}
          {room.round + 1 === room.plan?.length ? ' · הגמר' : ''}
        </div>
      )}
      <div className="spacer" />
      {isHost ? (
        <button className="btn primary" onClick={() => startRound(room, hasScratch)}>
          {room.round + 1 === room.plan?.length ? 'לגמר' : 'לסבב הבא'}
        </button>
      ) : (
        <div className="center muted">מחכים למארח…</div>
      )}
    </div>
  )
}

function finalOrder(room: RoomState): RoomPlayer[] {
  const all = activePlayers(room).filter((p) => !p.spectator || room.kind !== 'room')
  if (room.kind !== 'tournament') return rankRound(all)
  // winner first, then by the round they went out (later is better)
  const outRound: Record<string, number> = {}
  for (const r of Object.values(room.history ?? {})) if (r.out) outRound[r.out] = r.round
  const finalRec = room.history?.[`r${room.round}`]
  return [...all].sort((a, b) => {
    const ra = outRound[a.id] ?? Infinity
    const rb = outRound[b.id] ?? Infinity
    if (ra !== rb) return rb - ra
    return (finalRec?.scores?.[b.id] ?? 0) - (finalRec?.scores?.[a.id] ?? 0)
  })
}

function Finished({ room, onQuit }: { room: RoomState; onQuit: () => void }) {
  const me = myId()
  const nav = useNav()
  const order = useMemo(() => finalOrder(room), [room])
  const isHost = effectiveHost(room) === me
  const winner = order[0]
  const iWon = winner?.id === me && order.length > 1
  const self = room.players?.[me]

  // record once per room and round
  useEffect(() => {
    const key = `fa.recorded.${room.code}.${room.createdAt}.${room.round}`
    if (sessionStorage.getItem(key) || !self) return
    sessionStorage.setItem(key, '1')
    if (iWon) fx.win()
    const score = room.kind === 'tournament' ? self.total ?? 0 : self.score
    recordGame(
      { mode: room.config.mode, topics: room.config.topics, level: room.config.level, score, correct: self.correct, total: room.config.count, at: Date.now(), room: true, won: iWon },
      { tournamentWin: room.kind === 'tournament' && iWon },
    )
    rememberFriends(order.map((p) => ({ name: p.name, avatar: p.avatar, xp: p.xp, won: p.id === winner?.id })))
  }, [room, self, iWon, order, winner])

  const podium = [order[1], order[0], order[2]]
  const heights = [80, 110, 60]
  const colors = ['var(--silver)', 'var(--gold)', 'var(--bronze)']

  return (
    <div className="screen full">
      <TopBar title={room.kind === 'tournament' ? 'הטורניר נגמר' : 'תוצאות'} onBack={onQuit} />
      <div className="center col" style={{ alignItems: 'center', gap: 4 }}>
        <div style={{ fontSize: 48 }}>🏆</div>
        <div style={{ fontWeight: 900, fontSize: 24 }}>{winner ? `${winner.name} ${room.kind === 'tournament' ? 'זוכה בגביע' : 'ניצח'}` : ''}</div>
      </div>
      {order.length > 1 && (
        <div className="podium">
          {podium.map((p, k) =>
            p ? (
              <div key={p.id} className="p">
                <div style={{ fontSize: 30 }}>{AVATARS[p.avatar] ?? '⚽'}</div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{p.name}</div>
                <div className="bar" style={{ height: heights[k], background: colors[k] }}>
                  {k === 1 ? 1 : k === 0 ? 2 : 3}
                </div>
              </div>
            ) : (
              <div key={k} />
            ),
          )}
        </div>
      )}
      <div className="list">
        {order.map((p, k) => (
          <PlayerRow key={p.id} p={{ ...p, out: false }} room={room} pos={k + 1} right={<b>{room.kind === 'tournament' ? p.total ?? 0 : p.norm}</b>} />
        ))}
      </div>
      <div className="spacer" />
      {isHost && room.kind !== 'challenge' && (
        <button className="btn primary" onClick={() => backToLobby(room)}>
          עוד אחד
        </button>
      )}
      <button className="btn" onClick={() => (room.kind === 'challenge' ? nav.tab('home') : onQuit())}>
        יציאה
      </button>
    </div>
  )
}

function resizeImage(file: File, max: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const s = Math.min(1, max / Math.max(img.width, img.height))
      const c = document.createElement('canvas')
      c.width = Math.round(img.width * s)
      c.height = Math.round(img.height * s)
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
      URL.revokeObjectURL(img.src)
      resolve(c.toDataURL('image/jpeg', 0.8))
    }
    img.onerror = reject
    img.src = URL.createObjectURL(file)
  })
}
