import localforage from 'localforage'
import { sendCapabilityMessage } from './api'
import { buildChatMessages } from '../composables/chatState/messages'
import { formatIdentityDateTime, isConversationTimePaused } from './conversationTime'
import { isChatContextVisible, mockChats } from '../composables/chatState/state'
import { useChatAuth } from '../composables/useChatAuth'
import { globalPromptSettings } from '../store'
import { beginOfflinePresence, finishOfflinePresence, reconcilePresence } from './presenceLifecycle'
import {
  AUTONOMY_HISTORY_LIMIT,
  ensureAutonomyPolicyDefaults,
  normalizeAutonomyIntervalMinutes,
  normalizeAutonomySilenceMinutes,
  pendingAutonomyLedgerWindow,
  type AutonomyLedgerWindow
} from './autonomyConfig'
import { flushAutonomyDeliveries, queueAutonomyDelivery } from './autonomyDelivery'
import { createFriendRequest, deliverCharacterMessage, ensureRelationship } from '../composables/useChatRelationship'
import { triggerFriendRequestNotification } from '../composables/useFriendRequestPrompt'
import { canCharacterRequestUser, loadUserSocialProfile } from './userSocialProfile'
import { ensureChatTimelineState, persistActiveTimeline } from './chatTimeline'
import { buildCharacterPhoneContext, buildPhoneReadObservation, executePhoneActionTags, markPhoneContextDelivered } from './characterPhone'

export type AutonomyEventType = 'message' | 'moment' | 'status' | 'friend_request' | 'phone' | 'idle' | 'error'
export type AutonomyEvent = {
  id: string
  type: AutonomyEventType
  createdAt: number
  title: string
  detail: string
  catchup?: boolean
  trigger?: 'scheduled' | 'resume' | 'manual'
  blockedReason?: string
}

type AutonomyAction = {
  type: 'message' | 'moment' | 'status' | 'friend_request' | 'phone'
  content?: string
  status?: 'online' | 'offline' | 'busy' | 'away'
  text?: string
  atOffsetMinutes?: number
  important?: boolean
  operation?: string
  appId?: string
  targetId?: string
}

type AutonomyDecision = {
  summary?: string
  nextCheckMinutes?: number
  actions?: AutonomyAction[]
  emotion?: string
  emotionIntensity?: number
  emotionNeedsDelivery?: boolean
}

export type AutonomyCheckResult = {
  executed: number
  summary: string
  preview: boolean
  actions: Array<AutonomyAction & { allowed: boolean; blockedReason?: string }>
}

const momentStore = localforage.createInstance({ name: 'nrt-app', storeName: 'discover_moments' })
const runningChats = new Set<string>()

const validPresenceStatuses = new Set(['online', 'offline', 'busy', 'away'])

const clearAutonomyPresence = (chat: any, clearShared = false) => {
  if (!chat.autonomyState || typeof chat.autonomyState !== 'object') chat.autonomyState = {}
  delete chat.autonomyState.status
  delete chat.autonomyState.statusSetAt
  delete chat.autonomyState.statusSource
  if (clearShared || chat.statusSource === 'autonomy') {
    chat.statusText = ''
    chat.offlineUntil = 0
    chat.presenceSession = null
    chat.presencePendingReply = false
    chat.statusSource = ''
    chat.statusSetAt = 0
  }
}

export const disableAutonomyPresence = (chat: any, clearShared = false) => {
  clearAutonomyPresence(chat, clearShared)
  persistAutonomyChat(chat)
}

