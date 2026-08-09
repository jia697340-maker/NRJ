/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */

export const SEED_AUDIO_CONFIG_KEY = 'seed_audio_config_v1'

export type SeedAudioTransport = 'byteplus' | 'fal' | 'custom'
export type SeedAudioProtocol = 'byteplus' | 'fal'

export interface SeedAudioConfig {
  transport: SeedAudioTransport
  apiKey: string
  baseUrl: string
  model: string
  customProtocol: SeedAudioProtocol
}

export interface SeedAudioGenerateOptions {
  text: string
  referenceUrls?: string[]
  voice?: string
  multilingual?: boolean
  format?: 'mp3' | 'wav'
  sampleRate?: number
  speed?: number
  volume?: number
  pitch?: number
  signal?: AbortSignal
}

const DEFAULT_BYTEPLUS_URL = 'https://voice.ap-southeast-1.bytepluses.com'
const DEFAULT_FAL_URL = 'https://queue.fal.run'

const withoutTrailingSlash = (value: string) => value.replace(/\/+$/, '')

export const defaultSeedAudioBaseUrl = (transport: SeedAudioTransport) => {
  if (transport === 'byteplus') return DEFAULT_BYTEPLUS_URL
  if (transport === 'fal') return DEFAULT_FAL_URL
  return ''
}

export const loadSeedAudioConfig = (): SeedAudioConfig => {
  let saved: Partial<SeedAudioConfig> = {}
  try { saved = JSON.parse(localStorage.getItem(SEED_AUDIO_CONFIG_KEY) || '{}') } catch {}
  const transport = saved.transport === 'fal' || saved.transport === 'custom' ? saved.transport : 'byteplus'
  return {
    transport,
    apiKey: saved.apiKey || '',
    baseUrl: saved.baseUrl || defaultSeedAudioBaseUrl(transport),
    model: saved.model || 'seed-audio-1.0',
    customProtocol: saved.customProtocol === 'fal' ? 'fal' : 'byteplus'
  }
}

const errorMessage = async (response: Response) => {
  const fallback = `Seed Audio 请求失败（状态码：${response.status}）`
  try {
    const data = await response.json()
    return data?.error?.message || data?.message || data?.detail || fallback
  } catch { return fallback }
}

const base64ToBlob = (value: string, format: 'mp3' | 'wav') => {
  const normalized = value.includes(',') ? value.slice(value.indexOf(',') + 1) : value
  const binary = atob(normalized)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type: format === 'wav' ? 'audio/wav' : 'audio/mpeg' })
}

const downloadAudio = async (url: string, signal?: AbortSignal) => {
  const response = await fetch(url, { signal })
  if (!response.ok) throw new Error('Seed Audio 音频下载失败')
  return response.blob()
}

const bytePlusGenerate = async (config: SeedAudioConfig, options: SeedAudioGenerateOptions) => {
  const baseUrl = withoutTrailingSlash(config.baseUrl || DEFAULT_BYTEPLUS_URL)
  const format = options.format || 'mp3'
  const references = (options.referenceUrls || []).slice(0, 3).map(audioUrl => ({ audio_url: audioUrl }))
  const response = await fetch(`${baseUrl}/api/v3/tts/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Api-Key': config.apiKey },
    body: JSON.stringify({
      model: config.model || 'seed-audio-1.0',
      text_prompt: options.text,
      ...(references.length ? { references } : {}),
      audio_config: {
        format,
        sample_rate: options.sampleRate || 24000,
        speech_rate: Math.round(((options.speed ?? 1) - 1) * 100),
        loudness_rate: Math.round(((options.volume ?? 1) - 1) * 100),
        pitch_rate: Math.round(((options.pitch ?? 1) - 1) * 100)
      }
    }),
    signal: options.signal
  })
  if (!response.ok) throw new Error(await errorMessage(response))
  const data = await response.json()
  if (data.audio) return base64ToBlob(data.audio, format)
  if (data.url) return downloadAudio(data.url, options.signal)
  if (data.data?.audio) return base64ToBlob(data.data.audio, format)
  if (data.data?.url) return downloadAudio(data.data.url, options.signal)
  throw new Error('Seed Audio 未返回有效音频')
}

const wait = (duration: number, signal?: AbortSignal) => new Promise<void>((resolve, reject) => {
  const timer = setTimeout(resolve, duration)
  signal?.addEventListener('abort', () => { clearTimeout(timer); reject(signal.reason) }, { once: true })
})

const falGenerate = async (config: SeedAudioConfig, options: SeedAudioGenerateOptions) => {
  const baseUrl = withoutTrailingSlash(config.baseUrl || DEFAULT_FAL_URL)
  const endpoint = `${baseUrl}/bytedance/seed-audio-1.0`
  const headers = { 'Content-Type': 'application/json', Authorization: `Key ${config.apiKey}` }
  const response = await fetch(endpoint, {
    method: 'POST', headers, signal: options.signal,
    body: JSON.stringify({ input: {
      prompt: options.text,
      ...(options.voice ? { voice: options.voice } : {}),
      ...((options.referenceUrls || []).length ? { audio_urls: (options.referenceUrls || []).slice(0, 3) } : {}),
      output_format: options.format || 'mp3',
      sample_rate: options.sampleRate || 24000,
      speed: options.speed ?? 1,
      volume: options.volume ?? 1,
      pitch: Math.round(((options.pitch ?? 1) - 1) * 12),
      multilingual: options.multilingual ?? true
    } })
  })
  if (!response.ok) throw new Error(await errorMessage(response))
  const submitted = await response.json()
  let statusUrl = submitted.status_url || `${endpoint}/requests/${submitted.request_id}/status`
  let responseUrl = submitted.response_url || `${endpoint}/requests/${submitted.request_id}`
  if (!submitted.request_id && submitted.audio?.url) return downloadAudio(submitted.audio.url, options.signal)
  if (!submitted.request_id) throw new Error('fal 未返回有效任务编号')

  for (let attempt = 0; attempt < 90; attempt++) {
    await wait(Math.min(800 + attempt * 120, 3000), options.signal)
    const statusResponse = await fetch(statusUrl, { headers, signal: options.signal })
    if (!statusResponse.ok) throw new Error(await errorMessage(statusResponse))
    const status = await statusResponse.json()
    if (status.status === 'COMPLETED') {
      const resultResponse = await fetch(responseUrl, { headers, signal: options.signal })
      if (!resultResponse.ok) throw new Error(await errorMessage(resultResponse))
      const result = await resultResponse.json()
      const url = result.audio?.url || result.data?.audio?.url
      if (!url) throw new Error('fal 未返回有效音频地址')
      return downloadAudio(url, options.signal)
    }
    if (status.status === 'FAILED') throw new Error(status.error || 'fal Seed Audio 合成失败')
  }
  throw new Error('Seed Audio 合成等待超时')
}

export const generateSeedAudio = async (config: SeedAudioConfig, options: SeedAudioGenerateOptions) => {
  if (!config.apiKey.trim()) throw new Error('MISSING_SEED_AUDIO_API_KEY')
  const protocol = config.transport === 'custom' ? config.customProtocol : config.transport
  return protocol === 'fal' ? falGenerate(config, options) : bytePlusGenerate(config, options)
}
