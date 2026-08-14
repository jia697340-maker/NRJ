/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { computed } from 'vue'
import { useChatAuth } from './useChatAuth'
import { mockChats } from './chatState/state'
import { ensureMemoryState } from '../services/memoryEngine'

export type FriendshipStatus = 'friends' | 'strangers' | 'deleted_by_user' | 'deleted_by_character'
export type BlockedBy = 'none' | 'user' | 'character'
export type RequestStatus = 'scheduled' | 'pending' | 'viewed' | 'accepted' | 'rejected' | 'superseded'
export type RequestDirection = 'character_to_user' | 'user_to_character'
export type RelationPlanAction = 'send_request' | 'block_user' | 'unblock_user' | 'delete_friend' | 'accept_request' | 'reject_request' | 'reconsider' | 'none'
export type RelationPlanStatus = 'active' | 'paused' | 'running' | 'completed' | 'failed' | 'cancelled'

export interface RelationshipEvent {
  id: string
  type: string
  title: string
  detail?: string
  createdAt: number
  memoryRelevant?: boolean
}

export interface FriendRequestRecord {
  id: string
  direction: RequestDirection
  message: string
  status: RequestStatus
  createdAt: number
  scheduledAt?: number
  sentAt?: number
  viewedAt?: number
  respondedAt?: number
  rejectionReason?: string
}

export interface RelationshipPlan {
  action: RelationPlanAction
  summary: string
  executeAt?: number
  reviewAt?: number
  visibility: 'exact' | 'vague' | 'hidden'
  status?: RelationPlanStatus
  remainingMs?: number
  requestId?: string
  requestMessage?: string
  rejectionReason?: string
  lastError?: string
  retryCount?: number
}

export interface ChatRelationship {
  friendship: FriendshipStatus
  blockedBy: BlockedBy
  changedAt: number
  stateChangedAt?: number
  lastEventAt?: number
  blockedMessages: Array<{ id: number; content: string; createdAt: number; viewed: boolean }>
  undeliveredUserMessages: Array<{ id: number; content: string; createdAt: number }>
  requests: FriendRequestRecord[]
  events: RelationshipEvent[]
  disclosedLinkedAccountIds: string[]
  plan: RelationshipPlan
}

const nowId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

export const createDefaultRelationship = (): ChatRelationship => ({
  friendship: 'friends',
  blockedBy: 'none',
  changedAt: Date.now(),
  blockedMessages: [],
  undeliveredUserMessages: [],
  requests: [],
  events: [],
  disclosedLinkedAccountIds: [],
  plan: { action: 'none', summary: '目前没有新的打算', visibility: 'exact', status: 'completed' }
})

export const ensureRelationship = (chat: any): ChatRelationship => {
  if (!chat.relationship) chat.relationship = createDefaultRelationship()
  chat.relationship.blockedMessages ||= []
  chat.relationship.undeliveredUserMessages ||= []
  chat.relationship.requests ||= []
  chat.relationship.events ||= []
  chat.relationship.disclosedLinkedAccountIds ||= []
  chat.relationship.plan ||= createDefaultRelationship().plan
  chat.relationship.stateChangedAt ||= chat.relationship.changedAt || Date.now()
  chat.relationship.lastEventAt ||= chat.relationship.changedAt || Date.now()
  chat.relationship.plan.status ||= (chat.relationship.plan.reviewAt || chat.relationship.plan.executeAt) ? 'active' : 'completed'
  return chat.relationship as ChatRelationship
}

const getContactsKey = () => {
  const { currentChatUserId } = useChatAuth()
  return currentChatUserId.value ? `clingy_custom_contacts_${currentChatUserId.value}` : 'clingy_custom_contacts'
}

