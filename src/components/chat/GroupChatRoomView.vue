/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import localforage from 'localforage'
import { useChatAuth } from '../../composables/useChatAuth'
import { useChatState } from '../../composables/useChatState'
import { useChatEmoji } from '../../composables/useChatEmoji'
import { useChatMessageSelection } from '../../composables/useChatMessageSelection'
import { useChatRoomMultiSelect } from '../../composables/useChatRoomMultiSelect'
import { useChatRoomMessage } from '../../composables/useChatRoomMessage'
import { useVoicePlayer } from '../../composables/useVoicePlayer'
import { worldBooks } from '../../store'
import { activeGroupReplyIds, applyGroupMemoryDelta, groupReplyControllers, requestGroupReply, saveGroupChat } from '../../services/groupChat'
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

const props = defineProps<{ group: any; isVisible?: boolean }>()
const emit = defineEmits<{ (e: 'back'): void; (e: 'open-settings'): void; (e: 'open-character-profile', memberId: string): void }>()
const { mockChats, effectiveMyProfile } = useChatState()
const { currentChatUserId } = useChatAuth()
const selectedGroup = computed(() => props.group)
const messageListRef = ref<any>(null)
const toastText = ref('')
const wallpaper = ref<string | null>(null)
const showExtensionPanel = ref(false)
const showEmojiPanel = ref(false)
const showUserThoughtModal = ref(false)
const showInnerThoughtModal = ref(false)
const showMemoryModal = ref(false)
const showEditModal = ref(false)
const editTargetId = ref<number>()
const editInitialContent = ref('')
const editInitialType = ref('left')
const editHasMedia = ref(false)
const expandedVoiceIds = ref<Set<number>>(new Set())
const currentMediaThumb = ref<string | null>(null)
const { playVoice, isSynthesizing: isVoiceSynthesizing, currentPlayingId: voicePlayingId } = useVoicePlayer()
const isGenerating = computed(() => activeGroupReplyIds.has(String(props.group.id)))
let toastTimer: ReturnType<typeof setTimeout> | null = null
const wallpaperStore = localforage.createInstance({ name: 'nrt-app', storeName: 'chatWallpapers' })

const members = computed<any[]>(() => props.group.memberIds.map((id: string) => mockChats.value.find(chat => chat.chatType !== 'group' && String(chat.characterEntityId || chat.id) === id)).filter(Boolean))
const memberMap = computed(() => new Map(members.value.map(member => [String(member.characterEntityId || member.id), member])))
const memberName = (id: string) => props.group.memberNicknames?.[id] || memberMap.value.get(id)?.name || '已移除成员'
const resolveSender = (message: any) => {
  const member: any = memberMap.value.get(String(message.senderId || '')) || {}
  return { ...member, name: message.senderNameSnapshot || memberName(String(message.senderId || '')), avatarUrl: message.senderAvatarSnapshot || member.avatarUrl || '', avatarText: member.avatarText || memberName(String(message.senderId || '')).charAt(0) || '伴' }
}
const displayMessages = computed(() => props.group.messages || [])
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
const media = useChatRoomMessage(selectedGroup, effectiveMyProfile, isMultiSelectMode, persist, scrollBottom, updatePreviewAndTime, showToast)

const persistDirectMemories = (contacts: any[]) => {
  if (!contacts.length) return
  const key = currentChatUserId.value ? `clingy_custom_contacts_${currentChatUserId.value}` : 'clingy_custom_contacts'
  try { const stored = JSON.parse(localStorage.getItem(key) || '[]'); contacts.forEach(contact => { const i = stored.findIndex((item: any) => String(item.characterEntityId || item.id) === String(contact.characterEntityId || contact.id)); if (i >= 0) stored[i].memoryBook = contact.memoryBook || [] }); localStorage.setItem(key, JSON.stringify(stored)) } catch {}
}

