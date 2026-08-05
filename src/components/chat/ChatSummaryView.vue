/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { ref, computed } from 'vue'
import { useChatState } from '../../composables/useChatState'
import { useChatSummary } from '../../composables/useChatSummary'
import { useChatAuth } from '../../composables/useChatAuth'
import TextEditModal from '../TextEditModal.vue'
import LongTextEditModal from '../LongTextEditModal.vue'
import ChatSummaryPresetsModal from './modals/ChatSummaryPresetsModal.vue'

const emit = defineEmits<{
  (e: 'back'): void
}>()

const { selectedChat, mockChats } = useChatState()

const defaultSummaryPrompt = `请你以角色的主观心理视角，对以下时间段内的聊天记录进行深度的记忆整理与情感归纳。
要求：
1. 【时间与脉络】明确这段记忆发生的时间节点或大致时间段，梳理事件的前因后果。
2. 【细腻情感】深入捕捉角色在对话中产生的情感波动、心理细节以及对对方的特殊情愫。那些微小的、私密的瞬间往往最珍贵，请务必保留。
3. 【重要标记】尤其注意标有【重要标记】的内容，这是绝对不可遗忘的羁绊与执念。
4. 【同理心审视】在完成初稿后，请务必进行二次自我审视：反思这份总结是否遗漏了对方表达过的事件、信息、在意、脆弱或付出？如果有任何会让对方感到“你不重视我”的缺失，请务必将其补充进去。
5. 【表达视角】总结请以第一人称（角色本人）或带有情感温度的第三人称视角进行书写，展现出对对方的在意与珍惜。
6. 字数控制在100-300字以内。`

if (selectedChat.value && !selectedChat.value.summaryPrompt) {
  selectedChat.value.summaryPrompt = defaultSummaryPrompt
}

const toastVisible = ref(false)
const toastMessage = ref('')
let toastTimer: any = null

function showToast(msg: string) {
  toastMessage.value = msg
  toastVisible.value = true
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => {
    toastVisible.value = false
  }, 2000)
}

const saveCurrentChat = async () => {
  if (!selectedChat.value) return
  const { currentChatUserId } = useChatAuth()
  const contactsKey = currentChatUserId.value ? `clingy_custom_contacts_${currentChatUserId.value}` : 'clingy_custom_contacts'
  const savedStr = localStorage.getItem(contactsKey)
  if (!savedStr) return

  let contacts = JSON.parse(savedStr)
  const idx = contacts.findIndex((c: any) => c.id === selectedChat.value.id)
  if (idx === -1) return

  contacts[idx].memoryBook = selectedChat.value.memoryBook || []
  contacts[idx].autoSummaryEnabled = selectedChat.value.autoSummaryEnabled ?? false
  contacts[idx].autoSummaryThreshold = selectedChat.value.autoSummaryThreshold || null
  contacts[idx].summaryPrompt = selectedChat.value.summaryPrompt || ''
  contacts[idx].lastSummaryMsgId = selectedChat.value.lastSummaryMsgId || 0
  contacts[idx].messages = selectedChat.value.messages || []

  localStorage.setItem(contactsKey, JSON.stringify(contacts))

  const listIdx = mockChats.value.findIndex(c => c.id === selectedChat.value.id)
  if (listIdx !== -1) {
    mockChats.value[listIdx].name = selectedChat.value.name
  }
}

const {
  isSummarizing,
  summaryModalVisible,
  handleManualSummaryLatest,
  handleManualSummaryRange,
  getUnsummarizedCount
} = useChatSummary(selectedChat, saveCurrentChat, showToast)

const rangeStart = ref(1)
const rangeEnd = ref(1)
const latestSummaryModalVisible = ref(false)

const unsummarizedCount = computed(() => getUnsummarizedCount())
const autoStatusText = computed(() =>
  selectedChat.value?.autoSummaryEnabled ? '自动已开启' : '自动未开启'
)
const promptStatusText = computed(() =>
  selectedChat.value?.summaryPrompt === defaultSummaryPrompt ? '默认' : '已自定义'
)

const openLatestSummaryModal = () => {
  if (isSummarizing.value) return
  if (unsummarizedCount.value === 0) {
    showToast('暂无未总结消息')
    return
  }
  latestSummaryModalVisible.value = true
}

const confirmLatestSummary = async () => {
  latestSummaryModalVisible.value = false
  await handleManualSummaryLatest()
}

const openRangeSummaryModal = () => {
  if (isSummarizing.value) return
  const msgs = selectedChat.value?.messages || []
  if (msgs.length === 0) {
    showToast('暂无消息可供总结')
    return
  }
  rangeStart.value = 1
  rangeEnd.value = msgs.length
  summaryModalVisible.value = true
}

