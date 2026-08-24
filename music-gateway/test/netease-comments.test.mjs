import assert from 'node:assert/strict'
import test from 'node:test'
import { NeteaseCommentError, NeteaseCommentsAdapter } from '../src/netease-comments.mjs'

const response = (body, status = 200, contentType = 'application/json') => new Response(
  typeof body === 'string' ? body : JSON.stringify(body),
  { status, headers: { 'Content-Type': contentType } }
)

const rawComment = (id, content, nickname = '听众') => ({
  commentId: id,
  content,
  time: 1000 + Number(id),
  timeStr: '刚刚',
  likedCount: 3,
  user: { userId: 999, nickname, avatarUrl: 'http://avatar.test/a.jpg' },
  beReplied: [{ content: '原评论', user: { nickname: '另一位听众' } }]
})

const v2Body = (comments, extra = {}) => ({
  code: 200,
  data: { comments, totalCount: 88, hasMore: true, cursor: 'next-cursor', ...extra }
})

const legacyBody = (comments = [rawComment(3, '备用评论')]) => ({
  code: 200, total: 66, more: false,
  hotComments: [rawComment(2, '热门评论')], comments
})

test('uses anonymous v2 primary requests, normalizes public fields and caches the result', async () => {
  const calls = []
  const adapter = new NeteaseCommentsAdapter({
    fetchImpl: async (url, init) => {
      calls.push({ url, init })
      assert.equal(new Headers(init.headers).has('cookie'), false)
      assert.equal(new Headers(init.headers).has('authorization'), false)
      const form = new URLSearchParams(init.body)
      return response(v2Body([rawComment(form.get('sortType') === '2' ? 2 : 1, form.get('sortType') === '2' ? '热门评论' : '最新评论')]))
    },
    logger: () => {}
  })

  const first = await adapter.getComments({ id: '186016', source: 'netease', limit: 20, offset: 0, requestId: 'primary' })
  const second = await adapter.getComments({ id: '186016', source: 'netease', limit: 20, offset: 0, requestId: 'cached' })
  assert.equal(calls.length, 2)
  assert.equal(calls.every(call => call.url.endsWith('/api/v2/resource/comments')), true)
  assert.equal(calls.every(call => call.init.method === 'POST'), true)
  assert.equal(first.comments[0].content, '最新评论')
  assert.equal(first.hotComments[0].content, '热门评论')
  assert.equal(first.comments[0].user.avatarUrl, 'https://avatar.test/a.jpg')
  assert.equal(JSON.stringify(first).includes('userId'), false)
  assert.equal(first.stale, false)
  assert.deepEqual(second, first)
})

test('falls back from invalid v2 JSON to anonymous WEAPI and then legacy GET', async () => {
  const calls = []
  const adapter = new NeteaseCommentsAdapter({
    fetchImpl: async (url, init) => {
      calls.push({ url, init })
      const headers = new Headers(init.headers)
      assert.equal(headers.has('cookie'), false)
      if (url.includes('/api/v2/')) return response('<html>blocked</html>', 200, 'text/html')
      if (url.includes('/weapi/')) return response({ code: 503, message: 'temporary risk control' }, 503)
      return response(legacyBody())
    },
    logger: () => {}
  })

  const result = await adapter.getComments({ id: '186016', source: 'netease', limit: 20, offset: 0 })
  assert.equal(calls.length, 3)
  assert.match(calls[1].url, /\/weapi\/v1\/resource\/comments\/R_SO_4_186016/)
  const encrypted = new URLSearchParams(calls[1].init.body)
  assert.ok(encrypted.get('params'))
  assert.match(encrypted.get('encSecKey'), /^[0-9a-f]{256}$/)
  assert.match(calls[2].url, /interface\.music\.163\.com\/api\/v1\/resource\/comments/)
  assert.equal(result.comments[0].content, '备用评论')
})

