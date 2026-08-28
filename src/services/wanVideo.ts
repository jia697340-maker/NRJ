/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { Capacitor, CapacitorHttp } from '@capacitor/core'
import { Directory, Filesystem } from '@capacitor/filesystem'
import { FileTransfer } from '@capacitor/file-transfer'
import { Share } from '@capacitor/share'

export type WanModel = 'wan3.0-video' | 'wan3.0-video-prime'
export type WanMode = 'text' | 'image' | 'interpolation' | 'references' | 'file' | 'link' | 'edit' | 'extension'
export type WanResolution = '480P' | '720P' | '1080P'
export type WanRatio = 'adaptive' | '16:9' | '4:3' | '1:1' | '3:4' | '9:16'
export type WanDuration = -1 | number
export type WanMediaType = 'first_frame' | 'last_frame' | 'reference_image' | 'reference_video' | 'reference_audio' | 'file' | 'link'

export interface WanMedia {
  type: WanMediaType
  url: string
  label?: string
}

export interface WanGenerationInput {
  prompt: string
  model: WanModel
  mode: WanMode
  resolution: WanResolution
  ratio: WanRatio
  duration: WanDuration
  audio: boolean
  seed?: number
  promptExtend: boolean
  watermark: boolean
  media: WanMedia[]
}

export interface WanClientConfig {
  apiKey: string
  baseUrl: string
}

export interface WanUsage {
  video_count?: number
  duration?: number
  input_video_duration?: number
  output_video_duration?: number
  fps?: number
  SR?: number
  ratio?: string
}

export interface WanRemoteTask {
  taskId: string
  status: 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'CANCELED' | 'UNKNOWN'
  requestId?: string
  videoUrl?: string
  originalPrompt?: string
  usage?: WanUsage
  code?: string
  message?: string
  submitTime?: string
  scheduledTime?: string
  endTime?: string
}

export const WAN_MODELS: Array<{ value: WanModel; label: string; shortLabel: string; description: string }> = [
  { value: 'wan3.0-video', label: 'Wan 3.0', shortLabel: '标准', description: '完整能力与标准速度' },
  { value: 'wan3.0-video-prime', label: 'Wan 3.0 Prime', shortLabel: 'Prime', description: '能力对齐并显著提速' }
]

export const WAN_REGIONS = [
  { value: 'cn-beijing', label: '北京', suffix: 'cn-beijing.maas.aliyuncs.com' },
  { value: 'ap-southeast-1', label: '新加坡', suffix: 'ap-southeast-1.maas.aliyuncs.com' },
  { value: 'ap-northeast-1', label: '东京', suffix: 'ap-northeast-1.maas.aliyuncs.com' },
  { value: 'eu-central-1', label: '法兰克福', suffix: 'eu-central-1.maas.aliyuncs.com' },
  { value: 'us-east-1', label: '弗吉尼亚', suffix: 'us-east-1.maas.aliyuncs.com' }
] as const

const PRICE_PER_SECOND: Record<WanModel, Record<WanResolution, number>> = {
  'wan3.0-video': { '480P': 0.3, '720P': 0.6, '1080P': 1.2 },
  'wan3.0-video-prime': { '480P': 0.45, '720P': 0.9, '1080P': 1.8 }
}

const SINGAPORE_PRICE_PER_SECOND: Record<WanModel, Record<WanResolution, number>> = {
  'wan3.0-video': { '480P': 0.37471, '720P': 0.74942, '1080P': 1.49884 },
  'wan3.0-video-prime': { '480P': 0.495838, '720P': 1.020844, '1080P': 2.041687 }
}

export const estimateWanCost = (model: WanModel, resolution: WanResolution, duration: WanDuration, region = 'cn-beijing') => {
  if (duration === -1) return null
  const prices = region === 'ap-southeast-1' ? SINGAPORE_PRICE_PER_SECOND : PRICE_PER_SECOND
  return Number((prices[model][resolution] * duration).toFixed(2))
}

export const buildWanBaseUrl = (workspaceId: string, region: string) => {
  const workspace = workspaceId.trim()
  const regionInfo = WAN_REGIONS.find(item => item.value === region)
  if (!workspace || !regionInfo) return ''
  return `https://${workspace}.${regionInfo.suffix}`
}

