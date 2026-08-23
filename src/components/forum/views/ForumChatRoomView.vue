/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { ref, nextTick, onMounted } from 'vue'
import type { ForumUser, ForumDirectMessage } from '../../../types/forum'
import ForumHeader from '../components/ForumHeader.vue'
import ForumAvatar from '../components/ForumAvatar.vue'

const props = defineProps<{
  targetUser: ForumUser
  messages: ForumDirectMessage[]
}>()

const emit = defineEmits<{
  (e: 'back'): void
  (e: 'click-user', user: ForumUser): void
  (e: 'send', content: string): void
}>()

const inputContent = ref('')
const messageContainer = ref<HTMLElement | null>(null)

const scrollToBottom = async () => {
  await nextTick()
  if (messageContainer.value) {
    messageContainer.value.scrollTop = messageContainer.value.scrollHeight
  }
}

onMounted(() => {
  scrollToBottom()
})

const handleSend = () => {
  const text = inputContent.value.trim()
  if (!text) return
  emit('send', text)
  inputContent.value = ''
  scrollToBottom()
}
</script>

<template>
  <div class="forum-chatroom-view">
    <ForumHeader :title="targetUser.name" show-back @back="emit('back')">
      <template #right>
        <ForumAvatar
          :src="targetUser.avatar"
          :name="targetUser.name"
          :verified="targetUser.verified"
          size="sm"
          clickable
          @click="emit('click-user', targetUser)"
        />
      </template>
    </ForumHeader>

    <!-- 消息对话流 -->
    <div ref="messageContainer" class="messages-scroll-body">
      <!-- 顶部对方资料卡片引导 -->
      <div class="chat-intro-card">
        <ForumAvatar
          :src="targetUser.avatar"
          :name="targetUser.name"
          :verified="targetUser.verified"
          size="lg"
        />
        <h3 class="intro-name">{{ targetUser.name }}</h3>
        <p class="intro-handle">@{{ targetUser.handle }}</p>
        <p class="intro-bio">{{ targetUser.bio || '暂无个人简介' }}</p>
      </div>

      <!-- 消息泡泡列表 -->
      <div
        v-for="msg in messages"
        :key="msg.id"
        class="message-row"
        :class="{ 'is-self': msg.isSelf }"
      >
        <div class="bubble-wrapper">
          <div class="message-bubble">
            {{ msg.content }}
          </div>
          <span class="message-time">{{ msg.createdAt }}</span>
        </div>
      </div>
    </div>

    <!-- 底部输入栏 -->
    <div class="chat-input-bar">
      <input
        v-model="inputContent"
        type="text"
        placeholder="发送私信..."
        class="chat-input"
        @keyup.enter="handleSend"
      />
      <button
        class="send-btn"
        :disabled="!inputContent.trim()"
        type="button"
        @click="handleSend"
      >
        发送
      </button>
    </div>
  </div>
</template>

<style scoped>
.forum-chatroom-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--sys-bg-primary, #f5f5f7);
}

.messages-scroll-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  -webkit-overflow-scrolling: touch;
}

.chat-intro-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 24px 16px 16px;
  text-align: center;
  border-bottom: 1px solid var(--border-color, rgba(0, 0, 0, 0.05));
  margin-bottom: 8px;
}

.intro-name {
  font-size: 16px;
  font-weight: 700;
  margin-top: 8px;
  color: var(--text-primary, #222222);
}

.intro-handle {
  font-size: 12px;
  color: var(--text-tertiary, #888888);
  margin-top: 2px;
}

.intro-bio {
  font-size: 13px;
  color: var(--text-secondary, #666666);
  margin-top: 6px;
  max-width: 260px;
}

.message-row {
  display: flex;
  justify-content: flex-start;
}

.message-row.is-self {
  justify-content: flex-end;
}

.bubble-wrapper {
  max-width: 75%;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 3px;
}

.message-row.is-self .bubble-wrapper {
  align-items: flex-end;
}

.message-bubble {
  padding: 10px 14px;
  border-radius: 18px;
  font-size: 14px;
  line-height: 1.45;
  word-break: break-word;
  background: var(--sys-bg-secondary, #ffffff);
  color: var(--text-primary, #222222);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
}

.message-row.is-self .message-bubble {
  background: var(--text-primary, #111111);
  color: var(--sys-bg-secondary, #ffffff);
}

.message-time {
  font-size: 10.5px;
  color: var(--text-tertiary, #999999);
  padding: 0 4px;
}

.chat-input-bar {
  background: var(--sys-bg-secondary, #ffffff);
  border-top: 1px solid var(--border-color, rgba(0, 0, 0, 0.08));
  padding: 10px 14px;
  padding-bottom: max(10px, env(safe-area-inset-bottom));
  display: flex;
  align-items: center;
  gap: 10px;
}

.chat-input {
  flex: 1;
  border: 1px solid var(--border-color, rgba(0, 0, 0, 0.1));
  border-radius: 999px;
  padding: 8px 14px;
  font-size: 14px;
  background: var(--sys-bg-tertiary, #f0f2f5);
  color: var(--text-primary, #222222);
  outline: none;
}

.chat-input:focus {
  border-color: var(--accent-color, #2b7de9);
  background: var(--sys-bg-secondary, #ffffff);
}

.send-btn {
  background: var(--text-primary, #111111);
  color: var(--sys-bg-secondary, #ffffff);
  border: 0;
  border-radius: 999px;
  padding: 7px 16px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.15s ease, transform 0.12s ease;
}

.send-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.send-btn:not(:disabled):active {
  transform: scale(0.94);
}
</style>
