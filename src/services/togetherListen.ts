/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { computed, ref, watch } from 'vue'
import { useChatAuth } from '../composables/useChatAuth'
import { mockChats, myProfile } from '../composables/chatState/state'
import { getEffectiveUserProfile } from '../composables/useChatUserProfiles'
import { loadCustomContacts } from '../composables/chatState/contacts'
import { sendCapabilityMessage } from './api'
import { createMatchedListenerContact, searchCharacterDirectory } from './characterDirectory'
import { loadUserSocialProfile } from './userSocialProfile'
import { useMusicPlayer } from '../composables/useMusicPlayer'
import { musicHistory } from './musicRuntime'
import type { MusicTrack } from '../types/music'
import {
  defaultTogetherListenSettings,
  type TogetherListenFriendRequest,
  type TogetherListenMessage,
  type TogetherListenParticipant,
  type TogetherListenPersistedState,
  type TogetherListenSession,
  type TogetherListenSettings
} from '../types/togetherListen'

const STORAGE_PREFIX = 'clingy_together_listen_v1_'
const activeSession = ref<TogetherListenSession | null>(null)
const records = ref<TogetherListenSession[]>([])
const settings = ref<TogetherListenSettings>(defaultTogetherListenSettings())
const busy = ref(false)
const error = ref('')
const pendingCharacterInvite = ref<{ chatId: string | number; characterName: string; message: string; createdAt: number } | null>(null)
const initializedAccountId = ref('')
let runtimeReady = false
let previousTrackKey = ''
let lastAutomaticDecisionAt = 0

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value))
const uid = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
const cleanSocialId = (value: unknown, fallback: string) => {
  const cleaned = String(value || '').trim().replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 20)
  return cleaned.length >= 4 ? cleaned : fallback
}
const storageKey = (accountId: string) => `${STORAGE_PREFIX}${accountId || 'guest'}`

const currentAccountId = () => useChatAuth().currentChatUserId.value || 'guest'

const persist = () => {
  const accountId = currentAccountId()
  const payload: TogetherListenPersistedState = {
    version: 1,
    settings: clone(settings.value),
    activeSession: activeSession.value ? clone(activeSession.value) : null,
    records: clone(records.value.slice(0, 100))
  }
  localStorage.setItem(storageKey(accountId), JSON.stringify(payload))
  window.dispatchEvent(new CustomEvent('clingy:together-listen-updated'))
}

const load = () => {
  const accountId = currentAccountId()
  if (initializedAccountId.value === accountId) return
  initializedAccountId.value = accountId
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey(accountId)) || 'null') as TogetherListenPersistedState | null
    settings.value = { ...defaultTogetherListenSettings(), ...(parsed?.settings || {}) }
    activeSession.value = parsed?.activeSession || null
    if (activeSession.value && ['matching', 'inviting'].includes(activeSession.value.status)) {
      activeSession.value.lastError = '上次匹配或邀请已中断，请取消后重试。'
    }
    records.value = Array.isArray(parsed?.records) ? parsed!.records : []
  } catch {
    settings.value = defaultTogetherListenSettings()
    activeSession.value = null
    records.value = []
  }
}

const parseJson = (content: string) => {
  const cleaned = content.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim()
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  try { return JSON.parse(cleaned.slice(start, end + 1)) } catch { return null }
}

const getMusicMemories = (participantId: string) => records.value
  .filter(item => item.participant.id === participantId && item.summary)
  .slice(0, 6)
  .map(item => item.summary)
  .join('\n')

const currentLyricContext = (track: MusicTrack | null, lyricIndex: number) => {
  if (!track || !settings.value.includeLyrics || !track.lyrics?.length || lyricIndex < 0) return '当前没有可用歌词。'
  const lines = track.lyrics.slice(Math.max(0, lyricIndex - 2), lyricIndex + 3)
  return lines.map((line, index) => `${index === Math.min(2, lyricIndex) ? '当前附近' : '歌词'}：${line.text}${line.translation ? ` / ${line.translation}` : ''}`).join('\n')
}

