import localforage from 'localforage'
import { sendChatMessage } from './api'
import { buildChatMessages } from '../composables/chatState/messages'
import { mockChats } from '../composables/chatState/state'
import { showNotification } from '../composables/chatState/notifications'
import { useChatAuth } from '../composables/useChatAuth'
import { globalPromptSettings } from '../store'

export type AutonomyEventType = 'message' | 'moment' | 'status' | 'idle' | 'error'
export type AutonomyEvent = {
  id: string
  type: AutonomyEventType
  createdAt: number
  title: string
  detail: string
  catchup?: boolean
}

type AutonomyAction = {
  type: 'message' | 'moment' | 'status'
  content?: string
  status?: 'online' | 'offline' | 'busy' | 'away'
  text?: string
  atOffsetMinutes?: number
}

const momentStore = localforage.createInstance({ name: 'nrt-app', storeName: 'discover_moments' })
let running = false

export const ensureAutonomyDefaults = (chat: any) => {
  chat.autonomyEnabled ??= false
  chat.autonomyAllowMessages ??= true
  chat.autonomyAllowMoments ??= true
  chat.autonomyAllowStatus ??= true
  chat.autonomyCatchup ??= true
  chat.autonomyActiveStart ??= 8
  chat.autonomyActiveEnd ??= 24
  chat.autonomyMinIntervalMinutes ??= 45
  chat.autonomyHistory = Array.isArray(chat.autonomyHistory) ? chat.autonomyHistory : []
  chat.autonomyState ||= {}
  chat.autonomyState.status ||= 'offline'
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
    'autonomyEnabled', 'autonomyAllowMessages', 'autonomyAllowMoments', 'autonomyAllowStatus',
    'autonomyCatchup', 'autonomyActiveStart', 'autonomyActiveEnd', 'autonomyMinIntervalMinutes',
    'autonomyHistory', 'autonomyState', 'messages', 'unread', 'preview', 'time', 'statusText', 'offlineUntil'
  ]
  fields.forEach(field => { saved[index][field] = chat[field] })
  localStorage.setItem(key, JSON.stringify(saved))
}

const addEvent = (chat: any, event: Omit<AutonomyEvent, 'id'>) => {
  ensureAutonomyDefaults(chat)
  chat.autonomyHistory.unshift({ ...event, id: `${event.createdAt}_${Math.random().toString(36).slice(2, 8)}` })
  chat.autonomyHistory = chat.autonomyHistory.slice(0, 200)
}

const parseDecision = (raw: string): { summary?: string; nextCheckMinutes?: number; actions?: AutonomyAction[] } => {
  const cleaned = raw.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim()
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start < 0 || end <= start) throw new Error('角色自主决策返回格式不完整')
  return JSON.parse(cleaned.slice(start, end + 1))
}

