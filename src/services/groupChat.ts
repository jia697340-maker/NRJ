/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { getActiveGroupPrompt, webSearchSettings } from '../store'
import { sendChatMessage } from './api'
import { buildSystemPrompt } from '../composables/chatState/prompt'
import { buildBilingualPrompt, parseBilingualMessage } from './bilingualChat'
import { buildInnerThoughtContext } from './innerThoughtContext'
import { buildMemoryPacket, getMemoryExportItems, normalizeMemoryMode, type MemoryMode } from './memoryEngine'
import { reactive } from 'vue'
import localforage from 'localforage'
import type { OfflineModelProfile } from './offlinePresets'
import type { GroupMembershipRequest } from '../types/groupManagement'
import { selectRoleAvailableEmojis } from './chatEmojiScope'
import { buildGroupManagementPrompt, ensureGroupManagementState, getSpeakableCharacterIds } from './groupManagementService'
import { buildSingleToGroupBridgeContext, normalizeMemoryBridgeMemberSettings } from './memoryBridge'
import { loadTimelineChatView } from './chatTimeline'
import { useChatAuth } from '../composables/useChatAuth'
import {
  formatIdentityDateTime,
  getConversationAdjustedTimestamp,
  getIdentityClockLabel,
  normalizeConversationTimeState
} from './conversationTime'

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
  timelineState?: any
  activeTimelineId?: string
  memberTimelineBindings?: Record<string, string>
  webSearchEnabled?: boolean
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
  memoryMode: MemoryMode
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
  conversationTimeState?: import('./conversationTime').ConversationTimeState
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
  showMemberLevel: boolean
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
  referenceMemberEmojiLibraries: boolean
  memberEmojiLibraryEnabled: Record<string, boolean>
  emojiVisionScope: 'enabled_members' | 'all_members'
  imageRecognitionMode: 'visual' | 'description_only'
  voiceCallMemoryValue: number
  videoCallMemoryValue: number
  callSummaryFrequency: number
  activeCallTemporarySummary?: string
  disableMediaDuringCall: boolean
  disableThoughtDuringCall: boolean
  disableMediaDuringOffline: boolean
  disableThoughtDuringOffline: boolean
  autonomyEnabled: boolean
  autonomyAllowMessages: boolean
  autonomyAllowMentions: boolean
  autonomyAllowStatusEvents: boolean
  autonomyAllowIncomingCalls: boolean
  autonomyActiveStart: number
  autonomyActiveEnd: number
  autonomyMinIntervalMinutes: number
  autonomyMaxMessagesPerDay: number
  autonomyLastRunAt: number
  autonomyDailyCount: number
  autonomyDailyDate: string
  incomingCallEnabled: boolean
  incomingCallStartHour: number
  incomingCallEndHour: number
  incomingCallMinIntervalMinutes: number
  incomingCallLastAt: number
  ownerId?: string
  adminIds?: string[]
  isWholeGroupMuted?: boolean
  aiManagementMode?: 'off' | 'remind_only' | 'semi_auto' | 'full_auto'
  levelTitles?: any[]
  stageTitles?: Record<number, string>
  pointRules?: import('../types/groupManagement').GroupPointRules
  memberPoints?: Record<string, number>
  memberMutes?: Record<string, any>
  memberSpecialTitles?: Record<string, string>
  announcements?: any[]
  adminLogs?: any[]
  memberActivityDaily?: Record<string, any>
  removedMembers?: Record<string, any>
  membershipRequests?: GroupMembershipRequest[]
  atAllDaily?: Record<string, { date: string; count: number }>
  managementSchemaVersion?: number
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

