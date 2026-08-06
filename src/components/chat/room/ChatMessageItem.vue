/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import ChatImageBubble from '../bubbles/ChatImageBubble.vue'
import ChatVoiceBubble from '../bubbles/ChatVoiceBubble.vue'
import ChatTransferBubble from '../bubbles/ChatTransferBubble.vue'
import ChatCallRecordBubble from '../bubbles/ChatCallRecordBubble.vue'
import { chatSettings } from '../../../store'

const props = defineProps<{
  msg: any
  index: number
  displayMessages: any[]
  selectedChat: any
  myProfile: any
  selectionMode: 'recall' | 'mark' | 'general' | null
  isSelected: boolean
  justMarked: boolean
  expandedImageIds: Set<number>
  expandedVoiceIds: Set<number>
  currentMediaThumb: string | null
  voicePlayingId: number | null
  isVoiceSynthesizing: boolean
}>()

const emit = defineEmits<{
  (e: 'click-message', msgId: number): void
  (e: 'toggle-selection', msgId: number): void
  (e: 'touch-start', msgId: number): void
  (e: 'touch-end'): void
  (e: 'touch-move', event: TouchEvent): void
  (e: 'toggle-image-text', msgId: number): void
  (e: 'toggle-voice-text', msgId: number): void
  (e: 'play-voice', msgId: number, text: string): void
  (e: 'handle-left-transfer-click', msg: any): void
  (e: 'handle-emoji-click', url: string | undefined, name: string | undefined): void
  (e: 'view-recalled-message', content: string): void
  (e: 'cancel-image-generation', msgId: number): void
}>()

const shouldShowAvatar = (msg: any) => {
  if (msg.type !== 'left' && msg.type !== 'right') return false
  const style = chatSettings.avatarDisplayStyle || 'all'
  if (style === 'none') return false
  if (style === 'all') return true
  if (style === 'user_only') return msg.type === 'right'
  if (style === 'character_only') return msg.type === 'left'
  return true
}

const shouldShowName = (msg: any) => {
  if (msg.type !== 'left' && msg.type !== 'right') return false
  const style = chatSettings.nameDisplayStyle || 'all'
  if (style === 'none') return false
  if (style === 'all') return true
  if (style === 'user_only') return msg.type === 'right'
  if (style === 'character_only') return msg.type === 'left'
  return true
}

const formatMsgTime = (timestamp: number) => {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  if (isNaN(date.getTime())) return ''
  const h = String(date.getHours()).padStart(2, '0')
  const m = String(date.getMinutes()).padStart(2, '0')
  const s = String(date.getSeconds()).padStart(2, '0')
  if (chatSettings.timeDisplayStyle === 'hm') {
    return `${h}:${m}`
  } else if (chatSettings.timeDisplayStyle === 'hms') {
    return `${h}:${m}:${s}`
  }
  return ''
}
</script>

