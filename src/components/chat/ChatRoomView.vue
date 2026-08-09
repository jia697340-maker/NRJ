/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useChatState } from '../../composables/useChatState'
import { useChatMessageSelection } from '../../composables/useChatMessageSelection'
import ChatMessageActionModal from './modals/ChatMessageActionModal.vue'
import ChatMessageEditModal from './modals/ChatMessageEditModal.vue'
import ChatTransferModal from './modals/ChatTransferModal.vue'
import ChatVoiceModal from './modals/ChatVoiceModal.vue'
import ChatImageModal from './modals/ChatImageModal.vue'
import ChatErrorFolderModal from './modals/ChatErrorFolderModal.vue'
import ChatMemoryModal from './modals/ChatMemoryModal.vue'
import ChatEmojiPreviewModal from './modals/ChatEmojiPreviewModal.vue'
import ChatInnerThoughtModal from './modals/ChatInnerThoughtModal.vue'
import ChatImageGalleryModal from './modals/ChatImageGalleryModal.vue'
import ChatOfflineSessionEndModal from './modals/ChatOfflineSessionEndModal.vue'
import ChatVoiceCallView from './ChatVoiceCallView.vue'
import ChatVideoCallView from './ChatVideoCallView.vue'
import ChatCallRecordsView from './ChatCallRecordsView.vue'
import localforage from 'localforage'
import { chatSettings } from '../../store'
import { useChatRoomAPI } from '../../composables/useChatRoomAPI'
import { useBubbleBeautify } from '../../composables/useBubbleBeautify'
import { useChatAuth } from '../../composables/useChatAuth'
import { useChatRoomGalleryUI } from '../../composables/useChatRoomGalleryUI'
import { useChatRoomVoiceCallUI } from '../../composables/useChatRoomVoiceCallUI'
import { useChatRoomVideoCallUI } from '../../composables/useChatRoomVideoCallUI'
import {
  attachActiveOfflineSession,
  finishMixedOfflineSession,
  generateOfflineSessionSummary,
  getActiveOfflineSession,
  isMixedOfflineActive as checkMixedOfflineActive,
  startMixedOfflineSession,
  type OfflineCarryoverMode
} from '../../services/offlineSessions'

useBubbleBeautify()

import { useVoicePlayer } from '../../composables/useVoicePlayer'
const { playVoice, stopVoice, isPlaying: isVoicePlaying, isSynthesizing: isVoiceSynthesizing, currentPlayingId: voicePlayingId } = useVoicePlayer()

import ChatRoomHeader from './room/ChatRoomHeader.vue'
import ChatRoomMessageList from './room/ChatRoomMessageList.vue'
import ChatRoomInputArea from './room/ChatRoomInputArea.vue'
import ChatVoiceCallWidget from './room/ChatVoiceCallWidget.vue'

// 提前声明将被 composable 引用的基础函数，解决 500 报错
const toastVisible = ref(false)
const toastMessage = ref('')
let toastTimer: any = null

function showToast(msg: string) {
  toastMessage.value = msg
  toastVisible.value = true
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => {
    toastVisible.value = false
  }, 2000)
}

