import { musicSessionStore } from '../lib/music-session-store.mjs'

export default async () => {
  const deleted = await musicSessionStore.deleteExpired()
  return Response.json({ success: true, deleted }, { headers: { 'Cache-Control': 'no-store' } })
}

export const config = { schedule: '@daily' }

