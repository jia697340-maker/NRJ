/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import localforage from 'localforage'
import { activeGroupReplyIds, requestGroupReply, saveGroupChat, type GroupChatRecord } from './groupChat'
import { formatIdentityClockTime, formatIdentityDateTime, isConversationTimePaused } from './conversationTime'
import { findRoleEmojiByResponse } from './chatEmojiScope'

const inHourRange = (hour: number, start: number, end: number) => start < end
  ? hour >= start && hour < end
  : hour >= start || hour < end

const memberId = (member: any) => String(member.characterEntityId || member.id)
const identityHour = (member: any, timestamp: number) => {
  const value = formatIdentityDateTime(member, timestamp, undefined, { hour: '2-digit', hourCycle: 'h23' })
  return Number(value.replace(/\D/g, '').slice(0, 2))
}

const loadEmojiItems = async () => {
  const items: any[] = []
  try {
    const store = localforage.createInstance({ name: 'nrt-app', storeName: 'chatEmojis' })
    await store.iterate((value: any, key: string) => { if (key !== '__emoji_groups__' && value?.id) items.push(value) })
  } catch { /* Background autonomy can continue with text when IndexedDB is unavailable. */ }
  return items
}

const appendAutonomousReplies = async (group: GroupChatRecord, result: any, allChats: any[]) => {
  const emojiItems = await loadEmojiItems()
  const now = Date.now()
  result.messages.forEach((message: any, index: number) => {
    if (!['text', 'narration', 'emoji'].includes(message.messageType || 'text')) return
    const member = allChats.find(chat => chat.chatType !== 'group' && memberId(chat) === String(message.senderId))
    if (!member) return
    const effective = { ...member, ...(group.memberSettings[String(message.senderId)] || {}) }
    const item: any = {
      id: now + index,
      timestamp: now + index,
      type: message.messageType === 'narration' ? 'narration' : 'left',
      messageType: message.messageType || 'text',
      senderType: 'character',
      senderId: String(message.senderId),
      senderNameSnapshot: group.memberNicknames[String(message.senderId)] || member.name,
      senderAvatarSnapshot: member.avatarUrl || '',
      content: message.content,
      mentions: (message.mentions || []).map((id: string) => ({ type: id === 'user' ? 'user' : 'character', id })),
      isAutonomous: true,
      turnId: `group_autonomy_${now}`,
      sequence: index
    }
    if (message.messageType === 'emoji' && effective.enableRoleEmojiVision) {
      const emoji: any = findRoleEmojiByResponse(emojiItems, String(message.senderId), { id: message.emojiId, name: message.content }, { groupId: group.id, includePrivateRoleLibrary: group.referenceMemberEmojiLibraries && group.memberEmojiLibraryEnabled[String(message.senderId)] !== false })
      if (!emoji) return
      item.isEmoji = true
      item.emojiId = emoji.id
      item.emojiSummary = emoji.name
      item.content = emoji.name
      item.emojiUrl = emoji.type === 'url' ? emoji.data : (emoji.data instanceof Blob ? URL.createObjectURL(emoji.data) : '')
    }
    group.messages.push(item)
  })
  const last = group.messages.at(-1)
  if (last) { group.preview = last.content || '群内有新动态'; group.time = formatIdentityClockTime(group.userProfile || {}) }
}

