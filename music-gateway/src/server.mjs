import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { createServer } from 'node:http'
import { Readable } from 'node:stream'
import { SecureSessionStore } from './secure-store.mjs'

const PORT = Number(process.env.PORT || 8787)
const PUBLIC_UPSTREAM = String(process.env.MUSIC_PUBLIC_UPSTREAM || 'http://music-public:8080').replace(/\/$/, '')
const AUTH_UPSTREAM = String(process.env.MUSIC_AUTH_UPSTREAM || 'http://music-auth:8080').replace(/\/$/, '')
const NETEASE_UPSTREAM = String(process.env.MUSIC_NETEASE_UPSTREAM || 'https://music.163.com').replace(/\/$/, '')
const DATA_DIR = process.env.MUSIC_DATA_DIR || '/data'
const COOKIE_NAME = 'clingy_music_session'
const COOKIE_SAME_SITE = process.env.MUSIC_COOKIE_SAME_SITE || 'None'
const COOKIE_SECURE = process.env.MUSIC_COOKIE_SECURE !== 'false'
const SESSION_TTL_DAYS = Number(process.env.MUSIC_SESSION_TTL_DAYS || 90)
const ALLOWED_ORIGINS = new Set(String(process.env.MUSIC_ALLOWED_ORIGINS || '').split(',').map(value => value.trim()).filter(Boolean))
const MAX_BODY_BYTES = 2 * 1024 * 1024
const AUTH_COOKIE_SOURCES = ['netease', 'qq', 'kugou', 'bilibili', 'soda']

const store = new SecureSessionStore({ dataDir: DATA_DIR, encryptionKey: process.env.MUSIC_SESSION_KEY, ttlDays: SESSION_TTL_DAYS })
await store.initialize()
const pruneTimer = setInterval(() => void store.prune().catch(error => console.error(`[music-gateway] session cleanup: ${error instanceof Error ? error.message : String(error)}`)), 60 * 60 * 1000)
pruneTimer.unref()

const signingKey = store.key
let authQueue = Promise.resolve()
const rateBuckets = new Map()
const commentCache = new Map()
const COMMENT_CACHE_TTL_MS = 60_000
const COMMENT_CACHE_MAX_ENTRIES = 200

const json = (response, status, body, headers = {}) => {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers })
  response.end(JSON.stringify(body))
}

const parseCookies = (header = '') => Object.fromEntries(header.split(';').map(value => value.trim()).filter(Boolean).map(value => {
  const separator = value.indexOf('=')
  return separator < 0 ? [value, ''] : [value.slice(0, separator), value.slice(separator + 1)]
}))

const signSession = (id) => `${id}.${createHmac('sha256', signingKey).update(id).digest('base64url')}`
const verifySession = (value = '') => {
  const separator = value.lastIndexOf('.')
  if (separator < 1) return ''
  const id = value.slice(0, separator)
  const signature = Buffer.from(value.slice(separator + 1))
  const expected = Buffer.from(createHmac('sha256', signingKey).update(id).digest('base64url'))
  return signature.length === expected.length && timingSafeEqual(signature, expected) ? id : ''
}

const cookieHeader = (signed, expired = false) => {
  const attributes = [`${COOKIE_NAME}=${expired ? '' : signed}`, 'Path=/', 'HttpOnly', `SameSite=${COOKIE_SAME_SITE}`]
  if (COOKIE_SECURE) attributes.push('Secure')
  if (COOKIE_SECURE && COOKIE_SAME_SITE.toLowerCase() === 'none') attributes.push('Partitioned')
  if (expired) attributes.push('Max-Age=0')
  else attributes.push(`Max-Age=${SESSION_TTL_DAYS * 24 * 60 * 60}`)
  return attributes.join('; ')
}

const sessionFor = (request) => {
  const signed = parseCookies(request.headers.cookie)[COOKIE_NAME] || ''
  let id = verifySession(signed)
  if (!id) id = randomBytes(32).toString('base64url')
  store.ensure(id)
  return { id, signed: signSession(id) }
}