export const normalizeGroupChat = (raw: any): GroupChatRecord => ensureGroupManagementState({
  id: String(raw.id || `group_${Date.now()}`), chatType: 'group', name: String(raw.name || '未命名群聊'),
  groupContext: String(raw.groupContext || ''), memberIds: Array.isArray(raw.memberIds) ? raw.memberIds.map(String) : [],
  memberNotes: raw.memberNotes || {}, memberNicknames: raw.memberNicknames || {}, memberHasCustomAvatar: raw.memberHasCustomAvatar || {}, memberSettings: raw.memberSettings && typeof raw.memberSettings === 'object' ? Object.fromEntries(Object.entries(raw.memberSettings).map(([k, v]: [string, any]) => [k, normalizeMemoryBridgeMemberSettings(v)])) : {}, messages: Array.isArray(raw.messages) ? raw.messages : [],
  memoryBook: (Array.isArray(raw.memoryBook) ? raw.memoryBook : []).map((item: any, index: number) => normalizeLegacyMemory(item, `group_memory_${index}_${Date.now()}`)), memberMemories: normalizeMemberMemories(raw.memberMemories), memoryMemberNames: raw.memoryMemberNames || {}, memoryState: raw.memoryState || null,
  boundWorldBooks: Array.isArray(raw.boundWorldBooks) ? raw.boundWorldBooks : [], boundWorldBookGroups: Array.isArray(raw.boundWorldBookGroups) ? raw.boundWorldBookGroups : [], userProfile: raw.userProfile && typeof raw.userProfile === 'object' ? raw.userProfile : { name: '我', persona: '', timezone: Intl.DateTimeFormat().resolvedOptions().timeZone },
  userProfileSource: raw.userProfileSource || null, memoryType: raw.memoryType === 'round' ? 'round' : 'count',
  memoryValue: Math.max(1, Number(raw.memoryValue || 60)), timePerception: raw.timePerception !== false,
  sendCharacterTime: raw.sendCharacterTime !== false,
  memberTimezones: raw.memberTimezones && typeof raw.memberTimezones === 'object' ? raw.memberTimezones : {},
  conversationTimeState: normalizeConversationTimeState(raw),
  autoSummaryEnabled: raw.autoSummaryEnabled === true,
  autoSummaryThreshold: Math.max(1, Number(raw.autoSummaryThreshold || 500)),
  autoSummaryTokenThreshold: Math.max(200, Number(raw.autoSummaryTokenThreshold || 6000)),
  autoSummaryTrigger: raw.autoSummaryTrigger === 'count' || raw.autoSummaryTrigger === 'token' ? raw.autoSummaryTrigger : 'both',
  autoSummaryOnImportant: raw.autoSummaryOnImportant !== false,
  autoSummaryOnTopicChange: raw.autoSummaryOnTopicChange === true,
  autoSummaryOnExit: raw.autoSummaryOnExit === true,
  autoSummaryIdleMinutes: Math.max(0, Math.min(1440, Number(raw.autoSummaryIdleMinutes || 0))),
  memoryMode: normalizeMemoryMode(raw.memoryMode),
  memoryBatchSize: Math.max(20, Math.min(500, Number(raw.memoryBatchSize || 150))),
  memoryTokenBudget: Math.max(200, Number(raw.memoryTokenBudget || 1200)),
  autoMemoryConsolidation: raw.autoMemoryConsolidation === true,
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
  showMemberNames: raw.showMemberNames !== false, showMemberAvatars: raw.showMemberAvatars !== false, showMemberLevel: raw.showMemberLevel !== false, showMessageTime: raw.showMessageTime === true, showCostTime: raw.showCostTime !== false,
  isPinned: raw.isPinned === true, unread: Number(raw.unread || 0), groups: Array.isArray(raw.groups) ? raw.groups : [],
  createdAt: Number(raw.createdAt || Date.now()), updatedAt: Number(raw.updatedAt || Date.now()), preview: raw.preview || '', time: raw.time || '刚刚', avatarText: '群', avatarUrl: String(raw.avatarUrl || ''), hasCustomAvatar: raw.hasCustomAvatar === true, isTyping: raw.isTyping === true,
  pendingUserThought: String(raw.pendingUserThought || ''), innerThoughts: Array.isArray(raw.innerThoughts) ? raw.innerThoughts : [], memberInnerThoughts: raw.memberInnerThoughts || {},
  enableAutoThought: raw.enableAutoThought !== false, enableRoleThoughtHistory: raw.enableRoleThoughtHistory !== false,
  roleThoughtHistoryCount: Math.max(1, Number(raw.roleThoughtHistoryCount || 12)), enableUserThoughtHistory: raw.enableUserThoughtHistory !== false,
  userThoughtHistoryCount: Math.max(1, Number(raw.userThoughtHistoryCount || 12)), innerThoughtLimit: Math.max(1, Math.min(1000, Number(raw.innerThoughtLimit || 50))), offlineMeetEnabled: raw.offlineMeetEnabled === true,
  offlineMeetMode: raw.offlineMeetMode === 'separate' ? 'separate' : 'mixed', offlinePresetId: String(raw.offlinePresetId || ''),
  offlineModelProfile: (['auto', 'openai-compatible', 'openai-responses', 'deepseek-chat', 'deepseek-reasoner', 'glm', 'claude', 'gemini'].includes(raw.offlineModelProfile) ? raw.offlineModelProfile : 'auto') as OfflineModelProfile, offlineMeetLocationMode: raw.offlineMeetLocationMode === 'continuous' ? 'continuous' : 'vague', isMixedOfflineActive: raw.isMixedOfflineActive === true,
  activeCallType: raw.activeCallType === 'voice' || raw.activeCallType === 'video' ? raw.activeCallType : null,
  activeCallStartedAt: Math.max(0, Number(raw.activeCallStartedAt || 0)), activeCallStartMessageId: Math.max(0, Number(raw.activeCallStartMessageId || 0)),
  callSummaries: Array.isArray(raw.callSummaries) ? raw.callSummaries : [],
  referenceMemberEmojiLibraries: raw.referenceMemberEmojiLibraries !== false,
  memberEmojiLibraryEnabled: raw.memberEmojiLibraryEnabled && typeof raw.memberEmojiLibraryEnabled === 'object' ? raw.memberEmojiLibraryEnabled : {},
  emojiVisionScope: raw.emojiVisionScope === 'all_members' ? 'all_members' : 'enabled_members',
  imageRecognitionMode: raw.imageRecognitionMode === 'description_only' ? 'description_only' : 'visual',
  voiceCallMemoryValue: Math.max(1, Math.min(200, Number(raw.voiceCallMemoryValue || 24))),
  videoCallMemoryValue: Math.max(1, Math.min(200, Number(raw.videoCallMemoryValue || 16))),
  callSummaryFrequency: Math.max(4, Math.min(100, Number(raw.callSummaryFrequency || 20))),
  activeCallTemporarySummary: String(raw.activeCallTemporarySummary || ''),
  disableMediaDuringCall: raw.disableMediaDuringCall === true,
  disableThoughtDuringCall: raw.disableThoughtDuringCall === true,
  disableMediaDuringOffline: raw.disableMediaDuringOffline === true,
  disableThoughtDuringOffline: raw.disableThoughtDuringOffline === true,
  autonomyEnabled: raw.autonomyEnabled === true,
  autonomyAllowMessages: raw.autonomyAllowMessages !== false,
  autonomyAllowMentions: raw.autonomyAllowMentions !== false,
  autonomyAllowStatusEvents: raw.autonomyAllowStatusEvents !== false,
  autonomyAllowIncomingCalls: raw.autonomyAllowIncomingCalls === true,
  autonomyActiveStart: Math.max(0, Math.min(23, Number(raw.autonomyActiveStart ?? 8))),
  autonomyActiveEnd: Math.max(1, Math.min(24, Number(raw.autonomyActiveEnd ?? 24))),
  autonomyMinIntervalMinutes: Math.max(5, Math.min(10080, Number(raw.autonomyMinIntervalMinutes || 90))),
  autonomyMaxMessagesPerDay: Math.max(1, Math.min(50, Number(raw.autonomyMaxMessagesPerDay || 8))),
  autonomyLastRunAt: Math.max(0, Number(raw.autonomyLastRunAt || 0)),
  autonomyDailyCount: Math.max(0, Number(raw.autonomyDailyCount || 0)),
  autonomyDailyDate: String(raw.autonomyDailyDate || ''),
  incomingCallEnabled: raw.incomingCallEnabled === true,
  incomingCallStartHour: Math.max(0, Math.min(23, Number(raw.incomingCallStartHour ?? 9))),
  incomingCallEndHour: Math.max(1, Math.min(24, Number(raw.incomingCallEndHour ?? 23))),
  incomingCallMinIntervalMinutes: Math.max(30, Math.min(10080, Number(raw.incomingCallMinIntervalMinutes || 360))),
  incomingCallLastAt: Math.max(0, Number(raw.incomingCallLastAt || 0)),
  ownerId: String(raw.ownerId || 'user'), adminIds: Array.isArray(raw.adminIds) ? raw.adminIds.map(String) : [],
  isWholeGroupMuted: raw.isWholeGroupMuted === true, aiManagementMode: raw.aiManagementMode,
  levelTitles: raw.levelTitles, stageTitles: raw.stageTitles, memberPoints: raw.memberPoints, memberMutes: raw.memberMutes,
  memberSpecialTitles: raw.memberSpecialTitles, announcements: raw.announcements, adminLogs: raw.adminLogs,
  memberActivityDaily: raw.memberActivityDaily, removedMembers: raw.removedMembers,
  membershipRequests: raw.membershipRequests, atAllDaily: raw.atAllDaily,
  managementSchemaVersion: Number(raw.managementSchemaVersion || 0)
}) as GroupChatRecord

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
  const groupUserProfile = userProfile || group.userProfile || {}
  const allMembers = group.memberIds.map(id => allChats.find(chat => chat.chatType !== 'group' && String(chat.characterEntityId || chat.id) === id)).filter(Boolean)
  const speakableIds = new Set(getSpeakableCharacterIds(group))
  const replyCandidates = allMembers.filter(member => speakableIds.has(memberIdentity(member)))
  const members = group.activeCallType
    ? replyCandidates.filter(member => {
        const id = memberIdentity(member)
        const effective = { ...member, ...(group.memberSettings[id] || {}) }
        return group.activeCallType === 'voice' ? effective.enableVoiceCall : effective.enableVideoCall
      })
    : replyCandidates
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
      timezone: group.memberTimezones[id] || member.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
      clockMode: group.memberTimezones[id] ? 'timezone' : (member.clockMode || (member.timezone ? 'timezone' : 'system')),
      clockAnchorRealAt: Number(member.clockAnchorRealAt || Date.now()),
      clockAnchorTimeAt: Number(member.clockAnchorTimeAt || Date.now()),
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
    const includePrivateRoleLibrary = group.referenceMemberEmojiLibraries && group.memberEmojiLibraryEnabled[id] !== false
    const roleEmojiItems = selectRoleAvailableEmojis(emojiItems, id, { groupId: group.id, includePrivateRoleLibrary })
    const roleEmojiNames = isolatedMember.enableRoleEmojiVision
      ? roleEmojiItems.map(item => `${item.name}（emoji_id=${item.id}）`).filter(Boolean).join('、')
      : ''
    const basePrompt = buildSystemPrompt(isolatedMember, roleEmojiNames || '无', false, offlineMode as any, undefined, 'group')
    const bilingualPrompt = buildBilingualPrompt(isolatedMember)
    const thoughtContext = buildInnerThoughtContext(isolatedMember, group.pendingUserThought || '', turnId)
    const boundTimelineId = String(group.memberTimelineBindings?.[id] || member.timelineState?.activeTimelineId || 'main')
    const { currentChatUserId } = useChatAuth()
    const boundMember = await loadTimelineChatView(member, currentChatUserId.value, boundTimelineId)
    const singleMemoryBridge = await buildSingleToGroupBridgeContext(group, boundMember, id, memoryQuery)
    const subjectiveMemory = normalizeMemoryMode(group.memoryMode) === 'long_text'
      ? await buildMemoryPacket({
        id: `${group.id}:member:${id}`,
        memoryMode: 'long_text',
        memoryBook: group.memberMemories[id] || [],
        memoryState: null
      }, memoryQuery, undefined, { allowEmbedding: false })
      : ''
    return `<member_context id="${escapeXml(id)}" display_name="${escapeXml(nickname)}">\n${basePrompt}${bilingualPrompt ? `\n\n${bilingualPrompt}` : ''}${thoughtContext ? `\n\n${thoughtContext}` : ''}${subjectiveMemory ? `\n\n【只属于${nickname}的群内主观记忆】${subjectiveMemory}` : ''}${singleMemoryBridge ? `\n\n${singleMemoryBridge}` : ''}\n</member_context>`
  }))
  const roster = members.map(member => `${group.memberNicknames[memberIdentity(member)] || member.name}（ID：${memberIdentity(member)}）`).join('\n')
  const sharedMemory = await buildMemoryPacket(group, memoryQuery, group.memoryTokenBudget)
  let system = `【群聊场景】\n以下内容共同构成一个正在持续发生的真实多人群聊。只呈现群内实际发生的消息与动作，不额外解释生成过程。每位成员都有独立、完整且持续一致的人格、经历、认知和表达方式；每名成员只依据本人亲历、看见、听见或被明确告知的信息行动，不共享其他成员的私密认知，也不使用同一种声音。\n\n【成员边界】\n每个 <member_context> 只属于其 id 对应的成员，其中的人设、行为规则、记忆、状态和心声均不得移给其他成员或用户。\n\n${memberContexts.join('\n\n')}\n\n${getActiveGroupPrompt()}\n\n【当前群聊】\n群名：${group.name}\n用户：${groupUserProfile?.name || '我'}（ID：user）${groupUserProfile?.persona ? `\n用户在本群的身份：${groupUserProfile.persona}` : ''}\n\n【可用成员清单】\n${roster}`
  system += `\n\n${buildGroupManagementPrompt(group)}`
  if (group.timePerception) {
    const now = Date.now()
    const memberTimes = members.map(member => {
      const id = memberIdentity(member)
      const memberClock = group.memberTimezones[id] ? { ...member, timezone: group.memberTimezones[id], clockMode: 'timezone' } : member
      return `${group.memberNicknames[id] || member.name}：${getIdentityClockLabel(memberClock)} ${formatIdentityDateTime(memberClock, now)}`
    }).join('\n')
    system += `\n\n【群聊成员独立时间】\n用户：${getIdentityClockLabel(groupUserProfile)} ${formatIdentityDateTime(groupUserProfile, now)}\n${memberTimes}\n以上是每个人各自独立的当地时间。任何成员都不得把用户或其他成员的钟表时间当成自己的时间；日期、昼夜、作息和节日判断分别依据本人时间。消息等待时长只按 timeline_at 判断，不得直接用不同时区的表面钟点相减；消息 id 只是引用用的不透明标识，禁止将其解析为日期或间隔。不要机械报时。`
  }
  if (group.bubbleNarrationEnabled) system += `\n\n【群聊气泡叙事】\n线上对白继续使用 kind="text" 的 group_msg；动作、神态、心理或环境描写使用对应成员 sender 且 kind="narration" 的 group_msg。叙述必须保持发送成员身份明确，不得替用户决定行动或感受。`
  if (group.enableMsgCountLimit) system += `\n\n【群聊回复条数限制】\n本次回复总共输出 ${group.minMsgCount} 到 ${Math.max(group.minMsgCount, group.maxMsgCount)} 个 group_msg；这是全群总量，不是每位成员各自的数量。仍由现场语境决定谁发言，禁止为了凑数让所有成员轮流发言。`
  if (group.activeCallType) system += `\n\n【当前群通话】\n用户正与已开启群内${group.activeCallType === 'video' ? '视频' : '语音'}通话接入的成员进行实时群通话。只能由上方当前成员清单中的成员参与；表达应符合口语实时对话，不要把通话内容写成普通文字聊天。`
  if (group.activeCallType && group.activeCallTemporarySummary) system += `\n\n【本次群通话较早内容的临时摘要】\n${group.activeCallTemporarySummary}`
  const offlineActive = group.offlineMeetEnabled && (group.offlineMeetMode === 'separate' || group.isMixedOfflineActive)
  if ((group.activeCallType && group.disableMediaDuringCall) || (offlineActive && group.disableMediaDuringOffline)) system += `\n\n【当前场景功能限制】\n本轮禁止发送 image、voice、emoji、transfer、red_packet 或 call 类型，只能输出文字或叙事。`
  if ((group.activeCallType && group.disableThoughtDuringCall) || (offlineActive && group.disableThoughtDuringOffline)) system += `\n\n【当前场景心声限制】\n本轮禁止输出 group_inner_thought。`
  system += `\n\n【群表情精确协议】\n发送表情时必须使用 <group_msg sender="成员ID" kind="emoji" emoji_id="表情ID">表情名称</group_msg>。只能使用该成员上下文中列出的表情；同名时必须依 emoji_id 区分。`
  if (group.emojiVisionScope === 'enabled_members') system += `\n表情图像按成员授权隔离；标注为某成员专属视觉的图片，其他成员不得据此形成认知或反应。`
  if (group.groupContext.trim()) system += `\n\n【可选群背景】\n${group.groupContext.trim()}`
  if ((group as any).pendingAutonomyDirective) system += `\n\n【本轮群成员自主活动】\n${escapeXml((group as any).pendingAutonomyDirective)}\n本轮由群成员自行决定是否发言；不得假装用户刚刚发送了新消息。${group.autonomyAllowMentions ? '允许自然提及用户或其他成员。' : '禁止使用 mentions 主动提及任何人。'}`
  if (sharedMemory) system += `\n\n【群内共同记忆】${sharedMemory}`
  if (worldBookText.trim()) system += `\n\n【群世界设定】\n${worldBookText.trim()}`
  const valid = group.messages.filter(message => {
    if (!['left', 'right', 'system', 'narration'].includes(message.type) || message.isRecalled || message.isUndelivered) return false
    // 过滤掉等级提升系统通知，确保 AI 角色完全不感知群等级变化
    if (message.type === 'system' && message.managementEvent?.type === 'level_up') return false
    if (!group.activeCallType) return !message.isVoiceCallProcessMsg && !message.isVideoCallProcessMsg
    if (group.activeCallType === 'voice') return !message.isVideoCallProcessMsg
    return !message.isVoiceCallProcessMsg
  })
  let history = valid
  if (group.activeCallType) history = valid.slice(-(group.activeCallType === 'voice' ? group.voiceCallMemoryValue : group.videoCallMemoryValue))
  else if (group.memoryType === 'count') history = valid.slice(-group.memoryValue)
  else {
    const userIndexes = valid.map((message, index) => message.type === 'right' ? index : -1).filter(index => index >= 0)
    const start = userIndexes[Math.max(0, userIndexes.length - group.memoryValue)]
    history = typeof start === 'number' ? valid.slice(start) : valid
  }
  const encodedHistory: any[] = []
  for (const message of history) {
      const timestamp = getConversationAdjustedTimestamp(group, Number(message.timestamp || message.id))
      const includeTime = group.timePerception && Number.isFinite(timestamp) && (message.type !== 'left' || group.sendCharacterTime)
      const senderClock = message.type === 'right'
        ? groupUserProfile
        : (() => {
          const member = members.find(item => memberIdentity(item) === String(message.senderId)) || {}
          const timezone = group.memberTimezones[String(message.senderId)]
          return timezone ? { ...member, timezone, clockMode: 'timezone' } : member
        })()
      const timeAttr = includeTime
        ? ` time="${escapeXml(formatIdentityDateTime(senderClock, timestamp).replace(/\//g, '-'))}" timeline_at="${new Date(timestamp).toISOString()}"`
        : ''
      const encoded: any = message.type === 'right'
        ? { role: 'user', content: `<group_user_msg id="${message.id}"${timeAttr} kind="${message.messageType || 'text'}" reply_to="${message.replyToMessageId || ''}" mentions="${(message.mentions || []).map((item: any) => item.id).join(',')}">${escapeXml(describeMessage(message))}</group_user_msg>` }
        : { role: message.type === 'system' ? 'system' : 'assistant', content: message.type === 'system' ? escapeXml(message.content) : `<group_history_msg id="${message.id}"${timeAttr} sender="${message.senderId}" kind="${message.messageType || 'text'}" reply_to="${message.replyToMessageId || ''}">${escapeXml(describeMessage(message))}</group_history_msg>` }
      encoded._turnId = message.turnId
      encoded._providerState = message.providerState
      if (message.type === 'right' && message.imageData?.imageId && group.imageRecognitionMode === 'visual') {
        const imageStore = localforage.createInstance({ name: 'nrt-app', storeName: 'chatImages' })
        const imageUrl = await imageStore.getItem<string>(message.imageData.imageId)
        if (imageUrl) encoded.content = [
          { type: 'text', text: encoded.content },
          { type: 'image_url', image_url: { url: imageUrl } }
        ] as any
      }
      const emojiVisionMembers = members.filter(member => ({ ...member, ...(group.memberSettings[memberIdentity(member)] || {}) }).enableEmojiVision)
      if (message.type === 'right' && message.isEmoji && message.emojiId && emojiVisionMembers.length) {
        const emoji = emojiItems.find(item => String(item.id) === String(message.emojiId))
        let emojiUrl = emoji?.type === 'url' && typeof emoji.data === 'string' ? emoji.data : ''
        if (!emojiUrl && emoji?.type === 'local' && emoji.data instanceof Blob) {
          try { emojiUrl = await blobToDataUrl(emoji.data) } catch { emojiUrl = '' }
        }
        if (emojiUrl) encoded.content = [
          { type: 'text', text: `${encoded.content}\n[表情视觉授权：${group.emojiVisionScope === 'all_members' ? '全体成员' : emojiVisionMembers.map(member => group.memberNicknames[memberIdentity(member)] || member.name).join('、')}]` },
          { type: 'image_url', image_url: { url: emojiUrl } }
        ] as any
      }
      encodedHistory.push(encoded)
  }
  const roleEmojiVisualContent: any[] = []
  const visualEmojiAuthorizations = new Map<string, { emoji: any; memberNames: string[] }>()
  for (const member of members) {
    const id = memberIdentity(member)
    const effective = { ...member, ...(group.memberSettings[id] || {}) }
    if (!effective.enableRoleEmojiVision) continue
    const available = selectRoleAvailableEmojis(emojiItems, id, { groupId: group.id, includePrivateRoleLibrary: group.referenceMemberEmojiLibraries && group.memberEmojiLibraryEnabled[id] !== false })
    for (const emoji of available) {
      const authorization = visualEmojiAuthorizations.get(String(emoji.id)) || { emoji, memberNames: [] }
      authorization.memberNames.push(group.memberNicknames[id] || member.name)
      visualEmojiAuthorizations.set(String(emoji.id), authorization)
    }
  }
  for (const { emoji, memberNames } of visualEmojiAuthorizations.values()) {
    let emojiUrl = emoji.type === 'url' && typeof emoji.data === 'string' ? emoji.data : ''
    if (!emojiUrl && emoji.type === 'local' && emoji.data instanceof Blob) {
      try { emojiUrl = await blobToDataUrl(emoji.data) } catch { emojiUrl = '' }
    }
    if (!emojiUrl) continue
    roleEmojiVisualContent.push({ type: 'text', text: `\n[仅授权${Array.from(new Set(memberNames)).join('、')}识别与选择] 表情「${emoji.name}」(emoji_id=${emoji.id}) 图像：` })
    roleEmojiVisualContent.push({ type: 'image_url', image_url: { url: emojiUrl } })
  }
  const systemContent = roleEmojiVisualContent.length ? [{ type: 'text', text: system }, ...roleEmojiVisualContent] : system
  return [{ role: 'system', content: systemContent }, ...encodedHistory]
}

