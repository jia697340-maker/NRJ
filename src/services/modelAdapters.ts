/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import type { OfflineModelProfile } from './offlinePresets'

export type ModelAdapterProfile = OfflineModelProfile

export interface AdapterSettings {
  provider: string
  url: string
  key: string
  model: string
  profile?: ModelAdapterProfile
  stream?: boolean
  maxTokens?: number
  temperature?: number
  topP?: number
  frequencyPenalty?: number
  presencePenalty?: number
}

export interface PreparedAdapterRequest {
  profile: Exclude<ModelAdapterProfile, 'auto'>
  endpoint: string
  headers: Record<string, string>
  body: any
}

export interface ParsedAdapterResponse {
  content: string
  thinking: string
  tokens?: number
}

const trimSlash = (value: string) => value.replace(/\/+$/, '')

export const resolveModelAdapterProfile = (
  provider: string,
  model: string,
  override: ModelAdapterProfile = 'auto'
): Exclude<ModelAdapterProfile, 'auto'> => {
  if (override !== 'auto') return override
  const providerKey = provider.toLowerCase()
  const modelKey = model.toLowerCase()

  if (providerKey === 'claude' || providerKey === 'anthropic' || modelKey.startsWith('claude')) return 'claude'
  if (providerKey === 'gemini' || providerKey === 'google' || modelKey.startsWith('gemini')) return 'gemini'
  if (modelKey.includes('deepseek-reasoner') || modelKey.includes('deepseek-r1')) return 'deepseek-reasoner'
  if (providerKey === 'deepseek' || modelKey.includes('deepseek')) return 'deepseek-chat'
  return 'openai-compatible'
}

const contentToText = (content: string | any[]) => {
  if (typeof content === 'string') return content
  return content.map(part => part?.text || part?.type === 'text' && part.text || '').filter(Boolean).join('\n')
}

const normalizeMessages = (messages: any[]) => {
  const result: any[] = []
  for (const message of messages) {
    if (!message?.role || message.content === undefined) continue
    const previous = result[result.length - 1]
    if (previous && previous.role === message.role && typeof previous.content === 'string' && typeof message.content === 'string') {
      previous.content += `\n\n${message.content}`
    } else {
      result.push(JSON.parse(JSON.stringify(message)))
    }
  }
  return result
}

const mergeProviderMessages = (messages: any[], field: 'content' | 'parts') => {
  const result: any[] = []
  for (const message of messages) {
    const previous = result[result.length - 1]
    if (previous?.role === message.role) {
      const previousParts = Array.isArray(previous[field]) ? previous[field] : [{ type: 'text', text: String(previous[field] || '') }]
      const nextParts = Array.isArray(message[field]) ? message[field] : [{ type: 'text', text: String(message[field] || '') }]
      previous[field] = [...previousParts, ...nextParts]
    } else {
      result.push(JSON.parse(JSON.stringify(message)))
    }
  }
  return result
}

const splitSystemPrefix = (messages: any[]) => {
  const systemParts: string[] = []
  const conversation: any[] = []
  let conversationStarted = false

  for (const message of messages) {
    if (message.role === 'system' && !conversationStarted) {
      systemParts.push(contentToText(message.content))
      continue
    }
    conversationStarted = true
    if (message.role === 'system') {
      conversation.push({ role: 'user', content: `<system_instruction>\n${contentToText(message.content)}\n</system_instruction>` })
    } else {
      conversation.push(message)
    }
  }

  return { system: systemParts.join('\n\n'), conversation: normalizeMessages(conversation) }
}

const parseDataUri = (url: string) => {
  const match = /^data:([^;,]+);base64,(.+)$/i.exec(url)
  return match ? { mediaType: match[1], data: match[2] } : null
}

const toAnthropicContent = (content: string | any[]) => {
  if (typeof content === 'string') return content
  return content.map(part => {
    if (part.type === 'text') return { type: 'text', text: part.text || '' }
    const url = part.image_url?.url
    const data = typeof url === 'string' ? parseDataUri(url) : null
    if (data) return { type: 'image', source: { type: 'base64', media_type: data.mediaType, data: data.data } }
    if (url) return { type: 'image', source: { type: 'url', url } }
    return null
  }).filter(Boolean)
}

const toGeminiParts = (content: string | any[]) => {
  if (typeof content === 'string') return [{ text: content }]
  return content.map(part => {
    if (part.type === 'text') return { text: part.text || '' }
    const url = part.image_url?.url
    const data = typeof url === 'string' ? parseDataUri(url) : null
    if (data) return { inlineData: { mimeType: data.mediaType, data: data.data } }
    if (url) return { text: `[图片链接：${url}]` }
    return null
  }).filter(Boolean)
}