const addMessage = (sender: TogetherListenMessage['sender'], content: string, kind: TogetherListenMessage['kind'] = 'text') => {
  const session = activeSession.value
  if (!session || !content.trim()) return null
  const player = useMusicPlayer()
  const lyric = player.currentTrack.value?.lyrics?.[player.currentLyricIndex.value]?.text
  const message: TogetherListenMessage = {
    id: uid('listen_msg'), sender, content: content.trim(), createdAt: Date.now(), kind,
    trackTitle: player.currentTrack.value?.title,
    lyricText: lyric
  }
  session.messages.push(message)
  if (session.settings.textDisplay === 'single-chat' && session.participant.chatId && kind === 'text') syncMessageToSingleChat(session, message)
  persist()
  return message
}

const saveChatContact = (chat: any) => {
  const accountId = useChatAuth().currentChatUserId.value
  const key = accountId ? `clingy_custom_contacts_${accountId}` : 'clingy_custom_contacts'
  try {
    const contacts = JSON.parse(localStorage.getItem(key) || '[]')
    const index = contacts.findIndex((item: any) => String(item.id) === String(chat.id))
    if (index < 0) return
    contacts[index] = {
      ...contacts[index],
      messages: chat.messages,
      memoryBook: chat.memoryBook || [],
      togetherListenSharedMemories: chat.togetherListenSharedMemories || [],
      preview: chat.preview,
      time: chat.time
    }
    localStorage.setItem(key, JSON.stringify(contacts))
  } catch {}
}

