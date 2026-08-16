/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { apiSettings, summaryApiSettings, visionApiSettings, momentApiSettings, characterApiSettings, cotSettings, globalPromptSettings, appStats, type ApiPreset } from '../store'
import { apiLogger } from './apiLogger'
import { consumeAdapterStreamEvent, parseAdapterResponse, prepareAdapterRequest, resolveModelAdapterProfile } from './modelAdapters'
import type { ModelAdapterProfile } from './modelAdapters'
import { extractEmbeddedReasoning, isGeminiPrefillUnsupported, mergeProviderReasoningState, type ProviderReasoningState, type ReasoningPolicy, type ReasoningSource } from './reasoning'
import { saveTokenUsageSnapshot } from './tokenUsageSnapshot'
import { commitDiagnosticTrace, createDiagnosticDraft, type DiagnosticContextMeta } from './diagnosticTrace'
import { isRawApiConsoleLoggingEnabled, logApiFallback, logApiRequest, logApiResponse } from './apiDebug'

export type ChatApiPurpose = 'default' | 'moment-followup' | 'character-generation' | 'character-review-global' | 'prompt-generation'

export const decorateChatPayload = (
  messages: { role: string; content: string | any[] }[],
  isSummary = false,
  purpose: ChatApiPurpose = 'default',
  options: { profile?: Exclude<ModelAdapterProfile, 'auto'>; model?: string; applyCot?: boolean } = {}
) => {
  const payloadMessages = JSON.parse(JSON.stringify(messages))
  if (isSummary || purpose.startsWith('character-') || purpose === 'prompt-generation' || options.applyCot === false || !cotSettings.enabled) return payloadMessages
  const profile = options.profile
  const nativeMode = profile === 'openai-responses' || profile === 'deepseek-reasoner' || profile === 'glm' ||
    (profile === 'gemini' && cotSettings.geminiNativeEnabled) ||
    (profile === 'claude' && cotSettings.claudeNativeEnabled)
  const mergeSystem = (content: string) => {
    if (!content) return
    const system = payloadMessages.find((item: any) => item.role === 'system')
    if (!system) {
      payloadMessages.unshift({ role: 'system', content })
    } else if (Array.isArray(system.content)) {
      system.content.push({ type: 'text', text: content })
    } else {
      system.content = `${system.content || ''}\n\n${content}`.trim()
    }
  }
  if (cotSettings.mode === 'skip') {
    if (!nativeMode) mergeSystem(globalPromptSettings.language === 'en'
      ? 'Reply directly. Do not output analysis, hidden reasoning, or <thinking> tags.'
      : '请直接回复正文，不要输出分析过程、隐藏推理或 <thinking> 标签。')
    return payloadMessages
  }
  if (cotSettings.mode !== 'custom' || !cotSettings.items) return payloadMessages
  const englishCotContent: Record<string, string> = {
    cot_default_1: '[Required reasoning and response format]\nBefore each response, reason and output strictly with this nested structure:\n[incipere]\n<thinking>\n',
    cot_default_3: '</thinking>\n[finire]\n<msg>\nYour final visible reply\n</msg>',
    cot_default_4: '[incipere]\n<thinking>\n'
  }
  let enabledItems = cotSettings.items.filter(item => item.enabled).map(item => (
    globalPromptSettings.language === 'en' && englishCotContent[item.id] ? { ...item, content: englishCotContent[item.id] } : item
  ))
  if (nativeMode) enabledItems = enabledItems.filter(item => !item.id.startsWith('cot_default_'))
  const ordered = ['system_top', 'system_middle', 'system_bottom', 'assistant_prefill']
    .flatMap(position => enabledItems.filter(item => item.position === position))
  const deferred: any[] = []
  let prefill: any | undefined
  for (const item of ordered) {
    if (!item.content) continue
    if (item.role === 'system') mergeSystem(item.content)
    else if (item.position === 'assistant_prefill') {
      const forbidden = profile === 'claude' && cotSettings.claudeNativeEnabled ||
        profile === 'gemini' && isGeminiPrefillUnsupported(options.model || '')
      if (!forbidden) prefill = { role: item.role, content: item.content }
    } else {
      deferred.push({ role: item.role, content: item.content })
    }
  }
  if (deferred.length) {
    const lastUserIndex = payloadMessages.map((item: any) => item.role).lastIndexOf('user')
    const insertAt = lastUserIndex >= 0 ? lastUserIndex : payloadMessages.length
    payloadMessages.splice(insertAt, 0, ...deferred)
  }
  if (prefill) payloadMessages.push(prefill)
  return payloadMessages
}