const confirmRangeSummary = async () => {
  summaryModalVisible.value = false
  await handleManualSummaryRange(rangeStart.value, rangeEnd.value)
}

const presetsModalVisible = ref(false)

const textModal = ref({
  visible: false,
  title: '',
  text: '',
  defaultText: '',
  placeholder: '',
  target: ''
})

const longTextModal = ref({
  visible: false,
  title: '',
  text: '',
  defaultText: '',
  placeholder: '',
  target: '',
  presetKey: ''
})

const openTextModal = (title: string, text: string, defaultText: string, placeholder: string, target: string) => {
  if (target === 'autoSummaryThreshold' && !selectedChat.value?.autoSummaryEnabled) return
  textModal.value = { visible: true, title, text: text || '', defaultText, placeholder, target }
}

const openLongTextModal = (title: string, text: string, defaultText: string, placeholder: string, target: string, presetKey: string = '') => {
  longTextModal.value = { visible: true, title, text: text || '', defaultText, placeholder, target, presetKey }
}

const handleTextSave = (newText: string, target: string) => {
  if (!selectedChat.value) return
  if (target === 'summaryPrompt') {
    selectedChat.value.summaryPrompt = newText
  } else if (target === 'autoSummaryThreshold') {
    selectedChat.value.autoSummaryThreshold = parseInt(newText) || null
  }
  saveCurrentChat()
}

const onTextModalSaved = (newText: string) => {
  handleTextSave(newText, textModal.value.target)
}

const onLongTextModalSaved = (newText: string) => {
  handleTextSave(newText, longTextModal.value.target)
}

const applyPreset = (presetText: string) => {
  if (selectedChat.value) {
    selectedChat.value.summaryPrompt = presetText
    saveCurrentChat()
    showToast('预设应用成功')
  }
}

const resetSummaryPromptToDefault = () => {
  if (selectedChat.value) {
    selectedChat.value.summaryPrompt = defaultSummaryPrompt
    saveCurrentChat()
    showToast('已恢复系统默认总结提示词')
  }
}
</script>

