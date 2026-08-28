/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */

export type VeoModel = 'veo-3.1-lite-generate-preview' | 'veo-3.1-fast-generate-preview' | 'veo-3.1-generate-preview'
export type VeoMode = 'text' | 'image' | 'interpolation' | 'references' | 'extension'
export type VeoAspectRatio = '16:9' | '9:16'
export type VeoResolution = '720p' | '1080p' | '4k'
export type VeoDuration = 4 | 6 | 8

export interface VeoInlineMedia {
  mimeType: string
  data: string
}

export interface VeoGenerationInput {
  prompt: string
  model: VeoModel
  mode: VeoMode
  aspectRatio: VeoAspectRatio
  resolution: VeoResolution
  durationSeconds: VeoDuration
  seed?: number
  firstFrame?: Blob
  lastFrame?: Blob
  referenceImages?: Blob[]
  extensionVideo?: Blob
}

export interface VeoClientConfig {
  apiKey: string
  baseUrl: string
}

export interface VeoOperationVideo {
  uri: string
  mimeType: string
}

export interface VeoOperationResult {
  done: boolean
  raw: any
  video?: VeoOperationVideo
}

export const VEO_DEFAULT_BASE_URL = 'https://generativelanguage.googleapis.com'

export const VEO_MODELS: Array<{ value: VeoModel; label: string; shortLabel: string; description: string }> = [
  { value: 'veo-3.1-lite-generate-preview', label: 'Veo 3.1 Lite', shortLabel: 'Lite', description: '低成本快速生成' },
  { value: 'veo-3.1-fast-generate-preview', label: 'Veo 3.1 Fast', shortLabel: 'Fast', description: '速度与质量均衡' },
  { value: 'veo-3.1-generate-preview', label: 'Veo 3.1 Standard', shortLabel: 'Standard', description: '完整能力与更高质量' }
]

const PRICE_PER_SECOND: Record<VeoModel, Record<VeoResolution, number | null>> = {
  'veo-3.1-lite-generate-preview': { '720p': 0.05, '1080p': 0.08, '4k': null },
  'veo-3.1-fast-generate-preview': { '720p': 0.10, '1080p': 0.12, '4k': 0.30 },
  'veo-3.1-generate-preview': { '720p': 0.40, '1080p': 0.40, '4k': 0.60 }
}

export const estimateVeoCost = (model: VeoModel, resolution: VeoResolution, duration: VeoDuration) => {
  const rate = PRICE_PER_SECOND[model][resolution]
  return rate === null ? null : Number((rate * duration).toFixed(2))
}

export const isLiteVeoModel = (model: VeoModel) => model === 'veo-3.1-lite-generate-preview'
export const supportsVeoReferences = (model: VeoModel) => !isLiteVeoModel(model)
export const supportsVeoExtension = (model: VeoModel) => !isLiteVeoModel(model)

export const normalizeVeoBaseUrl = (value: string) => {
  const base = (value || VEO_DEFAULT_BASE_URL).trim().replace(/\/+$/, '')
  return /\/v1beta$/i.test(base) ? base : `${base}/v1beta`
}

const bytesToBase64 = (bytes: Uint8Array) => {
  let binary = ''
  const chunkSize = 0x8000
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize))
  }
  return btoa(binary)
}

export const blobToVeoInlineMedia = async (blob: Blob): Promise<VeoInlineMedia> => ({
  mimeType: blob.type || 'application/octet-stream',
  data: bytesToBase64(new Uint8Array(await blob.arrayBuffer()))
})

const inlineData = (media: VeoInlineMedia) => ({ inlineData: media })

export const validateVeoInput = (input: VeoGenerationInput) => {
  if (!input.prompt.trim()) throw new Error('请填写视频描述')
  if (input.resolution === '4k' && isLiteVeoModel(input.model)) throw new Error('Veo 3.1 Lite 不支持 4K')
  if ((input.resolution === '1080p' || input.resolution === '4k') && input.durationSeconds !== 8) {
    throw new Error('1080p 和 4K 仅支持 8 秒视频')
  }
  if (input.mode === 'image' && !input.firstFrame) throw new Error('请添加起始图片')
  if (input.mode === 'interpolation' && (!input.firstFrame || !input.lastFrame)) throw new Error('请同时添加首帧和尾帧')
  if (input.mode === 'references') {
    if (!supportsVeoReferences(input.model)) throw new Error('Veo 3.1 Lite 不支持参考图引导')
    if (!input.referenceImages?.length) throw new Error('请至少添加一张参考图')
    if (input.referenceImages.length > 3) throw new Error('参考图最多三张')
    if (input.durationSeconds !== 8) throw new Error('参考图引导仅支持 8 秒视频')
  }
  if (input.mode === 'extension') {
    if (!supportsVeoExtension(input.model)) throw new Error('Veo 3.1 Lite 不支持视频续写')
    if (!input.extensionVideo) throw new Error('请选择可续写的视频')
    if (input.resolution !== '720p' || input.durationSeconds !== 8) throw new Error('视频续写仅支持 720p、8 秒')
  }
}

