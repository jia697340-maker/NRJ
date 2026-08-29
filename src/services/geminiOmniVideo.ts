/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */

export const GEMINI_OMNI_MODEL = 'gemini-omni-1.1-flash' as const
export const GEMINI_OMNI_DEFAULT_BASE_URL = 'https://generativelanguage.googleapis.com'

export type GeminiOmniMode = 'text' | 'image' | 'interpolation' | 'references' | 'edit' | 'extend'
export type GeminiOmniAspectRatio = '16:9' | '9:16'
export type GeminiOmniResolution = '360p' | '720p' | '1080p' | '4k'
export type GeminiOmniDuration = 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10

export interface GeminiOmniClientConfig {
  apiKey: string
  baseUrl: string
}

export interface GeminiOmniInput {
  prompt: string
  mode: GeminiOmniMode
  aspectRatio: GeminiOmniAspectRatio
  resolution: GeminiOmniResolution
  durationSeconds: GeminiOmniDuration
  firstFrame?: Blob
  lastFrame?: Blob
  referenceImages?: Blob[]
  referenceVideos?: Blob[]
  sourceVideo?: Blob
  previousInteractionId?: string
}

export interface GeminiOmniVideoOutput {
  mimeType: string
  data?: string
  uri?: string
}

export interface GeminiOmniInteractionResult {
  id: string
  status: string
  video?: GeminiOmniVideoOutput
  error?: string
  raw: any
}

const PRICE_PER_SECOND: Record<GeminiOmniResolution, number> = {
  '360p': 0.03,
  '720p': 0.10,
  '1080p': 0.15,
  '4k': 0.30
}

export const estimateGeminiOmniCost = (resolution: GeminiOmniResolution, duration: GeminiOmniDuration) =>
  Number((PRICE_PER_SECOND[resolution] * duration).toFixed(2))

export const normalizeGeminiOmniBaseUrl = (value: string) => {
  const base = (value || GEMINI_OMNI_DEFAULT_BASE_URL).trim().replace(/\/+$/, '')
  return /\/v1beta$/i.test(base) ? base : `${base}/v1beta`
}

const taskName: Record<GeminiOmniMode, string> = {
  text: 'text_to_video',
  image: 'image_to_video',
  interpolation: 'image_to_video',
  references: 'reference_to_video',
  edit: 'edit',
  extend: 'extend'
}

export const validateGeminiOmniInput = (input: GeminiOmniInput) => {
  if (!input.prompt.trim()) throw new Error(input.mode === 'extend' ? '请描述接下来的场景' : '请填写视频描述')
  if (!Number.isInteger(input.durationSeconds) || input.durationSeconds < 3 || input.durationSeconds > 10) throw new Error('目标时长必须是 3 到 10 秒')
  if (input.mode === 'image' && !input.firstFrame) throw new Error('请添加起始图片')
  if (input.mode === 'interpolation' && (!input.firstFrame || !input.lastFrame)) throw new Error('请同时添加首帧和尾帧')
  if (input.mode === 'references') {
    if (!input.referenceImages?.length && !input.referenceVideos?.length) throw new Error('请至少添加一项参考素材')
    if ((input.referenceImages?.length || 0) > 6) throw new Error('参考图最多六张')
    if ((input.referenceVideos?.length || 0) > 3) throw new Error('参考视频最多三段')
    if (input.referenceVideos?.some(video => !video.type.startsWith('video/'))) throw new Error('视频参考请选择视频文件')
  }
  if ((input.mode === 'edit' || input.mode === 'extend') && !input.previousInteractionId && !input.sourceVideo) {
    throw new Error(input.mode === 'edit' ? '请选择待修改视频' : '请选择待延长视频')
  }
  if (input.sourceVideo && !input.sourceVideo.type.startsWith('video/')) throw new Error('请选择视频文件')
}

const readApiError = async (response: Response, fallback: string) => {
  let message = fallback
  try {
    const payload = await response.json()
    message = payload?.error?.message || payload?.message || fallback
  } catch { /* 保留 HTTP 状态错误。 */ }
  if (response.status === 401 || response.status === 403) return `鉴权、地区或内容权限失败：${message}`
  if (response.status === 429) return `请求过于频繁或额度受限：${message}`
  if (response.status === 402) return `当前项目余额或计费状态不可用：${message}`
  return message
}

