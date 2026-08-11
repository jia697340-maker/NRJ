/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { apiSettings, summaryApiSettings, visionApiSettings, momentApiSettings, characterApiSettings, cotSettings, globalPromptSettings, appStats, type ApiPreset } from '../store'
import { apiLogger } from './apiLogger'
import { consumeAdapterStreamEvent, parseAdapterResponse, prepareAdapterRequest } from './modelAdapters'
import type { ModelAdapterProfile } from './modelAdapters'
import { commitDiagnosticTrace, createDiagnosticDraft, type DiagnosticContextMeta } from './diagnosticTrace'

export type ChatApiPurpose = 'default' | 'moment-followup' | 'character-generation' | 'character-review-global'

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

  // --- COT 控制动态注入逻辑 ---
  let payloadMessages = JSON.parse(JSON.stringify(messages)) // 深拷贝避免污染原数组

  // 总结/结构化记忆要求稳定的 JSON 或纯摘要，不能被聊天思维链模板污染。
  if (!payloadReady && !isSummary && !purpose.startsWith('character-') && cotSettings.enabled) {
    if (cotSettings.mode === 'skip') {
      // 模式 A：跳过思考 (Skip)
      payloadMessages.push({
        role: 'assistant',
        content: globalPromptSettings.language === 'en'
          ? '[incipere]\n<thinking>\nSkip ECoT and focus on the reply.\n</thinking>\n[finire]\n'
          : '[incipere]\n<thinking>\n跳过ECoT，专注回复。\n</thinking>\n[finire]\n'
      })
    } else if (cotSettings.mode === 'custom' && cotSettings.items) {
      // 模式 B：自定义思考 (Custom)
      const englishCotContent: Record<string, string> = {
        cot_default_1: '[Required reasoning and response format]\nBefore each response, reason and output strictly with this nested structure:\n[incipere]\n<thinking>\n',
        cot_default_3: '</thinking>\n[finire]\n<msg>\nYour final visible reply\n</msg>',
        cot_default_4: '[incipere]\n<thinking>\n'
      }
      const enabledItems = cotSettings.items.filter(i => i.enabled).map(item => (
        globalPromptSettings.language === 'en' && englishCotContent[item.id]
          ? { ...item, content: englishCotContent[item.id] }
          : item
      ))
      
      // 1. 处理 System 相关的条目
      const systemTop = enabledItems.filter(i => i.position === 'system_top').map(i => i.content).join('\n')
      const systemMiddle = enabledItems.filter(i => i.position === 'system_middle').map(i => i.content).join('\n')
      const systemBottom = enabledItems.filter(i => i.position === 'system_bottom').map(i => i.content).join('\n')
      
      if (systemTop || systemMiddle || systemBottom) {
        const combinedSystemStr = [systemTop, systemMiddle, systemBottom].filter(Boolean).join('\n')
        // 找到第一条 system 消息附加进去
        if (payloadMessages.length > 0 && payloadMessages[0].role === 'system') {
          payloadMessages[0].content += `\n\n${combinedSystemStr}`
        }
      }
      
      // 2. 处理 Prefill (Assistant) 触发器
      const prefillItems = enabledItems.filter(i => i.position === 'assistant_prefill')
      if (prefillItems.length > 0) {
        let prefillContent = prefillItems.map(i => i.content).join('\n')
        // 如果用户自定义的预填充结尾带了 <msg>\n，为了防止它干扰多条生成，建议过滤掉，或者我们就不强行加 stop 了
        payloadMessages.push({ role: 'assistant', content: prefillContent })
      }
    }
  }
  // --- 结束 COT 注入 ---

  console.log('--- 发送给 AI 的请求数据 ---')
  console.log('Messages:', payloadMessages)
  console.log('----------------------------')

  const preparedRequest = prepareAdapterRequest({
    provider: activeSettings.provider,
    url,
    key,
    model,
    profile: adapterOverride,
    stream: activeSettings.enableStream,
    maxTokens: activeSettings.enableMaxTokens ? activeSettings.maxTokens : undefined,
    temperature: activeSettings.enableTemperature ? activeSettings.temperature : undefined,
    topP: activeSettings.enableTopP ? activeSettings.topP : undefined,
    frequencyPenalty: activeSettings.enableFrequencyPenalty ? activeSettings.frequencyPenalty : undefined,
    presencePenalty: activeSettings.enablePresencePenalty ? activeSettings.presencePenalty : undefined
  }, payloadMessages)

  let diagnosticType = 'Chat'
  if (isSummary) diagnosticType = 'Summary'
  if (isVision) diagnosticType = 'Vision'
  if (purpose === 'moment-followup') diagnosticType = 'Moment'
  if (purpose === 'character-generation') diagnosticType = 'CharacterGeneration'
  if (purpose === 'character-review-global') diagnosticType = 'CharacterReview'

  const diagnosticDraft = createDiagnosticDraft({
    messages: payloadMessages,
    type: diagnosticType,
    purpose,
    provider: activeSettings.provider,
    model,
    adapter: preparedRequest.profile,
    stream: activeSettings.enableStream,
    context: diagnosticContext,
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
  let tokensUsage = 0
  try {
    response = await fetch(preparedRequest.endpoint, {
      signal,
      method: 'POST',
      headers: preparedRequest.headers,
      body: JSON.stringify(preparedRequest.body)
    })
  } catch (e: any) {
    appStats.apiFailures++
    commitDiagnosticTrace(diagnosticDraft, {
      status: e?.name === 'AbortError' ? 'aborted' : 'error',
      errorMessage: e?.message || 'API 请求异常中断'
    }).catch(() => {})
    throw new Error(e.message || 'API 请求异常中断')
  }

  const endTime = Date.now()
  appStats.apiTotalTime += (endTime - startTime)

  if (!response.ok) {
    appStats.apiFailures++
    const errorData = await response.json().catch(() => ({}))
    const errorMsg = errorData.error?.message || `API 请求失败 (${response.status})`
    console.error('--- AI 接口请求失败 ---', errorData)
    
    // 记录失败日志
    let logType = 'Chat'
    if (isSummary) logType = 'Summary'
    if (isVision) logType = 'Vision'
    if (purpose === 'moment-followup') logType = 'Moment'
    if (purpose === 'character-generation') logType = 'CharacterGeneration'
    if (purpose === 'character-review-global') logType = 'CharacterReview'

    apiLogger.addLog({
      type: logType,
      model: model,
      duration: endTime - startTime,
      success: false,
      errorMsg: errorMsg
    }).catch(() => {})

    commitDiagnosticTrace(diagnosticDraft, {
      status: 'error',
      errorMessage: errorMsg
    }).catch(() => {})

    throw new Error(errorMsg)
  }

  let content = ''
  let thinking = ''
  let stopReason = ''

  if (activeSettings.enableStream) {
    if (!response.body) throw new Error('流式请求失败：无法读取响应体')
    const reader = response.body.getReader()
    const decoder = new TextDecoder('utf-8')
    let buffer = ''
    
    console.log('--- 开始静默接收流式数据 ---')

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
            const delta = consumeAdapterStreamEvent(preparedRequest.profile, dataObj)
            if (delta.content) content += delta.content
            if (delta.thinking) thinking += delta.thinking
            if (delta.stopReason) stopReason = delta.stopReason
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
        const delta = consumeAdapterStreamEvent(preparedRequest.profile, dataObj)
        if (delta.content) content += delta.content
        if (delta.thinking) thinking += delta.thinking
        if (delta.stopReason) stopReason = delta.stopReason
      } catch (e) {}
    }
    
    console.log('--- 完整流式文本接收完毕 ---')
    console.log(content)
    console.log('----------------------------')
  } else {
    const data = await response.json()
    console.log('--- AI 接口原始返回数据 ---')
    console.log(data)
    console.log('----------------------------')
    const parsed = parseAdapterResponse(preparedRequest.profile, data)
    content = parsed.content
    thinking = parsed.thinking
    if (parsed.tokens) tokensUsage = parsed.tokens
    stopReason = parsed.stopReason || ''
  }

  // 记录成功日志
  let logType = 'Chat'
  if (isSummary) logType = 'Summary'
  if (isVision) logType = 'Vision'
  if (purpose === 'moment-followup') logType = 'Moment'
  if (purpose === 'character-generation') logType = 'CharacterGeneration'
  if (purpose === 'character-review-global') logType = 'CharacterReview'

  apiLogger.addLog({
    type: logType,
    model: model,
    duration: endTime - startTime,
    success: true,
    tokens: tokensUsage > 0 ? tokensUsage : undefined
  }).catch(() => {})

  // --- COT 响应动态解析逻辑 ---
  if (cotSettings.enabled) {
    if (cotSettings.mode === 'skip' || cotSettings.mode === 'custom') {
      // 只要开了大开关（不管是 skip 还是 custom），就需要提取 thinking
      const thinkSplit = content.split('</thinking>')
      if (thinkSplit.length > 1) {
        thinking = thinkSplit[0].replace(/<thinking>/g, '').trim()
        // 提取正文内容，去掉结尾引导标签，但保留里面的所有其他内容（包括 <narration> 等）
        let rawContent = thinkSplit.slice(1).join('</thinking>').trim() // 防御性拼合，以防模型多次输出
        rawContent = rawContent.replace(/\[finire\]/g, '').trim()
        content = rawContent
      }
    }
  }
  // --- 结束解析逻辑 ---

  commitDiagnosticTrace(diagnosticDraft, {
    status: 'success',
    response: content,
    thinking,
    tokens: tokensUsage > 0 ? tokensUsage : undefined,
    stopReason,
    truncated: ['length', 'max_tokens', 'MAX_TOKENS'].includes(stopReason)
  }).catch(() => {})

  // 返回对象格式以支持 thinking
  return {
    content,
    thinking,
    stopReason,
    truncated: ['length', 'max_tokens', 'MAX_TOKENS'].includes(stopReason)
  }
}
