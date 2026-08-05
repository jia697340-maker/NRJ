/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'

const props = defineProps<{
  visible: boolean
  callStatus: 'idle' | 'calling' | 'incoming' | 'connected' | 'ended'
  durationStr: string
  avatarUrl?: string
}>()

const emit = defineEmits<{
  (e: 'restore'): void
  (e: 'end-call'): void
}>()

const widgetX = ref(window.innerWidth - 180)
const widgetY = ref(64)
const isDraggingWidget = ref(false)
const widgetHasMoved = ref(false)
let widgetStartX = 0
let widgetStartY = 0
let widgetInitialX = 0
let widgetInitialY = 0

const initWidgetPosition = () => {
  const widgetWidth = 140
  widgetX.value = Math.max(16, window.innerWidth - widgetWidth - 16)
  widgetY.value = 64
}

const widgetStyle = computed(() => {
  return {
    transform: `translate3d(${widgetX.value}px, ${widgetY.value}px, 0)`,
    transition: isDraggingWidget.value ? 'none' : 'transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
    willChange: 'transform'
  }
})

const onWidgetTouchStart = (e: TouchEvent | MouseEvent) => {
  isDraggingWidget.value = true
  widgetHasMoved.value = false
  const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX
  const clientY = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY
  widgetStartX = clientX
  widgetStartY = clientY
  widgetInitialX = widgetX.value
  widgetInitialY = widgetY.value
}

const onWidgetTouchMove = (e: TouchEvent | MouseEvent) => {
  if (!isDraggingWidget.value) return
  const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX
  const clientY = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY
  const deltaX = clientX - widgetStartX
  const deltaY = clientY - widgetStartY
  
  if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
    widgetHasMoved.value = true
  }
  
  if (widgetHasMoved.value) {
    if (e.cancelable) e.preventDefault()
    
    let newX = widgetInitialX + deltaX
    let newY = widgetInitialY + deltaY
    
    const target = e.currentTarget as HTMLElement
    const widgetWidth = target.offsetWidth || 140
    const widgetHeight = target.offsetHeight || 50
    
    const maxX = window.innerWidth - widgetWidth
    const maxY = window.innerHeight - widgetHeight
    
    newX = Math.max(0, Math.min(newX, maxX))
    newY = Math.max(0, Math.min(newY, maxY))
    
    widgetX.value = newX
    widgetY.value = newY
  }
}

const onWidgetTouchEnd = (e: TouchEvent | MouseEvent) => {
  if (!isDraggingWidget.value) return
  isDraggingWidget.value = false
  
  nextTick(() => {
    const target = e.currentTarget as HTMLElement
    const widgetWidth = target?.offsetWidth || 140
    const centerX = widgetX.value + widgetWidth / 2
    if (centerX < window.innerWidth / 2) {
      widgetX.value = 16
    } else {
      widgetX.value = window.innerWidth - widgetWidth - 16
    }
  })
}

const handleWidgetClick = () => {
  if (widgetHasMoved.value) return
  emit('restore')
}

const handleEndCall = () => {
  emit('end-call')
}

onMounted(() => {
  initWidgetPosition()
  window.addEventListener('resize', initWidgetPosition)
})

onUnmounted(() => {
  window.removeEventListener('resize', initWidgetPosition)
})
</script>

<template>
  <transition name="fade">
    <div 
      v-if="visible" 
      class="floating-call-widget" 
      :style="widgetStyle"
      @click="handleWidgetClick"
      @touchstart="onWidgetTouchStart"
      @touchmove="onWidgetTouchMove"
      @touchend="onWidgetTouchEnd"
      @mousedown="onWidgetTouchStart"
      @mousemove="onWidgetTouchMove"
      @mouseup="onWidgetTouchEnd"
      @mouseleave="onWidgetTouchEnd"
    >
      <div class="fc-avatar" :style="{ backgroundImage: `url(${avatarUrl || ''})` }">
        <div class="fc-ripple"></div>
      </div>
      <div class="fc-info">
        <div class="fc-status" :class="{ calling: callStatus === 'calling' || callStatus === 'incoming' }">
          {{ callStatus === 'calling' ? '等待接听...' : (callStatus === 'incoming' ? '来电中...' : durationStr) }}
        </div>
      </div>
      <div class="fc-end-btn" @click.stop="handleEndCall">
        <svg viewBox="0 0 24 24" width="16" height="16" stroke="white" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" style="transform: rotate(135deg);">
          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
        </svg>
      </div>
    </div>
  </transition>
</template>

<style scoped>
.floating-call-widget {
  position: absolute;
  top: 0;
  left: 0;
  z-index: 999;
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-radius: 30px;
  padding: 6px 6px 6px 8px;
  display: flex;
  align-items: center;
  gap: 10px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,1);
  cursor: pointer;
  touch-action: none;
}
.fc-avatar {
  position: relative;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background-size: cover;
  background-position: center;
  box-shadow: 0 2px 8px rgba(0,0,0,0.15);
}
.fc-ripple {
  position: absolute;
  top: -4px; left: -4px; right: -4px; bottom: -4px;
  border-radius: 50%;
  border: 1.5px solid rgba(107, 144, 128, 0.5);
  animation: miniRipple 2s infinite;
}
@keyframes miniRipple {
  0% { transform: scale(0.8); opacity: 1; }
  100% { transform: scale(1.4); opacity: 0; }
}
.fc-info {
  display: flex;
  flex-direction: column;
}
.fc-status {
  font-size: 13px;
  font-weight: 600;
  color: #6b9080;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  letter-spacing: 0.5px;
}
.fc-status.calling {
  color: #e26d5c;
  animation: pulseText 1.5s infinite alternate;
}
@keyframes pulseText {
  0% { opacity: 0.6; }
  100% { opacity: 1; }
}
.fc-end-btn {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: #ff4d4f;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-left: 4px;
  box-shadow: 0 4px 8px rgba(255, 77, 79, 0.3);
  transition: transform 0.2s;
}
.fc-end-btn:active {
  transform: scale(0.9);
}
</style>
