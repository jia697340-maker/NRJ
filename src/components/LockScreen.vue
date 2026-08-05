/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { globalSettings, chatSettings } from '../store'
import { useChatState } from '../composables/useChatState'

const emit = defineEmits(['unlock', 'open-chat'])

const { globalNotifications, dismissNotification, mockChats } = useChatState()

// 锁屏持久通知：过滤出有未读消息的会话
const persistentNotifications = computed(() => {
  return mockChats.value.filter(chat => chat.unread > 0).map(chat => ({
    id: chat.id,
    name: chat.name,
    content: chat.preview || '收到一条新消息',
    time: chat.time
  }))
})

const handlePersistentNotifClick = () => {
  handleInitialUnlock()
  emit('open-chat')
}

const currentTime = ref('')
const currentDate = ref('')

const updateTime = () => {
  const now = new Date()
  const hours = now.getHours().toString().padStart(2, '0')
  const minutes = now.getMinutes().toString().padStart(2, '0')
  currentTime.value = `${hours}:${minutes}`
  
  const month = now.getMonth() + 1
  const date = now.getDate()
  const days = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']
  const day = days[now.getDay()]
  currentDate.value = `${month}月${date}日 ${day}`
}

let timer: number

// 3D Parallax Logic
const parallaxX = ref(0)
const parallaxY = ref(0)
let animationFrameId: number | null = null

const updateParallax = (x: number, y: number) => {
  if (animationFrameId) cancelAnimationFrame(animationFrameId)
  animationFrameId = requestAnimationFrame(() => {
    parallaxX.value = x
    parallaxY.value = y
  })
}

const handleMouseMove = (e: MouseEvent) => {
  const { clientX, clientY, innerWidth, innerHeight } = window
  const x = (clientX / innerWidth - 0.5) * 30 // Max 15px shift
  const y = (clientY / innerHeight - 0.5) * 30
  updateParallax(-x, -y)
}

const handleDeviceOrientation = (e: DeviceOrientationEvent) => {
  const { gamma, beta } = e
  if (gamma !== null && beta !== null) {
    const x = Math.max(-20, Math.min(20, gamma * 0.5))
    const y = Math.max(-20, Math.min(20, (beta - 45) * 0.5))
    updateParallax(-x, -y)
  }
}

onMounted(() => {
  updateTime()
  timer = window.setInterval(updateTime, 1000)
  window.addEventListener('mousemove', handleMouseMove)
  window.addEventListener('deviceorientation', handleDeviceOrientation)
})

onUnmounted(() => {
  clearInterval(timer)
  window.removeEventListener('mousemove', handleMouseMove)
  window.removeEventListener('deviceorientation', handleDeviceOrientation)
  if (animationFrameId) cancelAnimationFrame(animationFrameId)
})

// 解锁覆盖层状态
const showOverlay = ref(false)
const overlayType = ref('swipe') // 'digit', 'qa'

// 通用解锁逻辑
const handleInitialUnlock = () => {
  if (globalSettings.unlockMethod === 'swipe') {
    emit('unlock')
  } else {
    overlayType.value = globalSettings.unlockMethod
    showOverlay.value = true
  }
}

// === 现代 iOS (向上滑动) 逻辑 ===
const modernContainer = ref<HTMLElement | null>(null)
const modernStartY = ref(0)
const modernCurrentY = ref(0)
const modernIsDragging = ref(false)

const handleModernTouchStart = (e: TouchEvent | MouseEvent) => {
  // Don't drag if clicking buttons
  const target = e.target as HTMLElement
  if (target.closest('.quick-btn') || target.closest('.notifications-area')) return
  
  modernIsDragging.value = true
  modernStartY.value = 'touches' in e ? e.touches[0].clientY : e.clientY
  modernCurrentY.value = 0
}

const handleModernTouchMove = (e: TouchEvent | MouseEvent) => {
  if (!modernIsDragging.value) return
  const y = 'touches' in e ? e.touches[0].clientY : e.clientY
  const deltaY = y - modernStartY.value
  if (deltaY < 0) {
    modernCurrentY.value = deltaY
  }
}

const handleModernTouchEnd = () => {
  if (!modernIsDragging.value) return
  modernIsDragging.value = false
  if (modernCurrentY.value < -150) {
    modernCurrentY.value = 0
    handleInitialUnlock()
  } else {
    modernCurrentY.value = 0
  }
}

