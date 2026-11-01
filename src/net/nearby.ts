import { applyPatch } from './local'
import type { RoomState, RoomTransport } from './types'

/*
 * Rooms without internet: phones on the same Wi-Fi or hotspot talk directly over WebRTC.
 * There is no server to introduce them, so the two halves of each handshake travel as QR codes:
 * the host shows an invitation, the friend scans it and shows a reply, the host scans the reply.
 * The host keeps the room; friends send it changes and get the whole room back after each one.
 */

type Msg = { t: 'state'; room: RoomState | null } | { t: 'patch'; u: Record<string, unknown> }

const GATHER_MS = 2500

/* ---------- a handshake squeezed into a short text for a QR code ---------- */

interface Signal {
  ufrag: string
  pwd: string
  fp: string
  cands: string[]
}

function b64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function unb64(s: string): Uint8Array {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(bin, (c) => c.charCodeAt(0))
}

function pack(sdp: string, kind: 'o' | 'a'): string {
  const line = (p: string) => sdp.split(/\r?\n/).find((l) => l.startsWith(p))?.slice(p.length).trim() ?? ''
  const fp = line('a=fingerprint:sha-256 ')
  const cands = sdp
    .split(/\r?\n/)
    .filter((l) => l.startsWith('a=candidate:'))
    .map((l) => l.slice(12).split(' '))
    // udp only; a host is enough on one network, and a server-reflexive one helps on some routers
    .filter((f) => f[2]?.toLowerCase() === 'udp' && (f[7] === 'host' || f[7] === 'srflx'))
    .map((f) => (f[4].includes(':') ? `[${f[4]}]` : f[4]) + ':' + f[5])
  const fpBytes = Uint8Array.from(fp.split(':').map((h) => parseInt(h, 16)))
  return ['FA1', kind, line('a=ice-ufrag:'), line('a=ice-pwd:'), b64(fpBytes), [...new Set(cands)].join(',')].join('~')
}

function unpack(text: string, want: 'o' | 'a'): Signal {
  const [tag, kind, ufrag, pwd, fp, cands] = text.trim().split('~')
  if (tag !== 'FA1' || kind !== want || !ufrag || !pwd || !fp) throw new Error('bad-code')
  const hex = [...unb64(fp)].map((b) => b.toString(16).padStart(2, '0').toUpperCase()).join(':')
  return { ufrag, pwd, fp: hex, cands: cands ? cands.split(',').filter(Boolean) : [] }
}

function toSdp(s: Signal, kind: 'offer' | 'answer'): string {
  const cands = s.cands.map((c, k) => {
    const cut = c.lastIndexOf(':')
    const addr = c.slice(0, cut).replace(/^\[|\]$/g, '')
    return `a=candidate:${k + 1} 1 udp ${2122260223 - k * 256} ${addr} ${c.slice(cut + 1)} typ host generation 0`
  })
  return (
    [
      'v=0',
      'o=- 1 2 IN IP4 127.0.0.1',
      's=-',
      't=0 0',
      'a=group:BUNDLE 0',
      'a=msid-semantic: WMS',
      'm=application 9 UDP/DTLS/SCTP webrtc-datachannel',
      'c=IN IP4 0.0.0.0',
      ...cands,
      `a=ice-ufrag:${s.ufrag}`,
      `a=ice-pwd:${s.pwd}`,
      'a=ice-options:trickle',
      `a=fingerprint:sha-256 ${s.fp}`,
      `a=setup:${kind === 'offer' ? 'actpass' : 'active'}`,
      'a=mid:0',
      'a=sctp-port:5000',
      'a=max-message-size:262144',
    ].join('\r\n') + '\r\n'
  )
}

/* ---------- one connection ---------- */

function newPeer() {
  const pc = new RTCPeerConnection({ iceServers: [] })
  // both sides open the same channel by number, so neither waits for the other to announce it
  const ch = pc.createDataChannel('fa', { negotiated: true, id: 0 })
  return { pc, ch }
}

function gathered(pc: RTCPeerConnection): Promise<void> {
  return new Promise((resolve) => {
    if (pc.iceGatheringState === 'complete') return resolve()
    const t = setTimeout(resolve, GATHER_MS)
    pc.addEventListener('icegatheringstatechange', () => {
      if (pc.iceGatheringState === 'complete') {
        clearTimeout(t)
        resolve()
      }
    })
  })
}

function opened(ch: RTCDataChannel, ms: number): Promise<void> {
  return new Promise((resolve, reject) => {
    if (ch.readyState === 'open') return resolve()
    const t = setTimeout(() => reject(new Error('timeout')), ms)
    ch.addEventListener('open', () => {
      clearTimeout(t)
      resolve()
    })
  })
}

/**
 * Asking for the camera first matters: until a page may use the camera, browsers hide
 * the phone's address on the local network, and then the other phone cannot find it.
 */
export async function unlockLocalAddress(): Promise<boolean> {
  try {
    const s = await navigator.mediaDevices.getUserMedia({ video: true })
    s.getTracks().forEach((t) => t.stop())
    return true
  } catch {
    return false
  }
}

type Listener = (room: RoomState | null) => void

