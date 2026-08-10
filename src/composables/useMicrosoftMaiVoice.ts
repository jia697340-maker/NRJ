/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */

export const MICROSOFT_MAI_VOICE_CONFIG_KEY = 'microsoft_mai_voice_config_v1'

export type MicrosoftMaiVoiceTransport = 'official' | 'custom'
export type MicrosoftMaiVoiceProtocol = 'azure' | 'openai'

export interface MicrosoftMaiVoiceConfig {
  transport: MicrosoftMaiVoiceTransport
  protocol: MicrosoftMaiVoiceProtocol
  apiKey: string
  region: string
  baseUrl: string
  model: string
}

export interface MicrosoftMaiVoiceGenerateOptions {
  text: string
  voiceName: string
  style?: string
  styleDegree?: number
  signal?: AbortSignal
}

const DEFAULT_REGION = 'eastus'
const DEFAULT_MODEL = 'microsoft/mai-voice-2'

const withoutTrailingSlash = (value: string) => value.trim().replace(/\/+$/, '')

export const defaultMicrosoftMaiVoiceBaseUrl = (region = DEFAULT_REGION) =>
  `https://${region.trim() || DEFAULT_REGION}.tts.speech.microsoft.com`

export const loadMicrosoftMaiVoiceConfig = (): MicrosoftMaiVoiceConfig => {
  let saved: Partial<MicrosoftMaiVoiceConfig> = {}
  try { saved = JSON.parse(localStorage.getItem(MICROSOFT_MAI_VOICE_CONFIG_KEY) || '{}') } catch {}
  const transport = saved.transport === 'custom' ? 'custom' : 'official'
  const region = saved.region?.trim() || DEFAULT_REGION
  return {
    transport,
    protocol: transport === 'official' || saved.protocol !== 'openai' ? 'azure' : 'openai',
    apiKey: saved.apiKey || '',
    region,
    baseUrl: saved.baseUrl || defaultMicrosoftMaiVoiceBaseUrl(region),
    model: saved.model || DEFAULT_MODEL
  }
}

const escapeXml = (value: string) => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&apos;')

const localeForVoice = (voiceName: string) => {
  const match = voiceName.trim().match(/^([a-z]{2,3}-[A-Z]{2})-/)
  return match?.[1] || 'zh-CN'
}

const clampStyleDegree = (value: number | undefined) =>
  Math.min(2, Math.max(0.01, Number.isFinite(value) ? Number(value) : 1))

const buildSsml = (options: MicrosoftMaiVoiceGenerateOptions) => {
  const voiceName = escapeXml(options.voiceName.trim())
  const locale = escapeXml(localeForVoice(options.voiceName))
  const text = escapeXml(options.text.trim())
  const style = options.style?.trim()
  const content = style
    ? `<mstts:express-as style="${escapeXml(style)}" styledegree="${clampStyleDegree(options.styleDegree)}">${text}</mstts:express-as>`
    : text
  return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="http://www.w3.org/2001/mstts" xml:lang="${locale}"><voice name="${voiceName}">${content}</voice></speak>`
}

const azureEndpoint = (config: MicrosoftMaiVoiceConfig) => {
  const base = withoutTrailingSlash(config.transport === 'official'
    ? defaultMicrosoftMaiVoiceBaseUrl(config.region)
    : config.baseUrl)
  if (/\/cognitiveservices\/v1$/i.test(base)) return base
  return `${base}/cognitiveservices/v1`
}

const openAiEndpoint = (baseUrl: string) => {
  const base = withoutTrailingSlash(baseUrl)
  if (/\/v1\/audio\/speech$/i.test(base) || /\/audio\/speech$/i.test(base)) return base
  if (/\/v1$/i.test(base)) return `${base}/audio/speech`
  return `${base}/v1/audio/speech`
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
  if (typeof audio === 'string' && !/^https?:\/\//i.test(audio)) return base64ToBlob(audio, data?.mime_type || data?.mimeType || 'audio/mpeg')
  const url = typeof audio === 'string' ? audio : (data?.url || data?.data?.url || data?.audio?.url || data?.data?.audio?.url)
  if (typeof url === 'string') {
    const audioResponse = await fetch(url, { signal })
    if (!audioResponse.ok) throw new Error('Microsoft MAI Voice 音频下载失败')
    return audioResponse.blob()
  }
  throw new Error('Microsoft MAI Voice 未返回可解析的音频')
}

const errorMessage = async (response: Response) => {
  const fallback = `Microsoft MAI Voice 请求失败（状态码：${response.status}）`
  try {
    const contentType = response.headers.get('content-type')?.toLowerCase() || ''
    if (contentType.includes('json')) {
      const data = await response.json()
      return data?.error?.message || data?.message || data?.detail || fallback
    }
    const text = await response.text()
    return text.trim() || fallback
  } catch { return fallback }
}

export const generateMicrosoftMaiVoice = async (config: MicrosoftMaiVoiceConfig, options: MicrosoftMaiVoiceGenerateOptions) => {
  if (!config.apiKey.trim()) throw new Error('MISSING_MICROSOFT_MAI_VOICE_API_KEY')
  if (!options.voiceName.trim()) throw new Error('请填写 Microsoft MAI Voice 音色名称')
  if (!options.text.trim()) throw new Error('请填写要合成的文本')

  const protocol = config.transport === 'official' ? 'azure' : config.protocol
  if (protocol === 'azure' && !config.region.trim() && config.transport === 'official') throw new Error('请填写 Azure Speech 区域')
  if (config.transport === 'custom' && !config.baseUrl.trim()) throw new Error('请填写 Microsoft MAI Voice 中转地址')

  const response = await fetch(protocol === 'azure' ? azureEndpoint(config) : openAiEndpoint(config.baseUrl), {
    method: 'POST',
    headers: protocol === 'azure'
      ? {
          'Content-Type': 'application/ssml+xml',
          'X-Microsoft-OutputFormat': 'audio-24khz-160kbitrate-mono-mp3',
          'Ocp-Apim-Subscription-Key': config.apiKey.trim()
        }
      : {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.apiKey.trim()}`
        },
    body: protocol === 'azure'
      ? buildSsml(options)
      : JSON.stringify({
          model: config.model || DEFAULT_MODEL,
          input: options.text.trim(),
          voice: options.voiceName.trim(),
          response_format: 'mp3',
          ...(options.style?.trim() ? { style: options.style.trim(), style_degree: clampStyleDegree(options.styleDegree) } : {})
        }),
    signal: options.signal
  })
  if (!response.ok) throw new Error(await errorMessage(response))
  return parseAudioResponse(response, options.signal)
}
