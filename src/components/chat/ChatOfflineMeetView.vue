/* WARNING: 本项目专属"粘人精"，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue'
import { useChatState } from '../../composables/useChatState'
import { useChatRoomAPI } from '../../composables/useChatRoomAPI'
import { useChatAuth } from '../../composables/useChatAuth'
import './ChatRoomView.css'

const emit = defineEmits<{
  (e: 'back'): void
}>()

const { selectedChat, myProfile, mockChats, buildChatMessages, showNotification } = useChatState()

const isRoomActive = ref(true)
const inputMessage = ref('')
const messageAreaRef = ref<HTMLElement | null>(null)

const displayMessages = computed(() => {
  if (!selectedChat.value?.messages) return []
  return selectedChat.value.messages.filter((m: any) =>
    m.isOfflineMeetMsg && (m.type === 'left' || m.type === 'right' || m.type === 'system')
  )
})

function showToast(msg: string) {
  // 线下页简单提示
  console.log('[线下见面]', msg)
}

function updatePreviewAndTime(content: string) {
  if (!selectedChat.value) return
  selectedChat.value.preview = content
  const now = new Date()
  selectedChat.value.time = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

function saveCustomContacts() {
  if (!selectedChat.value || selectedChat.value.id === 1) return
  const { currentChatUserId } = useChatAuth()
  const contactsKey = currentChatUserId.value ? `clingy_custom_contacts_${currentChatUserId.value}` : 'clingy_custom_contacts'
  const savedStr = localStorage.getItem(contactsKey)
  if (savedStr) {
    const contacts = JSON.parse(savedStr)
    const index = contacts.findIndex((c: any) => c.id === selectedChat.value.id)
    if (index !== -1) {
      contacts[index].messages = selectedChat.value.messages
      contacts[index].preview = selectedChat.value.preview
      contacts[index].time = selectedChat.value.time
      localStorage.setItem(contactsKey, JSON.stringify(contacts))
    }
  }
}

async function scrollToBottom() {
  await nextTick()
  if (messageAreaRef.value) {
    messageAreaRef.value.scrollTop = messageAreaRef.value.scrollHeight
  }
}

const getOfflineMeetMode = () => 'separate' as const

const {
  isGenerating,
  triggerAPI,
  handleStopCall,
  handleRegenerate
} = useChatRoomAPI(
  mockChats,
  selectedChat,
  myProfile,
  buildChatMessages,
  showNotification,
  saveCustomContacts,
  scrollToBottom,
  isRoomActive,
  undefined,
  getOfflineMeetMode
)

const showExtensionPanel = ref(false)

const handleRegenerateClick = () => {
  handleRegenerate(showExtensionPanel, showToast)
}

const handleSend = async () => {
  const text = inputMessage.value.trim()
  if (!text || !selectedChat.value || isGenerating.value) return

  if (!selectedChat.value.messages) {
    selectedChat.value.messages = []
  }

  selectedChat.value.messages.push({
    id: Date.now(),
    type: 'right',
    content: text,
    isOfflineMeetMsg: true
  })

  inputMessage.value = ''
  updatePreviewAndTime(text)
  saveCustomContacts()
  await scrollToBottom()
  await triggerAPI()
}

onMounted(() => {
  scrollToBottom()
})
</script>

<template>
  <div class="offline-meet-container" v-if="selectedChat">
    <!-- 顶部半透明导航 -->
    <header class="offline-meet-header">
      <button class="offline-back-btn" @click="emit('back')">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="15 18 9 12 15 6"></polyline>
        </svg>
        <span>结束见面</span>
      </button>
      <div class="offline-header-title">线下互动录</div>
      <div class="offline-header-right"></div>
    </header>

    <!-- 滚动区域 -->
    <div class="offline-meet-messages" ref="messageAreaRef">
      <div class="offline-meet-scene-hint">
        「 你们正处于线下面对面的真实接触中 」<br/>
        <span style="opacity: 0.7; font-size: 11px;">地点保持模糊，由你或角色共同决定氛围与节奏</span>
      </div>

      <div v-if="displayMessages.length === 0" class="offline-empty-hint">
        暂无记录。发送第一句话，开始你们的故事。
      </div>

      <!-- 流式段落排版 -->
      <div class="offline-novel-flow">
        <div
          v-for="msg in displayMessages"
          :key="msg.id"
          class="offline-msg-row"
          :class="{
            'is-user': msg.type === 'right',
            'is-char': msg.type === 'left',
            'is-narration': msg.type === 'system'
          }"
        >
          <template v-if="msg.type === 'system'">
            <div class="offline-narration">—— {{ msg.content }} ——</div>
          </template>
          <template v-else-if="msg.type === 'right'">
            <div class="offline-paragraph user-paragraph">
              {{ msg.content }}
            </div>
          </template>
          <template v-else>
            <div class="offline-paragraph char-paragraph">
              {{ msg.content }}
            </div>
          </template>
        </div>

        <div v-if="selectedChat.isTyping" class="offline-typing-indicator">
          对方正在回应<span class="dot">.</span><span class="dot">.</span><span class="dot">.</span>
        </div>
      </div>
    </div>

    <!-- 底部悬浮输入区 -->
    <footer class="offline-meet-footer">
      <div class="offline-input-wrapper">
        <textarea
          v-model="inputMessage"
          class="offline-input"
          placeholder="描述你的动作，或说点什么..."
          rows="1"
          @keydown.enter.exact.prevent="handleSend"
          oninput="this.style.height = '';this.style.height = Math.min(this.scrollHeight, 120) + 'px'"
        ></textarea>
        
        <div class="offline-action-group">
          <button
            v-if="isGenerating"
            class="offline-icon-btn stop"
            @click="handleStopCall"
            title="停止生成"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"></rect></svg>
          </button>
          <button
            v-else
            class="offline-icon-btn send"
            :disabled="!inputMessage.trim()"
            @click="handleSend"
            title="发送"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
          </button>
          <button
            class="offline-icon-btn regen"
            :disabled="isGenerating"
            @click="handleRegenerateClick"
            title="重新生成"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
          </button>
        </div>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.offline-meet-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: #ffffff; /* 纯净白色背景 */
  position: relative;
}

