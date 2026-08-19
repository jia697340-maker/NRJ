/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import type { OfflineModelProfile } from './offlinePresets'
import {
  isClaudeAdaptiveThinkingModel,
  isGeminiPrefillUnsupported,
  isOpenAIReasoningModel,
  type ProviderReasoningState,
  type ReasoningPolicy,
  type ReasoningSource
} from './reasoning'
import type { WebSearchTrace, WebSearchSource } from './webSearch'

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
  reasoning?: ReasoningPolicy
  webSearch?: { enabled: boolean; maxResults?: number }
}

export interface PreparedAdapterRequest {
  profile: Exclude<ModelAdapterProfile, 'auto'>
  protocol: string
  endpoint: string
  headers: Record<string, string>
  body: any
  fallback?: PreparedAdapterRequest
}

export interface ParsedAdapterResponse {
  content: string
  thinking: string
  tokens?: number
  inputTokens?: number
  outputTokens?: number
  stopReason?: string
  reasoningSource?: ReasoningSource
  providerState?: ProviderReasoningState
  webSearch?: WebSearchTrace
}

const trimSlash = (value: string) => value.replace(/\/+$/, '')

const isOpenRouterEndpoint = (settings: AdapterSettings) => {
  if (String(settings.provider || '').toLowerCase() === 'openrouter') return true
  try {
    const hostname = new URL(settings.url).hostname.toLowerCase()
    return hostname === 'openrouter.ai' || hostname.endsWith('.openrouter.ai')
  } catch { return false }
}

const webTrace = (provider: string, queries: unknown[] = [], sources: WebSearchSource[] = []): WebSearchTrace => ({
  mode: 'managed',
  provider,
  status: sources.length ? 'success' : 'empty',
  queries: Array.from(new Set(queries.map(item => String(item || '').trim()).filter(Boolean))),
  sources,
  searchedAt: Date.now()
})