const applyCors = (request, response) => {
  const origin = request.headers.origin
  if (!origin) return true
  const forwardedProtocol = String(request.headers['x-forwarded-proto'] || (COOKIE_SECURE ? 'https' : 'http')).split(',')[0].trim()
  const forwardedHost = String(request.headers['x-forwarded-host'] || request.headers.host || '').split(',')[0].trim()
  const sameOrigin = forwardedHost && origin === `${forwardedProtocol}://${forwardedHost}`
  if (!sameOrigin && !ALLOWED_ORIGINS.has(origin)) return false
  response.setHeader('Access-Control-Allow-Origin', origin)
  response.setHeader('Access-Control-Allow-Credentials', 'true')
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  response.setHeader('Vary', 'Origin')
  return true
}

const allowedByRateLimit = (request, loginRoute) => {
  const forwarded = String(request.headers['x-forwarded-for'] || '').split(',')[0].trim()
  const key = forwarded || request.socket.remoteAddress || 'unknown'
  const now = Date.now()
  const windowMs = loginRoute ? 60_000 : 10_000
  const maximum = loginRoute ? 12 : 300
  let bucket = rateBuckets.get(`${key}:${loginRoute ? 'login' : 'general'}`)
  if (!bucket || now - bucket.startedAt >= windowMs) bucket = { startedAt: now, count: 0 }
  bucket.count += 1
  rateBuckets.set(`${key}:${loginRoute ? 'login' : 'general'}`, bucket)
  return bucket.count <= maximum
}

const readBody = async (request) => {
  const chunks = []
  let size = 0
  for await (const chunk of request) {
    size += chunk.length
    if (size > MAX_BODY_BYTES) throw new Error('request body too large')
    chunks.push(chunk)
  }
  return Buffer.concat(chunks)
}

const upstreamFetch = async (base, request, url, body) => {
  const headers = new Headers()
  for (const name of ['accept', 'content-type', 'range', 'if-range']) {
    if (request.headers[name]) headers.set(name, String(request.headers[name]))
  }
  return fetch(`${base}${url.pathname}${url.search}`, { method: request.method, headers, body: body.length ? body : undefined, redirect: 'manual' })
}

const upstreamJson = async (base, path, init = {}) => {
  const response = await fetch(`${base}${path}`, init)
  const body = await response.json().catch(() => ({}))
  return { response, body }
}

