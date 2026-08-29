import assert from 'node:assert/strict'
import { buildDoubaoTtsBody, buildDoubaoTtsHeaders, parseDoubaoTtsSse } from '../src/composables/useDoubaoTts.ts'

const config = {
  appId: 'app-id',
  accessToken: 'access-token',
  baseUrl: 'https://openspeech.bytedance.com/api/v3/tts/unidirectional/sse',
  resourceId: 'seed-tts-2.0'
}

const headers = buildDoubaoTtsHeaders(config)
assert.equal(headers['X-Api-App-Key'], 'app-id')
assert.equal(headers['X-Api-Access-Key'], 'access-token')
assert.equal(headers['X-Api-Resource-Id'], 'seed-tts-2.0')
assert.match(headers['X-Api-Request-Id'], /^[0-9a-f-]{36}$/i)

const body = buildDoubaoTtsBody({
  text: '  今天也很想你。  ',
  voiceType: 'zh_female_vv_uranus_bigtts',
  model: 'seed-tts-2.0-expressive',
  speechRate: 250,
  pitchRate: -30,
  loudnessRate: -75,
  sampleRate: 12345,
  stylePrompt: ' 温柔自然 ',
  filterMarkdown: true,
  enableLanguageDetector: false
})
assert.equal(body.req_params.text, '今天也很想你。')
assert.equal(body.req_params.speaker, 'zh_female_vv_uranus_bigtts')
assert.equal(body.req_params.model, 'seed-tts-2.0-expressive')
assert.equal(body.req_params.sample_rate, 24000)
assert.equal(body.req_params.audio_params.speech_rate, 100)
assert.equal(body.req_params.audio_params.loudness_rate, -50)
const additions = JSON.parse(body.req_params.additions)
assert.deepEqual(additions.context_texts, ['温柔自然'])
assert.equal(additions.post_process.pitch, -12)
assert.equal(additions.disable_markdown_filter, false)
assert.equal(additions.enable_language_detector, false)

const first = Buffer.from([0x49, 0x44, 0x33]).toString('base64')
const second = Buffer.from([0x01, 0x02]).toString('base64')
const audio = parseDoubaoTtsSse(`event: 352\ndata: {"code":0,"data":"${first}"}\n\nevent: 352\ndata: {"code":20000000,"data":"${second}"}\n\nevent: 152\ndata: {"code":20000000}\n`)
assert.equal(audio.type, 'audio/mpeg')
assert.deepEqual([...new Uint8Array(await audio.arrayBuffer())], [0x49, 0x44, 0x33, 0x01, 0x02])

assert.throws(() => parseDoubaoTtsSse('data: {"code":55000000,"message":"resource not granted"}\n', 'log-1'), /resource not granted.*log-1/)
assert.throws(() => parseDoubaoTtsSse('event: 152\ndata: {"code":20000000}\n', 'log-2'), /未返回有效音频.*log-2/)

console.log('Doubao TTS adapter tests passed')
