/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { ensureRelationship, formatRelationshipPlan } from '../../../composables/useChatRelationship'

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
  isMixedOfflineActive: boolean
  mentionOptions?: Array<{ id: string; name: string; avatarUrl?: string; avatarText?: string; description?: string; disabled?: boolean }>
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
  (e: 'show-user-thought-modal'): void
  (e: 'show-contact-card-modal'): void
  (e: 'show-web-search-modal'): void
  (e: 'toggle-mixed-offline'): void
  (e: 'open-relationship'): void
  (e: 'advance-relationship'): void
  (e: 'focus-input'): void
  (e: 'update:showExtensionPanel', val: boolean): void
  (e: 'update:showEmojiPanel', val: boolean): void
}>()

const inputMessage = ref('')
const inputRef = ref<HTMLInputElement | null>(null)
const extensionSliderRef = ref<HTMLDivElement | null>(null)
const currentExtensionPage = ref(0)

const onExtensionScroll = () => {
  if (!extensionSliderRef.value) return
  const { scrollLeft, clientWidth } = extensionSliderRef.value
  if (clientWidth > 0) {
    currentExtensionPage.value = Math.round(scrollLeft / clientWidth)
  }
}

const scrollToExtensionPage = (pageIndex: number) => {
  if (!extensionSliderRef.value) return
  const clientWidth = extensionSliderRef.value.clientWidth
  extensionSliderRef.value.scrollTo({
    left: pageIndex * clientWidth,
    behavior: 'smooth'
  })
  currentExtensionPage.value = pageIndex
}

const mentionMatch = computed(() => inputMessage.value.match(/@([^@\s]*)$/))
const mentionQuery = computed(() => mentionMatch.value?.[1]?.toLowerCase() || '')
const filteredMentionOptions = computed(() => mentionMatch.value ? (props.mentionOptions || []).filter(item => !mentionQuery.value || item.name.toLowerCase().includes(mentionQuery.value)).slice(0, 12) : [])
const showMentionMenu = computed(() => Boolean(mentionMatch.value && filteredMentionOptions.value.length))
const relationship = computed(() => ensureRelationship(props.selectedChat || {}))
const relationshipBlocksInput = computed(() => relationship.value.blockedBy === 'user' || relationship.value.friendship !== 'friends')
const relationshipTitle = computed(() => {
  if (relationship.value.blockedBy === 'user') return '你已拉黑对方'
  if (relationship.value.friendship === 'deleted_by_user') return '你已删除好友'
  if (relationship.value.friendship === 'deleted_by_character') return '对方已删除你'
  return '关系状态已改变'
})

const handleAddMessage = () => {
  emit('add-message', inputMessage.value)
  inputMessage.value = ''
}

const onFocusInput = () => {
  emit('update:showExtensionPanel', false)
  emit('update:showEmojiPanel', false)
  emit('focus-input')
}