export const persistRelationship = (chat: any) => {
  if (!chat || chat.id === 1) return
  const key = getContactsKey()
  const saved = localStorage.getItem(key)
  if (!saved) return
  const contacts = JSON.parse(saved)
  const index = contacts.findIndex((item: any) => item.id === chat.id)
  if (index === -1) return
  contacts[index].relationship = JSON.parse(JSON.stringify(ensureRelationship(chat)))
  contacts[index].contactState = ensureRelationship(chat).friendship === 'friends' ? 'friend' : (contacts[index].contactState || 'candidate')
  if (chat.memoryState !== undefined) contacts[index].memoryState = JSON.parse(JSON.stringify(chat.memoryState))
  if (Array.isArray(chat.messages)) contacts[index].messages = chat.messages
  if (chat.preview !== undefined) contacts[index].preview = chat.preview
  if (chat.time !== undefined) contacts[index].time = chat.time
  localStorage.setItem(key, JSON.stringify(contacts))
}

const memoryRelevantEventTypes = new Set([
  'user_blocked', 'user_unblocked', 'character_blocked', 'character_unblocked',
  'user_deleted_friend', 'character_deleted_friend', 'friendship_restored', 'request_rejected'
])

const appendRelationshipMemory = (chat: any, event: RelationshipEvent) => {
  if (!event.memoryRelevant) return
  const state = ensureMemoryState(chat)
  const id = `relationship_event_${event.id}`
  if (state.tableRows.some(item => item.id === id)) return
  state.tableRows.push({
    id,
    table: 'relationships',
    title: event.title,
    value: event.detail || event.title,
    status: '有效',
    time: new Date(event.createdAt).toLocaleString('zh-CN'),
    tags: ['好友关系', event.type],
    importance: 4,
    evidence: { messageIds: [], excerpt: event.detail || event.title },
    createdAt: event.createdAt,
    updatedAt: event.createdAt,
    sourceEventId: event.id
  } as any)
}

const markRelationshipStateChanged = (chat: any) => {
  const relationship = ensureRelationship(chat)
  relationship.stateChangedAt = Date.now()
  relationship.changedAt = relationship.stateChangedAt
}

export const appendRelationshipEvent = (chat: any, type: string, title: string, detail = '', memoryRelevant = memoryRelevantEventTypes.has(type)) => {
  const relationship = ensureRelationship(chat)
  const event: RelationshipEvent = { id: nowId('event'), type, title, detail, createdAt: Date.now(), memoryRelevant }
  relationship.events.unshift(event)
  relationship.events = relationship.events.slice(0, 100)
  relationship.lastEventAt = event.createdAt
  appendRelationshipMemory(chat, event)
  persistRelationship(chat)
  return event
}

export const setRelationshipPlan = (chat: any, plan: Partial<RelationshipPlan>) => {
  const relationship = ensureRelationship(chat)
  relationship.plan = {
    action: plan.action || 'none',
    summary: plan.summary || '目前没有新的打算',
    executeAt: plan.executeAt,
    reviewAt: plan.reviewAt,
    visibility: plan.visibility || 'exact',
    status: plan.status || ((plan.executeAt || plan.reviewAt) ? 'active' : 'completed'),
    remainingMs: plan.remainingMs,
    requestId: plan.requestId,
    requestMessage: plan.requestMessage,
    rejectionReason: plan.rejectionReason,
    lastError: plan.lastError,
    retryCount: plan.retryCount || 0
  }
  persistRelationship(chat)
}

export const blockCharacter = (chat: any) => {
  const relationship = ensureRelationship(chat)
  relationship.blockedBy = 'user'
  markRelationshipStateChanged(chat)
  appendRelationshipEvent(chat, 'user_blocked', '你拉黑了对方', '之后收到的消息将默认隐藏。')
}

export const unblockCharacter = (chat: any) => {
  const relationship = ensureRelationship(chat)
  relationship.blockedBy = 'none'
  markRelationshipStateChanged(chat)
  appendRelationshipEvent(chat, 'user_unblocked', '你将对方移出黑名单')
}

export const characterBlocksUser = (chat: any, detail = '') => {
  const relationship = ensureRelationship(chat)
  relationship.blockedBy = 'character'
  markRelationshipStateChanged(chat)
  appendRelationshipEvent(chat, 'character_blocked', '对方拉黑了你', detail)
}

