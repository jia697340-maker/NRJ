/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import assert from 'node:assert/strict'

class MemoryStorage {
  private values = new Map<string, string>()
  getItem(key: string) { return this.values.get(key) ?? null }
  setItem(key: string, value: string) { this.values.set(key, String(value)) }
  removeItem(key: string) { this.values.delete(key) }
  clear() { this.values.clear() }
  key(index: number) { return [...this.values.keys()][index] ?? null }
  get length() { return this.values.size }
}

Object.assign(globalThis, {
  localStorage: new MemoryStorage(),
  sessionStorage: new MemoryStorage(),
  atob: (value: string) => Buffer.from(value, 'base64').toString('binary')
})

const {
  FISH_AUDIO_CONFIG_KEY,
  FISH_AUDIO_SESSION_KEY,
  generateFishAudio,
  loadFishAudioConfig,
  normalizeFishAudioReferenceId
} = await import('../src/composables/useFishAudio')

assert.equal(normalizeFishAudioReferenceId(' 802e3bc2b27e49c2995d23ef70e6ac89 '), '802e3bc2b27e49c2995d23ef70e6ac89')
assert.equal(normalizeFishAudioReferenceId('https://fish.audio/m/802e3bc2b27e49c2995d23ef70e6ac89/'), '802e3bc2b27e49c2995d23ef70e6ac89')

localStorage.setItem(FISH_AUDIO_CONFIG_KEY, JSON.stringify({
  connectionMode: 'web', model: 's1', format: 'opus', sampleRate: 32000, mp3Bitrate: 192,
  latency: 'balanced', normalize: false, chunkLength: 999
}))
sessionStorage.setItem(FISH_AUDIO_SESSION_KEY, 'session-key')
const loaded = loadFishAudioConfig()
assert.equal(loaded.apiKey, 'session-key')
assert.equal(loaded.model, 's1')
assert.equal(loaded.format, 'opus')
assert.equal(loaded.sampleRate, 48000)
assert.equal(loaded.chunkLength, 300)
assert.equal(loaded.normalize, false)

let captured: { url?: string; init?: RequestInit } = {}
globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
  captured = { url: String(url), init }
  return new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { 'Content-Type': 'audio/mpeg' } })
}) as typeof fetch

const audio = await generateFishAudio({ ...loaded, format: 'mp3', sampleRate: 44100 }, {
  text: '今天也很想你。',
  referenceId: 'https://fish.audio/m/voice-123',
  stylePrompt: '温柔地说\n[不要外泄]',
  speed: 1.1,
  volume: 2,
  temperature: 0.8,
  topP: 0.6
})
assert.equal(audio.size, 3)
assert.equal(captured.url, 'https://api.fish.audio/v1/tts')
assert.equal((captured.init?.headers as Record<string, string>).Authorization, 'Bearer session-key')
assert.equal((captured.init?.headers as Record<string, string>).model, 's1')
const payload = JSON.parse(String(captured.init?.body))
assert.equal(payload.reference_id, 'voice-123')
assert.equal(payload.prosody.speed, 1.1)
assert.equal(payload.prosody.volume, 2)
assert.equal(payload.temperature, 0.8)
assert.equal(payload.top_p, 0.6)
assert.equal(payload.text, '(温柔地说 不要外泄) 今天也很想你。')
assert.equal(payload.chunk_length, 300)

globalThis.fetch = (async () => new Response(JSON.stringify({ message: 'bad key' }), { status: 401, headers: { 'Content-Type': 'application/json' } })) as typeof fetch
await assert.rejects(
  () => generateFishAudio({ ...loaded, format: 'mp3' }, { text: '测试' }),
  /API Key 无效或已过期/
)

sessionStorage.clear()
await assert.rejects(
  () => generateFishAudio({ ...loaded, apiKey: '', format: 'mp3' }, { text: '测试' }),
  /MISSING_FISH_AUDIO_API_KEY/
)

console.log('Fish Audio adapter tests passed')