const startIncomingCall = (group: GroupChatRecord, allChats: any[], now: number) => {
  const candidates = group.memberIds.map(id => allChats.find(chat => chat.chatType !== 'group' && memberId(chat) === id)).filter(Boolean).map(member => {
    const id = memberId(member)
    const timezone = group.memberTimezones?.[id]
    return { ...member, ...(group.memberSettings[id] || {}), ...(timezone ? { timezone, clockMode: 'timezone' } : {}) }
  }).filter(member => member.allowIncomingGroupCall !== false && (member.enableVoiceCall || member.enableVideoCall) && inHourRange(identityHour(member, now), Number(group.incomingCallStartHour), Number(group.incomingCallEndHour)))
  if (!candidates.length || group.activeCallType) return false
  const member = candidates[Math.floor(Math.random() * candidates.length)]
  const id = memberId(member)
  const kind: 'voice' | 'video' = member.enableVideoCall && !member.enableVoiceCall ? 'video' : 'voice'
  group.activeCallType = kind
  group.activeCallStartedAt = now
  group.activeCallStartMessageId = now
  group.activeCallTemporarySummary = ''
  group.incomingCallLastAt = now
  group.messages.push({ id: now, timestamp: now, type: 'left', senderType: 'character', senderId: id, senderNameSnapshot: group.memberNicknames[id] || member.name, senderAvatarSnapshot: member.avatarUrl || '', content: `${group.memberNicknames[id] || member.name}发起了群${kind === 'voice' ? '语音' : '视频'}通话`, messageType: 'call', isAutonomous: true, callData: { callType: kind, status: 'incoming', participantIds: candidates.map(memberId) } })
  group.preview = `${group.memberNicknames[id] || member.name}发起了群${kind === 'voice' ? '语音' : '视频'}通话`
  group.time = formatIdentityClockTime(group.userProfile || {}, now)
  group.unread = Number(group.unread || 0) + 1
  return true
}

export const runDueGroupAutonomyChecks = async (allChats: any[], userProfile: any, accountId?: string | null) => {
  const now = Date.now()
  const today = new Date(now).toLocaleDateString('zh-CN')
  const groups = allChats.filter(chat => chat.chatType === 'group') as GroupChatRecord[]
  for (const group of groups) {
    if (!group.autonomyEnabled || isConversationTimePaused(group) || activeGroupReplyIds.has(String(group.id))) continue
    const activeMembers = group.memberIds
      .map(id => allChats.find(chat => chat.chatType !== 'group' && memberId(chat) === id))
      .filter(Boolean)
      .map(member => {
        const id = memberId(member)
        const timezone = group.memberTimezones?.[id]
        return timezone ? { ...member, timezone, clockMode: 'timezone' } : member
      })
    const hasMemberInActiveHours = activeMembers.some(member => inHourRange(identityHour(member, now), Number(group.autonomyActiveStart), Number(group.autonomyActiveEnd)))
    if (group.autonomyDailyDate !== today) { group.autonomyDailyDate = today; group.autonomyDailyCount = 0 }
    if (group.autonomyDailyCount >= group.autonomyMaxMessagesPerDay) continue
    if (now - Number(group.autonomyLastRunAt || 0) < Number(group.autonomyMinIntervalMinutes || 90) * 60000) continue
    if (!hasMemberInActiveHours) continue
    group.autonomyLastRunAt = now
    group.autonomyDailyCount += 1
    const callDue = group.incomingCallEnabled && group.autonomyAllowIncomingCalls
      && now - Number(group.incomingCallLastAt || 0) >= Number(group.incomingCallMinIntervalMinutes || 360) * 60000
      && group.autonomyDailyCount % 3 === 0
    if (callDue && startIncomingCall(group, allChats, now)) {
      saveGroupChat(accountId, group)
      continue
    }
    if (!group.autonomyAllowMessages || group.activeCallType) { saveGroupChat(accountId, group); continue }
    ;(group as any).pendingAutonomyDirective = `结合群聊最近上下文、各成员当前状态与时间，让真正有动机的零到数名成员自然发起一次群内活动。只允许 text、narration 或 emoji，不得伪造用户新消息。${group.autonomyAllowStatusEvents ? '可以用 narration 自然表达上线、离开、正在做某事等群内状态事件。' : '不要生成群内状态事件。'}`
    try {
      activeGroupReplyIds.add(String(group.id))
      const result = await requestGroupReply(group, allChats, group.userProfile || userProfile)
      await appendAutonomousReplies(group, result, allChats)
      if (result.messages.length) group.unread = Number(group.unread || 0) + result.messages.length
    } catch { /* Keep the scheduled runtime quiet; the next interval can retry after the configured delay. */ }
    finally {
      activeGroupReplyIds.delete(String(group.id))
      ;(group as any).pendingAutonomyDirective = ''
      saveGroupChat(accountId, group)
    }
  }
}
