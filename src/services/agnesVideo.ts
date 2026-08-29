/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { Capacitor } from '@capacitor/core'
import { Directory, Filesystem } from '@capacitor/filesystem'
import { FileTransfer } from '@capacitor/file-transfer'
import { Share } from '@capacitor/share'
import { requestVideoApi, type VideoConnectionMode } from './videoHttp'

export const AGNES_VIDEO_MODEL = 'agnes-video-v2.0' as const
export const AGNES_DEFAULT_BASE_URL = 'https://apihub.agnes-ai.com/v1'

export type AgnesMode = 'text' | 'image' | 'keyframes'
export type AgnesResolution = '480p' | '720p' | '1080p'
export type AgnesRatio = '16:9' | '9:16' | '1:1' | '4:3' | '3:4'
export type AgnesRemoteStatus = 'queued' | 'in_progress' | 'completed' | 'failed' | 'unknown'

export interface AgnesVideoInput {
  prompt: string
  mode: AgnesMode
  resolution: AgnesResolution
  ratio: AgnesRatio
  numFrames: number
  frameRate: number
  imageUrls: string[]
  negativePrompt?: string
  seed?: number
  inferenceSteps?: number
}

export interface AgnesClientConfig {
  apiKey: string
  baseUrl: string
  connectionMode: VideoConnectionMode
}

export interface AgnesSizeMapping {
  adjusted?: boolean
  width?: number
  height?: number
  requested_width?: number
  requested_height?: number
  ratio?: string
  resolution?: string
  message?: string
}

export interface AgnesRemoteTask {
  taskId?: string
  videoId: string
  status: AgnesRemoteStatus
  progress: number
  seconds?: number
  size?: string
  videoUrl?: string
  sizeMapping?: AgnesSizeMapping
  error?: string
}

export class AgnesApiError extends Error {
  status: number
  retryAfterSeconds?: number

  constructor(message: string, status: number, retryAfterSeconds?: number) {
    super(message)
    this.name = 'AgnesApiError'
    this.status = status
    this.retryAfterSeconds = retryAfterSeconds
  }
}

export const AGNES_MODES: Array<{ value: AgnesMode; label: string; description: string }> = [
  { value: 'text', label: '文字', description: '直接从视频描述生成画面' },
  { value: 'image', label: '单图', description: '让一张公开图片自然动起来' },
  { value: 'keyframes', label: '关键帧', description: '在起始与结束画面之间生成过渡' }
]

export const AGNES_RATIOS: AgnesRatio[] = ['16:9', '9:16', '1:1', '4:3', '3:4']
export const AGNES_FRAME_PRESETS = [
  { frames: 81, label: '约 3 秒' },
  { frames: 121, label: '约 5 秒' },
  { frames: 241, label: '约 10 秒' },
  { frames: 441, label: '约 18 秒' }
] as const

const requestedSizes: Record<AgnesResolution, Record<AgnesRatio, { width: number; height: number }>> = {
  '480p': {
    '16:9': { width: 832, height: 448 }, '9:16': { width: 448, height: 832 },
    '1:1': { width: 640, height: 640 }, '4:3': { width: 640, height: 480 }, '3:4': { width: 480, height: 640 }
  },
  '720p': {
    '16:9': { width: 1280, height: 720 }, '9:16': { width: 720, height: 1280 },
    '1:1': { width: 720, height: 720 }, '4:3': { width: 960, height: 720 }, '3:4': { width: 720, height: 960 }
  },
  '1080p': {
    '16:9': { width: 1920, height: 1080 }, '9:16': { width: 1080, height: 1920 },
    '1:1': { width: 1080, height: 1080 }, '4:3': { width: 1440, height: 1080 }, '3:4': { width: 1080, height: 1440 }
  }
}