export const ensureAutonomyDefaults = (chat: any) => {
  chat.autonomyEnabled ??= false
  chat.autonomyAllowMessages ??= true
  chat.autonomyAllowMoments ??= true
  if (chat.autonomyStatusPermissionExplicit !== true) chat.autonomyAllowStatus = false
  else chat.autonomyAllowStatus ??= false
  chat.autonomyCatchup ??= true
  chat.autonomyActiveStart ??= 8
  chat.autonomyActiveEnd ??= 24
  ensureAutonomyPolicyDefaults(chat)
  chat.autonomyHistory = Array.isArray(chat.autonomyHistory) ? chat.autonomyHistory : []
  if (!chat.autonomyState || typeof chat.autonomyState !== 'object') chat.autonomyState = {}
  const hasRecordedStatus = chat.autonomyHistory.some((event: AutonomyEvent) => event.type === 'status' && !event.blockedReason)
  if (!validPresenceStatuses.has(chat.autonomyState.status)) delete chat.autonomyState.status
  if (chat.autonomyState.status === 'offline' && !chat.autonomyState.statusSetAt && !hasRecordedStatus) {
    delete chat.autonomyState.status
  }
  if (chat.autonomyStatusPermissionExplicit !== true && (chat.autonomyState.status || hasRecordedStatus)) {
    clearAutonomyPresence(chat, true)
  }
  if (!chat.enableImmersiveStatus) clearAutonomyPresence(chat, true)
  return chat
}

const contactsKey = () => {
  const { currentChatUserId } = useChatAuth()
  return currentChatUserId.value ? `clingy_custom_contacts_${currentChatUserId.value}` : 'clingy_custom_contacts'
}

const AUTONOMY_PERSIST_FIELDS = [
  'autonomyEnabled', 'autonomyAllowMessages', 'autonomyAllowMoments', 'autonomyAllowStatus', 'autonomyStatusPermissionExplicit',
  'autonomyCatchup', 'autonomyActiveStart', 'autonomyActiveEnd', 'autonomyMinIntervalMinutes',
  'autonomyGuaranteeContact', 'autonomyMaxSilenceMinutes', 'autonomyEmotionMustDeliver', 'autonomyLastMeaningfulActionAt',
  'autonomyLedger', 'autonomyDeliveries',
  'autonomyHistory', 'autonomyState', 'messages', 'unread', 'preview', 'time', 'statusText', 'offlineUntil',
  'statusSource', 'statusSetAt', 'enableImmersiveStatus', 'presenceSession', 'presenceHistory', 'presencePendingReply',
  'timelineState', 'activeTimelineId'
] as const

type PendingAutonomyPersist = {
  chat: any
  accountId: string | null
}

let autonomyPersistBatchDepth = 0
const pendingAutonomyPersists = new Map<string, Map<string, PendingAutonomyPersist>>()

const applyAutonomyFields = (target: any, chat: any) => {
  AUTONOMY_PERSIST_FIELDS.forEach(field => { target[field] = chat[field] })
}

const queueAutonomyPersist = (key: string, chat: any, accountId: string | null) => {
  let pendingForKey = pendingAutonomyPersists.get(key)
  if (!pendingForKey) {
    pendingForKey = new Map()
    pendingAutonomyPersists.set(key, pendingForKey)
  }
  pendingForKey.set(String(chat.id), { chat, accountId })
}

const persistAutonomyEntries = (key: string, entries: PendingAutonomyPersist[]) => {
  if (!entries.length) return [] as PendingAutonomyPersist[]
  const saved = JSON.parse(localStorage.getItem(key) || '[]')
  if (!Array.isArray(saved)) throw new TypeError('联系人存储格式无效')
  const savedById = new Map(saved.map((item: any) => [String(item.id), item]))
  const persisted: PendingAutonomyPersist[] = []
  for (const entry of entries) {
    const target = savedById.get(String(entry.chat.id))
    if (!target) continue
    applyAutonomyFields(target, entry.chat)
    persisted.push(entry)
  }
  if (persisted.length) localStorage.setItem(key, JSON.stringify(saved))
  return persisted
}

const persistAutonomyTimelines = (entries: PendingAutonomyPersist[]) => {
  for (const entry of entries) {
    ensureChatTimelineState(entry.chat)
    void persistActiveTimeline(entry.chat, entry.accountId)
  }
}

export const beginAutonomyPersistenceBatch = () => {
  autonomyPersistBatchDepth += 1
}

