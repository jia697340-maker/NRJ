import assert from 'node:assert/strict'
import test from 'node:test'
import { createMemoryRateLimiter, createMusicCommentsHandler } from '../src/comments-http.mjs'
import { NeteaseCommentError } from '../src/netease-comments.mjs'

test('public comments handler accepts anonymous GET requests and clamps public inputs', async () => {
  let received
  const handler = createMusicCommentsHandler({
    adapter: {
      async getComments(input) {
        received = input
        return { total: 1, more: false, hotComments: [], comments: [{ id: '1', content: '真实评论' }] }
      }
    },
    allowRequest: () => true
  })
  const response = await handler(new Request('https://nrj.example/.netlify/functions/music-comments?neteaseId=186016&source=netease&limit=999&offset=-3'))
  const body = await response.json()
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('cache-control'), 'no-store')
  assert.match(response.headers.get('x-request-id'), /^[0-9a-f]{16}$/)
  assert.equal(received.neteaseId, '186016')
  assert.equal(received.limit, 50)
  assert.equal(received.offset, 0)
  assert.equal(body.data.comments[0].content, '真实评论')
})

test('public comments handler exposes only safe validation errors', async () => {
  const handler = createMusicCommentsHandler({
    adapter: { async getComments() { throw new NeteaseCommentError('internal detail', { status: 404, code: 'NETEASE_TRACK_NOT_FOUND' }) } },
    allowRequest: () => true
  })
  const response = await handler(new Request('https://nrj.example/.netlify/functions/music-comments?name=wrong'))
  const body = await response.json()
  assert.equal(response.status, 404)
  assert.equal(body.error, 'NETEASE_TRACK_NOT_FOUND')
  assert.equal(body.msg, '未找到可靠的网易云对应歌曲')
  assert.equal(JSON.stringify(body).includes('internal detail'), false)
})

test('public comments handler rejects writes and rate-limits repeated readers', async () => {
  let now = 100
  const allowRequest = createMemoryRateLimiter({ limit: 1, windowMs: 1000, now: () => now })
  const handler = createMusicCommentsHandler({
    adapter: { async getComments() { return { total: 0, comments: [], hotComments: [] } } },
    allowRequest
  })
  const url = 'https://nrj.example/.netlify/functions/music-comments?neteaseId=186016'
  assert.equal((await handler(new Request(url, { method: 'POST' }))).status, 405)
  assert.equal((await handler(new Request(url))).status, 200)
  assert.equal((await handler(new Request(url))).status, 429)
  now += 1001
  assert.equal((await handler(new Request(url))).status, 200)
})