const isWithinActiveHours = (chat: any, date = new Date()) => {
  const start = Number(chat.autonomyActiveStart ?? 8)
  const end = Number(chat.autonomyActiveEnd ?? 24)
  const hour = date.getHours()
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

export const runAutonomousCheck = async (chat: any, reason: 'scheduled' | 'resume' | 'manual' = 'scheduled') => {
  ensureAutonomyDefaults(chat)
  if (!chat.autonomyEnabled || running || chat.isTyping) return false
  if (reason !== 'manual' && !isWithinActiveHours(chat)) return false

  const now = Date.now()
  const previous = Number(chat.autonomyState.lastCheckedAt || now)
  const elapsedMinutes = Math.max(0, Math.round((now - previous) / 60000))
  const catchup = reason === 'resume' && chat.autonomyCatchup && elapsedMinutes >= 30
  running = true
  chat.autonomyState.running = true
  chat.autonomyState.lastError = ''
  persistAutonomyChat(chat)

  try {
    const messages = await buildChatMessages(chat)
    messages.push({
      role: 'system',
      content: globalPromptSettings.language === 'en'
        ? `[Character autonomous-activity decision]\nCurrent time: ${new Date(now).toLocaleString('zh-CN')}. About ${elapsedMinutes} minutes have passed since the last check. Trigger: ${reason}. ${catchup ? 'This is a catch-up calculation after reopening; a small number of plausible events may have occurred during the elapsed time.' : 'This is a normal check while the page is running.'}\nYou are not replying to the user. You are deciding whether the character genuinely wants to act now. Proactive messages allowed: ${chat.autonomyAllowMessages ? 'yes' : 'no'}; Moments allowed: ${chat.autonomyAllowMoments ? 'yes' : 'no'}; status changes allowed: ${chat.autonomyAllowStatus ? 'yes' : 'no'}. Respect the persona, relationship, recent conversation, and any schedule or busyness the user disclosed. Silence is normal and should remain an easy choice. Never act merely to display the feature, send mechanical greetings or time announcements, or explain these rules.\nReturn JSON only: {"summary":"one internal summary sentence","nextCheckMinutes":120,"actions":[{"type":"message|moment|status","content":"message or Moments post body","status":"online|offline|busy|away","text":"status text","atOffsetMinutes":0}]}. Natural-language fields must use the conversation's primary language. actions may be empty and may contain at most 3 items. nextCheckMinutes must be between ${Math.max(30, Number(chat.autonomyMinIntervalMinutes || 45))} and 720. During catch-up, atOffsetMinutes means how many minutes ago the action occurred and may not exceed ${elapsedMinutes}.`
        : `【角色自主活动判断】\n现在是 ${new Date(now).toLocaleString('zh-CN')}。距离上次自主判断约 ${elapsedMinutes} 分钟。触发原因：${reason}。${catchup ? '这是重新打开后的时间结算，可以生成这段时间内合理发生过的少量事件。' : '这是页面运行期间的正常判断。'}\n你不是在回复用户，而是在决定自己此刻是否想行动。允许主动消息：${chat.autonomyAllowMessages ? '是' : '否'}；允许朋友圈：${chat.autonomyAllowMoments ? '是' : '否'}；允许状态变化：${chat.autonomyAllowStatus ? '是' : '否'}。必须尊重人设、关系、最近聊天内容和用户透露的忙碌/作息；沉默是完全正常且优先允许的选择，不要为了展示功能而行动，不要机械问候或报时，不要解释规则。\n只返回 JSON：{"summary":"一句内部摘要","nextCheckMinutes":120,"actions":[{"type":"message|moment|status","content":"消息或朋友圈正文","status":"online|offline|busy|away","text":"状态文案","atOffsetMinutes":0}]}。actions 可以为空；最多 3 个动作；nextCheckMinutes 为 ${Math.max(30, Number(chat.autonomyMinIntervalMinutes || 45))} 到 720。补演时 atOffsetMinutes 表示该动作发生在多少分钟前，不能超过 ${elapsedMinutes}。`
    })
    const result: any = await sendChatMessage(messages)
    const decision = parseDecision(typeof result === 'string' ? result : result.content)
    const actions = Array.isArray(decision.actions) ? decision.actions.slice(0, 3) : []
    let executed = 0

    for (const action of actions) {
      const createdAt = actionTime(now, action, elapsedMinutes, catchup)
      if (action.type === 'message' && chat.autonomyAllowMessages && action.content?.trim()) {
        const content = action.content.trim()
        chat.messages ||= []
        chat.messages.push({ id: createdAt, type: 'left', content, isAutonomous: true })
        chat.preview = content
        chat.time = new Date(createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
        chat.unread = (chat.unread || 0) + 1
        addEvent(chat, { type: 'message', createdAt, title: '主动发来消息', detail: content, catchup })
        showNotification(chat.name, chat.avatarUrl, chat.avatarText, content)
        executed++
      } else if (action.type === 'moment' && chat.autonomyAllowMoments && action.content?.trim()) {
        await addMoment(chat, action.content.trim(), createdAt)
        addEvent(chat, { type: 'moment', createdAt, title: '发布了朋友圈', detail: action.content.trim(), catchup })
        executed++
      } else if (action.type === 'status' && chat.autonomyAllowStatus && action.status) {
        chat.autonomyState.status = action.status
        chat.statusText = action.text?.trim() || ({ online: '在线', offline: '离线', busy: '忙碌', away: '暂离' } as any)[action.status]
        if (action.status === 'offline') chat.offlineUntil = now + 30 * 60000
        else chat.offlineUntil = 0
        addEvent(chat, { type: 'status', createdAt, title: `状态变为${chat.statusText}`, detail: action.text?.trim() || '角色根据自己的安排改变了状态', catchup })
        executed++
      }
    }

    if (executed === 0) addEvent(chat, { type: 'idle', createdAt: now, title: '选择保持安静', detail: decision.summary?.trim() || '这次没有想做的事', catchup })
    const minimum = Math.max(30, Number(chat.autonomyMinIntervalMinutes || 45))
    const nextMinutes = Math.min(720, Math.max(minimum, Number(decision.nextCheckMinutes || 120)))
    chat.autonomyState.lastCheckedAt = now
    chat.autonomyState.nextCheckAt = now + nextMinutes * 60000
    chat.autonomyState.lastSummary = decision.summary?.trim() || ''
    return true
  } catch (error: any) {
    chat.autonomyState.lastError = error?.message || '自主活动检查失败'
    chat.autonomyState.nextCheckAt = now + Math.max(30, Number(chat.autonomyMinIntervalMinutes || 45)) * 60000
    addEvent(chat, { type: 'error', createdAt: now, title: '本次活动检查失败', detail: chat.autonomyState.lastError })
    throw error
  } finally {
    chat.autonomyState.running = false
    persistAutonomyChat(chat)
    running = false
  }
}

export const runDueAutonomyChecks = async (reason: 'scheduled' | 'resume' = 'scheduled') => {
  for (const chat of mockChats.value.filter(item => item.id !== 1)) {
    ensureAutonomyDefaults(chat)
    if (!chat.autonomyEnabled) continue
    const due = !chat.autonomyState.nextCheckAt || chat.autonomyState.nextCheckAt <= Date.now()
    if (due) {
      try { await runAutonomousCheck(chat, reason) } catch (_) {}
      break
    }
  }
}
