/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { pushContextTrace, type ContextTraceCollector } from './contextTrace'

export type ThoughtHistoryItem = {
  id?: number | string
  content?: string
  createdAt?: number
  turnId?: string
}

const normalizeCount = (value: unknown, fallback = 3) => {
  const parsed = Number.parseInt(String(value ?? ''), 10)
  return Number.isFinite(parsed) ? Math.min(100, Math.max(1, parsed)) : fallback
}

const quoteThought = (content: unknown) => JSON.stringify(String(content ?? '').trim())

const recentThoughts = (items: unknown, count: unknown, excludedTurnId = '') => {
  if (!Array.isArray(items)) return []
  return items
    .filter((item: ThoughtHistoryItem) => String(item?.content || '').trim() && (!excludedTurnId || item?.turnId !== excludedTurnId))
    .slice(0, normalizeCount(count))
    .reverse()
}

export const sanitizeThoughtHistoryCount = (value: unknown, fallback = 3) => normalizeCount(value, fallback)

export const buildInnerThoughtContext = (
  chat: any,
  currentUserThought = '',
  currentTurnId = '',
  trace?: ContextTraceCollector
) => {
  const sections: string[] = []
  const characterName = String(chat?.name || chat?.realName || '当前角色')
  const roleThoughts = chat?.enableAutoThought && chat?.enableRoleThoughtHistory
    ? recentThoughts(chat.innerThoughts, chat.roleThoughtHistoryCount)
    : []
  const userThoughts = chat?.enableUserThoughtHistory
    ? recentThoughts(chat.userInnerThoughts, chat.userThoughtHistoryCount, currentTurnId)
    : []
  const currentThought = String(currentUserThought || '').trim()

  if (roleThoughts.length) {
    const text = `\n\n【角色${characterName}过去几轮未说出口的心声】\n这些内容只属于角色${characterName}，用于延续该角色的情绪、判断和行为，不归属于用户或其他角色，也不向用户复述。\n${roleThoughts.map((item: ThoughtHistoryItem, index: number) => `${index + 1}. ${quoteThought(item.content)}`).join('\n')}`
    sections.push(text)
    pushContextTrace(trace, {
      id: 'runtime:role-thought-history',
      category: 'memory',
      group: '心声上下文',
      label: `角色历史心声 · ${roleThoughts.length} 条`,
      text,
      reason: '已开启角色读取自己的历史心声'
    })
  }

  if (userThoughts.length) {
    const text = `\n\n【当前用户过去未说出口的心声】\n这些内心活动由当前用户此前明确提供，只供角色${characterName}理解上下文。角色${characterName}可以据此自然理解用户，但不逐字复述、不提及记录来源，也不声称拥有读心能力。\n${userThoughts.map((item: ThoughtHistoryItem, index: number) => `${index + 1}. ${quoteThought(item.content)}`).join('\n')}`
    sections.push(text)
    pushContextTrace(trace, {
      id: 'runtime:user-thought-history',
      category: 'memory',
      group: '心声上下文',
      label: `用户历史心声 · ${userThoughts.length} 条`,
      text,
      reason: '已开启角色读取用户的历史心声'
    })
  }

  if (currentThought) {
    const text = `\n\n【当前用户本轮未说出口的心声】\n这是当前用户本轮真实但没有直接说出口的内心活动。角色${characterName}可以据此自然理解，但不逐字复述、提及记录来源或声称拥有读心能力。\n内容：${quoteThought(currentThought)}`
    sections.push(text)
    pushContextTrace(trace, {
      id: 'runtime:current-user-thought',
      category: 'memory',
      group: '心声上下文',
      label: '用户本轮心声',
      text,
      reason: '用户本轮填写了非空心声'
    })
  }

  return sections.join('')
}
