import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  AGNES_DEFAULT_BASE_URL, AGNES_VIDEO_MODEL, buildAgnesRequestBody, buildAgnesResultUrl,
  estimateAgnesSeconds, normalizeAgnesRemoteTask, validateAgnesInput, type AgnesVideoInput
} from '../src/services/agnesVideo'

const base: AgnesVideoInput = {
  prompt: 'A cat walking through warm sunlight', mode: 'text', resolution: '720p', ratio: '16:9',
  numFrames: 121, frameRate: 24, imageUrls: [], negativePrompt: 'flicker', seed: 42
}

assert.equal(AGNES_DEFAULT_BASE_URL, 'https://apihub.agnes-ai.com/v1')
assert.equal(AGNES_VIDEO_MODEL, 'agnes-video-v2.0')
assert.equal(estimateAgnesSeconds(121, 24), 5.04)
const resultUrl = new URL(buildAgnesResultUrl('https://apihub.agnes-ai.com/v1/', 'video_123'))
assert.equal(`${resultUrl.origin}${resultUrl.pathname}`, 'https://apihub.agnes-ai.com/agnesapi')
assert.equal(resultUrl.searchParams.get('video_id'), 'video_123')
assert.equal(resultUrl.searchParams.get('model_name'), 'agnes-video-v2.0')
assert.deepEqual(buildAgnesRequestBody(base), {
  model: 'agnes-video-v2.0', prompt: base.prompt, width: 1280, height: 720,
  num_frames: 121, frame_rate: 24, negative_prompt: 'flicker', seed: 42
})
assert.deepEqual(buildAgnesRequestBody({ ...base, mode: 'image', imageUrls: ['https://example.com/start.png'] }), {
  model: 'agnes-video-v2.0', prompt: base.prompt, width: 1280, height: 720,
  num_frames: 121, frame_rate: 24, image: 'https://example.com/start.png', negative_prompt: 'flicker', seed: 42
})
assert.deepEqual(buildAgnesRequestBody({ ...base, mode: 'keyframes', imageUrls: ['https://example.com/a.png', 'https://example.com/b.png'] }).extra_body, {
  image: ['https://example.com/a.png', 'https://example.com/b.png'], mode: 'keyframes'
})
assert.doesNotThrow(() => validateAgnesInput(base))
assert.throws(() => validateAgnesInput({ ...base, numFrames: 120 }), /8n\+1/)
assert.doesNotThrow(() => validateAgnesInput({ ...base, numFrames: 1 }))
assert.throws(() => validateAgnesInput({ ...base, frameRate: 61 }), /1 到 60/)
assert.throws(() => validateAgnesInput({ ...base, mode: 'image', imageUrls: ['data:image/png;base64,abc'] }), /公开可访问的 HTTPS/)
assert.throws(() => validateAgnesInput({ ...base, mode: 'keyframes', imageUrls: ['https://example.com/a.png'] }), /起始与结束/)
assert.deepEqual(normalizeAgnesRemoteTask({
  task_id: 'task_123', video_id: 'video_123', status: 'completed', progress: 100,
  seconds: '5.0', size: '1280x720', metadata: { url: 'https://example.com/video.mp4', size_mapping: { adjusted: true, resolution: '720p' } }
}), {
  taskId: 'task_123', videoId: 'video_123', status: 'completed', progress: 100, seconds: 5,
  size: '1280x720', videoUrl: 'https://example.com/video.mp4', sizeMapping: { adjusted: true, resolution: '720p' }, error: ''
})

const hall = readFileSync(new URL('../src/components/app_VideoHall.vue', import.meta.url), 'utf8')
const view = readFileSync(new URL('../src/components/video/AgnesVideoAccessView.vue', import.meta.url), 'utf8')
for (const marker of ['AgnesVideoAccessView', "id: 'agnes'", "currentView === 'agnes'"]) assert.ok(hall.includes(marker), `视频大厅缺少 Agnes 入口：${marker}`)
for (const marker of ['网页直连', 'App 直连', '关键帧', '负向提示词', '继续查询', '复用参数', '删除', '@media(max-width:340px)']) assert.ok(view.includes(marker), `Agnes 页面缺少用户可触达能力：${marker}`)

console.log('Agnes video request tests passed')