test('returns stale cached comments when every upstream attempt later fails', async () => {
  let clock = 100
  let failing = false
  const events = []
  const adapter = new NeteaseCommentsAdapter({
    now: () => clock,
    freshTtlMs: 50,
    staleTtlMs: 1000,
    fetchImpl: async (_url, init) => failing
      ? response({ code: 503, message: 'upstream unavailable' }, 503)
      : response(v2Body([rawComment(new URLSearchParams(init.body).get('sortType') === '2' ? 2 : 1, '缓存评论')])),
    logger: event => events.push(event)
  })

  const fresh = await adapter.getComments({ id: '186016', source: 'netease' })
  assert.equal(fresh.stale, false)
  clock += 100
  failing = true
  const stale = await adapter.getComments({ id: '186016', source: 'netease' })
  assert.equal(stale.stale, true)
  assert.equal(stale.comments[0].content, '缓存评论')
  assert.ok(events.some(event => event.attempt === 'primary' && event.upstreamStatus === 503))
  assert.ok(events.some(event => event.attempt === 'fallback-weapi'))
  assert.ok(events.some(event => event.attempt === 'fallback-get'))
  assert.ok(events.some(event => event.attempt === 'cache-stale'))
})

test('strictly maps a non-Netease track by title, artist and duration', async () => {
  const calls = []
  const adapter = new NeteaseCommentsAdapter({
    fetchImpl: async (url, init) => {
      calls.push(url)
      if (url.includes('/api/cloudsearch/pc')) return response({
        code: 200,
        result: { songs: [
          { id: 111, name: '目标歌曲 (Live)', ar: [{ name: '目标歌手' }], al: { name: '现场专辑' }, dt: 205000 },
          { id: 222, name: '目标歌曲', ar: [{ name: '目标歌手' }], al: { name: '目标专辑' }, dt: 200500 },
          { id: 333, name: '目标歌曲', ar: [{ name: '翻唱者' }], al: { name: '目标专辑' }, dt: 200000 }
        ] }
      })
      return response(v2Body([rawComment(new URLSearchParams(init.body).get('sortType') === '2' ? 2 : 1, '匹配后的评论')]))
    },
    logger: () => {}
  })

  const result = await adapter.getComments({
    id: 'qq-song-id', source: 'qq', name: '目标歌曲', artist: '目标歌手', album: '目标专辑', duration: 200
  })
  assert.equal(result.resolvedNeteaseId, '222')
  assert.equal(result.matched, true)
  assert.equal(calls.filter(url => url.includes('/api/cloudsearch/pc')).length, 1)
})

test('rejects ambiguous or clearly wrong song matches instead of showing wrong comments', async () => {
  const adapter = new NeteaseCommentsAdapter({
    fetchImpl: async url => {
      assert.match(url, /api\/cloudsearch\/pc/)
      return response({ code: 200, result: { songs: [
        { id: 101, name: '同名歌曲', ar: [{ name: '同名歌手' }], al: { name: '专辑甲' }, dt: 200000 },
        { id: 102, name: '同名歌曲', ar: [{ name: '同名歌手' }], al: { name: '专辑乙' }, dt: 200000 }
      ] } })
    },
    logger: () => {}
  })
  await assert.rejects(
    adapter.getComments({ id: 'qq-id', source: 'qq', name: '同名歌曲', artist: '同名歌手', duration: 200 }),
    error => error instanceof NeteaseCommentError && error.status === 404 && error.code === 'NETEASE_TRACK_NOT_FOUND'
  )
})

