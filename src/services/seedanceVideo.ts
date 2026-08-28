/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { Capacitor, CapacitorHttp } from '@capacitor/core'
import { Directory, Filesystem } from '@capacitor/filesystem'
import { FileTransfer } from '@capacitor/file-transfer'
import { Share } from '@capacitor/share'

export type SeedanceModel = 'doubao-seedance-2-5-260628'
export type SeedanceMode = 'text' | 'image' | 'interpolation' | 'references' | 'audio' | 'edit' | 'extension'
export type SeedanceResolution = '480p' | '720p' | '1080p'
export type SeedanceRatio = 'adaptive' | '16:9' | '4:3' | '1:1' | '3:4' | '9:16' | '21:9'
export type SeedanceMediaRole = 'first_frame' | 'last_frame' | 'reference_image' | 'reference_video' | 'reference_audio'

export interface SeedanceMedia {
  role: SeedanceMediaRole
  url: string
  label?: string
}

export interface SeedanceGenerationInput {
  prompt: string
  model: SeedanceModel
  mode: SeedanceMode
  resolution: SeedanceResolution
  ratio: SeedanceRatio
  duration: number
  generateAudio: boolean
  watermark: boolean
  returnLastFrame: boolean
  seed?: number
  media: SeedanceMedia[]
}

export interface SeedanceClientConfig {
  apiKey: string
  baseUrl?: string
}

export interface SeedanceUsage {
  completion_tokens?: number
  total_tokens?: number
}

export interface SeedanceRemoteTask {
  id: string
  model?: string
  status: 'queued' | 'running' | 'cancelled' | 'succeeded' | 'failed' | 'expired' | 'unknown'
  errorCode?: string
  errorMessage?: string
  videoUrl?: string
  lastFrameUrl?: string
  createdAt?: number
  updatedAt?: number
  seed?: number
  resolution?: SeedanceResolution
  ratio?: SeedanceRatio
  duration?: number
  framesPerSecond?: number
  generateAudio?: boolean
  usage?: SeedanceUsage
}

export const SEEDANCE_DEFAULT_BASE_URL = 'https://ark.cn-beijing.volces.com'
export const SEEDANCE_MODEL: SeedanceModel = 'doubao-seedance-2-5-260628'

export const SEEDANCE_MODES: Array<{ value: SeedanceMode; label: string; description: string }> = [
  { value: 'text', label: '文字', description: '最长 30 秒原生音画与完整叙事' },
  { value: 'image', label: '首帧', description: '严格从指定图片开始生成' },
  { value: 'interpolation', label: '首尾帧', description: '控制视频开始与结束画面' },
  { value: 'references', label: '全模态参考', description: '组合图片、视频与音频创作' },
  { value: 'audio', label: '音频驱动', description: '只用音频参考生成匹配画面' },
  { value: 'edit', label: '编辑', description: '按时间段修改现有视频' },
  { value: 'extension', label: '延长', description: '保持人物、场景和声音继续叙事' }
]

const isHttpOrAssetUrl = (value: string) => /^(https?:\/\/|asset:\/\/)/i.test(value.trim())
const isImageDataUrl = (value: string) => /^data:image\/[a-z0-9.+-]+;base64,/i.test(value.trim())
const isAudioDataUrl = (value: string) => /^data:audio\/[a-z0-9.+-]+;base64,/i.test(value.trim())

const validateMediaUrl = (media: SeedanceMedia) => {
  if (isHttpOrAssetUrl(media.url)) return
  if ((media.role === 'first_frame' || media.role === 'last_frame' || media.role === 'reference_image') && isImageDataUrl(media.url)) return
  if (media.role === 'reference_audio' && isAudioDataUrl(media.url)) return
  throw new Error(media.role === 'reference_video'
    ? '视频素材必须使用公开 HTTPS 地址或方舟 Asset ID'
    : '素材地址格式不受支持')
}

