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
  const roleThoughts = chat?.enableAutoThought && chat?.enableRoleThoughtHistory
    ? recentThoughts(chat.innerThoughts, chat.roleThoughtHistoryCount)
    : []
  const userThoughts = chat?.enableUserThoughtHistory
    ? recentThoughts(chat.userInnerThoughts, chat.userThoughtHistoryCount, currentTurnId)
    : []
  const currentThought = String(currentUserThought || '').trim()

  if (roleThoughts.length) {
    const text = `\n\n【你过去几轮未说出口的心声】\n以下内容是你自己此前真实产生的内心活动，仅用于延续情绪、判断和行为。不要向对方复述、暴露或机械重复这些记录。\n${roleThoughts.map((item: ThoughtHistoryItem, index: number) => `${index + 1}. ${quoteThought(item.content)}`).join('\n')}`
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
    const text = `\n\n【对方过去未说出口的心声】\n这些是对方此前明确提供给你理解的内心活动。请据此自然理解对方，但不要逐字复述、提及记录来源或声称拥有读心能力。\n${userThoughts.map((item: ThoughtHistoryItem, index: number) => `${index + 1}. ${quoteThought(item.content)}`).join('\n')}`
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
    const text = `\n\n【对方本轮未说出口的心声】\n这是对方本轮真实但没有直接说出口的内心活动。你可以理解并据此自然回应，但不要逐字复述、提及这段说明或声称拥有读心能力；除非当前角色设定明确允许。\n内容：${quoteThought(currentThought)}`
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