const runReply = async () => {
  const targetGroup = props.group
  const targetId = String(targetGroup.id)
  if (activeGroupReplyIds.has(targetId)) return
  const targetMemberName = (id: string) => targetGroup.memberNicknames?.[id] || mockChats.value.find(chat => chat.chatType !== 'group' && String(chat.characterEntityId || chat.id) === id)?.name || '已移除成员'
  const targetMemberAvatar = (id: string) => mockChats.value.find(chat => chat.chatType !== 'group' && String(chat.characterEntityId || chat.id) === id)?.avatarUrl || ''
  const requestController = new AbortController()
  activeGroupReplyIds.add(targetId); groupReplyControllers.set(targetId, requestController); targetGroup.isTyping = true; persist(targetGroup)
  try {
    const worldText = worldBooks.filter((book: any) => book.enabled && targetGroup.boundWorldBooks?.includes(book.id)).flatMap((book: any) => (book.entries || []).filter((entry: any) => entry.enabled).map((entry: any) => `${entry.title}: ${entry.content}`)).join('\n')
    const result = await requestGroupReply(targetGroup, mockChats.value, effectiveMyProfile.value, requestController.signal, worldText)
    const turnId = `group_turn_${Date.now()}`
    const localIds = new Map<string, number>(); result.messages.forEach((message: any, index: number) => { if (message.key) localIds.set(message.key, Date.now() + index) })
    result.messages.forEach((message: any, index: number) => {
      const id = localIds.get(message.key) || Date.now() + index
      const replyToMessageId = localIds.get(message.replyToMessageId) || message.replyToMessageId || ''
      const quoted = targetGroup.messages.find((entry: any) => String(entry.id) === String(replyToMessageId))
      const quote = quoted ? { id: quoted.id, content: quoted.content, sender: quoted.type === 'right' ? (effectiveMyProfile.value.name || '我') : targetMemberName(quoted.senderId) } : undefined
      const item: any = { id, timestamp: id, type: message.messageType === 'narration' ? 'narration' : 'left', senderType: 'character', senderId: message.senderId, senderNameSnapshot: targetMemberName(message.senderId), senderAvatarSnapshot: targetMemberAvatar(message.senderId), content: message.content, translation: message.translation, contentLanguage: message.contentLanguage, translationLanguage: message.translationLanguage, replyToMessageId, quote, mentions: message.mentions.map((memberId: string) => ({ type: memberId === 'user' ? 'user' : 'character', id: memberId })), turnId, sequence: index }
      if (message.messageType === 'voice') item.voiceData = { text: message.content, seconds: Math.max(1, Math.ceil(message.content.length / 4)) }
      if (message.messageType === 'image') item.imageData = { text: message.content, summary: message.content }
      if (message.messageType === 'emoji') { item.isEmoji = true; item.emojiSummary = message.content }
      if (message.messageType === 'transfer' || message.messageType === 'red_packet') item.transferData = { type: message.messageType, amount: message.amount || 0, remark: message.remark || message.content, status: 'pending', sender: 'character', expireHours: 24, createdAt: id }
      if (message.messageType === 'call') item.callData = { callType: 'voice', status: 'ended' }
      if (index === 0 && result.thinking) item.thinking = result.thinking
      targetGroup.messages.push(item)
    })
    if (!props.isVisible && targetGroup.notificationMode !== 'mute') {
      const visibleCount = targetGroup.notificationMode === 'all' ? result.messages.length : result.messages.filter((message: any) => message.mentions.includes('user')).length
      targetGroup.unread = Number(targetGroup.unread || 0) + visibleCount
    }
    result.thoughts.forEach((thought: any, index: number) => {
      const item = { id: `${turnId}_thought_${index}`, timestamp: Date.now() + index, content: thought.content, senderId: thought.senderId, senderName: targetMemberName(thought.senderId), senderAvatar: targetMemberAvatar(thought.senderId), turnId }
      targetGroup.innerThoughts ||= []; targetGroup.innerThoughts.push(item); targetGroup.memberInnerThoughts ||= {}; targetGroup.memberInnerThoughts[thought.senderId] ||= []; targetGroup.memberInnerThoughts[thought.senderId].push(item)
    })
    if (!result.messages.length && !result.idle) throw new Error('模型没有返回可识别的群消息，请检查群聊输出协议。')
    if (result.idle) showToast('群里暂时没有人接话')
    persistDirectMemories(applyGroupMemoryDelta(targetGroup, result.memoryDelta, mockChats.value)); targetGroup.pendingUserThought = ''
  } catch (error: any) { if (error?.name !== 'AbortError') showToast(error?.message || '群聊回复失败') }
  finally { targetGroup.isTyping = false; activeGroupReplyIds.delete(targetId); groupReplyControllers.delete(targetId); persist(targetGroup); await scrollBottom() }
}

