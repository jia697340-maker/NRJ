import { randomBytes } from 'node:crypto'
import { NeteaseCommentError, NeteaseCommentsAdapter } from './netease-comments.mjs'

const text = (value, maximum) => String(value || '').trim().slice(0, maximum)
const numberInRange = (value, minimum, maximum, fallback) => {
  const number = Number(value)
  return Number.isFinite(number) ? Math.min(maximum, Math.max(minimum, number)) : fallback
}

const json = (body, status = 200, headers = {}) => Response.json(body, {
  status,
  headers: {
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
    ...headers
  }
})

const clientKey = request => text(
  request.headers.get('x-nf-client-connection-ip')
    || request.headers.get('cf-connecting-ip')
    || request.headers.get('x-forwarded-for')?.split(',')[0]
    || 'unknown',
  80
)

export const createMemoryRateLimiter = ({ limit = 120, windowMs = 60_000, now = () => Date.now() } = {}) => {
  const buckets = new Map()
  return request => {
    const key = clientKey(request)
    const current = now()
    const bucket = buckets.get(key)
    if (!bucket || current - bucket.startedAt >= windowMs) {
      buckets.set(key, { startedAt: current, count: 1 })
      if (buckets.size > 2000) buckets.delete(buckets.keys().next().value)
      return true
    }
    bucket.count += 1
    return bucket.count <= limit
  }
}

export const createMusicCommentsHandler = ({
  adapter = new NeteaseCommentsAdapter(),
  allowRequest = createMemoryRateLimiter()
} = {}) => async request => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { Allow: 'GET, OPTIONS' } })
  if (request.method !== 'GET') return json({ code: 405, error: 'METHOD_NOT_ALLOWED', msg: '仅支持读取评论' }, 405, { Allow: 'GET, OPTIONS' })
  if (!allowRequest(request)) return json({ code: 429, error: 'RATE_LIMITED', msg: '请求过于频繁，请稍后重试' }, 429, { 'Retry-After': '60' })

  const url = new URL(request.url)
  const requestId = randomBytes(8).toString('hex')
  try {
    const data = await adapter.getComments({
      requestId,
      id: text(url.searchParams.get('id'), 80),
      neteaseId: text(url.searchParams.get('neteaseId'), 80),
      source: text(url.searchParams.get('source'), 40),
      name: text(url.searchParams.get('name'), 200),
      artist: text(url.searchParams.get('artist'), 200),
      album: text(url.searchParams.get('album'), 200),
      duration: numberInRange(url.searchParams.get('duration'), 0, 86_400, 0),
      limit: numberInRange(url.searchParams.get('limit'), 1, 50, 20),
      offset: numberInRange(url.searchParams.get('offset'), 0, 10_000, 0)
    })
    return json({ code: 200, msg: 'success', data }, 200, { 'X-Request-Id': requestId })
  } catch (error) {
    const known = error instanceof NeteaseCommentError
    const status = known ? error.status : 502
    const code = known ? error.code : 'COMMENTS_UPSTREAM_UNAVAILABLE'
    const msg = status === 404
      ? '未找到可靠的网易云对应歌曲'
      : status === 400
        ? '歌曲信息不完整，无法读取评论'
        : '评论暂时无法加载，请稍后重试'
    return json({ code: status, error: code, msg, requestId }, status, { 'X-Request-Id': requestId })
  }
}