const publicComment = value => {
  const reply = Array.isArray(value?.beReplied) ? value.beReplied[0] : null
  return {
    id: String(value?.commentId || ''),
    content: typeof value?.content === 'string' ? value.content : '',
    time: Number(value?.time || 0),
    timeText: typeof value?.timeStr === 'string' ? value.timeStr : '',
    likedCount: Number(value?.likedCount || 0),
    user: {
      nickname: typeof value?.user?.nickname === 'string' ? value.user.nickname : '网易云用户',
      avatarUrl: typeof value?.user?.avatarUrl === 'string' ? value.user.avatarUrl.replace(/^http:\/\//i, 'https://') : ''
    },
    reply: reply && typeof reply.content === 'string' ? {
      content: reply.content,
      nickname: typeof reply.user?.nickname === 'string' ? reply.user.nickname : '网易云用户'
    } : null
  }
}

const handleMusicComments = async (response, url) => {
  const id = String(url.searchParams.get('id') || '').trim()
  const limit = Math.min(50, Math.max(1, Number(url.searchParams.get('limit') || 20) || 20))
  const offset = Math.max(0, Number(url.searchParams.get('offset') || 0) || 0)
  if (!/^\d+$/.test(id)) return json(response, 400, { code: 400, msg: '无效的网易云歌曲 ID' })

  const cacheKey = `${id}:${limit}:${offset}`
  const cached = commentCache.get(cacheKey)
  if (cached && Date.now() - cached.createdAt < COMMENT_CACHE_TTL_MS) return json(response, 200, cached.body)

  const path = `/api/v1/resource/comments/R_SO_4_${encodeURIComponent(id)}?limit=${limit}&offset=${offset}`
  const { response: upstreamResponse, body } = await upstreamJson(NETEASE_UPSTREAM, path, {
    headers: { 'User-Agent': 'Mozilla/5.0', Referer: 'https://music.163.com/' },
    signal: AbortSignal.timeout(10_000)
  })
  if (!upstreamResponse.ok || Number(body?.code) !== 200) return json(response, 502, { code: 502, msg: '网易云评论暂时不可用' })

  const result = {
    code: 200,
    msg: 'success',
    data: {
      total: Number(body?.total || 0),
      more: body?.more === true,
      hotComments: (Array.isArray(body?.hotComments) ? body.hotComments : []).map(publicComment),
      comments: (Array.isArray(body?.comments) ? body.comments : []).map(publicComment)
    }
  }
  commentCache.set(cacheKey, { createdAt: Date.now(), body: result })
  if (commentCache.size > COMMENT_CACHE_MAX_ENTRIES) commentCache.delete(commentCache.keys().next().value)
  return json(response, 200, result)
}

const extractQrCookie = (body) => {
  const data = body?.data || body
  if (typeof data?.cookie === 'string' && data.cookie.trim()) return data.cookie.trim()
  if (!data?.cookies || typeof data.cookies !== 'object') return ''
  return Object.entries(data.cookies).filter(([key, value]) => key && value).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => `${key}=${value}`).join('; ')
}

const scrubCredentials = (value) => {
  if (Array.isArray(value)) return value.map(scrubCredentials)
  if (!value || typeof value !== 'object') return value
  const result = {}
  for (const [key, item] of Object.entries(value)) {
    const normalizedKey = key.toLowerCase()
    if (normalizedKey.includes('cookie') || normalizedKey.includes('credential') || normalizedKey === 'token') continue
    result[key] = scrubCredentials(item)
  }
  return result
}

const setUpstreamCookies = async (cookies) => {
  const isolated = Object.fromEntries(AUTH_COOKIE_SOURCES.map(source => [source, cookies[source] || '']))
  const { response } = await upstreamJson(AUTH_UPSTREAM, '/api/v1/system/cookies', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(isolated)
  })
  if (!response.ok) throw new Error(`认证音乐服务写入会话失败 (${response.status})`)
}

const clearUpstreamCookies = async (cookies) => {
  const clearing = Object.fromEntries(AUTH_COOKIE_SOURCES.map(source => [source, '']))
  await upstreamJson(AUTH_UPSTREAM, '/api/v1/system/cookies', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(clearing)
  }).catch(() => null)
}

const withAuthLock = (task) => {
  const run = authQueue.then(task, task)
  authQueue = run.catch(() => undefined)
  return run
}

const forwardResponse = async (upstream, response, extraHeaders = {}) => {
  const headers = { 'Cache-Control': 'no-store', ...extraHeaders }
  for (const name of ['content-type', 'content-length', 'content-range', 'accept-ranges', 'location']) {
    const value = upstream.headers.get(name)
    if (value) headers[name] = value
  }
  response.writeHead(upstream.status, headers)
  if (!upstream.body) return response.end()
  Readable.fromWeb(upstream.body).pipe(response)
}

