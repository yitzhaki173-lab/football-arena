// Everything the app needs is downloaded on install (precache.json, written at build time),
// so it works fully offline after the first visit. The page and content JSON are network
// first, so friends get the newest version when online; the rest is cache first.
const VERSION = '__VERSION__'
const CACHE = `fa-${VERSION}`

self.addEventListener('install', (e) => {
  e.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE)
      const res = await fetch('./precache.json', { cache: 'no-cache' })
      const { files } = await res.json()
      const core = ['./', ...files.filter((f) => !/^content\/(players|img|crests)\//.test(f))]
      // the app itself must all arrive; pictures are added one by one so one failure does not block the rest
      await cache.addAll(core.map((f) => new Request(f, { cache: 'no-cache' })))
      const pics = files.filter((f) => /^content\/(players|img|crests)\//.test(f))
      for (let i = 0; i < pics.length; i += 12) {
        await Promise.allSettled(pics.slice(i, i + 12).map((f) => cache.add(new Request(f, { cache: 'no-cache' }))))
      }
      await self.skipWaiting()
    })(),
  )
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    (async () => {
      for (const key of await caches.keys()) if (key !== CACHE && key.startsWith('fa-')) await caches.delete(key)
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('message', (e) => {
  if (e.data === 'status') {
    caches
      .open(CACHE)
      .then((c) => c.keys())
      .then((keys) => e.source?.postMessage({ type: 'status', version: VERSION, cached: keys.length }))
  }
})

/** Network with a time limit, so a weak connection falls back to the saved copy quickly. */
function fromNetwork(req, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms)
    fetch(req).then(
      (res) => {
        clearTimeout(timer)
        resolve(res)
      },
      (err) => {
        clearTimeout(timer)
        reject(err)
      },
    )
  })
}

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== location.origin) return
  const path = url.pathname

  // hashed files and pictures (their URLs carry a version): cache first
  if (path.includes('/assets/') || /\/content\/(players|img|crests)\//.test(path) || path.includes('/icons/') || path.includes('/fonts/')) {
    e.respondWith(
      caches.match(req, { ignoreSearch: true, ignoreVary: true }).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone()
              caches.open(CACHE).then((c) => c.put(req, copy))
            }
            return res
          }),
      ),
    )
    return
  }

  // the page, content JSON and settings: network first, saved copy when offline
  e.respondWith(
    fromNetwork(req, 4000)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone()
          caches.open(CACHE).then((c) => c.put(req, copy))
        }
        return res
      })
      .catch(async () => {
        const hit = await caches.match(req, { ignoreSearch: true, ignoreVary: true })
        if (hit) return hit
        if (req.mode === 'navigate') return (await caches.match('./', { ignoreVary: true })) || (await caches.match('./index.html'))
        return new Response('', { status: 504 })
      }),
  )
})