const citationSources = (items: any[]): WebSearchSource[] => {
  const seen = new Set<string>()
  const sources: WebSearchSource[] = []
  for (const item of items || []) {
    const citation = item?.url_citation || item
    const url = String(citation?.url || citation?.uri || '').trim()
    if (!/^https?:\/\//i.test(url) || seen.has(url)) continue
    seen.add(url)
    let fallbackTitle = url
    try { fallbackTitle = new URL(url).hostname } catch {}
    sources.push({ title: String(citation?.title || fallbackTitle), url, snippet: String(citation?.content || citation?.cited_text || '').trim() || undefined })
  }
  return sources
}

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
  if (providerKey === 'glm' || providerKey === 'zhipu' || modelKey.startsWith('glm-')) return 'glm'
  if (modelKey.includes('deepseek-reasoner') || modelKey.includes('deepseek-r1')) return 'deepseek-reasoner'
  if (providerKey === 'deepseek' || modelKey.includes('deepseek')) return 'deepseek-chat'
  if (providerKey === 'openai' && isOpenAIReasoningModel(modelKey)) return 'openai-responses'
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

const restoreProviderTurns = (messages: any[], provider: 'claude' | 'gemini') => {
  const result: any[] = []
  for (let index = 0; index < messages.length; index++) {
    const message = messages[index]
    const state = message?._providerState as ProviderReasoningState | undefined
    if (message?.role === 'assistant' && state?.provider === provider) {
      const restored = provider === 'claude' ? state.blocks : state.parts
      result.push({ ...message, _restoredProviderContent: restored })
      while (messages[index + 1]?.role === 'assistant' && messages[index + 1]?._turnId && messages[index + 1]._turnId === message._turnId) index++
    } else {
      result.push(message)
    }
  }
  return result
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

const prepareOpenAICompatible = (settings: AdapterSettings, messages: any[], profile: 'openai-compatible' | 'deepseek-chat' | 'deepseek-reasoner' | 'glm') => {
  let endpoint = trimSlash(settings.url)
  if (!endpoint.endsWith('/chat/completions')) endpoint += endpoint.includes('/v1') ? '/chat/completions' : '/v1/chat/completions'
  const sanitizedMessages = normalizeMessages(messages).map(message => {
    const normalized: any = { role: message.role, content: message.content }
    if (profile === 'glm' && message._providerState?.provider === 'glm' && message._providerState.reasoningContent) {
      normalized.reasoning_content = message._providerState.reasoningContent
    }
    return normalized
  })
  const body: any = { model: settings.model, messages: sanitizedMessages, stream: Boolean(settings.stream) }
  if (settings.webSearch?.enabled && isOpenRouterEndpoint(settings)) {
    body.tools = [{ type: 'openrouter:web_search', parameters: { max_results: Math.max(1, Math.min(10, Number(settings.webSearch.maxResults) || 5)) } }]
  }
  if (settings.maxTokens !== undefined) body.max_tokens = settings.maxTokens

  if (profile !== 'deepseek-reasoner') {
    if (settings.temperature !== undefined) body.temperature = settings.temperature
    if (settings.topP !== undefined) body.top_p = settings.topP
    if (settings.frequencyPenalty !== undefined) body.frequency_penalty = settings.frequencyPenalty
    if (settings.presencePenalty !== undefined) body.presence_penalty = settings.presencePenalty
  }

  if (profile === 'glm' && settings.reasoning?.enabled) {
    body.thinking = { type: settings.reasoning.mode === 'skip' ? 'disabled' : 'enabled' }
    body.clear_thinking = false
  }

  return {
    profile, protocol: 'openai-chat-completions',
    endpoint,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${settings.key}` },
    body
  }
}

const prepareClaude = (settings: AdapterSettings, messages: any[]): PreparedAdapterRequest => {
  const nativeThinking = Boolean(settings.reasoning?.enabled && settings.reasoning.claudeNativeEnabled)
  const prefillForbidden = nativeThinking || settings.webSearch?.enabled || /claude-.*-5/i.test(settings.model)
  const safeMessages = prefillForbidden && messages[messages.length - 1]?.role === 'assistant' ? messages.slice(0, -1) : messages
  const { system, conversation } = splitSystemPrefix(restoreProviderTurns(safeMessages, 'claude'))
  const normalized = conversation.map(message => ({
    role: message.role === 'assistant' ? 'assistant' : 'user',
    content: message._restoredProviderContent || toAnthropicContent(message.content)
  }))
  const body: any = {
    model: settings.model,
    max_tokens: settings.maxTokens || 4096,
    messages: mergeProviderMessages(normalized, 'content'),
    stream: Boolean(settings.stream)
  }
  if (system) body.system = system
  if (settings.webSearch?.enabled) body.tools = [{ type: 'web_search_20250305', name: 'web_search', max_uses: 5 }]
  if (nativeThinking) {
    if (settings.reasoning!.mode === 'skip') {
      if (!/(?:fable|mythos)/i.test(settings.model)) body.thinking = { type: 'disabled' }
    } else if (isClaudeAdaptiveThinkingModel(settings.model)) {
      body.thinking = { type: 'adaptive', display: 'summarized' }
      body.output_config = { effort: settings.reasoning!.effort }
    } else {
      body.max_tokens = Math.max(body.max_tokens, 4096)
      body.thinking = { type: 'enabled', budget_tokens: Math.max(1024, Math.min(4096, Math.floor(body.max_tokens / 2))), display: 'summarized' }
    }
  } else {
    const restrictedSampling = isClaudeAdaptiveThinkingModel(settings.model) || /(?:fable|mythos)/i.test(settings.model)
    if (!restrictedSampling && settings.temperature !== undefined) body.temperature = settings.temperature
    if (!restrictedSampling && settings.topP !== undefined) body.top_p = settings.topP
  }

  let endpoint = trimSlash(settings.url)
  if (!endpoint.endsWith('/v1/messages')) endpoint += endpoint.endsWith('/v1') ? '/messages' : '/v1/messages'
  return {
    profile: 'claude', protocol: 'anthropic-messages', endpoint,
    headers: { 'Content-Type': 'application/json', 'x-api-key': settings.key, 'anthropic-version': '2023-06-01' },
    body
  }
}

const prepareGeminiGenerateContent = (settings: AdapterSettings, messages: any[]): PreparedAdapterRequest => {
  const normalizedMessages = isGeminiPrefillUnsupported(settings.model) && messages[messages.length - 1]?.role === 'assistant'
    ? messages.slice(0, -1)
    : messages
  const { system, conversation } = splitSystemPrefix(restoreProviderTurns(normalizedMessages, 'gemini'))
  const contents = conversation.map(message => ({
    role: message.role === 'assistant' ? 'model' : 'user',
    parts: message._restoredProviderContent || toGeminiParts(message.content)
  }))
  const body: any = { contents: mergeProviderMessages(contents, 'parts') }
  if (settings.webSearch?.enabled) body.tools = [{ google_search: {} }]
  if (system) body.systemInstruction = { parts: [{ text: system }] }

  const generationConfig: any = {}
  if (settings.maxTokens !== undefined) generationConfig.maxOutputTokens = settings.maxTokens
  // Gemini 3.x 官方建议保留采样默认值；仅在用户显式开启时透传。
  if (!isGeminiPrefillUnsupported(settings.model)) {
    if (settings.temperature !== undefined) generationConfig.temperature = settings.temperature
    if (settings.topP !== undefined) generationConfig.topP = settings.topP
  }
  if (settings.reasoning?.enabled && settings.reasoning.geminiNativeEnabled) {
    const isGemini25 = /gemini-2\.5/i.test(settings.model)
    generationConfig.thinkingConfig = isGemini25
      ? { includeThoughts: settings.reasoning.mode === 'custom', thinkingBudget: settings.reasoning.mode === 'skip' ? 0 : -1 }
      : { includeThoughts: settings.reasoning.mode === 'custom', thinkingLevel: settings.reasoning.mode === 'skip' ? 'low' : settings.reasoning.effort }
  }
  if (Object.keys(generationConfig).length) body.generationConfig = generationConfig

  const action = settings.stream ? 'streamGenerateContent?alt=sse' : 'generateContent'
  const base = trimSlash(settings.url).replace(/\/v1(?:beta)?$/i, '')
  const endpoint = `${base}/v1beta/models/${encodeURIComponent(settings.model)}:${action}`
  return {
    profile: 'gemini', protocol: 'gemini-generate-content', endpoint,
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': settings.key },
    body
  }
}

const isOfficialGeminiUrl = (value: string) => {
  try {
    return new URL(value).hostname.toLowerCase() === 'generativelanguage.googleapis.com'
  } catch {
    return false
  }
}

const supportsGeminiInteractions = (model: string) => {
  const match = /gemini-3\.(\d+)/i.exec(model)
  return Boolean(match && Number(match[1]) >= 6)
}

const toInteractionContent = (content: string | any[]) => {
  if (typeof content === 'string') return [{ type: 'text', text: content }]
  return content.map(part => {
    if (part?.type === 'text') return { type: 'text', text: part.text || '' }
    const url = part?.image_url?.url
    const data = typeof url === 'string' ? parseDataUri(url) : null
    if (data) return { type: 'image', data: data.data, mime_type: data.mediaType }
    if (url) return { type: 'image', uri: url }
    return null
  }).filter(Boolean)
}

const prepareGeminiInteractions = (settings: AdapterSettings, messages: any[], fallback: PreparedAdapterRequest): PreparedAdapterRequest => {
  const safeMessages = messages[messages.length - 1]?.role === 'assistant' ? messages.slice(0, -1) : messages
  const { system, conversation } = splitSystemPrefix(safeMessages)
  let latestStateIndex = -1
  for (let index = conversation.length - 1; index >= 0; index--) {
    if (conversation[index]?._providerState?.provider === 'gemini' && conversation[index]._providerState.responseId) {
      latestStateIndex = index
      break
    }
  }
  const stateMessage = latestStateIndex >= 0 ? conversation[latestStateIndex] : undefined
  const state = stateMessage?._providerState as ProviderReasoningState | undefined
  let continuationIndex = latestStateIndex + 1
  while (stateMessage?._turnId && conversation[continuationIndex]?.role === 'assistant' && conversation[continuationIndex]?._turnId === stateMessage._turnId) continuationIndex++
  const interactionMessages = state?.responseId ? conversation.slice(continuationIndex) : conversation
  const input = interactionMessages.map(message => ({
    type: message.role === 'assistant' ? 'model_output' : 'user_input',
    content: toInteractionContent(message.content)
  }))
  const generationConfig: any = {
    thinking_level: settings.reasoning?.mode === 'skip' ? 'low' : (settings.reasoning?.effort || 'medium'),
    thinking_summaries: settings.reasoning?.mode === 'custom' ? 'auto' : 'none'
  }
  if (settings.maxTokens !== undefined) generationConfig.max_output_tokens = settings.maxTokens
  const body: any = {
    model: settings.model,
    input,
    stream: Boolean(settings.stream),
    store: true,
    generation_config: generationConfig
  }
  if (settings.webSearch?.enabled) body.tools = [{ type: 'google_search' }]
  if (system) body.system_instruction = system
  if (state?.responseId) body.previous_interaction_id = state.responseId
  const base = trimSlash(settings.url).replace(/\/v1(?:beta)?$/i, '')
  return {
    profile: 'gemini',
    protocol: 'gemini-interactions',
    endpoint: `${base}/v1beta/interactions`,
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': settings.key },
    body,
    fallback
  }
}

const prepareGemini = (settings: AdapterSettings, messages: any[]): PreparedAdapterRequest => {
  const fallback = prepareGeminiGenerateContent(settings, messages)
  const nativeEnabled = Boolean(settings.reasoning?.enabled && settings.reasoning.geminiNativeEnabled)
  if (!nativeEnabled || !supportsGeminiInteractions(settings.model) || !isOfficialGeminiUrl(settings.url)) return fallback
  return prepareGeminiInteractions(settings, messages, fallback)
}

const prepareOpenAIResponses = (settings: AdapterSettings, messages: any[]): PreparedAdapterRequest => {
  let endpoint = trimSlash(settings.url)
  if (!endpoint.endsWith('/responses')) endpoint += endpoint.endsWith('/v1') ? '/responses' : '/v1/responses'
  let latestStateIndex = -1
  for (let index = messages.length - 1; index >= 0; index--) {
    if (messages[index]?._providerState?.provider === 'openai') {
      latestStateIndex = index
      break
    }
  }
  const stateMessage = latestStateIndex >= 0 ? messages[latestStateIndex] : undefined
  const state = stateMessage?._providerState as ProviderReasoningState | undefined
  let continuationIndex = latestStateIndex + 1
  while (stateMessage?._turnId && messages[continuationIndex]?.role === 'assistant' && messages[continuationIndex]?._turnId === stateMessage._turnId) continuationIndex++
  const inputMessages = state?.responseId ? messages.slice(continuationIndex) : messages
  const input = normalizeMessages(inputMessages).map(message => ({
    role: message.role,
    content: contentToText(message.content)
  }))
  const body: any = { model: settings.model, input, stream: Boolean(settings.stream) }
  if (settings.webSearch?.enabled) body.tools = [{ type: 'web_search' }]
  if (state?.responseId) body.previous_response_id = state.responseId
  if (settings.maxTokens !== undefined) body.max_output_tokens = settings.maxTokens
  if (settings.reasoning?.enabled) {
    body.reasoning = settings.reasoning.mode === 'skip'
      ? { effort: /^gpt-5/i.test(settings.model) ? 'none' : 'low' }
      : { effort: settings.reasoning.effort, summary: 'auto' }
  }
  return {
    profile: 'openai-responses', protocol: 'openai-responses', endpoint,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${settings.key}` },
    body
  }
}

export const prepareAdapterRequest = (settings: AdapterSettings, messages: any[]): PreparedAdapterRequest => {
  const profile = resolveModelAdapterProfile(settings.provider, settings.model, settings.profile || 'auto')
  if (profile === 'claude') return prepareClaude(settings, messages)
  if (profile === 'gemini') return prepareGemini(settings, messages)
  if (profile === 'openai-responses') return prepareOpenAIResponses(settings, messages)
  return prepareOpenAICompatible(settings, messages, profile)
}

const parseGeminiInteractionResponse = (data: any): ParsedAdapterResponse => {
  const steps = Array.isArray(data.steps) ? data.steps : []
  const searchCalls = steps.filter((item: any) => item.type === 'google_search_call')
  const searchQueries = searchCalls.flatMap((item: any) => item.arguments?.queries || (item.arguments?.query ? [item.arguments.query] : []))
  const annotations = steps.filter((item: any) => item.type === 'model_output')
    .flatMap((item: any) => item.content || []).flatMap((item: any) => item.annotations || [])
  const searchSources = citationSources(annotations)
  const thinking = steps.filter((item: any) => item.type === 'thought')
    .flatMap((item: any) => item.summary || [])
    .filter((item: any) => item.type === 'text')
    .map((item: any) => item.text || '').join('\n')
  const content = steps.filter((item: any) => item.type === 'model_output')
    .flatMap((item: any) => item.content || [])
    .filter((item: any) => item.type === 'text')
    .map((item: any) => item.text || '').join('')
  return {
    content: content || data.output_text || '',
    thinking,
    tokens: data.usage?.total_tokens,
    inputTokens: data.usage?.total_input_tokens,
    outputTokens: data.usage?.total_output_tokens,
    stopReason: data.status,
    reasoningSource: thinking ? 'native' : 'none',
    providerState: data.id ? { provider: 'gemini', responseId: data.id } : undefined,
    webSearch: searchCalls.length || searchSources.length ? webTrace('Google Search', searchQueries, searchSources) : undefined
  }
}

export const parseAdapterResponse = (profile: PreparedAdapterRequest['profile'], data: any, protocol = ''): ParsedAdapterResponse => {
  if (profile === 'claude') {
    const blocks = Array.isArray(data.content) ? data.content : []
    const thinking = blocks.filter((item: any) => item.type === 'thinking').map((item: any) => item.thinking || '').join('\n')
    const searchUseBlocks = blocks.filter((item: any) => item.type === 'server_tool_use' && item.name === 'web_search')
    const searchResultBlocks = blocks.filter((item: any) => item.type === 'web_search_tool_result')
    const searchSources = citationSources([
      ...blocks.filter((item: any) => item.type === 'text').flatMap((item: any) => item.citations || []),
      ...searchResultBlocks.flatMap((item: any) => Array.isArray(item.content) ? item.content : [])
    ])
    return {
      content: blocks.filter((item: any) => item.type === 'text').map((item: any) => item.text || '').join(''),
      thinking,
      tokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0) || undefined,
      inputTokens: data.usage?.input_tokens,
      outputTokens: data.usage?.output_tokens,
      stopReason: data.stop_reason,
      reasoningSource: thinking ? 'native' : 'none',
      providerState: blocks.some((item: any) => item.type === 'thinking' && item.signature)
        ? { provider: 'claude', blocks: blocks.map((item: any) => ({ ...item })) }
        : undefined,
      webSearch: searchUseBlocks.length || searchSources.length
        ? webTrace('Claude Web Search', searchUseBlocks.map((item: any) => item.input?.query), searchSources)
        : undefined
    }
  }
  if (profile === 'gemini') {
    if (protocol === 'gemini-interactions' || Array.isArray(data.steps)) return parseGeminiInteractionResponse(data)
    const parts = data.candidates?.[0]?.content?.parts || []
    const thinking = parts.filter((item: any) => item.thought).map((item: any) => item.text || '').join('\n')
    const grounding = data.candidates?.[0]?.groundingMetadata || {}
    const searchSources = citationSources((grounding.groundingChunks || []).map((item: any) => item.web || item))
    return {
      content: parts.filter((item: any) => !item.thought).map((item: any) => item.text || '').join(''),
      thinking,
      tokens: data.usageMetadata?.totalTokenCount,
      inputTokens: data.usageMetadata?.promptTokenCount,
      outputTokens: data.usageMetadata?.candidatesTokenCount,
      stopReason: data.candidates?.[0]?.finishReason,
      reasoningSource: thinking ? 'native' : 'none',
      providerState: parts.some((item: any) => item.thoughtSignature)
        ? { provider: 'gemini', parts: parts.map((item: any) => ({ ...item })) }
        : undefined,
      webSearch: (grounding.webSearchQueries?.length || searchSources.length)
        ? webTrace('Google Search', grounding.webSearchQueries || [], searchSources)
        : undefined
    }
  }
  if (profile === 'openai-responses') {
    const output = Array.isArray(data.output) ? data.output : []
    const reasoningItems = output.filter((item: any) => item.type === 'reasoning')
    const thinking = reasoningItems.flatMap((item: any) => item.summary || []).map((item: any) => item.text || '').join('\n')
    const content = output.filter((item: any) => item.type === 'message')
      .flatMap((item: any) => item.content || [])
      .filter((item: any) => item.type === 'output_text')
      .map((item: any) => item.text || '').join('')
    const searchCalls = output.filter((item: any) => item.type === 'web_search_call')
    const searchSources = citationSources(output.filter((item: any) => item.type === 'message')
      .flatMap((item: any) => item.content || []).flatMap((item: any) => item.annotations || []))
    return {
      content,
      thinking,
      tokens: data.usage?.total_tokens,
      inputTokens: data.usage?.input_tokens,
      outputTokens: data.usage?.output_tokens,
      stopReason: data.status === 'incomplete' ? (data.incomplete_details?.reason || 'incomplete') : data.status,
      reasoningSource: thinking ? 'native' : 'none',
      providerState: data.id ? { provider: 'openai', responseId: data.id } : undefined,
      webSearch: searchCalls.length || searchSources.length
        ? webTrace('OpenAI Web Search', searchCalls.flatMap((item: any) => item.action?.queries || (item.action?.query ? [item.action.query] : [])), searchSources)
        : undefined
    }
  }
  const message = data.choices?.[0]?.message || {}
  const thinking = message.reasoning_content || ''
  const annotations = Array.isArray(message.annotations) ? message.annotations : []
  const openRouterSearch = citationSources(annotations)
  const toolQueries = (message.tool_calls || []).filter((item: any) => String(item?.function?.name || item?.type || '').includes('web_search'))
    .flatMap((item: any) => {
      try {
        const parsed = JSON.parse(item?.function?.arguments || '{}')
        return parsed.queries || (parsed.query ? [parsed.query] : [])
      } catch { return [] }
    })
  return {
    content: message.content || '',
    thinking,
    tokens: data.usage?.total_tokens,
    inputTokens: data.usage?.prompt_tokens,
    outputTokens: data.usage?.completion_tokens,
    stopReason: data.choices?.[0]?.finish_reason,
    reasoningSource: thinking ? 'native' : 'none',
    providerState: profile === 'glm' && thinking ? { provider: 'glm', reasoningContent: thinking } : undefined,
    webSearch: openRouterSearch.length || toolQueries.length ? webTrace('OpenRouter Web Search', toolQueries, openRouterSearch) : undefined
  }
}

