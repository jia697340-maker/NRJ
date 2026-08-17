import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const STORE_VERSION = 1

const decodeKey = (value) => {
  if (!value) return null
  const trimmed = value.trim()
  const buffer = /^[a-f\d]{64}$/i.test(trimmed) ? Buffer.from(trimmed, 'hex') : Buffer.from(trimmed, 'base64')
  if (buffer.length !== 32) throw new Error('MUSIC_SESSION_KEY 必须是 32 字节的 hex 或 base64 密钥')
  return buffer
}

export class SecureSessionStore {
  constructor({ dataDir, encryptionKey, ttlDays = 90 }) {
    this.dataDir = dataDir
    this.key = decodeKey(encryptionKey)
    this.ttlMs = Math.max(1, Number(ttlDays) || 90) * 24 * 60 * 60 * 1000
    this.sessions = new Map()
    this.saveQueue = Promise.resolve()
  }

  async initialize() {
    await mkdir(this.dataDir, { recursive: true })
    if (!this.key) this.key = await this.loadOrCreateKey()
    try {
      const packed = JSON.parse(await readFile(join(this.dataDir, 'sessions.enc.json'), 'utf8'))
      const decipher = createDecipheriv('aes-256-gcm', this.key, Buffer.from(packed.iv, 'base64'))
      decipher.setAuthTag(Buffer.from(packed.tag, 'base64'))
      const plaintext = Buffer.concat([decipher.update(Buffer.from(packed.data, 'base64')), decipher.final()])
      const parsed = JSON.parse(plaintext.toString('utf8'))
      if (parsed.version === STORE_VERSION && Array.isArray(parsed.sessions)) this.sessions = new Map(parsed.sessions)
    } catch (error) {
      if (error?.code !== 'ENOENT') throw new Error(`音乐会话存储无法解密：${error instanceof Error ? error.message : String(error)}`)
    }
    await this.prune()
  }

  async loadOrCreateKey() {
    const path = join(this.dataDir, 'session.key')
    try {
      return decodeKey(await readFile(path, 'utf8'))
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error
      const key = randomBytes(32)
      await writeFile(path, key.toString('base64'), { encoding: 'utf8', mode: 0o600 })
      return key
    }
  }

  get(sessionId) {
    const value = this.sessions.get(sessionId)
    if (!value) return null
    const now = Date.now()
    if (now - Number(value.lastSeenAt || value.createdAt || 0) > this.ttlMs) {
      this.sessions.delete(sessionId)
      void this.persist().catch(() => undefined)
      return null
    }
    value.lastSeenAt = now
    if (now - Number(value.lastSeenPersistedAt || value.createdAt || 0) > 60 * 60 * 1000) {
      value.lastSeenPersistedAt = now
      void this.persist().catch(() => undefined)
    }
    return value
  }

  ensure(sessionId) {
    let value = this.get(sessionId)
    if (!value) {
      value = { createdAt: Date.now(), lastSeenAt: Date.now(), cookies: {}, pendingQr: {} }
      this.sessions.set(sessionId, value)
    }
    return value
  }

  async setQr(sessionId, source, key) {
    const session = this.ensure(sessionId)
    session.pendingQr[source] = { key, createdAt: Date.now() }
    await this.persist()
  }

  ownsQr(sessionId, source, key) {
    const pending = this.get(sessionId)?.pendingQr?.[source]
    return Boolean(pending && pending.key === key && Date.now() - pending.createdAt < 15 * 60 * 1000)
  }

  async completeQr(sessionId, qrSource, cookie) {
    const session = this.ensure(sessionId)
    const cookieSource = qrSource === 'qq_wx' ? 'qq' : qrSource
    session.cookies[cookieSource] = cookie
    delete session.pendingQr[qrSource]
    await this.persist()
  }

  cookieMap(sessionId) {
    return { ...(this.get(sessionId)?.cookies || {}) }
  }

  async delete(sessionId) {
    this.sessions.delete(sessionId)
    await this.persist()
  }

  async prune() {
    const threshold = Date.now() - this.ttlMs
    const qrThreshold = Date.now() - 15 * 60 * 1000
    let changed = false
    for (const [id, value] of this.sessions) {
      if (Number(value.lastSeenAt || value.createdAt || 0) < threshold) {
        this.sessions.delete(id)
        changed = true
        continue
      }
      for (const [source, pending] of Object.entries(value.pendingQr || {})) {
        if (Number(pending.createdAt || 0) < qrThreshold) {
          delete value.pendingQr[source]
          changed = true
        }
      }
    }
    if (changed) await this.persist()
  }

  persist() {
    this.saveQueue = this.saveQueue.then(async () => {
      const iv = randomBytes(12)
      const cipher = createCipheriv('aes-256-gcm', this.key, iv)
      const plaintext = Buffer.from(JSON.stringify({ version: STORE_VERSION, sessions: [...this.sessions.entries()] }))
      const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()])
      const packed = JSON.stringify({ iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), data: encrypted.toString('base64') })
      const target = join(this.dataDir, 'sessions.enc.json')
      const temporary = `${target}.tmp`
      await writeFile(temporary, packed, { encoding: 'utf8', mode: 0o600 })
      await rename(temporary, target)
    })
    return this.saveQueue
  }
}
