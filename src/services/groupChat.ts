/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { getActiveGroupPrompt } from '../store'
import { sendChatMessage } from './api'
import { buildSystemPrompt } from '../composables/chatState/prompt'
import { buildBilingualPrompt, parseBilingualMessage } from './bilingualChat'
import { buildInnerThoughtContext } from './innerThoughtContext'
import { buildMemoryPacket } from './memoryEngine'
import { reactive } from 'vue'
import localforage from 'localforage'
import type { OfflineModelProfile } from './offlinePresets'

export const activeGroupReplyIds = reactive(new Set<string>())
export const groupReplyControllers = new Map<string, AbortController>()

export interface GroupChatRecord {
  id: string
  chatType: 'group'
  name: string
  groupContext: string
  memberIds: string[]
  memberNotes: Record<string, string>
  memberNicknames: Record<string, string>
  memberHasCustomAvatar?: Record<string, boolean>
  memberSettings: Record<string, Record<string, any>>
  messages: any[]
  memoryBook: any[]
  memberMemories: Record<string, any[]>
  memoryMemberNames?: Record<string, string>
  memoryState?: any
  boundWorldBooks: string[]
  boundWorldBookGroups: string[]
  userProfile: any
  userProfileSource: any
  memoryType: 'count' | 'round'
  memoryValue: number
  autoSummaryEnabled: boolean
  autoSummaryThreshold: number
  autoSummaryTokenThreshold: number
  autoSummaryTrigger: 'count' | 'token' | 'both'
  autoSummaryOnImportant: boolean
  autoSummaryOnTopicChange: boolean
  autoSummaryOnExit: boolean
  autoSummaryIdleMinutes: number
  memoryMode: 'narrative' | 'subjective' | 'event' | 'variable' | 'table' | 'hybrid'
  memoryBatchSize: number
  memoryTokenBudget: number
  autoMemoryConsolidation: boolean
  memoryConsolidationThreshold: number
  memorySummaryRetryCount: number
  summaryPrompt: string
  lastSummaryMsgId: number
  timePerception: boolean
  sendCharacterTime: boolean
  memberTimezones: Record<string, string>
  bilingualEnabled: boolean
  bilingualMode: 'auto' | 'follow_user' | 'forced'
  dialogueLanguage: string
  customDialogueLanguage: string
  translationLanguage: string
  customTranslationLanguage: string
  translationDisplay: string
  bubbleNarrationEnabled: boolean
  enableMsgCountLimit: boolean
  minMsgCount: number
  maxMsgCount: number
  notificationMode: 'all' | 'mention' | 'mute'
  showMemberNames: boolean
  showMemberAvatars: boolean
  showMessageTime: boolean
  showCostTime: boolean
  isPinned: boolean
  unread: number
  groups: string[]
  createdAt: number
  updatedAt: number
  preview?: string
  time?: string
  avatarText?: string
  hasCustomAvatar?: boolean
  avatarUrl?: string
  isTyping?: boolean
  pendingUserThought?: string
  innerThoughts?: any[]
  memberInnerThoughts?: Record<string, any[]>
  enableAutoThought?: boolean
  enableRoleThoughtHistory?: boolean
  roleThoughtHistoryCount?: number
  enableUserThoughtHistory?: boolean
  userThoughtHistoryCount?: number
  innerThoughtLimit?: number
  offlineMeetEnabled?: boolean
  offlineMeetMode?: 'mixed' | 'separate'
  offlinePresetId?: string
  offlineModelProfile?: OfflineModelProfile
  offlineMeetLocationMode?: 'vague' | 'continuous'
  isMixedOfflineActive?: boolean
  activeCallType?: 'voice' | 'video' | null
  activeCallStartedAt?: number
  activeCallStartMessageId?: number
  callSummaries?: any[]
}

export const getGroupChatsKey = (accountId?: string | null) => accountId ? `clingy_group_chats_${accountId}` : 'clingy_group_chats'

export const readGroupChats = (accountId?: string | null): GroupChatRecord[] => {
  try {
    const parsed = JSON.parse(localStorage.getItem(getGroupChatsKey(accountId)) || '[]')
    return Array.isArray(parsed) ? parsed.map(normalizeGroupChat) : []
  } catch { return [] }
}

export const writeGroupChats = (accountId: string | null | undefined, groups: GroupChatRecord[]) => {
  localStorage.setItem(getGroupChatsKey(accountId), JSON.stringify(groups))
}