export const validateSeedanceInput = (input: SeedanceGenerationInput) => {
  if (!input.prompt.trim() && input.mode === 'text') throw new Error('请填写视频描述')
  if (input.prompt.length > 20000) throw new Error('视频描述不能超过 20000 个字符')
  if (!Number.isInteger(input.duration) || input.duration < 4 || input.duration > 30) throw new Error('视频时长必须是 4 到 30 秒的整数')
  if (input.seed !== undefined && (!Number.isInteger(input.seed) || input.seed < -1 || input.seed > 4294967295)) {
    throw new Error('Seed 必须是 -1 到 4294967295 之间的整数')
  }
  if (input.media.length > 50) throw new Error('参考素材总数不能超过 50 个')
  input.media.forEach(validateMediaUrl)

  const images = input.media.filter(item => ['first_frame', 'last_frame', 'reference_image'].includes(item.role))
  const referenceImages = input.media.filter(item => item.role === 'reference_image')
  const videos = input.media.filter(item => item.role === 'reference_video')
  const audios = input.media.filter(item => item.role === 'reference_audio')
  const firstFrames = input.media.filter(item => item.role === 'first_frame')
  const lastFrames = input.media.filter(item => item.role === 'last_frame')

  if (images.length > 30) throw new Error('图片素材最多 30 张')
  if (videos.length > 10) throw new Error('视频素材最多 10 段')
  if (audios.length > 10) throw new Error('音频素材最多 10 段')
  if (firstFrames.length > 1 || lastFrames.length > 1) throw new Error('首帧和尾帧最多各一张')
  if ((firstFrames.length || lastFrames.length) && (referenceImages.length || videos.length || audios.length)) {
    throw new Error('首帧/首尾帧不能与全模态参考素材混用')
  }
  if (input.mode === 'image' && firstFrames.length !== 1) throw new Error('请添加一张首帧图片')
  if (input.mode === 'interpolation' && (firstFrames.length !== 1 || lastFrames.length !== 1)) throw new Error('请同时添加首帧和尾帧图片')
  if (input.mode === 'references' && !referenceImages.length && !videos.length && !audios.length) throw new Error('请至少添加一项参考素材')
  if (input.mode === 'audio' && !audios.length) throw new Error('请至少添加一段参考音频')
  if (input.mode === 'audio' && (referenceImages.length || videos.length)) throw new Error('音频驱动画面模式只接受参考音频')
  if ((input.mode === 'edit' || input.mode === 'extension') && !videos.length) {
    throw new Error(input.mode === 'edit' ? '请填写待编辑视频地址' : '请填写待延长视频地址')
  }
  if ((input.mode === 'edit' || input.mode === 'extension') && input.ratio !== 'adaptive') throw new Error('视频编辑和延长必须使用自适应比例')

  const inlineBytes = input.media.reduce((total, item) => {
    const comma = item.url.indexOf(',')
    return total + (comma >= 0 && item.url.startsWith('data:') ? Math.floor((item.url.length - comma - 1) * 0.75) : 0)
  }, 0)
  if (inlineBytes > 60 * 1024 * 1024) throw new Error('本地素材合计过大，请减少素材或改用公开地址')
}

const mediaContent = (media: SeedanceMedia) => {
  if (media.role === 'reference_video') return { type: 'video_url', video_url: { url: media.url.trim() }, role: media.role }
  if (media.role === 'reference_audio') return { type: 'audio_url', audio_url: { url: media.url.trim() }, role: media.role }
  return { type: 'image_url', image_url: { url: media.url.trim() }, role: media.role }
}

export const buildSeedanceRequestBody = (input: SeedanceGenerationInput) => {
  validateSeedanceInput(input)
  const content: Array<Record<string, unknown>> = []
  if (input.prompt.trim()) content.push({ type: 'text', text: input.prompt.trim() })
  content.push(...input.media.map(mediaContent))
  const body: Record<string, unknown> = {
    model: input.model,
    content,
    generate_audio: input.generateAudio,
    resolution: input.resolution,
    ratio: input.ratio,
    duration: input.duration,
    watermark: input.watermark,
    return_last_frame: input.returnLastFrame
  }
  if (input.seed !== undefined) body.seed = input.seed
  if (input.mode === 'references' || input.mode === 'audio') body.omni_reference_task_type = 'reference'
  if (input.mode === 'edit') body.omni_reference_task_type = 'edit'
  if (input.mode === 'extension') body.omni_reference_task_type = 'extend'
  return body
}

const cleanBaseUrl = (value?: string) => (value || SEEDANCE_DEFAULT_BASE_URL).trim().replace(/\/+$/, '')
const parsePayload = (data: unknown) => {
  if (typeof data !== 'string') return data as any
  try { return JSON.parse(data) } catch { return { message: data } }
}

const apiError = (status: number, payload: any, fallback: string) => {
  const code = String(payload?.error?.code || payload?.code || '')
  const message = String(payload?.error?.message || payload?.message || fallback)
  if (status === 401 || /ApiKey\.Invalid|InvalidApiKey/i.test(code)) return new Error(`方舟 API Key 无效：${message}`)
  if (status === 403 || /Permission|ModelNotOpen/i.test(code)) return new Error(`模型未开通或当前账号无权限：${message}`)
  if (status === 429 || /Rate|Quota|Throttl/i.test(code)) return new Error(`任务过多或触发限流：${message}`)
  if (status === 402 || /Balance|Arrearage/i.test(code)) return new Error(`账户余额或计费状态不可用：${message}`)
  if (/Sensitive|Risk|Moderation/i.test(code)) return new Error(`素材或描述未通过内容安全检查：${message}`)
  if (status >= 500) return new Error(`Seedance 服务暂时不可用：${message}`)
  return new Error(message)
}