export const consumeAdapterStreamEvent = (
  profile: PreparedAdapterRequest['profile'],
  data: any,
  protocol = ''
): { content?: string; thinking?: string; stopReason?: string; inputTokens?: number; outputTokens?: number; tokens?: number; reasoningSource?: ReasoningSource; providerState?: ProviderReasoningState; webSearch?: WebSearchTrace } => {
  if (profile === 'claude') {
    const delta = data.delta || {}
    if (data.type === 'content_block_start') {
      const block = data.content_block || {}
      if (block.type === 'server_tool_use' && block.name === 'web_search') return { webSearch: webTrace('Claude Web Search', block.input?.query ? [block.input.query] : [], []) }
      if (block.type === 'web_search_tool_result') return { webSearch: webTrace('Claude Web Search', [], citationSources(Array.isArray(block.content) ? block.content : [])) }
    }
    if (data.usage) return {
      inputTokens: data.usage.input_tokens,
      outputTokens: data.usage.output_tokens,
      tokens: (data.usage.input_tokens || 0) + (data.usage.output_tokens || 0),
      stopReason: delta.stop_reason
    }
    if (delta.type === 'text_delta') return { content: delta.text || '' }
    if (delta.type === 'thinking_delta') return { thinking: delta.thinking || '', reasoningSource: 'native' }
    if (delta.type === 'signature_delta') return { providerState: { provider: 'claude', blocks: [{ type: 'thinking', thinking: '', signature: delta.signature || '' }] } }
    if (delta.stop_reason) return { stopReason: delta.stop_reason }
    return {}
  }
  if (profile === 'gemini') {
    if (protocol === 'gemini-interactions' || data.event_type) {
      if (data.event_type === 'interaction.created' && data.interaction?.id) {
        return { providerState: { provider: 'gemini', responseId: data.interaction.id } }
      }
      if (data.event_type === 'step.start') {
        const step = data.step || {}
        if (step.type === 'thought') {
          const thinking = (step.summary || []).filter((item: any) => item.type === 'text').map((item: any) => item.text || '').join('')
          return thinking ? { thinking, reasoningSource: 'native' } : {}
        }
        if (step.type === 'model_output') {
          const textItems = (step.content || []).filter((item: any) => item.type === 'text')
          return { content: textItems.map((item: any) => item.text || '').join(''), webSearch: textItems.some((item: any) => item.annotations?.length) ? webTrace('Google Search', [], citationSources(textItems.flatMap((item: any) => item.annotations || []))) : undefined }
        }
        if (step.type === 'google_search_call') return { webSearch: webTrace('Google Search', step.arguments?.queries || (step.arguments?.query ? [step.arguments.query] : []), []) }
      }
      if (data.event_type === 'step.delta') {
        const delta = data.delta || {}
        if (delta.type === 'thought_summary') return { thinking: delta.content?.text || delta.text || '', reasoningSource: 'native' }
        if (delta.type === 'text') return { content: delta.text || delta.content?.text || '' }
      }
      if (data.event_type === 'interaction.completed' && data.interaction) {
        const usage = data.interaction.usage || {}
        return {
          stopReason: data.interaction.status,
          inputTokens: usage.total_input_tokens,
          outputTokens: usage.total_output_tokens,
          tokens: usage.total_tokens,
          providerState: data.interaction.id ? { provider: 'gemini', responseId: data.interaction.id } : undefined,
          webSearch: parseGeminiInteractionResponse(data.interaction).webSearch
        }
      }
      return {}
    }
    const parts = data.candidates?.[0]?.content?.parts || []
    const thinking = parts.filter((item: any) => item.thought).map((item: any) => item.text || '').join('')
    return {
      content: parts.filter((item: any) => !item.thought).map((item: any) => item.text || '').join(''),
      thinking,
      stopReason: data.candidates?.[0]?.finishReason,
      inputTokens: data.usageMetadata?.promptTokenCount,
      outputTokens: data.usageMetadata?.candidatesTokenCount,
      tokens: data.usageMetadata?.totalTokenCount,
      reasoningSource: thinking ? 'native' : undefined,
      providerState: parts.some((item: any) => item.thoughtSignature)
        ? { provider: 'gemini', parts: parts.filter((item: any) => item.thoughtSignature).map((item: any) => ({ ...item })) }
        : undefined
    }
  }
  if (profile === 'openai-responses') {
    if (data.type === 'response.output_text.delta') return { content: data.delta || '' }
    if (data.type === 'response.reasoning_summary_text.delta') return { thinking: data.delta || '', reasoningSource: 'native' }
    if ((data.type === 'response.completed' || data.type === 'response.incomplete') && data.response) {
      const parsed = parseAdapterResponse(profile, data.response)
      return {
        stopReason: parsed.stopReason,
        inputTokens: parsed.inputTokens,
        outputTokens: parsed.outputTokens,
        tokens: parsed.tokens,
        providerState: parsed.providerState,
        webSearch: parsed.webSearch
      }
    }
    return {}
  }
  const delta = data.choices?.[0]?.delta || {}
  if (data.usage) return { inputTokens: data.usage.prompt_tokens, outputTokens: data.usage.completion_tokens, tokens: data.usage.total_tokens }
  const streamedSources = citationSources(delta.annotations || data.choices?.[0]?.message?.annotations || [])
  return {
    content: delta.content || '',
    thinking: delta.reasoning_content || '',
    stopReason: data.choices?.[0]?.finish_reason,
    reasoningSource: delta.reasoning_content ? 'native' : undefined,
    providerState: profile === 'glm' && delta.reasoning_content ? { provider: 'glm', reasoningContent: delta.reasoning_content } : undefined,
    webSearch: streamedSources.length ? webTrace('OpenRouter Web Search', [], streamedSources) : undefined
  }
}
