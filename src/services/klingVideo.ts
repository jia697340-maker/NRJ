/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { Capacitor } from '@capacitor/core'
import { Directory, Filesystem } from '@capacitor/filesystem'
import { FileTransfer } from '@capacitor/file-transfer'
import { Share } from '@capacitor/share'
import { requestVideoApi, type VideoConnectionMode } from './videoHttp'

export type KlingModel = 'kling-3.0' | 'kling-3.0-omni'
export type KlingMode = 'text' | 'image' | 'interpolation' | 'references' | 'feature_video' | 'edit_video'
export type KlingAspectRatio = '16:9' | '9:16' | '1:1'
export type KlingResolution = '720p' | '1080p' | '4k'
export type KlingAudio = 'off' | 'native' | 'original'
export type KlingMultiShot = 'off' | 'auto' | 'custom'
export type KlingDuration = 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15

export interface KlingShot {
  id: string
  duration: number
  prompt: string
}

export interface KlingElementReference {
  elementId: string
  alias: string
  kind?: 'multi_image' | 'video_character'
}

export interface KlingGenerationInput {
  prompt: string
  model: KlingModel
  mode: KlingMode
  aspectRatio: KlingAspectRatio
  resolution: KlingResolution
  duration: KlingDuration
  audio: KlingAudio
  multiShot: KlingMultiShot
  shots: KlingShot[]
  watermark: boolean
  externalTaskId: string
  firstFrame?: Blob
  lastFrame?: Blob
  referenceImages?: Blob[]
  referenceVideoUrl?: string
  elements?: KlingElementReference[]
}

export interface KlingClientConfig {
  apiKey: string
  baseUrl?: string
  connectionMode?: VideoConnectionMode
}

export interface KlingOutput {
  type: string
  id?: string
  url?: string
  watermark_url?: string
  duration?: string
}

export interface KlingBilling {
  charge_type?: string
  cash_type?: string
  amount?: string
  currency?: string
  package_type?: string
  list_price?: string
}

export interface KlingRemoteTask {
  id: string
  status: 'submitted' | 'processing' | 'succeeded' | 'failed'
  message?: string
  create_time?: number
  update_time?: number
  external_id?: string
  outputs?: KlingOutput[]
  billing?: KlingBilling[]
}

export const KLING_DEFAULT_BASE_URL = 'https://api-beijing.klingai.com'

export const KLING_MODELS: Array<{ value: KlingModel; label: string; shortLabel: string; description: string }> = [
  { value: 'kling-3.0', label: 'Kling 3.0', shortLabel: '3.0', description: '文生、图生与首尾帧' },
  { value: 'kling-3.0-omni', label: 'Kling 3.0 Omni', shortLabel: 'Omni', description: '参考、编辑与主体控制' }
]

const PRICE_PER_SECOND: Record<KlingModel, Record<KlingAudio, Record<KlingResolution, number | null>>> = {
  'kling-3.0': {
    off: { '720p': 0.6, '1080p': 0.8, '4k': 3 },
    native: { '720p': 0.9, '1080p': 1.2, '4k': 3 },
    original: { '720p': null, '1080p': null, '4k': null }
  },
  'kling-3.0-omni': {
    off: { '720p': 0.6, '1080p': 0.8, '4k': 3 },
    native: { '720p': 0.8, '1080p': 1, '4k': 3 },
    original: { '720p': 0.9, '1080p': 1.2, '4k': 3 }
  }
}

export const estimateKlingCost = (input: Pick<KlingGenerationInput, 'model' | 'mode' | 'audio' | 'resolution' | 'duration'>) => {
  let rate = PRICE_PER_SECOND[input.model][input.audio][input.resolution]
  if (input.model === 'kling-3.0-omni' && input.mode === 'feature_video' && input.audio === 'off') {
    rate = { '720p': 0.9, '1080p': 1.2, '4k': 3 }[input.resolution]
  }
  return rate === null ? null : Number((rate * input.duration).toFixed(2))
}

export const supportsKlingMode = (model: KlingModel, mode: KlingMode) => {
  if (model === 'kling-3.0') return ['text', 'image', 'interpolation'].includes(mode)
  return true
}

const cleanElementReferences = (elements: KlingElementReference[] = []) => elements
  .map(item => ({ elementId: item.elementId.trim(), alias: item.alias.trim().replace(/^@/, ''), kind: item.kind || 'multi_image' as const }))
  .filter(item => item.elementId && item.alias)

export const buildKlingPrompt = (input: Pick<KlingGenerationInput, 'prompt' | 'multiShot' | 'shots' | 'duration'>) => {
  if (input.multiShot !== 'custom') return input.prompt.trim()
  return input.shots.map((shot, index) => `镜头 ${index + 1}, ${shot.duration}, ${shot.prompt.trim()}`).join('; ')
}