export const isMomentApiReady = () => {
  if (!momentApiSettings.enabled) return false
  const url = momentApiSettings.provider === 'custom' ? momentApiSettings.customUrl : momentApiSettings.url
  const key = momentApiSettings.provider === 'custom' ? momentApiSettings.customKey : momentApiSettings.key
  return Boolean(url && key && momentApiSettings.model)
}

export const isCharacterApiReady = () => {
  if (!characterApiSettings.enabled) return false
  const url = characterApiSettings.provider === 'custom' ? characterApiSettings.customUrl : characterApiSettings.url
  const key = characterApiSettings.provider === 'custom' ? characterApiSettings.customKey : characterApiSettings.key
  return Boolean(url && key && characterApiSettings.model)
}

export async function sendChatMessage(
  messages: { role: string; content: string | any[] }[], 
  signal?: AbortSignal,
  isSummary: boolean = false,
  isVision: boolean = false,
  purpose: ChatApiPurpose = 'default',
  adapterOverride: ModelAdapterProfile = 'auto',
  diagnosticContext?: DiagnosticContextMeta,
  payloadReady: boolean = false
) {
  // 定义一个包含所有可能属性的接口，包括各个设置独有的属性
  interface MergedApiSettings {
    enabled?: boolean
    provider: string
    url: string
    key: string
    model: string
    availableModels: string[]
    adapterProfile?: ModelAdapterProfile
    apiClassicTheme?: string // 只有 global 有
    customUrl: string
    customKey: string
    enableTemperature: boolean
    temperature: number
    enableMaxTokens: boolean
    maxTokens: number
    enableTopP: boolean
    topP: number
    enableFrequencyPenalty: boolean
    frequencyPenalty: number
    enablePresencePenalty: boolean
    presencePenalty: number
    enableStream: boolean
    presets: ApiPreset[]
    currentPresetId: string
  }

  let activeSettings: MergedApiSettings = apiSettings as MergedApiSettings
  if (isSummary && summaryApiSettings.enabled) {
    activeSettings = summaryApiSettings
  } else if (isVision && visionApiSettings.enabled) {
    activeSettings = visionApiSettings
  } else if (purpose === 'moment-followup' && isMomentApiReady()) {
    activeSettings = momentApiSettings
  } else if (purpose === 'character-generation' && isCharacterApiReady()) {
    activeSettings = characterApiSettings
  }

  const url = activeSettings.provider === 'custom' ? activeSettings.customUrl : activeSettings.url
  let key = activeSettings.provider === 'custom' ? activeSettings.customKey : activeSettings.key
  const model = activeSettings.model

  if (!url || !key || !model) {
    throw new Error('API 设置不完整，请先在设置中配置 API。')
  }

  const effectiveAdapter = adapterOverride !== 'auto' ? adapterOverride : (activeSettings.adapterProfile || 'auto')
  const resolvedProfile = resolveModelAdapterProfile(activeSettings.provider, model, effectiveAdapter)
  const reasoningPolicy: ReasoningPolicy = {
    enabled: cotSettings.enabled && purpose === 'default' && Boolean(diagnosticContext?.chatId),
    mode: cotSettings.mode === 'custom' ? 'custom' : 'skip',
    showThinking: cotSettings.showThinking,
    effort: ['low', 'medium', 'high'].includes(cotSettings.reasoningEffort) ? cotSettings.reasoningEffort : 'medium',
    geminiNativeEnabled: cotSettings.geminiNativeEnabled,
    claudeNativeEnabled: cotSettings.claudeNativeEnabled
  }
  // payloadReady 表示调用方已完成相同装饰，避免二次注入。
  const payloadMessages = payloadReady ? JSON.parse(JSON.stringify(messages)) : decorateChatPayload(messages, isSummary, purpose, {
    profile: resolvedProfile,
    model,
    applyCot: reasoningPolicy.enabled
  })

  const preparedRequest = prepareAdapterRequest({
    provider: activeSettings.provider,
    url,
    key,
    model,
    profile: effectiveAdapter,
    stream: activeSettings.enableStream,
    maxTokens: activeSettings.enableMaxTokens ? activeSettings.maxTokens : undefined,
    temperature: activeSettings.enableTemperature ? activeSettings.temperature : undefined,
    topP: activeSettings.enableTopP ? activeSettings.topP : undefined,
    frequencyPenalty: activeSettings.enableFrequencyPenalty ? activeSettings.frequencyPenalty : undefined,
    presencePenalty: activeSettings.enablePresencePenalty ? activeSettings.presencePenalty : undefined,
    reasoning: reasoningPolicy
  }, payloadMessages)

  let diagnosticType = 'Chat'
  if (isSummary) diagnosticType = 'Summary'
  if (isVision) diagnosticType = 'Vision'
  if (purpose === 'moment-followup') diagnosticType = 'Moment'
  if (purpose === 'character-generation') diagnosticType = 'CharacterGeneration'
  if (purpose === 'character-review-global') diagnosticType = 'CharacterReview'
  if (purpose === 'prompt-generation') diagnosticType = 'PromptGeneration'

  const diagnosticDraft = createDiagnosticDraft({
    messages: payloadMessages,
    type: diagnosticType,
    purpose,
    provider: activeSettings.provider,
    model,
    adapter: preparedRequest.profile,
    protocol: preparedRequest.protocol,
    stream: activeSettings.enableStream,
    context: diagnosticContext,
    reasoning: {
      enabled: reasoningPolicy.enabled,
      mode: reasoningPolicy.mode,
      effort: reasoningPolicy.effort,
      nativeEnabled: resolvedProfile === 'gemini' ? reasoningPolicy.geminiNativeEnabled
        : resolvedProfile === 'claude' ? reasoningPolicy.claudeNativeEnabled
          : ['openai-responses', 'deepseek-reasoner', 'glm'].includes(resolvedProfile),
      showThinking: reasoningPolicy.showThinking
    },
    requestOptions: {
      temperature: activeSettings.enableTemperature ? activeSettings.temperature : undefined,
      maxTokens: activeSettings.enableMaxTokens ? activeSettings.maxTokens : undefined,
      topP: activeSettings.enableTopP ? activeSettings.topP : undefined,
      frequencyPenalty: activeSettings.enableFrequencyPenalty ? activeSettings.frequencyPenalty : undefined,
      presencePenalty: activeSettings.enablePresencePenalty ? activeSettings.presencePenalty : undefined
    }
  })

  const startTime = Date.now()
  appStats.apiCalls++
  
  // --- 更新新增的趣味统计 (每日消息/熬夜/连续天数) ---
  const todayStr = new Date().toLocaleDateString() // YYYY/MM/DD
  const currentHour = new Date().getHours()
  const currentMinute = new Date().getMinutes()
  
  if (appStats.lastChatDate !== todayStr) {
    // 跨天了，先处理连续签到逻辑
    if (appStats.lastChatDate) {
      const lastDate = new Date(appStats.lastChatDate)
      const today = new Date(todayStr)
      // 计算相差天数
      const diffTime = Math.abs(today.getTime() - lastDate.getTime())
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
      
      if (diffDays === 1) {
        // 连续
        appStats.currentStreak++
      } else {
        // 断签
        appStats.currentStreak = 1
      }
    } else {
      // 第一次聊
      appStats.currentStreak = 1
    }
    
    // 更新最高连续天数
    if (appStats.currentStreak > appStats.maxStreak) {
      appStats.maxStreak = appStats.currentStreak
    }
    
    appStats.lastChatDate = todayStr
    appStats.dailyMessageCount = 0 // 新的一天，清空单日计数
  }
  
  // 增加今日消息数与总消息数 (只算发出去的这一下，避免和历史消息混淆，这里暂定每次发请求算一条)
  appStats.dailyMessageCount++
  appStats.messagesSent++
  if (appStats.dailyMessageCount > appStats.maxDailyMessages) {
    appStats.maxDailyMessages = appStats.dailyMessageCount
  }
  
  // 处理修仙时间逻辑 (0点到6点视为修仙)
  if (currentHour >= 0 && currentHour < 6) {
    const totalMinutes = currentHour * 60 + currentMinute
    // 如果之前没有修仙记录，或者这次的时间比之前的记录更晚 (越接近 6点 分钟数越大)
    if (appStats.latestNightChatTime === -1 || totalMinutes > appStats.latestNightChatTime) {
      appStats.latestNightChatTime = totalMinutes
    }
  }
  // ----------------------------------------------------

  let response: Response
  let activeRequest = preparedRequest
  let tokensUsage = 0
  let inputTokensUsage = 0
  let outputTokensUsage = 0
  try {
    logApiRequest(activeRequest)
    response = await fetch(activeRequest.endpoint, {
      signal,
      method: 'POST',
      headers: activeRequest.headers,
      body: JSON.stringify(activeRequest.body)
    })
    if (!response.ok && activeRequest.fallback && [400, 404, 405, 422, 501].includes(response.status)) {
      const fallbackError = await response.clone().json().catch(() => ({}))
      logApiResponse({ protocol: activeRequest.protocol, status: response.status, raw: fallbackError })
      const previousProtocol = activeRequest.protocol
      activeRequest = activeRequest.fallback
      logApiFallback(previousProtocol, activeRequest.protocol, response.status)
      logApiRequest(activeRequest)
      response = await fetch(activeRequest.endpoint, {
        signal,
        method: 'POST',
        headers: activeRequest.headers,
        body: JSON.stringify(activeRequest.body)
      })
    }
  } catch (e: any) {
    appStats.apiFailures++
    commitDiagnosticTrace(diagnosticDraft, {
      status: e?.name === 'AbortError' ? 'aborted' : 'error',
      protocol: activeRequest.protocol,
      errorMessage: e?.message || 'API 请求异常中断'
    }).catch(() => {})
    if (e?.name === 'AbortError') throw e
    throw new Error(e.message || 'API 请求异常中断')
  }

  const endTime = Date.now()
  appStats.apiTotalTime += (endTime - startTime)

  if (!response.ok) {
    appStats.apiFailures++
    const errorData = await response.json().catch(() => ({}))
    const errorMsg = errorData.error?.message || `API 请求失败 (${response.status})`
    logApiResponse({ protocol: activeRequest.protocol, status: response.status, raw: errorData })
    console.error(`AI 接口请求失败：${errorMsg}`)
    
    // 记录失败日志
    let logType = 'Chat'
    if (isSummary) logType = 'Summary'
    if (isVision) logType = 'Vision'
    if (purpose === 'moment-followup') logType = 'Moment'
    if (purpose === 'character-generation') logType = 'CharacterGeneration'
    if (purpose === 'character-review-global') logType = 'CharacterReview'
    if (purpose === 'prompt-generation') logType = 'PromptGeneration'

    apiLogger.addLog({
      type: logType,
      model: model,
      duration: endTime - startTime,
      success: false,
      errorMsg: errorMsg
    }).catch(() => {})

    commitDiagnosticTrace(diagnosticDraft, {
      status: 'error',
      protocol: activeRequest.protocol,
      errorMessage: errorMsg
    }).catch(() => {})

    throw new Error(errorMsg)
  }

  let content = ''
  let thinking = ''
  let stopReason = ''
  let reasoningSource: ReasoningSource = 'none'
  let providerState: ProviderReasoningState | undefined
  const rawStreamEvents: unknown[] | null = isRawApiConsoleLoggingEnabled() ? [] : null

  if (activeSettings.enableStream) {
    if (!response.body) throw new Error('流式请求失败：无法读取响应体')
    const reader = response.body.getReader()
    const decoder = new TextDecoder('utf-8')
    let buffer = ''
    
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || '' // 留着最后一行不完整的下次拼

      for (const line of lines) {
        const trimmed = line.trim()
        if (trimmed.startsWith('data: ')) {
          const dataStr = trimmed.slice(6)
          if (dataStr === '[DONE]') continue
          
          try {
            const dataObj = JSON.parse(dataStr)
            if (rawStreamEvents) rawStreamEvents.push(dataObj)
            const delta = consumeAdapterStreamEvent(activeRequest.profile, dataObj, activeRequest.protocol)
            if (delta.content) content += delta.content
            if (delta.thinking) thinking += delta.thinking
            if (delta.reasoningSource) reasoningSource = delta.reasoningSource
            if (delta.providerState) providerState = mergeProviderReasoningState(providerState, delta.providerState)
            if (delta.stopReason) stopReason = delta.stopReason
            if (delta.tokens) tokensUsage = delta.tokens
            if (delta.inputTokens) inputTokensUsage = delta.inputTokens
            if (delta.outputTokens) outputTokensUsage = delta.outputTokens
          } catch (e) {
            // 忽略解析失败的非标准块
          }
        }
      }
    }
    // 处理可能剩下的 buffer
    if (buffer.startsWith('data: ') && buffer.trim() !== 'data: [DONE]') {
      try {
        const dataObj = JSON.parse(buffer.slice(6))
        if (rawStreamEvents) rawStreamEvents.push(dataObj)
        const delta = consumeAdapterStreamEvent(activeRequest.profile, dataObj, activeRequest.protocol)
        if (delta.content) content += delta.content
        if (delta.thinking) thinking += delta.thinking
        if (delta.reasoningSource) reasoningSource = delta.reasoningSource
        if (delta.providerState) providerState = mergeProviderReasoningState(providerState, delta.providerState)
        if (delta.stopReason) stopReason = delta.stopReason
        if (delta.tokens) tokensUsage = delta.tokens
        if (delta.inputTokens) inputTokensUsage = delta.inputTokens
        if (delta.outputTokens) outputTokensUsage = delta.outputTokens
      } catch (e) {}
    }
    
  } else {
    const data = await response.json()
    const parsed = parseAdapterResponse(activeRequest.profile, data, activeRequest.protocol)
    logApiResponse({ protocol: activeRequest.protocol, status: response.status, raw: data, parsed })
    content = parsed.content
    thinking = parsed.thinking
    reasoningSource = parsed.reasoningSource || (thinking ? 'native' : 'none')
    providerState = parsed.providerState
    if (parsed.tokens) tokensUsage = parsed.tokens
    if (parsed.inputTokens) inputTokensUsage = parsed.inputTokens
    if (parsed.outputTokens) outputTokensUsage = parsed.outputTokens
    stopReason = parsed.stopReason || ''
  }

  if (inputTokensUsage > 0 || outputTokensUsage > 0) {
    tokensUsage = inputTokensUsage + outputTokensUsage
  }
  if (rawStreamEvents) {
    logApiResponse({
      protocol: activeRequest.protocol,
      status: response.status,
      raw: rawStreamEvents,
      parsed: { content, thinking, reasoningSource, stopReason, tokens: tokensUsage }
    })
  }

  // 记录成功日志
  let logType = 'Chat'
  if (isSummary) logType = 'Summary'
  if (isVision) logType = 'Vision'
  if (purpose === 'moment-followup') logType = 'Moment'
  if (purpose === 'character-generation') logType = 'CharacterGeneration'
  if (purpose === 'character-review-global') logType = 'CharacterReview'
  if (purpose === 'prompt-generation') logType = 'PromptGeneration'

  apiLogger.addLog({
    type: logType,
    model: model,
    duration: endTime - startTime,
    success: true,
    tokens: tokensUsage > 0 ? tokensUsage : undefined
  }).catch(() => {})

  // 原生摘要优先；只有供应商没有返回摘要时，才把完整闭合的兼容标签识别为分析文本。
  if (reasoningPolicy.enabled) {
    const embedded = extractEmbeddedReasoning(content)
    if (embedded.found) {
      content = embedded.content
      if (!thinking && embedded.thinking) {
        thinking = embedded.thinking
        reasoningSource = 'prompt'
      }
    }
  }
  if (reasoningPolicy.enabled && reasoningPolicy.mode === 'skip') {
    thinking = ''
    reasoningSource = 'none'
    providerState = undefined
  }
  if (providerState?.provider === 'claude' && providerState.blocks?.length) {
    const thinkingBlock = providerState.blocks.find((item: any) => item.type === 'thinking')
    if (thinkingBlock && !thinkingBlock.thinking) thinkingBlock.thinking = thinking
    if (!providerState.blocks.some((item: any) => item.type === 'text')) providerState.blocks.push({ type: 'text', text: content })
  }
  if (providerState?.provider === 'gemini' && providerState.parts?.length && !providerState.parts.some((item: any) => !item.thought && item.text)) {
    providerState.parts.unshift(...(thinking ? [{ text: thinking, thought: true }] : []), { text: content })
  }
  // --- 结束解析逻辑 ---

  commitDiagnosticTrace(diagnosticDraft, {
    status: 'success',
    protocol: activeRequest.protocol,
    response: content,
    thinking,
    reasoningSource,
    tokens: tokensUsage > 0 ? tokensUsage : undefined,
    stopReason,
    truncated: ['length', 'max_tokens', 'MAX_TOKENS'].includes(stopReason)
  }).catch(() => {})

  if (tokensUsage > 0) {
    saveTokenUsageSnapshot({
      chatId: diagnosticContext?.chatId,
      model,
      provider: activeSettings.provider,
      inputTokens: inputTokensUsage,
      outputTokens: outputTokensUsage,
      totalTokens: tokensUsage,
      createdAt: Date.now()
    })
  }

  // 返回对象格式以支持 thinking
  return {
    content,
    thinking,
    reasoningSource,
    providerState,
    stopReason,
    truncated: ['length', 'max_tokens', 'MAX_TOKENS'].includes(stopReason)
  }
}
