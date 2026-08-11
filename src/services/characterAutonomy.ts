import localforage from 'localforage'
import { sendChatMessage } from './api'
import { buildChatMessages } from '../composables/chatState/messages'
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

export type AutonomyEventType = 'message' | 'moment' | 'status' | 'idle' | 'error'
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
  type: 'message' | 'moment' | 'status'
  content?: string
  status?: 'online' | 'offline' | 'busy' | 'away'
  text?: string
  atOffsetMinutes?: number
  important?: boolean
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

export const persistAutonomyChat = (chat: any) => {
  const key = contactsKey()
  const saved = JSON.parse(localStorage.getItem(key) || '[]')
  const index = saved.findIndex((item: any) => String(item.id) === String(chat.id))
  if (index < 0) return
  const fields = [
    'autonomyEnabled', 'autonomyAllowMessages', 'autonomyAllowMoments', 'autonomyAllowStatus', 'autonomyStatusPermissionExplicit',
    'autonomyCatchup', 'autonomyActiveStart', 'autonomyActiveEnd', 'autonomyMinIntervalMinutes',
    'autonomyGuaranteeContact', 'autonomyMaxSilenceMinutes', 'autonomyEmotionMustDeliver', 'autonomyLastMeaningfulActionAt',
    'autonomyLedger', 'autonomyDeliveries',
    'autonomyHistory', 'autonomyState', 'messages', 'unread', 'preview', 'time', 'statusText', 'offlineUntil',
    'statusSource', 'statusSetAt', 'enableImmersiveStatus', 'presenceSession', 'presenceHistory', 'presencePendingReply'
  ]
  fields.forEach(field => { saved[index][field] = chat[field] })
  localStorage.setItem(key, JSON.stringify(saved))
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
    hour = Number(new Intl.DateTimeFormat('en-US', {
      timeZone: chat.timezone || undefined,
      hour: '2-digit',
      hourCycle: 'h23'
    }).format(date))
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
    notifications: []
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
  if (action.type === 'moment' && !chat.autonomyAllowMoments) return '“朋友圈活动”未开启'
  if (action.type === 'status' && !chat.enableImmersiveStatus) return '聊天设置中的“沉浸式状态与时间流逝”未开启'
  if (action.type === 'status' && !chat.autonomyAllowStatus) return '“上线与状态变化”未开启'
  return ''
}