<template>
  <div class="summary-view">
    <header class="summary-header">
      <div class="summary-back" @click="emit('back')">
        <svg viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="15 18 9 12 15 6"></polyline>
        </svg>
      </div>
      <div class="summary-header-center">
        <div class="summary-title">总结</div>
        <div class="summary-subtitle">未总结 {{ unsummarizedCount }} 条 · {{ autoStatusText }}</div>
      </div>
      <div class="summary-header-spacer"></div>
    </header>

    <main class="summary-main" v-if="selectedChat">
      <div class="section-label">操作</div>
      <div class="glass-panel">
        <div class="glass-list-item" :class="{ 'disabled-block': isSummarizing }" @click="openLatestSummaryModal">
          <div class="item-label">立即总结</div>
          <div class="item-value">
            <span class="item-value-text">{{ isSummarizing ? '总结中...' : '执行' }}</span>
            <span class="arrow">></span>
          </div>
        </div>
        <div class="glass-list-item" :class="{ 'disabled-block': isSummarizing }" @click="openRangeSummaryModal">
          <div class="item-label">区间总结</div>
          <div class="item-value"><span class="arrow">></span></div>
        </div>
      </div>

      <div class="section-label">设置</div>
      <div class="glass-panel">
        <div class="glass-list-item">
          <div class="item-label">自动总结</div>
          <div class="item-value">
            <label class="switch" @click.stop>
              <input type="checkbox" v-model="selectedChat.autoSummaryEnabled" @change="saveCurrentChat">
              <span class="slider"></span>
            </label>
          </div>
        </div>
        <div
          class="glass-list-item"
          :class="{ 'disabled-block': !selectedChat.autoSummaryEnabled }"
          @click="openTextModal('自动阈值', String(selectedChat.autoSummaryThreshold || ''), '500', '输入阈值条数', 'autoSummaryThreshold')"
        >
          <div class="item-label">自动阈值</div>
          <div class="item-value">
            <span class="item-value-text">{{ selectedChat.autoSummaryThreshold || 500 }} (当前: {{ unsummarizedCount }})</span>
            <span class="arrow">></span>
          </div>
        </div>
        <div
          class="glass-list-item"
          @click="openLongTextModal('编辑总结提示词', selectedChat.summaryPrompt || '', defaultSummaryPrompt, '输入总结提示词，建议100-300字...', 'summaryPrompt')"
        >
          <div class="item-label">总结提示词</div>
          <div class="item-value">
            <span class="item-value-text">{{ promptStatusText }}</span>
            <span class="arrow">></span>
          </div>
        </div>
        <div
          class="glass-list-item"
          @click="presetsModalVisible = true"
        >
          <div class="item-label">提示词预设管理</div>
          <div class="item-value">
            <span class="item-value-text">管理预设</span>
            <span class="arrow">></span>
          </div>
        </div>
      </div>

      <div class="section-label">说明</div>
      <div class="hint-card">
        总结结果会写入记忆书架。自动总结在未总结条数达到阈值时触发；立即总结处理全部未总结消息；区间总结可指定消息范围。
      </div>
    </main>

    <!-- 立即总结确认弹窗 -->
    <div v-if="latestSummaryModalVisible" class="wb-modal-overlay" @click.self="latestSummaryModalVisible = false">
      <div class="custom-confirm-modal">
        <div class="confirm-title" style="margin-top: 20px;">确认总结</div>
        <div class="confirm-desc" style="padding-bottom: 20px;">
          目前有 <span style="color: var(--text-primary, #222); font-weight: bold;">{{ unsummarizedCount }}</span> 条未总结消息，确认要立即总结吗？
        </div>
        <div class="confirm-actions">
          <div class="confirm-btn cancel" @click="latestSummaryModalVisible = false">取消</div>
          <div class="confirm-btn" style="color: var(--text-primary); font-weight: 600;" @click="confirmLatestSummary">确认</div>
        </div>
      </div>
    </div>

    <!-- 自定义区间总结弹窗 -->
    <div v-if="summaryModalVisible" class="wb-modal-overlay" @click.self="summaryModalVisible = false">
      <div class="custom-confirm-modal">
        <div class="confirm-title" style="margin-top: 20px;">自定义总结区间</div>
        <div class="confirm-desc" style="padding-bottom: 12px;">
          当前总消息数: <span style="color: var(--text-primary); font-weight: bold;">{{ selectedChat?.messages?.length || 0 }}</span>
        </div>

        <div style="padding: 0 24px 20px; display: flex; align-items: center; gap: 8px;">
          <div style="flex: 1;">
            <div style="font-size: 12px; color: var(--text-tertiary); margin-bottom: 4px;">从第 (条)</div>
            <input type="number" class="form-input" v-model.number="rangeStart" style="margin-bottom: 0; text-align: center;" />
          </div>
          <div style="color: var(--text-tertiary); padding-top: 18px;">-</div>
          <div style="flex: 1;">
            <div style="font-size: 12px; color: var(--text-tertiary); margin-bottom: 4px;">到第 (条)</div>
            <input type="number" class="form-input" v-model.number="rangeEnd" style="margin-bottom: 0; text-align: center;" />
          </div>
        </div>

        <div class="confirm-actions">
          <div class="confirm-btn cancel" @click="summaryModalVisible = false">取消</div>
          <div class="confirm-btn" style="color: var(--text-primary); font-weight: 600;" @click="confirmRangeSummary">确认生成</div>
        </div>
      </div>
    </div>

    <Teleport to="body">
      <transition name="toast-fade">
        <div v-if="toastVisible" class="settings-toast">
          {{ toastMessage }}
        </div>
      </transition>

      <TextEditModal
        v-model:visible="textModal.visible"
        :title="textModal.title"
        :current-text="textModal.text"
        :default-text="textModal.defaultText"
        :placeholder="textModal.placeholder"
        @saved="onTextModalSaved"
      />

      <LongTextEditModal
        v-model:visible="longTextModal.visible"
        :title="longTextModal.title"
        :current-text="longTextModal.text"
        :default-text="longTextModal.defaultText"
        :placeholder="longTextModal.placeholder"
        @saved="onLongTextModalSaved"
      />

      <ChatSummaryPresetsModal
        v-model:visible="presetsModalVisible"
        preset-key="summary_prompt_presets"
        :current-text="selectedChat?.summaryPrompt || defaultSummaryPrompt"
        @apply="applyPreset"
        @reset-default="resetSummaryPromptToDefault"
      />
    </Teleport>
  </div>
</template>

<style scoped>
.summary-view {
  position: absolute;
  inset: 0;
  z-index: 40;
  display: flex;
  flex-direction: column;
  background: #fff;
}

.summary-header {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  padding-top: calc(env(safe-area-inset-top, 20px) + 12px);
  background: #fff;
  flex-shrink: 0;
}