export const characterUnblocksUser = (chat: any) => {
  const relationship = ensureRelationship(chat)
  relationship.blockedBy = 'none'
  markRelationshipStateChanged(chat)
  appendRelationshipEvent(chat, 'character_unblocked', '对方将你移出了黑名单')
}

export const deleteFriendByUser = (chat: any) => {
  const relationship = ensureRelationship(chat)
  relationship.friendship = 'deleted_by_user'
  markRelationshipStateChanged(chat)
  appendRelationshipEvent(chat, 'user_deleted_friend', '你删除了好友', '角色档案和聊天记录仍会保留。')
}

export const deleteFriendByCharacter = (chat: any, detail = '') => {
  const relationship = ensureRelationship(chat)
  relationship.friendship = 'deleted_by_character'
  markRelationshipStateChanged(chat)
  appendRelationshipEvent(chat, 'character_deleted_friend', '对方删除了你', detail)
}

export const restoreFriendship = (chat: any, actor: 'user' | 'character') => {
  const relationship = ensureRelationship(chat)
  relationship.friendship = 'friends'
  chat.contactState = 'friend'
  relationship.requests.forEach(request => {
    if (request.status === 'scheduled' || request.status === 'pending' || request.status === 'viewed') request.status = 'superseded'
  })
  relationship.plan = { action: 'none', summary: '好友关系已经恢复', visibility: 'exact', status: 'completed' }
  markRelationshipStateChanged(chat)
  appendRelationshipEvent(chat, 'friendship_restored', actor === 'user' ? '你同意了好友申请' : '对方同意了好友申请')
}

export const createFriendRequest = (
  chat: any,
  direction: RequestDirection,
  message: string,
  scheduledAt?: number
) => {
  const relationship = ensureRelationship(chat)
  relationship.requests.forEach(request => {
    if (request.direction === direction && ['scheduled', 'pending', 'viewed'].includes(request.status)) {
      request.status = 'superseded'
    }
  })
  const request: FriendRequestRecord = {
    id: nowId('request'),
    direction,
    message: message.trim() || (direction === 'user_to_character' ? '请求添加你为好友' : '想重新加你为好友'),
    status: scheduledAt && scheduledAt > Date.now() ? 'scheduled' : 'pending',
    createdAt: Date.now(),
    scheduledAt,
    sentAt: scheduledAt && scheduledAt > Date.now() ? undefined : Date.now()
  }
  relationship.requests.unshift(request)
  appendRelationshipEvent(
    chat,
    'request_created',
    request.status === 'scheduled'
      ? '对方安排了下一次好友申请'
      : (direction === 'user_to_character' ? '你发送了好友申请' : '对方向你发送了好友申请'),
    request.message
  )
  return request
}

export const processDueRelationshipTimers = () => {
  const dueReviews: any[] = []
  const now = Date.now()
  mockChats.value.forEach(chat => {
    if (chat.id === 1 || !chat.relationship) return
    const relationship = ensureRelationship(chat)
    let changed = false
    relationship.requests.forEach(request => {
      if (request.status === 'scheduled' && request.scheduledAt && request.scheduledAt <= now) {
        request.status = relationship.friendship === 'friends' ? 'superseded' : 'pending'
        if (request.status === 'pending') request.sentAt = now
        changed = true
        if (request.status === 'pending') relationship.events.unshift({ id: nowId('event'), type: 'request_sent', title: '对方向你发送了好友申请', detail: request.message, createdAt: now })
      }
    })
    const plan = relationship.plan
    if (plan.status === 'active' && plan.executeAt && plan.executeAt <= now) {
      const request = plan.requestId ? relationship.requests.find(item => item.id === plan.requestId) : undefined
      if (plan.action === 'unblock_user' && relationship.blockedBy === 'character') characterUnblocksUser(chat)
      else if (plan.action === 'block_user') characterBlocksUser(chat)
      else if (plan.action === 'delete_friend') deleteFriendByCharacter(chat)
      else if (plan.action === 'send_request' && relationship.friendship !== 'friends') createFriendRequest(chat, 'character_to_user', plan.requestMessage || '想重新加你为好友')
      else if (plan.action === 'accept_request' && request) acceptFriendRequest(chat, request)
      else if (plan.action === 'reject_request' && request) rejectFriendRequest(chat, request, plan.rejectionReason || '')
      relationship.plan = { action: 'none', summary: '计划已经执行', visibility: plan.visibility, status: 'completed' }
      changed = true
    }
    if (plan.status === 'active' && plan.reviewAt && plan.reviewAt <= now) {
      plan.status = 'running'
      dueReviews.push(chat)
      changed = true
    }
    if (changed) persistRelationship(chat)
  })
  return dueReviews
}

