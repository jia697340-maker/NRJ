/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { reactive, ref, nextTick, onMounted } from 'vue'
import type { ForumUser, ForumDirectMessage } from '../../../types/forum'
import ForumHeader from '../components/ForumHeader.vue'
import ForumAvatar from '../components/ForumAvatar.vue'

const props = defineProps<{
  targetUser: ForumUser
  messages: ForumDirectMessage[]
  busy?: boolean
  error?: string
  friendStatus?: 'none' | 'outgoing' | 'incoming' | 'friends'
  allowFriend?: boolean
}>()

const emit = defineEmits<{
  (e: 'back'): void
  (e: 'click-user', user: ForumUser): void
  (e: 'send', content: string): void
  (e: 'generate-reply', timing: 'immediate' | 'presence-aware'): void
  (e: 'adjust-pending', messageId: string, minutes?: number): void
  (e: 'friend-action'): void
}>()

const inputContent = ref('')
const messageContainer = ref<HTMLElement | null>(null)
const presenceAware = ref(false)
const delayDrafts = reactive<Record<string, number>>({})

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
        <button v-if="allowFriend!==false&&friendStatus!=='friends'" class="friend-chat-btn" :disabled="busy||friendStatus==='incoming'" @click="emit('friend-action')">{{friendStatus==='outgoing'?'生成申请答复':'好友动向'}}</button>
        <button class="generate-chat-btn" :disabled="busy" @click="emit('generate-reply',presenceAware?'presence-aware':'immediate')">{{busy?'生成中':'生成回复'}}</button>
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
          <div v-if="msg.pendingReply" class="pending-message-actions"><button type="button" @click="emit('adjust-pending',msg.id)">立即显示</button><input v-model.number="delayDrafts[msg.id]" type="number" min="1" max="1440" placeholder="10"><span>分钟</span><button type="button" @click="emit('adjust-pending',msg.id,delayDrafts[msg.id]||10)">修改</button></div>
        </div>
      </div>
    </div>

    <!-- 底部输入栏 -->
    <div class="chat-input-bar">
      <span v-if="error" class="chat-error">{{error}}</span>
      <label class="presence-toggle"><input v-model="presenceAware" type="checkbox"><span>在线状态</span></label>
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
.generate-chat-btn{height:27px;border:0;border-radius:999px;background:var(--sys-bg-tertiary,#eef0f2);color:var(--text-secondary,#666);padding:0 9px;font-size:10.5px}.generate-chat-btn:disabled{opacity:.4}.chat-error{position:absolute;left:12px;right:12px;bottom:100%;overflow:hidden;background:color-mix(in srgb,#d44c4c 8%,var(--sys-bg-secondary,#fff));color:#c24a4a;padding:5px 8px;font-size:10px;white-space:nowrap;text-overflow:ellipsis}.chat-input-bar{position:relative}
.friend-chat-btn{height:27px;border:0;background:transparent;color:var(--accent-color,#576b95);padding:0 6px;font-size:9.5px}.friend-chat-btn:disabled{opacity:.4}
.presence-toggle{display:flex;flex:0 0 auto;align-items:center;gap:3px;color:var(--text-secondary,#777);font-size:9px}.presence-toggle input{width:13px;height:13px;margin:0;accent-color:var(--accent-color,#576b95)}.pending-message-actions{display:flex;align-items:center;gap:4px;color:var(--text-tertiary,#999);font-size:9px}.pending-message-actions button{border:0;background:transparent;color:var(--accent-color,#576b95);padding:0 3px;font-size:9.5px}.pending-message-actions input{box-sizing:border-box;width:38px;height:20px;border:1px solid var(--border-color,#ddd);border-radius:5px;background:var(--sys-bg-primary,#f5f5f7);color:var(--text-primary,#222);padding:0 3px;font-size:9px}
</style>
