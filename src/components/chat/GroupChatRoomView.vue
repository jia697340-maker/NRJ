/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import localforage from 'localforage'
import { useChatAuth } from '../../composables/useChatAuth'
import { useChatState } from '../../composables/useChatState'
import { useChatEmoji } from '../../composables/useChatEmoji'
import { useChatMessageSelection } from '../../composables/useChatMessageSelection'
import { useChatRoomMultiSelect } from '../../composables/useChatRoomMultiSelect'
import { useChatRoomMessage } from '../../composables/useChatRoomMessage'
import { useChatRoomTransfer } from '../../composables/useChatRoomTransfer'
import { useVoicePlayer } from '../../composables/useVoicePlayer'
import { useChatRoomImageGen } from '../../composables/useChatRoomImageGen'
import { useNovelAI } from '../../composables/useNovelAI'
import { useGptImage } from '../../composables/useGptImage'
import { useGeminiImage } from '../../composables/useGeminiImage'
import { useFluxImage } from '../../composables/useFluxImage'
import { useNijiImage } from '../../composables/useNijiImage'
import { useSeedreamImage } from '../../composables/useSeedreamImage'
import { useChatSummary } from '../../composables/useChatSummary'
import { worldBooks } from '../../store'
import { activeGroupReplyIds, groupReplyControllers, requestGroupReply, saveGroupChat } from '../../services/groupChat'
import { indexChatMemories, invalidateMemoriesForMessages, replaceStructuredMemoriesForEvidence } from '../../services/memoryEngine'
import ChatRoomMessageList from './room/ChatRoomMessageList.vue'
import ChatRoomInputArea from './room/ChatRoomInputArea.vue'
import ChatMessageActionModal from './modals/ChatMessageActionModal.vue'
import ChatMessageEditModal from './modals/ChatMessageEditModal.vue'
import ChatTransferModal from './modals/ChatTransferModal.vue'
import ChatVoiceModal from './modals/ChatVoiceModal.vue'
import ChatImageModal from './modals/ChatImageModal.vue'
import ChatUserThoughtModal from './modals/ChatUserThoughtModal.vue'
import ChatInnerThoughtModal from './modals/ChatInnerThoughtModal.vue'
import ChatMemoryModal from './modals/ChatMemoryModal.vue'
import ChatRoomHeader from './room/ChatRoomHeader.vue'
import ChatVoiceCallView from './ChatVoiceCallView.vue'
import ChatVideoCallView from './ChatVideoCallView.vue'
import ChatVoiceCallWidget from './room/ChatVoiceCallWidget.vue'
import ChatOfflineMeetView from './ChatOfflineMeetView.vue'
import { createTransferData } from '../../services/transferLifecycle'
import { createIncomingWalletPayment } from '../../services/walletService'

const props = defineProps<{ group: any; isVisible?: boolean }>()
const emit = defineEmits<{ (e: 'back'): void; (e: 'open-settings'): void; (e: 'open-character-profile', memberId: string): void }>()
const { mockChats, effectiveMyProfile } = useChatState()
const { currentChatUserId } = useChatAuth()
const selectedGroup = computed(() => props.group)
const groupUserProfile = computed(() => props.group.userProfile || effectiveMyProfile.value)
const messageListRef = ref<any>(null)
const toastText = ref('')
const wallpaper = ref<string | null>(null)
const showExtensionPanel = ref(false)
const showEmojiPanel = ref(false)
const showUserThoughtModal = ref(false)
const showInnerThoughtModal = ref(false)
const showMemoryModal = ref(false)
const showSeparateOffline = ref(false)
const showEditModal = ref(false)
const editTargetId = ref<number>()
const editInitialContent = ref('')
const editInitialType = ref('left')
const editHasMedia = ref(false)
const expandedVoiceIds = ref<Set<number>>(new Set())
const currentMediaThumb = ref<string | null>(null)
const currentDateStr = ref('')
const currentDayStr = ref('')
const isCallMinimized = ref(false)
const callClock = ref(Date.now())

const updateTimeStr = () => {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  currentDateStr.value = `${y}.${m}.${d}`

  const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
  currentDayStr.value = days[now.getDay()]
}
let timeInterval: ReturnType<typeof setInterval> | null = null
const { playVoice, isSynthesizing: isVoiceSynthesizing, currentPlayingId: voicePlayingId } = useVoicePlayer()
const isGenerating = computed(() => activeGroupReplyIds.has(String(props.group.id)))
let toastTimer: ReturnType<typeof setTimeout> | null = null
const wallpaperStore = localforage.createInstance({ name: 'nrt-app', storeName: 'chatWallpapers' })
const groupMemberAvatarsStore = localforage.createInstance({ name: 'nrt-app', storeName: 'groupMemberAvatars' })
const groupMemberAvatarUrls = ref<Record<string, string>>({})