const syncMessageToSingleChat = (session: TogetherListenSession, message: TogetherListenMessage) => {
  const chat = mockChats.value.find(item => String(item.id) === String(session.participant.chatId))
  if (!chat || message.syncedToSingleChat) return
  chat.messages ||= []
  chat.messages.push({
    id: Date.now() + Math.floor(Math.random() * 1000),
    type: message.sender === 'user' ? 'right' : 'left',
    content: message.content,
    timestamp: message.createdAt,
    musicSessionId: session.id,
    musicTrackTitle: message.trackTitle,
    musicSceneMessage: true
  })
  chat.preview = message.content
  chat.time = new Date(message.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  message.syncedToSingleChat = true
  saveChatContact(chat)
}

const newSession = (
  mode: 'stranger' | 'character',
  participant: TogetherListenParticipant,
  track: MusicTrack | null,
  status: TogetherListenSession['status'],
  userProfile: { name?: string; avatarUrl?: string } = myProfile.value
) => ({
  id: uid('listen_session'),
  accountId: currentAccountId(),
  mode,
  status,
  user: { name: userProfile.name || '我', avatarUrl: userProfile.avatarUrl || '' },
  participant,
  startedAt: Date.now(),
  initialTrack: track ? clone(track) : undefined,
  currentTrack: track ? clone(track) : undefined,
  trackHistory: track ? [clone(track)] : [],
  messages: [],
  playbackEvents: [],
  friendRequests: [],
  settings: clone(settings.value)
} satisfies TogetherListenSession)

const startStrangerMatch = async () => {
  load(); error.value = ''; busy.value = true
  const player = useMusicPlayer()
  const fallbackId = `listen_${Date.now().toString(36)}`.slice(0, 20)
  const placeholder: TogetherListenParticipant = {
    kind: 'stranger', id: uid('listener'), name: '陌生听友', anonymousName: `听友 ${Math.floor(1000 + Math.random() * 9000)}`,
    persona: '', socialId: fallbackId, revealed: false, discoverable: true, allowFriendRequests: true
  }
  activeSession.value = newSession('stranger', placeholder, player.currentTrack.value, 'matching')
  persist()
  const taste = musicHistory.value.slice(0, 16).map(item => `${item.title}-${item.artist}`).join('、') || '暂无足够历史'
  const trackText = player.currentTrack.value ? `${player.currentTrack.value.title}-${player.currentTrack.value.artist}` : '当前未播放歌曲'
  try {
    const response = await sendCapabilityMessage('character-workshop', [
      { role: 'system', content: '你是一起听中的陌生 AI 听友生成器。人物必须像独立真实的人一样有边界、有沉默可能、有自己的音乐偏好，不迎合用户。只返回合法 JSON。' },
      { role: 'user', content: `根据当前歌曲与听歌历史生成一位此前不认识的听友。当前歌曲：${trackText}。最近听歌：${taste}。姓名与社交ID可以自然但不得使用现实公众人物。返回：{"name":"揭面后的姓名","socialId":"4至20位字母数字下划线或短横线","signature":"短签名","persona":"包含身份、性格、说话方式、音乐偏好、社交边界、健谈程度以及可能保持沉默的完整人设","opening":"匹配成功后可为空的一句自然招呼"}` }
    ])
    const data = parseJson(response.content) || {}
    const session = activeSession.value
    if (!session || session.status !== 'matching') return
    session.participant.name = String(data.name || '林听').trim().slice(0, 24)
    session.participant.socialId = cleanSocialId(data.socialId, fallbackId)
    session.participant.signature = String(data.signature || '').trim().slice(0, 120)
    session.participant.persona = String(data.persona || '安静、尊重边界，有自己的音乐偏好，不会为了回应而回应。').trim().slice(0, 5000)
    session.status = 'active'
    addMessage('system', `已匹配到 ${session.participant.anonymousName}，身份暂时隐藏。`, 'notice')
    if (String(data.opening || '').trim()) addMessage('partner', String(data.opening), 'text')
    persist()
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '匹配失败'
    if (activeSession.value?.status === 'matching') activeSession.value.lastError = error.value
    persist()
  } finally { busy.value = false }
}

const inviteCharacter = async (chat: any) => {
  load(); error.value = ''; busy.value = true
  const player = useMusicPlayer()
  const participant: TogetherListenParticipant = {
    kind: 'character', id: String(chat.characterEntityId || chat.id), chatId: chat.id,
    entityId: String(chat.characterEntityId || chat.id), name: chat.realName || chat.name,
    anonymousName: chat.realName || chat.name, avatarUrl: chat.avatarUrl, persona: String(chat.persona || ''),
    socialId: String(chat.socialProfile?.socialId || ''), signature: String(chat.socialProfile?.signature || ''),
    revealed: true, discoverable: chat.discoverable !== false, allowFriendRequests: chat.allowFriendRequests !== false
  }
  activeSession.value = newSession('character', participant, player.currentTrack.value, 'inviting', getEffectiveUserProfile(chat, myProfile.value))
  persist()
  try {
    const track = player.currentTrack.value
    const response = await sendCapabilityMessage('chat', [
      { role: 'system', content: `你是${participant.name}。严格依据人设与当前关系决定是否接受一起听邀请。可以拒绝，不得为了展示功能而接受。只返回合法 JSON。` },
      { role: 'user', content: `人设：${participant.persona || '按既有性格行事'}\n关系状态：${chat.relationship?.friendship || 'friends'}，拉黑状态：${chat.relationship?.blockedBy || 'none'}。用户邀请你一起听${track ? `《${track.title}》` : '音乐'}。返回：{"accept":true或false,"message":"一句自然答复"}` }
    ], { diagnosticContext: { chatId: String(chat.id), characterIds: [String(chat.characterEntityId || chat.id)], characterName: participant.name } })
    const data = parseJson(response.content)
    const session = activeSession.value
    if (!session || session.status !== 'inviting') return false
    if (data?.accept !== true) {
      const refusal = String(data?.message || '现在不太方便一起听。')
      addMessage('partner', refusal)
      session.status = 'ended'; session.endedAt = Date.now()
      activeSession.value = null
      error.value = refusal
      persist()
      return false
    }
    session.status = 'active'
    addMessage('system', `${participant.name}接受了一起听邀请。`, 'notice')
    if (String(data?.message || '').trim()) addMessage('partner', String(data.message))
    persist(); return true
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '邀请失败'
    if (activeSession.value) activeSession.value.lastError = error.value
    persist(); return false
  } finally { busy.value = false }
}

export const queueCharacterTogetherListenInvite = (chat: any, message: string) => {
  load()
  if (!settings.value.allowCharacterInvites || activeSession.value || pendingCharacterInvite.value) return false
  pendingCharacterInvite.value = {
    chatId: chat.id,
    characterName: chat.realName || chat.name || '角色',
    message: message.trim() || '想邀请你一起听一会儿。',
    createdAt: Date.now()
  }
  window.dispatchEvent(new CustomEvent('clingy:together-listen-invite'))
  return true
}

const acceptCharacterInvite = (chat: any) => {
  load()
  const invite = pendingCharacterInvite.value
  if (!invite || String(invite.chatId) !== String(chat?.id)) return false
  const player = useMusicPlayer()
  const participant: TogetherListenParticipant = {
    kind: 'character', id: String(chat.characterEntityId || chat.id), chatId: chat.id,
    entityId: String(chat.characterEntityId || chat.id), name: chat.realName || chat.name,
    anonymousName: chat.realName || chat.name, avatarUrl: chat.avatarUrl, persona: String(chat.persona || ''),
    socialId: String(chat.socialProfile?.socialId || ''), signature: String(chat.socialProfile?.signature || ''),
    revealed: true, discoverable: chat.discoverable !== false, allowFriendRequests: chat.allowFriendRequests !== false
  }
  activeSession.value = newSession('character', participant, player.currentTrack.value, 'active', getEffectiveUserProfile(chat, myProfile.value))
  addMessage('system', `${participant.name}发起了一起听邀请，你已经接受。`, 'notice')
  addMessage('partner', invite.message)
  pendingCharacterInvite.value = null
  persist()
  return true
}

const declineCharacterInvite = (chatId: string | number) => {
  if (pendingCharacterInvite.value && String(pendingCharacterInvite.value.chatId) === String(chatId)) pendingCharacterInvite.value = null
}

const resolveSharedChatContext = (session: TogetherListenSession) => {
  if (session.settings.memoryMode !== 'shared' || !session.participant.chatId) return ''
  const chat = mockChats.value.find(item => String(item.id) === String(session.participant.chatId))
  if (!chat) return ''
  const recent = (chat.messages || []).slice(-24).map((item: any) => `${item.type === 'right' ? '用户' : session.participant.name}：${String(item.content || '')}`).join('\n')
  const memories = (chat.memoryBook || []).slice(-6).map((item: any) => String(item.content || item.summary || '')).filter(Boolean).join('\n')
  return `\n普通单聊可用上下文：\n${recent}\n${memories}`
}

const resolveIdSearch = (query: string) => {
  const normalized = String(query || '').trim().replace(/^id\s*[:：]?\s*/i, '').toLowerCase()
  if (!normalized) return '没有提供有效 ID。'
  const auth = useChatAuth()
  const account = auth.currentAccount.value
  if (account && String(account.accountId || '').toLowerCase() === normalized) {
    const profile = loadUserSocialProfile(account)
    return !profile.discoverable || profile.hiddenSections.includes('socialId') || profile.sectionAudiences.socialId === 'private'
      ? '没有找到该 ID。'
      : `找到了用户 ${account.name || '用户'} 的公开账号。`
  }
  const result = searchCharacterDirectory(normalized)
  return result.length === 1 ? `找到了 ${result[0].name} 的公开资料。` : '没有找到该 ID。'
}

const requestPartnerReply = async (options: { automatic?: boolean } = {}) => {
  load()
  const session = activeSession.value
  if (!session || session.status !== 'active' || busy.value) return
  error.value = ''; busy.value = true
  const player = useMusicPlayer()
  const messages = session.messages.slice(-36).filter(item => item.kind !== 'playback').map(item => (
    `${item.sender === 'user' ? '用户' : item.sender === 'partner' ? session.participant.name : '系统'}：${item.content}`
  )).join('\n')
  const musicMemory = session.settings.memoryMode === 'music-only' || session.settings.memoryMode === 'shared'
    ? getMusicMemories(session.participant.id) : ''
  const pendingOutgoing = session.friendRequests.find(item => item.direction === 'user_to_partner' && item.status === 'pending')
  const currentTrack = player.currentTrack.value
  const lyricContext = currentLyricContext(currentTrack, player.currentLyricIndex.value)
  const bilingual = session.settings.bilingualEnabled ? `使用双语回复，翻译目标：${session.settings.translationLanguage}。` : '使用当前会话的自然语言回复。'
  const system = `你是${session.participant.name}，正在与用户一起听歌。人设：${session.participant.persona}\n你可以沉默，不要为了展示功能机械回应。只根据当前情境行动。${bilingual}\n身份${session.participant.revealed ? '已经公开' : '尚未公开，不得直接泄露姓名或ID'}。允许切歌：${session.settings.allowPartnerSwitchTrack ? '是' : '否'}；允许播放控制：${session.settings.allowPartnerPlaybackControl ? '是' : '否'}；允许好友申请：${session.settings.allowFriendRequests && session.participant.allowFriendRequests ? '是' : '否'}。\n只返回 JSON：{"messages":["自然消息"],"silence":false,"playbackAction":"none|next|previous|play|pause","friendAction":"none|request|accept|reject|reveal","friendMessage":"申请或答复","searchId":"想精确搜索的ID或空"}。messages 可以为空；不允许的动作必须返回 none。`
  const context = `当前歌曲：${currentTrack ? `${currentTrack.title}-${currentTrack.artist}，播放到 ${Math.floor(player.currentTime.value)} 秒` : '未播放'}\n${lyricContext}\n本场消息：\n${messages || '还没有文字聊天。'}\n音乐空间历史：${musicMemory || '无'}${resolveSharedChatContext(session)}\n用户发出的好友申请：${pendingOutgoing ? pendingOutgoing.message : '无'}\n请决定现在是否回应和行动。`
  try {
    let response = await sendCapabilityMessage('chat', [
      { role: 'system', content: system }, { role: 'user', content: context }
    ], session.participant.chatId ? { diagnosticContext: { chatId: `listen:${session.id}`, characterIds: [session.participant.id], characterName: session.participant.name } } : {})
    let data = parseJson(response.content)
    if (!data) data = { messages: response.content.trim() ? [response.content.trim()] : [], silence: !response.content.trim(), playbackAction: 'none', friendAction: 'none' }
    if (String(data.searchId || '').trim()) {
      const searchedId = String(data.searchId).trim()
      const result = resolveIdSearch(searchedId)
      response = await sendCapabilityMessage('chat', [
        { role: 'system', content: system },
        { role: 'user', content: `${context}\n你刚才请求精确搜索 ID：${searchedId}。系统真实结果：${result}\n现在依据结果返回最终 JSON，不得声称找到系统没有找到的人。searchId 留空。` }
      ])
      data = parseJson(response.content) || data
      addMessage('system', `对方搜索了 ID“${searchedId}”：${result}`, 'notice')
    }
    const outputMessages = Array.isArray(data.messages) ? data.messages.map((item: unknown) => String(item || '').trim()).filter(Boolean).slice(0, 4) : []
    const deliveredMessages = session.settings.allowPartnerSpeak ? outputMessages : []
    deliveredMessages.forEach((text: string) => addMessage('partner', text))
    await applyPartnerPlaybackAction(String(data.playbackAction || 'none'))
    await applyPartnerFriendAction(String(data.friendAction || 'none'), String(data.friendMessage || ''))
    if (!options.automatic && !deliveredMessages.length && String(data.playbackAction || 'none') === 'none' && String(data.friendAction || 'none') === 'none') {
      addMessage('system', `${session.participant.anonymousName || session.participant.name}没有说话，仍在一起听。`, 'notice')
    }
  } catch (cause) { error.value = cause instanceof Error ? cause.message : '回复失败' }
  finally { busy.value = false; persist() }
}

const applyPartnerPlaybackAction = async (action: string) => {
  const session = activeSession.value
  if (!session || Date.now() - Number(session.lastPartnerActionAt || 0) < 20_000) return
  const player = useMusicPlayer()
  if ((action === 'next' || action === 'previous') && session.settings.allowPartnerSwitchTrack) {
    session.lastPartnerActionAt = Date.now()
    if (action === 'next') await player.nextTrack(); else await player.prevTrack()
    addMessage('system', `${session.participant.anonymousName || session.participant.name}${action === 'next' ? '切到了下一首' : '切回了上一首'}。`, 'playback')
  } else if ((action === 'play' || action === 'pause') && session.settings.allowPartnerPlaybackControl) {
    const wantsPlay = action === 'play'
    if (player.isPlaying.value !== wantsPlay) await player.togglePlay()
    session.lastPartnerActionAt = Date.now()
    addMessage('system', `${session.participant.anonymousName || session.participant.name}${wantsPlay ? '继续了播放' : '暂停了播放'}。`, 'playback')
  }
}

const createFriendRequest = (direction: TogetherListenFriendRequest['direction'], message: string) => {
  const session = activeSession.value
  if (!session || session.mode !== 'stranger' || !session.settings.allowFriendRequests) return null
  const existing = session.friendRequests.find(item => item.direction === direction && item.status === 'pending')
  if (existing) return existing
  const request: TogetherListenFriendRequest = {
    id: uid('listen_friend_request'), direction, message: message.trim() || '想和你成为好友', status: 'pending', createdAt: Date.now()
  }
  session.friendRequests.unshift(request)
  addMessage('system', direction === 'user_to_partner' ? '你发送了好友申请。' : '对方向你发送了好友申请。', 'friend-request')
  persist(); return request
}

const promoteStranger = () => {
  const session = activeSession.value
  if (!session || session.mode !== 'stranger') return null
  session.participant.revealed = true
  const result = createMatchedListenerContact({
    entityId: session.participant.id,
    name: session.participant.name,
    socialId: session.participant.socialId,
    signature: session.participant.signature,
    persona: session.participant.persona,
    avatarUrl: session.participant.avatarUrl,
    interactionSummary: session.summary || `通过一起听认识，共同听过 ${session.trackHistory.length} 首歌。`
  })
  session.promotedChatId = result.contact.id
  session.participant.chatId = result.contact.id
  session.participant.entityId = String(result.contact.characterEntityId || result.contact.id)
  persist()
  void loadCustomContacts()
  return result
}

const respondFriendRequest = (requestId: string, accept: boolean) => {
  const request = activeSession.value?.friendRequests.find(item => item.id === requestId)
  if (!request || request.status !== 'pending') return
  if (accept) {
    try {
      if (!promoteStranger()) return
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : '好友关系创建失败'
      persist()
      return
    }
  }
  request.status = accept ? 'accepted' : 'rejected'; request.respondedAt = Date.now()
  addMessage('system', accept ? '好友申请已通过，双方身份已公开。' : '好友申请已拒绝。', 'friend-request')
  persist()
}

const applyPartnerFriendAction = async (action: string, message: string) => {
  const session = activeSession.value
  if (!session || session.mode !== 'stranger') return
  const outgoing = session.friendRequests.find(item => item.direction === 'user_to_partner' && item.status === 'pending')
  if (action === 'request') createFriendRequest('partner_to_user', message)
  if ((action === 'accept' || action === 'reject') && outgoing) respondFriendRequest(outgoing.id, action === 'accept')
  if (action === 'reveal') {
    session.participant.revealed = true
    addMessage('system', `对方公开了身份：${session.participant.name} · ID ${session.participant.socialId}`, 'notice')
  }
}

const buildLocalSummary = (session: TogetherListenSession) => {
  const minutes = Math.max(1, Math.round(((session.endedAt || Date.now()) - session.startedAt) / 60000))
  const tracks = session.trackHistory.map(item => `《${item.title}》`).slice(0, 8).join('、')
  const messages = session.messages.filter(item => item.kind === 'text').slice(-8).map(item => item.content).join('；')
  return `与${session.participant.name}一起听了约${minutes}分钟，听过${tracks || '当前歌曲'}。${messages ? `重要对话：${messages}` : '双方主要安静听歌。'}`
}

const generateSessionSummary = async (session: TogetherListenSession) => {
  const transcript = session.messages.filter(item => item.kind === 'text').map(item => `${item.sender === 'user' ? '用户' : session.participant.name}：${item.content}`).join('\n')
  const tracks = session.trackHistory.map(item => `${item.title}-${item.artist}`).join('、')
  if (!transcript.trim()) {
    session.summary = buildLocalSummary(session)
    return session.summary
  }
  try {
    const response = await sendCapabilityMessage('summary', [
      { role: 'system', content: '请把一起听经历总结成一段连续、克制的关系记忆。记录共同听过的歌曲、双方明确表达的感受、重要偏好与关系变化；不要复制完整歌词，不要记录播放进度等技术事件，不要添加未发生的内容。只输出总结正文。' },
      { role: 'user', content: `参与者：用户与${session.participant.name}\n歌曲：${tracks || '未记录'}\n聊天：\n${transcript}` }
    ])
    session.summary = response.content.trim() || buildLocalSummary(session)
  } catch {
    session.summary = buildLocalSummary(session)
  }
  return session.summary
}

const writeSharedMemory = (session: TogetherListenSession) => {
  if (session.settings.memoryMode !== 'shared' || !session.participant.chatId || !session.summary) return
  const chat = mockChats.value.find(item => String(item.id) === String(session.participant.chatId))
  if (!chat) return
  chat.togetherListenSharedMemories ||= []
  chat.togetherListenSharedMemories.push({
    id: uid('listen_memory'),
    content: session.summary,
    createdAt: session.endedAt || Date.now(),
    sessionId: session.id
  })
  chat.togetherListenSharedMemories = chat.togetherListenSharedMemories.slice(-30)
  saveChatContact(chat)
}

const archiveActiveSession = () => {
  const session = activeSession.value
  if (!session) return
  if (!session.endedAt) session.endedAt = Date.now()
  session.status = 'ended'
  writeSharedMemory(session)
  if (session.settings.keepLocalRecords) records.value = [clone(session), ...records.value.filter(item => item.id !== session.id)].slice(0, 100)
  activeSession.value = null
  persist()
}

const endSession = async () => {
  const session = activeSession.value
  if (!session) return
  session.playbackEvents.push({ id: uid('listen_event'), type: 'leave', actor: 'user', detail: '用户结束了一起听', createdAt: Date.now() })
  busy.value = true
  if (session.settings.autoSummary && !session.summary) await generateSessionSummary(session)
  busy.value = false
  archiveActiveSession()
}

const summarizeActiveSession = async () => {
  const session = activeSession.value
  if (!session || busy.value) return ''
  busy.value = true
  const result = await generateSessionSummary(session)
  busy.value = false
  persist()
  return result
}

const summarizeRecord = async (id: string) => {
  const record = records.value.find(item => item.id === id)
  if (!record || busy.value) return ''
  busy.value = true
  const result = await generateSessionSummary(record)
  busy.value = false
  persist()
  return result
}

const cancelPendingSession = () => {
  if (!activeSession.value || !['matching', 'inviting'].includes(activeSession.value.status)) return
  activeSession.value = null; busy.value = false; error.value = ''; persist()
}

const updateSettings = (patch: Partial<TogetherListenSettings>) => {
  settings.value = { ...settings.value, ...patch }
  if (activeSession.value) activeSession.value.settings = { ...activeSession.value.settings, ...patch }
  persist()
}

const initializeRuntime = () => {
  load()
  if (runtimeReady) return
  runtimeReady = true
  const player = useMusicPlayer()
  watch(player.currentTrack, track => {
    const session = activeSession.value
    if (!session || session.status !== 'active' || !track) return
    const key = `${track.sourceId}:${track.sourceTrackId || track.id}`
    if (key === previousTrackKey) return
    previousTrackKey = key
    session.currentTrack = clone(track)
    if (!session.trackHistory.some(item => `${item.sourceId}:${item.sourceTrackId || item.id}` === key)) session.trackHistory.push(clone(track))
    session.playbackEvents.push({ id: uid('listen_event'), type: 'track', actor: 'system', detail: `${track.title}-${track.artist}`, createdAt: Date.now() })
    persist()
    if (session.settings.eventDrivenEnabled && Date.now() - lastAutomaticDecisionAt >= 45_000) {
      lastAutomaticDecisionAt = Date.now()
      window.setTimeout(() => {
        if (activeSession.value?.id === session.id && activeSession.value.status === 'active') void requestPartnerReply({ automatic: true })
      }, 1800)
    }
  }, { immediate: true })
}

export function useTogetherListen() {
  initializeRuntime()
  return {
    activeSession,
    records,
    settings,
    busy,
    error,
    pendingCharacterInvite,
    isActive: computed(() => activeSession.value?.status === 'active'),
    startStrangerMatch,
    inviteCharacter,
    acceptCharacterInvite,
    declineCharacterInvite,
    addUserMessage: (content: string) => addMessage('user', content),
    requestPartnerReply,
    summarizeActiveSession,
    summarizeRecord,
    createUserFriendRequest: (message = '想和你成为好友') => createFriendRequest('user_to_partner', message),
    respondFriendRequest,
    endSession,
    cancelPendingSession,
    updateSettings,
    clearError: () => { error.value = '' },
    reload: load
  }
}
