/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */

export const GEMINI_VOICE_CONFIG_KEY = 'gemini_voice_config_v1'

export type GeminiVoiceTransport = 'official' | 'custom'
export type GeminiVoiceProtocol = 'interactions' | 'generate_content'
export type GeminiVoiceAuthMode = 'x_goog_api_key' | 'bearer'

export interface GeminiVoiceConfig {
  transport: GeminiVoiceTransport
  protocol: GeminiVoiceProtocol
  authMode: GeminiVoiceAuthMode
  apiKey: string
  baseUrl: string
  model: string
}

export interface GeminiVoiceGenerateOptions {
  text: string
  voiceName?: string
  stylePrompt?: string
  signal?: AbortSignal
}

const OFFICIAL_BASE_URL = 'https://generativelanguage.googleapis.com'
const DEFAULT_MODEL = 'gemini-3.1-flash-tts-preview'

const withoutTrailingSlash = (value: string) => value.trim().replace(/\/+$/, '')

export const defaultGeminiVoiceBaseUrl = () => OFFICIAL_BASE_URL

export const loadGeminiVoiceConfig = (): GeminiVoiceConfig => {
  let saved: Partial<GeminiVoiceConfig> = {}
  try { saved = JSON.parse(localStorage.getItem(GEMINI_VOICE_CONFIG_KEY) || '{}') } catch {}
  const transport = saved.transport === 'custom' ? 'custom' : 'official'
  return {
    transport,
    protocol: saved.protocol === 'generate_content' ? 'generate_content' : 'interactions',
    authMode: saved.authMode === 'bearer' ? 'bearer' : 'x_goog_api_key',
    apiKey: saved.apiKey || '',
    baseUrl: saved.baseUrl || OFFICIAL_BASE_URL,
    model: saved.model || DEFAULT_MODEL
  }
}

const endpointFor = (config: GeminiVoiceConfig) => {
  const baseUrl = withoutTrailingSlash(config.baseUrl || OFFICIAL_BASE_URL)
  if (config.protocol === 'generate_content') {
    if (/:generateContent$/i.test(baseUrl)) return baseUrl
    if (/\/v1beta$/i.test(baseUrl)) return `${baseUrl}/models/${encodeURIComponent(config.model)}:generateContent`
    return `${baseUrl}/v1beta/models/${encodeURIComponent(config.model)}:generateContent`
  }
  if (/\/v1beta\/interactions$/i.test(baseUrl) || /\/interactions$/i.test(baseUrl)) return baseUrl
  if (/\/v1beta$/i.test(baseUrl)) return `${baseUrl}/interactions`
  return `${baseUrl}/v1beta/interactions`
}

const headersFor = (config: GeminiVoiceConfig) => ({
  'Content-Type': 'application/json',
  ...(config.transport === 'official' || config.authMode === 'x_goog_api_key'
    ? { 'x-goog-api-key': config.apiKey.trim() }
    : { Authorization: `Bearer ${config.apiKey.trim()}` })
})

const promptFor = (options: GeminiVoiceGenerateOptions) => {
  const direction = options.stylePrompt?.trim()
  return [
    'Synthesize speech from the transcript below. Do not read the instructions aloud.',
    direction ? `Director notes: ${direction}` : '',
    'TRANSCRIPT:',
    options.text.trim()
  ].filter(Boolean).join('\n')
}

const requestBodyFor = (config: GeminiVoiceConfig, options: GeminiVoiceGenerateOptions) => {
  const prompt = promptFor(options)
  const voiceName = options.voiceName?.trim() || 'Kore'
  if (config.protocol === 'generate_content') {
    return {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } }
      }
    }
  }
  return {
    model: config.model || DEFAULT_MODEL,
    input: prompt,
    response_format: { type: 'audio' },
    generation_config: { speech_config: [{ voice: voiceName }] }
  }
}

const errorMessage = async (response: Response) => {
  const fallback = `Gemini TTS 请求失败（状态码：${response.status}）`
  try {
    const data = await response.json()
    return data?.error?.message || data?.message || data?.detail || fallback
  } catch { return fallback }
}