class Listeners {
  private set = new Set<Listener>()
  add(cb: Listener) {
    this.set.add(cb)
    return () => {
      this.set.delete(cb)
    }
  }
  emit(room: RoomState | null) {
    for (const cb of this.set) cb(room)
  }
}

/* ---------- the host's phone keeps the room ---------- */

export interface Invite {
  /** text for the QR code the friend scans */
  code: string
  /** takes the friend's reply and resolves once connected */
  accept: (reply: string) => Promise<void>
  cancel: () => void
}

export class NearbyHost implements RoomTransport {
  readonly name = 'nearby-host'
  private room: RoomState | null = null
  private peers = new Set<{ pc: RTCPeerConnection; ch: RTCDataChannel; player?: string }>()
  private listeners = new Listeners()

  async get(code: string) {
    return this.room?.code === code ? this.room : null
  }

  async create(room: RoomState) {
    this.room = room
    this.changed()
  }

  subscribe(code: string, cb: Listener) {
    const off = this.listeners.add(cb)
    cb(this.room?.code === code ? this.room : null)
    return off
  }

  async patch(code: string, updates: Record<string, unknown>) {
    if (!this.room || this.room.code !== code) return
    this.room = applyPatch(this.room, updates)
    this.changed()
  }

  private changed() {
    this.listeners.emit(this.room)
    const msg = JSON.stringify({ t: 'state', room: this.room } satisfies Msg)
    for (const p of this.peers) if (p.ch.readyState === 'open') p.ch.send(msg)
  }

  get connected(): number {
    return [...this.peers].filter((p) => p.ch.readyState === 'open').length
  }

  async invite(): Promise<Invite> {
    const peer: { pc: RTCPeerConnection; ch: RTCDataChannel; player?: string } = newPeer()
    const { pc, ch } = peer
    ch.onopen = () => {
      this.peers.add(peer)
      ch.send(JSON.stringify({ t: 'state', room: this.room } satisfies Msg))
    }
    ch.onmessage = (e) => {
      const m = JSON.parse(e.data) as Msg
      if (m.t !== 'patch' || !this.room) return
      // remember whose phone this is, so a dropped connection can mark that player as gone
      for (const k of Object.keys(m.u)) {
        const id = /^players\/([^/]+)/.exec(k)?.[1]
        if (id && !peer.player) peer.player = id
      }
      this.patch(this.room.code, m.u)
    }
    ch.onclose = () => {
      this.peers.delete(peer)
      if (peer.player && this.room) this.patch(this.room.code, { [`players/${peer.player}/left`]: true })
    }
    await pc.setLocalDescription(await pc.createOffer())
    await gathered(pc)
    return {
      code: pack(pc.localDescription!.sdp, 'o'),
      accept: async (reply: string) => {
        await pc.setRemoteDescription({ type: 'answer', sdp: toSdp(unpack(reply, 'a'), 'answer') })
        await opened(ch, 15000)
      },
      cancel: () => {
        if (ch.readyState !== 'open') pc.close()
      },
    }
  }

  close() {
    for (const p of this.peers) p.pc.close()
    this.peers.clear()
  }
}

/* ---------- a friend's phone follows the host ---------- */

export class NearbyGuest implements RoomTransport {
  readonly name = 'nearby-guest'
  private room: RoomState | null = null
  private listeners = new Listeners()
  private pc: RTCPeerConnection
  private ch: RTCDataChannel
  private first: Promise<RoomState>
  /** called when the connection to the host drops */
  onLost: (() => void) | null = null

  constructor() {
    const { pc, ch } = newPeer()
    this.pc = pc
    this.ch = ch
    this.first = new Promise((resolve) => {
      ch.onmessage = (e) => {
        const m = JSON.parse(e.data) as Msg
        if (m.t !== 'state') return
        this.room = m.room
        if (m.room) resolve(m.room)
        this.listeners.emit(this.room)
      }
    })
    ch.onclose = () => this.onLost?.()
  }

  /** Reads the host's invitation and returns the reply to show as a QR code. */
  async answer(invite: string): Promise<string> {
    await this.pc.setRemoteDescription({ type: 'offer', sdp: toSdp(unpack(invite, 'o'), 'offer') })
    await this.pc.setLocalDescription(await this.pc.createAnswer())
    await gathered(this.pc)
    return pack(this.pc.localDescription!.sdp, 'a')
  }

  /** Resolves with the room once the host has scanned the reply. */
  connected(): Promise<RoomState> {
    return this.first
  }

  async get(code: string) {
    return this.room?.code === code ? this.room : null
  }

  async create() {
    throw new Error('only the host creates the room')
  }

  subscribe(code: string, cb: Listener) {
    const off = this.listeners.add(cb)
    cb(this.room?.code === code ? this.room : null)
    return off
  }

  async patch(code: string, updates: Record<string, unknown>) {
    if (!this.room || this.room.code !== code) return
    // show the change right away; the host's copy comes back a moment later
    this.room = applyPatch(this.room, updates)
    this.listeners.emit(this.room)
    if (this.ch.readyState === 'open') this.ch.send(JSON.stringify({ t: 'patch', u: updates } satisfies Msg))
  }

  close() {
    // a goodbye from this phone is not a lost connection
    this.onLost = null
    this.pc.close()
  }
}
