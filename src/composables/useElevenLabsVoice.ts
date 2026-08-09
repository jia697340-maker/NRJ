/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */

export const ELEVENLABS_VOICE_CONFIG_KEY = 'elevenlabs_voice_config_v1'

export type ElevenLabsVoiceTransport = 'official' | 'custom'
export type ElevenLabsVoiceProtocol = 'elevenlabs' | 'openai'
export type ElevenLabsVoiceOutputFormat = 'mp3_44100_128' | 'mp3_22050_32' | 'wav_44100'

export interface ElevenLabsVoiceConfig {
  transport: ElevenLabsVoiceTransport
  protocol: ElevenLabsVoiceProtocol
  apiKey: string
  baseUrl: string
  model: string
  outputFormat: ElevenLabsVoiceOutputFormat
}

export interface ElevenLabsVoiceGenerateOptions {
  text: string
  voiceId: string
  model?: string
  languageCode?: string
  stability?: number
  similarityBoost?: number
  style?: number
  useSpeakerBoost?: boolean
  speed?: number
  signal?: AbortSignal
}

const OFFICIAL_BASE_URL = 'https://api.elevenlabs.io'
const DEFAULT_MODEL = 'eleven_multilingual_v2'

const withoutTrailingSlash = (value: string) => value.trim().replace(/\/+$/, '')
const clamp = (value: number | undefined, min: number, max: number, fallback: number) =>
  Math.min(max, Math.max(min, Number.isFinite(value) ? Number(value) : fallback))

export const defaultElevenLabsVoiceBaseUrl = () => OFFICIAL_BASE_URL

export const loadElevenLabsVoiceConfig = (): ElevenLabsVoiceConfig => {
  let saved: Partial<ElevenLabsVoiceConfig> = {}
  try { saved = JSON.parse(localStorage.getItem(ELEVENLABS_VOICE_CONFIG_KEY) || '{}') } catch {}
  const transport = saved.transport === 'custom' ? 'custom' : 'official'
  return {
    transport,
    protocol: transport === 'official' || saved.protocol !== 'openai' ? 'elevenlabs' : 'openai',
    apiKey: saved.apiKey || '',
    baseUrl: saved.baseUrl || OFFICIAL_BASE_URL,
    model: saved.model || DEFAULT_MODEL,
    outputFormat: saved.outputFormat === 'mp3_22050_32' || saved.outputFormat === 'wav_44100'
      ? saved.outputFormat
      : 'mp3_44100_128'
  }
}

const elevenLabsEndpoint = (baseUrl: string, voiceId: string, outputFormat: ElevenLabsVoiceOutputFormat) => {
  const base = withoutTrailingSlash(baseUrl || OFFICIAL_BASE_URL)
  const encodedVoiceId = encodeURIComponent(voiceId)
  const endpoint = /\/v1\/text-to-speech$/i.test(base)
    ? `${base}/${encodedVoiceId}`
    : /\/v1$/i.test(base)
      ? `${base}/text-to-speech/${encodedVoiceId}`
      : `${base}/v1/text-to-speech/${encodedVoiceId}`
  return `${endpoint}?output_format=${encodeURIComponent(outputFormat)}`
}

const openAiEndpoint = (baseUrl: string) => {
  const base = withoutTrailingSlash(baseUrl)
  if (/\/v1\/audio\/speech$/i.test(base) || /\/audio\/speech$/i.test(base)) return base
  if (/\/v1$/i.test(base)) return `${base}/audio/speech`
  return `${base}/v1/audio/speech`
}

const errorMessage = async (response: Response) => {
  const fallback = `ElevenLabs 请求失败（状态码：${response.status}）`
  try {
    const data = await response.json()
    return data?.detail?.message || data?.error?.message || data?.message || data?.detail || fallback
  } catch { return fallback }
}

const base64ToBlob = (value: string, mimeType = 'audio/mpeg') => {
  const normalized = value.includes(',') ? value.slice(value.indexOf(',') + 1) : value
  const binary = atob(normalized.replace(/\s/g, ''))
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index)
  return new Blob([bytes], { type: mimeType })
}

const parseAudioResponse = async (response: Response, signal?: AbortSignal) => {
  const contentType = response.headers.get('content-type')?.toLowerCase() || ''
  if (contentType.startsWith('audio/') || contentType === 'application/octet-stream') return response.blob()
  const data = await response.json()
  const audio = data?.audio || data?.data?.audio || data?.audio_base64 || data?.data?.audio_base64
  if (typeof audio === 'string') return base64ToBlob(audio, data?.mime_type || data?.mimeType || 'audio/mpeg')
  const url = data?.url || data?.data?.url || data?.audio?.url || data?.data?.audio?.url
  if (typeof url === 'string') {
    const audioResponse = await fetch(url, { signal })
    if (!audioResponse.ok) throw new Error('ElevenLabs 音频下载失败')
    return audioResponse.blob()
  }
  throw new Error('ElevenLabs 未返回可解析的音频')
}

export const generateElevenLabsVoice = async (config: ElevenLabsVoiceConfig, options: ElevenLabsVoiceGenerateOptions) => {
  if (!config.apiKey.trim()) throw new Error('MISSING_ELEVENLABS_VOICE_API_KEY')
  if (!config.baseUrl.trim()) throw new Error('请填写 ElevenLabs 接口地址')
  if (!options.voiceId.trim()) throw new Error('请填写 ElevenLabs 音色 ID')
  if (!options.text.trim()) throw new Error('请填写要合成的文本')

  const protocol = config.transport === 'official' ? 'elevenlabs' : config.protocol
  const isOpenAi = protocol === 'openai'
  const response = await fetch(isOpenAi
    ? openAiEndpoint(config.baseUrl)
    : elevenLabsEndpoint(config.baseUrl, options.voiceId, config.outputFormat), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(isOpenAi
        ? { Authorization: `Bearer ${config.apiKey.trim()}` }
        : { 'xi-api-key': config.apiKey.trim() })
    },
    body: JSON.stringify(isOpenAi
      ? {
          input: options.text.trim(),
          model: options.model || config.model || DEFAULT_MODEL,
          voice: options.voiceId.trim(),
          response_format: config.outputFormat.startsWith('wav') ? 'wav' : 'mp3',
          speed: clamp(options.speed, 0.7, 1.2, 1)
        }
      : {
          text: options.text.trim(),
          model_id: options.model || config.model || DEFAULT_MODEL,
          ...(options.languageCode?.trim() ? { language_code: options.languageCode.trim() } : {}),
          voice_settings: {
            stability: clamp(options.stability, 0, 1, 0.5),
            similarity_boost: clamp(options.similarityBoost, 0, 1, 0.75),
            style: clamp(options.style, 0, 1, 0),
            use_speaker_boost: options.useSpeakerBoost ?? true,
            speed: clamp(options.speed, 0.7, 1.2, 1)
          }
        }),
    signal: options.signal
  })
  if (!response.ok) throw new Error(await errorMessage(response))
  return parseAudioResponse(response, options.signal)
}