const authHeaders = (apiKey: string, json = false) => ({
  'x-goog-api-key': apiKey.trim(),
  ...(json ? { 'Content-Type': 'application/json' } : {})
})

export const uploadGeminiOmniFile = async (config: GeminiOmniClientConfig, file: Blob, displayName: string, signal?: AbortSignal) => {
  if (!config.apiKey.trim()) throw new Error('请填写 Gemini Auth Key')
  const start = await fetch(`${normalizeGeminiOmniBaseUrl(config.baseUrl).replace(/\/v1beta$/i, '')}/upload/v1beta/files`, {
    method: 'POST',
    headers: {
      ...authHeaders(config.apiKey, true),
      'X-Goog-Upload-Protocol': 'resumable',
      'X-Goog-Upload-Command': 'start',
      'X-Goog-Upload-Header-Content-Length': String(file.size),
      'X-Goog-Upload-Header-Content-Type': file.type || 'application/octet-stream'
    },
    body: JSON.stringify({ file: { display_name: displayName } }),
    signal
  })
  if (!start.ok) throw new Error(await readApiError(start, `素材上传初始化失败 (${start.status})`))
  const uploadUrl = start.headers.get('x-goog-upload-url')
  if (!uploadUrl) throw new Error('素材上传接口没有返回上传地址')
  const finish = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'X-Goog-Upload-Offset': '0',
      'X-Goog-Upload-Command': 'upload, finalize'
    },
    body: file,
    signal
  })
  if (!finish.ok) throw new Error(await readApiError(finish, `素材上传失败 (${finish.status})`))
  const payload = await finish.json()
  const uploaded = payload?.file || payload
  if (!uploaded?.uri || !uploaded?.name) throw new Error('素材上传完成，但接口没有返回文件信息')
  return { name: String(uploaded.name), uri: String(uploaded.uri), state: String(uploaded.state || 'PROCESSING') }
}

export const getGeminiOmniFile = async (config: GeminiOmniClientConfig, nameOrUri: string, signal?: AbortSignal) => {
  const match = nameOrUri.match(/files\/([^/:?]+)/)
  const name = match ? `files/${match[1]}` : nameOrUri.replace(/^\/+/, '')
  const response = await fetch(`${normalizeGeminiOmniBaseUrl(config.baseUrl)}/${name}`, { headers: authHeaders(config.apiKey), signal })
  if (!response.ok) throw new Error(await readApiError(response, `素材状态查询失败 (${response.status})`))
  return response.json()
}

export const waitForGeminiOmniFile = async (config: GeminiOmniClientConfig, file: { name: string; uri: string; state?: string }, signal?: AbortSignal) => {
  let current: any = file
  while (!signal?.aborted && String(current?.state || '').toUpperCase() !== 'ACTIVE') {
    if (String(current?.state || '').toUpperCase() === 'FAILED') throw new Error('Google 无法处理所选素材')
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(resolve, 2500)
      signal?.addEventListener('abort', () => { clearTimeout(timer); reject(new DOMException('Aborted', 'AbortError')) }, { once: true })
    })
    current = await getGeminiOmniFile(config, file.name, signal)
  }
  return { name: String(current?.name || file.name), uri: String(current?.uri || file.uri), state: String(current?.state || 'ACTIVE') }
}

const buildInteractionInput = async (config: GeminiOmniClientConfig, input: GeminiOmniInput, signal?: AbortSignal) => {
  if (input.previousInteractionId) return `${input.prompt.trim()}\n\nTarget duration: ${input.durationSeconds} seconds.`
  const content: Array<Record<string, string>> = []
  const upload = async (blob: Blob, label: string) => {
    const file = await uploadGeminiOmniFile(config, blob, label, signal)
    const active = await waitForGeminiOmniFile(config, file, signal)
    content.push({ type: 'document', uri: active.uri })
  }
  if (input.firstFrame) await upload(input.firstFrame, input.mode === 'interpolation' ? 'Omni first frame' : 'Omni source image')
  if (input.lastFrame) await upload(input.lastFrame, 'Omni last frame')
  for (const [index, image] of (input.referenceImages || []).entries()) await upload(image, `Omni reference ${index + 1}`)
  for (const [index, video] of (input.referenceVideos || []).entries()) await upload(video, `Omni video reference ${index + 1}`)
  if (input.sourceVideo) await upload(input.sourceVideo, 'Omni source video')
  content.push({ type: 'text', text: `${input.prompt.trim()}\n\nTarget duration: ${input.durationSeconds} seconds.` })
  return content
}

