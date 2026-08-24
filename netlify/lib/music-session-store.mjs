import { getStore } from '@netlify/blobs'

const STORE_NAME = 'nrj-music-account-sessions'
const memory = new Map()
const usePersistentStore = () => process.env.NETLIFY === 'true' || Boolean(process.env.NETLIFY_SITE_ID)

const blobStore = () => getStore({ name: STORE_NAME, consistency: 'strong' })

export const musicSessionStore = {
  async get(key) {
    if (!usePersistentStore()) return memory.get(key) || null
    return await blobStore().get(key, { type: 'json', consistency: 'strong' })
  },
  async set(key, value) {
    if (!usePersistentStore()) {
      memory.set(key, structuredClone(value))
      return
    }
    await blobStore().setJSON(key, value)
  },
  async delete(key) {
    if (!key) return
    if (!usePersistentStore()) {
      memory.delete(key)
      return
    }
    await blobStore().delete(key)
  },
  async deleteExpired(now = Date.now()) {
    if (!usePersistentStore()) {
      let deleted = 0
      for (const [key, value] of memory) {
        if (Number(value?.expiresAt || 0) > 0 && Number(value.expiresAt) <= now) {
          memory.delete(key)
          deleted += 1
        }
      }
      return deleted
    }
    let deleted = 0
    for await (const page of blobStore().list({ paginate: true })) {
      for (const blob of page.blobs) {
        const value = await blobStore().get(blob.key, { type: 'json', consistency: 'strong' })
        if (Number(value?.expiresAt || 0) > 0 && Number(value.expiresAt) <= now) {
          await blobStore().delete(blob.key)
          deleted += 1
        }
      }
    }
    return deleted
  }
}