// 壁纸样式
const lockScreenStyle = computed(() => {
  const isDefault = globalSettings.lockScreenWallpaper === 'default' || !globalSettings.lockScreenWallpaper
  return {
    'backgroundImage': isDefault ? 'none' : `url(${globalSettings.lockScreenWallpaper})`,
    'backgroundColor': isDefault ? '#ffffff' : 'transparent',
    'backgroundSize': 'cover',
    'backgroundPosition': 'center',
    'backgroundRepeat': 'no-repeat',
    'color': isDefault ? '#000' : 'white'
  }
})

// UI States
const timeScale = ref(1)

// === 锁屏快捷功能：手电筒与相机 ===
const isFlashlightOn = ref(false)
let flashlightTrack: MediaStreamTrack | null = null

const toggleFlashlight = async () => {
  try {
    if (!flashlightTrack) {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      })
      flashlightTrack = stream.getVideoTracks()[0]
    }
    
    const capabilities = typeof flashlightTrack.getCapabilities === 'function' ? flashlightTrack.getCapabilities() : {} as any
    if (capabilities && capabilities.torch) {
      isFlashlightOn.value = !isFlashlightOn.value
      await flashlightTrack.applyConstraints({
        advanced: [{ torch: isFlashlightOn.value }]
      } as any)
    } else {
      console.warn('当前设备或浏览器不支持手电筒功能')
    }
  } catch (err) {
    console.error('无法调用摄像头或手电筒', err)
  }
}

const cameraInput = ref<HTMLInputElement | null>(null)
const toggleCamera = () => {
  if (cameraInput.value) {
    cameraInput.value.click()
  }
}

// 清理手电筒资源
onUnmounted(() => {
  if (flashlightTrack) {
    flashlightTrack.stop()
  }
})

// === 各种覆盖层逻辑 ===
const overlayInput = ref('')
const overlayShake = ref(false)
const errorCount = ref(0)
const isLocked = ref(false)
const lockoutRemaining = ref(0)
let lockoutTimer: number | null = null

const handleUnlockError = () => {
  errorCount.value++
  overlayShake.value = true
  setTimeout(() => {
    overlayShake.value = false
    overlayInput.value = ''
  }, 500)

  if (errorCount.value >= 5) {
    const penaltyExponent = errorCount.value - 5
    const penaltySeconds = 30 * Math.pow(2, penaltyExponent)
    startLockout(penaltySeconds)
  }
}

const startLockout = (seconds: number) => {
  isLocked.value = true
  lockoutRemaining.value = seconds
  if (lockoutTimer) clearInterval(lockoutTimer)
  lockoutTimer = window.setInterval(() => {
    lockoutRemaining.value--
    if (lockoutRemaining.value <= 0) {
      isLocked.value = false
      if (lockoutTimer) clearInterval(lockoutTimer)
    }
  }, 1000)
}

const handleEmergencyUnlock = () => {
  errorCount.value = 0
  isLocked.value = false
  if (lockoutTimer) clearInterval(lockoutTimer)
  overlayInput.value = ''
  emit('unlock')
}

// 数字密码
const handleDigitInput = (n: number | string) => {
  if (isLocked.value) return
  if (n === 'del') {
    overlayInput.value = overlayInput.value.slice(0, -1)
  } else {
    if (overlayInput.value.length < globalSettings.unlockDigit.length) {
      overlayInput.value += n
      if (overlayInput.value.length === globalSettings.unlockDigit.length) {
        if (overlayInput.value === globalSettings.unlockDigit) {
          errorCount.value = 0
          emit('unlock')
        } else {
          handleUnlockError()
        }
      }
    }
  }
}

// 问答
const handleQaSubmit = () => {
  if (isLocked.value) return
  if (overlayInput.value === globalSettings.unlockQaAnswer) {
    errorCount.value = 0
    emit('unlock')
  } else {
    handleUnlockError()
  }
}

const closeOverlay = () => {
  showOverlay.value = false
  overlayInput.value = ''
}
</script>

