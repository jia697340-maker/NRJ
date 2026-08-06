/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { watchEffect } from 'vue'
import StatusBar from './components/StatusBar.vue'
import Desktop from './components/Desktop.vue'
import AppearanceSettings from './components/AppearanceSettings.vue'
import ApiSettings from './components/ApiSettings.vue'
import AppChatPreview from './components/app_ChatPreview.vue'
import AppSMS from './components/app_SMS.vue'
import AppWallet from './components/app_Wallet.vue'
import AppWorldBook from './components/app_WorldBook.vue'
import AppAdvancedSettings from './components/app_AdvancedSettings.vue'
import AppVoiceAccess from './components/app_VoiceAccess.vue'
import AppImageAccess from './components/app_ImageAccess.vue'
import AppWardrobe from './components/app_Wardrobe.vue'
import LockScreen from './components/LockScreen.vue'
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { globalSettings, appStats } from './store'
import { useChatState } from './composables/useChatState'
import { useAppIcons } from './composables/useAppIcons'

const { globalNotifications, dismissNotification, showNotification, loadCustomContacts, loadMyProfile } = useChatState()
const { loadData: loadAppIconsData, customIcons } = useAppIcons()

// 暴露到全局，方便开发者在控制台测试 UI 动画效果
;(window as any).testNotification = showNotification

const activeApp = ref<string | null>(null)
const isLocked = ref(globalSettings.enableLockScreen)
const hasOpenedChatApp = ref(false)
const chatAppRef = ref<any>(null)

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const deferredInstallPrompt = ref<InstallPromptEvent | null>(null)
const showInstallPrompt = ref(false)
const isInstallPromptReady = ref(false)
const skipInstallPrompt = ref(false)
const installPromptDismissedKey = 'nianrenji-install-prompt-dismissed'
const isStandaloneApp = () => window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true
const isIos = () => /iPad|iPhone|iPod/.test(navigator.userAgent)

const openInstallPrompt = async () => {
  if (!deferredInstallPrompt.value) return
  await deferredInstallPrompt.value.prompt()
  const { outcome } = await deferredInstallPrompt.value.userChoice
  if (outcome === 'accepted') showInstallPrompt.value = false
  deferredInstallPrompt.value = null
  isInstallPromptReady.value = false
}

const dismissInstallPrompt = () => {
  if (skipInstallPrompt.value) {
    localStorage.setItem(installPromptDismissedKey, 'true')
  }
  showInstallPrompt.value = false
}

type VoiceCallState = {
  active: boolean
  minimized: boolean
  status: 'idle' | 'calling' | 'incoming' | 'connected' | 'ended'
  durationStr: string
  charName: string
  charAvatar: string
  chatId?: string | number
}

const phoneVoiceCallState = ref<VoiceCallState>({
  active: false,
  minimized: false,
  status: 'idle',
  durationStr: '00:00',
  charName: '未知联系人',
  charAvatar: ''
})

const isPhoneCallWidgetVisible = computed(() => {
  return phoneVoiceCallState.value.active && activeApp.value !== 'chat' && !isLocked.value
})

// 最外层悬浮窗，覆盖桌面和所有 App。
const phoneWidgetX = ref(typeof window !== 'undefined' ? window.innerWidth - 180 : 16)
const phoneWidgetY = ref(64)
const isDraggingPhoneWidget = ref(false)
const phoneWidgetHasMoved = ref(false)
let phoneWidgetStartX = 0
let phoneWidgetStartY = 0
let phoneWidgetInitialX = 0
let phoneWidgetInitialY = 0

const initPhoneCallWidgetPosition = () => {
  const widgetWidth = 140
  phoneWidgetX.value = Math.max(16, window.innerWidth - widgetWidth - 16)
  phoneWidgetY.value = Math.min(phoneWidgetY.value || 64, Math.max(64, window.innerHeight - 56))
}

const phoneCallWidgetStyle = computed(() => ({
  transform: `translate3d(${phoneWidgetX.value}px, ${phoneWidgetY.value}px, 0)`,
  transition: isDraggingPhoneWidget.value ? 'none' : 'transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
  willChange: 'transform'
}))

let usageTimer: ReturnType<typeof setInterval>

onMounted(async () => {
  if (!isStandaloneApp() && localStorage.getItem(installPromptDismissedKey) !== 'true') {
    showInstallPrompt.value = true
  }

  // 启动页面使用时长统计
  usageTimer = setInterval(() => {
    appStats.usageTime++
  }, 1000)

  initPhoneCallWidgetPosition()
  window.addEventListener('resize', initPhoneCallWidgetPosition)
  loadCustomContacts()
  loadMyProfile()
  await loadAppIconsData()

})