const isMediaUrl = (value: string) => /^(https?:\/\/|oss:\/\/)/i.test(value.trim())

export const validateWanInput = (input: WanGenerationInput) => {
  if (!input.prompt.trim() && !input.media.length) throw new Error('请填写视频描述或添加参考素材')
  if (input.prompt.length > 20000) throw new Error('视频描述不能超过 20000 个字符')
  if (input.duration !== -1 && (!Number.isInteger(input.duration) || input.duration < 2 || input.duration > 30)) {
    throw new Error('视频时长必须为 2 到 30 秒的整数，或选择智能时长')
  }
  if (input.seed !== undefined && (!Number.isInteger(input.seed) || input.seed < 0 || input.seed > 2147483647)) {
    throw new Error('Seed 必须是 0 到 2147483647 之间的整数')
  }
  if (input.media.length > 20) throw new Error('参考素材总数不能超过 20 个')
  if (input.media.some(item => !isMediaUrl(item.url) && !/^data:image\//i.test(item.url))) {
    throw new Error('素材必须使用 HTTP、HTTPS、OSS 地址或图片 Base64')
  }
  const frames = input.media.filter(item => item.type === 'first_frame' || item.type === 'last_frame')
  const references = input.media.filter(item => item.type.startsWith('reference_') || item.type === 'file' || item.type === 'link')
  if (frames.length && references.length) throw new Error('首帧/首尾帧不能与参考素材、文件或网页同时使用')
  if (input.media.filter(item => item.type === 'first_frame').length > 1 || input.media.filter(item => item.type === 'last_frame').length > 1) {
    throw new Error('首帧和尾帧最多各一张')
  }
  if (input.media.filter(item => item.type === 'reference_image').length > 10) throw new Error('参考图片最多 10 张')
  if (input.media.filter(item => item.type === 'reference_video').length > 5) throw new Error('参考视频最多 5 段')
  if (input.media.filter(item => item.type === 'reference_audio').length > 5) throw new Error('参考音频最多 5 段')
  if (input.media.filter(item => item.type === 'file').length > 1) throw new Error('参考文件最多一个')
  if (input.media.filter(item => item.type === 'link').length > 1) throw new Error('参考网页最多一个')
  if (input.media.some(item => item.type === 'file') && input.media.some(item => item.type === 'link')) throw new Error('参考文件与网页不能同时使用')
  if (input.mode === 'image' && !input.media.some(item => item.type === 'first_frame')) throw new Error('请添加首帧图片')
  if (input.mode === 'interpolation' && (!input.media.some(item => item.type === 'first_frame') || !input.media.some(item => item.type === 'last_frame'))) {
    throw new Error('请同时添加首帧和尾帧图片')
  }
  if (input.mode === 'references' && !input.media.some(item => item.type.startsWith('reference_'))) throw new Error('请至少添加一项参考素材')
  if (input.mode === 'file' && !input.media.some(item => item.type === 'file')) throw new Error('请填写参考文件地址')
  if (input.mode === 'link' && !input.media.some(item => item.type === 'link')) throw new Error('请填写公开网页地址')
  if ((input.mode === 'edit' || input.mode === 'extension') && !input.media.some(item => item.type === 'reference_video')) {
    throw new Error(input.mode === 'edit' ? '请填写待编辑视频地址' : '请填写待延长视频地址')
  }
  if (input.mode === 'extension' && input.ratio !== 'adaptive') throw new Error('视频延长必须使用自适应比例')
}

export const buildWanRequestBody = (input: WanGenerationInput) => {
  validateWanInput(input)
  const bodyInput: Record<string, unknown> = {}
  if (input.prompt.trim()) bodyInput.prompt = input.prompt.trim()
  if (input.media.length) bodyInput.media = input.media.map(item => ({ type: item.type, url: item.url.trim() }))
  const parameters: Record<string, unknown> = {
    resolution: input.resolution,
    ratio: input.ratio,
    duration: input.duration,
    audio: input.audio,
    prompt_extend: input.promptExtend,
    watermark: input.watermark
  }
  if (input.seed !== undefined) parameters.seed = input.seed
  return { model: input.model, input: bodyInput, parameters }
}

const cleanBaseUrl = (value: string) => value.trim().replace(/\/+$/, '')

const parsePayload = (data: unknown) => {
  if (typeof data !== 'string') return data as any
  try { return JSON.parse(data) } catch { return { message: data } }
}

const bytesToBase64 = (bytes: Uint8Array) => {
  let binary = ''
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000))
  }
  return btoa(binary)
}