<template>
  <div class="lock-screen-container">
    <!-- Parallax Background Layer -->
    <div 
      class="parallax-background"
      :style="[lockScreenStyle, { transform: `translate3d(${parallaxX}px, ${parallaxY}px, 0) scale(1.05)` }]"
    ></div>

    <!-- 现代 iOS 样式 -->
    <div 
      class="modern-wrapper"
      ref="modernContainer"
      :style="{ transform: `translate3d(0, ${modernCurrentY}px, 0)`, transition: modernIsDragging ? 'none' : 'transform 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)' }"
      @mousedown="handleModernTouchStart"
      @mousemove="handleModernTouchMove"
      @mouseup="handleModernTouchEnd"
      @mouseleave="handleModernTouchEnd"
      @touchstart="handleModernTouchStart"
      @touchmove="handleModernTouchMove"
      @touchend="handleModernTouchEnd"
    >
      <!-- 上部：时间和区域一 -->
      <div class="top-section">
        <div class="icon-lock">
          <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
        </div>
        <div class="date">{{ currentDate }}</div>
        <!-- 时间支持缩放，并且预留智能避让结构 -->
        <div class="time-container" :style="{ transform: `scale(${timeScale})` }">
          <div class="time">{{ currentTime }}</div>
        </div>
        <!-- 小组件区域一 -->
        <div class="widget-area-1">
          <!-- Placeholder for widgets -->
        </div>
      </div>
      
      <!-- 中部：通知系统 -->
      <div class="middle-section notifications-area" v-if="globalNotifications.length > 0 || persistentNotifications.length > 0">
        <TransitionGroup name="notif" tag="div" class="notifications-container" :class="chatSettings.notificationStyle">
          <!-- 实时临时通知 -->
          <div 
            v-for="(notif, index) in globalNotifications" 
            :key="'temp_'+notif.id" 
            class="notif-card"
            :style="chatSettings.notificationStyle === 'stack' ? { zIndex: 100 - index, transform: `translate3d(0, ${index * 8}px, 0) scale(${1 - index * 0.05})`, opacity: Math.max(0, 1 - index * 0.3) } : {}"
            @click.stop="dismissNotification(notif.id)"
          >
            <div class="notif-header">
              <span class="notif-title">{{ notif.name }}</span>
              <span class="notif-time">刚刚</span>
            </div>
            <div class="notif-desc">{{ notif.content }}</div>
          </div>
          
          <!-- 持久未读通知 -->
          <div 
            v-for="(notif, index) in persistentNotifications" 
            :key="'persist_'+notif.id" 
            class="notif-card"
            :style="chatSettings.notificationStyle === 'stack' ? { zIndex: 50 - index, transform: `translate3d(0, ${(globalNotifications.length + index) * 8}px, 0) scale(${1 - (globalNotifications.length + index) * 0.05})`, opacity: Math.max(0, 1 - (globalNotifications.length + index) * 0.3) } : {}"
            @click.stop="handlePersistentNotifClick"
          >
            <div class="notif-header">
              <span class="notif-title">{{ notif.name }}</span>
              <span class="notif-time">{{ notif.time }}</span>
            </div>
            <div class="notif-desc">{{ notif.content }}</div>
          </div>
        </TransitionGroup>
      </div>

      <!-- 下部：区域二、快捷操作、Home Indicator -->
      <div class="bottom-section">
        <!-- 小组件区域二 -->
        <div class="widget-area-2">
          <!-- Placeholder for widgets -->
        </div>
        
        <!-- 隐藏的原生相机呼出入口 -->
        <input type="file" accept="image/*" capture="environment" ref="cameraInput" style="display: none" />

        <div class="quick-actions-bar">
          <div class="quick-btn flashlight" :class="{ active: isFlashlightOn }" @click.stop="toggleFlashlight">
            <svg viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round">
              <path d="M10 2h4a2 2 0 0 1 2 2v1.5a2 2 0 0 1-.5 1.25L14 9.5v10.5a2 2 0 0 1-2 2h-0a2 2 0 0 1-2-2V9.5L8.5 6.75a2 2 0 0 1-.5-1.25V4a2 2 0 0 1 2-2Z"></path>
              <line x1="10" y1="6" x2="14" y2="6"></line>
              <line x1="12" y1="12" x2="12" y2="15"></line>
            </svg>
          </div>
          <div class="quick-btn camera" @click.stop="toggleCamera">
            <svg viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" stroke-width="1.5" fill="none"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
          </div>
        </div>

        <div class="bottom-hint">
          <div class="hint-text">向上滑动来解锁</div>
          <div class="home-indicator"></div>
        </div>
      </div>
    </div>

    <!-- 解锁覆盖层 -->
    <Transition name="fade">
      <div v-if="showOverlay" class="unlock-overlay" :class="['modern']">
        <div class="overlay-backdrop"></div>
        <button class="overlay-cancel" @click="closeOverlay">取消</button>

        <div class="overlay-content" :class="{ 'shake': overlayShake }">
          <div v-if="isLocked" class="lockout-panel">
            <h3>设备已锁定</h3>
            <p>密码错误次数过多，请在 <span>{{ lockoutRemaining }}</span> 秒后重试。</p>
            <button class="emergency-btn" @click="handleEmergencyUnlock">快速通道</button>
          </div>

          <template v-else>
          <div v-if="overlayType === 'digit'" class="digit-panel">
            <h3>输入密码</h3>
            <div class="digit-dots">
              <div 
                class="dot" 
                v-for="(_, i) in globalSettings.unlockDigit.length" 
                :key="i"
                :class="{ filled: i < overlayInput.length }"
              ></div>
            </div>
            <div class="digit-keyboard">
              <button class="key" v-for="n in 9" :key="n" @click="handleDigitInput(n)">{{ n }}</button>
              <button class="key empty"></button>
              <button class="key" @click="handleDigitInput(0)">0</button>
              <button class="key action" @click="handleDigitInput('del')">×</button>
            </div>
          </div>

          <div v-else-if="overlayType === 'qa'" class="qa-panel">
            <h3>{{ globalSettings.unlockQaQuestion }}</h3>
            <input type="text" v-model="overlayInput" placeholder="输入答案" @keyup.enter="handleQaSubmit" />
            <button class="qa-submit" @click="handleQaSubmit">确认</button>
          </div>
          </template>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.lock-screen-container {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 9000;
  overflow: hidden;
  user-select: none;
}

