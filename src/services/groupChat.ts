/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { getActiveGroupPrompt } from '../store'
import { sendChatMessage } from './api'
import { buildSystemPrompt } from '../composables/chatState/prompt'
import { buildBilingualPrompt, parseBilingualMessage } from './bilingualChat'
import { buildInnerThoughtContext } from './innerThoughtContext'
import { reactive } from 'vue'

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
  messages: any[]
  memoryBook: any[]
  memberMemories: Record<string, any[]>
  boundWorldBooks: string[]
  userProfile: any
  userProfileSource: any
  memoryType: 'count' | 'round'
  memoryValue: number
  timePerception: boolean
  bilingualEnabled: boolean
  translationDisplay: string
  notificationMode: 'all' | 'mention' | 'mute'
  showMemberNames: boolean
  showMemberAvatars: boolean
  showMessageTime: boolean
  isPinned: boolean
  unread: number
  groups: string[]
  createdAt: number
  updatedAt: number
  preview?: string
  time?: string
  avatarText?: string
  isTyping?: boolean
  pendingUserThought?: string
  innerThoughts?: any[]
  memberInnerThoughts?: Record<string, any[]>
  enableAutoThought?: boolean
  enableRoleThoughtHistory?: boolean
  roleThoughtHistoryCount?: number
  enableUserThoughtHistory?: boolean
  userThoughtHistoryCount?: number
  offlineMeetEnabled?: boolean
  offlineMeetMode?: 'mixed' | 'separate'
  offlinePresetId?: string
  isMixedOfflineActive?: boolean
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

