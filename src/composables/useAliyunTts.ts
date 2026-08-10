/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */

export const ALIYUN_TTS_CONFIG_KEY = 'aliyun_tts_config_v1'

export type AliyunTtsTransport = 'official' | 'custom'
export type AliyunTtsProtocol = 'dashscope' | 'openai'
export type AliyunTtsRegion = 'china' | 'international'

export interface AliyunTtsConfig {
  transport: AliyunTtsTransport
  protocol: AliyunTtsProtocol
  apiKey: string
  region: AliyunTtsRegion
  baseUrl: string
  model: string
}

export interface AliyunTtsGenerateOptions {
  text: string
  voice: string
  languageType?: string
  instructions?: string
  optimizeInstructions?: boolean
  signal?: AbortSignal
}

const DEFAULT_MODEL = 'qwen3-tts-instruct-flash'

const withoutTrailingSlash = (value: string) => value.trim().replace(/\/+$/, '')

export const defaultAliyunTtsBaseUrl = (region: AliyunTtsRegion = 'china') =>
  region === 'international' ? 'https://dashscope-intl.aliyuncs.com' : 'https://dashscope.aliyuncs.com'

export const loadAliyunTtsConfig = (): AliyunTtsConfig => {
  let saved: Partial<AliyunTtsConfig> = {}
  try { saved = JSON.parse(localStorage.getItem(ALIYUN_TTS_CONFIG_KEY) || '{}') } catch {}
  const transport = saved.transport === 'custom' ? 'custom' : 'official'
  const region = saved.region === 'international' ? 'international' : 'china'
  return {
    transport,
    protocol: transport === 'official' || saved.protocol !== 'openai' ? 'dashscope' : 'openai',
    apiKey: saved.apiKey || '',
    region,
    baseUrl: saved.baseUrl || defaultAliyunTtsBaseUrl(region),
    model: saved.model || DEFAULT_MODEL
  }
}

const dashScopeEndpoint = (config: AliyunTtsConfig) => {
  const base = withoutTrailingSlash(config.transport === 'official' ? defaultAliyunTtsBaseUrl(config.region) : config.baseUrl)
  if (/\/api\/v1\/services\/aigc\/multimodal-generation\/generation$/i.test(base)) return base
  return `${base}/api/v1/services/aigc/multimodal-generation/generation`
}

const openAiEndpoint = (baseUrl: string) => {
  const base = withoutTrailingSlash(baseUrl)
  if (/\/v1\/audio\/speech$/i.test(base) || /\/audio\/speech$/i.test(base)) return base
  if (/\/v1$/i.test(base)) return `${base}/audio/speech`
  return `${base}/v1/audio/speech`
}

const base64ToBytes = (value: string) => {
  const normalized = value.includes(',') ? value.slice(value.indexOf(',') + 1) : value
  const binary = atob(normalized.replace(/\s/g, ''))
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index)
  return bytes
}

const downloadAudio = async (url: string, signal?: AbortSignal) => {
  const response = await fetch(url, { signal })
  if (!response.ok) throw new Error('阿里云 TTS 音频下载失败')
  return response.blob()
}

const audioFromPayload = async (payload: any, signal?: AbortSignal): Promise<Blob | null> => {
  const audio = payload?.output?.audio || payload?.data?.audio || payload?.audio
  const url = typeof audio === 'object' ? audio?.url : (payload?.url || payload?.data?.url)
  if (typeof url === 'string' && url) return downloadAudio(url, signal)
  const encoded = typeof audio === 'string' ? audio : (audio?.data || payload?.audio_base64 || payload?.data?.audio_base64)
  if (typeof encoded === 'string' && encoded) return new Blob([base64ToBytes(encoded)], { type: 'audio/mpeg' })
  return null
}