.offline-meet-header {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
  z-index: 10;
  position: sticky;
  top: 0;
}

.offline-back-btn {
  background: transparent;
  border: none;
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 15px;
  cursor: pointer;
  padding: 4px 8px 4px 0;
  transition: opacity 0.2s;
}

.offline-back-btn:hover {
  opacity: 0.7;
}

.offline-header-title {
  font-size: 16px;
  font-weight: 500;
  color: var(--text-primary);
  letter-spacing: 1px;
}

.offline-header-right {
  width: 60px; /* 占位以保证标题居中 */
}

.offline-meet-messages {
  flex: 1;
  overflow-y: auto;
  padding: 0 20px 100px; /* 底部留白给悬浮输入框 */
  scroll-behavior: smooth;
}

.offline-meet-scene-hint {
  text-align: center;
  margin: 30px 0 40px;
  font-size: 13px;
  color: var(--text-tertiary);
  line-height: 1.8;
  font-family: serif;
  letter-spacing: 0.5px;
}

.offline-empty-hint {
  text-align: center;
  color: var(--text-tertiary);
  font-size: 13px;
  margin-top: 60px;
  font-style: italic;
}

.offline-novel-flow {
  display: flex;
  flex-direction: column;
  gap: 24px;
  max-width: 600px;
  margin: 0 auto;
}

.offline-msg-row {
  width: 100%;
}

.offline-paragraph {
  font-size: 15px;
  line-height: 1.8;
  white-space: pre-wrap;
  word-break: break-word;
  color: #333;
}

.user-paragraph {
  background: rgba(0, 122, 255, 0.06);
  padding: 16px 20px;
  border-radius: 12px;
  border-left: 3px solid rgba(0, 122, 255, 0.4);
  color: #444;
}

.char-paragraph {
  padding: 0 8px;
  color: #222;
  text-indent: 2em; /* 首行缩进营造小说感 */
}

.offline-narration {
  text-align: center;
  font-size: 13px;
  color: var(--text-tertiary);
  margin: 16px 0;
  opacity: 0.7;
}

.offline-typing-indicator {
  font-size: 13px;
  color: var(--text-tertiary);
  text-align: center;
  margin-top: 10px;
  font-style: italic;
}

.dot {
  animation: typing-dot 1.4s infinite ease-in-out both;
}
.dot:nth-child(1) { animation-delay: -0.32s; }
.dot:nth-child(2) { animation-delay: -0.16s; }

@keyframes typing-dot {
  0%, 80%, 100% { opacity: 0; }
  40% { opacity: 1; }
}

/* 底部悬浮输入 */
.offline-meet-footer {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 16px 20px 24px;
  background: linear-gradient(to top, #ffffff 60%, rgba(255, 255, 255, 0));
  pointer-events: none; /* 让渐变层透传点击 */
}

.offline-input-wrapper {
  max-width: 600px;
  margin: 0 auto;
  background: #fff;
  border-radius: 24px;
  padding: 8px 16px;
  display: flex;
  align-items: flex-end;
  gap: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.06);
  border: 1px solid rgba(0, 0, 0, 0.04);
  pointer-events: auto; /* 恢复内部元素的点击 */
}

.offline-input {
  flex: 1;
  border: none;
  background: transparent;
  padding: 8px 0;
  font-size: 15px;
  line-height: 1.5;
  max-height: 120px;
  resize: none;
  outline: none;
  color: var(--text-primary);
}

.offline-input::placeholder {
  color: #bbb;
}

.offline-action-group {
  display: flex;
  gap: 8px;
  padding-bottom: 4px;
}

.offline-icon-btn {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
}

.offline-icon-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.offline-icon-btn.send {
  background: var(--accent-color, #007aff);
  color: #fff;
}

.offline-icon-btn.send:not(:disabled):hover {
  transform: scale(1.05);
}

.offline-icon-btn.stop {
  background: #ff4d4f;
  color: #fff;
}

.offline-icon-btn.regen {
  background: #f0f0f0;
  color: #666;
}

.offline-icon-btn.regen:not(:disabled):hover {
  background: #e4e4e4;
}
</style>
