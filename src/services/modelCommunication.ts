/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { sendChatMessage } from './api'

export interface ChatModelRule {
  id: string
  content: string
  enabled: boolean
  createdAt: number
  updatedAt: number
  sourceMessageIds: Array<number | string>
}

export interface ModelCommunicationMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: number
}

export const normalizeChatModelRules = (value: unknown): ChatModelRule[] => Array.isArray(value)
  ? value.map((item: any, index) => ({
      id: String(item?.id || `chat_rule_${Date.now()}_${index}`),
      content: String(item?.content || '').trim(),
      enabled: item?.enabled !== false,
      createdAt: Number(item?.createdAt) || Date.now(),
      updatedAt: Number(item?.updatedAt) || Number(item?.createdAt) || Date.now(),
      sourceMessageIds: Array.isArray(item?.sourceMessageIds) ? item.sourceMessageIds : []
    })).filter(item => item.content)
  : []

export const normalizeModelCommunicationMessages = (value: unknown): ModelCommunicationMessage[] => Array.isArray(value)
  ? value.map((item: any, index) => ({
      id: String(item?.id || `model_comm_${Date.now()}_${index}`),
      role: item?.role === 'assistant' ? 'assistant' as const : 'user' as const,
      content: String(item?.content || '').trim(),
      createdAt: Number(item?.createdAt) || Date.now()
    })).filter(item => item.content).slice(-80)
  : []

export const buildChatModelRulesPrompt = (chat: any) => {
  const rules = normalizeChatModelRules(chat?.modelCommunicationRules).filter(item => item.enabled)
  if (!rules.length) return ''
  return `\n\n【当前聊天的用户纠正规则】\n以下规则来自用户与模型的直接沟通，只用于约束后续角色演绎。它们不是聊天剧情，不得向用户提及规则、模型或幕后沟通过程。若与角色当前情绪和情境有关，应保持连续性地执行。\n${rules.map((item, index) => `${index + 1}. ${item.content}`).join('\n')}`
}

const formatSelectedMessages = (chat: any, messages: any[], focusIds: Array<number | string>) => {
  const focus = new Set(focusIds.map(String))
  return messages.map((message, index) => {
    const speaker = message.type === 'right' ? '用户' : message.type === 'left' ? (chat?.name || '角色') : message.type === 'narration' ? '旁白' : '系统'
    const marker = focus.has(String(message.id)) ? '【重点分析】' : '【参考上下文】'
    return `${index + 1}. ${marker}${speaker}：${String(message.content || '').trim()}`
  }).join('\n')
}

const communicationSystem = `你现在是当前聊天模型的直接沟通助手，不扮演角色。你的任务是和用户一起检查角色回复为什么不符合预期，并提出具体、可执行、适合长期生效的纠正方式。
不要声称能读取隐藏思维过程，不要继续角色扮演，不要把幕后沟通当成剧情。区分角色设定问题、上下文连续性问题和回复习惯问题。回复使用自然中文，先回应用户当前问题；只有用户要求生成规则时才输出规则。`

export async function communicateWithChatModel(options: {
  chat: any
  selectedMessages: any[]
  focusIds: Array<number | string>
  communicationMessages: ModelCommunicationMessage[]
  userText: string
  signal?: AbortSignal
}) {
  const existingRules = normalizeChatModelRules(options.chat?.modelCommunicationRules).filter(item => item.enabled)
  const context = formatSelectedMessages(options.chat, options.selectedMessages, options.focusIds)
  const messages: Array<{ role: string; content: string }> = [
    { role: 'system', content: communicationSystem },
    { role: 'user', content: `当前角色：${options.chat?.name || '未命名角色'}\n角色设定：${options.chat?.persona || '未设置'}\n当前已启用纠正规则：${existingRules.length ? existingRules.map((item, index) => `${index + 1}. ${item.content}`).join('\n') : '无'}\n\n选中的聊天内容：\n${context || '未选择聊天内容。请只根据用户描述沟通。'}` },
    ...options.communicationMessages.slice(-12).map(item => ({ role: item.role, content: item.content })),
    { role: 'user', content: options.userText.trim() }
  ]
  const response = await sendChatMessage(messages, options.signal, false, false, 'default')
  return response.content.trim()
}

const extractJson = (text: string) => {
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim()
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start < 0 || end <= start) throw new Error('模型没有返回可解析的规则，请重新生成。')
  return JSON.parse(cleaned.slice(start, end + 1))
}

export async function generateChatModelRules(options: {
  chat: any
  selectedMessages: any[]
  focusIds: Array<number | string>
  communicationMessages: ModelCommunicationMessage[]
  signal?: AbortSignal
}) {
  const context = formatSelectedMessages(options.chat, options.selectedMessages, options.focusIds)
  const transcript = options.communicationMessages.slice(-16).map(item => `${item.role === 'user' ? '用户' : '模型助手'}：${item.content}`).join('\n')
  const response = await sendChatMessage([
    { role: 'system', content: '你是当前聊天的规则整理器。只返回合法 JSON，不要 Markdown、解释或思考过程。规则必须具体、可执行，不复述剧情事实，不提及幕后沟通。' },
    { role: 'user', content: `根据角色设定、选中对话和直接沟通，整理 1 至 6 条供后续角色扮演持续执行的纠正规则。合并重复要求，不要凭空添加用户未提出的偏好。\n\n角色：${options.chat?.name || '未命名角色'}\n角色设定：${options.chat?.persona || '未设置'}\n\n选中对话：\n${context || '无'}\n\n直接沟通：\n${transcript || '无'}\n\n返回结构：{"rules":[{"content":"规则正文"}]}` }
  ], options.signal, false, false, 'prompt-generation')
  const parsed = extractJson(response.content)
  const contents = Array.isArray(parsed?.rules) ? parsed.rules.map((item: any) => String(item?.content || '').trim()).filter(Boolean).slice(0, 6) : []
  if (!contents.length) throw new Error('模型返回的规则为空，请补充沟通内容后重试。')
  return contents
}
