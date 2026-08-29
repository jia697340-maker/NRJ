import assert from 'node:assert/strict'
import {
  buildGeminiOmniRequestBody,
  createGeminiOmniInteraction,
  downloadGeminiOmniVideo,
  estimateGeminiOmniCost,
  getGeminiOmniInteraction,
  normalizeGeminiOmniBaseUrl,
  validateGeminiOmniInput,
  type GeminiOmniInput
} from '../src/services/geminiOmniVideo.ts'

const client = { apiKey: 'test-key', baseUrl: 'https://generativelanguage.googleapis.com' }
const baseInput: GeminiOmniInput = {
  prompt: 'A paper boat floats across a quiet pond.',
  mode: 'text',
  aspectRatio: '16:9',
  resolution: '360p',
  durationSeconds: 6
}

assert.equal(normalizeGeminiOmniBaseUrl('https://generativelanguage.googleapis.com/'), 'https://generativelanguage.googleapis.com/v1beta')
assert.equal(normalizeGeminiOmniBaseUrl('https://example.com/v1beta'), 'https://example.com/v1beta')
assert.equal(estimateGeminiOmniCost('360p', 10), 0.3)
assert.equal(estimateGeminiOmniCost('720p', 10), 1)
assert.equal(estimateGeminiOmniCost('1080p', 10), 1.5)
assert.equal(estimateGeminiOmniCost('4k', 10), 3)
assert.throws(() => validateGeminiOmniInput({ ...baseInput, prompt: '' }), /填写视频描述/)
assert.throws(() => validateGeminiOmniInput({ ...baseInput, mode: 'image' }), /起始图片/)
assert.throws(() => validateGeminiOmniInput({ ...baseInput, mode: 'interpolation', firstFrame: new Blob() }), /首帧和尾帧/)
assert.throws(() => validateGeminiOmniInput({ ...baseInput, mode: 'references', referenceImages: [] }), /至少添加一项/)
assert.throws(() => validateGeminiOmniInput({ ...baseInput, mode: 'edit' }), /待修改视频/)

const body = await buildGeminiOmniRequestBody(client, baseInput)
assert.equal(body.model, 'gemini-omni-1.1-flash')
assert.equal(body.response_format.aspect_ratio, '16:9')
assert.equal(body.response_format.resolution, '360p')
assert.equal(body.generation_config.video_config.task, 'text_to_video')
assert.match(JSON.stringify(body.input), /Target duration: 6 seconds/)

const continuation = await buildGeminiOmniRequestBody(client, { ...baseInput, mode: 'edit', previousInteractionId: 'v1_parent' })
assert.equal(continuation.previous_interaction_id, 'v1_parent')
assert.match(String(continuation.input), /Target duration: 6 seconds/)
assert.equal(continuation.generation_config.video_config.task, 'edit')

const originalFetch = globalThis.fetch
const requests: Array<{ url: string; init?: RequestInit }> = []
globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
  const url = String(input)
  requests.push({ url, init })
  if (url.endsWith('/interactions') && init?.method === 'POST') return new Response(JSON.stringify({ id: 'v1_test', status: 'in_progress' }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  if (url.endsWith('/interactions/v1_test')) return new Response(JSON.stringify({ id: 'v1_test', status: 'completed', steps: [{ type: 'model_output', content: [{ type: 'video', mime_type: 'video/mp4', data: btoa('video-bytes') }] }] }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  return new Response(JSON.stringify({ error: { message: 'unexpected test URL' } }), { status: 500 })
}) as typeof fetch

try {
  const created = await createGeminiOmniInteraction(client, baseInput)
  assert.equal(created.id, 'v1_test')
  assert.equal(created.status, 'in_progress')
  assert.equal((requests[0].init?.headers as Record<string, string>)['x-goog-api-key'], 'test-key')
  const completed = await getGeminiOmniInteraction(client, created.id)
  assert.equal(completed.status, 'completed')
  assert.ok(completed.video?.data)
  const video = await downloadGeminiOmniVideo(client, completed.video!)
  assert.equal(video.size, 11)
  assert.equal(video.type, 'video/mp4')
} finally {
  globalThis.fetch = originalFetch
}

console.log('Gemini Omni video request tests passed')
