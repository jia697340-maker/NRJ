import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  SEEDANCE_MODEL,
  buildSeedanceRequestBody,
  validateSeedanceInput,
  type SeedanceGenerationInput
} from '../src/services/seedanceVideo.ts'

const baseInput: SeedanceGenerationInput = {
  prompt: '雨夜街道，镜头缓慢推进',
  model: SEEDANCE_MODEL,
  mode: 'text',
  resolution: '720p',
  ratio: '16:9',
  duration: 10,
  generateAudio: true,
  watermark: false,
  returnLastFrame: true,
  media: []
}

assert.deepEqual(buildSeedanceRequestBody(baseInput), {
  model: SEEDANCE_MODEL,
  content: [{ type: 'text', text: baseInput.prompt }],
  generate_audio: true,
  resolution: '720p',
  ratio: '16:9',
  duration: 10,
  watermark: false,
  return_last_frame: true
})

const references = buildSeedanceRequestBody({
  ...baseInput,
  mode: 'references',
  media: [
    { role: 'reference_image', url: 'data:image/png;base64,AAAA' },
    { role: 'reference_video', url: 'https://example.com/reference.mp4' },
    { role: 'reference_audio', url: 'asset://audio-1' }
  ]
})
assert.equal(references.omni_reference_task_type, 'reference')
assert.equal((references.content as any[])[1].role, 'reference_image')
assert.equal((references.content as any[])[2].type, 'video_url')

assert.doesNotThrow(() => validateSeedanceInput({
  ...baseInput,
  mode: 'interpolation',
  media: [
    { role: 'first_frame', url: 'https://example.com/first.png' },
    { role: 'last_frame', url: 'https://example.com/last.png' }
  ]
}))
assert.doesNotThrow(() => validateSeedanceInput({
  ...baseInput,
  mode: 'audio',
  media: [{ role: 'reference_audio', url: 'data:audio/mpeg;base64,AAAA' }]
}))
assert.throws(() => validateSeedanceInput({ ...baseInput, duration: 31 }), /4 到 30 秒/)
assert.throws(() => validateSeedanceInput({ ...baseInput, mode: 'image' }), /首帧/)
assert.throws(() => validateSeedanceInput({ ...baseInput, mode: 'edit', media: [{ role: 'reference_video', url: 'file:\/\/private.mp4' }], ratio: 'adaptive' }), /公开 HTTPS/)
assert.throws(() => validateSeedanceInput({
  ...baseInput,
  mode: 'references',
  media: [
    { role: 'first_frame', url: 'https://example.com/first.png' },
    { role: 'reference_audio', url: 'https://example.com/audio.mp3' }
  ]
}), /不能与全模态参考素材混用/)

const hallSource = readFileSync(new URL('../src/components/app_VideoHall.vue', import.meta.url), 'utf8')
for (const platform of ['VeoVideoAccessView', 'KlingVideoAccessView', 'WanVideoAccessView', 'SeedanceVideoAccessView']) {
  assert.ok(hallSource.includes(platform), `视频大厅缺少平台入口：${platform}`)
}
const seedanceViewSource = readFileSync(new URL('../src/components/video/SeedanceVideoAccessView.vue', import.meta.url), 'utf8')
const seedanceServiceSource = readFileSync(new URL('../src/services/seedanceVideo.ts', import.meta.url), 'utf8')
for (const userFacingCapability of ['文字', '首帧', '首尾帧', '全模态参考', '音频驱动', '编辑', '延长', '作品', '暂停查询', '继续查询']) {
  assert.ok(`${seedanceViewSource}\n${seedanceServiceSource}`.includes(userFacingCapability), `Seedance 页面缺少用户可触达能力：${userFacingCapability}`)
}
for (const narrowScreenGuard of ['min-width:0', 'text-overflow:ellipsis', '@media(max-width:360px)', 'overflow-x:auto']) {
  assert.ok(seedanceViewSource.includes(narrowScreenGuard), `Seedance 页面缺少窄屏保护：${narrowScreenGuard}`)
}

console.log('Seedance video request tests passed')