const parseDashScopeResponse = async (response: Response, signal?: AbortSignal) => {
  const contentType = response.headers.get('content-type')?.toLowerCase() || ''
  if (contentType.startsWith('audio/') || contentType === 'application/octet-stream') return response.blob()
  const raw = await response.text()
  const payloads: any[] = []
  if (contentType.includes('text/event-stream') || raw.trimStart().startsWith('data:')) {
    for (const line of raw.split(/\r?\n/)) {
      if (!line.startsWith('data:')) continue
      const value = line.slice(5).trim()
      if (!value || value === '[DONE]') continue
      try { payloads.push(JSON.parse(value)) } catch {}
    }
  } else {
    try { payloads.push(JSON.parse(raw)) } catch { throw new Error('阿里云 TTS 返回了无法解析的数据') }
  }
  for (let index = payloads.length - 1; index >= 0; index--) {
    const candidate = payloads[index]?.output?.audio || payloads[index]?.data?.audio || payloads[index]?.audio
    const url = typeof candidate === 'object' ? candidate?.url : (payloads[index]?.url || payloads[index]?.data?.url)
    if (typeof url === 'string' && url) return downloadAudio(url, signal)
  }
  const chunks = payloads
    .map(payload => payload?.output?.audio?.data)
    .filter((value): value is string => typeof value === 'string' && Boolean(value))
    .map(base64ToBytes)
  if (chunks.length) return new Blob(chunks, { type: 'audio/mpeg' })
  if (payloads.length === 1) {
    const audio = await audioFromPayload(payloads[0], signal)
    if (audio) return audio
  }
  const error = payloads.find(payload => payload?.message || payload?.error?.message)
  throw new Error(error?.error?.message || error?.message || '阿里云 TTS 未返回可解析的音频')
}

const parseOpenAiResponse = async (response: Response, signal?: AbortSignal) => {
  const contentType = response.headers.get('content-type')?.toLowerCase() || ''
  if (contentType.startsWith('audio/') || contentType === 'application/octet-stream') return response.blob()
  const payload = await response.json()
  const audio = await audioFromPayload(payload, signal)
  if (audio) return audio
  throw new Error(payload?.error?.message || payload?.message || '阿里云 TTS 中转未返回可解析的音频')
}

const errorMessage = async (response: Response) => {
  const fallback = `阿里云 TTS 请求失败（状态码：${response.status}）`
  try {
    const text = await response.text()
    try {
      const data = JSON.parse(text)
      return data?.error?.message || data?.message || data?.code || fallback
    } catch { return text.trim() || fallback }
  } catch { return fallback }
}

export const generateAliyunTts = async (config: AliyunTtsConfig, options: AliyunTtsGenerateOptions) => {
  if (!config.apiKey.trim()) throw new Error('MISSING_ALIYUN_TTS_API_KEY')
  if (!options.voice.trim()) throw new Error('请填写阿里云 TTS 音色名称')
  if (!options.text.trim()) throw new Error('请填写要合成的文本')
  if (config.transport === 'custom' && !config.baseUrl.trim()) throw new Error('请填写阿里云 TTS 中转地址')

  const protocol = config.transport === 'official' ? 'dashscope' : config.protocol
  const response = await fetch(protocol === 'dashscope' ? dashScopeEndpoint(config) : openAiEndpoint(config.baseUrl), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey.trim()}`,
      ...(protocol === 'dashscope' ? { 'X-DashScope-SSE': 'enable' } : {})
    },
    body: JSON.stringify(protocol === 'dashscope'
      ? {
          model: config.model || DEFAULT_MODEL,
          input: {
            text: options.text.trim(),
            voice: options.voice.trim(),
            language_type: options.languageType || 'Auto',
            ...(options.instructions?.trim() ? {
              instructions: options.instructions.trim(),
              optimize_instructions: options.optimizeInstructions ?? false
            } : {})
          }
        }
      : {
          model: config.model || DEFAULT_MODEL,
          input: options.text.trim(),
          voice: options.voice.trim(),
          response_format: 'mp3',
          ...(options.languageType && options.languageType !== 'Auto' ? { language: options.languageType } : {}),
          ...(options.instructions?.trim() ? {
            instructions: options.instructions.trim(),
            optimize_instructions: options.optimizeInstructions ?? false
          } : {})
        }),
    signal: options.signal
  })
  if (!response.ok) throw new Error(await errorMessage(response))
  return protocol === 'dashscope' ? parseDashScopeResponse(response, options.signal) : parseOpenAiResponse(response, options.signal)
}