<template>
  <!-- 独立块模式下的思考过程（彻底移出 message-row，独立一行紧贴左侧） -->
  <div v-if="!chatSettings.cotInSameBubble && msg.thinking && msg.type === 'left'" class="thinking-standalone-wrapper">
    <div class="thinking-standalone">
      <details>
        <summary class="thinking-summary magazine-slogan">Code. Love. Be.</summary>
        <div class="thinking-content">{{ msg.thinking }}</div>
      </details>
    </div>
  </div>

  <div class="message-row" :class="[msg.type, { 'is-multi-select': selectionMode !== null, 'is-marked': msg.isMarked }]" :style="msg.costTime ? { marginBottom: '4px' } : {}" @click="msg.type !== 'time' ? emit('click-message', msg.id) : null">
    
    <!-- 闪烁的小星星动画 -->
    <transition name="star-pop">
      <div v-if="justMarked" class="mark-star-anim">
        <svg viewBox="0 0 24 24" width="28" height="28" stroke="#fbbf24" fill="#fcd34d" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
        </svg>
      </div>
    </transition>

    <!-- 多选框 -->
    <transition name="slide-checkbox">
      <div v-if="selectionMode !== null && (msg.type === 'left' || msg.type === 'right' || msg.type === 'system')" class="msg-checkbox" @click.stop="emit('toggle-selection', msg.id)">
        <div class="checkbox-circle" :class="{ checked: isSelected }">
          <svg v-if="isSelected" viewBox="0 0 24 24" width="14" height="14" stroke="white" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
        </div>
      </div>
    </transition>

    <div v-if="msg.type === 'time'" class="msg-time">{{ msg.content }}</div>
    
    <template v-else-if="msg.type === 'system'">
       <div class="msg-recalled-container"
            @touchstart="emit('touch-start', msg.id)"
            @touchend="emit('touch-end')"
            @touchmove="emit('touch-move', $event)"
            @contextmenu.prevent>
          <span class="msg-recalled-text" style="background: var(--bg-secondary); padding: 8px 12px; border-radius: 8px; color: var(--text-secondary); max-width: 80%;">{{ msg.content }}</span>
       </div>
    </template>
    
    <template v-else-if="msg.type === 'left'">
      <template v-if="msg.isRecalled">
        <div class="msg-recalled-container" 
             @click="selectionMode === null && emit('view-recalled-message', msg.content)"
             @touchstart="emit('touch-start', msg.id)"
             @touchend="emit('touch-end')"
             @touchmove="emit('touch-move', $event)"
             @contextmenu.prevent>
          <span class="msg-recalled-text">{{ selectedChat?.name || '对方' }}撤回了一条消息</span>
        </div>
      </template>
      <template v-else>
        <div class="msg-avatar-col" v-if="shouldShowAvatar(msg)">
          <div class="msg-avatar" :style="[
            selectedChat?.avatarUrl ? { backgroundImage: `url(${selectedChat.avatarUrl})`, backgroundSize: 'cover', backgroundPosition: 'center', color: 'transparent' } : {}
          ]">{{ selectedChat?.avatarText || '伴' }}</div>
          <div v-if="chatSettings.timeDisplayStyle !== 'none' && chatSettings.timeDisplayPosition === 'avatar_bottom'" class="msg-time-inline">
            {{ formatMsgTime(msg.timestamp || msg.id) }}
          </div>
        </div>
        <div class="msg-content-col">
          <div v-if="shouldShowName(msg) || (chatSettings.timeDisplayStyle !== 'none' && chatSettings.timeDisplayPosition === 'name_side')" class="msg-name">
            <span v-if="shouldShowName(msg)" class="msg-name-text">@{{ selectedChat?.name }}</span>
            <span v-if="chatSettings.timeDisplayStyle !== 'none' && chatSettings.timeDisplayPosition === 'name_side'" class="msg-time-inline-side">
              {{ formatMsgTime(msg.timestamp || msg.id) }}
            </span>
          </div>
          
          <!-- AI 发来的图片 -->
          <template v-if="msg.imageData">
            <div v-if="msg.isGeneratingImage" class="bubble bubble-left chat-message-image-generating">
              <div class="generating-spinner-container">
                <div class="generating-spinner"></div>
              </div>
              <div class="generating-text">{{ msg.content || '正在构思画面...' }}</div>
              <button @click="emit('cancel-image-generation', msg.id)" class="generating-cancel-btn">取消生成</button>
            </div>
            <ChatImageBubble
              v-else
              :msg="msg"
              :expandedImageIds="expandedImageIds"
              :currentMediaThumb="currentMediaThumb"
              @toggle-image-text="emit('toggle-image-text', $event)"
              @touch-start="emit('touch-start', $event)"
              @touch-end="emit('touch-end')"
              @touch-move="emit('touch-move', $event)"
            />
            <details v-if="!msg.isGeneratingImage && msg.imageData?.prompt" style="max-width:200px;font-size:11px;color:var(--text-secondary);margin-top:4px" @click.stop>
              <summary>查看中英提示词</summary>
              <div style="white-space:pre-wrap;word-break:break-word">中文：{{ msg.imageData.sourceText || msg.imageData.text }}<br />英文：{{ msg.imageData.prompt }}<br v-if="msg.imageData.negativePrompt" />负面：{{ msg.imageData.negativePrompt }}</div>
            </details>
          </template>

          <!-- 语音通话记录气泡 (AI端) -->
          <template v-else-if="msg.callData">
            <ChatCallRecordBubble
              :msg="msg"
              direction="left"
              @touch-start="emit('touch-start', $event)"
              @touch-end="emit('touch-end')"
              @touch-move="emit('touch-move', $event)"
            />
          </template>

          <!-- AI 发来的语音气泡 -->
          <template v-else-if="msg.voiceData">
            <ChatVoiceBubble
              :msg="msg"
              direction="left"
              :autoTranscribeVoice="chatSettings.autoTranscribeVoice ?? false"
              :expandedVoiceIds="expandedVoiceIds"
              :playing-id="voicePlayingId"
              :is-synthesizing="isVoiceSynthesizing"
              @toggle-voice-text="emit('toggle-voice-text', $event)"
              @play-voice="(id, text) => emit('play-voice', id, text)"
              @touch-start="emit('touch-start', $event)"
              @touch-end="emit('touch-end')"
              @touch-move="emit('touch-move', $event)"
            />
          </template>

          <!-- AI 发来的转账/红包 UI -->
          <template v-else-if="msg.transferData">
            <ChatTransferBubble
              :msg="msg"
              direction="left"
              :transferStyle="chatSettings.transferStyle || 'wechat'"
              @click-bubble="emit('handle-left-transfer-click', $event)"
              @touch-start="emit('touch-start', $event)"
              @touch-end="emit('touch-end')"
              @touch-move="emit('touch-move', $event)"
            />
          </template>

          <!-- 表情包气泡 -->
          <template v-else-if="msg.isEmoji">
            <div v-if="msg.emojiUrl" class="emoji-message-container" @click="emit('handle-emoji-click', msg.emojiUrl, msg.content === '[表情]' ? '' : msg.content)" @touchstart="emit('touch-start', msg.id)" @touchend="emit('touch-end')" @touchmove="emit('touch-move', $event)" @contextmenu.prevent>
              <img :src="msg.emojiUrl" class="emoji-message-img" loading="lazy" />
            </div>
            <!-- 降级：图片已丢失 -->
            <div v-else class="bubble bubble-left" @touchstart="emit('touch-start', msg.id)" @touchend="emit('touch-end')" @touchmove="emit('touch-move', $event)" @contextmenu.prevent>
              <div style="font-style: italic; color: var(--text-tertiary);">[表情包：{{ msg.content === '[表情]' ? '未知' : msg.content }}]</div>
            </div>
          </template>

          <div style="display: flex; align-items: flex-end;">
            <div v-if="!msg.imageData && !msg.voiceData && !msg.transferData && !msg.isEmoji && !msg.callData" class="bubble bubble-left" @touchstart="emit('touch-start', msg.id)" @touchend="emit('touch-end')" @touchmove="emit('touch-move', $event)" @contextmenu.prevent>
              <!-- 同气泡模式下的思考过程 -->
              <div v-if="chatSettings.cotInSameBubble && msg.thinking" class="thinking-block">
                <details>
                  <summary class="thinking-summary magazine-slogan">Code. Love. Be.</summary>
                  <div class="thinking-content">{{ msg.thinking }}</div>
                </details>
              </div>
              <div v-if="msg.quote" class="msg-quote-block">
                <div class="msg-quote-sender">{{ msg.quote.sender }}</div>
                <div class="msg-quote-content">{{ msg.quote.content }}</div>
              </div>
              <div class="message-content">{{ msg.content }}</div>
            </div>
            <div v-if="chatSettings.timeDisplayStyle !== 'none' && chatSettings.timeDisplayPosition === 'bubble_outer'" class="msg-time-inline-outer left">
              {{ formatMsgTime(msg.timestamp || msg.id) }}
            </div>
          </div>
        </div>
      </template>
    </template>

    <template v-else-if="msg.type === 'right'">
      <template v-if="msg.isRecalled">
        <div class="msg-recalled-container" 
             @click="selectionMode === null && emit('view-recalled-message', msg.content)"
             @touchstart="emit('touch-start', msg.id)"
             @touchend="emit('touch-end')"
             @touchmove="emit('touch-move', $event)"
             @contextmenu.prevent>
          <span class="msg-recalled-text">你撤回了一条消息</span>
        </div>
      </template>
      <template v-else>
        <div class="msg-content-col align-right">
          <div v-if="shouldShowName(msg) || (chatSettings.timeDisplayStyle !== 'none' && chatSettings.timeDisplayPosition === 'name_side')" class="msg-name" style="justify-content: flex-end;">
            <span v-if="shouldShowName(msg)" class="msg-name-text">@{{ myProfile.name }}</span>
            <span v-if="chatSettings.timeDisplayStyle !== 'none' && chatSettings.timeDisplayPosition === 'name_side'" class="msg-time-inline-side right">
              {{ formatMsgTime(msg.timestamp || msg.id) }}
            </span>
          </div>
          
          <!-- 新版转账/红包 UI -->
          <template v-if="msg.transferData">
            <ChatTransferBubble
              :msg="msg"
              direction="right"
              :transferStyle="chatSettings.transferStyle || 'wechat'"
              @touch-start="emit('touch-start', $event)"
              @touch-end="emit('touch-end')"
              @touch-move="emit('touch-move', $event)"
            />
          </template>

          <!-- 表情包气泡 -->
          <template v-if="msg.isEmoji">
            <div v-if="msg.emojiUrl" class="emoji-message-container" @click="emit('handle-emoji-click', msg.emojiUrl, msg.content === '[表情]' ? '' : msg.content)" @touchstart="emit('touch-start', msg.id)" @touchend="emit('touch-end')" @touchmove="emit('touch-move', $event)" @contextmenu.prevent>
              <img :src="msg.emojiUrl" class="emoji-message-img" loading="lazy" />
            </div>
            <!-- 降级：图片已丢失 -->
            <div v-else class="bubble bubble-right" @touchstart="emit('touch-start', msg.id)" @touchend="emit('touch-end')" @touchmove="emit('touch-move', $event)" @contextmenu.prevent>
              <div style="font-style: italic; color: var(--text-tertiary);">[表情包：{{ msg.content === '[表情]' ? '未知' : msg.content }}]</div>
            </div>
          </template>

          <!-- 图片消息气泡 -->
          <template v-else-if="msg.imageData">
            <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 4px;">
              <ChatImageBubble
                :msg="msg"
                :expandedImageIds="expandedImageIds"
                :currentMediaThumb="currentMediaThumb"
                @toggle-image-text="emit('toggle-image-text', $event)"
                @touch-start="emit('touch-start', $event)"
                @touch-end="emit('touch-end')"
                @touch-move="emit('touch-move', $event)"
              />
            </div>
          </template>

          <!-- 语音通话记录气泡 (用户端) -->
          <template v-else-if="msg.callData">
            <ChatCallRecordBubble
              :msg="msg"
              direction="right"
              @touch-start="emit('touch-start', $event)"
              @touch-end="emit('touch-end')"
              @touch-move="emit('touch-move', $event)"
            />
          </template>

          <!-- 语音消息气泡 -->
          <template v-else-if="msg.voiceData">
            <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 4px;">
              <ChatVoiceBubble
                :msg="msg"
                direction="right"
                :autoTranscribeVoice="chatSettings.autoTranscribeVoice ?? false"
                :expandedVoiceIds="expandedVoiceIds"
                :playing-id="voicePlayingId"
                :is-synthesizing="isVoiceSynthesizing"
                @toggle-voice-text="emit('toggle-voice-text', $event)"
                @play-voice="(id, text) => emit('play-voice', id, text)"
                @touch-start="emit('touch-start', $event)"
                @touch-end="emit('touch-end')"
                @touch-move="emit('touch-move', $event)"
              />
            </div>
          </template>

          <!-- 普通消息气泡 -->
          <div style="display: flex; align-items: flex-end;">
            <div v-if="chatSettings.timeDisplayStyle !== 'none' && chatSettings.timeDisplayPosition === 'bubble_outer'" class="msg-time-inline-outer right">
              {{ formatMsgTime(msg.timestamp || msg.id) }}
            </div>
            <div v-if="!msg.imageData && !msg.voiceData && !msg.transferData && !msg.isEmoji && !msg.callData" class="bubble bubble-right" @touchstart="emit('touch-start', msg.id)" @touchend="emit('touch-end')" @touchmove="emit('touch-move', $event)" @contextmenu.prevent>
              <div v-if="msg.quote" class="msg-quote-block">
                <div class="msg-quote-sender">{{ msg.quote.sender }}</div>
                <div class="msg-quote-content">{{ msg.quote.content }}</div>
              </div>
              {{ msg.content }}
            </div>
          </div>

        </div>
        <div class="msg-avatar-col" v-if="shouldShowAvatar(msg)">
          <div class="msg-avatar" :style="[
            myProfile.avatarUrl ? { backgroundImage: `url(${myProfile.avatarUrl})`, backgroundSize: 'cover', backgroundPosition: 'center', color: 'transparent' } : {}
          ]">{{ myProfile.avatarUrl ? '' : (myProfile.name.charAt(0) || '我') }}</div>
          <div v-if="chatSettings.timeDisplayStyle !== 'none' && chatSettings.timeDisplayPosition === 'avatar_bottom'" class="msg-time-inline">
            {{ formatMsgTime(msg.timestamp || msg.id) }}
          </div>
        </div>
      </template>
    </template>
  </div>

  <div v-if="msg.costTime && msg.type === 'left' && selectedChat?.showCostTime !== false" class="cost-time-row">
    <div class="cost-line-v"></div>
    <div class="cost-line-h"></div>
    <div class="cost-avatar" :style="selectedChat?.avatarUrl ? { backgroundImage: `url(${selectedChat.avatarUrl})`, backgroundSize: 'cover', backgroundPosition: 'center', color: 'transparent' } : {}">{{ selectedChat?.avatarText || '伴' }}</div>
    <div class="cost-text">本次耗时 {{ msg.costTime }} 秒</div>
  </div>
