import { createCipheriv, randomBytes } from 'node:crypto'

// NetEase comment request shapes and the compatible WEAPI protocol are adapted
// from NeteaseCloudMusicApiEnhanced/api-enhanced (MIT License):
// https://github.com/NeteaseCloudMusicApiEnhanced/api-enhanced

const RESOURCE_PREFIX = 'R_SO_4_'
const WEAPI_NONCE = '0CoJUm6Qyw8W8jud'
const WEAPI_IV = '0102030405060708'
const WEAPI_PUBLIC_EXPONENT = 0x10001n
const WEAPI_MODULUS = BigInt(`0x00e0b509f6259df8642dbc35662901477df22677ec152b5ff68ace615bb7b725152b3ab17a876aea8a5aa76d2e417629ec4ee341f56135fccf695280104e0312ecbda92557c93870114af6c9d05c4f7f0c3685b7a46bee255932575cce10b424d813cfe4875d3e82047b97ddef52741d546b8e289dc6935b3ece0462db0a22b8e7`)
const DEFAULT_HEADERS = {
  Accept: 'application/json, text/plain, */*',
  Referer: 'https://music.163.com/',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36'
}

const clampText = (value, maximum = 240) => typeof value === 'string' ? value.slice(0, maximum) : ''
const redactText = value => clampText(value)
  .replace(/\b(cookie|authorization|music_u|csrf|token|secret)\b\s*[:=]\s*[^\s;,]+/gi, '$1=[redacted]')
  .replace(/\bbearer\s+[a-z0-9._~+\/-]+/gi, 'Bearer [redacted]')
const numericId = value => /^\d+$/.test(String(value || '').trim()) ? String(value).trim() : ''
const asSeconds = value => {
  const number = Number(value || 0)
  if (!Number.isFinite(number) || number <= 0) return 0
  return number > 10_000 ? number / 1000 : number
}
const normalizeText = value => String(value || '').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '')
const artistTokens = value => String(value || '')
  .split(/\s*(?:\/|、|,|，|&|；|;|\bfeat(?:uring)?\.?\b|\bft\.?\b)\s*/iu)
  .map(normalizeText).filter(Boolean)

const candidateArtists = song => (Array.isArray(song?.ar) ? song.ar : Array.isArray(song?.artists) ? song.artists : [])
  .map(item => normalizeText(item?.name)).filter(Boolean)

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

const modPow = (base, exponent, modulus) => {
  let result = 1n
  let value = base % modulus
  let power = exponent
  while (power > 0n) {
    if (power & 1n) result = result * value % modulus
    power >>= 1n
    value = value * value % modulus
  }
  return result
}

const aesEncrypt = (plainText, key) => {
  const cipher = createCipheriv('aes-128-cbc', Buffer.from(key), Buffer.from(WEAPI_IV))
  return Buffer.concat([cipher.update(String(plainText), 'utf8'), cipher.final()]).toString('base64')
}

const weapiPayload = data => {
  const secret = randomBytes(16).toString('base64url').slice(0, 16).padEnd(16, '0')
  const params = aesEncrypt(aesEncrypt(JSON.stringify(data), WEAPI_NONCE), secret)
  const reversedHex = Buffer.from(secret).reverse().toString('hex')
  const encrypted = modPow(BigInt(`0x${reversedHex}`), WEAPI_PUBLIC_EXPONENT, WEAPI_MODULUS).toString(16)
  return { params, encSecKey: encrypted.padStart(256, '0') }
}

export class NeteaseCommentError extends Error {
  constructor(message, { status = 502, code = 'COMMENTS_UPSTREAM_UNAVAILABLE', type = 'upstream', endpoint = '', upstreamStatus, neteaseCode, neteaseMessage } = {}) {
    super(message)
    this.name = 'NeteaseCommentError'
    this.status = status
    this.code = code
    this.type = type
    this.endpoint = endpoint
    this.upstreamStatus = upstreamStatus
    this.neteaseCode = neteaseCode
    this.neteaseMessage = neteaseMessage
  }
}

const responseMessage = body => clampText(body?.message || body?.msg || body?.data?.message || '')