export const normalizeGroupChat = (raw: any): GroupChatRecord => ({
  id: String(raw.id || `group_${Date.now()}`), chatType: 'group', name: String(raw.name || '未命名群聊'),
  groupContext: String(raw.groupContext || ''), memberIds: Array.isArray(raw.memberIds) ? raw.memberIds.map(String) : [],
  memberNotes: raw.memberNotes || {}, memberNicknames: raw.memberNicknames || {}, memberHasCustomAvatar: raw.memberHasCustomAvatar || {}, messages: Array.isArray(raw.messages) ? raw.messages : [],
  memoryBook: Array.isArray(raw.memoryBook) ? raw.memoryBook : [], memberMemories: raw.memberMemories || {},
  boundWorldBooks: Array.isArray(raw.boundWorldBooks) ? raw.boundWorldBooks : [], userProfile: raw.userProfile || null,
  userProfileSource: raw.userProfileSource || null, memoryType: raw.memoryType === 'round' ? 'round' : 'count',
  memoryValue: Math.max(1, Number(raw.memoryValue || 60)), timePerception: raw.timePerception !== false,
  bilingualEnabled: raw.bilingualEnabled === true, translationDisplay: raw.translationDisplay || 'tap',
  notificationMode: ['mention', 'mute'].includes(raw.notificationMode) ? raw.notificationMode : 'all',
  showMemberNames: raw.showMemberNames !== false, showMemberAvatars: raw.showMemberAvatars !== false, showMessageTime: raw.showMessageTime === true,
  isPinned: raw.isPinned === true, unread: Number(raw.unread || 0), groups: Array.isArray(raw.groups) ? raw.groups : [],
  createdAt: Number(raw.createdAt || Date.now()), updatedAt: Number(raw.updatedAt || Date.now()), preview: raw.preview || '', time: raw.time || '刚刚', avatarText: '群', isTyping: raw.isTyping === true,
  pendingUserThought: String(raw.pendingUserThought || ''), innerThoughts: Array.isArray(raw.innerThoughts) ? raw.innerThoughts : [], memberInnerThoughts: raw.memberInnerThoughts || {},
  enableAutoThought: raw.enableAutoThought !== false, enableRoleThoughtHistory: raw.enableRoleThoughtHistory !== false,
  roleThoughtHistoryCount: Math.max(1, Number(raw.roleThoughtHistoryCount || 12)), enableUserThoughtHistory: raw.enableUserThoughtHistory !== false,
  userThoughtHistoryCount: Math.max(1, Number(raw.userThoughtHistoryCount || 12)), offlineMeetEnabled: raw.offlineMeetEnabled === true,
  offlineMeetMode: raw.offlineMeetMode === 'separate' ? 'separate' : 'mixed', offlinePresetId: String(raw.offlinePresetId || ''), isMixedOfflineActive: raw.isMixedOfflineActive === true
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

const escapeXml = (value: unknown) => String(value ?? '').replace(/&/g, '&').replace(/</g, '<').replace(/>/g, '>')

const describeMessage = (message: any) => {
  if (message.isRecalled || message.type === 'system') return String(message.content || '')
  if (message.messageType === 'image') return `[图片${message.imageData?.description ? `：${message.imageData.description}` : ''}]`
  if (message.messageType === 'voice') return `[语音 ${message.voiceData?.duration || ''}秒：${message.voiceData?.text || message.content || ''}]`
  if (message.messageType === 'emoji') return `[表情包：${message.emojiData?.name || message.content || ''}]`
  if (message.messageType === 'transfer' || message.messageType === 'red_packet') return `[${message.messageType === 'transfer' ? '转账' : '红包'} ¥${message.transferData?.amount || ''}${message.transferData?.remark ? `，${message.transferData.remark}` : ''}]`
  if (message.messageType === 'call') return `[${message.callData?.callType === 'video' ? '视频' : '语音'}通话：${message.content || ''}]`
  return String(message.content || '')
}

const memberIdentity = (member: any) => String(member.characterEntityId || member.id)

export const buildGroupChatMessages = async (group: GroupChatRecord, allChats: any[], userProfile: any, worldBookText = '') => {
  const members = group.memberIds.map(id => allChats.find(chat => chat.chatType !== 'group' && String(chat.characterEntityId || chat.id) === id)).filter(Boolean)
  const latestUserMessage = [...group.messages].reverse().find(message => message.type === 'right')
  const turnId = String(latestUserMessage?.turnId || latestUserMessage?.id || '')
  const memberContexts = await Promise.all(members.map(async member => {
    const id = memberIdentity(member)
    const nickname = group.memberNicknames[id] || member.name
    const note = String(group.memberNotes[id] || '').trim()
    const groupMemory = (group.memberMemories[id] || []).slice(-12)
    // 如果存在群内独立人设，完全替换掉该成员在私聊中的基础 persona
    const isolatedMember = {
      ...member,
      name: nickname,
      persona: note || member.persona,
      userProfile: group.userProfile || userProfile,
      userProfileSource: group.userProfileSource || member.userProfileSource,
      innerThoughts: group.memberInnerThoughts?.[id] || [],
      enableAutoThought: group.enableAutoThought,
      enableRoleThoughtHistory: group.enableRoleThoughtHistory,
      roleThoughtHistoryCount: group.roleThoughtHistoryCount,
      enableUserThoughtHistory: group.enableUserThoughtHistory,
      userThoughtHistoryCount: group.userThoughtHistoryCount,
      offlineMeetEnabled: group.offlineMeetEnabled,
      offlineMeetMode: group.offlineMeetMode,
      offlinePresetId: group.offlinePresetId || member.offlinePresetId
    }
    const offlineMode = group.offlineMeetEnabled && (group.offlineMeetMode === 'separate' || group.isMixedOfflineActive) ? group.offlineMeetMode : false
    const basePrompt = buildSystemPrompt(isolatedMember, '无', false, offlineMode as any)
    const bilingualPrompt = buildBilingualPrompt(isolatedMember)
    const thoughtContext = buildInnerThoughtContext(isolatedMember, group.pendingUserThought || '', turnId)
    const subjectiveMemory = groupMemory.map((item: any) => item.content || item.summary || '').filter(Boolean).join('\n- ')
    return `<member_context id="${escapeXml(id)}" display_name="${escapeXml(nickname)}">\n${basePrompt}${bilingualPrompt ? `\n\n${bilingualPrompt}` : ''}${thoughtContext ? `\n\n${thoughtContext}` : ''}${subjectiveMemory ? `\n\n[该成员在本群的主观记忆]\n- ${subjectiveMemory}` : ''}\n</member_context>`
  }))
  const roster = members.map(member => `${group.memberNicknames[memberIdentity(member)] || member.name}（ID：${memberIdentity(member)}）`).join('\n')
  const sharedMemory = group.memoryBook.slice(-10).map((item: any) => item.content || item.summary || '').filter(Boolean).join('\n- ')
  let system = `[群聊组合方式]\n下面每个 member_context 都由应用当前启用的“单聊全局提示词”及该角色完整单聊设置生成，是对应成员的权威设定。群聊规则只负责让这些独立角色共同出现在一个现场，不能替换、削弱或扁平化任何成员的单聊设定。创作某成员时只读取该成员可见的信息；不得把其他 member_context 中的私密设定泄漏给他。\n\n${memberContexts.join('\n\n')}\n\n${getActiveGroupPrompt()}\n\n【当前群聊】\n群名：${group.name}\n用户：${userProfile?.name || '我'}（ID：user）${userProfile?.persona ? `\n用户在本群的身份：${userProfile.persona}` : ''}\n\n【可用成员清单】\n${roster}`
  if (group.timePerception) system += `\n\n【当前时间】\n${new Date().toLocaleString('zh-CN', { hour12: false })}。成员可以依据自己的作息和当前时间自然反应，但不要机械报时。`
  if (group.bilingualEnabled) system += `\n\n【语言表现】\n允许成员依据各自人设和现场语境自然切换或混合语言，不要强制所有成员逐句翻译，也不要让所有人的语言习惯趋同。`
  if (group.groupContext.trim()) system += `\n\n【可选群背景】\n${group.groupContext.trim()}`
  if (sharedMemory) system += `\n\n【群共享记忆】\n- ${sharedMemory}`
  if (worldBookText.trim()) system += `\n\n【群世界设定】\n${worldBookText.trim()}`
  const memoryDue = group.messages.filter(message => ['left', 'right'].includes(message.type)).length > 0 && group.messages.filter((message: any) => !message.groupMemoryCovered && ['left', 'right'].includes(message.type)).length >= 24
  if (memoryDue) system += `\n\n【同次记忆整理】\n在所有群消息之后额外输出一次 <group_memory_delta>{"shared":"群共同经历的简短摘要","members":{"成员ID":"该成员在群中的主观记忆"}}</group_memory_delta>。只基于历史事实；没有可沉淀内容则不要输出。`
  const valid = group.messages.filter(message => ['left', 'right', 'system'].includes(message.type))
  let history = valid
  if (group.memoryType === 'count') history = valid.slice(-group.memoryValue)
  else {
    const userIndexes = valid.map((message, index) => message.type === 'right' ? index : -1).filter(index => index >= 0)
    const start = userIndexes[Math.max(0, userIndexes.length - group.memoryValue)]
    history = typeof start === 'number' ? valid.slice(start) : valid
  }
  return [
    { role: 'system', content: system },
    ...history.map(message => message.type === 'right'
      ? { role: 'user', content: `<group_user_msg id="${message.id}" kind="${message.messageType || 'text'}" reply_to="${message.replyToMessageId || ''}" mentions="${(message.mentions || []).map((item: any) => item.id).join(',')}">${escapeXml(describeMessage(message))}</group_user_msg>` }
      : { role: message.type === 'system' ? 'system' : 'assistant', content: message.type === 'system' ? escapeXml(message.content) : `<group_history_msg id="${message.id}" sender="${message.senderId}" kind="${message.messageType || 'text'}" reply_to="${message.replyToMessageId || ''}">${escapeXml(describeMessage(message))}</group_history_msg>` })
  ]
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
  let memoryDelta: any = null
  const memoryRaw = raw.match(/<group_memory_delta>([\s\S]*?)<\/group_memory_delta>/i)?.[1]?.trim()
  if (memoryRaw) { try { memoryDelta = JSON.parse(memoryRaw) } catch {} }
  return { messages, thoughts, memoryDelta, idle: /<group_idle\s*\/>/i.test(raw) }
}

export const requestGroupReply = async (group: GroupChatRecord, allChats: any[], userProfile: any, signal?: AbortSignal, worldBookText = '') => {
  const payload = await buildGroupChatMessages(group, allChats, userProfile, worldBookText)
  const result = await sendChatMessage(payload, signal, false, false, 'default', 'auto', { chatId: group.id, chatName: group.name, memoryEntries: group.memoryBook.map((item: any) => item.content || '') })
  const raw = typeof result === 'string' ? result : result.content
  return { ...parseGroupResponse(raw, group.memberIds), thinking: typeof result === 'string' ? '' : (result.thinking || '') }
}

export const applyGroupMemoryDelta = (group: GroupChatRecord, delta: any, allChats: any[]) => {
  if (!delta || typeof delta !== 'object') return []
  const now = Date.now()
  if (String(delta.shared || '').trim()) group.memoryBook.push({ id: `group_memory_${now}`, content: String(delta.shared).trim(), createdAt: now, enabled: true, sourceGroupId: group.id })
  const changedContacts: any[] = []
  Object.entries(delta.members || {}).forEach(([memberId, content]) => {
    if (!String(content || '').trim() || !group.memberIds.includes(memberId)) return
    group.memberMemories[memberId] ||= []
    group.memberMemories[memberId].push({ id: `member_memory_${memberId}_${now}`, content: String(content).trim(), createdAt: now, sourceGroupId: group.id })
  })
  group.messages.forEach(message => { if (['left', 'right'].includes(message.type)) message.groupMemoryCovered = true })
  return changedContacts
}
