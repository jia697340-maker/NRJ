self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (event) => {
  // This app intentionally does not provide offline caching. Remove caches
  // created by older workers so every launch loads the current deployment.
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith('nianrenji-')).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

// Keep a network-only fetch handler for broad PWA install compatibility.
// Nothing is read from or written to Cache Storage.
self.addEventListener('fetch', (event) => {
  if (new URL(event.request.url).origin !== self.location.origin) return
  event.respondWith(fetch(event.request))
})

self.addEventListener('sync', (event) => {
  if (event.tag !== 'nianrenji-keep-alive-probe') return
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
    clients.forEach((client) => client.postMessage({ type: 'keep-alive-sync', time: Date.now() }))
  }))
})