const handleQr = async (request, response, url, session, source) => {
  if (request.method === 'POST') {
    const { response: upstreamResponse, body } = await upstreamJson(AUTH_UPSTREAM, `/api/v1/system/qr_login/${encodeURIComponent(source)}`, { method: 'POST' })
    const data = body?.data || body
    if (upstreamResponse.ok && typeof data?.key === 'string') await store.setQr(session.id, source, data.key)
    return json(response, upstreamResponse.status, scrubCredentials(body), { 'Set-Cookie': cookieHeader(session.signed) })
  }
  const key = url.searchParams.get('key') || ''
  if (!store.ownsQr(session.id, source, key)) return json(response, 403, { code: 403, msg: '二维码会话不属于当前用户' })
  return withAuthLock(async () => {
    const { response: upstreamResponse, body } = await upstreamJson(AUTH_UPSTREAM, `/api/v1/system/qr_login/${encodeURIComponent(source)}?key=${encodeURIComponent(key)}`)
    const cookie = extractQrCookie(body)
    if (cookie) await store.completeQr(session.id, source, cookie)
    await clearUpstreamCookies({ [source === 'qq_wx' ? 'qq' : source]: '' })
    return json(response, upstreamResponse.status, scrubCredentials(body), { 'Set-Cookie': cookieHeader(session.signed) })
  })
}

const server = createServer(async (request, response) => {
  try {
    response.setHeader('X-Content-Type-Options', 'nosniff')
    response.setHeader('Referrer-Policy', 'no-referrer')
    if (!applyCors(request, response)) return json(response, 403, { error: 'origin not allowed' })
    if (request.method === 'OPTIONS') return response.writeHead(204).end()

    const url = new URL(request.url || '/', 'http://gateway.local')
    const loginRoute = url.pathname.startsWith('/api/v1/system/qr_login/')
    if (!allowedByRateLimit(request, loginRoute)) return json(response, 429, { error: '请求过于频繁，请稍后重试' })
    if (request.method !== 'GET' && request.method !== 'POST') return json(response, 405, { error: 'method not allowed' })

    if (url.pathname === '/health') return json(response, 200, { status: 'ok' })
    if (url.pathname === '/api/v1/music/comments' && request.method === 'GET') {
      return await handleMusicComments(response, url)
    }
    const session = sessionFor(request)
    if (url.pathname === '/api/v1/system/privacy/capabilities') {
      return json(response, 200, { data: {
        session_isolation: true,
        cookies_endpoint_protected: true,
        http_only_session: true,
        credential_not_returned: true,
        logout_supported: true,
        retention_days: SESSION_TTL_DAYS
      } }, { 'Set-Cookie': cookieHeader(session.signed) })
    }
    if (url.pathname === '/api/v1/system/logout' && request.method === 'POST') {
      await store.delete(session.id)
      return json(response, 200, { status: 'ok' }, { 'Set-Cookie': cookieHeader('', true) })
    }
    if (/^\/(?:api\/v1\/system|music)\/cookies\/?$/.test(url.pathname)) return json(response, 404, { error: 'not found' })

    const qrMatch = url.pathname.match(/^\/api\/v1\/system\/qr_login\/([^/]+)$/)
    if (qrMatch) return await handleQr(request, response, url, session, decodeURIComponent(qrMatch[1]))
    if (!url.pathname.startsWith('/api/v1/')) return json(response, 404, { error: 'not found' })

    const body = await readBody(request)
    const cookies = store.cookieMap(session.id)
    if (!Object.keys(cookies).length) {
      const upstream = await upstreamFetch(PUBLIC_UPSTREAM, request, url, body)
      return await forwardResponse(upstream, response, { 'Set-Cookie': cookieHeader(session.signed) })
    }

    return await withAuthLock(async () => {
      await setUpstreamCookies(cookies)
      try {
        const upstream = await upstreamFetch(AUTH_UPSTREAM, request, url, body)
        await clearUpstreamCookies(cookies)
        return await forwardResponse(upstream, response, { 'Set-Cookie': cookieHeader(session.signed) })
      } catch (error) {
        await clearUpstreamCookies(cookies)
        throw error
      }
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'internal error'
    console.error(`[music-gateway] ${request.method} ${String(request.url || '').split('?')[0]}: ${message}`)
    if (!response.headersSent) json(response, message === 'request body too large' ? 413 : 502, { error: message })
    else response.destroy()
  }
})

server.listen(PORT, '0.0.0.0', () => console.log(`[music-gateway] listening on ${PORT}`))

export { server, store }
