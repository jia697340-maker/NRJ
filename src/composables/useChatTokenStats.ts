/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { ref } from 'vue'
import { apiSettings, defaultPromptItemsV1, defaultPromptItemsV1En, defaultPromptItemsV2, defaultPromptItemsV2En, getActivePromptItems, getActivePromptScheme, globalPromptSettings, worldBooks } from '../store'
import { useChatState } from './useChatState'
import { estimateMessageTokens, estimateTextTokens, getTokenEstimateMethodLabel } from '../utils/tokenEstimate'
import type { ContextTraceCategory, ContextTraceFragment } from '../services/contextTrace'
import { getTokenUsageSnapshot, type TokenUsageSnapshot } from '../services/tokenUsageSnapshot'
import { decorateChatPayload } from '../services/api'
import { buildGroupChatMessages } from '../services/groupChat'

export interface TokenDetailItem {
  id: string
  label: string
  group: string
  category: ContextTraceCategory
  tokens: number
  characters: number
  percentage: number
  text: string
  reason?: string
  parentId?: string
  counted: boolean
}

export interface TokenGroupItem {
  label: string
  tokens: number
  percentage: number
  details: TokenDetailItem[]
}

export interface TokenCategoryItem {
  key: ContextTraceCategory
  label: string
  color: string
  tokens: number
  percentage: number
  groups: TokenGroupItem[]
}

export interface ChatTokenStats {
  totalTokens: number
  totalCharacters: number
  totalMsgCount: number
  activeMsgCount: number
  methodLabel: string
  model: string
  presetLabel: string
  categories: TokenCategoryItem[]
  topItems: TokenDetailItem[]
  suggestions: Array<{ title: string; desc: string; savings?: number }>
  comparisons: Array<{ label: string; tokens: number; active: boolean }>
  outputReserve: number
  referenceWindow: number
  remainingReference: number
  mediaCount: number
  generatedAt: number
  actualUsage: TokenUsageSnapshot | null
}

const tokenStats = ref<ChatTokenStats | null>(null)
const isCalculating = ref(false)

const CATEGORY_META: Record<ContextTraceCategory, { label: string; color: string }> = {
  system: { label: '人设与系统', color: '#FF6B6B' },
  world: { label: '世界设定', color: '#339AF0' },
  memory: { label: '长效记忆', color: '#FCC419' },
  history: { label: '历史对话', color: '#51CF66' },
  media: { label: '图片与媒体', color: '#845EF7' }
}

const extractText = (content: any): string => {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  return content.filter(item => item?.type === 'text').map(item => String(item.text || '')).join('\n')
}

const makeComparisons = () => {
  const variants = [
    { label: '中文 V1', items: defaultPromptItemsV1, preset: 'v1', language: 'zh' },
    { label: '中文 V2', items: defaultPromptItemsV2, preset: 'v2', language: 'zh' },
    { label: '英文 V1', items: defaultPromptItemsV1En, preset: 'v1', language: 'en' },
    { label: '英文 V2', items: defaultPromptItemsV2En, preset: 'v2', language: 'en' }
  ]
  const comparisons = variants.map(variant => ({
    label: variant.label,
    tokens: variant.items.filter(item => item.enabled).reduce((sum, item) => sum + estimateTextTokens(item.content), 0),
    active: globalPromptSettings.activeSchemeId === `builtin_${variant.preset}` && globalPromptSettings.language === variant.language
  }))
  const active = getActivePromptScheme()
  if (active?.source === 'user') comparisons.unshift({
    label: `${globalPromptSettings.language === 'en' ? '英文' : '中文'} ${active.name}`,
    tokens: getActivePromptItems().filter(item => item.enabled).reduce((sum, item) => sum + estimateTextTokens(item.content), 0),
    active: true
  })
  return comparisons
}

