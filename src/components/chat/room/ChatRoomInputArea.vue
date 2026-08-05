/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { ref } from 'vue'

const props = defineProps<{
  selectionMode: 'recall' | 'mark' | 'general' | null
  getSelectedCount: number
  displayMessages: any[]
  replyTargetMessage: any
  showExtensionPanel: boolean
  showEmojiPanel: boolean
  panelEmojis: any[]
  isGenerating: boolean
  selectedChat: any
}>()

const emit = defineEmits<{
  (e: 'exit-multi-select-mode'): void
  (e: 'select-all', msgs: any[]): void
  (e: 'recall-selected-messages'): void
  (e: 'mark-selected-messages', flag: boolean): void
  (e: 'delete-selected-messages'): void
  (e: 'cancel-reply'): void
  (e: 'toggle-extension-panel'): void
  (e: 'toggle-emoji-panel'): void
  (e: 'trigger-api'): void
  (e: 'add-message', text: string): void
  (e: 'open-settings'): void
  (e: 'handle-send-emoji', item: any): void
  (e: 'handle-stop-call'): void
  (e: 'handle-regenerate'): void
  (e: 'show-transfer-modal'): void
  (e: 'show-voice-modal'): void
  (e: 'show-image-modal'): void
  (e: 'show-voice-call-modal'): void
  (e: 'show-video-call-modal'): void
  (e: 'update:showExtensionPanel', val: boolean): void
  (e: 'update:showEmojiPanel', val: boolean): void
}>()

const inputMessage = ref('')

const handleAddMessage = () => {
  emit('add-message', inputMessage.value)
  inputMessage.value = ''
}

const onFocusInput = () => {
  emit('update:showExtensionPanel', false)
  emit('update:showEmojiPanel', false)
}
</script>

