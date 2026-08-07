/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { ref, computed } from 'vue'
import { useChatState } from '../../composables/useChatState'
import { useChatSummary } from '../../composables/useChatSummary'
import { useChatAuth } from '../../composables/useChatAuth'
import TextEditModal from '../TextEditModal.vue'
import LongTextEditModal from '../LongTextEditModal.vue'
import ChatSummaryPresetsModal from './modals/ChatSummaryPresetsModal.vue'
import ChatStructuredMemoryModal from './modals/ChatStructuredMemoryModal.vue'
import { clearChatVectors, ensureMemoryState, indexChatMemories, isEmbeddingReady, type MemoryMode, type StructuredMemoryState } from '../../services/memoryEngine'

const emit = defineEmits<{
  (e: 'back'): void
}>()

const { selectedChat, mockChats } = useChatState()

const defaultSummaryPrompt = `优先保留明确的时间、事件、人物、喜好、边界、承诺、情绪变化和关系发展。尤其注意【重要标记】，但不得把猜测写成事实。`

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
  contacts[idx].autoSummaryTokenThreshold = selectedChat.value.autoSummaryTokenThreshold || 6000
  contacts[idx].autoSummaryTrigger = selectedChat.value.autoSummaryTrigger || 'both'
  contacts[idx].autoSummaryOnImportant = selectedChat.value.autoSummaryOnImportant ?? true
  contacts[idx].autoSummaryOnTopicChange = selectedChat.value.autoSummaryOnTopicChange ?? false
  contacts[idx].autoSummaryOnExit = selectedChat.value.autoSummaryOnExit ?? false
  contacts[idx].autoSummaryIdleMinutes = selectedChat.value.autoSummaryIdleMinutes || 0
  contacts[idx].memoryMode = selectedChat.value.memoryMode || 'hybrid'
  contacts[idx].memoryBatchSize = selectedChat.value.memoryBatchSize || 150
  contacts[idx].memoryTokenBudget = selectedChat.value.memoryTokenBudget || 1200
  contacts[idx].autoMemoryConsolidation = selectedChat.value.autoMemoryConsolidation ?? true
  contacts[idx].memoryConsolidationThreshold = selectedChat.value.memoryConsolidationThreshold || 8
  contacts[idx].memoryState = selectedChat.value.memoryState || null
  contacts[idx].summaryPrompt = selectedChat.value.summaryPrompt || ''
  contacts[idx].lastSummaryMsgId = selectedChat.value.lastSummaryMsgId || 0
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
const structuredMemoryVisible = ref(false)
const choiceModal = ref<'mode' | 'trigger' | null>(null)
const isIndexing = ref(false)
const tutorialVisible = ref(false)
const memoryState = computed(() => selectedChat.value ? ensureMemoryState(selectedChat.value) : null)
const memoryStatsText = computed(() => {
  const state = memoryState.value
  if (!state) return '0 项'
  return `${state.events.length + state.variables.length + state.tableRows.length + state.relations.length} 项`
})
const modeOptions: Array<{ value: MemoryMode; label: string; desc: string }> = [
  { value: 'hybrid', label: '智能混合（推荐）', desc: '同时整理叙事、主观感受、事件、变量与表格。' },
  { value: 'narrative', label: '经典叙事总结', desc: '以客观连贯摘要为主，兼容旧版记忆书架。' },
  { value: 'subjective', label: '角色主观记忆', desc: '保留角色第一人称感受，并与客观事实分开。' },
  { value: 'event', label: '事件卡记忆', desc: '重点拆分时间、人物、结果和未完成事项。' },
  { value: 'variable', label: '变量记忆', desc: '重点维护称呼、喜好、边界、关系和当前状态。' },
  { value: 'table', label: '表格记忆', desc: '重点生成可查看、修改的分类记录。' }
]
const triggerOptions = [
  { value: 'both', label: '条数或 Token', desc: '任一阈值达到即自动整理。' },
  { value: 'count', label: '仅消息条数', desc: '达到指定未总结消息数后整理。' },
  { value: 'token', label: '仅 Token', desc: '达到估算上下文长度后整理。' }
]
const modeLabel = computed(() => modeOptions.find(item => item.value === (selectedChat.value?.memoryMode || 'hybrid'))?.label || '智能混合（推荐）')
const triggerLabel = computed(() => triggerOptions.find(item => item.value === (selectedChat.value?.autoSummaryTrigger || 'both'))?.label || '条数或 Token')