export function useChatTokenStats() {
  const { selectedChat, buildChatMessages, mockChats, effectiveMyProfile } = useChatState()

  const refreshTokenStats = async () => {
    const chat = selectedChat.value
    if (!chat || isCalculating.value) return

    isCalculating.value = true
    try {
      const fragments: ContextTraceFragment[] = []
      let assembledMessages: any[]
      if (chat.chatType === 'group') {
        const worldText = worldBooks
          .filter((book: any) => book.enabled && (chat.boundWorldBooks?.includes(book.id) || (book.groupIds || []).some((groupId: string) => chat.boundWorldBookGroups?.includes(groupId))))
          .flatMap((book: any) => (book.entries || []).filter((entry: any) => entry.enabled).map((entry: any) => `${entry.title}: ${entry.content}`))
          .join('\n')
        assembledMessages = await buildGroupChatMessages(chat, mockChats.value, chat.userProfile || effectiveMyProfile.value, worldText)
        assembledMessages.forEach((message: any, index: number) => fragments.push({
          id: index === 0 ? 'group:system' : `group:history:${index}`,
          category: index === 0 ? 'system' : 'history',
          group: index === 0 ? '群聊系统与成员上下文' : '群聊历史',
          label: index === 0 ? '群聊完整系统提示词' : `群聊历史消息 ${index}`,
          text: extractText(message.content),
          messageRole: message.role,
          counted: true,
          reason: index === 0 ? '群聊成员设定、协议、记忆、时间与世界书的最终组合' : '位于群聊当前历史保留范围内'
        }))
      } else {
        assembledMessages = await buildChatMessages(chat, false, false, {
          includeMedia: false,
          allowExternalMemoryLookup: false,
          trace: fragment => fragments.push(fragment)
        })
      }
      const apiMessages = decorateChatPayload(assembledMessages, false, 'default')
      const baseSystemText = assembledMessages[0] ? extractText(assembledMessages[0].content) : ''
      const decoratedSystemText = apiMessages[0] ? extractText(apiMessages[0].content) : ''
      const cotSystemText = decoratedSystemText.startsWith(baseSystemText) ? decoratedSystemText.slice(baseSystemText.length) : ''
      if (cotSystemText) fragments.push({ id: 'runtime:cot-system', category: 'system', group: '思考与预填充', label: '思维链系统规则', text: cotSystemText, reason: '高级设置中的思维链规则已开启' })
      apiMessages.slice(assembledMessages.length).forEach((message: any, index: number) => fragments.push({
        id: `runtime:prefill:${index}`, category: 'system', group: '思考与预填充', label: 'Assistant 预填充',
        text: extractText(message.content), reason: '高级设置中的预填充规则已开启'
      }))
      const messageTexts = apiMessages.map((message: any) => extractText(message.content))
      const totalTokens = messageTexts.reduce((sum: number, text: string) => sum + estimateMessageTokens(text), 0)
      const totalCharacters = messageTexts.reduce((sum: number, text: string) => sum + text.length, 0)

      const details: TokenDetailItem[] = fragments.map(fragment => {
        const framing = fragment.category === 'history' && fragment.counted !== false ? 4 : 0
        const tokens = estimateTextTokens(fragment.text) + framing
        return {
          id: fragment.id,
          label: fragment.label,
          group: fragment.group,
          category: fragment.category,
          tokens,
          characters: fragment.text.length,
          percentage: totalTokens ? Math.round(tokens / totalTokens * 1000) / 10 : 0,
          text: fragment.text,
          reason: fragment.reason,
          parentId: fragment.parentId,
          counted: fragment.counted !== false
        }
      })

      const systemActual = (apiMessages[0] ? estimateMessageTokens(messageTexts[0]) : 0)
        + apiMessages.slice(assembledMessages.length).reduce((sum: number, message: any) => sum + estimateMessageTokens(extractText(message.content)), 0)
      const attributedSystem = details
        .filter(item => item.counted && item.category !== 'history' && item.category !== 'media')
        .reduce((sum, item) => sum + item.tokens, 0)
      const reconciliation = systemActual - attributedSystem
      if (reconciliation !== 0) {
        details.push({
          id: 'system:protocol-overhead', label: '分隔符与消息协议开销', group: '输出格式与协议', category: 'system',
          tokens: reconciliation, characters: 0, percentage: totalTokens ? Math.round(reconciliation / totalTokens * 1000) / 10 : 0,
          text: '提示词片段之间的换行、消息角色与本地估算边界差异。', reason: '用于让分项之和与最终请求总量保持一致', counted: true
        })
      }

      const categories = (Object.keys(CATEGORY_META) as ContextTraceCategory[]).map(key => {
        const categoryDetails = details.filter(item => item.category === key)
        const countedDetails = categoryDetails.filter(item => item.counted)
        const tokens = countedDetails.reduce((sum, item) => sum + item.tokens, 0)
        const groupNames = [...new Set(categoryDetails.map(item => item.group))]
        const groups = groupNames.map(label => {
          const groupDetails = categoryDetails.filter(item => item.group === label)
          const groupTokens = groupDetails.filter(item => item.counted).reduce((sum, item) => sum + item.tokens, 0)
          return { label, tokens: groupTokens, percentage: totalTokens ? Math.round(groupTokens / totalTokens * 1000) / 10 : 0, details: groupDetails }
        }).sort((a, b) => b.tokens - a.tokens)
        return { key, ...CATEGORY_META[key], tokens, percentage: totalTokens ? Math.round(tokens / totalTokens * 1000) / 10 : 0, groups }
      })

      const topItems = details.filter(item => item.counted && item.tokens > 0).sort((a, b) => b.tokens - a.tokens).slice(0, 10)
      const categoryTokens = (key: ContextTraceCategory) => categories.find(item => item.key === key)?.tokens || 0
      const suggestions: ChatTokenStats['suggestions'] = []
      if (globalPromptSettings.language === 'en') suggestions.push({ title: '英文底层提示词较长', desc: '可在高级设置中对比中文版本；当前统计已改用中英混合估算，不再按字符数乘 1.2。' })
      if (categoryTokens('history') > totalTokens * 0.55) suggestions.push({ title: '历史对话占比较高', desc: '缩短记忆条数/轮数，或先生成长期总结，可直接降低每轮重复输入。', savings: Math.round(categoryTokens('history') * 0.35) })
      if (categoryTokens('system') > totalTokens * 0.55) suggestions.push({ title: '系统规则占比较高', desc: '优先检查排行榜中的功能规则和自定义提示词；关闭不用的功能后，对应规则应停止注入。' })
      if (categoryTokens('world') > 4000) suggestions.push({ title: '世界设定体积较大', desc: '可拆分世界书，并只关联当前角色真正需要的条目。', savings: Math.round(categoryTokens('world') * 0.4) })
      if (categoryTokens('memory') > Number(chat.memoryTokenBudget || 1200) * 1.15) suggestions.push({ title: '长期记忆接近预算', desc: '检查召回条目是否重复，或降低长期记忆 Token 预算。' })
      if (!suggestions.length) suggestions.push({ title: '当前结构较均衡', desc: '可继续查看占用排行榜和每条注入原因，无需为了数字盲目删减人设。' })

      const outputReserve = apiSettings.enableMaxTokens ? Number(apiSettings.maxTokens || 1000) : 1000
      const referenceWindow = 128000
      tokenStats.value = {
        totalTokens, totalCharacters, methodLabel: getTokenEstimateMethodLabel(), model: apiSettings.model || '未选择模型',
        presetLabel: `${globalPromptSettings.language === 'en' ? '英文' : '中文'} ${getActivePromptScheme()?.name || globalPromptSettings.activePresetId.toUpperCase()}`,
        categories, topItems, suggestions, comparisons: makeComparisons(), outputReserve, referenceWindow,
        remainingReference: Math.max(0, referenceWindow - totalTokens - outputReserve),
        totalMsgCount: (chat.messages || []).length, activeMsgCount: Math.max(0, apiMessages.length - 1),
        mediaCount: details.filter(item => item.category === 'media').length, generatedAt: Date.now(),
        actualUsage: getTokenUsageSnapshot(chat.id)
      }
    } catch (error) {
      console.error('Failed to estimate chat token usage', error)
      tokenStats.value = null
    } finally {
      isCalculating.value = false
    }
  }

  const getTokenPercentage = (value: number, total: number) => total ? Math.round(value / total * 100) : 0
  return { tokenStats, isCalculating, refreshTokenStats, getTokenPercentage }
}