<template>
  <footer class="bottom-input-area" :class="{ 'panel-open': (showExtensionPanel || showEmojiPanel) && selectionMode === null }">
    
    <!-- 撤回专属多选模式底部栏 -->
    <div v-if="selectionMode === 'recall'" class="multi-select-bar recall-multi-bar">
      <div class="ms-btn ms-cancel" @click="emit('exit-multi-select-mode')">取消</div>
      <div class="ms-info">已选择 {{ getSelectedCount }} 条准备撤回</div>
      <div class="ms-actions">
        <div class="ms-icon-btn" @click="emit('select-all', displayMessages)">
          <svg viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="9 11 12 14 22 4"></polyline>
            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
          </svg>
        </div>
        <div class="ms-icon-btn primary-action" :class="{ disabled: getSelectedCount === 0 }" @click="emit('recall-selected-messages')" title="确认撤回">
          <svg viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9 14L4 9l5-5" />
            <path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5v0a5.5 5.5 0 0 1-5.5 5.5H11" />
          </svg>
        </div>
      </div>
    </div>

    <!-- 标记多选模式底部栏 -->
    <div v-else-if="selectionMode === 'mark'" class="multi-select-bar mark-multi-bar">
      <div class="ms-btn ms-cancel" @click="emit('exit-multi-select-mode')">取消</div>
      <div class="ms-info">已选择 {{ getSelectedCount }} 条</div>
      <div class="ms-actions">
        <div class="ms-icon-btn" @click="emit('select-all', displayMessages)">
          <svg viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="9 11 12 14 22 4"></polyline>
            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
          </svg>
        </div>
        <div class="ms-icon-btn primary-action" :class="{ disabled: getSelectedCount === 0 }" @click="emit('mark-selected-messages', true)" title="设为重要">
          <svg viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
          </svg>
        </div>
        <div class="ms-icon-btn danger" :class="{ disabled: getSelectedCount === 0 }" @click="emit('mark-selected-messages', false)" title="取消重要">
          <svg viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <path d="M2 2l20 20" />
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" opacity="0.4"></polygon>
          </svg>
        </div>
      </div>
    </div>

    <!-- 通用多选模式底部操作栏 -->
    <div v-else-if="selectionMode === 'general'" class="multi-select-bar">
      <div class="ms-btn ms-cancel" @click="emit('exit-multi-select-mode')">取消</div>
      <div class="ms-info">已选择 {{ getSelectedCount }} 条</div>
      <div class="ms-actions">
        <div class="ms-icon-btn" @click="emit('select-all', displayMessages)">
          <svg viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="9 11 12 14 22 4"></polyline>
            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
          </svg>
        </div>
        <div class="ms-icon-btn danger" :class="{ disabled: getSelectedCount === 0 }" @click="emit('delete-selected-messages')" title="删除">
          <svg viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        </div>
      </div>
    </div>

    <div v-else class="input-flat-bar-wrapper" style="width: 100%;">
      <!-- 引用提示条 -->
      <transition name="reply-fade">
        <div v-if="replyTargetMessage" class="reply-preview-bar">
          <div class="reply-preview-content">
            <span class="reply-preview-sender">回复 @{{ replyTargetMessage.sender }}:</span>
            <span class="reply-preview-text">{{ replyTargetMessage.content }}</span>
          </div>
          <div class="reply-preview-close" @click="emit('cancel-reply')">
            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </div>
        </div>
      </transition>

      <div class="input-flat-bar">
        <div class="icon-group-left">
          <div class="icon-btn slim" @click="emit('toggle-extension-panel')" :class="{ 'icon-active': showExtensionPanel }">
            <svg viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          </div>
          <div class="icon-btn slim" @click="emit('toggle-emoji-panel')" :class="{ 'icon-active': showEmojiPanel }">
            <svg viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M8 14s1.5 2 4 2 4-2 4-2"></path><line x1="9" y1="9" x2="9.01" y2="9"></line><line x1="15" y1="9" x2="15.01" y2="9"></line></svg>
          </div>
        </div>
        
        <input 
          type="text" 
          class="text-input" 
          placeholder="输入消息..." 
          v-model="inputMessage"
          @keyup.enter="handleAddMessage"
          @focus="onFocusInput"
        />
        
        <div class="icon-group-right">
          <div class="icon-btn slim" style="cursor: pointer;" @click="emit('trigger-api')">
            <svg viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
          </div>
          <div class="icon-btn slim" style="cursor: pointer;" @click="handleAddMessage">
            <svg viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline></svg>
          </div>
        </div>
      </div>
    </div>
    
    <!-- 底部表情包面板 (平滑展开) -->
    <div class="emoji-panel-wrapper" :class="{ 'is-open': showEmojiPanel }">
      <div v-if="panelEmojis.length === 0" class="emoji-panel-empty">
        <div class="empty-text">暂无用户表情包</div>
        <div class="empty-sub-text" style="color: #3b82f6; cursor: pointer; text-decoration: underline;" @click="emit('open-settings')">前往“表情包管理”添加</div>
      </div>
      <div v-else class="emoji-panel-grid">
        <div v-for="item in panelEmojis" :key="item.id" class="emoji-panel-item" @click="emit('handle-send-emoji', item)">
          <div class="emoji-img-wrapper">
            <img :src="item.previewUrl" :alt="item.name" loading="lazy" />
          </div>
          <span class="emoji-item-name">{{ item.name }}</span>
        </div>
      </div>
    </div>

    <!-- 底部拓展面板 (平滑展开) -->
    <div class="extension-panel-wrapper" :class="{ 'is-open': showExtensionPanel }">
      <div class="extension-grid">
        <!-- 功能 1: 停止响应 -->
        <div class="extension-item" :class="{ 'is-active': isGenerating }" @click="emit('handle-stop-call')">
          <div class="extension-icon-box">
            <svg viewBox="0 0 24 24" width="26" height="26" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
              <rect x="6" y="6" width="12" height="12" rx="2" ry="2"></rect>
            </svg>
          </div>
          <span class="extension-label">停止响应</span>
        </div>

        <!-- 功能 2: 重新生成 -->
        <div class="extension-item" :class="{ 'is-active': !isGenerating && selectedChat?.id !== 1 }" @click="emit('handle-regenerate')">
          <div class="extension-icon-box">
            <svg viewBox="0 0 24 24" width="26" height="26" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="1 4 1 10 7 10"></polyline>
              <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
            </svg>
          </div>
          <span class="extension-label">重新生成</span>
        </div>

        <!-- 功能 3: 转账/红包 -->
        <div class="extension-item is-active" @click="emit('show-transfer-modal')">
          <div class="extension-icon-box">
            <svg viewBox="0 0 24 24" width="26" height="26" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
              <rect x="2" y="5" width="20" height="14" rx="2"></rect>
              <path d="M12 12h.01"></path>
            </svg>
          </div>
          <span class="extension-label">转账/红包</span>
        </div>

        <!-- 功能 4: 发语音 -->
        <div class="extension-item is-active" @click="emit('show-voice-modal')">
          <div class="extension-icon-box">
            <svg viewBox="0 0 24 24" width="26" height="26" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
              <line x1="12" y1="19" x2="12" y2="22"></line>
            </svg>
          </div>
          <span class="extension-label">发语音</span>
        </div>

        <!-- 功能 5: 发图片 -->
        <div class="extension-item is-active" @click="emit('show-image-modal')">
          <div class="extension-icon-box">
            <svg viewBox="0 0 24 24" width="26" height="26" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <circle cx="8.5" cy="8.5" r="1.5"></circle>
              <polyline points="21 15 16 10 5 21"></polyline>
            </svg>
          </div>
          <span class="extension-label">发图片</span>
        </div>

        <!-- 功能 6: 语音通话 -->
        <div class="extension-item is-active" @click="emit('show-voice-call-modal')">
          <div class="extension-icon-box">
            <svg viewBox="0 0 24 24" width="26" height="26" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
            </svg>
          </div>
          <span class="extension-label">语音通话</span>
        </div>

        <!-- 功能 7: 视频通话 -->
        <div class="extension-item is-active" @click="emit('show-video-call-modal')">
          <div class="extension-icon-box">
            <svg viewBox="0 0 24 24" width="26" height="26" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="23 7 16 12 23 17 23 7"></polygon>
              <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
            </svg>
          </div>
          <span class="extension-label">视频通话</span>
        </div>

        <!-- 占位功能 8 -->
        <div class="extension-item placeholder">
          <div class="extension-icon-box">
            <svg viewBox="0 0 24 24" width="26" height="26" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <circle cx="8.5" cy="8.5" r="1.5"></circle>
              <polyline points="21 15 16 10 5 21"></polyline>
            </svg>
          </div>
          <span class="extension-label">敬请期待</span>
        </div>
      </div>
    </div>
  </footer>
</template>

<style scoped>
@import '../ChatRoomView.css';
</style>
