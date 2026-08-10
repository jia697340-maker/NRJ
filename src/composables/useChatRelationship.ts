/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { computed } from 'vue'
import { useChatAuth } from './useChatAuth'
import { mockChats } from './chatState/state'

export type FriendshipStatus = 'friends' | 'deleted_by_user' | 'deleted_by_character'
export type BlockedBy = 'none' | 'user' | 'character'
export type RequestStatus = 'scheduled' | 'pending' | 'viewed' | 'accepted' | 'rejected' | 'superseded'
export type RequestDirection = 'character_to_user' | 'user_to_character'
export type RelationPlanAction = 'send_request' | 'unblock_user' | 'reconsider' | 'none'

export interface RelationshipEvent {
  id: string
  type: string
  title: string
  detail?: string
  createdAt: number
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
}

export interface ChatRelationship {
  friendship: FriendshipStatus
  blockedBy: BlockedBy
  changedAt: number
  blockedMessages: Array<{ id: number; content: string; createdAt: number; viewed: boolean }>
  undeliveredUserMessages: Array<{ id: number; content: string; createdAt: number }>
  requests: FriendRequestRecord[]
  events: RelationshipEvent[]
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
  plan: { action: 'none', summary: '目前没有新的打算', visibility: 'exact' }
})

export const ensureRelationship = (chat: any): ChatRelationship => {
  if (!chat.relationship) chat.relationship = createDefaultRelationship()
  chat.relationship.blockedMessages ||= []
  chat.relationship.undeliveredUserMessages ||= []
  chat.relationship.requests ||= []
  chat.relationship.events ||= []
  chat.relationship.plan ||= createDefaultRelationship().plan
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
  if (Array.isArray(chat.messages)) contacts[index].messages = chat.messages
  if (chat.preview !== undefined) contacts[index].preview = chat.preview
  if (chat.time !== undefined) contacts[index].time = chat.time
  localStorage.setItem(key, JSON.stringify(contacts))
}

export const appendRelationshipEvent = (chat: any, type: string, title: string, detail = '') => {
  const relationship = ensureRelationship(chat)
  relationship.events.unshift({ id: nowId('event'), type, title, detail, createdAt: Date.now() })
  relationship.events = relationship.events.slice(0, 100)
  relationship.changedAt = Date.now()
  persistRelationship(chat)
}

export const setRelationshipPlan = (chat: any, plan: Partial<RelationshipPlan>) => {
  const relationship = ensureRelationship(chat)
  relationship.plan = {
    action: plan.action || 'none',
    summary: plan.summary || '目前没有新的打算',
    executeAt: plan.executeAt,
    reviewAt: plan.reviewAt,
    visibility: plan.visibility || 'exact'
  }
  persistRelationship(chat)
}

export const blockCharacter = (chat: any) => {
  const relationship = ensureRelationship(chat)
  relationship.blockedBy = 'user'
  appendRelationshipEvent(chat, 'user_blocked', '你拉黑了对方', '之后收到的消息将默认隐藏。')
}

export const unblockCharacter = (chat: any) => {
  const relationship = ensureRelationship(chat)
  relationship.blockedBy = 'none'
  appendRelationshipEvent(chat, 'user_unblocked', '你将对方移出黑名单')
}

export const characterBlocksUser = (chat: any, detail = '') => {
  const relationship = ensureRelationship(chat)
  relationship.blockedBy = 'character'
  appendRelationshipEvent(chat, 'character_blocked', '对方拉黑了你', detail)
}

export const characterUnblocksUser = (chat: any) => {
  const relationship = ensureRelationship(chat)
  relationship.blockedBy = 'none'
  appendRelationshipEvent(chat, 'character_unblocked', '对方将你移出了黑名单')
}

export const deleteFriendByUser = (chat: any) => {
  const relationship = ensureRelationship(chat)
  relationship.friendship = 'deleted_by_user'
  appendRelationshipEvent(chat, 'user_deleted_friend', '你删除了好友', '角色档案和聊天记录仍会保留。')
}

export const deleteFriendByCharacter = (chat: any, detail = '') => {
  const relationship = ensureRelationship(chat)
  relationship.friendship = 'deleted_by_character'
  appendRelationshipEvent(chat, 'character_deleted_friend', '对方删除了你', detail)
}

export const restoreFriendship = (chat: any, actor: 'user' | 'character') => {
  const relationship = ensureRelationship(chat)
  relationship.friendship = 'friends'
  relationship.requests.forEach(request => {
    if (request.status === 'pending' || request.status === 'viewed') request.status = 'superseded'
  })
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
        request.status = 'pending'
        request.sentAt = now
        changed = true
        relationship.events.unshift({ id: nowId('event'), type: 'request_sent', title: '对方向你发送了好友申请', detail: request.message, createdAt: now })
      }
    })
    if (relationship.plan.executeAt && relationship.plan.executeAt <= now) {
      if (relationship.plan.action === 'unblock_user' && relationship.blockedBy === 'character') {
        relationship.blockedBy = 'none'
        relationship.events.unshift({ id: nowId('event'), type: 'character_unblocked', title: '对方将你移出了黑名单', createdAt: now })
      }
      relationship.plan = { action: 'none', summary: '计划已经执行', visibility: 'exact' }
      changed = true
    }
    if (relationship.plan.reviewAt && relationship.plan.reviewAt <= now) {
      relationship.plan.reviewAt = undefined
      dueReviews.push(chat)
      changed = true
    }
    if (changed) persistRelationship(chat)
  })
  return dueReviews
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

export const addUndeliveredUserMessage = (chat: any, content: string) => {
  const relationship = ensureRelationship(chat)
  relationship.undeliveredUserMessages.push({ id: Date.now(), content, createdAt: Date.now() })
  appendRelationshipEvent(chat, 'undelivered_message', '你发送了一条未送达消息', '对方当前看不到这条消息。')
}

export const formatRelationshipPlan = (relationship: ChatRelationship) => {
  const plan = relationship.plan
  if (plan.visibility === 'hidden') return '对方暂时不愿透露后续打算'
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
