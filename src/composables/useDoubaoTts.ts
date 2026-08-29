/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */

export const DOUBAO_TTS_CONFIG_KEY = 'doubao_tts_config_v1'

export interface DoubaoTtsConfig {
  appId: string
  accessToken: string
  baseUrl: string
  resourceId: string
}

export interface DoubaoTtsGenerateOptions {
  text: string
  voiceType: string
  resourceId?: string
  model?: string
  speechRate?: number
  pitchRate?: number
  loudnessRate?: number
  sampleRate?: number
  stylePrompt?: string
  filterMarkdown?: boolean
  enableLanguageDetector?: boolean
  signal?: AbortSignal
}

export const DOUBAO_TTS_DEFAULT_BASE_URL = 'https://openspeech.bytedance.com/api/v3/tts/unidirectional/sse'
export const DOUBAO_TTS_DEFAULT_RESOURCE_ID = 'seed-tts-2.0'
export const DOUBAO_TTS_DEFAULT_VOICE = 'zh_female_vv_uranus_bigtts'

const clampInteger = (value: number | undefined, min: number, max: number, fallback = 0) => {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? Math.max(min, Math.min(max, Math.round(numeric))) : fallback
}

const normalizeSampleRate = (value: number | undefined) => {
  const supported = [8000, 16000, 22050, 24000, 32000, 44100, 48000]
  const numeric = Math.round(Number(value))
  return supported.includes(numeric) ? numeric : 24000
}

const normalizeEndpoint = (value: string) => {
  const base = (value || DOUBAO_TTS_DEFAULT_BASE_URL).trim().replace(/\/+$/, '')
  if (/\/api\/v3\/tts\/unidirectional\/sse$/i.test(base)) return base
  if (/\/api\/v3\/tts\/unidirectional$/i.test(base)) return `${base}/sse`
  return `${base}/api/v3/tts/unidirectional/sse`
}

export const loadDoubaoTtsConfig = (): DoubaoTtsConfig => {
  let saved: Partial<DoubaoTtsConfig> = {}
  try { saved = JSON.parse(localStorage.getItem(DOUBAO_TTS_CONFIG_KEY) || '{}') } catch {}
  return {
    appId: saved.appId || '',
    accessToken: saved.accessToken || '',
    baseUrl: saved.baseUrl || DOUBAO_TTS_DEFAULT_BASE_URL,
    resourceId: saved.resourceId || DOUBAO_TTS_DEFAULT_RESOURCE_ID
  }
}

const base64ToBytes = (value: string) => {
  const normalized = value.includes(',') ? value.slice(value.indexOf(',') + 1) : value
  const binary = atob(normalized.replace(/\s/g, ''))
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index)
  return bytes
}

export const buildDoubaoTtsHeaders = (config: DoubaoTtsConfig, resourceId?: string) => ({
  'Content-Type': 'application/json',
  'X-Api-App-Key': config.appId.trim(),
  'X-Api-Access-Key': config.accessToken.trim(),
  'X-Api-Resource-Id': resourceId?.trim() || config.resourceId.trim() || DOUBAO_TTS_DEFAULT_RESOURCE_ID,
  'X-Api-Request-Id': crypto.randomUUID()
})

export const buildDoubaoTtsBody = (options: DoubaoTtsGenerateOptions) => {
  const additions: Record<string, unknown> = {
    disable_markdown_filter: !(options.filterMarkdown ?? true),
    enable_language_detector: options.enableLanguageDetector ?? true,
    post_process: { pitch: clampInteger(options.pitchRate, -12, 12) }
  }
  if (options.stylePrompt?.trim()) additions.context_texts = [options.stylePrompt.trim()]

  return {
    user: { uid: 'nrt-web-user' },
    req_params: {
      text: options.text.trim(),
      speaker: options.voiceType.trim(),
      ...(options.model?.trim() ? { model: options.model.trim() } : {}),
      sample_rate: normalizeSampleRate(options.sampleRate),
      audio_params: {
        format: 'mp3',
        sample_rate: normalizeSampleRate(options.sampleRate),
        bit_rate: 128000,
        speech_rate: clampInteger(options.speechRate, -50, 100),
        loudness_rate: clampInteger(options.loudnessRate, -50, 100)
      },
      additions: JSON.stringify(additions)
    }
  }
}

const describeStatus = (status: number, statusMessage: string, logId: string) => {
  const detail = statusMessage.trim()
  const base = status === 401 || status === 403
    ? '豆包语音鉴权失败，请检查 App ID、Access Token 与资源权限'
    : status === 429
      ? '豆包语音请求过于频繁，请稍后重试'
      : `豆包语音请求失败（状态码：${status}）`
  return [detail || base, logId ? `Log ID：${logId}` : ''].filter(Boolean).join('；')
}

export const parseDoubaoTtsSse = (raw: string, logId = '') => {
  const chunks: Uint8Array[] = []
  let failure = ''
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trimStart()
    if (!trimmed.startsWith('data:')) continue
    const value = trimmed.slice(5).trim()
    if (!value || value === '[DONE]') continue
    try {
      const payload = JSON.parse(value)
      const code = Number(payload?.code ?? 0)
      if (code !== 0 && code !== 20000000) {
        failure = payload?.message || `豆包语音返回错误码 ${code}`
        continue
      }
      if (typeof payload?.data === 'string' && payload.data) chunks.push(base64ToBytes(payload.data))
    } catch {
      // SSE 中可能同时包含注释、事件名或不带数据的状态帧；忽略这些非音频行。
    }
  }
  if (failure) throw new Error([failure, logId ? `Log ID：${logId}` : ''].filter(Boolean).join('；'))
  if (!chunks.length) throw new Error(['豆包语音未返回有效音频', logId ? `Log ID：${logId}` : ''].filter(Boolean).join('；'))
  return new Blob(chunks.map(chunk => Uint8Array.from(chunk).buffer), { type: 'audio/mpeg' })
}

export const generateDoubaoTts = async (config: DoubaoTtsConfig, options: DoubaoTtsGenerateOptions) => {
  if (!config.appId.trim()) throw new Error('MISSING_DOUBAO_TTS_APP_ID')
  if (!config.accessToken.trim()) throw new Error('MISSING_DOUBAO_TTS_ACCESS_TOKEN')
  if (!options.voiceType.trim()) throw new Error('请填写豆包语音音色 ID')
  if (!options.text.trim()) throw new Error('请填写要合成的文本')

  const response = await fetch(normalizeEndpoint(config.baseUrl), {
    method: 'POST',
    headers: buildDoubaoTtsHeaders(config, options.resourceId),
    body: JSON.stringify(buildDoubaoTtsBody(options)),
    signal: options.signal
  })
  const logId = response.headers.get('X-Tt-Logid') || response.headers.get('x-tt-logid') || ''
  const statusMessage = response.headers.get('X-Api-Message') || response.headers.get('x-api-message') || ''
  if (!response.ok) throw new Error(describeStatus(response.status, statusMessage, logId))

  const statusCode = response.headers.get('X-Api-Status-Code') || response.headers.get('x-api-status-code') || ''
  if (statusCode && statusCode !== '20000000') {
    throw new Error([statusMessage || `豆包语音返回错误码 ${statusCode}`, logId ? `Log ID：${logId}` : ''].filter(Boolean).join('；'))
  }
  return parseDoubaoTtsSse(await response.text(), logId)
}
