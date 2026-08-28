import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  buildWanBaseUrl,
  buildWanRequestBody,
  estimateWanCost,
  validateWanInput,
  type WanGenerationInput
} from '../src/services/wanVideo.ts'

const baseInput: WanGenerationInput = {
  prompt: '月光下，一只白猫沿着屋顶奔跑，远处城市霓虹闪烁。',
  model: 'wan3.0-video',
  mode: 'text',
  resolution: '720P',
  ratio: '16:9',
  duration: 5,
  audio: true,
  promptExtend: true,
  watermark: false,
  media: []
}

const wanViewSource = readFileSync(new URL('../src/components/video/WanVideoAccessView.vue', import.meta.url), 'utf8')
for (const requiredSelector of ['.wan-hall{', '.hall-header{', '.create-section', '.generate-button{', '.work-card{']) {
  assert.ok(wanViewSource.includes(requiredSelector), `Wan 页面缺少主样式：${requiredSelector}`)
}

assert.equal(buildWanBaseUrl('llm-demo', 'cn-beijing'), 'https://llm-demo.cn-beijing.maas.aliyuncs.com')
assert.equal(buildWanBaseUrl('llm-demo', 'ap-southeast-1'), 'https://llm-demo.ap-southeast-1.maas.aliyuncs.com')
assert.equal(buildWanBaseUrl('', 'cn-beijing'), '')
assert.equal(estimateWanCost('wan3.0-video', '720P', 5), 3)
assert.equal(estimateWanCost('wan3.0-video-prime', '1080P', 30), 54)
assert.equal(estimateWanCost('wan3.0-video', '720P', 5, 'ap-southeast-1'), 3.75)
assert.equal(estimateWanCost('wan3.0-video', '480P', -1), null)

assert.deepEqual(buildWanRequestBody(baseInput), {
  model: 'wan3.0-video',
  input: { prompt: baseInput.prompt },
  parameters: {
    resolution: '720P',
    ratio: '16:9',
    duration: 5,
    audio: true,
    prompt_extend: true,
    watermark: false
  }
})

const imageRequest = buildWanRequestBody({
  ...baseInput,
  mode: 'image',
  ratio: 'adaptive',
  media: [{ type: 'first_frame', url: 'data:image/jpeg;base64,YWJj', label: '起始画面.jpg' }]
})
assert.deepEqual(imageRequest.input.media, [{ type: 'first_frame', url: 'data:image/jpeg;base64,YWJj' }])

const interpolationRequest = buildWanRequestBody({
  ...baseInput,
  mode: 'interpolation',
  ratio: 'adaptive',
  media: [
    { type: 'first_frame', url: 'https://example.com/start.jpg' },
    { type: 'last_frame', url: 'https://example.com/end.jpg' }
  ]
})
assert.equal((interpolationRequest.input.media as unknown[]).length, 2)

const referenceRequest = buildWanRequestBody({
  ...baseInput,
  mode: 'references',
  media: [
    { type: 'reference_image', url: 'https://example.com/role.jpg' },
    { type: 'reference_video', url: 'oss://dashscope-instant/scene.mp4' },
    { type: 'reference_audio', url: 'https://example.com/voice.mp3' }
  ],
  seed: 42
})
assert.equal(referenceRequest.parameters.seed, 42)
assert.equal((referenceRequest.input.media as unknown[]).length, 3)

for (const input of [
  { ...baseInput, prompt: '', mode: 'file' as const, media: [{ type: 'file' as const, url: 'oss://dashscope-instant/brief.pdf' }] },
  { ...baseInput, prompt: '', mode: 'link' as const, media: [{ type: 'link' as const, url: 'https://example.com/article' }] },
  { ...baseInput, mode: 'edit' as const, media: [{ type: 'reference_video' as const, url: 'https://example.com/source.mp4' }] },
  { ...baseInput, mode: 'extension' as const, ratio: 'adaptive' as const, duration: -1, media: [{ type: 'reference_video' as const, url: 'https://example.com/source.mp4' }] }
]) assert.doesNotThrow(() => buildWanRequestBody(input))

assert.doesNotThrow(() => validateWanInput({ ...baseInput, duration: -1 }))
assert.throws(() => validateWanInput({ ...baseInput, duration: 1 }), /2 到 30 秒/)
assert.throws(() => validateWanInput({ ...baseInput, seed: 2147483648 }), /Seed/)
assert.throws(() => validateWanInput({ ...baseInput, prompt: 'a'.repeat(20001) }), /20000/)
assert.throws(() => validateWanInput({ ...baseInput, media: [{ type: 'reference_image', url: 'file:\/\/private.jpg' }] }), /HTTP、HTTPS、OSS/)
assert.throws(() => validateWanInput({ ...baseInput, mode: 'image' }), /首帧图片/)
assert.throws(() => validateWanInput({
  ...baseInput,
  mode: 'references',
  media: [
    { type: 'first_frame', url: 'https://example.com/start.jpg' },
    { type: 'reference_image', url: 'https://example.com/role.jpg' }
  ]
}), /不能与参考素材/)
assert.throws(() => validateWanInput({
  ...baseInput,
  mode: 'extension',
  ratio: '16:9',
  media: [{ type: 'reference_video', url: 'https://example.com/source.mp4' }]
}), /自适应比例/)
assert.throws(() => validateWanInput({
  ...baseInput,
  mode: 'references',
  media: Array.from({ length: 11 }, (_, index) => ({ type: 'reference_image' as const, url: `https://example.com/${index}.jpg` }))
}), /最多 10 张/)

console.log('Wan video tests passed')