export const buildGeminiOmniRequestBody = async (config: GeminiOmniClientConfig, input: GeminiOmniInput, signal?: AbortSignal) => {
  validateGeminiOmniInput(input)
  return {
    model: GEMINI_OMNI_MODEL,
    input: await buildInteractionInput(config, input, signal),
    ...(input.previousInteractionId ? { previous_interaction_id: input.previousInteractionId } : {}),
    response_format: {
      type: 'video',
      delivery: 'uri',
      aspect_ratio: input.aspectRatio,
      resolution: input.resolution
    },
    generation_config: { video_config: { task: taskName[input.mode] } },
    background: true,
    store: true
  }
}

const findVideo = (payload: any): GeminiOmniVideoOutput | undefined => {
  const direct = payload?.output_video
  if (direct?.data || direct?.uri) return { mimeType: direct.mime_type || direct.mimeType || 'video/mp4', data: direct.data, uri: direct.uri }
  const content = (payload?.steps || []).flatMap((step: any) => step?.content || [])
  const video = content.find((item: any) => item?.type === 'video' && (item?.data || item?.uri))
  return video ? { mimeType: video.mime_type || video.mimeType || 'video/mp4', data: video.data, uri: video.uri } : undefined
}

const interactionResult = (payload: any): GeminiOmniInteractionResult => ({
  id: String(payload?.id || ''),
  status: String(payload?.status || 'unknown').toLowerCase(),
  video: findVideo(payload),
  error: payload?.error?.message || payload?.error_message || '',
  raw: payload
})

export const createGeminiOmniInteraction = async (config: GeminiOmniClientConfig, input: GeminiOmniInput, signal?: AbortSignal) => {
  if (!config.apiKey.trim()) throw new Error('请填写 Gemini Auth Key')
  const response = await fetch(`${normalizeGeminiOmniBaseUrl(config.baseUrl)}/interactions`, {
    method: 'POST', headers: authHeaders(config.apiKey, true), body: JSON.stringify(await buildGeminiOmniRequestBody(config, input, signal)), signal
  })
  if (!response.ok) throw new Error(await readApiError(response, `Omni 任务提交失败 (${response.status})`))
  const result = interactionResult(await response.json())
  if (!result.id) throw new Error('Omni 接口没有返回 Interaction ID')
  return result
}

export const getGeminiOmniInteraction = async (config: GeminiOmniClientConfig, interactionId: string, signal?: AbortSignal) => {
  const response = await fetch(`${normalizeGeminiOmniBaseUrl(config.baseUrl)}/interactions/${encodeURIComponent(interactionId)}`, {
    headers: authHeaders(config.apiKey), signal
  })
  if (!response.ok) throw new Error(await readApiError(response, `Omni 任务查询失败 (${response.status})`))
  return interactionResult(await response.json())
}

const base64ToBlob = (data: string, mimeType: string) => {
  const normalized = data.includes(',') ? data.slice(data.indexOf(',') + 1) : data
  const binary = atob(normalized)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index)
  return new Blob([bytes], { type: mimeType || 'video/mp4' })
}

export const downloadGeminiOmniVideo = async (config: GeminiOmniClientConfig, output: GeminiOmniVideoOutput, signal?: AbortSignal) => {
  if (output.data) return base64ToBlob(output.data, output.mimeType)
  if (!output.uri) throw new Error('Omni 没有返回可下载的视频')
  const file = await waitForGeminiOmniFile(config, { name: output.uri, uri: output.uri }, signal)
  const match = file.uri.match(/files\/([^/:?]+)/)
  const fileId = match?.[1]
  const url = fileId
    ? `${normalizeGeminiOmniBaseUrl(config.baseUrl)}/files/${encodeURIComponent(fileId)}:download?alt=media`
    : file.uri
  const response = await fetch(url, { headers: authHeaders(config.apiKey), signal })
  if (!response.ok) throw new Error(await readApiError(response, `Omni 视频下载失败 (${response.status})`))
  const blob = await response.blob()
  if (!blob.size) throw new Error('Omni 返回了空视频文件')
  return blob.type ? blob : new Blob([blob], { type: output.mimeType || 'video/mp4' })
}