const handleBeforeInstallPrompt = (event: Event) => {
  event.preventDefault()
  deferredInstallPrompt.value = event as InstallPromptEvent
  isInstallPromptReady.value = true
}

window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)

onUnmounted(() => {
  if (usageTimer) {
    clearInterval(usageTimer)
  }
  window.removeEventListener('resize', initPhoneCallWidgetPosition)
  window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
})

// 监听 darkMode 变化，将类直接加到 body 上，确保所有 Teleport 组件生效
watchEffect(() => {
  if (globalSettings.darkMode) {
    document.body.classList.add('dark-theme')
  } else {
    document.body.classList.remove('dark-theme')
  }
})

const handleUnlock = () => {
  isLocked.value = false
}

const handleOpenChatFromLock = () => {
  handleUnlock()
  hasOpenedChatApp.value = true
  activeApp.value = 'chat'
}

const containerStyle = computed(() => {
  const isDefault = globalSettings.wallpaper === 'default' || !globalSettings.wallpaper
  return {
    '--accent-color': globalSettings.accentColor,
    'backgroundImage': isDefault ? 'none' : `url(${globalSettings.wallpaper})`,
    'backgroundColor': isDefault ? '' : 'transparent',
    'backgroundSize': 'cover',
    'backgroundPosition': 'center',
    'backgroundRepeat': 'no-repeat'
  }
})

const handleOpenApp = (appId: string) => {
  if (appId === 'appearance' || appId === 'api_settings' || appId === 'chat' || appId === 'messages' || appId === 'wallet' || appId === 'world_book' || appId === 'settings' || appId === 'voice_access' || appId === 'image_access' || appId === 'wardrobe') {
    if (appId === 'chat') {
      hasOpenedChatApp.value = true
    }
    activeApp.value = appId
  } else {
    console.log('Open app:', appId)
  }
}

const handlePhoneVoiceCallStateChange = (state: VoiceCallState) => {
  phoneVoiceCallState.value = state
}

const onPhoneWidgetPointerStart = (e: TouchEvent | MouseEvent) => {
  isDraggingPhoneWidget.value = true
  phoneWidgetHasMoved.value = false
  const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX
  const clientY = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY
  phoneWidgetStartX = clientX
  phoneWidgetStartY = clientY
  phoneWidgetInitialX = phoneWidgetX.value
  phoneWidgetInitialY = phoneWidgetY.value
}

const onPhoneWidgetPointerMove = (e: TouchEvent | MouseEvent) => {
  if (!isDraggingPhoneWidget.value) return
  const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX
  const clientY = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY
  const deltaX = clientX - phoneWidgetStartX
  const deltaY = clientY - phoneWidgetStartY

  if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
    phoneWidgetHasMoved.value = true
  }

  if (phoneWidgetHasMoved.value) {
    if (e.cancelable) e.preventDefault()
    const target = e.currentTarget as HTMLElement
    const widgetWidth = target?.offsetWidth || 140
    const widgetHeight = target?.offsetHeight || 50
    const maxX = window.innerWidth - widgetWidth
    const maxY = window.innerHeight - widgetHeight

    phoneWidgetX.value = Math.max(0, Math.min(phoneWidgetInitialX + deltaX, maxX))
    phoneWidgetY.value = Math.max(0, Math.min(phoneWidgetInitialY + deltaY, maxY))
  }
}

const onPhoneWidgetPointerEnd = (e: TouchEvent | MouseEvent) => {
  if (!isDraggingPhoneWidget.value) return
  isDraggingPhoneWidget.value = false

  nextTick(() => {
    const target = e.currentTarget as HTMLElement
    const widgetWidth = target?.offsetWidth || 140
    const centerX = phoneWidgetX.value + widgetWidth / 2
    phoneWidgetX.value = centerX < window.innerWidth / 2 ? 16 : window.innerWidth - widgetWidth - 16
  })
}

const restorePhoneVoiceCall = async () => {
  if (phoneWidgetHasMoved.value) return
  hasOpenedChatApp.value = true
  activeApp.value = 'chat'
  await nextTick()
  chatAppRef.value?.restoreVoiceCallFromOutside?.()
}