const findAudio = (payload: any): { data: string; mimeType: string } | null => {
  if (payload?.output_audio?.data) {
    return { data: payload.output_audio.data, mimeType: payload.output_audio.mime_type || payload.output_audio.mimeType || 'audio/L16;rate=24000' }
  }
  const seen = new Set<any>()
  const visit = (value: any): { data: string; mimeType: string } | null => {
    if (!value || typeof value !== 'object' || seen.has(value)) return null
    seen.add(value)
    const inline = value.inlineData || value.inline_data
    if (inline?.data && String(inline.mimeType || inline.mime_type || '').toLowerCase().startsWith('audio/')) {
      return { data: inline.data, mimeType: inline.mimeType || inline.mime_type }
    }
    if (value.type === 'audio' && typeof value.data === 'string') {
      return { data: value.data, mimeType: value.mime_type || value.mimeType || 'audio/L16;rate=24000' }
    }
    for (const nested of Object.values(value)) {
      const found = Array.isArray(nested)
        ? nested.map(visit).find(Boolean) as { data: string; mimeType: string } | undefined
        : visit(nested)
      if (found) return found
    }
    return null
  }
  return visit(payload)
}

const decodeBase64 = (value: string) => {
  const normalized = value.includes(',') ? value.slice(value.indexOf(',') + 1) : value
  const binary = atob(normalized.replace(/\s/g, ''))
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index)
  return bytes
}

const isWav = (bytes: Uint8Array) => bytes.length >= 12
  && String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF'
  && String.fromCharCode(...bytes.slice(8, 12)) === 'WAVE'

const isMp3 = (bytes: Uint8Array) => bytes.length >= 3
  && (String.fromCharCode(...bytes.slice(0, 3)) === 'ID3' || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0))

const pcmToWav = (pcm: Uint8Array, sampleRate = 24000) => {
  const buffer = new ArrayBuffer(44 + pcm.length)
  const view = new DataView(buffer)
  const write = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index++) view.setUint8(offset + index, value.charCodeAt(index))
  }
  write(0, 'RIFF')
  view.setUint32(4, 36 + pcm.length, true)
  write(8, 'WAVE')
  write(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  write(36, 'data')
  view.setUint32(40, pcm.length, true)
  new Uint8Array(buffer, 44).set(pcm)
  return new Blob([buffer], { type: 'audio/wav' })
}

const audioBlob = (data: string, mimeType: string) => {
  const bytes = decodeBase64(data)
  if (isWav(bytes)) return new Blob([bytes], { type: 'audio/wav' })
  if (isMp3(bytes)) return new Blob([bytes], { type: 'audio/mpeg' })
  const rate = Number(mimeType.match(/rate[=:]\s*(\d+)/i)?.[1]) || 24000
  return pcmToWav(bytes, rate)
}

export const generateGeminiVoice = async (config: GeminiVoiceConfig, options: GeminiVoiceGenerateOptions) => {
  if (!config.apiKey.trim()) throw new Error('MISSING_GEMINI_VOICE_API_KEY')
  if (!config.baseUrl.trim()) throw new Error('请填写 Gemini TTS 接口地址')
  if (!options.text.trim()) throw new Error('请填写要合成的文本')

  let lastError: Error | null = null
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetch(endpointFor(config), {
        method: 'POST',
        headers: headersFor(config),
        body: JSON.stringify(requestBodyFor(config, options)),
        signal: options.signal
      })
      if (!response.ok) {
        const message = await errorMessage(response)
        if (attempt === 0 && (response.status === 500 || response.status === 503)) {
          lastError = new Error(message)
          continue
        }
        throw new Error(message)
      }
      const payload = await response.json()
      const audio = findAudio(payload)
      if (!audio) throw new Error('Gemini TTS 未返回可解析的音频')
      return audioBlob(audio.data, audio.mimeType)
    } catch (error: any) {
      if (error?.name === 'AbortError') throw error
      lastError = error instanceof Error ? error : new Error('Gemini TTS 合成失败')
      if (attempt === 0 && /(?:500|503|internal|unavailable)/i.test(lastError.message)) continue
      throw lastError
    }
  }
  throw lastError || new Error('Gemini TTS 合成失败')
}