const headers = (apiKey: string) => ({ Authorization: `Bearer ${apiKey.trim()}`, 'Content-Type': 'application/json' })

export const submitSeedanceGeneration = async (config: SeedanceClientConfig, input: SeedanceGenerationInput) => {
  if (!Capacitor.isNativePlatform()) throw new Error('请在安装后的 Android 或 iOS App 中使用 Seedance 官方接入')
  if (!config.apiKey.trim()) throw new Error('请填写火山方舟 API Key')
  const response = await CapacitorHttp.request({
    url: `${cleanBaseUrl(config.baseUrl)}/api/v3/contents/generations/tasks`,
    method: 'POST',
    headers: headers(config.apiKey),
    data: buildSeedanceRequestBody(input),
    connectTimeout: 30000,
    readTimeout: 60000
  })
  const payload = parsePayload(response.data)
  if (response.status < 200 || response.status >= 300 || payload?.error) throw apiError(response.status, payload, 'Seedance 任务提交失败')
  if (!payload?.id) throw new Error('Seedance 接口没有返回任务编号')
  return String(payload.id)
}

export const querySeedanceTask = async (config: SeedanceClientConfig, taskId: string): Promise<SeedanceRemoteTask> => {
  if (!Capacitor.isNativePlatform()) throw new Error('请在安装后的 Android 或 iOS App 中使用 Seedance 官方接入')
  if (!config.apiKey.trim()) throw new Error('恢复任务需要原火山方舟 API Key')
  const response = await CapacitorHttp.request({
    url: `${cleanBaseUrl(config.baseUrl)}/api/v3/contents/generations/tasks/${encodeURIComponent(taskId)}`,
    method: 'GET',
    headers: headers(config.apiKey),
    connectTimeout: 30000,
    readTimeout: 60000
  })
  const payload = parsePayload(response.data)
  if (response.status < 200 || response.status >= 300) throw apiError(response.status, payload, 'Seedance 任务查询失败')
  const status = String(payload?.status || 'unknown').toLowerCase() as SeedanceRemoteTask['status']
  return {
    id: String(payload?.id || taskId),
    model: payload?.model ? String(payload.model) : undefined,
    status,
    errorCode: payload?.error?.code ? String(payload.error.code) : undefined,
    errorMessage: payload?.error?.message ? String(payload.error.message) : undefined,
    videoUrl: payload?.content?.video_url ? String(payload.content.video_url) : undefined,
    lastFrameUrl: payload?.content?.last_frame_url ? String(payload.content.last_frame_url) : undefined,
    createdAt: Number.isFinite(payload?.created_at) ? Number(payload.created_at) : undefined,
    updatedAt: Number.isFinite(payload?.updated_at) ? Number(payload.updated_at) : undefined,
    seed: Number.isFinite(payload?.seed) ? Number(payload.seed) : undefined,
    resolution: payload?.resolution,
    ratio: payload?.ratio,
    duration: Number.isFinite(payload?.duration) ? Number(payload.duration) : undefined,
    framesPerSecond: Number.isFinite(payload?.framespersecond) ? Number(payload.framespersecond) : undefined,
    generateAudio: typeof payload?.generate_audio === 'boolean' ? payload.generate_audio : undefined,
    usage: payload?.usage
  }
}

export const downloadSeedanceVideo = async (taskId: string, url: string) => {
  if (!Capacitor.isNativePlatform()) throw new Error('视频只能在安装后的 App 中保存')
  await Filesystem.mkdir({ directory: Directory.Data, path: 'seedance-videos', recursive: true }).catch(() => undefined)
  const path = `seedance-videos/${taskId}.mp4`
  const file = await Filesystem.getUri({ directory: Directory.Data, path })
  await FileTransfer.downloadFile({ url, path: file.uri, progress: false, connectTimeout: 60000, readTimeout: 240000 })
  return { path, uri: file.uri, webUrl: Capacitor.convertFileSrc(file.uri) }
}

export const resolveSeedanceVideoUrl = (uri?: string) => uri ? Capacitor.convertFileSrc(uri) : ''

export const removeSeedanceVideoFile = async (path?: string) => {
  if (!path || !Capacitor.isNativePlatform()) return
  await Filesystem.deleteFile({ directory: Directory.Data, path }).catch(() => undefined)
}

export const shareSeedanceVideo = async (uri: string) => {
  if (!Capacitor.isNativePlatform()) throw new Error('请在安装后的 App 中分享视频')
  await Share.share({ title: 'Seedance 视频作品', files: [uri], dialogTitle: '分享或保存视频' })
}
