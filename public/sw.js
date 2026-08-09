const CACHE_NAME = 'nianrenji-v6'
const APP_SHELL = ['/', '/index.html', '/manifest.webmanifest', '/pwa-icon.jpg']
const shouldBypassCache = (request) => {
  const url = new URL(request.url)
  const isLocalApi = url.hostname === '127.0.0.1' || url.hostname === 'localhost' || url.hostname === '::1'
  const isOpenAiApi = url.pathname.includes('/v1/models')
    || url.pathname.includes('/v1/chat/completions')
    || url.pathname.includes('/v1/embeddings')
  return isLocalApi || isOpenAiApi
}
const refreshCachedIndex = async (cache, response) => {
  const previous = await cache.match('/index.html')
  const [previousText, nextText] = await Promise.all([
    previous ? previous.clone().text().catch(() => '') : Promise.resolve(''),
    response.clone().text().catch(() => '')
  ])
  if (previousText && nextText && previousText !== nextText) {
    const requests = await cache.keys()
    await Promise.all(requests.filter(request => new URL(request.url).pathname.startsWith('/assets/')).map(request => cache.delete(request)))
  }
  await cache.put('/index.html', response)
}
self.addEventListener('install', (event) => { event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))); self.skipWaiting() })
self.addEventListener('activate', (event) => { event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))); self.clients.claim() })
self.addEventListener('fetch', (event) => {
  // API requests must be handled by the browser directly. Intercepting them
  // here can break loopback access on Android and should never be cached.
  if (shouldBypassCache(event.request)) return
  if (event.request.method !== 'GET') return
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).then((response) => {
      // Clone before returning the response, then handle cache failures so a
      // failed cache write never becomes an unhandled promise rejection.
      const responseToCache = response.clone()
      event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => refreshCachedIndex(cache, responseToCache)).catch(() => undefined),
      )
      return response
    }).catch(() => caches.match('/index.html')))
    return
  }
  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
    if (response.ok && new URL(event.request.url).origin === self.location.origin) {
      const copy = response.clone()
      event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)).catch(() => undefined))
    }
    return response
  })))
})