const endPhoneVoiceCall = () => {
  chatAppRef.value?.endVoiceCallFromOutside?.()
}

// 基础 App 列表数据
const baseApps = [
  { id: 'appearance', name: '外观设置', icon: '<span class="text-icon">颜</span>', color: '#ffffff' },
  { id: 'world_book', name: '世界书', icon: '<span class="text-icon">书</span>', color: '#ffffff' },
  { id: 'settings', name: '高级设置', icon: '<span class="text-icon">设</span>', color: '#ffffff' },
  { id: 'messages', name: '短信', icon: '<span class="text-icon">信</span>', color: '#ffffff' },
  
  { id: 'api_settings', name: 'API设置', icon: '<span class="text-icon">A</span>', color: '#ffffff' },
  { id: 'chat', name: '聊天', icon: '<span class="text-icon">聊</span>', color: '#ffffff' },
  { id: 'delivery', name: '投递', icon: '<span class="text-icon">投</span>', color: '#ffffff' },
  { id: 'wallet', name: '钱包', icon: '<span class="text-icon">包</span>', color: '#ffffff' },
  
  { id: 'app_store', name: '应用商城', icon: '<span class="text-icon">商</span>', color: '#ffffff' },
  { id: 'couple_space', name: '情侣空间', icon: '<span class="text-icon">空</span>', color: '#ffffff' },
  { id: 'forum', name: '论坛', icon: '<span class="text-icon">论</span>', color: '#ffffff' },
  { id: 'live', name: '直播', icon: '<span class="text-icon">播</span>', color: '#ffffff' },
  { id: 'voice_access', name: '语音接入', icon: '<span class="text-icon">音</span>', color: '#ffffff' },
  { id: 'image_access', name: '图像接入', icon: '<span class="text-icon">图</span>', color: '#ffffff' },
  { id: 'wardrobe', name: '衣柜', icon: '<span class="text-icon">衣</span>', color: '#ffffff' },
]

// 计算应用列表，动态混合自定义图标
const apps = computed(() => {
  return baseApps.map(app => {
    return {
      ...app,
      customImage: customIcons[app.id] || null
    }
  })
})
</script>