export class NeteaseCommentsAdapter {
  constructor({
    primaryBase = 'https://music.163.com',
    legacyBase = 'https://music.163.com',
    interfaceBase = 'https://interface.music.163.com',
    fetchImpl = fetch,
    logger = event => console.error(`[music-gateway] ${JSON.stringify(event)}`),
    now = () => Date.now(),
    timeoutMs = 10_000,
    freshTtlMs = 15 * 60_000,
    staleTtlMs = 7 * 24 * 60 * 60_000,
    mappingTtlMs = 30 * 24 * 60 * 60_000,
    negativeMappingTtlMs = 60 * 60_000,
    cacheMaxEntries = 1000
  } = {}) {
    this.primaryBase = String(primaryBase).replace(/\/$/, '')
    this.legacyBase = String(legacyBase).replace(/\/$/, '')
    this.interfaceBase = String(interfaceBase).replace(/\/$/, '')
    this.fetchImpl = fetchImpl
    this.logger = logger
    this.now = now
    this.timeoutMs = timeoutMs
    this.freshTtlMs = freshTtlMs
    this.staleTtlMs = staleTtlMs
    this.mappingTtlMs = mappingTtlMs
    this.negativeMappingTtlMs = negativeMappingTtlMs
    this.cacheMaxEntries = cacheMaxEntries
    this.cache = new Map()
    this.mappingCache = new Map()
    this.cursors = new Map()
    this.inflight = new Map()
  }

  logFailure(error, { requestId, attempt, endpoint, url, elapsedMs }) {
    this.logger({
      requestId,
      operation: 'netease-comments',
      attempt,
      endpointType: endpoint,
      upstreamUrl: url,
      upstreamStatus: error?.upstreamStatus,
      neteaseCode: error?.neteaseCode,
      neteaseMessage: redactText(error?.neteaseMessage || error?.message),
      elapsedMs,
      errorType: error?.type || 'network'
    })
  }

  async requestJson(url, init, context) {
    const startedAt = this.now()
    let response
    try {
      response = await this.fetchImpl(url, { ...init, redirect: 'manual', signal: AbortSignal.timeout(this.timeoutMs) })
    } catch (cause) {
      const timeout = cause?.name === 'TimeoutError' || cause?.name === 'AbortError'
      const error = new NeteaseCommentError(timeout ? '网易云请求超时' : '网易云网络请求失败', {
        type: timeout ? 'timeout' : 'network', endpoint: context.endpoint, neteaseMessage: cause instanceof Error ? cause.message : String(cause)
      })
      this.logFailure(error, { ...context, url, elapsedMs: this.now() - startedAt })
      throw error
    }

    const raw = await response.text()
    let body
    try {
      body = JSON.parse(raw)
    } catch {
      const error = new NeteaseCommentError('网易云返回了无效 JSON', {
        type: 'json-parse', endpoint: context.endpoint, upstreamStatus: response.status,
        neteaseMessage: `content-type=${response.headers.get('content-type') || 'unknown'}`
      })
      this.logFailure(error, { ...context, url, elapsedMs: this.now() - startedAt })
      throw error
    }

    const neteaseCode = Number(body?.code)
    if (!response.ok || neteaseCode !== 200) {
      const error = new NeteaseCommentError('网易云评论上游返回错误', {
        type: response.ok ? 'netease-code' : 'http', endpoint: context.endpoint,
        upstreamStatus: response.status, neteaseCode: Number.isFinite(neteaseCode) ? neteaseCode : undefined,
        neteaseMessage: responseMessage(body)
      })
      this.logFailure(error, { ...context, url, elapsedMs: this.now() - startedAt })
      throw error
    }
    return body
  }

  touch(map, key, value) {
    map.delete(key)
    map.set(key, value)
  }

  trim(map, maximum = this.cacheMaxEntries) {
    while (map.size > maximum) map.delete(map.keys().next().value)
  }

  mappingFingerprint(input) {
    return [normalizeText(input.name), artistTokens(input.artist).join('|'), normalizeText(input.album), Math.round(asSeconds(input.duration))].join(':')
  }

  directId(input) {
    const mapped = numericId(input.neteaseId)
    if (mapped) return mapped
    const source = String(input.source || '').toLowerCase()
    return !source || source === 'netease' ? numericId(input.id) : ''
  }

  selectSearchMatch(input, songs) {
    const title = normalizeText(input.name)
    const artists = new Set(artistTokens(input.artist))
    const album = normalizeText(input.album)
    const duration = asSeconds(input.duration)
    if (!title || !artists.size) return null

    const candidates = (Array.isArray(songs) ? songs : []).flatMap(song => {
      if (!numericId(song?.id) || normalizeText(song?.name) !== title) return []
      const foundArtists = candidateArtists(song)
      const overlap = foundArtists.filter(item => artists.has(item)).length
      if (!overlap) return []
      const candidateDuration = asSeconds(song?.dt || song?.duration)
      if (duration && !candidateDuration) return []
      if (duration && candidateDuration && Math.abs(duration - candidateDuration) > Math.max(5, duration * 0.03)) return []
      const candidateAlbum = normalizeText(song?.al?.name || song?.album?.name)
      let score = 100 + overlap * 30
      if (duration && candidateDuration) score += 20 - Math.min(19, Math.abs(duration - candidateDuration))
      if (album && candidateAlbum === album) score += 20
      if (foundArtists.length === artists.size && overlap === artists.size) score += 10
      return [{ id: String(song.id), score }]
    }).sort((a, b) => b.score - a.score)

    if (!candidates.length) return null
    if (candidates[1] && candidates[0].score - candidates[1].score < 10 && candidates[0].id !== candidates[1].id) return null
    return candidates[0].id
  }

