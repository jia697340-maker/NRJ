import { createMusicCommentsHandler } from '../../music-gateway/src/comments-http.mjs'
import { NeteaseCommentsAdapter } from '../../music-gateway/src/netease-comments.mjs'

const adapter = new NeteaseCommentsAdapter({
  timeoutMs: Number(process.env.MUSIC_COMMENT_TIMEOUT_MS || 10_000),
  freshTtlMs: Number(process.env.MUSIC_COMMENT_CACHE_TTL_MS || 15 * 60_000),
  staleTtlMs: Number(process.env.MUSIC_COMMENT_STALE_TTL_MS || 7 * 24 * 60 * 60_000),
  cacheMaxEntries: Number(process.env.MUSIC_COMMENT_CACHE_MAX_ENTRIES || 1000),
  logger: event => console.error(`[music-comments] ${JSON.stringify(event)}`)
})

export const handler = createMusicCommentsHandler({ adapter })
export default handler