test('falls back to the interface host when primary anonymous song matching fails', async () => {
  const calls = []
  const adapter = new NeteaseCommentsAdapter({
    fetchImpl: async (url, init) => {
      calls.push(url)
      if (url === 'https://music.163.com/api/cloudsearch/pc') return response({ code: 503, message: 'blocked' }, 503)
      if (url === 'https://interface.music.163.com/api/cloudsearch/pc') return response({
        code: 200,
        result: { songs: [{ id: 987, name: '映射歌曲', ar: [{ name: '映射歌手' }], al: { name: '映射专辑' }, dt: 180000 }] }
      })
      return response(v2Body([rawComment(new URLSearchParams(init.body).get('sortType') === '2' ? 2 : 1, '映射评论')]))
    },
    logger: () => {}
  })
  const result = await adapter.getComments({ source: 'qq', id: 'qq-id', name: '映射歌曲', artist: '映射歌手', album: '映射专辑', duration: 180 })
  assert.equal(result.resolvedNeteaseId, '987')
  assert.deepEqual(calls.slice(0, 2), [
    'https://music.163.com/api/cloudsearch/pc',
    'https://interface.music.163.com/api/cloudsearch/pc'
  ])
})

test('uses the v2 cursor captured from page one for the next comments page', async () => {
  const latestForms = []
  const adapter = new NeteaseCommentsAdapter({
    fetchImpl: async (_url, init) => {
      const form = new URLSearchParams(init.body)
      if (form.get('sortType') === '3') latestForms.push(form)
      return response(v2Body([rawComment(latestForms.length || 1, `第 ${latestForms.length || 1} 页`)], { cursor: `cursor-${latestForms.length + 1}` }))
    },
    logger: () => {}
  })
  await adapter.getComments({ id: '186016', source: 'netease', limit: 20, offset: 0 })
  await adapter.getComments({ id: '186016', source: 'netease', limit: 20, offset: 20 })
  assert.equal(latestForms.length, 2)
  assert.equal(latestForms[0].get('cursor'), '0')
  assert.equal(latestForms[1].get('cursor'), 'cursor-2')
})

test('returns a sanitized upstream error when no cache and no fallback are available', async () => {
  const events = []
  const adapter = new NeteaseCommentsAdapter({
    fetchImpl: async () => response({ code: 403, message: 'risk control; MUSIC_U=must-not-leak' }, 403),
    logger: event => events.push(event)
  })
  await assert.rejects(
    adapter.getComments({ id: '186016', source: 'netease' }),
    error => error instanceof NeteaseCommentError && error.status === 502 && error.code === 'COMMENTS_UPSTREAM_UNAVAILABLE'
  )
  assert.equal(events.length, 3)
  assert.ok(events.every(event => !Object.keys(event).some(key => /cookie|authorization|secret/i.test(key))))
  assert.equal(JSON.stringify(events).includes('must-not-leak'), false)
})

test('coalesces concurrent requests for the same song page', async () => {
  let calls = 0
  const adapter = new NeteaseCommentsAdapter({
    fetchImpl: async (_url, init) => {
      calls += 1
      await new Promise(resolve => setTimeout(resolve, 15))
      return response(v2Body([rawComment(new URLSearchParams(init.body).get('sortType') === '2' ? 2 : 1, '并发评论')]))
    },
    logger: () => {}
  })
  const [a, b] = await Promise.all([
    adapter.getComments({ id: '186016', source: 'netease' }),
    adapter.getComments({ id: '186016', source: 'netease' })
  ])
  assert.equal(calls, 2)
  assert.deepEqual(a, b)
})

test('classifies timeouts and falls back without leaking request credentials', async () => {
  const events = []
  const adapter = new NeteaseCommentsAdapter({
    timeoutMs: 10,
    fetchImpl: async (url, init) => {
      if (url.includes('/api/v2/')) {
        return await new Promise((_resolve, reject) => init.signal.addEventListener('abort', () => reject(init.signal.reason), { once: true }))
      }
      return response(legacyBody())
    },
    logger: event => events.push(event)
  })
  const result = await adapter.getComments({ id: '186016', source: 'netease' })
  assert.equal(result.comments[0].content, '备用评论')
  assert.ok(events.some(event => event.errorType === 'timeout' && event.attempt === 'primary'))
})