export const flushAutonomyPersistenceBatch = () => {
  if (autonomyPersistBatchDepth > 0) autonomyPersistBatchDepth -= 1
  if (autonomyPersistBatchDepth > 0 || pendingAutonomyPersists.size === 0) return
  const batches = [...pendingAutonomyPersists.entries()]
  for (const [key, pending] of batches) {
    const persisted = persistAutonomyEntries(key, [...pending.values()])
    pendingAutonomyPersists.delete(key)
    persistAutonomyTimelines(persisted)
  }
}

export const persistAutonomyChat = (chat: any) => {
  const key = contactsKey()
  const { currentChatUserId } = useChatAuth()
  const accountId = currentChatUserId.value
  if (autonomyPersistBatchDepth > 0) {
    queueAutonomyPersist(key, chat, accountId)
    return
  }
  const persisted = persistAutonomyEntries(key, [{ chat, accountId }])
  persistAutonomyTimelines(persisted)
}

const addEvent = (chat: any, event: Omit<AutonomyEvent, 'id'>) => {
  ensureAutonomyDefaults(chat)
  chat.autonomyHistory.unshift({ ...event, id: `${event.createdAt}_${Math.random().toString(36).slice(2, 8)}` })
  chat.autonomyHistory = chat.autonomyHistory.slice(0, AUTONOMY_HISTORY_LIMIT)
}

const parseDecision = (raw: string): AutonomyDecision => {
  const cleaned = raw.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim()
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start < 0 || end <= start) throw new Error('角色自主决策返回格式不完整')
  return JSON.parse(cleaned.slice(start, end + 1))
}

const lastMeaningfulActionAt = (chat: any) => {
  return Number(chat.autonomyLastMeaningfulActionAt || Date.now())
}

const isWithinActiveHours = (chat: any, date = new Date()) => {
  const start = Number(chat.autonomyActiveStart ?? 8)
  const end = Number(chat.autonomyActiveEnd ?? 24)
  let hour = date.getHours()
  try {
    hour = Number(formatIdentityDateTime(chat, date.getTime(), undefined, { hour: '2-digit', hourCycle: 'h23' }))
  } catch (_) {}
  if (start === end) return true
  return start < end ? hour >= start && hour < end : hour >= start || hour < end
}

const addMoment = async (chat: any, content: string, createdAt: number) => {
  const { currentChatUserId } = useChatAuth()
  const key = currentChatUserId.value ? `moments_list_${currentChatUserId.value}` : 'moments_list'
  const moments = await momentStore.getItem<any[]>(key) || []
  moments.unshift({
    id: createdAt + Math.floor(Math.random() * 500),
    authorId: chat.id,
    author: chat.name,
    avatar: chat.avatarUrl || '',
    content,
    time: createdAt,
    visibility: '公开',
    likes: [],
    comments: [],
    notifications: [],
    source: 'autonomy',
    createdBy: 'character'
  })
  await momentStore.setItem(key, moments)
}

const actionTime = (now: number, action: AutonomyAction, elapsedMinutes: number, catchup: boolean) => {
  if (!catchup) return now
  const requested = Math.max(0, Number(action.atOffsetMinutes || 0))
  return now - Math.min(requested, elapsedMinutes) * 60000
}

const extractMessageContents = (raw: string) => {
  const cleaned = raw
    .replace(/```(?:json)?/gi, '')
    .replace(/```/g, '')
    .replace(/<thinking>[\s\S]*?<\/thinking>/gi, '')
    .trim()
  const tagged = [...cleaned.matchAll(/<msg(?:\s+[^>]*)?>([\s\S]*?)<\/msg>/gi)]
    .map(match => match[1].replace(/<quote\s+[^>]*>[\s\S]*?<\/quote>/gi, '').trim())
    .filter(Boolean)
  return tagged.length ? tagged : (cleaned ? [cleaned] : [])
}