const members = computed<any[]>(() => props.group.memberIds.map((id: string) => mockChats.value.find(chat => chat.chatType !== 'group' && String(chat.characterEntityId || chat.id) === id)).filter(Boolean))
const memberMap = computed(() => new Map(members.value.map(member => {
  const id = String(member.characterEntityId || member.id)
  return [id, { ...member, ...(props.group.memberSettings?.[id] || {}) }]
})))
const memberName = (id: string) => props.group.memberNicknames?.[id] || memberMap.value.get(id)?.name || '已移除成员'
const resolveSender = (message: any) => {
  const member: any = memberMap.value.get(String(message.senderId || '')) || {}
  const senderId = String(message.senderId || '')
  return { ...member, name: message.senderNameSnapshot || memberName(senderId), avatarUrl: groupMemberAvatarUrls.value[senderId] || message.senderAvatarSnapshot || member.avatarUrl || '', avatarText: member.avatarText || memberName(senderId).charAt(0) || '伴' }
}
const displayMessages = computed(() => (props.group.messages || []).filter((message: any) => !message.isVoiceCallProcessMsg && !message.isVideoCallProcessMsg && (props.group.offlineMeetMode === 'mixed' || !message.isOfflineMeetMsg)))
const activeCallType = computed<'voice' | 'video' | null>(() => props.group.activeCallType || null)
const activeCallMessages = computed(() => (props.group.messages || [])
  .filter((message: any) => activeCallType.value === 'voice' ? message.isVoiceCallProcessMsg : message.isVideoCallProcessMsg)
  .map((message: any) => message.type === 'left' ? { ...message, content: `${memberName(String(message.senderId || ''))}：${message.content}` } : message))
