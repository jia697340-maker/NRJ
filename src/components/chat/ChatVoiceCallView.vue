/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import { chatSettings } from '../../store'
import ChatVoiceMemoryModal from './modals/ChatVoiceMemoryModal.vue'
import ChatVoiceCallMsgActionModal from './modals/ChatVoiceCallMsgActionModal.vue'

const props = defineProps<{
  show: boolean
  status: 'idle' | 'calling' | 'incoming' | 'connected' | 'ended'
  durationStr: string
  charName: string
  charAvatar: string
  isGenerating: boolean
  displayMessages: any[]
  currentSummary?: string | null
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'add-message', text: string): void
  (e: 'trigger-api'): void
  (e: 'stop-generate'): void
  (e: 'regenerate'): void
  (e: 'end-call'): void
  (e: 'accept-call'): void
  (e: 'decline-call'): void
  (e: 'minimize'): void
  (e: 'edit-message', messageId: number): void
  (e: 'delete-message', messageId: number): void
}>()

const inputMessage = ref('')
const msgListRef = ref<HTMLElement | null>(null)
const showMemoryModal = ref(false)

const handleSend = () => {
  if (!inputMessage.value.trim()) return
  emit('add-message', inputMessage.value)
  inputMessage.value = ''
  scrollToBottom()
}

const scrollToBottom = () => {
  nextTick(() => {
    if (msgListRef.value) {
      msgListRef.value.scrollTop = msgListRef.value.scrollHeight
    }
  })
}

watch(() => props.displayMessages, () => {
  scrollToBottom()
}, { deep: true })

// 长按消息气泡唤出操作菜单
const showMsgActionModal = ref(false)
const actionTargetMsg = ref<any>(null)
let pressTimer: any = null

const startPress = (msg: any, e: PointerEvent) => {
  if (e.pointerType === 'mouse' && e.button !== 0) return
  cancelPress()
  pressTimer = setTimeout(() => {
    actionTargetMsg.value = msg
    showMsgActionModal.value = true
  }, 500)
}

const cancelPress = () => {
  if (pressTimer) {
    clearTimeout(pressTimer)
    pressTimer = null
  }
}

const handleActionEdit = (msgId?: number) => {
  if (msgId !== undefined) emit('edit-message', msgId)
}

const handleActionDelete = (msgId?: number) => {
  if (msgId !== undefined) emit('delete-message', msgId)
}

const handleSaveMemory = (countVal: number | null, thresholdVal: number | null) => {
  chatSettings.value.voiceMsgCount = countVal || undefined
  chatSettings.value.voiceSummaryThreshold = thresholdVal || undefined
  showMemoryModal.value = false
}
</script>