const actionPermission = (chat: any, action: AutonomyAction) => {
  if (action.type === 'message' && !chat.autonomyAllowMessages) return '“主动给我发消息”未开启'
  if (action.type === 'message') {
    const relationship = ensureRelationship(chat)
    if (relationship.blockedBy === 'user') return '用户当前已拉黑角色'
    if (relationship.blockedBy === 'character') return '角色当前已拉黑用户'
    if (relationship.friendship !== 'friends') return '当前不是好友关系'
  }
  if (action.type === 'moment' && !chat.autonomyAllowMoments) return '“朋友圈活动”未开启'
  if (action.type === 'phone' && !chat.__characterPhoneBackgroundAllowed) return '角色手机的“后台活动允许角色使用手机”未开启'
  if (action.type === 'status' && !chat.enableImmersiveStatus) return '聊天设置中的“沉浸式状态与时间流逝”未开启'
  if (action.type === 'status' && !chat.autonomyAllowStatus) return '“上线与状态变化”未开启'
  if (action.type === 'friend_request') {
    const account = useChatAuth().currentAccount.value
    const relationship = ensureRelationship(chat)
    if (!account) return '当前没有登录账号'
    if (relationship.friendship === 'friends') return '当前已经是好友'
    const profile = loadUserSocialProfile(account)
    if (!canCharacterRequestUser(profile, { characterId: String(chat.characterEntityId || chat.id), isFriend: false, blocked: relationship.blockedBy !== 'none', hasChat: true })) return '用户未允许该角色发送好友申请'
    if (relationship.requests.some(request => request.direction === 'character_to_user' && ['scheduled', 'pending', 'viewed'].includes(request.status))) return '已有待处理的好友申请'
  }
  return ''
}