const normalizeLegacyMemory = (item: any, fallbackId: string) => {
  const createdAt = Number(item?.createdAt || (typeof item?.id === 'number' ? item.id : Date.now()))
  return {
    ...item,
    id: item?.id ?? fallbackId,
    date: item?.date || new Date(createdAt).toLocaleDateString('zh-CN'),
    content: String(item?.content || item?.summary || ''),
    evidenceMessageIds: Array.isArray(item?.evidenceMessageIds) ? item.evidenceMessageIds : [],
    createdAt,
    updatedAt: Number(item?.updatedAt || createdAt),
    enabled: item?.enabled !== false
  }
}

const normalizeMemberMemories = (raw: any) => Object.fromEntries(Object.entries(raw && typeof raw === 'object' ? raw : {}).map(([memberId, memories]) => [
  memberId,
  (Array.isArray(memories) ? memories : []).map((item, index) => normalizeLegacyMemory(item, `member_${memberId}_${index}_${Date.now()}`))
]))

export const normalizeGroupChat = (raw: any): GroupChatRecord => ({
  id: String(raw.id || `group_${Date.now()}`), chatType: 'group', name: String(raw.name || '未命名群聊'),
  groupContext: String(raw.groupContext || ''), memberIds: Array.isArray(raw.memberIds) ? raw.memberIds.map(String) : [],
  memberNotes: raw.memberNotes || {}, memberNicknames: raw.memberNicknames || {}, memberHasCustomAvatar: raw.memberHasCustomAvatar || {}, memberSettings: raw.memberSettings && typeof raw.memberSettings === 'object' ? raw.memberSettings : {}, messages: Array.isArray(raw.messages) ? raw.messages : [],
  memoryBook: (Array.isArray(raw.memoryBook) ? raw.memoryBook : []).map((item: any, index: number) => normalizeLegacyMemory(item, `group_memory_${index}_${Date.now()}`)), memberMemories: normalizeMemberMemories(raw.memberMemories), memoryMemberNames: raw.memoryMemberNames || {}, memoryState: raw.memoryState || null,
  boundWorldBooks: Array.isArray(raw.boundWorldBooks) ? raw.boundWorldBooks : [], boundWorldBookGroups: Array.isArray(raw.boundWorldBookGroups) ? raw.boundWorldBookGroups : [], userProfile: raw.userProfile && typeof raw.userProfile === 'object' ? raw.userProfile : { name: '我', persona: '', timezone: Intl.DateTimeFormat().resolvedOptions().timeZone },
  userProfileSource: raw.userProfileSource || null, memoryType: raw.memoryType === 'round' ? 'round' : 'count',
  memoryValue: Math.max(1, Number(raw.memoryValue || 60)), timePerception: raw.timePerception !== false,
  sendCharacterTime: raw.sendCharacterTime !== false,
  memberTimezones: raw.memberTimezones && typeof raw.memberTimezones === 'object' ? raw.memberTimezones : {},
  autoSummaryEnabled: raw.autoSummaryEnabled === true,
  autoSummaryThreshold: Math.max(1, Number(raw.autoSummaryThreshold || 500)),
  autoSummaryTokenThreshold: Math.max(200, Number(raw.autoSummaryTokenThreshold || 6000)),
  autoSummaryTrigger: raw.autoSummaryTrigger === 'count' || raw.autoSummaryTrigger === 'token' ? raw.autoSummaryTrigger : 'both',
  autoSummaryOnImportant: raw.autoSummaryOnImportant !== false,
  autoSummaryOnTopicChange: raw.autoSummaryOnTopicChange === true,
  autoSummaryOnExit: raw.autoSummaryOnExit === true,
  autoSummaryIdleMinutes: Math.max(0, Math.min(1440, Number(raw.autoSummaryIdleMinutes || 0))),
  memoryMode: ['narrative', 'subjective', 'event', 'variable', 'table'].includes(raw.memoryMode) ? raw.memoryMode : 'hybrid',
  memoryBatchSize: Math.max(20, Math.min(500, Number(raw.memoryBatchSize || 150))),
  memoryTokenBudget: Math.max(200, Number(raw.memoryTokenBudget || 1200)),
  autoMemoryConsolidation: raw.autoMemoryConsolidation !== false,
  memoryConsolidationThreshold: Math.max(4, Math.min(20, Number(raw.memoryConsolidationThreshold || 8))),
  memorySummaryRetryCount: Math.max(1, Math.min(4, Number(raw.memorySummaryRetryCount || 2))),
  summaryPrompt: String(raw.summaryPrompt || ''),
  lastSummaryMsgId: Math.max(0, Number(raw.lastSummaryMsgId || 0)),
  bilingualEnabled: raw.bilingualEnabled === true,
  bilingualMode: ['follow_user', 'forced'].includes(raw.bilingualMode) ? raw.bilingualMode : 'auto',
  dialogueLanguage: String(raw.dialogueLanguage || 'auto'),
  customDialogueLanguage: String(raw.customDialogueLanguage || ''),
  translationLanguage: String(raw.translationLanguage || 'app'),
  customTranslationLanguage: String(raw.customTranslationLanguage || ''),
  translationDisplay: ['always', 'tap', 'original_only', 'translated_only'].includes(raw.translationDisplay) ? raw.translationDisplay : 'tap',
  bubbleNarrationEnabled: raw.bubbleNarrationEnabled === true,
  enableMsgCountLimit: raw.enableMsgCountLimit === true,
  minMsgCount: Math.max(1, Math.min(20, Number(raw.minMsgCount || 1))),
  maxMsgCount: Math.max(1, Math.min(20, Number(raw.maxMsgCount || 3))),
  notificationMode: ['mention', 'mute'].includes(raw.notificationMode) ? raw.notificationMode : 'all',
  showMemberNames: raw.showMemberNames !== false, showMemberAvatars: raw.showMemberAvatars !== false, showMessageTime: raw.showMessageTime === true, showCostTime: raw.showCostTime !== false,
  isPinned: raw.isPinned === true, unread: Number(raw.unread || 0), groups: Array.isArray(raw.groups) ? raw.groups : [],
  createdAt: Number(raw.createdAt || Date.now()), updatedAt: Number(raw.updatedAt || Date.now()), preview: raw.preview || '', time: raw.time || '刚刚', avatarText: '群', avatarUrl: String(raw.avatarUrl || ''), hasCustomAvatar: raw.hasCustomAvatar === true, isTyping: raw.isTyping === true,
  pendingUserThought: String(raw.pendingUserThought || ''), innerThoughts: Array.isArray(raw.innerThoughts) ? raw.innerThoughts : [], memberInnerThoughts: raw.memberInnerThoughts || {},
  enableAutoThought: raw.enableAutoThought !== false, enableRoleThoughtHistory: raw.enableRoleThoughtHistory !== false,
  roleThoughtHistoryCount: Math.max(1, Number(raw.roleThoughtHistoryCount || 12)), enableUserThoughtHistory: raw.enableUserThoughtHistory !== false,
  userThoughtHistoryCount: Math.max(1, Number(raw.userThoughtHistoryCount || 12)), innerThoughtLimit: Math.max(1, Math.min(1000, Number(raw.innerThoughtLimit || 50))), offlineMeetEnabled: raw.offlineMeetEnabled === true,
  offlineMeetMode: raw.offlineMeetMode === 'separate' ? 'separate' : 'mixed', offlinePresetId: String(raw.offlinePresetId || ''),
  offlineModelProfile: (['auto', 'openai-compatible', 'deepseek-chat', 'deepseek-reasoner', 'claude', 'gemini'].includes(raw.offlineModelProfile) ? raw.offlineModelProfile : 'auto') as OfflineModelProfile, offlineMeetLocationMode: raw.offlineMeetLocationMode === 'continuous' ? 'continuous' : 'vague', isMixedOfflineActive: raw.isMixedOfflineActive === true,
  activeCallType: raw.activeCallType === 'voice' || raw.activeCallType === 'video' ? raw.activeCallType : null,
  activeCallStartedAt: Math.max(0, Number(raw.activeCallStartedAt || 0)), activeCallStartMessageId: Math.max(0, Number(raw.activeCallStartMessageId || 0)),
  callSummaries: Array.isArray(raw.callSummaries) ? raw.callSummaries : []
})