</template>

<style>
@import '../ChatRoomView.css';

.chat-message-image-generating {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 24px 32px !important;
  min-width: 180px;
  background: var(--bg-primary) !important;
  border: 1px solid var(--border-color);
  box-shadow: 0 4px 16px rgba(0,0,0,0.03);
}

.generating-spinner-container {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0,0,0,0.02);
  border-radius: 50%;
}

.generating-spinner {
  width: 24px;
  height: 24px;
  border: 2.5px solid rgba(0, 0, 0, 0.08);
  border-top-color: var(--theme-color, #007aff);
  border-radius: 50%;
  animation: lgm-spin 1s linear infinite;
}

.generating-text {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
  text-align: center;
  letter-spacing: 0.5px;
}

.generating-cancel-btn {
  margin-top: 4px;
  padding: 6px 16px;
  font-size: 12px;
  font-weight: 500;
  color: #ff3b30;
  background: rgba(255, 59, 48, 0.08);
  border: none;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.generating-cancel-btn:active {
  transform: scale(0.95);
  background: rgba(255, 59, 48, 0.15);
}

@keyframes lgm-spin { 
  100% { transform: rotate(360deg); } 
}

.msg-avatar-col {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.msg-time-inline {
  font-size: 10px;
  color: var(--text-tertiary);
  transform: scale(0.9);
  white-space: nowrap;
}

.msg-time-inline-side {
  font-size: 11px;
  color: var(--text-tertiary);
  margin-left: 6px;
  font-weight: normal;
}
.msg-time-inline-side.right {
  margin-left: 6px;
  margin-right: 0;
}

.msg-time-inline-outer {
  font-size: 11px;
  color: var(--text-tertiary);
  display: flex;
  align-items: flex-end;
  padding-bottom: 2px;
  white-space: nowrap;
  flex-shrink: 0;
}
.msg-time-inline-outer.left {
  margin-left: 6px;
}
.msg-time-inline-outer.right {
  margin-right: 6px;
}

.thinking-standalone-wrapper {
  display: flex;
  width: 100%;
  margin-bottom: 4px;
}

.thinking-standalone {
  background: transparent;
  border: 1px dashed var(--border-color);
  border-radius: 12px;
  color: var(--text-secondary);
  font-size: 13px;
  padding: 6px 12px;
  max-width: 80%; /* 限制最大宽度以免太长 */
}

.thinking-standalone .thinking-summary {
  color: var(--text-tertiary);
}
</style>