export const validateKlingInput = (input: KlingGenerationInput) => {
  if (!supportsKlingMode(input.model, input.mode)) throw new Error('当前模型不支持所选生成方式')
  const finalPrompt = buildKlingPrompt(input)
  if (!finalPrompt) throw new Error('请填写视频描述')
  if (finalPrompt.length > 3072) throw new Error('视频描述不能超过 3072 个字符')
  if (input.mode === 'image' && !input.firstFrame) throw new Error('请添加起始图片')
  if (input.mode === 'interpolation' && (!input.firstFrame || !input.lastFrame)) throw new Error('请同时添加首帧和尾帧')
  if (input.mode === 'references' && !input.referenceImages?.length && !cleanElementReferences(input.elements).length) {
    throw new Error('请至少添加一张参考图或一个主体')
  }
  if (input.referenceImages && input.referenceImages.length > 7) throw new Error('参考图最多七张')
  const cleanedElements = cleanElementReferences(input.elements)
  if (cleanedElements.length > 3) throw new Error('主体最多三个')
  const multiImageElements = cleanedElements.filter(item => item.kind === 'multi_image').length
  const videoCharacterElements = cleanedElements.filter(item => item.kind === 'video_character').length
  const referenceImageCount = input.referenceImages?.length || 0
  if (videoCharacterElements && referenceImageCount + multiImageElements > 4) {
    throw new Error('同时使用视频角色主体时，参考图与多图主体合计最多四个')
  }
  if (!videoCharacterElements && referenceImageCount + multiImageElements > 7) {
    throw new Error('参考图与多图主体合计最多七个')
  }
  if ((input.mode === 'feature_video' || input.mode === 'edit_video') && !/^https:\/\//i.test(input.referenceVideoUrl?.trim() || '')) {
    throw new Error('请输入 HTTPS 公网视频地址')
  }
  if (input.mode === 'feature_video' && (input.audio !== 'off' || input.multiShot === 'off')) {
    throw new Error('特征参考视频必须启用多镜头并关闭声音生成')
  }
  if (input.mode === 'edit_video' && (input.audio === 'native' || input.multiShot !== 'off')) {
    throw new Error('视频编辑不支持原生声音或多镜头')
  }
  if (input.audio === 'original' && input.mode !== 'edit_video') throw new Error('仅视频编辑可以保留原声')
  if (input.multiShot === 'custom') {
    if (!input.shots.length || input.shots.length > 6) throw new Error('自定义分镜需要一到六个镜头')
    if (input.shots.some(shot => !shot.prompt.trim() || shot.prompt.length > 512 || shot.duration < 1)) {
      throw new Error('每个分镜都需要描述，单镜头描述不超过 512 字且时长不少于 1 秒')
    }
    if (input.shots.reduce((sum, shot) => sum + shot.duration, 0) !== input.duration) {
      throw new Error('所有分镜时长之和必须等于视频总时长')
    }
  }
}

const bytesToBase64 = (bytes: Uint8Array) => {
  let binary = ''
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000))
  }
  return btoa(binary)
}

export const blobToKlingData = async (blob: Blob) => `data:${blob.type || 'image/jpeg'};base64,${bytesToBase64(new Uint8Array(await blob.arrayBuffer()))}`

const contentForImage = async (type: 'first_frame' | 'last_frame' | 'refer_image', blob: Blob, id?: string) => ({
  type,
  url: await blobToKlingData(blob),
  ...(id ? { id } : {})
})

const taskOptions = (input: KlingGenerationInput) => ({
  external_task_id: input.externalTaskId,
  watermark_info: { enabled: input.watermark }
})

export const buildKlingRequest = async (input: KlingGenerationInput) => {
  validateKlingInput(input)
  const prompt = buildKlingPrompt(input)
  const settings: Record<string, unknown> = {
    resolution: input.resolution,
    duration: input.duration,
    audio: input.audio,
    multi_shot: input.multiShot !== 'off'
  }
  if (input.mode === 'text') settings.aspect_ratio = input.aspectRatio

  if (input.model === 'kling-3.0' && input.mode === 'text') {
    return { endpoint: '/text-to-video/kling-3.0', body: { prompt, settings, options: taskOptions(input) } }
  }

  const contents: Array<Record<string, unknown>> = [{ type: 'prompt', text: prompt }]
  if (input.firstFrame) contents.push(await contentForImage('first_frame', input.firstFrame, input.model === 'kling-3.0-omni' ? 'image_first' : undefined))
  if (input.lastFrame) contents.push(await contentForImage('last_frame', input.lastFrame, input.model === 'kling-3.0-omni' ? 'image_last' : undefined))
  for (const [index, image] of (input.referenceImages || []).entries()) {
    contents.push(await contentForImage('refer_image', image, `image_${index + 1}`))
  }
  if (input.mode === 'feature_video') contents.push({ type: 'feature_video', url: input.referenceVideoUrl!.trim(), id: 'video_1' })
  if (input.mode === 'edit_video') contents.push({ type: 'base_video', url: input.referenceVideoUrl!.trim(), id: 'video_1' })
  for (const element of cleanElementReferences(input.elements)) {
    contents.push({ type: 'element', element_id: element.elementId, id: element.alias })
  }

  if (input.model === 'kling-3.0') {
    return { endpoint: '/image-to-video/kling-3.0', body: { contents, settings, options: taskOptions(input) } }
  }
  if (!input.firstFrame && input.mode !== 'feature_video' && input.mode !== 'edit_video') settings.aspect_ratio = input.aspectRatio
  return { endpoint: '/omni-video/kling-3.0-omni', body: { contents, settings, options: taskOptions(input) } }
}

