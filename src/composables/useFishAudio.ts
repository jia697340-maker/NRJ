/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { Capacitor, CapacitorHttp } from '@capacitor/core'
import { getSecureValue } from '../services/mobileSecureStorage'

export const FISH_AUDIO_CONFIG_KEY = 'fish_audio_config_v1'
export const FISH_AUDIO_SECURE_KEY = 'fish_audio_api_key'
export const FISH_AUDIO_WEB_KEY = 'fish_audio_web_api_key'
export const FISH_AUDIO_SESSION_KEY = 'fish_audio_session_api_key'

export type FishAudioConnectionMode = 'web' | 'app'
export type FishAudioModel = 's2-pro' | 's1'
export type FishAudioFormat = 'mp3' | 'wav' | 'opus'
export type FishAudioLatency = 'normal' | 'balanced' | 'low'

export interface FishAudioConfig {
  connectionMode: FishAudioConnectionMode
  rememberWebKey: boolean
  apiKey: string
  baseUrl: string
  model: FishAudioModel
  format: FishAudioFormat
  sampleRate: number
  mp3Bitrate: 64 | 128 | 192
  latency: FishAudioLatency
  normalize: boolean
  chunkLength: number
}

export interface FishAudioGenerateOptions {
  text: string
  referenceId?: string
  model?: FishAudioModel
  speed?: number
  volume?: number
  temperature?: number
  topP?: number
  stylePrompt?: string
  normalize?: boolean
  latency?: FishAudioLatency
  conditionOnPreviousChunks?: boolean
  signal?: AbortSignal
}

const OFFICIAL_BASE_URL = 'https://api.fish.audio'
const clamp = (value: number | undefined, min: number, max: number, fallback: number) =>
  Math.min(max, Math.max(min, Number.isFinite(value) ? Number(value) : fallback))
const withoutTrailingSlash = (value: string) => value.trim().replace(/\/+$/, '')

export const defaultFishAudioBaseUrl = () => OFFICIAL_BASE_URL

export const normalizeFishAudioReferenceId = (value: string) => {
  const trimmed = value.trim()
  if (!trimmed) return ''
  try {
    const url = new URL(trimmed)
    const match = url.pathname.match(/\/m\/([a-z0-9_-]+)/i)
    if (match?.[1]) return match[1]
  } catch { /* 输入本身可能就是 ID */ }
  return trimmed
}

export const loadFishAudioConfig = (): FishAudioConfig => {
  let saved: Partial<FishAudioConfig> = {}
  try { saved = JSON.parse(localStorage.getItem(FISH_AUDIO_CONFIG_KEY) || '{}') } catch {}
  const connectionMode = saved.connectionMode === 'app' ? 'app' : 'web'
  const rememberWebKey = saved.rememberWebKey === true
  const webKey = connectionMode === 'web'
    ? (sessionStorage.getItem(FISH_AUDIO_SESSION_KEY) || (rememberWebKey ? localStorage.getItem(FISH_AUDIO_WEB_KEY) : '') || '')
    : ''
  const format: FishAudioFormat = saved.format === 'wav' || saved.format === 'opus' ? saved.format : 'mp3'
  const sampleRate = format === 'opus' ? 48000 : [32000, 44100].includes(Number(saved.sampleRate)) ? Number(saved.sampleRate) : 44100
  return {
    connectionMode,
    rememberWebKey,
    apiKey: webKey,
    baseUrl: saved.baseUrl || OFFICIAL_BASE_URL,
    model: saved.model === 's1' ? 's1' : 's2-pro',
    format,
    sampleRate,
    mp3Bitrate: saved.mp3Bitrate === 64 || saved.mp3Bitrate === 192 ? saved.mp3Bitrate : 128,
    latency: saved.latency === 'balanced' || saved.latency === 'low' ? saved.latency : 'normal',
    normalize: saved.normalize !== false,
    chunkLength: Math.round(clamp(saved.chunkLength, 100, 300, 200))
  }
}

export const resolveFishAudioApiKey = async (config: FishAudioConfig) => {
  if (config.apiKey.trim()) return config.apiKey.trim()
  if (config.connectionMode === 'app') return (await getSecureValue(FISH_AUDIO_SECURE_KEY))?.trim() || ''
  return sessionStorage.getItem(FISH_AUDIO_SESSION_KEY)?.trim()
    || (config.rememberWebKey ? localStorage.getItem(FISH_AUDIO_WEB_KEY)?.trim() : '')
    || ''
}

const endpoint = (baseUrl: string, path: string) => {
  const base = withoutTrailingSlash(baseUrl || OFFICIAL_BASE_URL)
  if (path === '/v1/tts' && /\/v1\/tts$/i.test(base)) return base
  return `${base}${path}`
}

const decodeBase64 = (value: string) => {
  const normalized = value.includes(',') ? value.slice(value.indexOf(',') + 1) : value
  const binary = atob(normalized.replace(/\s/g, ''))
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index)
  return bytes
}

const mimeFor = (format: FishAudioFormat) => format === 'wav' ? 'audio/wav' : format === 'opus' ? 'audio/opus' : 'audio/mpeg'

