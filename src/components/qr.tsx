import { useEffect, useMemo, useRef, useState } from 'react'
import qrcode from 'qrcode-generator'
import { toast } from './ui'

/** A QR code for a short text, with a copy button for phones that cannot scan. */
export function QRCode({ text }: { text: string }) {
  const svg = useMemo(() => {
    const q = qrcode(0, 'L')
    q.addData(text, 'Byte')
    q.make()
    return q.createSvgTag({ cellSize: 4, margin: 3, scalable: true })
  }, [text])
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      toast('הקוד הועתק')
    } catch {
      toast('לא הצלחתי להעתיק')
    }
  }
  return (
    <div className="col" style={{ alignItems: 'center', gap: 8 }}>
      <div className="qr" data-code={text} dangerouslySetInnerHTML={{ __html: svg }} />
      <button className="link-btn small" onClick={copy}>
        העתק כטקסט
      </button>
    </div>
  )
}

type Detector = { detect(src: CanvasImageSource): Promise<{ rawValue: string }[]> }

/** Reads a QR code with the back camera; a text box takes a pasted code instead. */
export function QRScanner({ onCode, accept }: { onCode: (text: string) => void; accept?: (text: string) => boolean }) {
  const video = useRef<HTMLVideoElement>(null)
  const [state, setState] = useState<'starting' | 'on' | 'denied'>('starting')
  const [paste, setPaste] = useState('')
  const done = useRef(false)
  const ok = (t: string) => !accept || accept(t)

  useEffect(() => {
    let stream: MediaStream | null = null
    let timer = 0
    let stopped = false
    ;(async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      } catch {
        setState('denied')
        return
      }
      if (stopped) return stream.getTracks().forEach((t) => t.stop())
      const v = video.current!
      v.srcObject = stream
      await v.play().catch(() => {})
      setState('on')
      // the phone's own reader where there is one, otherwise a small library loaded on demand
      const Native = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => Detector }).BarcodeDetector
      let detector: Detector | null = null
      if (Native) {
        try {
          detector = new Native({ formats: ['qr_code'] })
        } catch {
          detector = null
        }
      }
      const jsQR = detector ? null : (await import('jsqr')).default
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d', { willReadFrequently: true })!
      const tick = async () => {
        if (stopped || done.current) return
        if (v.readyState >= 2 && v.videoWidth) {
          let text: string | null = null
          if (detector) {
            const found = await detector.detect(v).catch(() => [])
            text = found[0]?.rawValue ?? null
          } else if (jsQR) {
            const w = Math.min(640, v.videoWidth)
            const h = Math.round((v.videoHeight * w) / v.videoWidth)
            canvas.width = w
            canvas.height = h
            ctx.drawImage(v, 0, 0, w, h)
            text = jsQR(ctx.getImageData(0, 0, w, h).data, w, h)?.data ?? null
          }
          if (text && ok(text) && !done.current) {
            done.current = true
            onCode(text)
            return
          }
        }
        timer = window.setTimeout(tick, 150)
      }
      tick()
    })()
    return () => {
      stopped = true
      clearTimeout(timer)
      stream?.getTracks().forEach((t) => t.stop())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="col" style={{ gap: 10 }}>
      {state !== 'denied' ? (
        <div className="scanner">
          <video ref={video} playsInline muted />
          <div className="scanner-frame" />
          {state === 'starting' && <div className="scanner-note">פותח מצלמה…</div>}
        </div>
      ) : (
        <div className="card muted small">אין גישה למצלמה. אפשר לאשר מצלמה בהגדרות הדפדפן, או להדביק כאן את הקוד שהחבר העתיק.</div>
      )}
      <div className="row" style={{ gap: 8 }}>
        <input className="field grow" placeholder="או הדבק קוד" value={paste} onChange={(e) => setPaste(e.target.value)} dir="ltr" />
        <button
          className="btn"
          style={{ width: 'auto' }}
          disabled={!paste.trim()}
          onClick={() => {
            if (!ok(paste.trim())) return toast('זה לא הקוד הנכון')
            done.current = true
            onCode(paste.trim())
          }}
        >
          אישור
        </button>
      </div>
    </div>
  )
}