export const runAutonomousCheck = async (
  chat: any,
  reason: 'scheduled' | 'resume' | 'manual' = 'scheduled',
  options: { preview?: boolean; ledgerWindow?: AutonomyLedgerWindow | null } = {}
): Promise<AutonomyCheckResult | false> => {
  ensureAutonomyDefaults(chat)
  const chatKey = String(chat.id)
  if (!chat.autonomyEnabled || runningChats.has(chatKey) || chat.isTyping) return false
  if (reason !== 'manual' && !isWithinActiveHours(chat) && !options.ledgerWindow) return false

  const now = Date.now()
  const previous = Number(options.ledgerWindow?.startedAt || chat.autonomyState.lastCheckedAt || now)
  const elapsedMinutes = Math.max(0, Math.round((now - previous) / 60000))
  const minimum = normalizeAutonomyIntervalMinutes(chat.autonomyMinIntervalMinutes)
  const catchup = reason === 'resume' && chat.autonomyCatchup && elapsedMinutes >= minimum
  const silenceMinutes = Math.max(0, Math.round((now - lastMeaningfulActionAt(chat)) / 60000))
  const contactRequired = chat.autonomyGuaranteeContact
    && silenceMinutes >= normalizeAutonomySilenceMinutes(chat.autonomyMaxSilenceMinutes)
  const maxActions = catchup ? 8 : 3
  runningChats.add(chatKey)
  chat.autonomyState.running = true
  chat.autonomyState.lastError = ''
  persistAutonomyChat(chat)

  try {
    const messages = await buildChatMessages(chat)
    const policyText = globalPromptSettings.language === 'en'
      ? `Minimum-contact guarantee: ${chat.autonomyGuaranteeContact ? `enabled; after ${normalizeAutonomySilenceMinutes(chat.autonomyMaxSilenceMinutes)} minutes of silence` : 'disabled'}. Current silence: about ${silenceMinutes} minutes. ${contactRequired ? 'The guarantee is due now: return at least one permitted action, preferably a sincere message.' : ''} Important-emotion delivery: ${chat.autonomyEmotionMustDeliver ? 'enabled; if there is a strong emotion the user should know, set emotionNeedsDelivery=true and include a direct message expressing it naturally' : 'disabled'}.`
      : `最低联系保障：${chat.autonomyGuaranteeContact ? `已开启，最长沉默 ${normalizeAutonomySilenceMinutes(chat.autonomyMaxSilenceMinutes)} 分钟` : '未开启'}；目前已沉默约 ${silenceMinutes} 分钟。${contactRequired ? '保障现已到期：必须至少给出一个获准动作，优先是一条真诚的直接消息。' : ''}重要情绪必达：${chat.autonomyEmotionMustDeliver ? '已开启；如果存在用户应该知道的强烈情绪，请令 emotionNeedsDelivery=true，并用一条自然的直接消息表达' : '未开启'}。`
    messages.push({
      role: 'system',
      content: globalPromptSettings.language === 'en'
        ? `[Character autonomous-activity decision]\nCurrent time: ${new Date(now).toLocaleString('zh-CN')}. About ${elapsedMinutes} minutes have passed since the last check. Trigger: ${reason}. ${catchup ? 'This is a complete local catch-up for the recorded closed-page window. Place plausible actions across the elapsed time without repetition.' : 'This is a normal check while the page is running.'}\nYou are not replying to the user. You are deciding whether the character genuinely wants to act now. Proactive messages allowed: ${chat.autonomyAllowMessages ? 'yes' : 'no'}; Moments allowed: ${chat.autonomyAllowMoments ? 'yes' : 'no'}; status changes allowed: ${chat.enableImmersiveStatus && chat.autonomyAllowStatus ? 'yes' : 'no'}. ${policyText} Respect the persona, relationship, recent conversation, and any schedule or busyness the user disclosed. Outside mandatory policies, silence is normal. Never send mechanical greetings, time announcements, or explanations of these rules.\nReturn JSON only: {"summary":"one internal summary sentence","emotion":"current emotion","emotionIntensity":0,"emotionNeedsDelivery":false,"nextCheckMinutes":120,"actions":[{"type":"message|moment|status","content":"plain message or Moments post body without XML tags","status":"online|offline|busy|away","text":"status text","atOffsetMinutes":0,"important":false}]}. content must be plain text and never contain tags. actions may be empty unless a policy is due; at most ${maxActions}. nextCheckMinutes must be between ${minimum} and ${Math.max(720, minimum)}. During catch-up, atOffsetMinutes means how many minutes ago the action occurred and may not exceed ${elapsedMinutes}.`
        : `【角色自主活动判断】\n现在是 ${new Date(now).toLocaleString('zh-CN')}。距离上次自主判断约 ${elapsedMinutes} 分钟。触发原因：${reason}。${catchup ? '这是记录到的页面关闭时间段的完整本地补演，请在经过时间内合理分布动作且避免重复。' : '这是页面运行期间的正常判断。'}\n你不是在回复用户，而是在决定自己此刻是否想行动。允许主动消息：${chat.autonomyAllowMessages ? '是' : '否'}；允许朋友圈：${chat.autonomyAllowMoments ? '是' : '否'}；允许状态变化：${chat.enableImmersiveStatus && chat.autonomyAllowStatus ? '是' : '否'}。${policyText}必须尊重人设、关系、最近聊天内容和用户透露的忙碌/作息；除强制保障外，沉默是正常选择。不要机械问候、报时或解释规则。\n只返回 JSON：{"summary":"一句内部摘要","emotion":"当前情绪","emotionIntensity":0,"emotionNeedsDelivery":false,"nextCheckMinutes":120,"actions":[{"type":"message|moment|status","content":"不含标签的纯文本消息或朋友圈正文","status":"online|offline|busy|away","text":"状态文案","atOffsetMinutes":0,"important":false}]}。actions 除保障到期外可以为空；最多 ${maxActions} 个；nextCheckMinutes 为 ${minimum} 到 ${Math.max(720, minimum)}。补演时 atOffsetMinutes 表示动作发生在多少分钟前，不能超过 ${elapsedMinutes}。`
    })
    const result: any = await sendChatMessage(messages)
    const rawDecision = typeof result === 'string' ? result : result.content
    let decision = parseDecision(rawDecision)
    let actions = Array.isArray(decision.actions)
      ? decision.actions.filter(action => action && typeof action.type === 'string').slice(0, maxActions)
      : []
    const importantEmotionDue = chat.autonomyEmotionMustDeliver
      && decision.emotionNeedsDelivery === true
      && Number(decision.emotionIntensity || 0) >= 2
      && chat.autonomyAllowMessages
    const requiresMessage = (contactRequired && chat.autonomyAllowMessages) || importantEmotionDue
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
      const repaired: any = await sendChatMessage(messages)
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
          chat.messages.push({ id: messageId, type: 'left', content, isAutonomous: true, autonomyImportant: important })
          queueAutonomyDelivery(chat, messageId, content, createdAt + messageIndex, important)
          addEvent(chat, { type: 'message', createdAt: createdAt + messageIndex, title: '主动发来消息', detail: content, catchup, trigger: reason })
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