const prepareOpenAICompatible = (settings: AdapterSettings, messages: any[], profile: 'openai-compatible' | 'deepseek-chat' | 'deepseek-reasoner') => {
  let endpoint = trimSlash(settings.url)
  if (!endpoint.endsWith('/chat/completions')) endpoint += endpoint.includes('/v1') ? '/chat/completions' : '/v1/chat/completions'
  const body: any = { model: settings.model, messages, stream: Boolean(settings.stream) }
  if (settings.maxTokens !== undefined) body.max_tokens = settings.maxTokens

  if (profile !== 'deepseek-reasoner') {
    if (settings.temperature !== undefined) body.temperature = settings.temperature
    if (settings.topP !== undefined) body.top_p = settings.topP
    if (settings.frequencyPenalty !== undefined) body.frequency_penalty = settings.frequencyPenalty
    if (settings.presencePenalty !== undefined) body.presence_penalty = settings.presencePenalty
  }

  return {
    profile,
    endpoint,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${settings.key}` },
    body
  }
}

const prepareClaude = (settings: AdapterSettings, messages: any[]): PreparedAdapterRequest => {
  const { system, conversation } = splitSystemPrefix(messages)
  const normalized = conversation.map(message => ({
    role: message.role === 'assistant' ? 'assistant' : 'user',
    content: toAnthropicContent(message.content)
  }))
  const body: any = {
    model: settings.model,
    max_tokens: settings.maxTokens || 4096,
    messages: mergeProviderMessages(normalized, 'content'),
    stream: Boolean(settings.stream)
  }
  if (system) body.system = system
  if (settings.temperature !== undefined) body.temperature = settings.temperature
  if (settings.topP !== undefined) body.top_p = settings.topP

  let endpoint = trimSlash(settings.url)
  if (!endpoint.endsWith('/v1/messages')) endpoint += endpoint.endsWith('/v1') ? '/messages' : '/v1/messages'
  return {
    profile: 'claude', endpoint,
    headers: { 'Content-Type': 'application/json', 'x-api-key': settings.key, 'anthropic-version': '2023-06-01' },
    body
  }
}

const prepareGemini = (settings: AdapterSettings, messages: any[]): PreparedAdapterRequest => {
  const { system, conversation } = splitSystemPrefix(messages)
  const contents = conversation.map(message => ({
    role: message.role === 'assistant' ? 'model' : 'user',
    parts: toGeminiParts(message.content)
  }))
  const body: any = { contents: mergeProviderMessages(contents, 'parts') }
  if (system) body.systemInstruction = { parts: [{ text: system }] }

  const generationConfig: any = {}
  if (settings.maxTokens !== undefined) generationConfig.maxOutputTokens = settings.maxTokens
  // Gemini 3.x 官方建议保留采样默认值；仅在用户显式开启时透传。
  if (settings.temperature !== undefined) generationConfig.temperature = settings.temperature
  if (settings.topP !== undefined) generationConfig.topP = settings.topP
  if (Object.keys(generationConfig).length) body.generationConfig = generationConfig

  const action = settings.stream ? 'streamGenerateContent?alt=sse' : 'generateContent'
  const base = trimSlash(settings.url).replace(/\/v1(?:beta)?$/i, '')
  const endpoint = `${base}/v1beta/models/${encodeURIComponent(settings.model)}:${action}`
  return {
    profile: 'gemini', endpoint,
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': settings.key },
    body
  }
}

export const prepareAdapterRequest = (settings: AdapterSettings, messages: any[]): PreparedAdapterRequest => {
  const profile = resolveModelAdapterProfile(settings.provider, settings.model, settings.profile || 'auto')
  if (profile === 'claude') return prepareClaude(settings, messages)
  if (profile === 'gemini') return prepareGemini(settings, messages)
  return prepareOpenAICompatible(settings, messages, profile)
}

export const parseAdapterResponse = (profile: PreparedAdapterRequest['profile'], data: any): ParsedAdapterResponse => {
  if (profile === 'claude') {
    const blocks = Array.isArray(data.content) ? data.content : []
    return {
      content: blocks.filter((item: any) => item.type === 'text').map((item: any) => item.text || '').join(''),
      thinking: blocks.filter((item: any) => item.type === 'thinking').map((item: any) => item.thinking || '').join('\n'),
      tokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0) || undefined
    }
  }
  if (profile === 'gemini') {
    const parts = data.candidates?.[0]?.content?.parts || []
    return {
      content: parts.filter((item: any) => !item.thought).map((item: any) => item.text || '').join(''),
      thinking: parts.filter((item: any) => item.thought).map((item: any) => item.text || '').join('\n'),
      tokens: data.usageMetadata?.totalTokenCount
    }
  }
  const message = data.choices?.[0]?.message || {}
  return {
    content: message.content || '',
    thinking: message.reasoning_content || '',
    tokens: data.usage?.total_tokens
  }
}

export const consumeAdapterStreamEvent = (
  profile: PreparedAdapterRequest['profile'],
  data: any
): { content?: string; thinking?: string } => {
  if (profile === 'claude') {
    const delta = data.delta || {}
    if (delta.type === 'text_delta') return { content: delta.text || '' }
    if (delta.type === 'thinking_delta') return { thinking: delta.thinking || '' }
    return {}
  }
  if (profile === 'gemini') {
    const parts = data.candidates?.[0]?.content?.parts || []
    return {
      content: parts.filter((item: any) => !item.thought).map((item: any) => item.text || '').join(''),
      thinking: parts.filter((item: any) => item.thought).map((item: any) => item.text || '').join('')
    }
  }
  const delta = data.choices?.[0]?.delta || {}
  return { content: delta.content || '', thinking: delta.reasoning_content || '' }
}