  async resolveId(input, requestId) {
    const direct = this.directId(input)
    if (direct) return { id: direct, matched: false }
    if (!String(input.name || '').trim() || !String(input.artist || '').trim()) {
      throw new NeteaseCommentError('缺少可用于匹配网易云歌曲的信息', { status: 400, code: 'INVALID_MUSIC_IDENTITY', type: 'validation' })
    }

    const fingerprint = this.mappingFingerprint(input)
    const cached = this.mappingCache.get(fingerprint)
    if (cached && this.now() - cached.createdAt < cached.ttl) {
      this.touch(this.mappingCache, fingerprint, cached)
      if (cached.id) return { id: cached.id, matched: true }
      throw new NeteaseCommentError('未找到可靠的网易云对应歌曲', { status: 404, code: 'NETEASE_TRACK_NOT_FOUND', type: 'mapping' })
    }

    const form = new URLSearchParams({ s: `${input.name} ${input.artist}`.trim(), type: '1', limit: '50', offset: '0', total: 'true' })
    const init = {
      method: 'POST', headers: { ...DEFAULT_HEADERS, 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' }, body: form.toString()
    }
    let body
    try {
      body = await this.requestJson(`${this.primaryBase}/api/cloudsearch/pc`, init, {
        requestId, attempt: 'mapping-primary', endpoint: 'cloudsearch-match'
      })
    } catch {
      body = await this.requestJson(`${this.interfaceBase}/api/cloudsearch/pc`, init, {
        requestId, attempt: 'mapping-fallback', endpoint: 'cloudsearch-match'
      })
    }
    const id = this.selectSearchMatch(input, body?.result?.songs)
    const mapping = { id, createdAt: this.now(), ttl: id ? this.mappingTtlMs : this.negativeMappingTtlMs }
    this.touch(this.mappingCache, fingerprint, mapping)
    this.trim(this.mappingCache, Math.max(100, Math.floor(this.cacheMaxEntries / 2)))
    if (!id) throw new NeteaseCommentError('未找到可靠的网易云对应歌曲', { status: 404, code: 'NETEASE_TRACK_NOT_FOUND', type: 'mapping' })
    return { id, matched: true }
  }

  async v2Comments(id, { limit, offset, requestId, sortType, attempt }) {
    const pageNo = Math.floor(offset / limit) + 1
    const cursorKey = `${id}:${sortType}:${pageNo}`
    let cursor = sortType === 3 ? (pageNo === 1 ? '0' : this.cursors.get(cursorKey)) : `normalHot#${offset}`
    if (sortType === 3 && pageNo > 1 && !cursor) {
      const error = new NeteaseCommentError('缺少新版评论分页游标', { type: 'cursor', endpoint: 'v2-resource-comments' })
      this.logFailure(error, {
        requestId, attempt, endpoint: 'v2-resource-comments', url: `${this.primaryBase}/api/v2/resource/comments`, elapsedMs: 0
      })
      throw error
    }
    const url = `${this.primaryBase}/api/v2/resource/comments`
    const form = new URLSearchParams({
      threadId: `${RESOURCE_PREFIX}${id}`, pageNo: String(pageNo), pageSize: String(limit), cursor: String(cursor),
      sortType: String(sortType), showInner: 'true'
    })
    const body = await this.requestJson(url, {
      method: 'POST', headers: { ...DEFAULT_HEADERS, 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' }, body: form.toString()
    }, { requestId, attempt, endpoint: 'v2-resource-comments' })
    const data = body?.data
    if (!data || !Array.isArray(data.comments)) {
      const error = new NeteaseCommentError('网易云新版评论响应格式无效', { type: 'schema', endpoint: 'v2-resource-comments', neteaseCode: body?.code })
      this.logFailure(error, { requestId, attempt, endpoint: 'v2-resource-comments', url, elapsedMs: 0 })
      throw error
    }
    if (sortType === 3 && data.cursor !== undefined && data.cursor !== null) this.cursors.set(`${id}:3:${pageNo + 1}`, String(data.cursor))
    return {
      total: Number(data.totalCount || 0), more: data.hasMore === true,
      comments: data.comments.map(publicComment).filter(item => item.id && item.content)
    }
  }

  async weapiComments(id, { limit, offset, requestId }) {
    const url = `${this.legacyBase}/weapi/v1/resource/comments/${RESOURCE_PREFIX}${encodeURIComponent(id)}?csrf_token=`
    const encrypted = weapiPayload({ rid: id, limit, offset, beforeTime: 0, csrf_token: '' })
    const body = await this.requestJson(url, {
      method: 'POST', headers: { ...DEFAULT_HEADERS, 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      body: new URLSearchParams(encrypted).toString()
    }, { requestId, attempt: 'fallback-weapi', endpoint: 'weapi-v1-resource-comments' })
    if (!Array.isArray(body?.comments) || body?.total === undefined) {
      const error = new NeteaseCommentError('网易云 WEAPI 评论响应格式无效', { type: 'schema', endpoint: 'weapi-v1-resource-comments', neteaseCode: body?.code })
      this.logFailure(error, { requestId, attempt: 'fallback-weapi', endpoint: 'weapi-v1-resource-comments', url, elapsedMs: 0 })
      throw error
    }
    return this.normalizeLegacy(body)
  }

  async legacyGetComments(id, { limit, offset, requestId }) {
    const url = `${this.interfaceBase}/api/v1/resource/comments/${RESOURCE_PREFIX}${encodeURIComponent(id)}?limit=${limit}&offset=${offset}`
    const body = await this.requestJson(url, { method: 'GET', headers: DEFAULT_HEADERS }, {
      requestId, attempt: 'fallback-get', endpoint: 'api-v1-resource-comments'
    })
    if (!Array.isArray(body?.comments) || body?.total === undefined) {
      const error = new NeteaseCommentError('网易云旧版评论响应格式无效', { type: 'schema', endpoint: 'api-v1-resource-comments', neteaseCode: body?.code })
      this.logFailure(error, { requestId, attempt: 'fallback-get', endpoint: 'api-v1-resource-comments', url, elapsedMs: 0 })
      throw error
    }
    return this.normalizeLegacy(body)
  }

  normalizeLegacy(body) {
    return {
      total: Number(body?.total || 0), more: body?.more === true,
      hotComments: (Array.isArray(body?.hotComments) ? body.hotComments : []).map(publicComment).filter(item => item.id && item.content),
      comments: (Array.isArray(body?.comments) ? body.comments : []).map(publicComment).filter(item => item.id && item.content)
    }
  }

  async fetchFresh(id, options) {
    try {
      const latest = await this.v2Comments(id, { ...options, sortType: 3, attempt: 'primary' })
      let hotComments = []
      if (options.offset === 0) {
        try {
          const hot = await this.v2Comments(id, { ...options, sortType: 2, attempt: 'primary-hot' })
          hotComments = hot.comments
        } catch {
          try { hotComments = (await this.weapiComments(id, options)).hotComments }
          catch { hotComments = [] }
        }
      }
      return { ...latest, hotComments }
    } catch {
      try { return await this.weapiComments(id, options) }
      catch {
        return await this.legacyGetComments(id, options)
      }
    }
  }

  async getComments(input) {
    const limit = Math.min(50, Math.max(1, Number(input.limit || 20) || 20))
    const offset = Math.max(0, Number(input.offset || 0) || 0)
    const requestId = clampText(input.requestId || randomBytes(8).toString('hex'), 80)
    const resolved = await this.resolveId(input, requestId)
    const key = `${resolved.id}:${limit}:${offset}`
    const cached = this.cache.get(key)
    if (cached && this.now() - cached.createdAt < this.freshTtlMs) {
      this.touch(this.cache, key, cached)
      return { ...cached.data, stale: false, resolvedNeteaseId: resolved.id, matched: resolved.matched }
    }
    if (this.inflight.has(key)) return this.inflight.get(key)

    const task = (async () => {
      try {
        const data = await this.fetchFresh(resolved.id, { limit, offset, requestId })
        const stored = { createdAt: this.now(), data }
        this.touch(this.cache, key, stored)
        this.trim(this.cache)
        return { ...data, stale: false, resolvedNeteaseId: resolved.id, matched: resolved.matched }
      } catch (error) {
        if (cached && this.now() - cached.createdAt < this.staleTtlMs) {
          this.touch(this.cache, key, cached)
          this.logger({ requestId, operation: 'netease-comments', attempt: 'cache-stale', endpointType: 'cache', errorType: 'stale-if-error' })
          return { ...cached.data, stale: true, resolvedNeteaseId: resolved.id, matched: resolved.matched }
        }
        throw error instanceof NeteaseCommentError ? error : new NeteaseCommentError('网易云评论暂时不可用')
      } finally {
        this.inflight.delete(key)
      }
    })()
    this.inflight.set(key, task)
    return task
  }
}