export const buildVeoRequestBody = async (input: VeoGenerationInput) => {
  validateVeoInput(input)
  const instance: Record<string, any> = { prompt: input.prompt.trim() }
  if (input.mode === 'image' || input.mode === 'interpolation') {
    instance.image = inlineData(await blobToVeoInlineMedia(input.firstFrame!))
  }
  if (input.mode === 'interpolation') {
    instance.lastFrame = inlineData(await blobToVeoInlineMedia(input.lastFrame!))
  }
  if (input.mode === 'references') {
    instance.referenceImages = await Promise.all((input.referenceImages || []).map(async image => ({
      image: inlineData(await blobToVeoInlineMedia(image)),
      referenceType: 'asset'
    })))
  }
  if (input.mode === 'extension') {
    instance.video = inlineData(await blobToVeoInlineMedia(input.extensionVideo!))
  }
  const parameters: Record<string, any> = {
    numberOfVideos: 1,
    aspectRatio: input.aspectRatio,
    resolution: input.resolution,
    durationSeconds: input.durationSeconds
  }
  if (Number.isInteger(input.seed)) parameters.seed = input.seed
  return { instances: [instance], parameters }
}

const readApiError = async (response: Response, fallback: string) => {
  let message = fallback
  try {
    const payload = await response.json()
    message = payload?.error?.message || payload?.message || fallback
  } catch { /* 保留状态码错误。 */ }
  if (response.status === 401 || response.status === 403) return `鉴权或地区访问失败：${message}`
  if (response.status === 429) return `请求过于频繁或额度受限：${message}`
  if (response.status === 402) return `当前项目余额或计费状态不可用：${message}`
  return message
}

const requestHeaders = (apiKey: string) => ({
  'Content-Type': 'application/json',
  'x-goog-api-key': apiKey.trim()
})

export const submitVeoGeneration = async (config: VeoClientConfig, input: VeoGenerationInput, signal?: AbortSignal) => {
  if (!config.apiKey.trim()) throw new Error('请填写 Gemini Auth Key')
  const response = await fetch(`${normalizeVeoBaseUrl(config.baseUrl)}/models/${encodeURIComponent(input.model)}:predictLongRunning`, {
    method: 'POST',
    headers: requestHeaders(config.apiKey),
    body: JSON.stringify(await buildVeoRequestBody(input)),
    signal
  })
  if (!response.ok) throw new Error(await readApiError(response, `Veo 任务提交失败 (${response.status})`))
  const payload = await response.json()
  if (!payload?.name) throw new Error('Veo 接口没有返回任务编号')
  return String(payload.name)
}

const collectOperationVideo = (payload: any): VeoOperationVideo | undefined => {
  const video = payload?.response?.generateVideoResponse?.generatedSamples?.[0]?.video
    || payload?.response?.generatedVideos?.[0]?.video
  const uri = video?.uri || video?.url
  if (!uri) return undefined
  return { uri: String(uri), mimeType: String(video?.mimeType || video?.mime_type || 'video/mp4') }
}

export const getVeoOperation = async (config: VeoClientConfig, operationName: string, signal?: AbortSignal): Promise<VeoOperationResult> => {
  if (!config.apiKey.trim()) throw new Error('恢复任务需要原 Gemini Auth Key')
  const name = operationName.replace(/^\/+/, '')
  const response = await fetch(`${normalizeVeoBaseUrl(config.baseUrl)}/${name}`, {
    headers: { 'x-goog-api-key': config.apiKey.trim() },
    signal
  })
  if (!response.ok) throw new Error(await readApiError(response, `Veo 任务查询失败 (${response.status})`))
  const payload = await response.json()
  if (payload?.done && payload?.error) throw new Error(payload.error.message || 'Veo 视频生成失败')
  return { done: payload?.done === true, video: collectOperationVideo(payload), raw: payload }
}

export const downloadVeoVideo = async (config: VeoClientConfig, video: VeoOperationVideo, signal?: AbortSignal) => {
  const response = await fetch(video.uri, {
    headers: { 'x-goog-api-key': config.apiKey.trim() },
    signal
  })
  if (!response.ok) throw new Error(await readApiError(response, `Veo 视频下载失败 (${response.status})`))
  const blob = await response.blob()
  if (!blob.size) throw new Error('Veo 返回了空视频文件')
  return blob.type ? blob : new Blob([blob], { type: video.mimeType || 'video/mp4' })
}