<template>
  <div class="phone-container" :style="containerStyle">
    <Transition name="install-prompt">
      <div v-if="showInstallPrompt" class="install-prompt-backdrop" role="dialog" aria-modal="true" aria-labelledby="install-prompt-title">
        <section class="install-prompt-card">
          <img class="install-prompt-icon" src="/pwa-icon.jpg" alt="黏人机" />
          <button class="install-prompt-close" type="button" aria-label="暂不安装" @click="dismissInstallPrompt">×</button>
          <p class="install-prompt-kicker">安装到主屏幕</p>
          <h1 id="install-prompt-title">把黏人机装到手机上</h1>
          <p v-if="isInstallPromptReady">安装后可像原生 App 一样从主屏幕打开，使用更方便。</p>
          <p v-else-if="isIos()">点击浏览器底部的“分享”按钮，再选择“添加到主屏幕”。</p>
          <p v-else>可使用浏览器菜单中的“安装应用”或“添加到主屏幕”，随时把黏人机装到设备上。</p>
          <label class="install-prompt-skip">
            <input v-model="skipInstallPrompt" type="checkbox" />
            <div class="custom-checkbox"></div>
            <span>下次不再提示</span>
          </label>
          <button v-if="isInstallPromptReady" class="install-prompt-primary" type="button" @click="openInstallPrompt">立即安装</button>
          <button v-else class="install-prompt-secondary" type="button" @click="dismissInstallPrompt">知道了</button>
        </section>
      </div>
    </Transition>
    <!-- 夜间护眼滤镜遮罩 -->
    <div class="night-shift-overlay" v-if="globalSettings.nightShift"></div>

    <!-- 锁屏界面 -->
    <Transition name="lock-fade">
      <LockScreen v-if="isLocked" @unlock="handleUnlock" @open-chat="handleOpenChatFromLock" />
    </Transition>

    <!-- 状态栏：只要桌面壁纸是浅色的，状态栏就应该是深色字体。目前壁纸写死为浅色，所以 is-dark 恒为 true -->
    <StatusBar :is-dark="true" v-show="globalSettings.showStatusBar && activeApp === null && (!isLocked || globalSettings.lockScreenStyle !== 'classic')" />
    <Desktop :apps="apps" @open-app="handleOpenApp" v-show="!isLocked" />
    
    <!-- 应用视图 -->
    <Transition name="app-fade">
      <AppearanceSettings 
        v-if="activeApp === 'appearance'" 
        @close="activeApp = null" 
      />
    </Transition>
    <Transition name="app-fade">
      <ApiSettings 
        v-if="activeApp === 'api_settings'" 
        @close="activeApp = null" 
      />
    </Transition>
    <Transition name="app-fade">
      <AppChatPreview 
        v-if="hasOpenedChatApp"
        v-show="activeApp === 'chat'"
        ref="chatAppRef"
        @close="activeApp = null" 
        @voice-call-state-change="handlePhoneVoiceCallStateChange"
      />
    </Transition>
    <Transition name="app-fade">
      <AppSMS 
        v-if="activeApp === 'messages'" 
        @close="activeApp = null" 
      />
    </Transition>
    <Transition name="app-fade">
      <AppWallet 
        v-if="activeApp === 'wallet'" 
        @close="activeApp = null" 
      />
    </Transition>
    <Transition name="app-fade">
      <AppWorldBook 
        v-if="activeApp === 'world_book'" 
        @close="activeApp = null" 
      />
    </Transition>
    <Transition name="app-fade">
      <AppAdvancedSettings 
        v-if="activeApp === 'settings'" 
        @close="activeApp = null" 
      />
    </Transition>
    <Transition name="app-fade">
      <AppVoiceAccess 
        v-if="activeApp === 'voice_access'" 
        @close="activeApp = null" 
      />
    </Transition>
    <Transition name="app-fade">
      <AppImageAccess 
        v-if="activeApp === 'image_access'" 
        @close="activeApp = null" 
      />
    </Transition>
    <Transition name="app-fade">
      <AppWardrobe 
        v-if="activeApp === 'wardrobe'" 
        @close="activeApp = null" 
      />
    </Transition>

    <!-- 语音通话手机级悬浮窗：桌面和其他 App 中也保持通话 -->
    <Transition name="app-fade">
      <div
        v-if="isPhoneCallWidgetVisible"
        class="phone-call-widget"
        :style="phoneCallWidgetStyle"
        @click="restorePhoneVoiceCall"
        @touchstart="onPhoneWidgetPointerStart"
        @touchmove="onPhoneWidgetPointerMove"
        @touchend="onPhoneWidgetPointerEnd"
        @mousedown="onPhoneWidgetPointerStart"
        @mousemove="onPhoneWidgetPointerMove"
        @mouseup="onPhoneWidgetPointerEnd"
        @mouseleave="onPhoneWidgetPointerEnd"
      >
        <div class="pcw-avatar" :style="{ backgroundImage: `url(${phoneVoiceCallState.charAvatar || ''})` }">
          <div class="pcw-ripple"></div>
        </div>
        <div class="pcw-info">
          <div class="pcw-name">{{ phoneVoiceCallState.charName }}</div>
          <div class="pcw-status" :class="{ calling: phoneVoiceCallState.status === 'calling' || phoneVoiceCallState.status === 'incoming' }">
            {{ phoneVoiceCallState.status === 'calling' ? '等待接听...' : (phoneVoiceCallState.status === 'incoming' ? '来电中...' : phoneVoiceCallState.durationStr) }}
          </div>
        </div>
        <div class="pcw-end-btn" @click.stop="endPhoneVoiceCall">
          <svg viewBox="0 0 24 24" width="16" height="16" stroke="white" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" style="transform: rotate(135deg);">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
          </svg>
        </div>
      </div>
    </Transition>

    <!-- 全局消息通知弹窗 -->
    <div class="global-notifications-container" :class="chatSettings.notificationStyle">
      <TransitionGroup name="notification-slide" tag="div" class="notifications-wrapper">
        <div 
          v-for="(notice, index) in globalNotifications" 
          :key="notice.id" 
          class="global-notification-card glass"
          :style="getGlobalStackStyle(index, globalNotifications.length)"
          @click="() => { hasOpenedChatApp = true; activeApp = 'chat'; dismissNotification(notice.id) }"
        >
          <div class="notification-avatar" :style="notice.avatarUrl ? { backgroundImage: `url(${notice.avatarUrl})` } : {}">
            {{ notice.avatarUrl ? '' : notice.avatarText }}
          </div>
          <div class="notification-content">
            <div class="notification-title">{{ notice.name }}</div>
            <div class="notification-text">{{ notice.content }}</div>
          </div>
        </div>
      </TransitionGroup>
    </div>
  </div>
</template>