<template>
  <transition name="slide-up">
    <div v-if="show" class="voice-call-wrapper">
      
      <!-- 右上角按钮组 -->
      <div class="top-right-actions">
        <!-- 设置按钮 -->
        <div class="action-btn" @click="showMemoryModal = true">
          <svg viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
          </svg>
        </div>
        <!-- 最小化按钮 (精致向下折叠图标)：来电响铃时不允许折叠，必须先接或拒 -->
        <div v-if="status !== 'incoming'" class="action-btn" @click="emit('minimize')">
          <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </div>
      </div>

      <!-- 柔和的日间光影背景 -->
      <div class="ambient-bg" :style="{ backgroundImage: `url(${charAvatar})` }"></div>
      <div class="ambient-overlay"></div>

      <!-- 呼叫中 / 来电中：杂志风/画册式排版 -->
      <transition name="fade">
        <div v-if="status === 'calling' || status === 'incoming'" class="calling-magazine-view">
          <div class="polaroid-wrapper">
            <!-- 音频波纹 -->
            <div class="sound-ripple r-1"></div>
            <div class="sound-ripple r-2"></div>
            <div class="sound-ripple r-3"></div>
            <!-- 方形画册式头像 -->
            <div class="polaroid-avatar" :style="{ backgroundImage: `url(${charAvatar})` }"></div>
          </div>
          <div class="magazine-info">
            <h1 class="magazine-name">{{ charName }}</h1>
            <p class="magazine-status">{{ status === 'incoming' ? 'INCOMING CALL...' : 'WAITING TO CONNECT...' }}</p>
            <p class="magazine-status-zh">{{ status === 'incoming' ? '邀请你语音通话' : '正在等待接听' }}</p>
          </div>
        </div>
      </transition>

      <!-- 通话中：极简状态栏 -->
      <transition name="fade">
        <div v-if="status === 'connected'" class="minimal-header">
          <div class="minimal-avatar" :style="{ backgroundImage: `url(${charAvatar})` }"></div>
          <div class="minimal-info">
            <div class="minimal-name">{{ charName }}</div>
            <div class="minimal-duration">{{ durationStr }}</div>
          </div>
        </div>
      </transition>

      <!-- 聊天区域 -->
      <div class="call-chat-area" ref="msgListRef" v-show="status === 'connected'">
        <div class="chat-list-inner">
          <div v-for="msg in displayMessages" :key="msg.id" class="call-msg-row" :class="msg.type">
            <div 
              class="call-bubble"
              @pointerdown="startPress(msg, $event)"
              @pointerup="cancelPress"
              @pointermove="cancelPress"
              @pointerleave="cancelPress"
              @pointercancel="cancelPress"
              @contextmenu.prevent
            >
              {{ msg.content }}
            </div>
          </div>
          <div v-if="isGenerating" class="call-msg-row left">
            <div class="call-bubble typing">
              <span class="dot"></span><span class="dot"></span><span class="dot"></span>
            </div>
          </div>
        </div>
      </div>

      <!-- 底部控制区 -->
      <div class="bottom-controls-wrapper">
        <!-- 呼叫中：仅挂断 -->
        <transition name="fade">
          <div v-if="status === 'calling'" class="calling-controls">
            <div class="squircle-btn btn-coral" @click="emit('end-call')">
              <svg viewBox="0 0 24 24" width="28" height="28" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" style="transform: rotate(135deg);">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
              </svg>
            </div>
          </div>
        </transition>

        <!-- 来电中：拒接 + 接听 -->
        <transition name="fade">
          <div v-if="status === 'incoming'" class="incoming-controls">
            <div class="incoming-btn-group">
              <div class="squircle-btn btn-coral" @click="emit('decline-call')">
                <svg viewBox="0 0 24 24" width="28" height="28" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" style="transform: rotate(135deg);">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                </svg>
                <span class="btn-label">拒接</span>
              </div>
              <div class="squircle-btn btn-answer" @click="emit('accept-call')">
                <svg viewBox="0 0 24 24" width="28" height="28" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                </svg>
                <span class="btn-label">接听</span>
              </div>
            </div>
          </div>
        </transition>

        <!-- 通话中：高透磨砂控制面板 -->
        <transition name="slide-up-fade">
          <div v-if="status === 'connected'" class="crystal-console">
            <div class="console-grid">
              <div class="squircle-action" @click="emit('regenerate')" :class="{ disabled: isGenerating }">
                <div class="action-icon">
                  <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M21 2v6h-6"></path><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path></svg>
                </div>
                <span>重录</span>
              </div>
              <div class="squircle-action" @click="emit('stop-generate')" :class="{ disabled: !isGenerating }">
                <div class="action-icon">
                  <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="6" width="12" height="12" rx="2" ry="2"></rect></svg>
                </div>
                <span>停止</span>
              </div>
              <div class="squircle-action btn-blue" @click="emit('trigger-api')" :class="{ disabled: isGenerating }">
                <div class="action-icon">
                  <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20V4"></path><polyline points="5 11 12 4 19 11"></polyline></svg>
                </div>
                <span>请求回复</span>
              </div>
              <div class="squircle-action btn-coral" @click="emit('end-call')">
                <div class="action-icon">
                  <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" style="transform: rotate(135deg);"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                </div>
                <span>挂断</span>
              </div>
            </div>
            <div class="input-neumorphic">
              <input 
                type="text" 
                class="neu-input" 
                placeholder="在此输入您的回复..." 
                v-model="inputMessage"
                @keyup.enter="handleSend"
              />
              <div class="neu-send-btn" @click="handleSend" :class="{ active: inputMessage.trim().length > 0 }">
                <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
              </div>
            </div>
          </div>
        </transition>
      </div>

      <ChatVoiceCallMsgActionModal
        :visible="showMsgActionModal"
        :message-id="actionTargetMsg?.id"
        :preview-content="actionTargetMsg?.content"
        @close="showMsgActionModal = false"
        @edit="handleActionEdit"
        @delete="handleActionDelete"
      />

      <ChatVoiceMemoryModal
        v-model:visible="showMemoryModal"
        :initial-value="chatSettings.voiceMsgCount"
        :initial-threshold="chatSettings.voiceSummaryThreshold"
        :current-summary="currentSummary"
        @save="handleSaveMemory"
      />
    </div>
  </transition>
</template>

