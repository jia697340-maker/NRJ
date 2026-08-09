/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { sendChatMessage } from './api'

export type OfflineCarryoverMode = 'summary' | 'summary_recent' | 'full' | 'none'

export interface OfflineMeetSession {
  id: string
  mode: 'mixed' | 'separate'
  status: 'active' | 'ended'
  startedAt: number
  endedAt?: number
  messageIds: number[]
  recentMessageIds: number[]
  summary: string
  carryoverMode: OfflineCarryoverMode
  recentMessageCount: number
  summaryInstruction: string
}

const nextMessageId = (chat: any) => {
  const latestId = Math.max(0, ...(chat?.messages || []).map((item: any) => Number(item?.id) || 0))
  return Math.max(Date.now(), latestId + 1)
}

export const ensureOfflineSessions = (chat: any): OfflineMeetSession[] => {
  if (!Array.isArray(chat?.offlineMeetSessions)) chat.offlineMeetSessions = []
  return chat.offlineMeetSessions
}

export const getActiveOfflineSession = (chat: any): OfflineMeetSession | null => {
  if (!chat?.activeOfflineSessionId) return null
  return ensureOfflineSessions(chat).find(item => item.id === chat.activeOfflineSessionId && item.status === 'active') || null
}

export const isMixedOfflineActive = (chat: any) => Boolean(
  chat?.offlineMeetEnabled &&
  chat?.offlineMeetMode === 'mixed' &&
  getActiveOfflineSession(chat)
)

export const startMixedOfflineSession = (chat: any): OfflineMeetSession => {
  const existing = getActiveOfflineSession(chat)
  if (existing) return existing

  const startedAt = Date.now()
  const session: OfflineMeetSession = {
    id: `offline_meet_${startedAt}`,
    mode: 'mixed',
    status: 'active',
    startedAt,
    messageIds: [],
    recentMessageIds: [],
    summary: '',
    carryoverMode: 'summary',
    recentMessageCount: 6,
    summaryInstruction: ''
  }

  ensureOfflineSessions(chat).push(session)
  chat.activeOfflineSessionId = session.id
  if (!Array.isArray(chat.messages)) chat.messages = []
  const boundaryId = nextMessageId(chat)
  chat.messages.push({
    id: boundaryId,
    type: 'system',
    content: '本次线下见面开始',
    offlineSessionId: session.id,
    offlineMeetChannel: 'mixed',
    isOfflineSessionBoundary: true,
    excludeFromGeneralMemory: true
  })
  session.messageIds.push(boundaryId)
  return session
}

export const attachActiveOfflineSession = (chat: any, message: Record<string, any>) => {
  const session = getActiveOfflineSession(chat)
  if (!session) return message
  message.offlineSessionId = session.id
  message.offlineMeetChannel = session.mode
  message.excludeFromGeneralMemory = true
  const id = Number(message.id)
  if (Number.isFinite(id) && !session.messageIds.includes(id)) session.messageIds.push(id)
  return message
}

const formatSessionTranscript = (chat: any, messages: any[], userName: string) => messages.map(item => {
  const speaker = item.type === 'left' ? (chat?.name || '角色') : item.type === 'right' ? userName : '场景记录'
  return `${speaker}：${String(item.content || '').trim()}`
}).filter(Boolean).join('\n')

export const generateOfflineSessionSummary = async (
  chat: any,
  messages: any[],
  userName: string,
  customInstruction = ''
) => {
  const transcript = formatSessionTranscript(chat, messages, userName)
  const prompt = `你是线下见面档案整理助手。请根据原文生成一段可供后续线上聊天承接的客观摘要，不得补写原文没有的事实。\n\n要求：\n1. 保留关键事件、双方行动、情绪变化、关系变化、承诺、决定和未完成事项。\n2. 明确区分已经发生的事实与尚未完成的计划。\n3. 地点未明确时不要自行补充。\n4. 使用第三人称，控制在150至350字。\n5. 只输出摘要正文，不要标题、标签、项目符号或解释。${customInstruction.trim() ? `\n6. 用户补充要求：${customInstruction.trim()}` : ''}\n\n线下见面原文：\n${transcript}`
  const result = await sendChatMessage([{ role: 'user', content: prompt }], undefined, true)
  const raw = typeof result === 'string' ? result : result.content
  const summary = String(raw || '')
    .replace(/<thinking>[\s\S]*?<\/thinking>/gi, '')
    .replace(/\[incipere\][\s\S]*?\[finire\]/gi, '')
    .replace(/^```(?:text)?\s*|```$/g, '')
    .trim()
  if (!summary) throw new Error('总结节点没有返回有效内容')
  return summary
}

export const finishMixedOfflineSession = (
  chat: any,
  session: OfflineMeetSession,
  options: {
    carryoverMode: OfflineCarryoverMode
    recentMessageCount: number
    summaryInstruction: string
    summary: string
  }
) => {
  const messages = chat.messages || []
  const sourceMessages = messages.filter((item: any) => item.offlineSessionId === session.id && !item.isOfflineSessionBoundary)
  const recentMessageIds = sourceMessages
    .filter((item: any) => item.type === 'left' || item.type === 'right')
    .slice(-Math.max(2, options.recentMessageCount))
    .map((item: any) => Number(item.id))

  session.status = 'ended'
  session.endedAt = Date.now()
  session.summary = options.summary
  session.carryoverMode = options.carryoverMode
  session.recentMessageCount = options.recentMessageCount
  session.recentMessageIds = recentMessageIds
  session.summaryInstruction = options.summaryInstruction.trim()

  const boundaryId = nextMessageId(chat)
  const boundaryContent = options.summary && (options.carryoverMode === 'summary' || options.carryoverMode === 'summary_recent')
    ? `本次线下见面已结束\n${options.summary}`
    : '本次线下见面已结束'
  messages.push({
    id: boundaryId,
    type: 'system',
    content: boundaryContent,
    offlineSessionId: session.id,
    offlineMeetChannel: 'mixed',
    isOfflineSessionBoundary: true,
    isOfflineSessionSummary: true,
    excludeFromGeneralMemory: true
  })
  session.messageIds.push(boundaryId)
  chat.activeOfflineSessionId = null

  if (options.summary && options.carryoverMode !== 'none') {
    if (!Array.isArray(chat.memoryBook)) chat.memoryBook = []
    chat.memoryBook.push({
      id: boundaryId + 1,
      date: new Date().toLocaleDateString('zh-CN'),
      content: options.summary,
      messageCount: sourceMessages.length,
      fromMsgId: session.messageIds[0],
      toMsgId: boundaryId,
      evidenceMessageIds: sourceMessages.map((item: any) => item.id),
      isOfflineMeetSummary: true,
      offlineSessionId: session.id,
      memoryLevel: 1,
      memoryMode: 'narrative',
      version: 2,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      enabled: true
    })
  }

  return boundaryContent
}

export const filterOnlineHistoryByOfflineSessions = (chat: any, history: any[]) => {
  const sessions = new Map(ensureOfflineSessions(chat).map(item => [item.id, item]))
  return history.filter(message => {
    if (!message.offlineSessionId || message.offlineMeetChannel !== 'mixed') return true
    const session = sessions.get(message.offlineSessionId)
    if (!session || session.status === 'active') return true
    if (session.carryoverMode === 'full') return true
    if (session.carryoverMode === 'none') return false
    if (message.isOfflineSessionSummary) return true
    return session.carryoverMode === 'summary_recent' && session.recentMessageIds.includes(Number(message.id))
  })
}
