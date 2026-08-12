/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import ChatMessageItem from './ChatMessageItem.vue'

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
}>()

const emit = defineEmits()

const messageAreaRef = ref<HTMLElement | null>(null)

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
    <template v-for="(msg, index) in displayMessages" :key="msg.id">
      <ChatMessageItem
        :msg="msg"
        :index="index"
        :displayMessages="displayMessages"
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
        @click-message="emit('click-message', $event)"
        @toggle-selection="emit('toggle-selection', $event)"
        @touch-start="emit('touch-start', $event)"
        @touch-end="emit('touch-end')"
        @touch-move="emit('touch-move', $event)"
        @toggle-image-text="(id: number) => {
          const m = displayMessages.find(msg => msg.id === id);
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
        @open-character-profile="emit('open-character-profile')"
        @view-recalled-message="emit('view-recalled-message', $event)"
        @cancel-image-generation="emit('cancel-image-generation', $event)"
      />
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
