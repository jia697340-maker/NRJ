import assert from 'node:assert/strict'
import {
  buildVeoRequestBody,
  downloadVeoVideo,
  estimateVeoCost,
  getVeoOperation,
  normalizeVeoBaseUrl,
  submitVeoGeneration,
  validateVeoInput,
  type VeoGenerationInput
} from '../src/services/veoVideo.ts'

const baseInput: VeoGenerationInput = {
  prompt: 'A paper boat floats across a quiet pond.',
  model: 'veo-3.1-lite-generate-preview',
  mode: 'text',
  aspectRatio: '16:9',
  resolution: '720p',
  durationSeconds: 4
}

assert.equal(normalizeVeoBaseUrl('https://generativelanguage.googleapis.com/'), 'https://generativelanguage.googleapis.com/v1beta')
assert.equal(normalizeVeoBaseUrl('https://example.com/v1beta'), 'https://example.com/v1beta')
assert.equal(estimateVeoCost('veo-3.1-lite-generate-preview', '720p', 4), 0.2)
assert.equal(estimateVeoCost('veo-3.1-fast-generate-preview', '4k', 8), 2.4)
assert.equal(estimateVeoCost('veo-3.1-lite-generate-preview', '4k', 8), null)

const textBody = await buildVeoRequestBody(baseInput)
assert.deepEqual(textBody, {
  instances: [{ prompt: baseInput.prompt }],
  parameters: { numberOfVideos: 1, aspectRatio: '16:9', resolution: '720p', durationSeconds: 4 }
})

const imageBody = await buildVeoRequestBody({
  ...baseInput,
  mode: 'interpolation',
  durationSeconds: 8,
  firstFrame: new Blob(['first'], { type: 'image/png' }),
  lastFrame: new Blob(['last'], { type: 'image/jpeg' })
})
assert.equal(imageBody.instances[0].image.inlineData.mimeType, 'image/png')
assert.equal(imageBody.instances[0].lastFrame.inlineData.mimeType, 'image/jpeg')
assert.ok(imageBody.instances[0].image.inlineData.data.length > 0)

const referenceBody = await buildVeoRequestBody({
  ...baseInput,
  model: 'veo-3.1-fast-generate-preview',
  mode: 'references',
  durationSeconds: 8,
  referenceImages: [new Blob(['one'], { type: 'image/png' }), new Blob(['two'], { type: 'image/png' })]
})
assert.equal(referenceBody.instances[0].referenceImages.length, 2)
assert.equal(referenceBody.instances[0].referenceImages[0].referenceType, 'asset')

assert.throws(() => validateVeoInput({ ...baseInput, resolution: '1080p' }), /仅支持 8 秒/)
assert.throws(() => validateVeoInput({ ...baseInput, resolution: '4k', durationSeconds: 8 }), /不支持 4K/)
assert.throws(() => validateVeoInput({ ...baseInput, mode: 'references', durationSeconds: 8, referenceImages: [new Blob()] }), /不支持参考图/)
assert.throws(() => validateVeoInput({ ...baseInput, mode: 'interpolation', durationSeconds: 8, firstFrame: new Blob() }), /同时添加首帧和尾帧/)

const originalFetch = globalThis.fetch
const requests: Array<{ url: string; init?: RequestInit }> = []
globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
  const url = String(input)
  requests.push({ url, init })
  if (url.includes(':predictLongRunning')) return new Response(JSON.stringify({ name: 'operations/test-veo' }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  if (url.endsWith('/operations/test-veo')) return new Response(JSON.stringify({ done: true, response: { generateVideoResponse: { generatedSamples: [{ video: { uri: 'https://files.example.com/video.mp4', mimeType: 'video/mp4' } }] } } }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  if (url === 'https://files.example.com/video.mp4') return new Response(new Blob(['video-bytes'], { type: 'video/mp4' }), { status: 200 })
  return new Response(JSON.stringify({ error: { message: 'unexpected test URL' } }), { status: 500 })
}) as typeof fetch

try {
  const client = { apiKey: 'auth-key', baseUrl: 'https://generativelanguage.googleapis.com' }
  const operationName = await submitVeoGeneration(client, baseInput)
  assert.equal(operationName, 'operations/test-veo')
  assert.equal((requests[0].init?.headers as Record<string, string>)['x-goog-api-key'], 'auth-key')
  const operation = await getVeoOperation(client, operationName)
  assert.equal(operation.done, true)
  assert.equal(operation.video?.uri, 'https://files.example.com/video.mp4')
  const video = await downloadVeoVideo(client, operation.video!)
  assert.equal(video.size, 11)
  assert.equal(video.type, 'video/mp4')
} finally {
  globalThis.fetch = originalFetch
}

console.log('Veo video request tests passed')