const selectChoice = (value: string) => {
  if (!selectedChat.value || !choiceModal.value) return
  if (choiceModal.value === 'mode') selectedChat.value.memoryMode = value
  if (choiceModal.value === 'trigger') selectedChat.value.autoSummaryTrigger = value
  choiceModal.value = null
  saveCurrentChat()
}

const updateStructuredState = (state: StructuredMemoryState) => {
  if (!selectedChat.value) return
  selectedChat.value.memoryState = state
  saveCurrentChat()
  indexChatMemories(selectedChat.value).catch(error => console.warn('结构化记忆已保存，向量同步稍后重试', error))
}

const rebuildVectorIndex = async () => {
  if (!selectedChat.value) return
  if (!isEmbeddingReady()) {
    showToast('请先在 API 设置中启用并配置向量节点')
    return
  }
  isIndexing.value = true
  try {
    await clearChatVectors(selectedChat.value.id)
    const result = await indexChatMemories(selectedChat.value)
    showToast(`向量索引完成：${result.indexed} 条`)
  } catch (error: any) {
    showToast(error.message || '向量索引失败')
  } finally {
    isIndexing.value = false
  }
}

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
  } else if (target === 'autoSummaryTokenThreshold') {
    selectedChat.value.autoSummaryTokenThreshold = parseInt(newText) || 6000
  } else if (target === 'memoryBatchSize') {
    selectedChat.value.memoryBatchSize = Math.max(20, Math.min(500, parseInt(newText) || 150))
  } else if (target === 'memoryTokenBudget') {
    selectedChat.value.memoryTokenBudget = Math.max(200, parseInt(newText) || 1200)
  } else if (target === 'autoSummaryIdleMinutes') {
    selectedChat.value.autoSummaryIdleMinutes = Math.max(0, Math.min(1440, parseInt(newText) || 0))
  } else if (target === 'memoryConsolidationThreshold') {
    selectedChat.value.memoryConsolidationThreshold = Math.max(4, Math.min(20, parseInt(newText) || 8))
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
        <div class="glass-list-item" @click="structuredMemoryVisible = true">
          <div class="item-label">结构化记忆</div>
          <div class="item-value"><span class="item-value-text">{{ memoryStatsText }}</span><span class="arrow">></span></div>
        </div>
      </div>

      <div class="section-label">设置</div>
      <div class="glass-panel">
        <div class="glass-list-item" @click="choiceModal = 'mode'">
          <div class="item-label">记忆整理模式</div>
          <div class="item-value"><span class="item-value-text">{{ modeLabel }}</span><span class="arrow">></span></div>
        </div>
        <div class="glass-list-item">
          <div class="item-label">自动总结</div>
          <div class="item-value">
            <label class="switch" @click.stop>
              <input type="checkbox" v-model="selectedChat.autoSummaryEnabled" @change="saveCurrentChat">
              <span class="slider"></span>
            </label>
          </div>
        </div>
        <div class="glass-list-item" :class="{ 'disabled-block': !selectedChat.autoSummaryEnabled }" @click="choiceModal = 'trigger'">
          <div class="item-label">触发方式</div>
          <div class="item-value"><span class="item-value-text">{{ triggerLabel }}</span><span class="arrow">></span></div>
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
        <div class="glass-list-item" :class="{ 'disabled-block': !selectedChat.autoSummaryEnabled || selectedChat.autoSummaryTrigger === 'count' }" @click="openTextModal('Token 阈值', String(selectedChat.autoSummaryTokenThreshold || 6000), '6000', '输入估算 Token 阈值', 'autoSummaryTokenThreshold')">
          <div class="item-label">Token 阈值</div>
          <div class="item-value"><span class="item-value-text">{{ selectedChat.autoSummaryTokenThreshold || 6000 }}</span><span class="arrow">></span></div>
        </div>
        <div class="glass-list-item" :class="{ 'disabled-block': !selectedChat.autoSummaryEnabled }">
          <div class="item-label">重要标记触发</div>
          <div class="item-value"><label class="switch" @click.stop><input type="checkbox" v-model="selectedChat.autoSummaryOnImportant" @change="saveCurrentChat"><span class="slider"></span></label></div>
        </div>
        <div class="glass-list-item" :class="{ 'disabled-block': !selectedChat.autoSummaryEnabled }">
          <div class="item-label">话题切换触发</div>
          <div class="item-value"><label class="switch" @click.stop><input type="checkbox" v-model="selectedChat.autoSummaryOnTopicChange" @change="saveCurrentChat"><span class="slider"></span></label></div>
        </div>
        <div class="glass-list-item" :class="{ 'disabled-block': !selectedChat.autoSummaryEnabled }">
          <div class="item-label">离开聊天时整理</div>
          <div class="item-value"><label class="switch" @click.stop><input type="checkbox" v-model="selectedChat.autoSummaryOnExit" @change="saveCurrentChat"><span class="slider"></span></label></div>
        </div>
        <div class="glass-list-item" :class="{ 'disabled-block': !selectedChat.autoSummaryEnabled }" @click="openTextModal('空闲整理', String(selectedChat.autoSummaryIdleMinutes || 0), '0', '分钟，0 表示关闭', 'autoSummaryIdleMinutes')">
          <div class="item-label">空闲后台整理</div>
          <div class="item-value"><span class="item-value-text">{{ selectedChat.autoSummaryIdleMinutes ? `${selectedChat.autoSummaryIdleMinutes} 分钟` : '关闭' }}</span><span class="arrow">></span></div>
        </div>
        <div class="glass-list-item" @click="openTextModal('单批消息数', String(selectedChat.memoryBatchSize || 150), '150', '20-500', 'memoryBatchSize')">
          <div class="item-label">单批消息数</div>
          <div class="item-value"><span class="item-value-text">{{ selectedChat.memoryBatchSize || 150 }}</span><span class="arrow">></span></div>
        </div>
        <div class="glass-list-item" @click="openTextModal('记忆注入预算', String(selectedChat.memoryTokenBudget || 1200), '1200', '输入 Token 预算', 'memoryTokenBudget')">
          <div class="item-label">记忆注入预算</div>
          <div class="item-value"><span class="item-value-text">{{ selectedChat.memoryTokenBudget || 1200 }} Token</span><span class="arrow">></span></div>
        </div>
        <div class="glass-list-item">
          <div class="item-label">分层记忆巩固</div>
          <div class="item-value"><label class="switch" @click.stop><input type="checkbox" v-model="selectedChat.autoMemoryConsolidation" @change="saveCurrentChat"><span class="slider"></span></label></div>
        </div>
        <div class="glass-list-item" :class="{ 'disabled-block': selectedChat.autoMemoryConsolidation === false }" @click="openTextModal('巩固阈值', String(selectedChat.memoryConsolidationThreshold || 8), '8', '4-20 条阶段摘要', 'memoryConsolidationThreshold')">
          <div class="item-label">巩固阈值</div>
          <div class="item-value"><span class="item-value-text">{{ selectedChat.memoryConsolidationThreshold || 8 }} 条摘要</span><span class="arrow">></span></div>
        </div>
        <div class="glass-list-item" :class="{ 'disabled-block': isIndexing }" @click="rebuildVectorIndex">
          <div class="item-label">向量索引</div>
          <div class="item-value"><span class="item-value-text">{{ isIndexing ? '重建中...' : (isEmbeddingReady() ? '重建' : '未配置（可选）') }}</span><span class="arrow">></span></div>
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
        智能混合会同时生成叙事、事件、变量和表格记忆。向量节点完全可选；未配置时使用关键词、标签、时间与重要度召回。记忆按固定预算注入，不会再把全部书架塞入每轮对话。
      </div>
      <div class="glass-panel compact-help">
        <div class="glass-list-item" @click="tutorialVisible = true">
          <div class="item-label">使用教程</div>
          <div class="item-value"><span class="item-value-text">查看配置与使用说明</span><span class="arrow">></span></div>
        </div>
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

    <div v-if="choiceModal" class="wb-modal-overlay" @click.self="choiceModal = null">
      <div class="choice-modal">
        <div class="choice-title">{{ choiceModal === 'mode' ? '记忆整理模式' : '自动触发方式' }}</div>
        <div class="choice-list">
          <div v-for="item in (choiceModal === 'mode' ? modeOptions : triggerOptions)" :key="item.value" class="choice-item" @click="selectChoice(item.value)">
            <div><div class="choice-name">{{ item.label }}</div><div class="choice-desc">{{ item.desc }}</div></div>
            <div class="choice-check" v-if="(choiceModal === 'mode' ? selectedChat?.memoryMode : selectedChat?.autoSummaryTrigger) === item.value">✓</div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="tutorialVisible" class="wb-modal-overlay" @click.self="tutorialVisible = false">
      <div class="tutorial-modal">
        <div class="tutorial-header"><div class="choice-title">长期记忆使用教程</div><div class="tutorial-close" @click="tutorialVisible = false">×</div></div>
        <div class="tutorial-body">
          <div class="tutorial-step"><b>1. 选择模式</b><span>推荐“智能混合”，会同时整理叙事、事件、变量与表格。</span></div>
          <div class="tutorial-step"><b>2. 开启自动总结</b><span>可按条数、Token、重要标记、话题切换、空闲或离开聊天触发。</span></div>
          <div class="tutorial-step"><b>3. 配置总结节点（可选）</b><span>不配置时自动使用聊天节点；配置后可使用更便宜的独立模型。</span></div>
          <div class="tutorial-step"><b>4. 配置向量节点（可选）</b><span>在“API 节点配置 → 向量节点”填写兼容 /v1/embeddings 的地址、密钥和模型。未配置也能正常召回。</span></div>
          <div class="tutorial-step"><b>5. 检查和纠错</b><span>进入“结构化记忆”查看事件、变量和表格；重要变量可以锁定，避免被自动覆盖。</span></div>
          <div class="tutorial-step"><b>6. 重建索引</b><span>更换 Embedding 模型后点击“向量索引 → 重建”。旧记忆会自动补齐向量。</span></div>
          <div class="tutorial-note">详细教程同时保存在项目 docs/长期记忆与自动总结使用教程.md。</div>
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
      <ChatStructuredMemoryModal
        :visible="structuredMemoryVisible"
        :state="memoryState"
        @close="structuredMemoryVisible = false"
        @update-state="updateStructuredState"
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
  width: 100%;
  box-sizing: border-box;
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
  width: 100%;
  box-sizing: border-box;
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
.choice-modal { width: 88%; max-width: 380px; max-height: 76vh; overflow: hidden; border-radius: 18px; background: var(--sys-bg-secondary, #fff); }
.choice-title { padding: 18px 20px 12px; font-size: 17px; font-weight: 600; color: var(--text-primary, #222); }
.choice-list { max-height: 62vh; overflow-y: auto; padding: 0 10px 12px; }
.choice-item { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 13px 10px; border-radius: 11px; cursor: pointer; }
.choice-item:active { background: var(--sys-bg-primary, #f5f5f7); }
.choice-name { font-size: 14px; color: var(--text-primary, #222); }
.choice-desc { margin-top: 3px; font-size: 11px; line-height: 1.4; color: var(--text-tertiary, #999); }
.choice-check { color: var(--theme-color, #5b8def); font-weight: 700; }
.compact-help { margin-top: 12px; }
.tutorial-modal { width: 90%; max-width: 390px; max-height: 78vh; overflow: hidden; border-radius: 18px; background: var(--sys-bg-secondary, #fff); }
.tutorial-header { display: flex; align-items: center; justify-content: space-between; padding-right: 16px; border-bottom: 1px solid rgba(0,0,0,.05); }
.tutorial-close { width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border-radius: 50%; color: var(--text-secondary, #666); font-size: 22px; cursor: pointer; }
.tutorial-body { max-height: 62vh; overflow-y: auto; padding: 14px 20px 20px; }
.tutorial-step { padding: 11px 0; border-bottom: 1px solid rgba(0,0,0,.05); }
.tutorial-step b { display: block; margin-bottom: 4px; font-size: 14px; color: var(--text-primary, #222); }
.tutorial-step span { display: block; font-size: 12px; line-height: 1.55; color: var(--text-secondary, #666); }
.tutorial-note { margin-top: 14px; padding: 10px 12px; border-radius: 9px; background: var(--sys-bg-primary, #f6f6f7); font-size: 11px; line-height: 1.5; color: var(--text-tertiary, #888); }

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
