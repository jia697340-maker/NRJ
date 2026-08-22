import { formatIdentityDateTime, getConversationAdjustedTimestamp, isConversationTimePaused } from './conversationTime'

export type PresenceSource = 'chat' | 'autonomy' | 'recovery'

export type PresenceSession = {
  id: string
  startedAt: number
  plannedEndAt: number
  endedAt: number
  requestedDuration: string
  source: PresenceSource
  status: 'offline' | 'online'
  queuedMessageCount: number
}

export type PresenceEvent = {
  id: string
  sessionId: string
  kind: 'offline' | 'online'
  createdAt: number
  plannedEndAt: number
  source: PresenceSource
  queuedMessageCount: number
}

type PresenceResult = {
  changed: boolean
  becameOnline: boolean
  queuedMessageCount: number
  session: PresenceSession | null
}

const MAX_PRESENCE_EVENTS = 40

const getNextMessageId = (chat: any, preferred: number) => {
  const used = new Set((chat.messages || []).map((item: any) => Number(item.id)))
  let id = Math.max(1, Math.floor(preferred))
  while (used.has(id)) id += 1
  return id
}

export const formatPresenceDuration = (durationMs: number) => {
  const totalSeconds = Math.max(1, Math.round(durationMs / 1000))
  if (totalSeconds < 60) return `${totalSeconds} 秒`
  const totalMinutes = Math.round(totalSeconds / 60)
  if (totalMinutes < 60) return `${totalMinutes} 分钟`
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return minutes > 0 ? `${hours} 小时 ${minutes} 分钟` : `${hours} 小时`
}

const appendPresenceEvent = (
  chat: any,
  session: PresenceSession,
  kind: 'offline' | 'online',
  createdAt: number,
  queuedMessageCount = 0
) => {
  chat.presenceHistory = Array.isArray(chat.presenceHistory) ? chat.presenceHistory : []
  const eventId = `${session.id}:${kind}`
  const alreadyRecorded = chat.presenceHistory.some((item: PresenceEvent) => item?.id === eventId)
  if (alreadyRecorded) return false

  const event: PresenceEvent = {
    id: eventId,
    sessionId: session.id,
    kind,
    createdAt,
    plannedEndAt: session.plannedEndAt,
    source: session.source,
    queuedMessageCount
  }
  chat.presenceHistory.push(event)
  chat.presenceHistory = chat.presenceHistory.slice(-MAX_PRESENCE_EVENTS)

  chat.messages = Array.isArray(chat.messages) ? chat.messages : []
  const hasNotice = chat.messages.some((item: any) =>
    item?.systemKind === 'presence' && item?.presenceEventId === eventId
  )
  if (hasNotice) return true

  const name = chat.name || chat.realName || '对方'
  const content = kind === 'offline'
    ? `${name}已下线，预计 ${formatPresenceDuration(session.plannedEndAt - session.startedAt)}后上线`
    : `${name}已上线，本次离线 ${formatPresenceDuration(createdAt - session.startedAt)}${queuedMessageCount > 0 ? `，离线期间收到 ${queuedMessageCount} 条消息` : ''}`

  chat.messages.push({
    id: getNextMessageId(chat, createdAt),
    type: 'system',
    content,
    systemKind: 'presence',
    presenceEvent: kind,
    presenceEventId: eventId,
    presenceSessionId: session.id
  })
  return true
}

const getActiveSession = (chat: any): PresenceSession | null => {
  const session = chat?.presenceSession
  return session && session.status === 'offline' ? session as PresenceSession : null
}

const markQueuedMessagesDelivered = (chat: any, sessionId: string, deliveredAt: number) => {
  let delivered = 0
  for (const message of chat.messages || []) {
    if (message?.presenceSessionId !== sessionId || message?.presenceDeliveryStatus !== 'queued') continue
    message.presenceDeliveryStatus = 'delivered'
    message.presenceDeliveredAt = deliveredAt
    delivered += 1
  }
  return delivered
}

export const beginOfflinePresence = (
  chat: any,
  durationMs: number,
  requestedDuration: string,
  startedAt = Date.now(),
  source: PresenceSource = 'chat'
): PresenceResult => {
  if (!chat || !Number.isFinite(durationMs) || durationMs <= 0) {
    return { changed: false, becameOnline: false, queuedMessageCount: 0, session: null }
  }

  const current = getActiveSession(chat)
  if (current && current.plannedEndAt > startedAt) {
    current.plannedEndAt = startedAt + durationMs
    current.requestedDuration = requestedDuration
    chat.offlineUntil = current.plannedEndAt
    chat.statusSetAt = startedAt
    const offlineEvent = (chat.presenceHistory || []).find((item: PresenceEvent) => item?.id === `${current.id}:offline`)
    if (offlineEvent) offlineEvent.plannedEndAt = current.plannedEndAt
    const offlineNotice = (chat.messages || []).find((item: any) => item?.presenceEventId === `${current.id}:offline`)
    if (offlineNotice) {
      const name = chat.name || chat.realName || '对方'
      offlineNotice.content = `${name}已下线，预计 ${formatPresenceDuration(current.plannedEndAt - current.startedAt)}后上线`
    }
    return { changed: true, becameOnline: false, queuedMessageCount: 0, session: current }
  }

  const session: PresenceSession = {
    id: `presence_${startedAt}_${Math.random().toString(36).slice(2, 8)}`,
    startedAt,
    plannedEndAt: startedAt + durationMs,
    endedAt: 0,
    requestedDuration,
    source,
    status: 'offline',
    queuedMessageCount: 0
  }
  chat.presenceSession = session
  chat.offlineUntil = session.plannedEndAt
  chat.statusSource = source
  chat.statusSetAt = startedAt
  appendPresenceEvent(chat, session, 'offline', startedAt)
  return { changed: true, becameOnline: false, queuedMessageCount: 0, session }
}

