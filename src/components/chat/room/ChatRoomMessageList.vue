/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { computed, ref, watch, nextTick } from 'vue'
import ChatMessageItem from './ChatMessageItem.vue'
import { replyVariantControlForMessage } from '../../../services/replyVariants'

const props = defineProps<{
  displayMessages: any[]
  selectedChat: any
  myProfile: any
  selectionMode: 'recall' | 'mark' | 'general' | null
  isSelected: (id: number) => boolean
  justMarkedIds: Set<number>
  expandedImageIds: Set<number>
  expandedVoiceIds: Set<number>
  currentMediaThumb: string | null
  voicePlayingId: number | null
  isVoiceSynthesizing: boolean
  resolveSender?: (message: any) => any
  isGenerating?: boolean
}>()

const emit = defineEmits()

const messageAreaRef = ref<HTMLElement | null>(null)
const renderMessages = computed(() => {
  const messages = [...props.displayMessages]
  const pendingSetId = String(props.selectedChat?.pendingReplyVariantSetId || '')
  if (!pendingSetId) return messages
  const set = (props.selectedChat?.replyVariantSets || []).find((item: any) => item.id === pendingSetId)
  const active = set?.variants?.find((item: any) => item.id === set.activeVariantId)
  if (!active) return messages
  // Keep the last accepted candidate visible until the replacement is complete.
  // Partially streamed/generated bubbles stay out of the main list so the swap is atomic.
  const visibleMessages = messages.filter((message: any) => !(
    message.type !== 'right' && String(message.turnId || '') === String(active.turnId || '')
  ))
  const existingIds = new Set(visibleMessages.map(message => String(message.id)))
  const preview = (active.messages || [])
    .filter((message: any) => !existingIds.has(String(message.id)) && !message.isVoiceCallProcessMsg && !message.isVideoCallProcessMsg && !message.isOfflineMeetMsg && message.isHidden !== true)
    .map((message: any) => ({ ...message, _replyVariantPreview: true }))
  return [...visibleMessages, ...preview]
})
const variantControls = computed(() => {
  const controls = new Map<string, ReturnType<typeof replyVariantControlForMessage>>()
  for (const message of renderMessages.value) {
    const control = replyVariantControlForMessage(props.selectedChat, message.id)
    if (control) controls.set(String(message.id), control)
  }
  return controls
})

const scrollToBottom = async () => {
  await nextTick()
  if (messageAreaRef.value) {
    messageAreaRef.value.scrollTop = messageAreaRef.value.scrollHeight
  }
}

watch(() => props.displayMessages.length, () => {
  scrollToBottom()
}, { immediate: true })

defineExpose({
  scrollToBottom
})
</script>

<template>
  <main class="message-area" ref="messageAreaRef" @click="emit('click-overlay')">
    <template v-for="(msg, index) in renderMessages" :key="msg.id">
      <ChatMessageItem
        :class="{ 'reply-variant-preview-message': msg._replyVariantPreview }"
        :msg="msg"
        :index="index"
        :displayMessages="renderMessages"
        :selectedChat="selectedChat"
        :myProfile="myProfile"
        :selectionMode="selectionMode"
        :isSelected="isSelected(msg.id)"
        :justMarked="justMarkedIds.has(msg.id)"
        :expandedImageIds="expandedImageIds"
        :expandedVoiceIds="expandedVoiceIds"
        :currentMediaThumb="currentMediaThumb"
        :voicePlayingId="voicePlayingId"
        :isVoiceSynthesizing="isVoiceSynthesizing"
        :resolveSender="resolveSender"
        @click-message="emit('click-message', $event)"
        @toggle-selection="emit('toggle-selection', $event)"
        @touch-start="emit('touch-start', $event)"
        @touch-end="emit('touch-end')"
        @touch-move="emit('touch-move', $event)"
        @toggle-image-text="(id: number) => {
          const m = renderMessages.find(msg => msg.id === id);
          if (m && (m.imageData?.imageId || (m.imageData?.history && m.imageData.history.length > 0))) {
            emit('open-gallery', m);
          } else {
            emit('toggle-image-text', id);
          }
        }"
        @toggle-voice-text="emit('toggle-voice-text', $event)"
        @play-voice="(id: number, text: string) => emit('play-voice', id, text)"
        @handle-left-transfer-click="emit('handle-left-transfer-click', $event)"
        @handle-emoji-click="(u: string | undefined, n: string | undefined) => emit('handle-emoji-click', u, n)"
        @open-character-profile="emit('open-character-profile', $event)"
        @view-recalled-message="emit('view-recalled-message', $event)"
        @cancel-image-generation="emit('cancel-image-generation', $event)"
      />
      <div v-if="variantControls.get(String(msg.id))" class="reply-variant-row" @click.stop>
        <button
          type="button"
          class="reply-variant-action"
          :disabled="variantControls.get(String(msg.id))!.activeIndex <= 0 || isGenerating"
          aria-label="上一个回复"
          @click="emit('switch-reply-variant', { setId: variantControls.get(String(msg.id))!.set.id, direction: -1 })"
        >‹</button>
        <button type="button" class="reply-variant-count" disabled>
          {{ variantControls.get(String(msg.id))!.activeIndex + 1 }} / {{ variantControls.get(String(msg.id))!.count }}
        </button>
        <button
          type="button"
          class="reply-variant-action"
          :disabled="variantControls.get(String(msg.id))!.activeIndex >= variantControls.get(String(msg.id))!.count - 1 || isGenerating"
          aria-label="下一个回复"
          @click="emit('switch-reply-variant', { setId: variantControls.get(String(msg.id))!.set.id, direction: 1 })"
        >›</button>
        <button
          v-if="variantControls.get(String(msg.id))!.isTail"
          type="button"
          class="reply-variant-action regenerate"
          :disabled="isGenerating"
          aria-label="重新生成"
          @click="emit('regenerate-reply', variantControls.get(String(msg.id))!.set.id)"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 9a8.5 8.5 0 1 1 .8 7.5M3.5 9V4.5M3.5 9H8"/></svg>
        </button>
      </div>
    </template>

    <div v-if="selectedChat?.isTyping" class="message-row left typing-indicator-row">
      <div class="msg-avatar" :style="selectedChat?.avatarUrl ? { backgroundImage: `url(${selectedChat.avatarUrl})`, backgroundSize: 'cover', backgroundPosition: 'center', color: 'transparent' } : {}">{{ selectedChat?.avatarText || '伴' }}</div>
      <div class="msg-content-col">
        <div class="bubble bubble-left typing-bubble">
          <span class="dot"></span><span class="dot"></span><span class="dot"></span>
        </div>
      </div>
    </div>
  </main>
</template>

<style>
@import '../ChatRoomView.css';
</style>