export const pauseRelationshipPlan = (chat: any) => {
  const relationship = ensureRelationship(chat)
  const plan = relationship.plan
  if (plan.status !== 'active') return false
  const targetAt = plan.reviewAt || plan.executeAt
  if (!targetAt) return false
  plan.remainingMs = Math.max(60000, targetAt - Date.now())
  plan.status = 'paused'
  persistRelationship(chat)
  return true
}

export const resumeRelationshipPlan = (chat: any) => {
  const relationship = ensureRelationship(chat)
  const plan = relationship.plan
  if (plan.status !== 'paused') return false
  const targetAt = Date.now() + Math.max(60000, Number(plan.remainingMs || 60000))
  if (plan.action === 'reconsider') plan.reviewAt = targetAt
  else plan.executeAt = targetAt
  plan.remainingMs = undefined
  plan.status = 'active'
  persistRelationship(chat)
  return true
}

export const rescheduleRelationshipPlan = (chat: any, minutes: number) => {
  const relationship = ensureRelationship(chat)
  const plan = relationship.plan
  const duration = Math.max(1, Math.round(Number(minutes) || 1)) * 60000
  if (plan.status === 'paused') plan.remainingMs = duration
  else {
    if (plan.action === 'reconsider') plan.reviewAt = Date.now() + duration
    else plan.executeAt = Date.now() + duration
    plan.status = 'active'
  }
  persistRelationship(chat)
}

export const cancelRelationshipPlan = (chat: any) => {
  const relationship = ensureRelationship(chat)
  relationship.plan = { action: 'none', summary: '已取消后续计划', visibility: 'exact', status: 'cancelled' }
  persistRelationship(chat)
}

export const markRelationshipPlanRetry = (chat: any, error: string) => {
  const relationship = ensureRelationship(chat)
  const retryCount = Number(relationship.plan.retryCount || 0) + 1
  relationship.plan.status = 'active'
  relationship.plan.reviewAt = Date.now() + Math.min(15, 2 ** retryCount) * 60000
  relationship.plan.lastError = error
  relationship.plan.retryCount = retryCount
  persistRelationship(chat)
}

export const deleteRelationshipEvents = (chat: any, ids: string[], forgetMemory = false) => {
  const relationship = ensureRelationship(chat)
  const idSet = new Set(ids)
  relationship.events = relationship.events.filter(event => !idSet.has(event.id))
  if (forgetMemory && chat.memoryState) {
    const memoryIds = new Set(ids.map(id => `relationship_event_${id}`))
    chat.memoryState.tableRows = (chat.memoryState.tableRows || []).filter((item: any) => !memoryIds.has(item.id) && !idSet.has(item.sourceEventId))
  }
  persistRelationship(chat)
}

export const formatRecentRelationshipHistory = (chat: any, limit = 5) => {
  const relationship = ensureRelationship(chat)
  const events = relationship.events.filter(event => event.memoryRelevant).slice(0, limit)
  if (!events.length) return ''
  return events.map(event => `- ${new Date(event.createdAt).toLocaleString('zh-CN')}：${event.title}${event.detail ? `（${event.detail}）` : ''}`).join('\n')
}

export const markRequestViewed = (chat: any, request: FriendRequestRecord) => {
  if (request.status !== 'pending') return
  request.status = 'viewed'
  request.viewedAt = Date.now()
  appendRelationshipEvent(chat, 'request_viewed', request.direction === 'character_to_user' ? '你查看了好友申请' : '对方查看了你的申请')
}