const selectMention = async (item: { id: string; name: string; disabled?: boolean }) => {
  if (item.disabled) return
  const match = mentionMatch.value
  if (!match) return
  const start = inputMessage.value.length - match[0].length
  inputMessage.value = `${inputMessage.value.slice(0, start)}@${item.name} `
  await nextTick(); inputRef.value?.focus()
}
const handleEnter = () => { const option = filteredMentionOptions.value.find(item => !item.disabled); if (showMentionMenu.value && option) void selectMention(option); else handleAddMessage() }
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

    <div v-else-if="relationshipBlocksInput" class="relationship-input-state">
      <button type="button" class="relationship-summary" @click="emit('open-relationship')">
        <span class="relationship-summary-icon"><svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M12 3a6 6 0 0 0-6 6v3l-2 3h16l-2-3V9a6 6 0 0 0-6-6Z"/><path d="M10 19h4"/></svg></span>
        <span><b>{{ relationshipTitle }}</b><small>{{ formatRelationshipPlan(relationship) }}</small></span>
        <svg class="relationship-chevron" viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.7"><path d="m9 18 6-6-6-6"/></svg>
      </button>
      <button type="button" class="relationship-advance" :disabled="isGenerating" @click="emit('advance-relationship')">
        <span v-if="isGenerating" class="relationship-spinner"></span>
        <svg v-else viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M20 11a8 8 0 0 0-15-2M4 5v4h4"/><path d="M4 13a8 8 0 0 0 15 2m1 4v-4h-4"/></svg>
        {{ isGenerating ? '推进中' : '继续推进' }}
      </button>
    </div>

    <div v-else class="input-flat-bar-wrapper" style="width: 100%;">
      <button v-if="relationship.blockedBy === 'character'" type="button" class="undelivered-notice" @click="emit('open-relationship')">
        对方已拉黑你 · 发送的消息不会送达 <span>查看动向</span>
      </button>
      <button
        v-if="selectedChat?.offlineMeetEnabled && selectedChat?.offlineMeetMode === 'mixed'"
        type="button"
        class="offline-context-indicator"
        @click="emit('toggle-mixed-offline')"
      >
        <span class="offline-context-dot"></span>
        <span>{{ isMixedOfflineActive ? '当前为线下见面 · 点击结束' : '点击开始线下见面' }}</span>
      </button>
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

      <transition name="reply-fade">
        <div v-if="showMentionMenu" class="mention-picker" role="listbox" aria-label="选择要提醒的群成员">
          <button v-for="item in filteredMentionOptions" :key="item.id" type="button" class="mention-option" :disabled="item.disabled" @mousedown.prevent="selectMention(item)">
            <span class="mention-avatar" :class="{ all: item.id === 'all' }" :style="item.avatarUrl ? { backgroundImage: `url(${item.avatarUrl})` } : {}">{{ item.avatarUrl ? '' : (item.avatarText || item.name.charAt(0)) }}</span>
            <span class="mention-copy"><strong>{{ item.name }}</strong><small>{{ item.description || '群成员' }}</small></span>
          </button>
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
          ref="inputRef"
          type="text" 
          class="text-input" 
          placeholder="输入消息..." 
          v-model="inputMessage"
          @keydown.enter.prevent="handleEnter"
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
      <div 
        ref="extensionSliderRef" 
        class="extension-pages-slider"
        @scroll="onExtensionScroll"
      >
        <!-- 第一页：8 个常用功能 -->
        <div class="extension-page">
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

            <!-- 功能 8: 填写本轮用户心声 -->
            <div
              class="extension-item is-active"
              :class="{ 'thought-ready': Boolean(selectedChat?.pendingUserThought?.trim()) }"
              @click="emit('show-user-thought-modal')"
            >
              <div class="extension-icon-box">
                <svg viewBox="0 0 24 24" width="26" height="26" stroke="currentColor" stroke-width="1.7" fill="none" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M20 11.2a7.8 7.8 0 0 1-8 7.8 9 9 0 0 1-3.5-.7L4 20l1.5-4A7.7 7.7 0 0 1 4 11.2 7.8 7.8 0 0 1 12 3a7.8 7.8 0 0 1 8 8.2Z"></path>
                  <path d="M9.2 11.3c.9 1.3 1.9 2 2.8 2s1.9-.7 2.8-2"></path>
                </svg>
              </div>
              <span class="extension-label">{{ selectedChat?.pendingUserThought?.trim() ? '已填写心声' : '填写心声' }}</span>
            </div>
          </div>
        </div>

        <!-- 第二页：名片与 7 个占位功能项 -->
        <div class="extension-page">
          <div class="extension-grid">
            <!-- 功能: 名片 (UI 占位) -->
            <div class="extension-item is-active" @click="emit('show-contact-card-modal')">
              <div class="extension-icon-box">
                <svg viewBox="0 0 24 24" width="26" height="26" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="3" y="4" width="18" height="16" rx="3" ry="3"></rect>
                  <circle cx="9" cy="10" r="2.5"></circle>
                  <path d="M15 8h2"></path>
                  <path d="M15 12h2"></path>
                  <path d="M6 16c0-1.5 1.5-2.5 3-2.5s3 1 3 2.5"></path>
                </svg>
              </div>
              <span class="extension-label">名片</span>
            </div>

            <div class="extension-item is-active" :class="{ 'web-search-active': selectedChat?.webSearchEnabled }" @click="emit('show-web-search-modal')">
              <div class="extension-icon-box">
                <svg viewBox="0 0 24 24" width="26" height="26" stroke="currentColor" stroke-width="1.7" fill="none" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="9"></circle>
                  <path d="M3 12h18"></path>
                  <path d="M12 3a14 14 0 0 1 0 18"></path>
                  <path d="M12 3a14 14 0 0 0 0 18"></path>
                </svg>
              </div>
              <span class="extension-label">{{ selectedChat?.webSearchEnabled ? '联网已开启' : '联网搜索' }}</span>
            </div>

            <!-- 剩余 6 个占位项 -->
            <div v-for="i in 6" :key="`placeholder-${i}`" class="extension-item placeholder">
              <div class="extension-icon-box placeholder-box">
                <svg viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" stroke-width="1.5" stroke-dasharray="3 3" fill="none" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="6" ry="6"></rect>
                  <line x1="12" y1="8" x2="12" y2="16"></line>
                  <line x1="8" y1="12" x2="16" y2="12"></line>
                </svg>
              </div>
              <span class="extension-label">功能拓展</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 分页指示器 -->
      <div class="extension-pagination">
        <div 
          class="pagination-dot" 
          :class="{ active: currentExtensionPage === 0 }"
          @click="scrollToExtensionPage(0)"
        ></div>
        <div 
          class="pagination-dot" 
          :class="{ active: currentExtensionPage === 1 }"
          @click="scrollToExtensionPage(1)"
        ></div>
      </div>
    </div>
  </footer>