<style scoped>
.voice-call-wrapper {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  z-index: 1000;
  background: #f0f2f5;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* 右上角按钮组 */
.top-right-actions {
  position: absolute;
  top: 20px;
  right: 24px;
  z-index: 20;
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

/* 操作按钮 (极简无背景、纯图标) */
.action-btn {
  width: 32px;
  height: 32px;
  background: transparent;
  border: none;
  display: flex;
  align-items: flex-start;
  justify-content: flex-end;
  color: #4a5568;
  cursor: pointer;
  transition: transform 0.2s cubic-bezier(0.2, 0.8, 0.2, 1);
}
.action-btn:active {
  transform: scale(0.85);
}

/* 柔和的日间光影背景 */
.ambient-bg {
  position: absolute;
  top: -10%; left: -10%; right: -10%; bottom: -10%;
  background-size: cover;
  background-position: center;
  filter: blur(40px) saturate(150%);
  opacity: 0.6;
  z-index: 1;
}
.ambient-overlay {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background: linear-gradient(135deg, rgba(255,255,255,0.7) 0%, rgba(240,242,245,0.9) 100%);
  z-index: 2;
}

/* 呼叫中：杂志风排版 */
.calling-magazine-view {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  z-index: 3;
  display: flex;
  flex-direction: column;
  padding: 12vh 10vw 0;
}
.polaroid-wrapper {
  position: relative;
  width: 65vw;
  height: 65vw;
  max-width: 320px;
  max-height: 320px;
  margin-bottom: 40px;
  align-self: center;
}
.polaroid-avatar {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background-size: cover;
  background-position: center;
  border-radius: 20px;
  box-shadow: 0 20px 40px rgba(0,0,0,0.1), inset 0 0 0 1px rgba(255,255,255,0.5);
  z-index: 2;
}
.sound-ripple {
  position: absolute;
  top: 50%; left: 50%;
  width: 100%; height: 100%;
  border-radius: 24px;
  border: 2px solid rgba(255,255,255,0.8);
  transform: translate(-50%, -50%);
  z-index: 1;
}
.r-1 { animation: soundRipple 2.5s infinite cubic-bezier(0.2, 0.8, 0.2, 1); }
.r-2 { animation: soundRipple 2.5s infinite cubic-bezier(0.2, 0.8, 0.2, 1) 0.8s; }
.r-3 { animation: soundRipple 2.5s infinite cubic-bezier(0.2, 0.8, 0.2, 1) 1.6s; }
@keyframes soundRipple {
  0% { transform: translate(-50%, -50%) scale(1); opacity: 0.8; }
  100% { transform: translate(-50%, -50%) scale(1.5); opacity: 0; }
}

.magazine-info {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}
.magazine-name {
  font-size: 36px;
  font-weight: 800;
  color: #2c3e50;
  letter-spacing: -0.5px;
  margin: 0 0 8px 0;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
}
.magazine-status {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 2px;
  color: #8395a7;
  margin: 0 0 4px 0;
}
.magazine-status-zh {
  font-size: 15px;
  color: #576574;
  margin: 0;
}

/* 通话中极简状态栏 */
.minimal-header {
  position: relative; z-index: 3;
  display: flex; align-items: center; padding: 20px 24px;
  background: linear-gradient(to bottom, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0) 100%);
}
.minimal-avatar {
  width: 48px; height: 48px;
  border-radius: 14px;
  background-size: cover; background-position: center;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  margin-right: 16px;
}
.minimal-info { display: flex; flex-direction: column; }
.minimal-name { font-size: 17px; font-weight: 700; color: #2d3748; line-height: 1.2;}
.minimal-duration { font-size: 13px; font-weight: 600; color: #718096; margin-top: 4px; }

/* 聊天区域 */
.call-chat-area {
  position: relative;
  z-index: 3;
  flex: 1;
  padding: 0 20px;
  overflow-y: auto;
  scroll-behavior: smooth;
  mask-image: linear-gradient(to bottom, transparent, black 5%, black 95%, transparent);
  -webkit-mask-image: linear-gradient(to bottom, transparent, black 5%, black 95%, transparent);
}
.chat-list-inner {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 20px 0 220px; /* 留出底部控制台空间 */
}
.call-msg-row {
  display: flex;
  width: 100%;
}
.call-msg-row.right {
  justify-content: flex-end;
}
.call-msg-row.left {
  justify-content: flex-start;
}

.call-bubble {
  max-width: 82%;
  padding: 14px 18px;
  border-radius: 20px;
  font-size: 15px;
  line-height: 1.6;
  word-break: break-word;
  box-shadow: 0 4px 12px rgba(0,0,0,0.03);
  /* 长按唤出菜单，需屏蔽系统自带的选中与长按气泡 */
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
}
.call-msg-row.right .call-bubble {
  background: #6b9080;
  color: white;
  border-bottom-right-radius: 6px;
}
.call-msg-row.left .call-bubble {
  background: rgba(255,255,255,0.9);
  backdrop-filter: blur(10px);
  color: #2d3748;
  border-bottom-left-radius: 6px;
}

.typing {
  opacity: 0.8; display: flex; align-items: center; gap: 4px; padding: 16px 20px;
}
.dot {
  width: 6px; height: 6px;
  background: #a0aec0;
  border-radius: 50%;
  animation: jump 1.4s infinite ease-in-out both;
}
.dot:nth-child(1) { animation-delay: -0.32s; }
.dot:nth-child(2) { animation-delay: -0.16s; }
@keyframes jump {
  0%, 80%, 100% { transform: translateY(0); }
  40% { transform: translateY(-4px); }
}

/* 底部控制区 */
.bottom-controls-wrapper {
  position: absolute;
  bottom: 0; left: 0; right: 0;
  z-index: 10;
  padding: 0 12px 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.calling-controls {
  margin-bottom: 12px;
}

.squircle-btn {
  width: 60px; height: 60px;
  border-radius: 20px;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
  color: white;
  box-shadow: 0 8px 16px rgba(0,0,0,0.1);
}
.squircle-btn:active { transform: scale(0.92); }

/* 来电中：拒接与接听并排 */
.incoming-controls {
  margin-bottom: 12px;
  width: 100%;
}
.incoming-btn-group {
  display: flex;
  justify-content: center;
  gap: 56px;
}
.incoming-btn-group .squircle-btn {
  flex-direction: column;
  gap: 4px;
  width: 72px;
  height: 72px;
}
.btn-label {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.5px;
}
.squircle-btn.btn-answer {
  background: #6b9080;
  box-shadow: 0 4px 12px rgba(107, 144, 128, 0.3);
  animation: answerPulse 1.6s infinite ease-in-out;
}
@keyframes answerPulse {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-4px); }
}

.crystal-console {
  width: 100%;
  max-width: 500px;
  background: rgba(255, 255, 255, 0.75);
  backdrop-filter: blur(25px);
  -webkit-backdrop-filter: blur(25px);
  border-radius: 24px;
  padding: 16px 12px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.05), inset 0 1px 0 rgba(255,255,255,0.8);
  display: flex; flex-direction: column; gap: 12px;
}

.console-grid {
  display: flex;
  justify-content: space-around;
  padding: 0 8px;
}

.squircle-action {
  display: flex; flex-direction: column; align-items: center; gap: 6px;
  cursor: pointer;
  transition: all 0.2s;
  width: 48px; /* 限制按钮最大宽度，避免撑开 */
}
.squircle-action.disabled { opacity: 0.3; pointer-events: none; }

.action-icon {
  width: 48px; height: 48px;
  border-radius: 16px;
  background: rgba(255,255,255,0.9);
  display: flex; align-items: center; justify-content: center;
  color: #4a5568;
  box-shadow: 0 2px 8px rgba(0,0,0,0.04);
  transition: all 0.2s;
}
.squircle-action:active .action-icon { transform: scale(0.92); }

.squircle-action span {
  font-size: 11px; font-weight: 600; color: #718096; white-space: nowrap;
}

.btn-coral .action-icon, .squircle-btn.btn-coral {
  background: #e26d5c; color: white;
  box-shadow: 0 4px 12px rgba(226, 109, 92, 0.25);
}
.btn-coral span { color: #e26d5c; }

.btn-blue .action-icon {
  background: #6b9080; color: white;
  box-shadow: 0 4px 12px rgba(107, 144, 128, 0.25);
}
.btn-blue span { color: #6b9080; }

.input-neumorphic {
  display: flex; align-items: center;
  background: #f0f2f5;
  border-radius: 18px;
  padding: 6px 6px 6px 16px;
  box-shadow: inset 0 2px 5px rgba(0,0,0,0.04), 0 1px 0 rgba(255,255,255,1);
}
.neu-input {
  flex: 1; background: transparent; border: none; outline: none;
  font-size: 15px; color: #2d3748; padding: 8px 0;
}
.neu-input::placeholder { color: #a0aec0; font-weight: 500; }

.neu-send-btn {
  width: 44px; height: 44px;
  border-radius: 16px;
  background: #e2e8f0; color: #a0aec0;
  display: flex; align-items: center; justify-content: center;
  transition: all 0.2s; cursor: pointer;
}
.neu-send-btn.active {
  background: #6b9080; color: white;
  box-shadow: 0 4px 12px rgba(107, 144, 128, 0.3);
}
.neu-send-btn:active { transform: scale(0.92); }

/* 动画过渡 */
.slide-up-enter-active,
.slide-up-leave-active {
  transition: transform 0.4s cubic-bezier(0.2, 0.8, 0.2, 1);
}
.slide-up-enter-from,
.slide-up-leave-to {
  transform: translateY(100%);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.slide-up-fade-enter-active,
.slide-up-fade-leave-active {
  transition: all 0.4s cubic-bezier(0.2, 0.8, 0.2, 1);
}
.slide-up-fade-enter-from,
.slide-up-fade-leave-to {
  transform: translateY(20px);
  opacity: 0;
}
</style>
