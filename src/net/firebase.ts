import type { RoomState, RoomTransport } from './types'

export interface FirebaseWebConfig {
  apiKey: string
  authDomain?: string
  databaseURL: string
  projectId: string
  appId?: string
}

/**
 * Rooms on Firebase Realtime Database. The SDK loads only when a room is used,
 * so solo play stays light and works offline.
 */
export async function createFirebaseTransport(cfg: FirebaseWebConfig): Promise<RoomTransport> {
  const [{ initializeApp }, db] = await Promise.all([import('firebase/app'), import('firebase/database')])
  const app = initializeApp(cfg)
  const database = db.getDatabase(app)
  const roomRef = (code: string) => db.ref(database, `rooms/${code}`)

  return {
    name: 'firebase',
    async get(code) {
      const snap = await db.get(roomRef(code))
      return snap.exists() ? (snap.val() as RoomState) : null
    },
    async create(room) {
      await db.set(roomRef(room.code), room)
      // if the host's phone drops, the others see it and one of them takes over
      db.onDisconnect(db.ref(database, `rooms/${room.code}/players/${room.host}/left`)).set(true)
    },
    subscribe(code, cb) {
      const r = roomRef(code)
      const off = db.onValue(r, (snap) => cb(snap.exists() ? (snap.val() as RoomState) : null))
      return () => off()
    },
    async patch(code, updates) {
      await db.update(roomRef(code), updates)
    },
  }
}

export async function markLeaveOnDisconnect(cfg: FirebaseWebConfig, code: string, pid: string) {
  const [{ getApp, getApps, initializeApp }, db] = await Promise.all([import('firebase/app'), import('firebase/database')])
  const app = getApps().length ? getApp() : initializeApp(cfg)
  db.onDisconnect(db.ref(db.getDatabase(app), `rooms/${code}/players/${pid}/left`)).set(true)
}
