/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  msg: any
  direction: 'left' | 'right'
}>()

const isVideo = computed(() => props.msg.callData?.callType === 'video')
const isCanceled = computed(() => props.msg.callData?.status === 'canceled')
const emit = defineEmits<{
  (e: 'touch-start', msgId: number): void
  (e: 'touch-end'): void
  (e: 'touch-move', event: TouchEvent): void
}>()

const durationText = computed(() => {
  if (isCanceled.value) return props.msg.callData?.duration || '通话已被取消'
  const duration = props.msg.callData?.duration || props.msg.duration || ''
  if (duration === '异常中断' || duration.includes('异常') || duration.includes('未接通') || duration.includes('已拒绝') || duration.includes('拒接') || duration.includes('未接')) {
    return duration
  }
  return `通话时长 ${duration}`
})
</script>

<template>
  <div class="bubble call-record-bubble" :class="[direction === 'left' ? 'bubble-left' : 'bubble-right']" @touchstart="emit('touch-start', msg.id)" @touchend="emit('touch-end')" @touchmove="emit('touch-move', $event)" @contextmenu.prevent>
    <div class="call-record-content" :class="{ 'is-right': direction === 'right' }">
      <span class="call-text">{{ durationText }}</span>
      <div class="call-icon">
        <svg v-if="isVideo" viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
        </svg>
        <svg v-else viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" style="transform: rotate(135deg);">
          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
        </svg>
      </div>
    </div>
  </div>
</template>

<style scoped>
@import '../../app_ChatPreview.css';

.call-record-bubble {
  display: flex;
  align-items: center;
  padding: 8px 14px;
}

.call-record-content {
  display: flex;
  align-items: center;
  gap: 8px;
}
.call-record-content.is-right {
  flex-direction: row;
}

.call-record-content:not(.is-right) {
  flex-direction: row-reverse;
}

.call-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  color: inherit;
  margin-top: 2px;
}

.call-text {
  font-size: 15px;
  letter-spacing: 0.5px;
}
</style>