.summary-back {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  color: var(--text-primary, #333);
  cursor: pointer;
  flex-shrink: 0;
}

.summary-back:active {
  background: rgba(0, 0, 0, 0.05);
}

.summary-header-center {
  flex: 1;
  text-align: center;
  min-width: 0;
}

.summary-title {
  font-size: 17px;
  font-weight: 600;
  color: var(--text-primary, #222);
  line-height: 1.3;
}

.summary-subtitle {
  font-size: 12px;
  color: var(--text-tertiary, #999);
  margin-top: 2px;
}

.summary-header-spacer {
  width: 36px;
  flex-shrink: 0;
}

.summary-main {
  flex: 1;
  overflow-y: auto;
  padding: 16px 16px 32px;
  -webkit-overflow-scrolling: touch;
}

.section-label {
  font-size: 12px;
  color: var(--text-tertiary, #999);
  padding: 0 4px 8px;
  font-weight: 500;
}

.glass-panel {
  background: #f9f9f9;
  border-radius: 12px;
  border: none;
  margin-bottom: 20px;
  overflow: hidden;
}

.glass-list-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 16px;
  position: relative;
  cursor: pointer;
  min-height: 24px;
}

.glass-list-item:active {
  background: rgba(0, 0, 0, 0.05);
}

.glass-list-item:not(:last-child)::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 16px;
  right: 0;
  height: 1px;
  background: rgba(0, 0, 0, 0.05);
}

.item-label {
  font-size: 15px;
  color: var(--text-primary, #222);
  white-space: nowrap;
}

.item-value {
  font-size: 15px;
  color: var(--text-secondary, #666);
  display: flex;
  align-items: center;
  gap: 8px;
  text-align: right;
  flex: 1;
  justify-content: flex-end;
  overflow: hidden;
}

.item-value-text {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 200px;
}

.arrow {
  color: var(--text-tertiary, #999);
  font-size: 14px;
  font-family: monospace;
  font-weight: bold;
}

.disabled-block {
  opacity: 0.45;
  pointer-events: none;
}

.hint-card {
  font-size: 12px;
  line-height: 1.6;
  color: var(--text-tertiary, #999);
  padding: 0 4px 8px;
}

.wb-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.custom-confirm-modal {
  background: var(--sys-bg-secondary, #fff);
  width: 85%;
  max-width: 360px;
  border-radius: 16px;
  overflow: hidden;
}

.confirm-title {
  font-size: 17px;
  font-weight: 600;
  text-align: center;
  color: var(--text-primary, #222);
  padding: 0 24px;
}

.confirm-desc {
  font-size: 13px;
  text-align: center;
  color: var(--text-tertiary, #999);
  padding: 8px 24px 0;
}

.confirm-actions {
  display: flex;
  border-top: 1px solid rgba(0, 0, 0, 0.06);
}

.confirm-btn {
  flex: 1;
  text-align: center;
  padding: 14px;
  font-size: 15px;
  cursor: pointer;
}

.confirm-btn.cancel {
  color: var(--text-secondary, #666);
  border-right: 1px solid rgba(0, 0, 0, 0.06);
}

.form-input {
  width: 100%;
  box-sizing: border-box;
  padding: 10px 12px;
  border: 1px solid var(--border-color, #e5e5e5);
  border-radius: 8px;
  font-size: 15px;
  background: var(--sys-bg-primary, #f7f8fa);
  color: var(--text-primary, #222);
  outline: none;
}

.settings-toast {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: rgba(0, 0, 0, 0.75);
  color: #fff;
  padding: 12px 20px;
  border-radius: 8px;
  font-size: 14px;
  z-index: 10001;
  max-width: 80%;
  text-align: center;
}

.toast-fade-enter-active,
.toast-fade-leave-active {
  transition: opacity 0.25s;
}
.toast-fade-enter-from,
.toast-fade-leave-to {
  opacity: 0;
}

/* switch 样式复用全局，若无则兜底 */
.switch {
  position: relative;
  display: inline-block;
  width: 44px;
  height: 24px;
  flex-shrink: 0;
}
.switch input {
  opacity: 0;
  width: 0;
  height: 0;
}
.slider {
  position: absolute;
  cursor: pointer;
  inset: 0;
  background-color: #ccc;
  transition: 0.25s;
  border-radius: 24px;
}
.slider:before {
  position: absolute;
  content: '';
  height: 18px;
  width: 18px;
  left: 3px;
  bottom: 3px;
  background-color: white;
  transition: 0.25s;
  border-radius: 50%;
}
.switch input:checked + .slider {
  background-color: var(--theme-color, #5b8def);
}
.switch input:checked + .slider:before {
  transform: translateX(20px);
}
</style>