function updatePreviewAndTime(content: string) {
  if (!selectedChat.value) return
  selectedChat.value.preview = content
  const now = new Date()
  selectedChat.value.time = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

const messageListRef = ref<InstanceType<typeof ChatRoomMessageList> | null>(null)
async function scrollToBottom() {
  if (messageListRef.value) {
    await messageListRef.value.scrollToBottom()
  }
}

function saveCustomContacts(targetChat: any = selectedChat.value) {
  if (!targetChat) return
  if (targetChat.id === 1) {
    localStorage.setItem('clingy_system_messages', JSON.stringify(targetChat.messages))
    return
  }
  const { currentChatUserId } = useChatAuth()
  const contactsKey = currentChatUserId.value ? `clingy_custom_contacts_${currentChatUserId.value}` : 'clingy_custom_contacts'
  const savedStr = localStorage.getItem(contactsKey)
  if (savedStr) {
    const contacts = JSON.parse(savedStr)
    const index = contacts.findIndex((c: any) => c.id === targetChat.id)
    if (index !== -1) {
      contacts[index].messages = targetChat.messages
      contacts[index].innerThoughts = targetChat.innerThoughts || []
      contacts[index].memoryBook = targetChat.memoryBook || []
      contacts[index].memoryState = targetChat.memoryState || null
      contacts[index].lastSummaryMsgId = targetChat.lastSummaryMsgId || 0
      contacts[index].callSummaries = targetChat.callSummaries || []
      contacts[index].offlineMeetSessions = targetChat.offlineMeetSessions || []
      contacts[index].activeOfflineSessionId = targetChat.activeOfflineSessionId || null
      contacts[index].preview = targetChat.preview
      contacts[index].time = targetChat.time
      localStorage.setItem(contactsKey, JSON.stringify(contacts))
    }
  }
}

// 获取或者初始化 IndexedDB 存储
const wallpaperStore = localforage.createInstance({
  name: 'nrt-app',
  storeName: 'chatWallpapers'
})

// 用于存储各角色的自定义媒体缩略图
const mediaThumbStore = localforage.createInstance({
  name: 'nrt-app',
  storeName: 'mediaThumbs'
})

const emit = defineEmits<{
  (e: 'back'): void
  (e: 'open-settings'): void
  (e: 'open-offline-meet'): void
  (e: 'voice-call-state-change', state: {
    active: boolean
    minimized: boolean
    status: 'idle' | 'calling' | 'incoming' | 'connected' | 'ended'
    durationStr: string
    charName: string
    charAvatar: string
    chatId?: string | number
  }): void
}>()

const { mockChats, selectedChat, effectiveMyProfile: myProfile, buildChatMessages, totalUnreadCount, showNotification, checkTransfersExpired } = useChatState()

const showExtensionPanel = ref(false)
const showEmojiPanel = ref(false)
const showOfflineSessionEndModal = ref(false)
const isEndingOfflineSession = ref(false)
const offlineSessionEndError = ref('')
const isMixedOfflineSessionActive = computed(() => checkMixedOfflineActive(selectedChat.value))
const activeOfflineSessionMessageCount = computed(() => {
  const session = getActiveOfflineSession(selectedChat.value)
  if (!session) return 0
  return (selectedChat.value?.messages || []).filter((item: any) =>
    item.offlineSessionId === session.id && !item.isOfflineSessionBoundary
  ).length
})

watch(() => selectedChat.value?.messages?.length || 0, () => {
  if (!isMixedOfflineSessionActive.value) return
  const latestMessage = selectedChat.value?.messages?.[selectedChat.value.messages.length - 1]
  if (!latestMessage || latestMessage.offlineSessionId || latestMessage.isVoiceCallProcessMsg || latestMessage.isVideoCallProcessMsg) return
  attachActiveOfflineSession(selectedChat.value, latestMessage)
}, { flush: 'sync' })

import { useChatEmoji } from '../../composables/useChatEmoji'
const { emojis, loadEmojis } = useChatEmoji()
const panelEmojis = computed(() => emojis.value)

const {
  selectionMode,
  isMultiSelectMode,
  selectedMessageIds,
  enterMultiSelectMode,
  exitMultiSelectMode,
  toggleMessageSelection,
  isSelected,
  selectAll,
  getSelectedCount
} = useChatMessageSelection()

const expandedVoiceIds = ref<Set<number>>(new Set())
const toggleVoiceText = (msgId: number) => {
  if (isMultiSelectMode.value) return
  if (expandedVoiceIds.value.has(msgId)) {
    expandedVoiceIds.value.delete(msgId)
  } else {
    expandedVoiceIds.value.add(msgId)
  }
}

// 处理缺失密钥弹窗
const showMissingVoiceKeyModal = ref(false)
const closeMissingVoiceKeyModal = () => {
  showMissingVoiceKeyModal.value = false
}

const handlePlayVoice = async (msgId: number, text: string) => {
  if (isMultiSelectMode.value) return
  try {
    await playVoice(msgId, text, selectedChat.value)
  } catch (err: any) {
    if (['MISSING_API_KEY', 'MISSING_SEED_AUDIO_API_KEY', 'MISSING_GEMINI_VOICE_API_KEY'].includes(err.message)) {
      showMissingVoiceKeyModal.value = true
    }
  }
}

import { useChatRoomMultiSelect } from '../../composables/useChatRoomMultiSelect'

const {
  showActionModal,
  targetMessageId,
  canRecallTarget,
  handleTouchStart,
  handleTouchEnd,
  handleTouchMove,
  handleMessageClick,
  onModalMultiSelect,
  onModalRecallMultiSelect,
  onModalMarkMultiSelect,
  onModalCopy,
  recallSelectedMessages,
  showRecallContentModal,
  recallOriginalContent,
  viewRecalledMessage,
  deleteSelectedMessages,
  markSelectedMessages,
  justMarkedIds
} = useChatRoomMultiSelect(
  selectedChat,
  isMultiSelectMode,
  selectedMessageIds,
  enterMultiSelectMode,
  exitMultiSelectMode,
  toggleMessageSelection,
  saveCustomContacts,
  updatePreviewAndTime,
  showToast
)

import { useChatRoomMessage } from '../../composables/useChatRoomMessage'

const {
  showImageModal,
  expandedImageIds,
  toggleImageText,
  handleSendImage: originalHandleSendImage,
  showVoiceModal,
  handleSendVoice: originalHandleSendVoice,
  showTransferModal,
  handleSendTransfer: originalHandleSendTransfer,
  replyTargetId,
  replyTargetMessage,
  cancelReply
} = useChatRoomMessage(
  selectedChat,
  myProfile,
  isMultiSelectMode,
  saveCustomContacts,
  scrollToBottom,
  updatePreviewAndTime
)

const handleSendImage = (data: { file?: File, dataUrl?: string, text?: string }) => originalHandleSendImage({ text: data.text ?? '' }, showExtensionPanel)
const handleSendVoice = (data: { text: string, seconds: number }) => originalHandleSendVoice(data, showExtensionPanel)
const handleSendTransfer = (data: { type: 'red_packet' | 'transfer', amount: number, remark: string, expireHours: number }) => originalHandleSendTransfer(data, showExtensionPanel)

const onModalReply = (msgId?: number) => {
  replyTargetId.value = msgId || targetMessageId.value
}

// 消息编辑相关
const showEditModal = ref(false)
const editTargetId = ref<number | undefined>(undefined)
const editInitialContent = ref('')
const editInitialType = ref('left')

const editHasMedia = ref(false)

const onModalEdit = (msgId?: number) => {
  const targetId = msgId || targetMessageId.value
  if (!targetId || !selectedChat.value?.messages) return

  const targetMsg = selectedChat.value.messages.find((m: any) => m.id === targetId)
  if (targetMsg) {
    editTargetId.value = targetId
    editInitialContent.value = targetMsg.content || ''
    editInitialType.value = targetMsg.type || 'left'
    editHasMedia.value = !!(targetMsg.imageData || targetMsg.voiceData || targetMsg.isEmoji || targetMsg.transferData)
    showEditModal.value = true
  }
}

const handleEditSave = (payload: { messageId?: number, content: string, type: string, clearMedia: boolean }) => {
  if (!payload.messageId || !selectedChat.value?.messages) return

  const targetMsg = selectedChat.value.messages.find((m: any) => m.id === payload.messageId)
  if (targetMsg) {
    targetMsg.content = payload.content
    targetMsg.type = payload.type
    if (targetMsg.translation) {
      delete targetMsg.translation
      delete targetMsg.translationLanguage
      targetMsg.translationStatus = 'stale'
    }
    
    if (payload.clearMedia) {
      delete targetMsg.imageData
      delete targetMsg.voiceData
      delete targetMsg.transferData
      targetMsg.isEmoji = false
      delete targetMsg.emojiUrl
      delete targetMsg.emojiId
    }
    
    saveCustomContacts()
    if (!isCallPanelActive.value && !isVideoCallPanelActive.value) {
      updatePreviewAndTime(payload.content)
    }
    showToast('消息已修改')
  }
  showEditModal.value = false
}

// 删除通话中的某条消息（通话气泡长按菜单）
const handleCallMessageDelete = (msgId: number) => {
  const messages = selectedChat.value?.messages
  if (!messages) return

  const idx = messages.findIndex((m: any) => m.id === msgId)
  if (idx === -1) return

  messages.splice(idx, 1)
  saveCustomContacts()
  showToast('已删除')
}

const toggleExtensionPanel = () => {
  showExtensionPanel.value = !showExtensionPanel.value
  if (showExtensionPanel.value) {
    showEmojiPanel.value = false
  }
}

const toggleEmojiPanel = () => {
  showEmojiPanel.value = !showEmojiPanel.value
  if (showEmojiPanel.value) {
    showExtensionPanel.value = false
  }
}

const emojiPreviewVisible = ref(false)
const emojiPreviewUrl = ref('')
const emojiPreviewName = ref('')

const handleEmojiClick = (url: string | undefined, name: string | undefined) => {
  if (isMultiSelectMode.value) return
  if (!url) return
  emojiPreviewUrl.value = url
  emojiPreviewName.value = name || ''
  emojiPreviewVisible.value = true
}

const handleSendEmoji = async (item: any) => {
  if (!selectedChat.value) return
  
  if (!selectedChat.value.messages) {
    selectedChat.value.messages = []
  }

  selectedChat.value.messages.push({
    id: Date.now(),
    type: 'right',
    content: item.name || '[表情]',
    isEmoji: true,
    emojiUrl: item.previewUrl,
    emojiId: item.id
  })
  
  showEmojiPanel.value = false
  updatePreviewAndTime('[表情]')
  saveCustomContacts()
  await scrollToBottom()
}

import { useChatRoomDisplay } from '../../composables/useChatRoomDisplay'

const {
  formatTimeFriendly,
  displayMessages
} = useChatRoomDisplay(selectedChat)

const shouldShowAvatar = (msg: any, index: number, messages: any[]) => {
  if (msg.type !== 'left' && msg.type !== 'right') return false
  
  const style = chatSettings.avatarDisplayStyle || 'all'
  if (style === 'none') return false
  if (style === 'all') return true
  
  if (style === 'user_only') {
    return msg.type === 'right'
  }
  
  if (style === 'character_only') {
    return msg.type === 'left'
  }
  
  return true
}

const shouldShowName = (msg: any, index: number, messages: any[]) => {
  if (msg.type !== 'left' && msg.type !== 'right') return false
  
  const style = chatSettings.nameDisplayStyle || 'all'
  if (style === 'none') return false
  if (style === 'all') return true
  
  if (style === 'user_only') {
    return msg.type === 'right'
  }
  
  if (style === 'character_only') {
    return msg.type === 'left'
  }
  
  return true
}

const currentDateStr = ref('')
const currentDayStr = ref('')
let timeInterval: any
const isRoomActive = ref(false)

const handleCancelImageGeneration = (msgId: number) => {
  handleStopCall()
  
  if (selectedChat.value) {
    const msgToUpdate = selectedChat.value.messages.find((m: any) => m.id === msgId)
    if (msgToUpdate) {
      msgToUpdate.isGeneratingImage = false
      msgToUpdate.content = '[生成已取消]'
      saveCustomContacts()
    }
  }
}

const handleAddMessage = async (text: string) => {
  if (!text || !selectedChat.value) return
  
  if (!selectedChat.value.messages) {
    selectedChat.value.messages = []
  }
  
  let quote = undefined
  if (replyTargetMessage.value) {
    quote = {
      id: replyTargetMessage.value.id,
      content: replyTargetMessage.value.content,
      sender: replyTargetMessage.value.sender
    }
  }

  const newMessage = {
    id: Date.now(),
    type: 'right',
    content: text,
    quote: quote,
    isVoiceCallProcessMsg: isCallPanelActive.value,
    isVideoCallProcessMsg: isVideoCallPanelActive.value
  }
  if (!isCallPanelActive.value && !isVideoCallPanelActive.value && isMixedOfflineSessionActive.value) {
    attachActiveOfflineSession(selectedChat.value, newMessage)
  }
  selectedChat.value.messages.push(newMessage)
  
  if (isCallPanelActive.value) {
     checkAndGenerateTempSummary(voiceCallMessages.value)
  } else if (isVideoCallPanelActive.value) {
     checkAndGenerateVideoTempSummary(videoCallMessages.value)
  }

  replyTargetId.value = undefined
  if (!isCallPanelActive.value && !isVideoCallPanelActive.value) {
    updatePreviewAndTime(text)
  }
  saveCustomContacts()
  await scrollToBottom()
  
  if (selectedChat.value.id === 1) {
    selectedChat.value.isTyping = true
    setTimeout(() => {
      selectedChat.value.isTyping = false
      const reply = '我是一个本地的系统通知助手，无法与你进行真实对话。请创建你自己的角色吧！'
      selectedChat.value.messages.push({
        id: Date.now(),
        type: 'left',
        content: reply
      })
      updatePreviewAndTime(reply)
      saveCustomContacts()
      scrollToBottom()
    }, 1000)
    return
  }
}

const {
  isGenerating,
  showErrorModal,
  errorMessage,
  errorDetails,
  activeErrorTab,
  copyButtonText,
  closeErrorModal,
  copyErrorDetails,
  handleStopCall,
  handleRegenerate: originalHandleRegenerate,
  triggerAPI,
  reSummarizeImage,
  mountTestError
} = useChatRoomAPI(
  mockChats,
  selectedChat,
  myProfile,
  buildChatMessages,
  showNotification,
  saveCustomContacts,
  scrollToBottom,
  isRoomActive,
  (reason, resume) => handleIncomingCall(reason, resume, Number(chatSettings.charCallRingSeconds) > 0 ? Number(chatSettings.charCallRingSeconds) : 30),
  () => {
    if (isMixedOfflineSessionActive.value) return 'mixed'
    return false
  }
)

const toggleMixedOfflineSession = () => {
  if (!selectedChat.value?.offlineMeetEnabled || selectedChat.value.offlineMeetMode !== 'mixed') return
  if (isCallPanelActive.value || isVideoCallPanelActive.value) {
    showToast('请先结束当前通话')
    return
  }
  if (isMixedOfflineSessionActive.value) {
    offlineSessionEndError.value = ''
    showOfflineSessionEndModal.value = true
    showExtensionPanel.value = false
    return
  }
  if (isGenerating.value) {
    showToast('请等待当前回复完成或先停止响应')
    return
  }
  startMixedOfflineSession(selectedChat.value)
  updatePreviewAndTime('本次线下见面开始')
  saveCustomContacts()
  showExtensionPanel.value = false
  showToast('已进入线下见面')
  scrollToBottom()
}

const finishOfflineSession = async (options: {
  carryoverMode: OfflineCarryoverMode
  recentMessageCount: number
  summaryInstruction: string
}) => {
  const chat = selectedChat.value
  const session = getActiveOfflineSession(chat)
  if (!chat || !session || isEndingOfflineSession.value) return

  isEndingOfflineSession.value = true
  offlineSessionEndError.value = ''
  if (isGenerating.value) handleStopCall()

  try {
    const sourceMessages = (chat.messages || []).filter((item: any) =>
      item.offlineSessionId === session.id && !item.isOfflineSessionBoundary
    )
    let summary = ''
    if (options.carryoverMode !== 'none') {
      if (sourceMessages.length === 0) throw new Error('本次见面还没有可整理的内容')
      summary = await generateOfflineSessionSummary(
        chat,
        sourceMessages,
        myProfile.value?.name || '用户',
        options.summaryInstruction
      )
    }

    const preview = finishMixedOfflineSession(chat, session, { ...options, summary })
    updatePreviewAndTime(preview.split('\n')[0])
    saveCustomContacts()
    if (summary && options.carryoverMode !== 'none') {
      indexChatMemories(chat).catch(error => console.warn('线下见面摘要已保存，但记忆索引未完成', error))
    }
    showOfflineSessionEndModal.value = false
    showToast('已结束线下见面并返回线上')
    await scrollToBottom()
  } catch (error: any) {
    offlineSessionEndError.value = error?.message || '线下记录整理失败，请稍后重试'
  } finally {
    isEndingOfflineSession.value = false
  }
}

const handleRegenerate = () => {
  originalHandleRegenerate(showExtensionPanel, showToast)
}

const handleResummarize = (msgId?: number) => {
  if (!msgId) return
  reSummarizeImage(msgId, showToast)
}

const updateTime = () => {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  currentDateStr.value = `${y}.${m}.${d}`
  
  const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
  currentDayStr.value = days[now.getDay()]
}

const currentRoomWallpaper = ref<string | null>(null)
const currentMediaThumb = ref<string | null>(null)
const showMemoryModal = ref(false)
const isSummarizingMemories = ref(false)

const showInnerThoughtModal = ref(false)

const showCallRecordsView = ref(false)
const handleOpenCallRecords = () => {
  showCallRecordsView.value = true
}

const {
  showImageGalleryModal,
  galleryTargetMessage,
  handleOpenGallery,
  handleGalleryRegenerate,
  handleGalleryDelete
} = useChatRoomGalleryUI(
  selectedChat,
  isMultiSelectMode,
  saveCustomContacts,
  showToast
)

import { useChatSummary } from '../../composables/useChatSummary'
import { indexChatMemories } from '../../services/memoryEngine'
const { summarizeMemories, handleAutoSummary, handleManualSummaryLatest } = useChatSummary(selectedChat, saveCustomContacts, showToast)
let autoSummaryTimer: any = null
let idleSummaryTimer: any = null
const runAutoSummaryWhenChatIdle = (force = false) => {
  if (isGenerating.value) {
    autoSummaryTimer = setTimeout(() => runAutoSummaryWhenChatIdle(force), 900)
    return
  }
  handleAutoSummary(force)
}

watch(() => selectedChat.value?.messages?.length || 0, () => {
  if (!selectedChat.value?.autoSummaryEnabled) return
  if (autoSummaryTimer) clearTimeout(autoSummaryTimer)
  if (idleSummaryTimer) clearTimeout(idleSummaryTimer)
  autoSummaryTimer = setTimeout(() => {
    runAutoSummaryWhenChatIdle()
  }, 900)
  const idleMinutes = Number(selectedChat.value?.autoSummaryIdleMinutes || 0)
  if (idleMinutes > 0) {
    idleSummaryTimer = setTimeout(() => runAutoSummaryWhenChatIdle(true), Math.min(idleMinutes, 1440) * 60 * 1000)
  }
})

const handleRoomBack = async () => {
  if (autoSummaryTimer) clearTimeout(autoSummaryTimer)
  if (idleSummaryTimer) clearTimeout(idleSummaryTimer)
  if (selectedChat.value?.autoSummaryEnabled && selectedChat.value?.autoSummaryOnExit) {
    await handleManualSummaryLatest()
  }
  emit('back')
}

const {
  showVoiceCallModal,
  isVoiceCallMinimized,
  callStatus,
  durationStr,
  currentCallTempSummary,
  isCallPanelActive,
  voiceCallMessages,
  voiceCallStatePayload,
  startVoiceCall,
  restoreVoiceCall,
  minimizeVoiceCall,
  handleVoiceCallTriggerAPI,
  handleIncomingCall,
  handleIncomingCallMissed,
  handleIncomingCallAccept,
  handleVoiceCallEnd,
  handleResummarizeVoiceCall,
  checkUnfinishedCalls,
  checkAndGenerateTempSummary
} = useChatRoomVoiceCallUI(
  selectedChat,
  myProfile,
  isMultiSelectMode,
  saveCustomContacts,
  scrollToBottom,
  showToast,
  triggerAPI,
  handleStopCall
)

const {
  showVideoCallModal,
  isVideoCallMinimized,
  videoCallStatus,
  videoDurationStr,
  currentVideoCallTempSummary,
  isVideoCallPanelActive,
  videoCallMessages,
  startVideoCall,
  restoreVideoCall,
  minimizeVideoCall,
  handleVideoCallTriggerAPI,
  handleVideoCallEnd,
  handleResummarizeVideoCall,
  checkUnfinishedVideoCalls,
  checkAndGenerateVideoTempSummary
} = useChatRoomVideoCallUI(
  selectedChat,
  myProfile,
  isMultiSelectMode,
  saveCustomContacts,
  scrollToBottom,
  showToast,
  triggerAPI,
  handleStopCall
)

const handleVoiceCallRegenerate = () => {
  originalHandleRegenerate(showExtensionPanel, showToast, 'voice')
}

const handleVideoCallRegenerate = () => {
  originalHandleRegenerate(showExtensionPanel, showToast, 'video')
}

watch(voiceCallStatePayload, (state) => {
  emit('voice-call-state-change', state)
}, { immediate: true })

defineExpose({
  restoreVoiceCall,
  minimizeVoiceCall,
  endVoiceCall: handleVoiceCallEnd
})

const handleUpdateVideoTempSummary = (summary: string | null) => {
  currentVideoCallTempSummary.value = summary
}

const handleResummarizeCall = (recordId: string | number) => {
  if (!selectedChat.value?.callSummaries) return
  const record = selectedChat.value.callSummaries.find((r: any) => r.id === recordId)
  if (record?.callType === 'video') {
    handleResummarizeVideoCall(recordId)
  } else {
    handleResummarizeVoiceCall(recordId)
  }
}

const handleDeleteCallRecords = (recordIds: (string | number)[]) => {
  if (!selectedChat.value?.callSummaries || recordIds.length === 0) return
  const before = selectedChat.value.callSummaries.length
  selectedChat.value.callSummaries = selectedChat.value.callSummaries.filter(
    (r: any) => !recordIds.includes(r.id)
  )
  const removed = before - selectedChat.value.callSummaries.length
  if (removed > 0) {
    saveCustomContacts()
    showToast(`已删除 ${removed} 条通话记录`)
  }
}

const handleUpdateMemories = (newMemories: any[]) => {
  if (selectedChat.value) {
    selectedChat.value.memoryBook = newMemories
    saveCustomContacts()
    indexChatMemories(selectedChat.value).catch(error => console.warn('记忆书架已更新，向量同步稍后重试', error))
  }
}

const handleSummarizeMemories = async (selectedIds: number[]) => {
  if (!selectedChat.value || !selectedChat.value.memoryBook) return
  
  const memoriesToSummarize = selectedChat.value.memoryBook.filter((m: any) => selectedIds.includes(m.id))
  if (memoriesToSummarize.length < 2) return

  isSummarizingMemories.value = true
  try {
    const newContent = await summarizeMemories(memoriesToSummarize)
    if (newContent) {
      let totalMessageCount = 0
      memoriesToSummarize.forEach((m: any) => {
        totalMessageCount += (m.messageCount || 0)
      })

      const newMemory = {
        id: Date.now(),
        date: new Date().toLocaleDateString('zh-CN'),
        content: newContent,
        messageCount: totalMessageCount,
        isCondensed: true
      }

      const filteredMemories = selectedChat.value.memoryBook.filter((m: any) => !selectedIds.includes(m.id))
      filteredMemories.push(newMemory)
      
      filteredMemories.sort((a: any, b: any) => a.id - b.id)

      selectedChat.value.memoryBook = filteredMemories
      saveCustomContacts()
      showToast('精简记忆成功！')
    }
  } catch (err) {
    console.error(err)
  } finally {
    isSummarizingMemories.value = false
  }
}

import { useChatRoomTransfer } from '../../composables/useChatRoomTransfer'

const {
  activeTransferModalData,
  showRedPacketOpenModal,
  showTransferConfirmModal,
  redPacketStatus,
  handleLeftTransferClick,
  openLeftRedPacket,
  rejectLeftRedPacket,
  closeLeftRedPacket,
  confirmLeftTransfer,
  rejectLeftTransfer
} = useChatRoomTransfer(
  selectedChat,
  myProfile,
  isMultiSelectMode,
  saveCustomContacts,
  scrollToBottom
)

const loadRoomAssets = async () => {
  if (selectedChat.value?.id) {
    try {
      const customWp = await wallpaperStore.getItem<string>(`wallpaper_${selectedChat.value.id}`)
      if (customWp) {
        currentRoomWallpaper.value = customWp
      } else {
        const globalWp = await wallpaperStore.getItem<string>('wallpaper_global')
        currentRoomWallpaper.value = globalWp || null
      }
      
      const thumbStr = await mediaThumbStore.getItem<string>(`thumb_${selectedChat.value.id}`)
      currentMediaThumb.value = thumbStr || null
      
    } catch (e) {
      console.error('Failed to load room assets', e)
    }
  }
}

watch(isGenerating, (newVal) => {
  if (!newVal && showVoiceCallModal.value && !isVoiceCallMinimized.value && callStatus.value === 'connected') {
     checkAndGenerateTempSummary(voiceCallMessages.value)
  }
  if (!newVal && showVideoCallModal.value && videoCallStatus.value === 'connected') {
     checkAndGenerateVideoTempSummary(videoCallMessages.value)
  }
})

onMounted(() => {
  isRoomActive.value = true
  loadEmojis()
  updateTime()
  loadRoomAssets()
  checkTransfersExpired()
  checkUnfinishedCalls()
  checkUnfinishedVideoCalls()
  timeInterval = setInterval(() => {
    updateTime()
    checkTransfersExpired()
  }, 60000)
  scrollToBottom()

  mountTestError()
})

onUnmounted(() => {
  isRoomActive.value = false
  if (autoSummaryTimer) clearTimeout(autoSummaryTimer)
  if (timeInterval) clearInterval(timeInterval)
  stopVoice()
  if (callStatus.value === 'incoming') {
    handleIncomingCallMissed('timeout')
  }
})
</script>

<template>
  <div class="view-container full-height chat-view-bg" :style="currentRoomWallpaper ? { backgroundImage: `url(${currentRoomWallpaper})`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' } : {}">
    <div v-if="currentRoomWallpaper" class="chat-wallpaper-overlay"></div>
    
    <ChatRoomHeader
      :selectedChat="selectedChat"
      :totalUnreadCount="totalUnreadCount"
      :currentDateStr="currentDateStr"
      :currentDayStr="currentDayStr"
      @back="handleRoomBack"
      @open-settings="emit('open-settings')"
      @show-inner-thought-modal="showInnerThoughtModal = true"
      @show-memory-modal="showMemoryModal = true"
      @open-call-records="handleOpenCallRecords"
      @open-offline-meet="emit('open-offline-meet')"
      @click-overlay="showExtensionPanel = false; showEmojiPanel = false"
    />

    <ChatRoomMessageList
      ref="messageListRef"
      :displayMessages="displayMessages"
      :selectedChat="selectedChat"
      :myProfile="myProfile"
      :selectionMode="selectionMode"
      :isSelected="isSelected"
      :justMarkedIds="justMarkedIds"
      :expandedImageIds="expandedImageIds"
      :expandedVoiceIds="expandedVoiceIds"
      :currentMediaThumb="currentMediaThumb"
      :voicePlayingId="voicePlayingId"
      :isVoiceSynthesizing="isVoiceSynthesizing"
      @click-overlay="showExtensionPanel = false; showEmojiPanel = false"
      @click-message="handleMessageClick"
      @toggle-selection="toggleMessageSelection"
      @touch-start="handleTouchStart"
      @touch-end="handleTouchEnd"
      @touch-move="handleTouchMove"
      @toggle-image-text="toggleImageText"
      @toggle-voice-text="toggleVoiceText"
      @play-voice="handlePlayVoice"
      @handle-left-transfer-click="handleLeftTransferClick"
        @handle-emoji-click="handleEmojiClick"
        @view-recalled-message="viewRecalledMessage"
        @cancel-image-generation="handleCancelImageGeneration"
        @open-gallery="handleOpenGallery"
      />

    <transition name="fade">
      <ChatCallRecordsView
        v-if="showCallRecordsView && selectedChat?.callSummaries"
        :records="selectedChat.callSummaries"
        @close="showCallRecordsView = false"
        @resummarize="handleResummarizeCall"
        @delete="handleDeleteCallRecords"
      />
    </transition>

    <ChatErrorFolderModal
      :visible="showErrorModal"
      :error-message="errorMessage"
      :error-details="errorDetails"
      :active-error-tab="activeErrorTab"
      :copy-button-text="copyButtonText"
      @close="closeErrorModal"
      @update:active-error-tab="activeErrorTab = $event"
      @copy="copyErrorDetails"
    />

    <ChatMessageActionModal
      :visible="showActionModal"
      :message-id="targetMessageId"
      :message-obj="targetMessageId ? selectedChat?.messages?.find((m: any) => m.id === targetMessageId) : null"
      @close="showActionModal = false"
      @multi-select="onModalMultiSelect"
      @recall-multi-select="onModalRecallMultiSelect"
      @mark-message="onModalMarkMultiSelect"
      @copy="onModalCopy"
      @reply="onModalReply"
      @edit="onModalEdit"
      @resummarize="handleResummarize"
    />

    <ChatMessageEditModal
      :visible="showEditModal"
      :message-id="editTargetId"
      :initial-content="editInitialContent"
      :initial-type="editInitialType"
      :has-media="editHasMedia"
      @close="showEditModal = false"
      @save="handleEditSave"
    />

    <transition name="toast-fade">
      <div v-if="toastVisible" class="wechat-toast">
        {{ toastMessage }}
      </div>
    </transition>

    <transition name="folder-fade">
      <div v-if="showRedPacketOpenModal" class="folder-modal-overlay" @click="closeLeftRedPacket" @touchmove.prevent>
        <div class="red-packet-modal" :class="redPacketStatus" @click.stop>
          <div class="rp-close" @click="closeLeftRedPacket">
            <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </div>
          
          <div class="rp-avatar" :style="selectedChat?.avatarUrl ? { backgroundImage: `url(${selectedChat.avatarUrl})` } : {}">{{ selectedChat?.avatarUrl ? '' : (selectedChat?.avatarText || '伴') }}</div>
          <div class="rp-name">{{ selectedChat?.name || '对方' }}</div>
          <div class="rp-desc" v-if="redPacketStatus !== 'opened'">发了一个红包，金额随机</div>
          <div class="rp-remark">{{ activeTransferModalData?.remark || '恭喜发财，大吉大利' }}</div>
          
          <div v-if="redPacketStatus === 'opened'" class="rp-amount-display">
            <span class="currency">¥</span><span class="amount-val">{{ activeTransferModalData?.amount }}</span>
          </div>

          <div v-if="redPacketStatus !== 'opened'" class="rp-open-btn" :class="{ 'is-opening': redPacketStatus === 'opening' }" @click="openLeftRedPacket">
            <span v-if="redPacketStatus === 'closed'">開</span>
            <span v-else class="rp-loading-spinner"></span>
          </div>

          <div v-if="redPacketStatus === 'closed'" class="rp-reject-text" @click="rejectLeftRedPacket">退回红包</div>
          
          <div class="rp-bottom-bg"></div>
        </div>
      </div>
    </transition>

    <transition name="folder-fade">
      <div v-if="showTransferConfirmModal" class="folder-modal-overlay" @click="showTransferConfirmModal = false" @touchmove.prevent>
        <div class="transfer-confirm-modal" @click.stop>
          <div class="tc-header">
            <div class="tc-avatar" :style="selectedChat?.avatarUrl ? { backgroundImage: `url(${selectedChat.avatarUrl})` } : {}">{{ selectedChat?.avatarUrl ? '' : (selectedChat?.avatarText || '伴') }}</div>
            <div class="tc-title">来自 {{ selectedChat?.name || '对方' }} 的转账</div>
          </div>
          <div class="tc-amount">¥{{ activeTransferModalData?.amount }}</div>
          <div class="tc-remark" v-if="activeTransferModalData?.remark">{{ activeTransferModalData.remark }}</div>
          
          <div class="tc-actions">
            <button class="tc-btn reject" @click="rejectLeftTransfer">退还</button>
            <button class="tc-btn confirm" @click="confirmLeftTransfer">确认收款</button>
          </div>
        </div>
      </div>
    </transition>

    <transition name="folder-fade">
      <div v-if="showRecallContentModal" class="folder-modal-overlay" @click="showRecallContentModal = false" @touchmove.prevent>
        <div class="recall-modal-container" @click.stop>
          <div class="recall-close-btn" @click="showRecallContentModal = false">
            <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </div>
          <div style="font-size: 14px; font-weight: 600; margin-bottom: 12px; color: var(--text-secondary); font-family: 'Comic Sans MS', 'Chalkboard SE', sans-serif;">撤回的消息内容：</div>
          <div class="recall-content-box">
            {{ recallOriginalContent }}
          </div>
        </div>
      </div>
    </transition>

    <ChatVideoCallView
      :show="showVideoCallModal && !isVideoCallMinimized"
      :status="videoCallStatus"
      :duration-str="videoDurationStr"
      :char-name="selectedChat?.name || '未知联系人'"
      :char-avatar="selectedChat?.avatarUrl || ''"
      :is-generating="isGenerating"
      :display-messages="videoCallMessages"
      :current-summary="currentVideoCallTempSummary"
      @end-call="handleVideoCallEnd"
      @add-message="handleAddMessage"
      @trigger-api="handleVideoCallTriggerAPI"
      @stop-generate="handleStopCall"
      @regenerate="handleVideoCallRegenerate"
      @minimize="minimizeVideoCall"
      @update-temp-summary="handleUpdateVideoTempSummary"
      @edit-message="onModalEdit"
      @delete-message="handleCallMessageDelete"
    />

    <ChatVoiceCallWidget
      :visible="showVideoCallModal && isVideoCallMinimized"
      :call-status="videoCallStatus"
      :duration-str="videoDurationStr"
      :avatar-url="selectedChat?.avatarUrl"
      @restore="restoreVideoCall"
      @end-call="handleVideoCallEnd"
    />

    <ChatVoiceCallView
      :show="showVoiceCallModal && !isVoiceCallMinimized"
      :status="callStatus"
      :duration-str="durationStr"
      :char-name="selectedChat?.name || '未知联系人'"
      :char-avatar="selectedChat?.avatarUrl || ''"
      :is-generating="isGenerating"
      :display-messages="voiceCallMessages"
      :current-summary="currentCallTempSummary"
      @close="showVoiceCallModal = false"
      @end-call="handleVoiceCallEnd"
      @accept-call="handleIncomingCallAccept"
      @decline-call="handleIncomingCallMissed('declined')"
      @add-message="handleAddMessage"
      @trigger-api="handleVoiceCallTriggerAPI"
      @stop-generate="handleStopCall"
      @regenerate="handleVoiceCallRegenerate"
      @minimize="minimizeVoiceCall"
      @update-temp-summary="currentCallTempSummary = $event"
      @edit-message="onModalEdit"
      @delete-message="handleCallMessageDelete"
    />

    <ChatVoiceCallWidget
      :visible="showVoiceCallModal && isVoiceCallMinimized"
      :call-status="callStatus"
      :duration-str="durationStr"
      :avatar-url="selectedChat?.avatarUrl"
      @restore="restoreVoiceCall"
      @end-call="handleVoiceCallEnd"
    />

    <ChatRoomInputArea
      :selectionMode="selectionMode"
      :getSelectedCount="getSelectedCount"
      :displayMessages="displayMessages"
      :replyTargetMessage="replyTargetMessage"
      :showExtensionPanel="showExtensionPanel"
      :showEmojiPanel="showEmojiPanel"
      :panelEmojis="panelEmojis"
      :isGenerating="isGenerating"
      :selectedChat="selectedChat"
      :isMixedOfflineActive="isMixedOfflineSessionActive"
      @exit-multi-select-mode="exitMultiSelectMode"
      @select-all="selectAll"
      @recall-selected-messages="recallSelectedMessages"
      @mark-selected-messages="markSelectedMessages"
      @delete-selected-messages="deleteSelectedMessages"
      @cancel-reply="cancelReply"
      @toggle-extension-panel="toggleExtensionPanel"
      @toggle-emoji-panel="toggleEmojiPanel"
      @trigger-api="triggerAPI"
      @add-message="handleAddMessage"
      @open-settings="emit('open-settings')"
      @handle-send-emoji="handleSendEmoji"
      @handle-stop-call="handleStopCall"
      @handle-regenerate="handleRegenerate"
      @show-transfer-modal="showTransferModal = true"
      @show-voice-modal="showVoiceModal = true"
      @show-image-modal="showImageModal = true"
      @show-voice-call-modal="startVoiceCall"
      @show-video-call-modal="startVideoCall"
      @toggle-mixed-offline="toggleMixedOfflineSession"
      @update:showExtensionPanel="showExtensionPanel = $event"
      @update:showEmojiPanel="showEmojiPanel = $event"
    />
    
    <ChatTransferModal
      :visible="showTransferModal"
      :target-name="selectedChat?.name || '对方'"
      @close="showTransferModal = false"
      @send="handleSendTransfer"
    />
    
    <ChatVoiceModal
      :visible="showVoiceModal"
      @close="showVoiceModal = false"
      @send="handleSendVoice"
    />
    
    <ChatImageModal
      :visible="showImageModal"
      @close="showImageModal = false"
      @send="handleSendImage"
    />
    
    <ChatMemoryModal
      :visible="showMemoryModal"
      :memories="selectedChat?.memoryBook || []"
      :messages="selectedChat?.messages || []"
      :is-summarizing="isSummarizingMemories"
      @close="showMemoryModal = false"
      @update-memories="handleUpdateMemories"
      @summarize-memories="handleSummarizeMemories"
    />
    
    <ChatEmojiPreviewModal
      :visible="emojiPreviewVisible"
      :emoji-url="emojiPreviewUrl"
      :emoji-name="emojiPreviewName"
      @close="emojiPreviewVisible = false"
    />

    <ChatInnerThoughtModal
      :visible="showInnerThoughtModal"
      @close="showInnerThoughtModal = false"
    />

    <ChatImageGalleryModal
      v-if="galleryTargetMessage"
      v-model:visible="showImageGalleryModal"
      :message="galleryTargetMessage"
      @regenerate="handleGalleryRegenerate"
      @delete="handleGalleryDelete"
    />

    <ChatOfflineSessionEndModal
      :visible="showOfflineSessionEndModal"
      :message-count="activeOfflineSessionMessageCount"
      :is-processing="isEndingOfflineSession"
      :error-message="offlineSessionEndError"
      @close="showOfflineSessionEndModal = false"
      @confirm="finishOfflineSession"
    />

    <transition name="folder-fade">
      <div v-if="showMissingVoiceKeyModal" class="folder-modal-overlay" @click="closeMissingVoiceKeyModal" @touchmove.prevent>
        <div class="rp-modal" style="background: var(--bg-primary); border-radius: 16px; width: 280px; padding: 24px; text-align: center; box-shadow: 0 10px 30px rgba(0,0,0,0.1);" @click.stop>
          <div style="font-size: 16px; font-weight: 600; color: var(--text-primary); margin-bottom: 12px;">无法播放语音</div>
          <div style="font-size: 14px; color: var(--text-secondary); line-height: 1.5; margin-bottom: 24px;">
            因为您尚未配置语音接口密钥，所以暂时无法播放语音。<br><br>
            您可以在「应用首页 - 语音接入」中完成配置。
          </div>
          <div style="display: flex; justify-content: center;">
            <button class="glass-btn" style="width: 100%; border-radius: 20px; background: var(--theme-color, #FFB6C1); color: #fff; font-weight: 600;" @click="closeMissingVoiceKeyModal">知道了</button>
          </div>
        </div>
      </div>
    </transition>

  </div>
</template>

<style>
@import '../app_ChatPreview.css';
@import './ChatRoomView.css';
</style>
