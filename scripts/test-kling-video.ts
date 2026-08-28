import assert from 'node:assert/strict'
import {
  buildKlingPrompt,
  buildKlingRequest,
  estimateKlingCost,
  supportsKlingMode,
  validateKlingInput,
  type KlingGenerationInput
} from '../src/services/klingVideo.ts'

const baseInput: KlingGenerationInput = {
  prompt: '雨夜街道上，一名女孩缓慢回头。',
  model: 'kling-3.0',
  mode: 'text',
  aspectRatio: '9:16',
  resolution: '720p',
  duration: 5,
  audio: 'off',
  multiShot: 'off',
  shots: [],
  watermark: false,
  externalTaskId: 'nrj_test_1'
}

assert.equal(supportsKlingMode('kling-3.0', 'references'), false)
assert.equal(supportsKlingMode('kling-3.0-omni', 'references'), true)
assert.equal(estimateKlingCost(baseInput), 3)
assert.equal(estimateKlingCost({ ...baseInput, model: 'kling-3.0-omni', audio: 'native', resolution: '1080p' }), 5)

const textRequest = await buildKlingRequest(baseInput)
assert.equal(textRequest.endpoint, '/text-to-video/kling-3.0')
assert.deepEqual(textRequest.body, {
  prompt: baseInput.prompt,
  settings: { resolution: '720p', duration: 5, audio: 'off', multi_shot: false, aspect_ratio: '9:16' },
  options: { external_task_id: 'nrj_test_1', watermark_info: { enabled: false } }
})

const image = new Blob(['image'], { type: 'image/png' })
const omniRequest = await buildKlingRequest({
  ...baseInput,
  model: 'kling-3.0-omni',
  mode: 'references',
  referenceImages: [image],
  elements: [{ elementId: '173', alias: '@girl' }]
})
assert.equal(omniRequest.endpoint, '/omni-video/kling-3.0-omni')
assert.equal((omniRequest.body as any).contents[1].type, 'refer_image')
assert.match((omniRequest.body as any).contents[1].url, /^data:image\/png;base64,/)
assert.deepEqual((omniRequest.body as any).contents[2], { type: 'element', element_id: '173', id: 'girl' })

const customInput: KlingGenerationInput = {
  ...baseInput,
  duration: 6,
  multiShot: 'custom',
  shots: [
    { id: 'a', duration: 2, prompt: '雨滴落在车窗上' },
    { id: 'b', duration: 4, prompt: '女孩看向窗外' }
  ]
}
assert.equal(buildKlingPrompt(customInput), '镜头 1, 2, 雨滴落在车窗上; 镜头 2, 4, 女孩看向窗外')
assert.doesNotThrow(() => validateKlingInput(customInput))
assert.throws(() => validateKlingInput({ ...customInput, duration: 5 }), /时长之和/)
assert.throws(() => validateKlingInput({ ...baseInput, mode: 'interpolation', firstFrame: image }), /首帧和尾帧/)
assert.throws(() => validateKlingInput({ ...baseInput, model: 'kling-3.0-omni', mode: 'feature_video', referenceVideoUrl: 'http://example.com/a.mp4', multiShot: 'auto' }), /HTTPS/)

console.log('Kling video request tests passed')