export const runAutonomousCheck = async (
  chat: any,
  reason: 'scheduled' | 'resume' | 'manual' = 'scheduled',
  options: { preview?: boolean; ledgerWindow?: AutonomyLedgerWindow | null } = {}
): Promise<AutonomyCheckResult | false> => {
  ensureAutonomyDefaults(chat)
  const chatKey = String(chat.id)
  const characterName = String(chat.realName || chat.name || '当前角色')
  if (!chat.autonomyEnabled || isConversationTimePaused(chat) || runningChats.has(chatKey) || chat.isTyping) return false
  if (reason !== 'manual' && !isWithinActiveHours(chat) && !options.ledgerWindow) return false

  const now = Date.now()
  const previous = Number(options.ledgerWindow?.startedAt || chat.autonomyState.lastCheckedAt || now)
  const elapsedMinutes = Math.max(0, Math.round((now - previous) / 60000))
  const minimum = normalizeAutonomyIntervalMinutes(chat.autonomyMinIntervalMinutes)
  const catchup = reason === 'resume' && chat.autonomyCatchup && elapsedMinutes >= minimum
  const silenceMinutes = Math.max(0, Math.round((now - lastMeaningfulActionAt(chat)) / 60000))
  const contactRequired = chat.autonomyGuaranteeContact
    && silenceMinutes >= normalizeAutonomySilenceMinutes(chat.autonomyMaxSilenceMinutes)
  const relationship = ensureRelationship(chat)
  const directMessageAvailable = chat.autonomyAllowMessages
    && relationship.friendship === 'friends'
    && relationship.blockedBy === 'none'
  const maxActions = catchup ? 8 : 3
  runningChats.add(chatKey)
  chat.autonomyState.running = true
  chat.autonomyState.lastError = ''
  persistAutonomyChat(chat)

  try {
    const messages = await buildChatMessages(chat, false, false, { includeCharacterPhone: false })
    const phoneContext = await buildCharacterPhoneContext(chat, useChatAuth().currentChatUserId.value || 'guest', { includeDashboard: true, mode: 'background' })
    chat.__characterPhoneBackgroundAllowed = Boolean(phoneContext.text)
    if (phoneContext.text) messages.push({ role: 'system', content: phoneContext.text })
    const account = useChatAuth().currentAccount.value
    const friendRequestAllowed = Boolean(account && !actionPermission(chat, { type: 'friend_request' }))
    const policyText = globalPromptSettings.language === 'en'
      ? `Minimum-contact guarantee: ${chat.autonomyGuaranteeContact ? `enabled; after ${normalizeAutonomySilenceMinutes(chat.autonomyMaxSilenceMinutes)} minutes of silence` : 'disabled'}. Current silence: about ${silenceMinutes} minutes. ${contactRequired ? 'The guarantee is due now: return at least one permitted action, preferably a sincere message.' : ''} Important-emotion delivery: ${chat.autonomyEmotionMustDeliver ? 'enabled; if there is a strong emotion the user should know, set emotionNeedsDelivery=true and include a direct message expressing it naturally' : 'disabled'}.`
      : `最低联系保障：${chat.autonomyGuaranteeContact ? `已开启，最长沉默 ${normalizeAutonomySilenceMinutes(chat.autonomyMaxSilenceMinutes)} 分钟` : '未开启'}；目前已沉默约 ${silenceMinutes} 分钟。${contactRequired ? '保障现已到期：必须至少给出一个获准动作，优先是一条真诚的直接消息。' : ''}重要情绪必达：${chat.autonomyEmotionMustDeliver ? '已开启；如果存在用户应该知道的强烈情绪，请令 emotionNeedsDelivery=true，并用一条自然的直接消息表达' : '未开启'}。`
    messages.push({
      role: 'system',
      content: globalPromptSettings.language === 'en'
        ? `[${characterName}'s autonomous activity]\nCurrent local time: ${formatIdentityDateTime(chat, now)}. About ${elapsedMinutes} minutes have passed since the last check. Trigger: ${reason}. ${catchup ? 'This is a complete local catch-up for the recorded closed-page window. Place plausible actions across the elapsed time without repetition.' : 'This is a normal check while the page is running.'}\nDecide whether ${characterName} genuinely wants to do anything now. Every returned action belongs to ${characterName}; this check does not imply that the user sent a new message. Proactive messages allowed: ${chat.autonomyAllowMessages ? 'yes' : 'no'}; Moments allowed: ${chat.autonomyAllowMoments ? 'yes' : 'no'}; status changes allowed: ${chat.enableImmersiveStatus && chat.autonomyAllowStatus ? 'yes' : 'no'}; friend request allowed: ${friendRequestAllowed ? 'yes' : 'no'}; own-phone activity allowed: ${chat.__characterPhoneBackgroundAllowed ? 'yes' : 'no'}. ${policyText} Follow ${characterName}'s persona, relationship, recent conversation, and any schedule or busyness disclosed by the user. Phone use is optional and should be ordinary rather than constant. Outside mandatory policies, silence is normal. Avoid mechanical greetings, time announcements, and explanations of these rules.\nReturn JSON only: {"summary":"one internal summary sentence","emotion":"current emotion","emotionIntensity":0,"emotionNeedsDelivery":false,"nextCheckMinutes":120,"actions":[{"type":"message|moment|status|friend_request|phone","content":"plain text without XML tags","status":"online|offline|busy|away","text":"status text","operation":"send_message|reply_contact|add_note|add_calendar_event|activity","appId":"phone app id","targetId":"contact or conversation id","atOffsetMinutes":0,"important":false}]}. actions may be empty unless a policy is due; at most ${maxActions}. nextCheckMinutes must be between ${minimum} and ${Math.max(720, minimum)}. During catch-up, atOffsetMinutes means how many minutes ago the action occurred and may not exceed ${elapsedMinutes}.`
        : `【角色${characterName}的自主活动】\n当前当地时间：${formatIdentityDateTime(chat, now)}。距离上次判断约 ${elapsedMinutes} 分钟。触发原因：${reason}。${catchup ? '这是记录到的页面关闭时间段的完整本地补演，应在经过时间内合理分布动作且避免重复。' : '这是页面运行期间的正常判断。'}\n判断角色${characterName}此刻是否真心想做些什么。所有返回动作都属于角色${characterName}；本次检查不代表用户刚刚发来了新消息。允许主动消息：${chat.autonomyAllowMessages ? '是' : '否'}；允许朋友圈：${chat.autonomyAllowMoments ? '是' : '否'}；允许状态变化：${chat.enableImmersiveStatus && chat.autonomyAllowStatus ? '是' : '否'}；允许好友申请：${friendRequestAllowed ? '是' : '否'}；允许使用自己的手机：${chat.__characterPhoneBackgroundAllowed ? '是' : '否'}。${policyText}遵循角色${characterName}的人设、关系、最近聊天内容和用户透露的忙碌或作息；手机活动是可选的普通生活行为，不要每次都使用。除强制保障外，沉默是正常选择。避免机械问候、报时或解释规则。\n只返回 JSON：{"summary":"一句内部摘要","emotion":"当前情绪","emotionIntensity":0,"emotionNeedsDelivery":false,"nextCheckMinutes":120,"actions":[{"type":"message|moment|status|friend_request|phone","content":"不含标签的纯文本内容","status":"online|offline|busy|away","text":"状态文案","operation":"send_message|reply_contact|add_note|add_calendar_event|activity","appId":"手机APP ID","targetId":"联系人或会话ID","atOffsetMinutes":0,"important":false}]}。actions 除保障到期外可以为空；最多 ${maxActions} 个；nextCheckMinutes 为 ${minimum} 到 ${Math.max(720, minimum)}。补演时 atOffsetMinutes 表示动作发生在多少分钟前，不能超过 ${elapsedMinutes}。`
    })
    if (chat.__characterPhoneBackgroundAllowed) messages.push({ role: 'system', content: 'phone 动作还可以使用 operation="read_app" 主动打开并查看 appId 指定的 APP；targetId 可写 unread 或具体会话 ID。只有角色此刻自然想查看时才使用，查看后系统会把发现保存为角色已知事实。' })
    const result: any = await sendCapabilityMessage('chat-auxiliary', messages)
    if (phoneContext.eventIds.length) await markPhoneContextDelivered(chat, useChatAuth().currentChatUserId.value || 'guest', phoneContext.eventIds, 'background')
    const rawDecision = typeof result === 'string' ? result : result.content
    let decision = parseDecision(rawDecision)
    let actions = Array.isArray(decision.actions)
      ? decision.actions.filter(action => action && typeof action.type === 'string').slice(0, maxActions)
      : []
    const importantEmotionDue = chat.autonomyEmotionMustDeliver
      && decision.emotionNeedsDelivery === true
      && Number(decision.emotionIntensity || 0) >= 2
      && directMessageAvailable
    const requiresMessage = (contactRequired && directMessageAvailable) || importantEmotionDue
    const hasExecutableAction = actions.some(action => {
      if (actionPermission(chat, action)) return false
      if (action.type === 'message' || action.type === 'moment') return Boolean(action.content?.trim())
      return action.type === 'status' && Boolean(action.status && validPresenceStatuses.has(action.status))
    })
    const missingRequiredMessage = requiresMessage && !actions.some(action => action.type === 'message' && action.content?.trim())
    const missingGuaranteedAction = contactRequired && !hasExecutableAction
    if (!options.preview && (missingRequiredMessage || missingGuaranteedAction)) {
      messages.push({ role: 'assistant', content: rawDecision })
      messages.push({
        role: 'system',
        content: globalPromptSettings.language === 'en'
          ? requiresMessage
            ? 'The required direct message is missing. Return the same JSON schema again with one sincere, persona-consistent message action. Do not mention this correction or the policy.'
            : 'The minimum-contact guarantee is due but no executable action was returned. Return the same JSON schema with at least one sincere permitted action. Do not mention this correction or the policy.'
          : requiresMessage
            ? '必达的直接消息缺失。请重新按同一 JSON 结构返回，并加入一条真诚、符合人设的 message 动作；不要提及修正过程或规则。'
            : '最低联系保障已经到期，但没有返回可执行动作。请重新按同一 JSON 结构返回，并加入至少一个真诚且已获准的动作；不要提及修正过程或规则。'
      })
      const repaired: any = await sendCapabilityMessage('chat-auxiliary', messages)
      decision = parseDecision(typeof repaired === 'string' ? repaired : repaired.content)
      actions = Array.isArray(decision.actions)
        ? decision.actions.filter(action => action && typeof action.type === 'string').slice(0, maxActions)
        : []
    }
    const previewActions = actions.map(action => {
      const blockedReason = actionPermission(chat, action)
      const previewContent = action.type === 'message' && action.content
        ? extractMessageContents(action.content).join('\n')
        : action.content
      return { ...action, content: previewContent, allowed: !blockedReason, blockedReason: blockedReason || undefined }
    })
    if (options.preview) {
      return { executed: 0, summary: decision.summary?.trim() || '', preview: true, actions: previewActions }
    }
    let executed = 0

    for (const action of actions) {
      const createdAt = actionTime(now, action, elapsedMinutes, catchup)
      const blockedReason = actionPermission(chat, action)
      if (blockedReason) {
        addEvent(chat, { type: action.type, createdAt, title: '动作已被权限拦截', detail: blockedReason, catchup, trigger: reason, blockedReason })
        continue
      }
      if (action.type === 'message' && action.content?.trim()) {
        const contents = extractMessageContents(action.content)
        if (!contents.length) continue
        chat.messages ||= []
        contents.forEach((content, messageIndex) => {
          const messageId = createdAt + messageIndex
          const important = action.important === true || importantEmotionDue
          const delivery = deliverCharacterMessage(chat, content, 'autonomy', { id: messageId, autonomyImportant: important })
          if (delivery === 'delivered') {
            queueAutonomyDelivery(chat, messageId, content, createdAt + messageIndex, important)
            addEvent(chat, { type: 'message', createdAt: createdAt + messageIndex, title: '主动发来消息', detail: content, catchup, trigger: reason })
          }
        })
        const content = contents[contents.length - 1]
        chat.preview = content
        chat.time = new Date(createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
        if (!isChatContextVisible(chat.id)) {
          chat.unread = (chat.unread || 0) + contents.length
        }
        flushAutonomyDeliveries([chat])
        chat.autonomyLastMeaningfulActionAt = now
        executed += contents.length
      } else if (action.type === 'friend_request' && action.content?.trim()) {
        const request = createFriendRequest(chat, 'character_to_user', action.content.trim())
        triggerFriendRequestNotification(chat, request)
        addEvent(chat, { type: 'friend_request', createdAt, title: '主动发送好友申请', detail: action.content.trim(), catchup, trigger: reason })
        chat.autonomyLastMeaningfulActionAt = now
        executed++
      } else if (action.type === 'moment' && action.content?.trim()) {
        await addMoment(chat, action.content.trim(), createdAt)
        addEvent(chat, { type: 'moment', createdAt, title: '发布了朋友圈', detail: action.content.trim(), catchup, trigger: reason })
        chat.autonomyLastMeaningfulActionAt = now
        executed++
      } else if (action.type === 'status' && action.status && validPresenceStatuses.has(action.status)) {
        chat.autonomyState.status = action.status
        chat.autonomyState.statusSetAt = createdAt
        chat.autonomyState.statusSource = 'autonomy'
        chat.statusText = action.text?.trim() || ({ online: '在线', offline: '离线', busy: '忙碌', away: '暂离' } as any)[action.status]
        chat.statusSource = 'autonomy'
        chat.statusSetAt = createdAt
        if (action.status === 'offline') {
          beginOfflinePresence(chat, 30 * 60000, '30m', createdAt, 'autonomy')
          reconcilePresence(chat, now)
        }
        else finishOfflinePresence(chat, createdAt)
        addEvent(chat, { type: 'status', createdAt, title: `状态变为${chat.statusText}`, detail: action.text?.trim() || '角色根据自己的安排改变了状态', catchup, trigger: reason })
        chat.autonomyLastMeaningfulActionAt = now
        executed++
      } else if (action.type === 'phone') {
        const operation = String(action.operation || 'activity').replace(/[^a-z_]/gi, '')
        const appId = String(action.appId || 'notes').replace(/[^a-zA-Z0-9_-]/g, '')
        const targetId = String(action.targetId || '').replace(/["'<>]/g, '')
        if (operation === 'read_app') {
          const observation = await buildPhoneReadObservation(chat, useChatAuth().currentChatUserId.value || 'guest', [{ appId, target: targetId || 'unread' }], 'background')
          if (observation.text) {
            addEvent(chat, { type: 'phone', createdAt, title: '查看了自己的手机', detail: `${appId}：${observation.text.replace(/\s+/g, ' ').slice(0, 240)}`, catchup, trigger: reason })
            executed++
          }
          continue
        }
        const result = await executePhoneActionTags(`<phone_action type="${operation}" app_id="${appId}" target_id="${targetId}">${action.content || ''}</phone_action>`, chat, useChatAuth().currentChatUserId.value || 'guest', 'background')
        if (result.handled) {
          addEvent(chat, { type: 'phone', createdAt, title: '使用了自己的手机', detail: `${appId}：${action.content || operation}`, catchup, trigger: reason })
          executed += result.handled
        }
      }
    }

    if (executed === 0 && !previewActions.some(action => action.blockedReason)) addEvent(chat, { type: 'idle', createdAt: now, title: '选择保持安静', detail: decision.summary?.trim() || '这次没有想做的事', catchup, trigger: reason })
    const requestedNextMinutes = Number(decision.nextCheckMinutes)
    const nextMinutes = Math.min(
      Math.max(720, minimum),
      Math.max(minimum, Number.isFinite(requestedNextMinutes) ? requestedNextMinutes : 120)
    )
    chat.autonomyState.lastCheckedAt = now
    chat.autonomyState.nextCheckAt = now + nextMinutes * 60000
    chat.autonomyState.lastSummary = decision.summary?.trim() || ''
    return { executed, summary: decision.summary?.trim() || '', preview: false, actions: previewActions }
  } catch (error: any) {
    chat.autonomyState.lastError = error?.message || '自主活动检查失败'
    chat.autonomyState.nextCheckAt = now + Math.max(5, normalizeAutonomyIntervalMinutes(chat.autonomyMinIntervalMinutes)) * 60000
    addEvent(chat, { type: 'error', createdAt: now, title: '本次活动检查失败', detail: chat.autonomyState.lastError })
    throw error
  } finally {
    chat.autonomyState.running = false
    persistAutonomyChat(chat)
    runningChats.delete(chatKey)
  }
}

export const runDueAutonomyChecks = async (reason: 'scheduled' | 'resume' = 'scheduled') => {
  const now = Date.now()
  for (const chat of mockChats.value.filter(item => item.id !== 1)) {
    ensureAutonomyDefaults(chat)
    if (!chat.autonomyEnabled) continue
    if (isConversationTimePaused(chat)) continue
    const ledgerWindow = reason === 'resume' ? pendingAutonomyLedgerWindow(chat) : null
    const due = Boolean(ledgerWindow) || !chat.autonomyState.nextCheckAt || chat.autonomyState.nextCheckAt <= now
    if (due) {
      try {
        if (ledgerWindow) {
          ledgerWindow.status = 'processing'
          ledgerWindow.attempts += 1
          persistAutonomyChat(chat)
        }
        const result = await runAutonomousCheck(chat, reason, { ledgerWindow })
        if (ledgerWindow && result) {
          ledgerWindow.status = 'completed'
          ledgerWindow.completedAt = Date.now()
          ledgerWindow.executed = result.executed
          ledgerWindow.summary = result.summary
          ledgerWindow.error = ''
          persistAutonomyChat(chat)
        } else if (ledgerWindow) {
          ledgerWindow.status = 'pending'
          persistAutonomyChat(chat)
        }
      } catch (error: any) {
        if (ledgerWindow) {
          ledgerWindow.status = 'failed'
          ledgerWindow.error = error?.message || '补演失败'
          persistAutonomyChat(chat)
        }
      }
    }
  }
  flushAutonomyDeliveries(mockChats.value).forEach(persistAutonomyChat)
}
