/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  msg: any
  direction: 'left' | 'right'
  autoTranscribeVoice: boolean
  expandedVoiceIds: Set<number>
  playingId?: number | null
  isSynthesizing?: boolean
}>()

const emit = defineEmits<{
  (e: 'toggle-voice-text', msgId: number): void
  (e: 'play-voice', msgId: number, text: string): void
  (e: 'touch-start', msgId: number): void
  (e: 'touch-end'): void
  (e: 'touch-move'): void
}>()

const isPlaying = computed(() => props.playingId === props.msg.id && !props.isSynthesizing)
const isSelfSynthesizing = computed(() => props.playingId === props.msg.id && props.isSynthesizing)

const handleBubbleClick = () => {
  // 当点击时：
  // 1. 如果文本尚未展开，且没有开启自动转文字，则展开它
  if (!props.autoTranscribeVoice && !props.expandedVoiceIds.has(props.msg.id)) {
    emit('toggle-voice-text', props.msg.id)
  } else if (!props.autoTranscribeVoice && props.expandedVoiceIds.has(props.msg.id)) {
    emit('toggle-voice-text', props.msg.id) // 再次点击收起
  }
  
  // 2. 只有在启用了语音配置(这由外层控制)的情况下，或者我们通过某种方式判定可以播放时才触发
  // 由于我们无法在这里直接判断 apiSettings，我们交由外层去拦截，或者在这里单纯触发
  emit('play-voice', props.msg.id, props.msg.voiceData.text)
}
</script>

<template>
  <div v-if="direction === 'left'" class="bubble bubble-left voice-bubble-left" :style="{ width: Math.min(220, 60 + msg.voiceData.seconds * 3) + 'px' }" @touchstart="emit('touch-start', msg.id)" @touchend="emit('touch-end')" @touchmove="emit('touch-move')" @contextmenu.prevent @click="handleBubbleClick">
    <div class="voice-waves" :class="{ 'is-playing': isPlaying }">
      <div v-if="isSelfSynthesizing" class="voice-spinner"></div>
      <svg v-else viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round">
        <path d="M6 12h.01"></path>
        <path d="M11 8a5 5 0 0 1 0 8" :class="{ 'wave-1': isPlaying }"></path>
        <path d="M16 4a10 10 0 0 1 0 16" :class="{ 'wave-2': isPlaying }"></path>
      </svg>
    </div>
    <span class="voice-seconds">{{ msg.voiceData.seconds }}"</span>
  </div>
  
  <div v-else class="bubble bubble-right voice-bubble-right" :style="{ width: Math.min(220, 60 + msg.voiceData.seconds * 3) + 'px' }" @touchstart="emit('touch-start', msg.id)" @touchend="emit('touch-end')" @touchmove="emit('touch-move')" @contextmenu.prevent @click="handleBubbleClick">
    <span class="voice-seconds">{{ msg.voiceData.seconds }}"</span>
    <div class="voice-waves" :class="{ 'is-playing': isPlaying }">
      <div v-if="isSelfSynthesizing" class="voice-spinner"></div>
      <svg v-else viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round" style="transform: scaleX(-1);">
        <path d="M6 12h.01"></path>
        <path d="M11 8a5 5 0 0 1 0 8" :class="{ 'wave-1': isPlaying }"></path>
        <path d="M16 4a10 10 0 0 1 0 16" :class="{ 'wave-2': isPlaying }"></path>
      </svg>
    </div>
  </div>

  <!-- 转文字内容 -->
  <transition name="fade-down">
    <div v-if="autoTranscribeVoice || expandedVoiceIds.has(msg.id)" class="voice-text-translation" :class="{ 'left': direction === 'left' }">
      {{ msg.voiceData.text }}
    </div>
  </transition>
</template>

<style scoped>
@import '../../app_ChatPreview.css';

.voice-spinner {
  width: 14px;
  height: 14px;
  border: 2px solid currentColor;
  border-top-color: transparent;
  border-radius: 50%;
  animation: voice-spin 0.8s linear infinite;
  opacity: 0.6;
}

@keyframes voice-spin {
  to { transform: rotate(360deg); }
}

.wave-1 {
  opacity: 0.3;
}
.wave-2 {
  opacity: 0.3;
}

.is-playing .wave-1 {
  animation: fade-wave 1s infinite alternate;
  animation-delay: 0.2s;
}

.is-playing .wave-2 {
  animation: fade-wave 1s infinite alternate;
  animation-delay: 0.4s;
}

@keyframes fade-wave {
  0% { opacity: 0.2; }
  100% { opacity: 1; }
}
</style>