const mentionsFromText = (text: string) => members.value.filter(member => text.includes(`@${props.group.memberNicknames?.[String(member.characterEntityId || member.id)] || member.name}`)).map(member => ({ type: 'character', id: String(member.characterEntityId || member.id) }))
const handleAddMessage = async (raw: string) => { const content = raw.trim(); if (!content) return; const now = Date.now(); const quote = media.replyTargetMessage.value ? { ...media.replyTargetMessage.value } : undefined; props.group.messages.push({ id: now, timestamp: now, type: 'right', senderType: 'user', senderId: String(currentChatUserId.value || 'user'), content, quote, mentions: mentionsFromText(content), replyToMessageId: quote?.id || '', turnId: `user_group_turn_${now}` }); media.replyTargetId.value = undefined; persist(); await scrollBottom() }
const regenerate = async () => { if (isGenerating.value) return; if (![...props.group.messages].some((message: any) => message.type === 'right')) return showToast('还没有可重新生成的用户消息'); while (props.group.messages.length && props.group.messages.at(-1).type !== 'right') props.group.messages.pop(); persist(); await runReply() }
const stopReply = () => groupReplyControllers.get(String(props.group.id))?.abort()
const handleSendEmoji = async (item: any) => { props.group.messages.push({ id: Date.now(), timestamp: Date.now(), type: 'right', content: item.name || '[表情]', messageType: 'emoji', isEmoji: true, emojiUrl: item.previewUrl, emojiId: item.id }); showEmojiPanel.value = false; persist(); await scrollBottom() }
const handleSendImage = (data: any) => media.handleSendImage(data, showExtensionPanel)
const handleSendVoice = (data: any) => media.handleSendVoice(data, showExtensionPanel)
const handleSendTransfer = (data: any) => media.handleSendTransfer(data, showExtensionPanel)
const onModalEdit = (id?: number) => { const message = props.group.messages.find((item: any) => item.id === (id || multi.targetMessageId.value)); if (!message) return; editTargetId.value = message.id; editInitialContent.value = message.content || ''; editInitialType.value = message.type; editHasMedia.value = Boolean(message.imageData || message.voiceData || message.transferData || message.isEmoji); showEditModal.value = true }
const handleEditSave = (payload: any) => { const message = props.group.messages.find((item: any) => item.id === payload.messageId); if (!message) return; message.content = payload.content; message.type = payload.type; if (payload.clearMedia) { delete message.imageData; delete message.voiceData; delete message.transferData; delete message.emojiUrl; message.isEmoji = false }; showEditModal.value = false; persist() }
const handleSaveUserThought = (text: string) => { props.group.pendingUserThought = text; showUserThoughtModal.value = false; persist(); showToast(text ? '本轮心声已保存' : '已清除本轮心声') }
const toggleMixedOffline = () => { props.group.isMixedOfflineActive = !props.group.isMixedOfflineActive; props.group.messages.push({ id: Date.now(), timestamp: Date.now(), type: 'system', content: props.group.isMixedOfflineActive ? '你们开始了线下见面' : '线下见面结束，回到线上群聊' }); persist() }
const addCallEvent = (kind: 'voice' | 'video') => { props.group.messages.push({ id: Date.now(), timestamp: Date.now(), type: 'right', content: `发起了群${kind === 'voice' ? '语音' : '视频'}通话`, messageType: 'call', callData: { callType: kind, status: 'started' } }); showExtensionPanel.value = false; persist(); void runReply() }
const toggleVoiceText = (id: number) => { expandedVoiceIds.value.has(id) ? expandedVoiceIds.value.delete(id) : expandedVoiceIds.value.add(id) }
const handlePlayVoice = async (id: number, text: string) => {
  const message = props.group.messages.find((item: any) => item.id === id)
  const member: any = memberMap.value.get(String(message?.senderId || ''))
  if (!member?.enableVoiceReply) return
  try { await playVoice(id, text, member) } catch (error: any) { showToast(error?.message?.startsWith('MISSING_') ? '请先在角色语音设置中配置密钥' : (error?.message || '语音播放失败')) }
}

