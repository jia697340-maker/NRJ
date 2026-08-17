import assert from 'node:assert/strict'
import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { SecureSessionStore } from '../src/secure-store.mjs'

test('separates sessions and encrypts platform credentials at rest', async () => {
  const dataDir = await mkdtemp(join(tmpdir(), 'clingy-music-store-'))
  const key = Buffer.alloc(32, 7).toString('base64')
  const store = new SecureSessionStore({ dataDir, encryptionKey: key, ttlDays: 90 })
  await store.initialize()
  await store.setQr('user-a', 'netease', 'qr-a')
  await store.completeQr('user-a', 'netease', 'MUSIC_U=secret-a')
  await store.setQr('user-b', 'qq', 'qr-b')
  await store.completeQr('user-b', 'qq', 'uin=secret-b')

  assert.deepEqual(store.cookieMap('user-a'), { netease: 'MUSIC_U=secret-a' })
  assert.deepEqual(store.cookieMap('user-b'), { qq: 'uin=secret-b' })
  assert.equal(store.ownsQr('user-b', 'netease', 'qr-a'), false)

  const ciphertext = await readFile(join(dataDir, 'sessions.enc.json'), 'utf8')
  assert.equal(ciphertext.includes('secret-a'), false)
  assert.equal(ciphertext.includes('secret-b'), false)

  const restored = new SecureSessionStore({ dataDir, encryptionKey: key, ttlDays: 90 })
  await restored.initialize()
  assert.deepEqual(restored.cookieMap('user-a'), { netease: 'MUSIC_U=secret-a' })
})