const nativeAudioBlob = (data: unknown, format: FishAudioFormat) => {
  if (data instanceof Blob) return data
  if (data instanceof ArrayBuffer) return new Blob([data], { type: mimeFor(format) })
  if (ArrayBuffer.isView(data)) return new Blob([data as ArrayBufferView<ArrayBuffer>], { type: mimeFor(format) })
  if (typeof data === 'string') return new Blob([decodeBase64(data)], { type: mimeFor(format) })
  if (data && typeof data === 'object') {
    const value = (data as any).data || (data as any).audio || (data as any).audio_base64
    if (typeof value === 'string') return new Blob([decodeBase64(value)], { type: mimeFor(format) })
  }
  throw new Error('Fish Audio 未返回可解析的音频')
}

const messageFromPayload = (payload: any, status: number) => {
  const fallback = `Fish Audio 请求失败（状态码：${status}）`
  if (status === 401) return 'Fish Audio API Key 无效或已过期'
  if (status === 402) return 'Fish Audio 余额不足，请充值后重试'
  if (status === 429) return 'Fish Audio 请求过于频繁，请稍后重试'
  return payload?.message || payload?.detail?.message || payload?.detail || payload?.error?.message || fallback
}

const requestJson = async (config: FishAudioConfig, path: string) => {
  const apiKey = await resolveFishAudioApiKey(config)
  if (!apiKey) throw new Error('MISSING_FISH_AUDIO_API_KEY')
  const url = endpoint(config.baseUrl, path)
  if (config.connectionMode === 'app') {
    if (!Capacitor.isNativePlatform()) throw new Error('Fish Audio App 直连需要在安装后的 Android 或 iOS App 中使用')
    const response = await CapacitorHttp.request({ url, method: 'GET', headers: { Authorization: `Bearer ${apiKey}` }, responseType: 'json', connectTimeout: 30000, readTimeout: 60000 })
    if (response.status < 200 || response.status >= 300) throw new Error(messageFromPayload(response.data, response.status))
    return response.data
  }
  try {
    const response = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}` } })
    const payload = await response.json().catch(() => null)
    if (!response.ok) throw new Error(messageFromPayload(payload, response.status))
    return payload
  } catch (error) {
    if (error instanceof Error && /Fish Audio|余额|请求过于频繁/.test(error.message)) throw error
    throw new Error('浏览器无法直连 Fish Audio。请检查网络、接口地址及服务是否允许网页跨域访问；安装版可使用 App 直连。')
  }
}

export const getFishAudioCredit = (config: FishAudioConfig) => requestJson(config, '/wallet/self/api-credit')

export const generateFishAudio = async (config: FishAudioConfig, options: FishAudioGenerateOptions) => {
  const apiKey = await resolveFishAudioApiKey(config)
  if (!apiKey) throw new Error('MISSING_FISH_AUDIO_API_KEY')
  if (!config.baseUrl.trim()) throw new Error('请填写 Fish Audio 接口地址')
  if (!options.text.trim()) throw new Error('请填写要合成的文本')
  const referenceId = normalizeFishAudioReferenceId(options.referenceId || '')
  const stylePrompt = options.stylePrompt?.trim() || ''
  const model = options.model || config.model
  const cleanStyle = stylePrompt.replace(/[()[\]\r\n]+/g, ' ').replace(/\s+/g, ' ').trim()
  const text = cleanStyle ? `${model === 's1' ? `(${cleanStyle})` : `[${cleanStyle}]`} ${options.text.trim()}` : options.text.trim()
  const format = config.format
  const body = {
    text,
    ...(referenceId ? { reference_id: referenceId } : {}),
    temperature: clamp(options.temperature, 0, 1, 0.7),
    top_p: clamp(options.topP, 0, 1, 0.7),
    prosody: {
      speed: clamp(options.speed, 0.5, 2, 1),
      volume: clamp(options.volume, -20, 20, 0),
      normalize_loudness: true
    },
    chunk_length: Math.round(clamp(config.chunkLength, 100, 300, 200)),
    normalize: options.normalize ?? config.normalize,
    format,
    sample_rate: format === 'opus' ? 48000 : config.sampleRate,
    ...(format === 'mp3' ? { mp3_bitrate: config.mp3Bitrate } : {}),
    latency: options.latency || config.latency,
    condition_on_previous_chunks: options.conditionOnPreviousChunks ?? true
  }
  const url = endpoint(config.baseUrl, '/v1/tts')
  const headers = { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', model }

  if (config.connectionMode === 'app') {
    if (!Capacitor.isNativePlatform()) throw new Error('Fish Audio App 直连需要在安装后的 Android 或 iOS App 中使用')
    const response = await CapacitorHttp.request({ url, method: 'POST', headers, data: body, responseType: 'arraybuffer', connectTimeout: 30000, readTimeout: 180000 })
    if (response.status < 200 || response.status >= 300) throw new Error(messageFromPayload(response.data, response.status))
    return nativeAudioBlob(response.data, format)
  }

  try {
    const response = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body), signal: options.signal })
    if (!response.ok) {
      const payload = await response.json().catch(() => null)
      throw new Error(messageFromPayload(payload, response.status))
    }
    const audio = await response.blob()
    if (!audio.size) throw new Error('Fish Audio 未返回有效音频')
    return audio.type ? audio : new Blob([audio], { type: mimeFor(format) })
  } catch (error) {
    if ((error as Error)?.name === 'AbortError') throw error
    if (error instanceof Error && /Fish Audio|余额|请求过于频繁/.test(error.message)) throw error
    throw new Error('浏览器无法直连 Fish Audio。请检查网络、接口地址及服务是否允许网页跨域访问；安装版可使用 App 直连。')
  }
}