</template>

<style scoped>
@import '../ChatRoomView.css';

.offline-context-indicator {
  width: 100%;
  border: 0;
  background: transparent;
  font: inherit;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 6px 12px 2px;
  color: var(--text-secondary);
  font-size: 11px;
  letter-spacing: .2px;
}

.offline-context-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
  opacity: .75;
}

.extension-item.offline-active .extension-icon-box {
  background: var(--text-primary);
  color: var(--bg-primary);
}

.extension-item.thought-ready .extension-icon-box {
  background: var(--text-primary);
  color: var(--sys-bg-secondary);
}
.extension-item.web-search-active .extension-icon-box {
  background: var(--text-primary);
  color: var(--sys-bg-secondary);
}

.mention-picker{position:absolute;right:12px;bottom:calc(100% - 8px);left:12px;z-index:28;max-height:286px;overflow:auto;padding:7px;border:1px solid var(--border-color);border-radius:15px;background:var(--card-bg-solid,var(--sys-bg-secondary));box-shadow:0 14px 38px rgba(0,0,0,.14);backdrop-filter:blur(16px)}.mention-option{display:grid;grid-template-columns:38px minmax(0,1fr);align-items:center;gap:10px;width:100%;min-height:50px;padding:6px 8px;border:0;border-radius:11px;background:transparent;color:var(--text-primary);font:inherit;text-align:left;cursor:pointer}.mention-option:hover,.mention-option:focus-visible{outline:0;background:var(--sys-bg-tertiary)}.mention-option:disabled{opacity:.45;cursor:not-allowed}.mention-avatar{display:grid;place-items:center;width:38px;height:38px;border-radius:50%;background-color:var(--sys-bg-tertiary);background-position:center;background-size:cover;font-size:12px;font-weight:650}.mention-avatar.all{border-radius:12px;background:var(--text-primary);color:var(--sys-bg-secondary)}.mention-copy{display:flex;min-width:0;flex-direction:column;gap:3px}.mention-copy strong{overflow:hidden;font-size:12px;text-overflow:ellipsis;white-space:nowrap}.mention-copy small{color:var(--text-tertiary);font-size:9px}
.input-flat-bar-wrapper{position:relative}

.relationship-input-state{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:center;padding:10px 12px calc(10px + env(safe-area-inset-bottom));background:transparent}.relationship-summary{min-width:0;height:52px;padding:7px 10px;border:1px solid var(--border-color);border-radius:14px;background:var(--sys-bg-secondary);color:var(--text-primary);display:grid;grid-template-columns:34px minmax(0,1fr) 17px;align-items:center;gap:8px;text-align:left;cursor:pointer}.relationship-summary-icon{width:34px;height:34px;border-radius:11px;display:grid;place-items:center;background:var(--sys-bg-tertiary);color:var(--text-secondary)}.relationship-summary span:nth-child(2){min-width:0;display:flex;flex-direction:column;gap:3px}.relationship-summary b{font-size:12px}.relationship-summary small{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:10px;color:var(--text-tertiary)}.relationship-chevron{color:var(--text-tertiary)}.relationship-advance{height:52px;padding:0 14px;border:0;border-radius:14px;background:var(--text-primary);color:var(--sys-bg-secondary);display:flex;align-items:center;gap:6px;font:inherit;font-size:12px;font-weight:650;cursor:pointer}.relationship-advance:disabled{opacity:.55;cursor:not-allowed}.relationship-advance:focus-visible,.relationship-summary:focus-visible,.undelivered-notice:focus-visible{outline:2px solid #3b82f6;outline-offset:2px}.relationship-spinner{width:16px;height:16px;border:2px solid rgba(128,128,128,.35);border-top-color:currentColor;border-radius:50%;animation:relationship-spin .7s linear infinite}.undelivered-notice{width:100%;padding:6px 12px 2px;border:0;background:transparent;color:var(--text-tertiary);font:inherit;font-size:10px;text-align:center;cursor:pointer}.undelivered-notice span{color:#3478c8;margin-left:5px}@keyframes relationship-spin{to{transform:rotate(360deg)}}@media(max-width:420px){.relationship-input-state{grid-template-columns:minmax(0,1fr) 82px;gap:7px;padding-left:8px;padding-right:8px}.relationship-advance{padding:0 9px}.relationship-summary{padding-left:8px}.relationship-summary-icon{width:30px;height:30px}}
</style>