const cleanBaseUrl = (value: string) => (value || AGNES_DEFAULT_BASE_URL).trim().replace(/\/+$/, '')
const resultRoot = (baseUrl: string) => cleanBaseUrl(baseUrl).replace(/\/v1$/i, '')
const headers = (apiKey: string) => ({ Authorization: `Bearer ${apiKey.trim()}`, 'Content-Type': 'application/json' })
const numberValue = (value: unknown) => Number.isFinite(Number(value)) ? Number(value) : undefined
const errorText = (payload: any, fallback: string) => String(payload?.error?.message || payload?.error || payload?.message || fallback)

const makeApiError = (status: number, payload: any, fallback: string, responseHeaders?: Headers | Record<string, any>) => {
  const message = errorText(payload, fallback)
  const readHeader = (name: string) => responseHeaders instanceof Headers
    ? responseHeaders.get(name)
    : responseHeaders?.[name] || responseHeaders?.[name.toLowerCase()]
  const retryAfter = numberValue(readHeader?.('retry-after'))
  if (status === 401 || status === 403) return new AgnesApiError(`Agnes API Key、账户或接口权限不可用：${message}`, status)
  if (status === 429) return new AgnesApiError(`Agnes 当前请求较多或已触发限流：${message}`, status, retryAfter)
  if ([500, 502, 503, 520].includes(status)) return new AgnesApiError(`Agnes 服务暂时不可用：${message}`, status, retryAfter)
  return new AgnesApiError(`${fallback}：${message}`, status, retryAfter)
}

export const estimateAgnesSeconds = (numFrames: number, frameRate: number) => {
  if (!Number.isFinite(numFrames) || !Number.isFinite(frameRate) || numFrames < 1 || frameRate <= 0) return 0
  return Number((numFrames / frameRate).toFixed(2))
}

export const validateAgnesInput = (input: AgnesVideoInput) => {
  if (!input.prompt.trim()) throw new Error('请填写视频描述')
  if (input.prompt.length > 3000) throw new Error('视频描述不能超过 3000 个字符')
  if (!Number.isInteger(input.numFrames) || input.numFrames < 1 || input.numFrames > 441 || (input.numFrames - 1) % 8 !== 0) {
    throw new Error('视频帧数必须不超过 441，并满足 8n+1 规则')
  }
  if (!Number.isFinite(input.frameRate) || input.frameRate < 1 || input.frameRate > 60) throw new Error('帧率必须在 1 到 60 FPS 之间')
  if (input.negativePrompt && input.negativePrompt.length > 3000) throw new Error('负向提示词不能超过 3000 个字符')
  if (input.seed !== undefined && (!Number.isSafeInteger(input.seed) || input.seed < 0)) throw new Error('Seed 必须是大于或等于 0 的整数')
  if (input.inferenceSteps !== undefined && (!Number.isInteger(input.inferenceSteps) || input.inferenceSteps < 1)) throw new Error('推理步数必须是正整数')
  if (input.mode === 'text' && input.imageUrls.length) throw new Error('文字生成不能包含图片地址')
  if (input.mode === 'image' && input.imageUrls.length !== 1) throw new Error('单图生成需要填写一张公开 HTTPS 图片')
  if (input.mode === 'keyframes' && input.imageUrls.length !== 2) throw new Error('关键帧过渡需要填写起始与结束图片')
  if (input.imageUrls.some(url => !/^https:\/\/[^\s]+$/i.test(url.trim()))) throw new Error('Agnes 图片素材必须使用公开可访问的 HTTPS 地址')
}

export const buildAgnesRequestBody = (input: AgnesVideoInput) => {
  validateAgnesInput(input)
  const size = requestedSizes[input.resolution][input.ratio]
  const body: Record<string, unknown> = {
    model: AGNES_VIDEO_MODEL,
    prompt: input.prompt.trim(),
    width: size.width,
    height: size.height,
    num_frames: input.numFrames,
    frame_rate: input.frameRate
  }
  if (input.mode === 'image') body.image = input.imageUrls[0].trim()
  if (input.mode === 'keyframes') body.extra_body = { image: input.imageUrls.map(url => url.trim()), mode: 'keyframes' }
  if (input.negativePrompt?.trim()) body.negative_prompt = input.negativePrompt.trim()
  if (input.seed !== undefined) body.seed = input.seed
  if (input.inferenceSteps !== undefined) body.num_inference_steps = input.inferenceSteps
  return body
}