export const rejectFriendRequest = (chat: any, request: FriendRequestRecord, reason = '') => {
  request.status = 'rejected'
  request.respondedAt = Date.now()
  request.rejectionReason = reason.trim()
  appendRelationshipEvent(chat, 'request_rejected', request.direction === 'character_to_user' ? '你拒绝了好友申请' : '对方拒绝了你的申请', reason)
}

export const acceptFriendRequest = (chat: any, request: FriendRequestRecord) => {
  request.status = 'accepted'
  request.respondedAt = Date.now()
  restoreFriendship(chat, request.direction === 'character_to_user' ? 'user' : 'character')
}

export const addBlockedCharacterMessage = (chat: any, content: string) => {
  const relationship = ensureRelationship(chat)
  relationship.blockedMessages.push({ id: Date.now(), content, createdAt: Date.now(), viewed: false })
  appendRelationshipEvent(chat, 'blocked_message', '对方在黑名单期间尝试发来消息', '消息已隐藏，可由你决定是否查看。')
}

export const deliverCharacterMessage = (
  chat: any,
  content: string,
  source: 'relationship' | 'autonomy' | 'chat' = 'chat',
  options: { id?: number; autonomyImportant?: boolean } = {}
) => {
  const relationship = ensureRelationship(chat)
  if (relationship.blockedBy === 'user') {
    addBlockedCharacterMessage(chat, content)
    return 'blocked' as const
  }
  if (source === 'autonomy' && (relationship.friendship !== 'friends' || relationship.blockedBy === 'character')) {
    appendRelationshipEvent(chat, 'suppressed_autonomy_message', '一条主动消息因当前关系未送达', '', false)
    return 'suppressed' as const
  }
  if (source === 'relationship' && relationship.friendship !== 'friends') {
    appendRelationshipEvent(chat, 'relationship_message', '对方有一条关系消息', content, false)
    return 'timeline' as const
  }
  chat.messages ||= []
  const message = { id: options.id || Date.now(), type: 'left', content, relationshipMessage: source === 'relationship', messageOrigin: source, isAutonomous: source === 'autonomy', autonomyImportant: options.autonomyImportant === true }
  chat.messages.push(message)
  chat.preview = content
  persistRelationship(chat)
  return 'delivered' as const
}

export const addUndeliveredUserMessage = (chat: any, content: string) => {
  const relationship = ensureRelationship(chat)
  relationship.undeliveredUserMessages.push({ id: Date.now(), content, createdAt: Date.now() })
  appendRelationshipEvent(chat, 'undelivered_message', '你发送了一条未送达消息', '对方当前看不到这条消息。')
}

export const formatRelationshipPlan = (relationship: ChatRelationship) => {
  const plan = relationship.plan
  if (plan.visibility === 'hidden') return '对方暂时不愿透露后续打算'
  if (plan.status === 'paused') {
    const minutes = Math.max(1, Math.ceil(Number(plan.remainingMs || 0) / 60000))
    return `${plan.summary} · 已暂停（剩余约 ${minutes} 分钟）`
  }
  if (plan.status === 'failed') return `${plan.summary} · 等待重试`
  if (plan.executeAt) {
    const delta = plan.executeAt - Date.now()
    if (delta <= 0) return '计划时间已到，等待执行'
    const minutes = Math.max(1, Math.ceil(delta / 60000))
    return plan.visibility === 'vague' ? '对方打算过一阵再行动' : `${plan.summary} · 约 ${minutes} 分钟后`
  }
  if (plan.reviewAt) {
    const delta = plan.reviewAt - Date.now()
    if (delta <= 0) return '正在重新考虑下一步'
    const minutes = Math.max(1, Math.ceil(delta / 60000))
    return plan.visibility === 'vague' ? '对方会过一阵重新考虑' : `${plan.summary} · 约 ${minutes} 分钟后重新考虑`
  }
  return plan.summary
}

export function useChatRelationship() {
  const allRequests = computed(() => mockChats.value.flatMap(chat => {
    const relationship = ensureRelationship(chat)
    return relationship.requests.map(request => ({ chat, request }))
  }).sort((a, b) => b.request.createdAt - a.request.createdAt))

  return { allRequests }
}