<script lang="ts">
import { chatSettings } from './store'
export default {
  computed: {
    chatSettings() {
      return chatSettings
    }
  },
  methods: {
    getGlobalStackStyle(index: number, total: number) {
      if (this.chatSettings.notificationStyle !== 'stack') return {}
      
      if (index === 0) {
        // 最新的消息：完全显示在最上面
        return { zIndex: total, transform: `translate3d(0, 0px, 0) scale(1)`, opacity: 1 }
      } else if (index === 1) {
        // 上一条消息：被压在下面，往下推露出一截边缘，并稍微缩小
        return { zIndex: total - 1, transform: `translate3d(0, 10px, 0) scale(0.92)`, opacity: 0.8 }
      } else {
        // 第三条及更早：在看不见的位置消失
        return { zIndex: total - index, transform: `translate3d(0, 20px, 0) scale(0.8)`, opacity: 0, pointerEvents: 'none' }
      }
    }
  }
}
</script>

<style>
 .install-prompt-enter-active, .install-prompt-leave-active { transition: opacity .22s ease; }
 .install-prompt-enter-active .install-prompt-card, .install-prompt-leave-active .install-prompt-card { transition: transform .22s ease, opacity .22s ease; }
 .install-prompt-enter-from, .install-prompt-leave-to { opacity: 0; }
 .install-prompt-enter-from .install-prompt-card, .install-prompt-leave-to .install-prompt-card { opacity: 0; transform: translateY(18px) scale(.97); }
 .install-prompt-backdrop { position: fixed; z-index: 20000; inset: 0; display: flex; align-items: center; justify-content: center; padding: 24px; background: rgba(35, 22, 35, .38); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); }
 .install-prompt-card { position: relative; width: min(100%, 340px); padding: 26px 24px 22px; border: 1px solid rgba(255,255,255,.72); border-radius: 28px; background: rgba(255,255,255,.94); box-shadow: 0 22px 58px rgba(49, 28, 54, .24); color: #3c2d3a; text-align: center; }
 .install-prompt-icon { width: 68px; height: 68px; margin-bottom: 10px; border-radius: 18px; box-shadow: 0 7px 18px rgba(133, 91, 157, .2); }
 .install-prompt-close { position: absolute; top: 12px; right: 14px; width: 30px; height: 30px; border: 0; border-radius: 50%; background: #f1edf1; color: #8c7988; font-size: 24px; line-height: 1; }
 .install-prompt-kicker { margin: 0 0 5px; color: #b85d88; font-size: 13px; font-weight: 700; letter-spacing: .04em; }
 .install-prompt-card h1 { margin: 0; font-size: 21px; line-height: 1.3; }
 .install-prompt-card p:not(.install-prompt-kicker) { margin: 10px 0 18px; color: #71616e; font-size: 14px; line-height: 1.55; }
 .install-prompt-skip { display: flex; align-items: center; justify-content: center; gap: 8px; margin: -4px 0 15px; color: #81717f; font-size: 13px; cursor: pointer; user-select: none; }
 .install-prompt-skip input { display: none; }
 .install-prompt-skip .custom-checkbox { width: 18px; height: 18px; border: 1.5px solid #d4ccd3; border-radius: 5px; position: relative; transition: all 0.2s ease; display: flex; align-items: center; justify-content: center; background: white; }
 .install-prompt-skip input:checked + .custom-checkbox { background: #c579a4; border-color: #c579a4; }
 .install-prompt-skip input:checked + .custom-checkbox::after { content: ''; width: 4px; height: 8px; border: solid white; border-width: 0 2px 2px 0; transform: rotate(45deg); margin-bottom: 2px; }
 .install-prompt-primary, .install-prompt-secondary { width: 100%; min-height: 44px; border: 0; border-radius: 14px; font: inherit; font-size: 15px; font-weight: 700; }
 .install-prompt-primary { background: linear-gradient(135deg, #e982ad, #b282e7); box-shadow: 0 7px 16px rgba(200, 112, 170, .26); color: white; }
 .install-prompt-secondary { background: #f2eef2; color: #665564; }
/* 应用打开/关闭过渡动画 */
.app-fade-enter-active,
.app-fade-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}
.app-fade-enter-from,
.app-fade-leave-to {
  opacity: 0;
  transform: scale(0.95);
}

.phone-call-widget {
  position: fixed;
  top: 0;
  left: 0;
  z-index: 5000;
  display: flex;
  align-items: center;
  width: 140px;
  height: 50px;
  padding: 6px 8px;
  background: rgba(255, 255, 255, 0.84);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.7);
  border-radius: 25px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.14);
  cursor: pointer;
  user-select: none;
  box-sizing: border-box;
}

.pcw-avatar {
  position: relative;
  flex-shrink: 0;
  width: 38px;
  height: 38px;
  border-radius: 50%;
  background-color: #e2e8f0;
  background-size: cover;
  background-position: center;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
}

.pcw-ripple {
  position: absolute;
  inset: -3px;
  border: 1px solid rgba(107, 144, 128, 0.45);
  border-radius: 50%;
  animation: pcwRipple 1.8s infinite ease-out;
}

.pcw-info {
  min-width: 0;
  flex: 1;
  margin-left: 8px;
}

.pcw-name {
  overflow: hidden;
  color: #2d3748;
  font-size: 11px;
  font-weight: 700;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pcw-status {
  margin-top: 2px;
  color: #6b9080;
  font-size: 12px;
  font-weight: 700;
  line-height: 1.2;
  white-space: nowrap;
}

.pcw-status.calling {
  color: #e26d5c;
  font-size: 11px;
}

.pcw-end-btn {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  margin-left: 6px;
  border-radius: 50%;
  background: #e26d5c;
  box-shadow: 0 4px 10px rgba(226, 109, 92, 0.28);
}

.pcw-end-btn:active {
  transform: scale(0.92);
}

@keyframes pcwRipple {
  0% {
    transform: scale(1);
    opacity: 0.75;
  }
  100% {
    transform: scale(1.35);
    opacity: 0;
  }
}

/* 锁屏解锁过渡动画 */
.lock-fade-enter-active,
.lock-fade-leave-active {
  transition: opacity 0.4s ease, transform 0.4s ease;
}
.lock-fade-enter-from {
  opacity: 0;
}
.lock-fade-leave-to {
  opacity: 0;
  transform: translateY(-20px);
}
</style>

<style scoped>
.phone-container {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  position: relative;
  transition: background-color 0.3s ease;
}

/* 夜间护眼滤镜 */
.night-shift-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(255, 150, 0, 0.15);
  pointer-events: none;
  z-index: 9999;
  mix-blend-mode: multiply;
}

/* 全局通知容器与卡片样式 */
.global-notifications-container {
  position: absolute;
  top: 6vh; /* 避开状态栏 */
  left: 0;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  pointer-events: none;
  z-index: 10000; /* 层级极高，覆盖大部分应用 */
}

/* 列表模式 */
.global-notifications-container.list {
  gap: 12px;
}

/* 排队模式 */
.global-notifications-container.queue {
  gap: 0;
}

/* 叠放模式容器调整 */
.global-notifications-container.stack .notifications-wrapper {
  position: relative;
  height: 80px; /* 预留大概一张卡片的高度作为锚点 */
}

.global-notifications-container.stack .global-notification-card {
  position: absolute;
  top: 0;
  left: 50%;
  margin-left: -45%; /* 因为 width: 90%，居中补偿 */
  transition: all 0.4s cubic-bezier(0.25, 0.8, 0.25, 1);
  will-change: transform, opacity;
}

/* 对于响应式 max-width 居中的精确调整 */
@media (min-width: 444px) {
  .global-notifications-container.stack .global-notification-card {
    margin-left: -200px; /* max-width: 400px 的一半 */
  }
}

.notifications-wrapper {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.global-notification-card {
  width: 90%;
  max-width: 400px;
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-radius: 20px; /* iOS 圆角稍微大一点点 */
  padding: 14px 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.12);
  pointer-events: auto; /* 允许点击 */
  cursor: pointer;
  box-sizing: border-box;
}

.is-dark .global-notification-card {
  background: rgba(40, 40, 40, 0.85);
  box-shadow: 0 8px 24px rgba(0,0,0,0.4);
}

.notification-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background-color: #e0e0e0;
  background-size: cover;
  background-position: center;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  font-weight: 500;
  color: #666;
  flex-shrink: 0;
}

.notification-content {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.notification-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.notification-text {
  font-size: 13px;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 列表和排队模式的动画 */
.notification-slide-enter-active,
.notification-slide-leave-active {
  transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}
.notification-slide-enter-from {
  opacity: 0;
  transform: translateY(-30px);
}
.notification-slide-leave-to {
  opacity: 0;
  transform: translateY(-10px) scale(0.95);
}

</style>