watch(() => props.group.id, async id => { wallpaper.value = await wallpaperStore.getItem<string>(`wallpaper_${id}`); exitMultiSelectMode(); await scrollBottom() }, { immediate: true })
onMounted(async () => { await loadEmojis(); await scrollBottom() })
</script>

<template>
  <div class="view-container full-height chat-view-bg group-room" :style="groupWallpaperStyle">
    <div v-if="wallpaper" class="chat-wallpaper-overlay"></div>
    <header class="chat-advanced-header glass-header">
      <div class="chat-header-main">
        <div class="chat-header-top-row">
          <div class="chat-header-profile">
            <div v-if="totalUnreadCount > 0" class="back-btn-wrapper" @click.stop="emit('back')">
              <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round" class="back-arrow"><polyline points="15 18 9 12 15 6"></polyline></svg>
              <div class="back-unread-badge">{{ totalUnreadCount > 99 ? '99+' : totalUnreadCount }}</div>
            </div>
            <div class="chat-header-avatar" @click.stop="emit('back')" style="background: var(--sys-bg-tertiary); display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 650; color: var(--text-primary);">{{ group.avatarText || '群' }}</div>
            <div style="display: flex; flex-direction: column; justify-content: center;" class="clickable-header-name">
              <div class="chat-header-name">{{ group.name }}</div>
              <div style="font-size: 11px; color: var(--text-tertiary); display: flex; align-items: center; gap: 4px; margin-top: 2px; font-weight: normal;">{{ members.length + 1 }} 人</div>
            </div>
          </div>
          <div style="display: flex; gap: 8px; margin-right: 4px;">
            <div class="icon-btn" @click.stop="showInnerThoughtModal = true">
              <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" style="color: #999999;">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                <polyline points="22,6 12,13 2,6"></polyline>
              </svg>
            </div>
            <div class="icon-btn" @click.stop="showMemoryModal = true">
              <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" style="color: #999999;">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
              </svg>
            </div>
            <div class="icon-btn" @click.stop="emit('open-settings')">
              <svg viewBox="0 0 24 24" width="20" height="20" stroke="none" fill="#999999">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
              </svg>
            </div>
          </div>
        </div>
      </div>
    </header>

    <div v-if="!displayMessages.length" class="group-room-empty"><b>{{ group.name }}</b><span>群聊已创建，成员会依据自己的性格自然参与对话。</span></div>
    <ChatRoomMessageList v-else ref="messageListRef" :displayMessages="displayMessages" :selectedChat="group" :myProfile="effectiveMyProfile" :selectionMode="selectionMode" :isSelected="isSelected" :justMarkedIds="multi.justMarkedIds.value" :expandedImageIds="media.expandedImageIds.value" :expandedVoiceIds="expandedVoiceIds" :currentMediaThumb="currentMediaThumb" :voicePlayingId="voicePlayingId" :isVoiceSynthesizing="isVoiceSynthesizing" :resolveSender="resolveSender" @click-overlay="showExtensionPanel = false; showEmojiPanel = false" @click-message="multi.handleMessageClick" @toggle-selection="toggleMessageSelection" @touch-start="multi.handleTouchStart" @touch-end="multi.handleTouchEnd" @touch-move="multi.handleTouchMove" @toggle-image-text="media.toggleImageText" @toggle-voice-text="toggleVoiceText" @play-voice="handlePlayVoice" @open-character-profile="emit('open-character-profile', $event)" />

    <ChatMessageActionModal :visible="multi.showActionModal.value" :message-id="multi.targetMessageId.value" :message-obj="multi.targetMessageId.value ? group.messages.find((message: any) => message.id === multi.targetMessageId.value) : null" @close="multi.showActionModal.value = false" @multi-select="multi.onModalMultiSelect" @recall-multi-select="multi.onModalRecallMultiSelect" @mark-message="multi.onModalMarkMultiSelect" @copy="multi.onModalCopy" @reply="media.replyTargetId.value = $event || multi.targetMessageId.value" @edit="onModalEdit" />
    <ChatMessageEditModal :visible="showEditModal" :message-id="editTargetId" :initial-content="editInitialContent" :initial-type="editInitialType" :has-media="editHasMedia" @close="showEditModal = false" @save="handleEditSave" />

    <ChatRoomInputArea :selectionMode="selectionMode" :getSelectedCount="getSelectedCount" :displayMessages="displayMessages" :replyTargetMessage="media.replyTargetMessage.value" :showExtensionPanel="showExtensionPanel" :showEmojiPanel="showEmojiPanel" :panelEmojis="panelEmojis" :isGenerating="isGenerating" :selectedChat="group" :isMixedOfflineActive="Boolean(group.isMixedOfflineActive)" @exit-multi-select-mode="exitMultiSelectMode" @select-all="selectAll" @recall-selected-messages="multi.recallSelectedMessages" @mark-selected-messages="multi.markSelectedMessages" @delete-selected-messages="multi.deleteSelectedMessages" @cancel-reply="media.cancelReply" @toggle-extension-panel="showExtensionPanel = !showExtensionPanel; showEmojiPanel = false" @toggle-emoji-panel="showEmojiPanel = !showEmojiPanel; showExtensionPanel = false" @trigger-api="runReply" @add-message="handleAddMessage" @open-settings="emit('open-settings')" @handle-send-emoji="handleSendEmoji" @handle-stop-call="stopReply" @handle-regenerate="regenerate" @show-transfer-modal="media.showTransferModal.value = true" @show-voice-modal="media.showVoiceModal.value = true" @show-image-modal="media.showImageModal.value = true" @show-voice-call-modal="addCallEvent('voice')" @show-video-call-modal="addCallEvent('video')" @show-user-thought-modal="showUserThoughtModal = true" @toggle-mixed-offline="toggleMixedOffline" @focus-input="scrollBottom" @update:showExtensionPanel="showExtensionPanel = $event" @update:showEmojiPanel="showEmojiPanel = $event" />
    <ChatTransferModal :visible="media.showTransferModal.value" :target-name="group.name" @close="media.showTransferModal.value = false" @send="handleSendTransfer" />
    <ChatVoiceModal :visible="media.showVoiceModal.value" @close="media.showVoiceModal.value = false" @send="handleSendVoice" />
    <ChatImageModal :visible="media.showImageModal.value" @close="media.showImageModal.value = false" @send="handleSendImage" />
    <ChatUserThoughtModal :visible="showUserThoughtModal" :initial-text="group.pendingUserThought || ''" @close="showUserThoughtModal = false" @save="handleSaveUserThought" />
    <ChatInnerThoughtModal :visible="showInnerThoughtModal" :chat="group" @close="showInnerThoughtModal = false" @save="persist" />
    <ChatMemoryModal :visible="showMemoryModal" :chat="group" :contacts="mockChats" @close="showMemoryModal = false" @save="persist" />
    <transition name="toast-fade"><div v-if="toastText" class="wechat-toast">{{ toastText }}</div></transition>
  </div>
</template>

<style scoped>
@import './ChatRoomView.css';
.group-room{display:flex;flex-direction:column;min-height:0}.group-room-empty{flex:1;margin:auto;padding:36px 20px;text-align:center;display:flex;flex-direction:column;justify-content:center;gap:8px;color:var(--text-tertiary);font-size:12px}.group-room-empty b{color:var(--text-primary);font-size:15px}
</style>