export const buildAgnesResultUrl = (baseUrl: string, videoId: string) => {
  const query = new URLSearchParams({ video_id: videoId, model_name: AGNES_VIDEO_MODEL })
  return `${resultRoot(baseUrl)}/agnesapi?${query.toString()}`
}

export const normalizeAgnesRemoteTask = (payload: any, fallbackVideoId = ''): AgnesRemoteTask => {
  const rawStatus = String(payload?.status || '').toLowerCase()
  const status: AgnesRemoteStatus = ['queued', 'in_progress', 'completed', 'failed'].includes(rawStatus)
    ? rawStatus as AgnesRemoteStatus
    : 'unknown'
  const error = payload?.error == null ? '' : errorText(payload, '视频生成失败')
  return {
    taskId: payload?.task_id || payload?.id ? String(payload.task_id || payload.id) : undefined,
    videoId: String(payload?.video_id || fallbackVideoId || ''),
    status,
    progress: Math.max(0, Math.min(100, Number(payload?.progress) || 0)),
    seconds: numberValue(payload?.seconds),
    size: payload?.size ? String(payload.size) : undefined,
    videoUrl: payload?.metadata?.url || payload?.url || undefined,
    sizeMapping: payload?.metadata?.size_mapping,
    error
  }
}

export const createAgnesVideo = async (config: AgnesClientConfig, input: AgnesVideoInput) => {
  if (!config.apiKey.trim()) throw new Error('请填写 Agnes API Key')
  const response = await requestVideoApi({
    url: `${cleanBaseUrl(config.baseUrl)}/videos`, method: 'POST', headers: headers(config.apiKey),
    data: buildAgnesRequestBody(input), connectionMode: config.connectionMode, connectTimeout: 30000, readTimeout: 120000
  })
  const payload: any = response.data
  if (response.status < 200 || response.status >= 300 || payload?.error) throw makeApiError(response.status, payload, 'Agnes 视频任务创建失败', response.headers)
  const task = normalizeAgnesRemoteTask(payload)
  if (!task.videoId) throw new Error('Agnes 接口没有返回 video_id，无法继续查询任务')
  return task
}

export const queryAgnesVideo = async (config: AgnesClientConfig, videoId: string) => {
  if (!config.apiKey.trim()) throw new Error('继续查询需要原 Agnes API Key')
  const response = await requestVideoApi({
    url: buildAgnesResultUrl(config.baseUrl, videoId), method: 'GET', headers: headers(config.apiKey),
    connectionMode: config.connectionMode, connectTimeout: 30000, readTimeout: 60000
  })
  const payload: any = response.data
  if (response.status < 200 || response.status >= 300 || (payload?.error && String(payload?.status).toLowerCase() !== 'failed')) {
    throw makeApiError(response.status, payload, 'Agnes 视频任务查询失败', response.headers)
  }
  return normalizeAgnesRemoteTask(payload, videoId)
}

export const downloadAgnesVideo = async (taskId: string, url: string) => {
  if (!Capacitor.isNativePlatform()) throw new Error('请在安装后的 App 中保存视频')
  await Filesystem.mkdir({ directory: Directory.Data, path: 'agnes-videos', recursive: true }).catch(() => undefined)
  const path = `agnes-videos/${taskId}.mp4`
  const file = await Filesystem.getUri({ directory: Directory.Data, path })
  await FileTransfer.downloadFile({ url, path: file.uri, progress: false, connectTimeout: 60000, readTimeout: 240000 })
  return { path, uri: file.uri, webUrl: Capacitor.convertFileSrc(file.uri) }
}

export const shareAgnesVideo = (uri: string) => Share.share({ title: 'Agnes 视频作品', files: [uri], dialogTitle: '分享或保存视频' })
export const removeAgnesVideoFile = async (path?: string) => {
  if (path && Capacitor.isNativePlatform()) await Filesystem.deleteFile({ directory: Directory.Data, path }).catch(() => undefined)
}