export const createGroupChat = (input: Pick<GroupChatRecord, 'name' | 'groupContext' | 'memberIds'>, userProfile?: any): GroupChatRecord => normalizeGroupChat({
  ...input, id: `group_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, messages: [], memoryBook: [], memberMemories: {},
  userProfile: userProfile ? JSON.parse(JSON.stringify(userProfile)) : null, createdAt: Date.now(), updatedAt: Date.now()
})

export const saveGroupChat = (accountId: string | null | undefined, group: GroupChatRecord) => {
  const groups = readGroupChats(accountId)
  const index = groups.findIndex(item => item.id === group.id)
  const record = normalizeGroupChat({ ...group, updatedAt: Date.now(), isTyping: false })
  if (index >= 0) groups[index] = record
  else groups.push(record)
  writeGroupChats(accountId, groups)
  return record
}

export const deleteGroupChat = (accountId: string | null | undefined, groupId: string) => {
  writeGroupChats(accountId, readGroupChats(accountId).filter(item => item.id !== groupId))
}

const escapeXml = (value: unknown) => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')

const describeMessage = (message: any) => {
  if (message.isRecalled || message.type === 'system') return String(message.content || '')
  if (message.imageData || message.messageType === 'image') return `[图片${message.imageData?.text || message.imageData?.summary || message.imageData?.description ? `：${message.imageData?.text || message.imageData?.summary || message.imageData?.description}` : ''}]`
  if (message.voiceData || message.messageType === 'voice') return `[语音 ${message.voiceData?.seconds || message.voiceData?.duration || ''}秒：${message.voiceData?.text || message.content || ''}]`
  if (message.isEmoji || message.messageType === 'emoji') return `[表情包：${message.emojiData?.name || message.emojiSummary || message.content || ''}]`
  if (message.transferData || message.messageType === 'transfer' || message.messageType === 'red_packet') return `[${(message.transferData?.type || message.messageType) === 'transfer' ? '转账' : '红包'} ¥${message.transferData?.amount || ''}${message.transferData?.remark ? `，${message.transferData.remark}` : ''}，状态：${message.transferData?.status || 'pending'}]`
  if (message.callData || message.messageType === 'call') return `[${message.callData?.callType === 'video' ? '视频' : '语音'}通话：${message.content || ''}]`
  return String(message.content || '')
}

const memberIdentity = (member: any) => String(member.characterEntityId || member.id)
const blobToDataUrl = (blob: Blob) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(String(reader.result || ''))
  reader.onerror = () => reject(reader.error)
  reader.readAsDataURL(blob)
})

export const buildGroupChatMessages = async (group: GroupChatRecord, allChats: any[], userProfile: any, worldBookText = '') => {
  const groupUserProfile = group.userProfile || userProfile || {}
  const allMembers = group.memberIds.map(id => allChats.find(chat => chat.chatType !== 'group' && String(chat.characterEntityId || chat.id) === id)).filter(Boolean)
  const members = group.activeCallType
    ? allMembers.filter(member => {
        const id = memberIdentity(member)
        const effective = { ...member, ...(group.memberSettings[id] || {}) }
        return group.activeCallType === 'voice' ? effective.enableVoiceCall : effective.enableVideoCall
      })
    : allMembers
  const emojiItems: any[] = []
  try {
    const emojiStore = localforage.createInstance({ name: 'nrt-app', storeName: 'chatEmojis' })
    await emojiStore.iterate((value: any, key: string) => { if (key !== '__emoji_groups__' && value?.id) emojiItems.push(value) })
  } catch { /* IndexedDB may be unavailable in non-browser protocol tests. */ }
  group.memoryMemberNames ||= {}
  allMembers.forEach(member => { const id = memberIdentity(member); group.memoryMemberNames![id] = group.memberNicknames[id] || member.name || id })
  const latestUserMessage = [...group.messages].reverse().find(message => message.type === 'right')
  const turnId = String(latestUserMessage?.turnId || latestUserMessage?.id || '')
  const memoryQuery = String(latestUserMessage?.content || '')
  const memberContexts = await Promise.all(members.map(async member => {
    const id = memberIdentity(member)
    const nickname = group.memberNicknames[id] || member.name
    const note = String(group.memberNotes[id] || '').trim()
    // 如果存在群内独立人设，完全替换掉该成员在私聊中的基础 persona
    const isolatedMember = {
      ...member,
      ...(group.memberSettings[id] || {}),
      name: nickname,
      persona: note || member.persona,
      userProfile: groupUserProfile,
      userProfileSource: group.userProfileSource || member.userProfileSource,
      innerThoughts: group.memberInnerThoughts?.[id] || [],
      enableAutoThought: group.enableAutoThought,
      enableRoleThoughtHistory: group.enableRoleThoughtHistory,
      roleThoughtHistoryCount: group.roleThoughtHistoryCount,
      enableUserThoughtHistory: group.enableUserThoughtHistory,
      userThoughtHistoryCount: group.userThoughtHistoryCount,
      offlineMeetEnabled: group.offlineMeetEnabled,
      offlineMeetMode: group.offlineMeetMode,
      offlinePresetId: group.offlinePresetId || member.offlinePresetId,
      offlineModelProfile: group.offlineModelProfile || 'auto',
      offlineMeetLocationMode: group.offlineMeetLocationMode || 'vague',
      timePerception: group.timePerception,
      sendCharacterTime: group.sendCharacterTime,
      timezone: group.memberTimezones[id] || member.timezone || group.userProfile?.timezone || userProfile?.timezone,
      bilingualEnabled: group.bilingualEnabled,
      bilingualMode: group.bilingualMode,
      dialogueLanguage: group.dialogueLanguage,
      customDialogueLanguage: group.customDialogueLanguage,
      translationLanguage: group.translationLanguage,
      customTranslationLanguage: group.customTranslationLanguage,
      translationDisplay: group.translationDisplay,
      bubbleNarrationEnabled: false,
      enableMsgCountLimit: false
    }
    const offlineMode = group.offlineMeetEnabled && (group.offlineMeetMode === 'separate' || group.isMixedOfflineActive) ? group.offlineMeetMode : false
    const roleEmojiNames = isolatedMember.enableRoleEmojiVision
      ? emojiItems.filter(item => item.category === 'global' || (item.category === 'role' && String(item.roleId ?? item.targetId ?? '') === id)).map(item => item.name).filter(Boolean).join('、')
      : ''
    const basePrompt = buildSystemPrompt(isolatedMember, roleEmojiNames || '无', false, offlineMode as any, undefined, 'group')
    const bilingualPrompt = buildBilingualPrompt(isolatedMember)
    const thoughtContext = buildInnerThoughtContext(isolatedMember, group.pendingUserThought || '', turnId)
    const subjectiveMemory = await buildMemoryPacket({
      id: `${group.id}:member:${id}`,
      memoryBook: group.memberMemories[id] || [],
      memoryState: null,
      memoryTokenBudget: Math.max(200, Math.floor(group.memoryTokenBudget / Math.max(1, members.length)))
    }, memoryQuery, undefined, { allowEmbedding: false })
    return `<member_context id="${escapeXml(id)}" display_name="${escapeXml(nickname)}">\n${basePrompt}${bilingualPrompt ? `\n\n${bilingualPrompt}` : ''}${thoughtContext ? `\n\n${thoughtContext}` : ''}${subjectiveMemory ? `\n\n【只属于${nickname}的群内主观记忆】${subjectiveMemory}` : ''}\n</member_context>`
  }))
  const roster = members.map(member => `${group.memberNicknames[memberIdentity(member)] || member.name}（ID：${memberIdentity(member)}）`).join('\n')
  const sharedMemory = await buildMemoryPacket(group, memoryQuery, group.memoryTokenBudget)
  let system = `你正在参与一个真实的多人群聊。每位成员都有独立、完整且持续一致的人格、经历、认知和表达方式。只能让成员依据自己亲历、看见、听见或被明确告知的信息行动；不得共享其他成员的私密认知，也不得让所有人表现成同一种声音。\n\n${memberContexts.join('\n\n')}\n\n${getActiveGroupPrompt()}\n\n【当前群聊】\n群名：${group.name}\n用户：${groupUserProfile?.name || '我'}（ID：user）${groupUserProfile?.persona ? `\n用户在本群的身份：${groupUserProfile.persona}` : ''}\n\n【可用成员清单】\n${roster}`
  if (group.timePerception) {
    const now = new Date()
    const userTimezone = groupUserProfile?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone
    const memberTimes = members.map(member => {
      const id = memberIdentity(member)
      const timezone = group.memberTimezones[id] || member.timezone || userTimezone
      return `${group.memberNicknames[id] || member.name}：${timezone} ${now.toLocaleString('zh-CN', { timeZone: timezone, hour12: false })}`
    }).join('\n')
    system += `\n\n【群聊当前时间】\n用户：${userTimezone} ${now.toLocaleString('zh-CN', { timeZone: userTimezone, hour12: false })}\n${memberTimes}\n成员应感知消息之间的真实时间间隔，并按各自当地时间与作息自然反应，不要机械报时。`
  }
  if (group.bubbleNarrationEnabled) system += `\n\n【群聊气泡叙事】\n线上对白继续使用 kind="text" 的 group_msg；动作、神态、心理或环境描写使用对应成员 sender 且 kind="narration" 的 group_msg。叙述必须保持发送成员身份明确，不得替用户决定行动或感受。`
  if (group.enableMsgCountLimit) system += `\n\n【群聊回复条数限制】\n本次回复总共输出 ${group.minMsgCount} 到 ${Math.max(group.minMsgCount, group.maxMsgCount)} 个 group_msg；这是全群总量，不是每位成员各自的数量。仍由现场语境决定谁发言，禁止为了凑数让所有成员轮流发言。`
  if (group.activeCallType) system += `\n\n【当前群通话】\n用户正与已开启群内${group.activeCallType === 'video' ? '视频' : '语音'}通话接入的成员进行实时群通话。只能由上方当前成员清单中的成员参与；表达应符合口语实时对话，不要把通话内容写成普通文字聊天。`
  if (group.groupContext.trim()) system += `\n\n【可选群背景】\n${group.groupContext.trim()}`
  if (sharedMemory) system += `\n\n【群内共同记忆】${sharedMemory}`
  if (worldBookText.trim()) system += `\n\n【群世界设定】\n${worldBookText.trim()}`
  const valid = group.messages.filter(message => {
    if (!['left', 'right', 'system', 'narration'].includes(message.type) || message.isRecalled || message.isUndelivered) return false
    if (!group.activeCallType) return !message.isVoiceCallProcessMsg && !message.isVideoCallProcessMsg
    if (group.activeCallType === 'voice') return !message.isVideoCallProcessMsg
    return !message.isVoiceCallProcessMsg
  })
  let history = valid
  if (group.memoryType === 'count') history = valid.slice(-group.memoryValue)
  else {
    const userIndexes = valid.map((message, index) => message.type === 'right' ? index : -1).filter(index => index >= 0)
    const start = userIndexes[Math.max(0, userIndexes.length - group.memoryValue)]
    history = typeof start === 'number' ? valid.slice(start) : valid
  }
  const encodedHistory: any[] = []
  for (const message of history) {
      const timestamp = Number(message.timestamp || message.id)
      const includeTime = group.timePerception && Number.isFinite(timestamp) && (message.type !== 'left' || group.sendCharacterTime)
      const timeAttr = includeTime
        ? ` time="${new Date(timestamp).toISOString()}"`
        : ''
      const encoded = message.type === 'right'
        ? { role: 'user', content: `<group_user_msg id="${message.id}"${timeAttr} kind="${message.messageType || 'text'}" reply_to="${message.replyToMessageId || ''}" mentions="${(message.mentions || []).map((item: any) => item.id).join(',')}">${escapeXml(describeMessage(message))}</group_user_msg>` }
        : { role: message.type === 'system' ? 'system' : 'assistant', content: message.type === 'system' ? escapeXml(message.content) : `<group_history_msg id="${message.id}"${timeAttr} sender="${message.senderId}" kind="${message.messageType || 'text'}" reply_to="${message.replyToMessageId || ''}">${escapeXml(describeMessage(message))}</group_history_msg>` }
      if (message.type === 'right' && message.imageData?.imageId) {
        const imageStore = localforage.createInstance({ name: 'nrt-app', storeName: 'chatImages' })
        const imageUrl = await imageStore.getItem<string>(message.imageData.imageId)
        if (imageUrl) encoded.content = [
          { type: 'text', text: encoded.content },
          { type: 'image_url', image_url: { url: imageUrl } }
        ] as any
      }
      if (message.type === 'right' && message.isEmoji && message.emojiId && members.some(member => ({ ...member, ...(group.memberSettings[memberIdentity(member)] || {}) }).enableEmojiVision)) {
        const emoji = emojiItems.find(item => String(item.id) === String(message.emojiId))
        let emojiUrl = emoji?.type === 'url' && typeof emoji.data === 'string' ? emoji.data : ''
        if (!emojiUrl && emoji?.type === 'local' && emoji.data instanceof Blob) {
          try { emojiUrl = await blobToDataUrl(emoji.data) } catch { emojiUrl = '' }
        }
        if (emojiUrl) encoded.content = [
          { type: 'text', text: encoded.content },
          { type: 'image_url', image_url: { url: emojiUrl } }
        ] as any
      }
      encodedHistory.push(encoded)
  }
  const roleEmojiVisualContent: any[] = []
  for (const member of members) {
    const id = memberIdentity(member)
    const effective = { ...member, ...(group.memberSettings[id] || {}) }
    if (!effective.enableRoleEmojiVision) continue
    const available = emojiItems.filter(item => item.category === 'global' || (item.category === 'role' && String(item.roleId ?? item.targetId ?? '') === id))
    for (const emoji of available) {
      let emojiUrl = emoji.type === 'url' && typeof emoji.data === 'string' ? emoji.data : ''
      if (!emojiUrl && emoji.type === 'local' && emoji.data instanceof Blob) {
        try { emojiUrl = await blobToDataUrl(emoji.data) } catch { emojiUrl = '' }
      }
      if (!emojiUrl) continue
      roleEmojiVisualContent.push({ type: 'text', text: `\n${group.memberNicknames[id] || member.name}可发送的表情包「${emoji.name}」图像：` })
      roleEmojiVisualContent.push({ type: 'image_url', image_url: { url: emojiUrl } })
    }
  }
  const systemContent = roleEmojiVisualContent.length ? [{ type: 'text', text: system }, ...roleEmojiVisualContent] : system
  return [{ role: 'system', content: systemContent }, ...encodedHistory]
}

export const parseGroupResponse = (raw: string, allowedIds: string[]) => {
  const messages: any[] = []
  const regex = /<group_msg\s+([^>]*)>([\s\S]*?)<\/group_msg>/gi
  let match: RegExpExecArray | null
  while ((match = regex.exec(raw)) !== null) {
    const attrs = match[1]
    const senderId = attrs.match(/\bsender=["']([^"']+)["']/i)?.[1] || ''
    if (!allowedIds.includes(senderId)) continue
    const parsed = parseBilingualMessage(match[2].trim(), attrs)
    const content = parsed.content
    if (!content) continue
    messages.push({ senderId, key: attrs.match(/\bkey=["']([^"']*)["']/i)?.[1] || '', content, translation: parsed.translation, contentLanguage: parsed.contentLanguage, translationLanguage: parsed.translationLanguage, messageType: attrs.match(/\bkind=["']([^"']*)["']/i)?.[1] || 'text', amount: Number(attrs.match(/\bamount=["']([^"']*)["']/i)?.[1] || 0), remark: attrs.match(/\bremark=["']([^"']*)["']/i)?.[1] || '', replyToMessageId: attrs.match(/\breply_to=["']([^"']*)["']/i)?.[1] || '', mentions: (attrs.match(/\bmentions=["']([^"']*)["']/i)?.[1] || '').split(',').map(item => item.trim()).filter(id => allowedIds.includes(id) || id === 'user') })
  }
  const thoughts: any[] = []
  const thoughtRegex = /<group_inner_thought\s+sender=["']([^"']+)["']>([\s\S]*?)<\/group_inner_thought>/gi
  while ((match = thoughtRegex.exec(raw)) !== null) if (allowedIds.includes(match[1]) && match[2].trim()) thoughts.push({ senderId: match[1], content: match[2].trim() })
  return { messages, thoughts, idle: /<group_idle\s*\/>/i.test(raw) }
}

export const requestGroupReply = async (group: GroupChatRecord, allChats: any[], userProfile: any, signal?: AbortSignal, worldBookText = '') => {
  const payload = await buildGroupChatMessages(group, allChats, userProfile, worldBookText)
  const offlineActive = group.offlineMeetEnabled && (group.offlineMeetMode === 'separate' || group.isMixedOfflineActive)
  const result = await sendChatMessage(payload, signal, false, false, 'default', offlineActive ? (group.offlineModelProfile || 'auto') : 'auto', { chatId: group.id, chatName: group.name, memoryEntries: group.memoryBook.map((item: any) => item.content || '') })
  const raw = typeof result === 'string' ? result : result.content
  return { ...parseGroupResponse(raw, group.memberIds), thinking: typeof result === 'string' ? '' : (result.thinking || '') }
}