export const parseGroupResponse = (raw: string, allowedIds: string[], formerIds: string[] = []) => {
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
    messages.push({ senderId, key: attrs.match(/\bkey=["']([^"']*)["']/i)?.[1] || '', emojiId: attrs.match(/\bemoji_id=["']([^"']*)["']/i)?.[1] || '', content, translation: parsed.translation, contentLanguage: parsed.contentLanguage, translationLanguage: parsed.translationLanguage, messageType: attrs.match(/\bkind=["']([^"']*)["']/i)?.[1] || 'text', amount: Number(attrs.match(/\bamount=["']([^"']*)["']/i)?.[1] || 0), remark: attrs.match(/\bremark=["']([^"']*)["']/i)?.[1] || '', replyToMessageId: attrs.match(/\breply_to=["']([^"']*)["']/i)?.[1] || '', mentions: (attrs.match(/\bmentions=["']([^"']*)["']/i)?.[1] || '').split(',').map(item => item.trim()).filter(id => allowedIds.includes(id) || id === 'user' || id === 'all') })
  }
  const thoughts: any[] = []
  const thoughtRegex = /<group_inner_thought\s+sender=["']([^"']+)["']>([\s\S]*?)<\/group_inner_thought>/gi
  while ((match = thoughtRegex.exec(raw)) !== null) if (allowedIds.includes(match[1]) && match[2].trim()) thoughts.push({ senderId: match[1], content: match[2].trim() })
  const managementActions: any[] = []
  const managementRegex = /<group_management\s+([^>]*)>([\s\S]*?)<\/group_management>/gi
  while ((match = managementRegex.exec(raw)) !== null) {
    const attrs = match[1]
    const senderId = attrs.match(/\bsender=["']([^"']+)["']/i)?.[1] || ''
    const targetId = attrs.match(/\btarget=["']([^"']+)["']/i)?.[1] || ''
    const action = attrs.match(/\baction=["'](mute|unmute)["']/i)?.[1]?.toLowerCase() || ''
    const durationSeconds = Math.max(1, Math.min(86400, Number(attrs.match(/\bduration=["']([^"']+)["']/i)?.[1] || 600)))
    if (allowedIds.includes(senderId) && (allowedIds.includes(targetId) || targetId === 'user') && action) managementActions.push({ senderId, targetId, action, durationSeconds, reason: match[2].trim().slice(0, 200) })
  }
  const announcementAcks: any[] = []
  const announcementAckRegex = /<group_announcement_ack\s+([^>]*)\/>/gi
  while ((match = announcementAckRegex.exec(raw)) !== null) {
    const attrs = match[1]
    const senderId = attrs.match(/\bsender=["']([^"']+)["']/i)?.[1] || ''
    const announcementId = attrs.match(/\bannouncement_id=["']([^"']+)["']/i)?.[1] || ''
    if (allowedIds.includes(senderId) && announcementId) announcementAcks.push({ senderId, announcementId })
  }
  const adminActions: any[] = []
  const adminActionRegex = /<group_admin_action\s+([^>]*)>([\s\S]*?)<\/group_admin_action>/gi
  while ((match = adminActionRegex.exec(raw)) !== null) {
    const attrs = match[1]; const senderId = attrs.match(/\bsender=["']([^"']+)["']/i)?.[1] || ''; const action = attrs.match(/\baction=["'](announcement|group_name|group_context|kick|recall|rename|invite|special_title|leave)["']/i)?.[1]?.toLowerCase() || ''
    if (!allowedIds.includes(senderId) || !action) continue
    adminActions.push({ senderId, action, targetId: attrs.match(/\btarget=["']([^"']*)["']/i)?.[1] || '', messageId: attrs.match(/\bmessage_id=["']([^"']*)["']/i)?.[1] || '', title: attrs.match(/\btitle=["']([^"']*)["']/i)?.[1] || '', pinned: /\bpinned=["']true["']/i.test(attrs), needConfirm: /\bneed_confirm=["']true["']/i.test(attrs), content: match[2].trim().slice(0, 5000) })
  }
  const membershipActions: any[] = []
  const membershipRegex = /<group_membership_action\s+([^>]*)>([\s\S]*?)<\/group_membership_action>/gi
  while ((match = membershipRegex.exec(raw)) !== null) {
    const attrs = match[1]; const senderId = attrs.match(/\bsender=["']([^"']+)["']/i)?.[1] || ''; const action = attrs.match(/\baction=["'](apply|accept_invite|reject_invite)["']/i)?.[1]?.toLowerCase() || ''
    if (!formerIds.includes(senderId) || !action) continue
    membershipActions.push({ senderId, action, requestId: attrs.match(/\brequest_id=["']([^"']*)["']/i)?.[1] || '', message: match[2].trim().slice(0, 240) })
  }
  return { messages, thoughts, managementActions, adminActions, membershipActions, announcementAcks, idle: /<group_idle\s*\/>/i.test(raw) }
}

export const requestGroupReply = async (group: GroupChatRecord, allChats: any[], userProfile: any, signal?: AbortSignal, worldBookText = '') => {
  const payload = await buildGroupChatMessages(group, allChats, userProfile, worldBookText)
  const offlineActive = group.offlineMeetEnabled && (group.offlineMeetMode === 'separate' || group.isMixedOfflineActive)
  const activeMemories = await getMemoryExportItems(group)
  const latestUserMessage = [...group.messages].reverse().find((message: any) => message.type === 'right' && !message.isUndelivered)
  const result = await sendChatMessage(
    payload,
    signal,
    false,
    false,
    'default',
    offlineActive ? (group.offlineModelProfile || 'auto') : 'auto',
    { chatId: group.id, chatName: group.name, memoryEntries: activeMemories.map((item: any) => item.text) },
    false,
    {
      enabled: group.webSearchEnabled === true && !group.activeCallType,
      mode: webSearchSettings.mode,
      query: String(latestUserMessage?.content || ''),
      selfHostedUrl: webSearchSettings.selfHostedUrl,
      selfHostedToken: webSearchSettings.selfHostedToken,
      maxResults: webSearchSettings.maxResults,
      timeoutSeconds: webSearchSettings.timeoutSeconds
    }
  )
  const raw = typeof result === 'string' ? result : result.content
  return {
    ...parseGroupResponse(raw, getSpeakableCharacterIds(group), Object.keys(group.removedMembers || {})),
    thinking: typeof result === 'string' ? '' : (result.thinking || ''),
    reasoningSource: typeof result === 'string' ? 'none' : (result.reasoningSource || (result.thinking ? 'native' : 'none')),
    providerState: typeof result === 'string' ? undefined : result.providerState,
    webSearch: typeof result === 'string' ? undefined : result.webSearch
  }
}