const parsePayload = (data: unknown) => {
  if (typeof data !== 'string') return data as any
  try { return JSON.parse(data) } catch { return { message: data } }
}

const apiError = (status: number, payload: any, fallback: string) => {
  const code = payload?.code
  const message = payload?.message || fallback
  if (code === 1303) return new Error('当前生成任务已达到并发上限，请稍后再试')
  if (status === 401 || status === 403) return new Error(`API Key 无效或没有调用权限：${message}`)
  if (status === 429) return new Error(`请求过于频繁：${message}`)
  if (status >= 500) return new Error(`可灵服务暂时不可用：${message}`)
  return new Error(message)
}

const requestHeaders = (apiKey: string) => ({
  Authorization: `Bearer ${apiKey.trim()}`,
  'Content-Type': 'application/json'
})

export const submitKlingGeneration = async (config: KlingClientConfig, input: KlingGenerationInput) => {
  if (config.connectionMode !== 'web' && !Capacitor.isNativePlatform()) throw new Error('App 直连需要在安装后的 Android 或 iOS App 中使用')
  if (!config.apiKey.trim()) throw new Error('请填写 Kling API Key')
  const request = await buildKlingRequest(input)
  const response = await requestVideoApi({
    url: `${(config.baseUrl || KLING_DEFAULT_BASE_URL).replace(/\/+$/, '')}${request.endpoint}`,
    method: 'POST', connectionMode: config.connectionMode,
    headers: requestHeaders(config.apiKey),
    data: request.body,
    connectTimeout: 30000,
    readTimeout: 60000
  })
  const payload = parsePayload(response.data)
  if (response.status < 200 || response.status >= 300 || payload?.code !== 0) throw apiError(response.status, payload, 'Kling 任务提交失败')
  if (!payload?.data?.id) throw new Error('Kling 接口没有返回任务编号')
  return payload.data as KlingRemoteTask
}

export const getKlingTask = async (config: KlingClientConfig, query: { taskId?: string; externalTaskId?: string }) => {
  if (config.connectionMode !== 'web' && !Capacitor.isNativePlatform()) throw new Error('App 直连需要在安装后的 Android 或 iOS App 中使用')
  if (!config.apiKey.trim()) throw new Error('恢复任务需要原 Kling API Key')
  const params = query.taskId ? `task_ids=${encodeURIComponent(query.taskId)}` : `external_task_ids=${encodeURIComponent(query.externalTaskId || '')}`
  const response = await requestVideoApi({
    url: `${(config.baseUrl || KLING_DEFAULT_BASE_URL).replace(/\/+$/, '')}/tasks?${params}`,
    method: 'GET', connectionMode: config.connectionMode,
    headers: requestHeaders(config.apiKey),
    connectTimeout: 30000,
    readTimeout: 60000
  })
  const payload = parsePayload(response.data)
  if (response.status < 200 || response.status >= 300 || payload?.code !== 0) throw apiError(response.status, payload, 'Kling 任务查询失败')
  const task = Array.isArray(payload?.data) ? payload.data[0] : payload?.data?.result?.[0]
  return (task || null) as KlingRemoteTask | null
}

export const downloadKlingVideo = async (taskId: string, url: string) => {
  if (!Capacitor.isNativePlatform()) throw new Error('视频只能在安装后的 App 中保存')
  await Filesystem.mkdir({ directory: Directory.Data, path: 'kling-videos', recursive: true }).catch(() => undefined)
  const path = `kling-videos/${taskId}.mp4`
  const file = await Filesystem.getUri({ directory: Directory.Data, path })
  await FileTransfer.downloadFile({ url, path: file.uri, progress: false, connectTimeout: 60000, readTimeout: 120000 })
  return { path, uri: file.uri, webUrl: Capacitor.convertFileSrc(file.uri) }
}

export const resolveKlingVideoUrl = (uri?: string) => uri ? Capacitor.convertFileSrc(uri) : ''

export const removeKlingVideoFile = async (path?: string) => {
  if (!path || !Capacitor.isNativePlatform()) return
  await Filesystem.deleteFile({ directory: Directory.Data, path }).catch(() => undefined)
}

export const shareKlingVideo = async (uri: string) => {
  if (!Capacitor.isNativePlatform()) throw new Error('请在安装后的 App 中分享视频')
  await Share.share({ title: 'Kling 视频作品', files: [uri], dialogTitle: '分享或保存视频' })
}
