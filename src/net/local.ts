import type { RoomState, RoomTransport } from './types'

/**
 * Rooms shared between tabs of one browser, for testing without a server.
 * Enabled with ?local=1.
 */
const KEY = (code: string) => `fa.localroom.${code}`

function setPath(obj: Record<string, unknown>, path: string, value: unknown) {
  const parts = path.split('/')
  let cur = obj
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i]
    if (typeof cur[p] !== 'object' || cur[p] === null) cur[p] = {}
    cur = cur[p] as Record<string, unknown>
  }
  const lastKey = parts[parts.length - 1]
  if (value === null || value === undefined) delete cur[lastKey]
  else cur[lastKey] = value
}

export function applyPatch<T extends object>(state: T, updates: Record<string, unknown>): T {
  const next = structuredClone(state) as Record<string, unknown>
  for (const [k, v] of Object.entries(updates)) setPath(next, k, v)
  return next as T
}

export class LocalTransport implements RoomTransport {
  readonly name = 'local'
  private ch = new BroadcastChannel('fa-rooms')

  private read(code: string): RoomState | null {
    const raw = localStorage.getItem(KEY(code))
    return raw ? (JSON.parse(raw) as RoomState) : null
  }

  private write(code: string, room: RoomState) {
    localStorage.setItem(KEY(code), JSON.stringify(room))
    this.ch.postMessage(code)
  }

  async get(code: string) {
    return this.read(code)
  }

  async create(room: RoomState) {
    this.write(room.code, room)
  }

  subscribe(code: string, cb: (room: RoomState | null) => void) {
    // A separate channel object also hears writes made from this tab.
    const ch = new BroadcastChannel('fa-rooms')
    ch.onmessage = (e) => {
      if (e.data === code) cb(this.read(code))
    }
    cb(this.read(code))
    return () => ch.close()
  }

  async patch(code: string, updates: Record<string, unknown>) {
    const cur = this.read(code)
    if (!cur) return
    this.write(code, applyPatch(cur, updates))
  }
}