export const queueMessageForPresence = (chat: any, message: any, now = Date.now()) => {
  if (!chat?.enableImmersiveStatus || Number(chat.offlineUntil || 0) <= now) return false
  let session = getActiveSession(chat)
  if (!session) {
    const startedAt = Number(chat.statusSetAt || now)
    session = beginOfflinePresence(
      chat,
      Number(chat.offlineUntil) - startedAt,
      formatPresenceDuration(Number(chat.offlineUntil) - startedAt),
      startedAt,
      chat.statusSource === 'autonomy' ? 'autonomy' : 'recovery'
    ).session
  }
  if (!session) return false
  message.presenceSessionId = session.id
  message.presenceDeliveryStatus = 'queued'
  message.presenceQueuedAt = now
  session.queuedMessageCount = (session.queuedMessageCount || 0) + 1
  return true
}

export const finishOfflinePresence = (chat: any, endedAt = Date.now()): PresenceResult => {
  const session = getActiveSession(chat)
  if (!session) {
    if (Number(chat?.offlineUntil || 0) > 0 && Number(chat.offlineUntil) <= endedAt) {
      chat.offlineUntil = 0
      return { changed: true, becameOnline: false, queuedMessageCount: 0, session: null }
    }
    return { changed: false, becameOnline: false, queuedMessageCount: 0, session: null }
  }

  const queuedMessageCount = markQueuedMessagesDelivered(chat, session.id, endedAt)
  session.status = 'online'
  session.endedAt = endedAt
  session.queuedMessageCount = queuedMessageCount
  chat.offlineUntil = 0
  if (session.source === 'autonomy') {
    if (chat.autonomyState?.status === 'offline') {
      chat.autonomyState.status = 'online'
      chat.autonomyState.statusSetAt = endedAt
      chat.autonomyState.statusSource = 'autonomy'
    }
    chat.statusText = ''
    chat.statusSource = ''
    chat.statusSetAt = 0
  } else if (chat.statusSource === 'chat' || chat.statusSource === 'recovery') {
    chat.statusSource = chat.statusText ? 'chat' : ''
    chat.statusSetAt = chat.statusText ? chat.statusSetAt : 0
  }
  appendPresenceEvent(chat, session, 'online', endedAt, queuedMessageCount)
  return { changed: true, becameOnline: true, queuedMessageCount, session }
}

export const reconcilePresence = (chat: any, now = Date.now()): PresenceResult => {
  if (isConversationTimePaused(chat)) return { changed: false, becameOnline: false, queuedMessageCount: 0, session: getActiveSession(chat) }
  if (!chat?.enableImmersiveStatus) {
    return { changed: false, becameOnline: false, queuedMessageCount: 0, session: null }
  }

  const offlineUntil = Number(chat.offlineUntil || 0)
  let session = getActiveSession(chat)
  let changed = false

  if (offlineUntil > now && !session) {
    const startedAt = Math.min(Number(chat.statusSetAt || now), offlineUntil - 1000)
    const recovered = beginOfflinePresence(
      chat,
      offlineUntil - startedAt,
      formatPresenceDuration(offlineUntil - startedAt),
      startedAt,
      chat.statusSource === 'autonomy' ? 'autonomy' : 'recovery'
    )
    session = recovered.session
    changed = recovered.changed
  }

  if (session && session.plannedEndAt <= now) return finishOfflinePresence(chat, now)
  if (!session && offlineUntil > 0 && offlineUntil <= now) {
    chat.offlineUntil = 0
    changed = true
  }

  return { changed, becameOnline: false, queuedMessageCount: 0, session }
}

export const buildPresenceContext = (chat: any, english = false) => {
  const events = Array.isArray(chat?.presenceHistory) ? chat.presenceHistory.slice(-6) as PresenceEvent[] : []
  if (events.length === 0) return ''
  const characterName = String(chat?.realName || chat?.name || (english ? 'current character' : '当前角色'))
  const lines = events.map(event => {
    const time = formatIdentityDateTime(chat, getConversationAdjustedTimestamp(chat, event.createdAt), undefined, { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })
    if (event.kind === 'offline') {
      const plannedTime = formatIdentityDateTime(chat, getConversationAdjustedTimestamp(chat, event.plannedEndAt), undefined, { hour: '2-digit', minute: '2-digit', hour12: false })
      return english ? `- ${time}: ${characterName} went offline and planned to return at ${plannedTime}.` : `- ${time}：角色${characterName}下线，计划于 ${plannedTime} 上线。`
    }
    return english
      ? `- ${time}: ${characterName} came back online${event.queuedMessageCount > 0 ? `; the current user sent ${event.queuedMessageCount} message(s) while ${characterName} was offline` : ''}.`
      : `- ${time}：角色${characterName}已上线${event.queuedMessageCount > 0 ? `；离线期间当前用户发来了 ${event.queuedMessageCount} 条消息` : ''}。`
  })
  return english
    ? `\n\n[Online and offline history]\nThese are status facts already executed by the system. Keep continuity and do not deny or invent a different presence history:\n${lines.join('\n')}`
    : `\n\n【角色${characterName}的上线与下线记录】\n以下是系统已经实际执行的状态事实，角色${characterName}保持连续记忆：\n${lines.join('\n')}`
}