const callDurationStr = computed(() => {
  const elapsed = Math.max(0, Math.floor((callClock.value - Number(props.group.activeCallStartedAt || callClock.value)) / 1000))
  return `${String(Math.floor(elapsed / 60)).padStart(2, '0')}:${String(elapsed % 60).padStart(2, '0')}`
})
const groupWallpaperStyle = computed(() => wallpaper.value ? { backgroundImage: `url(${wallpaper.value})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {})
const totalUnreadCount = computed(() => mockChats.value.filter(c => c.contactState !== 'candidate' && c.unread > 0 && String(c.id) !== String(props.group.id)).length)

const scrollBottom = async () => { await nextTick(); await messageListRef.value?.scrollToBottom?.() }
const showToast = (text: string) => { toastText.value = text; if (toastTimer) clearTimeout(toastTimer); toastTimer = setTimeout(() => { toastText.value = '' }, 2600) }
const updatePreviewAndTime = (content: string) => { props.group.preview = content || '暂无消息'; props.group.time = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) }
const persist = (record = props.group) => { const last = record.messages?.at(-1); record.preview = last?.content || '群聊已创建'; record.time = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }); saveGroupChat(currentChatUserId.value, record) }

const { emojis, loadEmojis } = useChatEmoji()
const panelEmojis = computed(() => emojis.value)
const selection = useChatMessageSelection()
const { selectionMode, isMultiSelectMode, selectedMessageIds, enterMultiSelectMode, exitMultiSelectMode, toggleMessageSelection, isSelected, selectAll, getSelectedCount } = selection
const multi = useChatRoomMultiSelect(selectedGroup, isMultiSelectMode, selectedMessageIds, enterMultiSelectMode, exitMultiSelectMode, toggleMessageSelection, persist, updatePreviewAndTime, showToast)
const media = useChatRoomMessage(selectedGroup, groupUserProfile, isMultiSelectMode, persist, scrollBottom, updatePreviewAndTime, showToast)
const transfer = useChatRoomTransfer(selectedGroup, groupUserProfile, isMultiSelectMode, persist, scrollBottom)
const activeTransferSender = computed(() => resolveSender({ senderId: transfer.activeTransferModalData.value?.senderId || '' }))
const { generateImage: generateNovelImage } = useNovelAI()
const { generateImage: generateGptImage } = useGptImage()
const { generateImage: generateGeminiImage } = useGeminiImage()
const { generateImage: generateFluxImage } = useFluxImage()
const { generateImage: generateNijiImage } = useNijiImage()
const { generateImage: generateSeedreamImage } = useSeedreamImage()
const imageGen = useChatRoomImageGen(selectedGroup, groupUserProfile, generateNovelImage, generateGptImage, generateGeminiImage, generateFluxImage, generateNijiImage, generateSeedreamImage, () => persist(), scrollBottom)

const { handleAutoSummary, handleManualSummaryLatest, summarizeMemories, isSummarizing } = useChatSummary(selectedGroup, persist, showToast)
const isSummarizingMemories = ref(false)
let autoSummaryTimer: ReturnType<typeof setTimeout> | null = null
let idleSummaryTimer: ReturnType<typeof setTimeout> | null = null
const runAutoSummaryWhenIdle = () => {
  if (isGenerating.value) {
    autoSummaryTimer = setTimeout(runAutoSummaryWhenIdle, 900)
    return
  }
  void handleAutoSummary()
}

watch(() => props.group.messages?.length || 0, () => {
  if (!props.group.autoSummaryEnabled) return
  if (autoSummaryTimer) clearTimeout(autoSummaryTimer)
  if (idleSummaryTimer) clearTimeout(idleSummaryTimer)
  autoSummaryTimer = setTimeout(runAutoSummaryWhenIdle, 900)
  const idleMinutes = Number(props.group.autoSummaryIdleMinutes || 0)
  if (idleMinutes > 0) idleSummaryTimer = setTimeout(() => void handleAutoSummary(true), Math.min(idleMinutes, 1440) * 60 * 1000)
})

const runReply = async () => {
  const targetGroup = props.group
  const targetId = String(targetGroup.id)
  if (activeGroupReplyIds.has(targetId)) return
  const targetMemberName = (id: string) => targetGroup.memberNicknames?.[id] || mockChats.value.find(chat => chat.chatType !== 'group' && String(chat.characterEntityId || chat.id) === id)?.name || '已移除成员'
  const targetMemberAvatar = (id: string) => mockChats.value.find(chat => chat.chatType !== 'group' && String(chat.characterEntityId || chat.id) === id)?.avatarUrl || ''
  const requestController = new AbortController()
  activeGroupReplyIds.add(targetId); groupReplyControllers.set(targetId, requestController); targetGroup.isTyping = true; persist(targetGroup)
  const requestStartedAt = Date.now()
  try {
    const worldText = worldBooks.filter((book: any) => book.enabled && (targetGroup.boundWorldBooks?.includes(book.id) || (book.groupIds || []).some((groupId: string) => targetGroup.boundWorldBookGroups?.includes(groupId)))).flatMap((book: any) => (book.entries || []).filter((entry: any) => entry.enabled).map((entry: any) => `${entry.title}: ${entry.content}`)).join('\n')
    const result = await requestGroupReply(targetGroup, mockChats.value, groupUserProfile.value, requestController.signal, worldText)
    const turnId = `group_turn_${Date.now()}`
    const localIds = new Map<string, number>(); result.messages.forEach((message: any, index: number) => { if (message.key) localIds.set(message.key, Date.now() + index) })
    const imageJobs: { item: any; member: any }[] = []
    result.messages.forEach((message: any, index: number) => {
      const id = localIds.get(message.key) || Date.now() + index
      const replyToMessageId = localIds.get(message.replyToMessageId) || message.replyToMessageId || ''
      const quoted = targetGroup.messages.find((entry: any) => String(entry.id) === String(replyToMessageId))
      const quote = quoted ? { id: quoted.id, content: quoted.content, sender: quoted.type === 'right' ? (groupUserProfile.value.name || '我') : targetMemberName(quoted.senderId) } : undefined
      const item: any = { id, timestamp: id, type: message.messageType === 'narration' ? 'narration' : 'left', messageType: message.messageType, senderType: 'character', senderId: message.senderId, senderNameSnapshot: targetMemberName(message.senderId), senderAvatarSnapshot: targetMemberAvatar(message.senderId), content: message.content, translation: message.translation, translationStatus: message.translation ? 'ready' : undefined, contentLanguage: message.contentLanguage, translationLanguage: message.translationLanguage, replyToMessageId, quote, mentions: message.mentions.map((memberId: string) => ({ type: memberId === 'user' ? 'user' : 'character', id: memberId })), turnId, sequence: index, isVoiceCallProcessMsg: targetGroup.activeCallType === 'voice', isVideoCallProcessMsg: targetGroup.activeCallType === 'video', isOfflineMeetMsg: Boolean(targetGroup.isMixedOfflineActive) }
      if (message.messageType === 'voice') item.voiceData = { text: message.content, seconds: Math.max(1, Math.ceil(message.content.length / 4)) }
      if (message.messageType === 'image') item.imageData = { text: message.content, summary: message.content }
      if (message.messageType === 'emoji') {
        const emojiMember: any = memberMap.value.get(String(message.senderId))
        const matchedEmoji: any = emojiMember?.enableRoleEmojiVision
          ? emojis.value.find((emoji: any) => emoji.name === message.content.trim() && (emoji.category === 'global' || (emoji.category === 'role' && String(emoji.roleId ?? emoji.targetId ?? '') === String(message.senderId))))
          : null
        if (!matchedEmoji) return
        item.isEmoji = true
        item.emojiSummary = matchedEmoji.name
        item.content = matchedEmoji.name
        item.emojiId = matchedEmoji.id
        item.emojiUrl = matchedEmoji.previewUrl || (matchedEmoji.type === 'url' ? matchedEmoji.data : '')
      }
      if (message.messageType === 'transfer' || message.messageType === 'red_packet') {
        const walletAccountId = currentChatUserId.value || 'guest'
        const walletPayment = createIncomingWalletPayment(walletAccountId, Math.round((message.amount || 0) * 100), message.messageType, message.remark || message.content)
        item.transferData = { ...createTransferData({ type: message.messageType, amount: message.amount || 0, remark: message.remark || message.content, expireHours: 24, sender: 'character', walletPaymentId: walletPayment.id, walletAccountId }), senderId: message.senderId }
      }
      if (message.messageType === 'call') item.callData = { callType: 'voice', status: 'ended' }
      if (index === 0 && result.thinking) item.thinking = result.thinking
      if (index === result.messages.length - 1) item.costTime = ((Date.now() - requestStartedAt) / 1000).toFixed(1)
      const imageMember = memberMap.value.get(String(message.senderId))
      if (message.messageType === 'image' && imageMember?.enableNAIImageGen) imageJobs.push({ item, member: imageMember })
      else targetGroup.messages.push(item)
    })
    for (const job of imageJobs) {
      const imageMember = { ...job.member, name: targetMemberName(job.item.senderId), persona: targetGroup.memberNotes?.[job.item.senderId] || job.member.persona, messages: targetGroup.messages }
      await imageGen.handleAIImageGen(imageMember, targetGroup.id as any, job.item.id, job.item.content, true)
      const generated = targetGroup.messages.find((entry: any) => entry.id === job.item.id)
      if (generated) Object.assign(generated, { messageType: 'image', senderType: 'character', senderId: job.item.senderId, senderNameSnapshot: job.item.senderNameSnapshot, senderAvatarSnapshot: job.item.senderAvatarSnapshot, turnId: job.item.turnId, sequence: job.item.sequence, costTime: job.item.costTime })
    }
    if (!props.isVisible && targetGroup.notificationMode !== 'mute') {
      const visibleCount = targetGroup.notificationMode === 'all' ? result.messages.length : result.messages.filter((message: any) => message.mentions.includes('user')).length
      targetGroup.unread = Number(targetGroup.unread || 0) + visibleCount
    }
    result.thoughts.forEach((thought: any, index: number) => {
      const item = { id: `${turnId}_thought_${index}`, timestamp: Date.now() + index, content: thought.content, senderId: thought.senderId, senderName: targetMemberName(thought.senderId), senderAvatar: targetMemberAvatar(thought.senderId), turnId }
      targetGroup.innerThoughts ||= []; targetGroup.innerThoughts.push(item); targetGroup.memberInnerThoughts ||= {}; targetGroup.memberInnerThoughts[thought.senderId] ||= []; targetGroup.memberInnerThoughts[thought.senderId].push(item)
      const thoughtLimit = Math.max(1, Number(targetGroup.innerThoughtLimit || 50))
      if (targetGroup.innerThoughts.length > thoughtLimit) targetGroup.innerThoughts.splice(0, targetGroup.innerThoughts.length - thoughtLimit)
      if (targetGroup.memberInnerThoughts[thought.senderId].length > thoughtLimit) targetGroup.memberInnerThoughts[thought.senderId].splice(0, targetGroup.memberInnerThoughts[thought.senderId].length - thoughtLimit)
    })
    if (!result.messages.length && !result.idle) throw new Error('模型没有返回可识别的群消息，请检查群聊输出协议。')
    if (result.idle) showToast('群里暂时没有人接话')
    targetGroup.pendingUserThought = ''
  } catch (error: any) { if (error?.name !== 'AbortError') showToast(error?.message || '群聊回复失败') }
  finally { targetGroup.isTyping = false; activeGroupReplyIds.delete(targetId); groupReplyControllers.delete(targetId); persist(targetGroup); await scrollBottom() }
}

const mentionsFromText = (text: string) => members.value.filter(member => text.includes(`@${props.group.memberNicknames?.[String(member.characterEntityId || member.id)] || member.name}`)).map(member => ({ type: 'character', id: String(member.characterEntityId || member.id) }))
const handleAddMessage = async (raw: string) => { const content = raw.trim(); if (!content) return; const now = Date.now(); const quote = media.replyTargetMessage.value ? { ...media.replyTargetMessage.value } : undefined; props.group.messages.push({ id: now, timestamp: now, type: 'right', senderType: 'user', senderId: String(currentChatUserId.value || 'user'), content, quote, mentions: mentionsFromText(content), replyToMessageId: quote?.id || '', turnId: `user_group_turn_${now}` }); media.replyTargetId.value = undefined; persist(); await scrollBottom() }
const regenerate = async () => { if (isGenerating.value) return; if (![...props.group.messages].some((message: any) => message.type === 'right')) return showToast('还没有可重新生成的用户消息'); const removedIds: any[] = []; while (props.group.messages.length && props.group.messages.at(-1).type !== 'right') { const removed = props.group.messages.pop(); if (removed?.id != null) removedIds.push(removed.id) }; if (removedIds.length) invalidateMemoriesForMessages(props.group, removedIds); persist(); if (removedIds.length) void indexChatMemories(props.group); await runReply() }
const stopReply = () => groupReplyControllers.get(String(props.group.id))?.abort()
const handleSendEmoji = async (item: any) => { props.group.messages.push({ id: Date.now(), timestamp: Date.now(), type: 'right', content: item.name || '[表情]', messageType: 'emoji', isEmoji: true, emojiUrl: item.previewUrl, emojiId: item.id }); showEmojiPanel.value = false; persist(); await scrollBottom() }
const handleSendImage = (data: any) => media.handleSendImage(data, showExtensionPanel)
const handleSendVoice = (data: any) => media.handleSendVoice(data, showExtensionPanel)
const handleSendTransfer = (data: any) => media.handleSendTransfer(data, showExtensionPanel)
const onModalEdit = (id?: number) => { const message = props.group.messages.find((item: any) => item.id === (id || multi.targetMessageId.value)); if (!message) return; editTargetId.value = message.id; editInitialContent.value = message.content || ''; editInitialType.value = message.type; editHasMedia.value = Boolean(message.imageData || message.voiceData || message.transferData || message.isEmoji); showEditModal.value = true }
const handleEditSave = (payload: any) => {
  const index = props.group.messages.findIndex((item: any) => item.id === payload.messageId);
  if (index === -1) return;
  const message = props.group.messages[index];
  
  if (payload.action === 'replace') {
    invalidateMemoriesForMessages(props.group, [message.id]);
    message.content = payload.content;
    message.type = payload.type;
    if (payload.clearMedia) {
      delete message.imageData; delete message.voiceData; delete message.transferData; delete message.emojiUrl; message.isEmoji = false;
    }
  } else {
    // 插入逻辑
    const isAbove = payload.action === 'insert_above';
    const insertIndex = isAbove ? index : index + 1;
    // 使用微小的时间偏移确保排序正确且 ID 唯一
    const newTimestamp = message.timestamp + (isAbove ? -1 : 1); 
    const newMessage = {
      id: Date.now() + Math.floor(Math.random() * 1000), // 确保 ID 绝对唯一
      timestamp: newTimestamp,
      type: payload.type,
      content: payload.content,
      senderType: payload.type === 'right' ? 'user' : (payload.type === 'system' ? 'system' : 'character'),
      senderId: payload.type === 'right' ? String(currentChatUserId.value || 'user') : '',
      turnId: `manual_insert_${Date.now()}`
    };
    props.group.messages.splice(insertIndex, 0, newMessage);
    // 确保整个数组按时间戳重新排序，以防万一
    props.group.messages.sort((a: any, b: any) => a.timestamp - b.timestamp);
  }
  showEditModal.value = false;
  persist();
  void indexChatMemories(props.group);
}
const handleSaveUserThought = (text: string) => { props.group.pendingUserThought = text; showUserThoughtModal.value = false; persist(); showToast(text ? '本轮心声已保存' : '已清除本轮心声') }
const toggleMixedOffline = () => {
  if (!props.group.offlineMeetEnabled) return showToast('请先在群聊设置中开启线下见面模式')
  if (props.group.offlineMeetMode === 'separate') {
    if (!props.group.isMixedOfflineActive) {
      const now = Date.now()
      props.group.isMixedOfflineActive = true
      props.group.messages.push({ id: now, timestamp: now, type: 'system', content: '你们开始了群体线下见面', isOfflineMeetMsg: true })
      persist()
    }
    showSeparateOffline.value = true
    showExtensionPanel.value = false
    return
  }
  props.group.isMixedOfflineActive = !props.group.isMixedOfflineActive
  props.group.messages.push({ id: Date.now(), timestamp: Date.now(), type: 'system', content: props.group.isMixedOfflineActive ? '你们开始了线下见面' : '线下见面结束，回到线上群聊', isOfflineMeetMsg: Boolean(props.group.isMixedOfflineActive) })
  persist()
}
const handleSeparateOfflineSend = async (raw: string) => {
  const content = raw.trim()
  if (!content) return
  const now = Date.now()
  props.group.messages.push({ id: now, timestamp: now, type: 'right', senderType: 'user', senderId: String(currentChatUserId.value || 'user'), content, turnId: `user_group_offline_${now}`, isOfflineMeetMsg: true })
  persist()
  await runReply()
}
const finishSeparateOffline = () => {
  const now = Date.now()
  props.group.messages.push({ id: now, timestamp: now, type: 'system', content: '群体线下见面结束，回到线上群聊', isOfflineMeetMsg: true })
  props.group.isMixedOfflineActive = false
  showSeparateOffline.value = false
  persist()
}
const addCallEvent = (kind: 'voice' | 'video') => {
  if (activeCallType.value) return showToast('当前已在群通话中')
  const capableMembers = [...memberMap.value.values()].filter((member: any) => kind === 'voice' ? member.enableVoiceCall : member.enableVideoCall)
  if (!capableMembers.length) return showToast(`请先在群成员设置中开启${kind === 'voice' ? '语音' : '视频'}通话接入`)
  const now = Date.now()
  props.group.activeCallType = kind
  props.group.activeCallStartedAt = now
  props.group.activeCallStartMessageId = now
  props.group.messages.push({ id: now, timestamp: now, type: 'right', senderType: 'user', senderId: String(currentChatUserId.value || 'user'), content: `发起了群${kind === 'voice' ? '语音' : '视频'}通话`, messageType: 'call', callData: { callType: kind, status: 'started', participantIds: capableMembers.map((member: any) => String(member.characterEntityId || member.id)) } })
  callClock.value = now
  isCallMinimized.value = false
  showExtensionPanel.value = false
  persist()
  void runReply()
}
const handleCallAddMessage = async (raw: string) => {
  const content = raw.trim()
  if (!content || !activeCallType.value) return
  const now = Date.now()
  props.group.messages.push({ id: now, timestamp: now, type: 'right', senderType: 'user', senderId: String(currentChatUserId.value || 'user'), content, turnId: `user_group_call_${now}`, isVoiceCallProcessMsg: activeCallType.value === 'voice', isVideoCallProcessMsg: activeCallType.value === 'video' })
  persist()
}
const endGroupCall = () => {
  const kind = activeCallType.value
  if (!kind) return
  stopReply()
  const now = Date.now()
  const seconds = Math.max(0, Math.floor((now - Number(props.group.activeCallStartedAt || now)) / 1000))
  const duration = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
  const rawMessages = (props.group.messages || []).filter((message: any) => kind === 'voice' ? message.isVoiceCallProcessMsg : message.isVideoCallProcessMsg).map((message: any) => ({ ...message }))
  props.group.callSummaries ||= []
  props.group.callSummaries.push({ id: `group_call_${now}`, date: new Date(now).toLocaleString('zh-CN'), duration, direction: 'out', callType: kind, content: rawMessages.map((message: any) => `${message.type === 'right' ? (groupUserProfile.value.name || '我') : memberName(String(message.senderId || ''))}：${message.content}`).join('\n') || '本次群通话无文字记录', rawMessages })
  props.group.messages.push({ id: now, timestamp: now, type: 'system', content: `群${kind === 'voice' ? '语音' : '视频'}通话已结束，通话时长 ${duration}`, messageType: 'call', callData: { callType: kind, status: 'ended', duration: seconds } })
  props.group.activeCallType = null
  props.group.activeCallStartedAt = 0
  props.group.activeCallStartMessageId = 0
  isCallMinimized.value = false
  persist()
}
const deleteCallMessage = (messageId: number) => { const index = props.group.messages.findIndex((message: any) => message.id === messageId); if (index >= 0) { props.group.messages.splice(index, 1); persist() } }
const toggleVoiceText = (id: number) => { expandedVoiceIds.value.has(id) ? expandedVoiceIds.value.delete(id) : expandedVoiceIds.value.add(id) }
const handlePlayVoice = async (id: number, text: string) => {
  const message = props.group.messages.find((item: any) => item.id === id)
  const member: any = memberMap.value.get(String(message?.senderId || ''))
  if (!member?.enableVoiceReply) return
  try { await playVoice(id, text, member) } catch (error: any) { showToast(error?.message?.startsWith('MISSING_') ? '请先在角色语音设置中配置密钥' : (error?.message || '语音播放失败')) }
}

const updateGroupMemories = (memories: any[]) => { props.group.memoryBook = memories; persist(); void indexChatMemories(props.group) }
const refreshGroupMemories = async (selectedIds: number[], strategy: 'replace' | 'archive') => {
  const chosen = (props.group.memoryBook || []).filter((item: any) => selectedIds.includes(item.id))
  if (!chosen.length) return
  isSummarizingMemories.value = true
  try {
    const extraction = await summarizeMemories(chosen)
    if (!extraction?.narrative) return
    const now = Date.now()
    const evidenceMessageIds = [...new Set(chosen.flatMap((item: any) => item.evidenceMessageIds || []))]
    const next = strategy === 'replace'
      ? props.group.memoryBook.filter((item: any) => !selectedIds.includes(item.id))
      : props.group.memoryBook.map((item: any) => selectedIds.includes(item.id) ? { ...item, archived: true, enabled: false, archivedAt: now } : item)
    next.push({ id: now, date: new Date().toLocaleDateString('zh-CN'), content: extraction.narrative, evidenceMessageIds, childMemoryIds: chosen.map((item: any) => item.id), messageCount: evidenceMessageIds.length, isCondensed: true, memoryLevel: 2, memoryMode: props.group.memoryMode || 'hybrid', version: 2, createdAt: now, updatedAt: now, enabled: true })
    props.group.memoryBook = next
    replaceStructuredMemoriesForEvidence(props.group, extraction, chosen, props.group.memoryMode || 'hybrid')
    persist(); await indexChatMemories(props.group)
  } finally { isSummarizingMemories.value = false }
}
onBeforeUnmount(() => {
  if (timeInterval) clearInterval(timeInterval)
  if (autoSummaryTimer) clearTimeout(autoSummaryTimer)
  if (idleSummaryTimer) clearTimeout(idleSummaryTimer)
  if (props.group.autoSummaryEnabled && props.group.autoSummaryOnExit && !isSummarizing.value) void handleManualSummaryLatest()
})

watch(() => props.group.id, async id => {
  wallpaper.value = await wallpaperStore.getItem<string>(`wallpaper_${id}`)
  const loaded: Record<string, string> = {}
  for (const memberId of props.group.memberIds || []) {
    if (!props.group.memberHasCustomAvatar?.[memberId]) continue
    const value = await groupMemberAvatarsStore.getItem<string>(`${id}_${memberId}`)
    if (value) loaded[memberId] = value
  }
  groupMemberAvatarUrls.value = loaded
  exitMultiSelectMode(); await scrollBottom()
}, { immediate: true })
onMounted(async () => { await loadEmojis(); updateTimeStr(); timeInterval = setInterval(() => { updateTimeStr(); callClock.value = Date.now() }, 1000); await scrollBottom() })
</script>

<template>
  <ChatOfflineMeetView v-if="showSeparateOffline" group-mode :group="group" :external-is-generating="isGenerating" @back="finishSeparateOffline" @send="handleSeparateOfflineSend" @trigger-api="runReply" @stop-generate="stopReply" @regenerate="regenerate" />
  <div v-else class="view-container full-height chat-view-bg group-room" :style="groupWallpaperStyle">
    <div v-if="wallpaper" class="chat-wallpaper-overlay"></div>

    <ChatRoomHeader
      :selectedChat="group"
      :totalUnreadCount="totalUnreadCount"
      :currentDateStr="currentDateStr"
      :currentDayStr="currentDayStr"
      @back="emit('back')"
      @open-settings="emit('open-settings')"
      @show-inner-thought-modal="showInnerThoughtModal = true"
      @show-memory-modal="showMemoryModal = true"
      @open-offline-meet="toggleMixedOffline"
      @click-overlay="showExtensionPanel = false; showEmojiPanel = false"
    />

    <ChatRoomMessageList ref="messageListRef" :displayMessages="displayMessages" :selectedChat="group" :myProfile="groupUserProfile" :selectionMode="selectionMode" :isSelected="isSelected" :justMarkedIds="multi.justMarkedIds.value" :expandedImageIds="media.expandedImageIds.value" :expandedVoiceIds="expandedVoiceIds" :currentMediaThumb="currentMediaThumb" :voicePlayingId="voicePlayingId" :isVoiceSynthesizing="isVoiceSynthesizing" :resolveSender="resolveSender" @click-overlay="showExtensionPanel = false; showEmojiPanel = false" @click-message="multi.handleMessageClick" @toggle-selection="toggleMessageSelection" @touch-start="multi.handleTouchStart" @touch-end="multi.handleTouchEnd" @touch-move="multi.handleTouchMove" @toggle-image-text="media.toggleImageText" @toggle-voice-text="toggleVoiceText" @play-voice="handlePlayVoice" @handle-left-transfer-click="transfer.handleLeftTransferClick" @open-character-profile="emit('open-character-profile', $event)" />

    <ChatMessageActionModal :visible="multi.showActionModal.value" :message-id="multi.targetMessageId.value" :message-obj="multi.targetMessageId.value ? group.messages.find((message: any) => message.id === multi.targetMessageId.value) : null" @close="multi.showActionModal.value = false" @multi-select="multi.onModalMultiSelect" @recall-multi-select="multi.onModalRecallMultiSelect" @mark-message="multi.onModalMarkMultiSelect" @copy="multi.onModalCopy" @reply="media.replyTargetId.value = $event || multi.targetMessageId.value" @edit="onModalEdit" />
    <ChatMessageEditModal :visible="showEditModal" :message-id="editTargetId" :initial-content="editInitialContent" :initial-type="editInitialType" :has-media="editHasMedia" @close="showEditModal = false" @save="handleEditSave" />

    <ChatRoomInputArea :selectionMode="selectionMode" :getSelectedCount="getSelectedCount" :displayMessages="displayMessages" :replyTargetMessage="media.replyTargetMessage.value" :showExtensionPanel="showExtensionPanel" :showEmojiPanel="showEmojiPanel" :panelEmojis="panelEmojis" :isGenerating="isGenerating" :selectedChat="group" :isMixedOfflineActive="Boolean(group.isMixedOfflineActive)" @exit-multi-select-mode="exitMultiSelectMode" @select-all="selectAll" @recall-selected-messages="multi.recallSelectedMessages" @mark-selected-messages="multi.markSelectedMessages" @delete-selected-messages="multi.deleteSelectedMessages" @cancel-reply="media.cancelReply" @toggle-extension-panel="showExtensionPanel = !showExtensionPanel; showEmojiPanel = false" @toggle-emoji-panel="showEmojiPanel = !showEmojiPanel; showExtensionPanel = false" @trigger-api="runReply" @add-message="handleAddMessage" @open-settings="emit('open-settings')" @handle-send-emoji="handleSendEmoji" @handle-stop-call="stopReply" @handle-regenerate="regenerate" @show-transfer-modal="media.showTransferModal.value = true" @show-voice-modal="media.showVoiceModal.value = true" @show-image-modal="media.showImageModal.value = true" @show-voice-call-modal="addCallEvent('voice')" @show-video-call-modal="addCallEvent('video')" @show-user-thought-modal="showUserThoughtModal = true" @toggle-mixed-offline="toggleMixedOffline" @focus-input="scrollBottom" @update:showExtensionPanel="showExtensionPanel = $event" @update:showEmojiPanel="showEmojiPanel = $event" />
    <ChatTransferModal :visible="media.showTransferModal.value" :target-name="group.name" @close="media.showTransferModal.value = false" @send="handleSendTransfer" />
    <ChatVoiceModal :visible="media.showVoiceModal.value" @close="media.showVoiceModal.value = false" @send="handleSendVoice" />
    <ChatImageModal :visible="media.showImageModal.value" @close="media.showImageModal.value = false" @send="handleSendImage" />
    <ChatUserThoughtModal :visible="showUserThoughtModal" :initial-text="group.pendingUserThought || ''" @close="showUserThoughtModal = false" @save="handleSaveUserThought" />
    <ChatInnerThoughtModal :visible="showInnerThoughtModal" :chat="group" @close="showInnerThoughtModal = false" @save="persist" />
    <ChatMemoryModal :visible="showMemoryModal" :memories="group.memoryBook || []" :messages="group.messages || []" :is-summarizing="isSummarizing || isSummarizingMemories" @close="showMemoryModal = false" @update-memories="updateGroupMemories" @summarize-memories="refreshGroupMemories" />
    <transition name="folder-fade">
      <div v-if="transfer.showRedPacketOpenModal.value" class="folder-modal-overlay" @click="transfer.closeLeftRedPacket" @touchmove.prevent>
        <div class="red-packet-modal" :class="transfer.redPacketStatus.value" @click.stop>
          <div class="rp-close" @click="transfer.closeLeftRedPacket">×</div>
          <div class="rp-avatar" :style="activeTransferSender.avatarUrl ? { backgroundImage: `url(${activeTransferSender.avatarUrl})` } : {}">{{ activeTransferSender.avatarUrl ? '' : (activeTransferSender.avatarText || '伴') }}</div>
          <div class="rp-name">{{ activeTransferSender.name || '群成员' }}</div>
          <div v-if="transfer.redPacketStatus.value !== 'opened'" class="rp-desc">发了一个红包，金额随机</div>
          <div class="rp-remark">{{ transfer.activeTransferModalData.value?.remark || '恭喜发财，大吉大利' }}</div>
          <div v-if="transfer.redPacketStatus.value === 'opened'" class="rp-amount-display"><span class="currency">¥</span><span class="amount-val">{{ transfer.activeTransferModalData.value?.amount }}</span></div>
          <div v-if="transfer.redPacketStatus.value !== 'opened'" class="rp-open-btn" :class="{ 'is-opening': transfer.redPacketStatus.value === 'opening' }" @click="transfer.openLeftRedPacket"><span v-if="transfer.redPacketStatus.value === 'closed'">開</span><span v-else class="rp-loading-spinner"></span></div>
          <div v-if="transfer.redPacketStatus.value === 'closed'" class="rp-reject-text" @click="transfer.rejectLeftRedPacket">退回红包</div>
          <div class="rp-bottom-bg"></div>
        </div>
      </div>
    </transition>
    <transition name="folder-fade">
      <div v-if="transfer.showTransferConfirmModal.value" class="folder-modal-overlay" @click="transfer.showTransferConfirmModal.value = false" @touchmove.prevent>
        <div class="transfer-confirm-modal" @click.stop>
          <div class="tc-header"><div class="tc-avatar" :style="activeTransferSender.avatarUrl ? { backgroundImage: `url(${activeTransferSender.avatarUrl})` } : {}">{{ activeTransferSender.avatarUrl ? '' : (activeTransferSender.avatarText || '伴') }}</div><div class="tc-title">来自 {{ activeTransferSender.name || '群成员' }} 的转账</div></div>
          <div class="tc-amount">¥{{ transfer.activeTransferModalData.value?.amount }}</div>
          <div v-if="transfer.activeTransferModalData.value?.remark" class="tc-remark">{{ transfer.activeTransferModalData.value.remark }}</div>
          <div class="tc-actions"><div class="tc-btn reject" @click="transfer.rejectLeftTransfer">退还</div><div class="tc-btn confirm" @click="transfer.confirmLeftTransfer">确认收款</div></div>
        </div>
      </div>
    </transition>
    <ChatVoiceCallView
      :show="activeCallType === 'voice' && !isCallMinimized"
      status="connected"
      :duration-str="callDurationStr"
      :char-name="group.name"
      :char-avatar="group.avatarUrl || ''"
      :is-generating="isGenerating"
      :display-messages="activeCallMessages"
      @close="isCallMinimized = true"
      @end-call="endGroupCall"
      @add-message="handleCallAddMessage"
      @trigger-api="runReply"
      @stop-generate="stopReply"
      @regenerate="regenerate"
      @minimize="isCallMinimized = true"
      @edit-message="onModalEdit"
      @delete-message="deleteCallMessage"
    />
    <ChatVideoCallView
      :show="activeCallType === 'video' && !isCallMinimized"
      status="connected"
      :duration-str="callDurationStr"
      :char-name="group.name"
      :char-avatar="group.avatarUrl || ''"
      :is-generating="isGenerating"
      :display-messages="activeCallMessages"
      @close="isCallMinimized = true"
      @end-call="endGroupCall"
      @add-message="handleCallAddMessage"
      @trigger-api="runReply"
      @stop-generate="stopReply"
      @regenerate="regenerate"
      @minimize="isCallMinimized = true"
      @edit-message="onModalEdit"
      @delete-message="deleteCallMessage"
    />
    <ChatVoiceCallWidget
      :visible="Boolean(activeCallType) && isCallMinimized"
      call-status="connected"
      :duration-str="callDurationStr"
      :avatar-url="group.avatarUrl || ''"
      @restore="isCallMinimized = false"
      @end-call="endGroupCall"
    />
    <transition name="toast-fade"><div v-if="toastText" class="wechat-toast">{{ toastText }}</div></transition>
  </div>
</template>

<style scoped>
@import './ChatRoomView.css';
.group-room{display:flex;flex-direction:column;min-height:0}
</style>