/* 视差背景层 */
.parallax-background {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 1;
  will-change: transform;
  /* 平滑插值 */
  transition: transform 0.1s linear;
}

/* 现代样式容器 */
.modern-wrapper {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  z-index: 2; /* 高于背景层 */
  will-change: transform;
}

.top-section {
  padding-top: 8vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-shadow: 0 1px 5px rgba(0,0,0,0.4);
}

.icon-lock {
  margin-bottom: 8px;
}

.modern-wrapper .date {
  font-size: 20px;
  font-weight: 500;
  margin-bottom: 2px;
}

.time-container {
  will-change: transform;
  transform-origin: center center;
  transition: transform 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
}

.modern-wrapper .time {
  font-size: 86px;
  font-weight: 600;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  letter-spacing: -2px;
  line-height: 1;
}

.widget-area-1 {
  width: 100%;
  min-height: 40px;
  margin-top: 10px;
  display: flex;
  justify-content: center;
  /* 占位，可以放一排小组件 */
}

/* 通知区域 */
.notifications-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  padding: 0 20px;
  cursor: pointer;
}

.notifications-container {
  width: 100%;
  max-width: 340px;
  position: relative;
  min-height: 120px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.notif-count {
  background: rgba(255,255,255,0.2);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  padding: 8px 16px;
  border-radius: 20px;
  font-size: 14px;
  font-weight: 500;
}

.notif-card {
  width: 100%;
  background: rgba(255,255,255,0.25);
  backdrop-filter: blur(25px);
  -webkit-backdrop-filter: blur(25px);
  border-radius: 20px;
  padding: 14px 16px;
  margin-bottom: 8px;
  box-shadow: 0 4px 15px rgba(0,0,0,0.1);
  will-change: transform, opacity;
  transition: all 0.4s cubic-bezier(0.25, 0.8, 0.25, 1);
}

.notifications-container.stack .notif-card {
  position: absolute;
  top: 0;
  left: 0;
}

.notifications-container.list .notif-card,
.notifications-container.queue .notif-card {
  position: relative;
  transform: none !important;
  opacity: 1 !important;
}

.notif-header {
  display: flex;
  align-items: center;
  margin-bottom: 6px;
}

.notif-title {
  font-size: 14px;
  font-weight: 600;
  flex: 1;
}

.notif-time {
  font-size: 12px;
  opacity: 0.7;
}

.notif-desc {
  font-size: 14px;
  opacity: 0.9;
  line-height: 1.3;
}

/* 底部区域 */
.bottom-section {
  padding-bottom: 2vh;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.widget-area-2 {
  width: 100%;
  min-height: 50px;
  margin-bottom: 10px;
  /* 支持小组件拖拽至此 */
}

.quick-actions-bar {
  width: 100%;
  padding: 0 40px;
  display: flex;
  justify-content: space-between;
  margin-bottom: 15px;
}

.quick-btn {
  width: 50px;
  height: 50px;
  border-radius: 50%;
  background: rgba(0,0,0,0.3);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  display: flex;
  justify-content: center;
  align-items: center;
  cursor: pointer;
  transition: transform 0.2s, background 0.2s;
}

.quick-btn:active {
  transform: scale(0.9);
  background: rgba(255,255,255,0.8);
  color: var(--text-primary);
}
.quick-btn.active {
  background: rgba(255,255,255,0.9);
  color: #000;
}

.bottom-hint {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.hint-text {
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 10px;
  opacity: 0.8;
}

.home-indicator {
  width: 130px;
  height: 5px;
  background-color: currentColor;
  border-radius: 3px;
  box-shadow: 0 1px 2px rgba(0,0,0,0.3);
}

/* 解锁覆盖层通用 */
.unlock-overlay {
  position: absolute;
  top: 0; left: 0; width: 100%; height: 100%;
  z-index: 10000;
  display: flex;
  justify-content: center;
  align-items: center;
}

.overlay-backdrop {
  position: absolute;
  top: 0; left: 0; width: 100%; height: 100%;
  background: rgba(0,0,0,0.6);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
}

.overlay-cancel {
  position: absolute;
  bottom: 50px;
  background: none; border: none; color: white;
  font-size: 16px; opacity: 0.8; padding: 10px 20px;
  z-index: 10001; cursor: pointer;
}

.overlay-content {
  position: relative;
  z-index: 10001;
  width: 100%;
  padding: 0 40px;
  color: white;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.shake {
  animation: shake 0.5s;
}

/* 锁定面板 */
.lockout-panel {
  text-align: center;
  padding: 30px 20px;
  background: rgba(0, 0, 0, 0.4);
  border-radius: 15px;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
}
.lockout-panel h3 {
  font-size: 24px;
  color: #ff453a;
  margin-bottom: 15px;
  font-weight: 500;
}
.lockout-panel p {
  font-size: 16px;
  margin-bottom: 30px;
  line-height: 1.5;
}
.lockout-panel p span {
  font-weight: bold;
  color: #ff9f0a;
  font-size: 18px;
}
.lockout-panel .emergency-btn {
  background: rgba(255, 255, 255, 0.2);
  border: none;
  color: white;
  padding: 10px 20px;
  border-radius: 20px;
  font-size: 14px;
  cursor: pointer;
  transition: background 0.2s;
}
.lockout-panel .emergency-btn:active {
  background: rgba(255, 255, 255, 0.4);
}
@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-10px); }
  75% { transform: translateX(10px); }
}

/* 数字密码 */
.digit-panel h3 {
  font-weight: 400; font-size: 20px; margin-bottom: 20px; text-align: center;
}
.digit-dots {
  display: flex; justify-content: center; gap: 15px; margin-bottom: 50px;
}
.digit-dots .dot {
  width: 12px; height: 12px; border-radius: 50%;
  border: 1.5px solid white; transition: background 0.2s;
}
.digit-dots .dot.filled {
  background: var(--sys-bg-secondary);
}

.digit-keyboard {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px 30px;
}
.digit-keyboard .key {
  width: 70px; height: 70px; border-radius: 50%;
  background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2);
  color: white; font-size: 28px; font-weight: 300;
  display: flex; justify-content: center; align-items: center;
  cursor: pointer;
}
.digit-keyboard .key:active { background: rgba(255,255,255,0.3); }
.digit-keyboard .key.empty { background: none; border: none; pointer-events: none; }
.digit-keyboard .key.action { font-size: 20px; background: none; border: none; }

/* 问答 */
.qa-panel { width: 100%; max-width: 300px; text-align: center; }
.qa-panel h3 { font-size: 18px; margin-bottom: 20px; font-weight: 500; line-height: 1.4; }
.qa-panel input {
  width: 100%; padding: 12px 15px; border-radius: 10px; border: none;
  background: rgba(255,255,255,0.2); color: white; font-size: 16px; margin-bottom: 15px;
  outline: none; text-align: center; backdrop-filter: blur(10px);
}
.qa-panel input::placeholder { color: rgba(255,255,255,0.5); }
.qa-panel .qa-submit {
  width: 100%; padding: 12px; border-radius: 10px; border: none;
  background: var(--sys-bg-secondary); color: var(--text-primary); font-size: 16px; font-weight: 600; cursor: pointer;
}
.qa-panel .qa-submit:active { opacity: 0.8; }

.fade-enter-active, .fade-leave-active { transition: opacity 0.3s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