const safeUploadName = (value: string) => value.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(-100) || 'asset.bin'

const makeApiError = (status: number, payload: any, fallback: string) => {
  const code = String(payload?.code || payload?.output?.code || '')
  const message = String(payload?.message || payload?.output?.message || fallback)
  if (status === 401 || status === 403 || /InvalidApiKey/i.test(code)) return new Error(`API Key、业务空间或地域不匹配：${message}`)
  if (status === 429 || /Throttling|RateQuota/i.test(code)) return new Error(`任务过多或触发限流：${message}`)
  if (status === 402 || /Arrearage|Balance/i.test(code)) return new Error(`账户余额或计费状态不可用：${message}`)
  if (status >= 500) return new Error(`Wan 服务暂时不可用：${message}`)
  return new Error(message)
}

const makeHeaders = (apiKey: string, media: WanMedia[] = []) => ({
  Authorization: `Bearer ${apiKey.trim()}`,
  'Content-Type': 'application/json',
  ...(media.some(item => /^oss:\/\//i.test(item.url)) ? { 'X-DashScope-OssResourceResolve': 'enable' } : {})
})

export const uploadWanFile = async (config: WanClientConfig, model: WanModel, file: File) => {
  if (!Capacitor.isNativePlatform()) throw new Error('请在安装后的 Android 或 iOS App 中上传素材')
  if (!config.apiKey.trim()) throw new Error('上传素材需要阿里云百炼 API Key')
  const policyResponse = await CapacitorHttp.request({
    url: `${cleanBaseUrl(config.baseUrl)}/api/v1/uploads`,
    method: 'GET',
    headers: { Authorization: `Bearer ${config.apiKey.trim()}` },
    params: { action: 'getPolicy', model },
    connectTimeout: 30000,
    readTimeout: 60000
  })
  const policyPayload = parsePayload(policyResponse.data)
  if (policyResponse.status < 200 || policyResponse.status >= 300 || policyPayload?.code) {
    throw makeApiError(policyResponse.status, policyPayload, '无法获取素材上传凭证')
  }
  const policy = policyPayload?.data
  if (!policy?.upload_host || !policy?.upload_dir) throw new Error('百炼没有返回有效的素材上传凭证')
  const key = `${String(policy.upload_dir).replace(/\/+$/, '')}/${Date.now()}-${safeUploadName(file.name)}`
  const fields = [
    ['OSSAccessKeyId', policy.oss_access_key_id],
    ['Signature', policy.signature],
    ['policy', policy.policy],
    ['x-oss-object-acl', policy.x_oss_object_acl],
    ['x-oss-forbid-overwrite', policy.x_oss_forbid_overwrite],
    ['key', key],
    ['success_action_status', '200']
  ].filter(([, value]) => value !== undefined && value !== null).map(([fieldKey, value]) => ({ type: 'string', key: String(fieldKey), value: String(value) }))
  const fileData = bytesToBase64(new Uint8Array(await file.arrayBuffer()))
  const uploadResponse = await CapacitorHttp.request({
    url: String(policy.upload_host),
    method: 'POST',
    headers: { 'Content-Type': 'multipart/form-data' },
    dataType: 'formData',
    data: [...fields, { type: 'base64File', key: 'file', value: fileData, fileName: safeUploadName(file.name), contentType: file.type || 'application/octet-stream' }],
    connectTimeout: 60000,
    readTimeout: 180000
  })
  if (uploadResponse.status < 200 || uploadResponse.status >= 300) throw new Error(`素材上传失败 (${uploadResponse.status})`)
  return `oss://${key}`
}

export const submitWanGeneration = async (config: WanClientConfig, input: WanGenerationInput) => {
  if (!Capacitor.isNativePlatform()) throw new Error('请在安装后的 Android 或 iOS App 中使用 Wan 官方接入')
  if (!config.apiKey.trim()) throw new Error('请填写阿里云百炼 API Key')
  if (!cleanBaseUrl(config.baseUrl)) throw new Error('请填写正确的业务空间 ID 和地域')
  const response = await CapacitorHttp.request({
    url: `${cleanBaseUrl(config.baseUrl)}/api/v1/services/aigc/video-generation/video-synthesis`,
    method: 'POST',
    headers: { ...makeHeaders(config.apiKey, input.media), 'X-DashScope-Async': 'enable' },
    data: buildWanRequestBody(input),
    connectTimeout: 30000,
    readTimeout: 60000
  })
  const payload = parsePayload(response.data)
  if (response.status < 200 || response.status >= 300 || payload?.code) throw makeApiError(response.status, payload, 'Wan 任务提交失败')
  const taskId = payload?.output?.task_id
  if (!taskId) throw new Error('Wan 接口没有返回任务编号')
  return { taskId: String(taskId), requestId: payload?.request_id ? String(payload.request_id) : undefined }
}

export const queryWanTask = async (config: WanClientConfig, taskId: string): Promise<WanRemoteTask> => {
  if (!Capacitor.isNativePlatform()) throw new Error('请在安装后的 Android 或 iOS App 中使用 Wan 官方接入')
  if (!config.apiKey.trim()) throw new Error('恢复任务需要原阿里云百炼 API Key')
  const response = await CapacitorHttp.request({
    url: `${cleanBaseUrl(config.baseUrl)}/api/v1/tasks/${encodeURIComponent(taskId)}`,
    method: 'GET',
    headers: makeHeaders(config.apiKey),
    connectTimeout: 30000,
    readTimeout: 60000
  })
  const payload = parsePayload(response.data)
  if (response.status < 200 || response.status >= 300 || payload?.code) throw makeApiError(response.status, payload, 'Wan 任务查询失败')
  const output = payload?.output || {}
  return {
    taskId: String(output.task_id || taskId),
    status: String(output.task_status || 'UNKNOWN').toUpperCase() as WanRemoteTask['status'],
    requestId: payload?.request_id ? String(payload.request_id) : undefined,
    videoUrl: output.video_url ? String(output.video_url) : undefined,
    originalPrompt: output.orig_prompt ? String(output.orig_prompt) : undefined,
    usage: payload?.usage,
    code: output.code ? String(output.code) : undefined,
    message: output.message ? String(output.message) : undefined,
    submitTime: output.submit_time,
    scheduledTime: output.scheduled_time,
    endTime: output.end_time
  }
}

export const downloadWanVideo = async (taskId: string, url: string) => {
  if (!Capacitor.isNativePlatform()) throw new Error('视频只能在安装后的 App 中保存')
  await Filesystem.mkdir({ directory: Directory.Data, path: 'wan-videos', recursive: true }).catch(() => undefined)
  const path = `wan-videos/${taskId}.mp4`
  const file = await Filesystem.getUri({ directory: Directory.Data, path })
  await FileTransfer.downloadFile({ url, path: file.uri, progress: false, connectTimeout: 60000, readTimeout: 180000 })
  return { path, uri: file.uri, webUrl: Capacitor.convertFileSrc(file.uri) }
}

export const resolveWanVideoUrl = (uri?: string) => uri ? Capacitor.convertFileSrc(uri) : ''

export const removeWanVideoFile = async (path?: string) => {
  if (!path || !Capacitor.isNativePlatform()) return
  await Filesystem.deleteFile({ directory: Directory.Data, path }).catch(() => undefined)
}

export const shareWanVideo = async (uri: string) => {
  if (!Capacitor.isNativePlatform()) throw new Error('请在安装后的 App 中分享视频')
  await Share.share({ title: 'Wan 视频作品', files: [uri], dialogTitle: '分享或保存视频' })
}
