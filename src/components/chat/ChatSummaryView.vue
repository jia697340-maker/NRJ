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
const viewProps = defineProps<{
  chat?: any
  saveChat?: () => void | Promise<void>
}>()

const { selectedChat: storeSelectedChat, mockChats } = useChatState()
const selectedChat = computed(() => viewProps.chat || storeSelectedChat.value)

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
  if (viewProps.saveChat) {
    await viewProps.saveChat()
    return
  }
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
const advancedVisible = ref(false)
const extraTriggersVisible = ref(false)
const memoryState = computed(() => selectedChat.value ? ensureMemoryState(selectedChat.value) : null)
const memoryStatsText = computed(() => {
  const state = memoryState.value
  if (!state) return '0 项'
  const memberCount = selectedChat.value?.chatType === 'group'
    ? Object.values(selectedChat.value.memberMemories || {}).reduce((total: number, list: any) => total + (Array.isArray(list) ? list.filter((item: any) => item.enabled !== false).length : 0), 0)
    : 0
  return `${state.events.length + state.variables.length + state.tableRows.length + state.relations.length + memberCount} 项`
})
const groupMemberNames = computed(() => selectedChat.value?.chatType === 'group'
  ? Object.fromEntries((selectedChat.value.memberIds || []).map((id: string) => [id, selectedChat.value.memberNicknames?.[id] || selectedChat.value.memoryMemberNames?.[id] || id]))
  : undefined)
type ModeOption = {
  value: MemoryMode
  label: string
  shortLabel: string
  desc: string
  result: string
  suitable: string
  example: string
}
const modeOptions: ModeOption[] = [
  {
    value: 'hybrid',
    label: '综合记忆（推荐）',
    shortLabel: '什么都想记住',
    desc: '同时生成文字总结、角色感受、重要事件、人物资料和分类记录。',
    result: '系统会把同一段聊天分别整理成多种记忆，信息最完整。',
    suitable: '不确定该选什么，或希望角色尽量记住完整经历的人。',
    example: '既记住“去过哪里”，也记住“角色当时有什么感受”。'
  },
  {
    value: 'narrative',
    label: '经典文字总结',
    shortLabel: '像故事一样总结',
    desc: '把聊天整理成一段客观、连贯的文字，使用方式最接近旧版总结。',
    result: '主要得到一段可以直接阅读的阶段故事摘要。',
    suitable: '喜欢传统总结，只想回顾发生过什么的人。',
    example: '“两人在周末讨论了旅行计划，并约定下月出发。”'
  },
  {
    value: 'subjective',
    label: '角色主观记忆',
    shortLabel: '记住角色的感受',
    desc: '用角色第一人称记录感受、想法和对关系的理解。',
    result: '主要得到角色视角的内心记忆，并把感受和客观事实分开。',
    suitable: '重视角色代入感、情绪变化和感情发展的用户。',
    example: '“我很期待和你一起旅行，也有一点担心计划会改变。”'
  },
  {
    value: 'event',
    label: '重要事件记忆',
    shortLabel: '记住发生过的事情',
    desc: '把聊天拆成独立事件，记录人物、时间、结果和未完成事项。',
    result: '主要得到一张张事件记录，方便追踪约定、冲突和后续计划。',
    suitable: '长篇剧情、角色扮演或经常有连续任务的用户。',
    example: '“旅行约定｜参与者：用户和角色｜状态：尚未出发。”'
  },
  {
    value: 'variable',
    label: '人物资料与状态',
    shortLabel: '记住资料和喜好',
    desc: '持续更新称呼、喜好、禁忌、关系、计划和当前状态。',
    result: '主要得到可以更新的资料项；新信息会替换过时信息并保留历史。',
    suitable: '希望角色准确记住个人资料、偏好和边界的用户。',
    example: '“喜欢的饮料：拿铁”“旅行计划：下个月出发”。'
  },
  {
    value: 'table',
    label: '分类表格记忆',
    shortLabel: '分门别类保存',
    desc: '把人物、地点、礼物、承诺等内容整理成可编辑的分类记录。',
    result: '主要得到整齐的分类条目，适合之后逐项查看和修改。',
    suitable: '喜欢自己管理资料，或需要大量分类信息的用户。',
    example: '在“承诺”分类中保存“下个月一起旅行”。'
  }
]
const triggerOptions = [
  { value: 'both', label: '系统自动判断（推荐）', desc: '聊天条数或内容长度任意一项达到设置值，就开始整理。最省心。' },
  { value: 'count', label: '按聊天条数', desc: '每积累一定数量的未整理消息后开始。容易理解，消息特别长时可能整理较晚。' },
  { value: 'token', label: '按内容长度', desc: '根据所有文字的大致长度判断。长消息较多时更合适，但普通用户不需要选择。' }
]
const currentMode = computed(() => modeOptions.find(item => item.value === (selectedChat.value?.memoryMode || 'hybrid')) || modeOptions[0])
const modeLabel = computed(() => currentMode.value.label)
const triggerLabel = computed(() => triggerOptions.find(item => item.value === (selectedChat.value?.autoSummaryTrigger || 'both'))?.label || '系统自动判断（推荐）')
const vectorReady = computed(() => isEmbeddingReady())
const enabledExtraTriggerCount = computed(() => {
  if (!selectedChat.value) return 0
  return [
    selectedChat.value.autoSummaryOnImportant !== false,
    selectedChat.value.autoSummaryOnTopicChange === true,
    selectedChat.value.autoSummaryOnExit === true,
    Number(selectedChat.value.autoSummaryIdleMinutes || 0) > 0
  ].filter(Boolean).length
})
const automationSummary = computed(() => {
  const chat = selectedChat.value
  if (!chat?.autoSummaryEnabled) return '目前不会自动整理。你仍然可以使用上方的“立即总结”。'
  const trigger = chat.autoSummaryTrigger || 'both'
  const count = Number(chat.autoSummaryThreshold || 500)
  const tokens = Number(chat.autoSummaryTokenThreshold || 6000)
  const main = trigger === 'count'
    ? `积累约 ${count} 条未整理消息时`
    : trigger === 'token'
      ? `聊天内容达到约 ${tokens} Token 时`
      : `积累约 ${count} 条消息，或内容达到约 ${tokens} Token 时`
  return `${main}，系统会使用“${currentMode.value.label}”自动整理。${enabledExtraTriggerCount.value ? `另外已开启 ${enabledExtraTriggerCount.value} 个提前整理条件。` : ''}`
})

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
const updateMemberMemories = (memories: Record<string, any[]>) => {
  if (!selectedChat.value || selectedChat.value.chatType !== 'group') return
  selectedChat.value.memberMemories = memories
  saveCurrentChat()
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
    showToast(`智能搜索资料已更新：${result.indexed} 条`)
  } catch (error: any) {
    showToast(error.message || '智能搜索资料更新失败')
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

      <div class="section-label step-label"><span>第 1 步</span> 选择想怎样整理记忆</div>
      <div class="glass-panel">
        <div class="glass-list-item" @click="choiceModal = 'mode'">
          <div class="item-copy">
            <div class="item-label">总结方式</div>
            <div class="item-help">点这里可以更换；不知道选什么就保持推荐项。</div>
          </div>
          <div class="item-value"><span class="item-value-text">{{ modeLabel }}</span><span class="arrow">></span></div>
        </div>
        <div class="mode-explanation">
          <div class="explanation-kicker">{{ currentMode.shortLabel }}</div>
          <div class="explanation-text">{{ currentMode.result }}</div>
          <div class="explanation-row"><b>适合：</b>{{ currentMode.suitable }}</div>
          <div class="explanation-row"><b>举例：</b>{{ currentMode.example }}</div>
          <div class="safe-note">不需要配置向量模型，也能正常总结和读取记忆。</div>
        </div>
      </div>

      <div class="section-label step-label"><span>第 2 步</span> 选择是否自动整理</div>
      <div class="glass-panel">
        <div class="glass-list-item">
          <div class="item-copy">
            <div class="item-label">自动整理记忆</div>
            <div class="item-help">{{ selectedChat.autoSummaryEnabled ? '已开启，达到下面的条件后系统会自动整理。' : '关闭时不会自动处理，但可以随时手动总结。' }}</div>
          </div>
          <div class="item-value">
            <label class="switch" @click.stop>
              <input type="checkbox" v-model="selectedChat.autoSummaryEnabled" @change="saveCurrentChat">
              <span class="slider"></span>
            </label>
          </div>
        </div>
        <div v-if="selectedChat.autoSummaryEnabled" class="glass-list-item" @click="choiceModal = 'trigger'">
          <div class="item-copy">
            <div class="item-label">什么时候开始整理</div>
            <div class="item-help">推荐让系统同时参考消息数量和内容长度。</div>
          </div>
          <div class="item-value"><span class="item-value-text">{{ triggerLabel }}</span><span class="arrow">></span></div>
        </div>
        <div
          v-if="selectedChat.autoSummaryEnabled && selectedChat.autoSummaryTrigger !== 'token'"
          class="glass-list-item"
          @click="openTextModal('自动阈值', String(selectedChat.autoSummaryThreshold || ''), '500', '输入阈值条数', 'autoSummaryThreshold')"
        >
          <div class="item-copy">
            <div class="item-label">积累多少条后整理</div>
            <div class="item-help">普通用户保持 500 即可。数字越小，整理越频繁。</div>
          </div>
          <div class="item-value">
            <span class="item-value-text">{{ selectedChat.autoSummaryThreshold || 500 }} 条</span>
            <span class="arrow">></span>
          </div>
        </div>
        <div v-if="selectedChat.autoSummaryEnabled && selectedChat.autoSummaryTrigger !== 'count'" class="glass-list-item" @click="openTextModal('内容长度', String(selectedChat.autoSummaryTokenThreshold || 6000), '6000', '建议保持 6000', 'autoSummaryTokenThreshold')">
          <div class="item-copy">
            <div class="item-label">聊天内容达到多长后整理</div>
            <div class="item-help">Token 是内容长度单位。普通用户保持 6000，不需要计算。</div>
          </div>
          <div class="item-value"><span class="item-value-text">约 {{ selectedChat.autoSummaryTokenThreshold || 6000 }}</span><span class="arrow">></span></div>
        </div>
        <div class="automation-result" :class="{ off: !selectedChat.autoSummaryEnabled }">
          <b>按照现在的设置：</b>
          <span>{{ automationSummary }}</span>
          <small v-if="selectedChat.autoSummaryEnabled">当前还有 {{ unsummarizedCount }} 条消息未整理。</small>
        </div>
      </div>

      <template v-if="selectedChat.autoSummaryEnabled">
        <div class="section-label">可选：需要更早整理吗？</div>
        <div class="glass-panel">
          <div class="glass-list-item" @click="extraTriggersVisible = !extraTriggersVisible">
            <div class="item-copy">
              <div class="item-label">额外的自动整理条件</div>
              <div class="item-help">这些全部不是必选项。不清楚作用时保持默认即可。</div>
            </div>
            <div class="item-value"><span class="item-value-text">{{ enabledExtraTriggerCount ? `已开启 ${enabledExtraTriggerCount} 项` : '均未开启' }}</span><span class="fold-arrow" :class="{ open: extraTriggersVisible }">⌄</span></div>
          </div>
          <template v-if="extraTriggersVisible">
            <div class="glass-list-item">
              <div class="item-copy">
                <div class="item-label">遇到重要标记时整理</div>
                <div class="item-help">有未整理消息被标记为重要时，提前整理，避免以后遗漏。建议开启。</div>
              </div>
              <div class="item-value"><label class="switch" @click.stop><input type="checkbox" v-model="selectedChat.autoSummaryOnImportant" @change="saveCurrentChat"><span class="slider"></span></label></div>
            </div>
            <div class="glass-list-item">
              <div class="item-copy">
                <div class="item-label">聊天换了话题时整理</div>
                <div class="item-help">系统发现最近内容和前面明显不同时提前整理。经常快速换话题的人建议关闭。</div>
              </div>
              <div class="item-value"><label class="switch" @click.stop><input type="checkbox" v-model="selectedChat.autoSummaryOnTopicChange" @change="saveCurrentChat"><span class="slider"></span></label></div>
            </div>
            <div class="glass-list-item">
              <div class="item-copy">
                <div class="item-label">离开聊天时整理</div>
                <div class="item-help">返回聊天列表前整理全部积压内容。需要等待接口返回，离开页面可能变慢。</div>
              </div>
              <div class="item-value"><label class="switch" @click.stop><input type="checkbox" v-model="selectedChat.autoSummaryOnExit" @change="saveCurrentChat"><span class="slider"></span></label></div>
            </div>
            <div class="glass-list-item" @click="openTextModal('停止聊天多久后整理', String(selectedChat.autoSummaryIdleMinutes || 0), '0', '分钟，0 表示关闭', 'autoSummaryIdleMinutes')">
              <div class="item-copy">
                <div class="item-label">停止聊天一段时间后整理</div>
                <div class="item-help">停止发送消息达到设定分钟数后整理。0 表示关闭，普通用户无需设置。</div>
              </div>
              <div class="item-value"><span class="item-value-text">{{ selectedChat.autoSummaryIdleMinutes ? `${selectedChat.autoSummaryIdleMinutes} 分钟` : '关闭' }}</span><span class="arrow">></span></div>
            </div>
          </template>
        </div>
      </template>

      <div class="section-label">记忆搜索方式</div>
      <div class="glass-panel">
        <div class="vector-status">
          <div class="status-icon" :class="{ active: vectorReady }">{{ vectorReady ? '✓' : '普' }}</div>
          <div class="status-copy">
            <b>{{ vectorReady ? '智能记忆搜索已开启' : '正在使用普通记忆搜索' }}</b>
            <span v-if="vectorReady">系统会利用已配置的向量模型，更准确地寻找和当前话题意思相近的旧记忆。</span>
            <span v-else>不需要配置任何模型，也能正常总结和读取记忆。系统会按照关键词、重要程度和时间寻找旧记忆。</span>
          </div>
        </div>
        <div v-if="vectorReady" class="glass-list-item" :class="{ 'disabled-block': isIndexing }" @click="rebuildVectorIndex">
          <div class="item-copy">
            <div class="item-label">重新整理搜索索引</div>
            <div class="item-help">只有更换向量模型后才需要操作，平时不用点。</div>
          </div>
          <div class="item-value"><span class="item-value-text">{{ isIndexing ? '处理中...' : '重新建立' }}</span><span class="arrow">></span></div>
        </div>
        <div v-else class="plain-guidance">
          <b>需要配置吗？</b>
          <span>通常不需要。只有保存了非常多记忆，并且普通搜索经常找不到相关内容时，再到“API 节点配置 → 向量节点”开启。</span>
        </div>
      </div>

      <div class="section-label">高级设置</div>
      <div class="glass-panel">
        <div class="glass-list-item" @click="advancedVisible = !advancedVisible">
          <div class="item-copy">
            <div class="item-label">更多专业设置</div>
            <div class="item-help">默认值已经适合大多数人，不懂这些选项时完全不用修改。</div>
          </div>
          <div class="item-value"><span class="item-value-text">{{ advancedVisible ? '收起' : '展开' }}</span><span class="fold-arrow" :class="{ open: advancedVisible }">⌄</span></div>
        </div>
        <template v-if="advancedVisible">
          <div class="glass-list-item" @click="openTextModal('一次最多整理多少条', String(selectedChat.memoryBatchSize || 150), '150', '建议 100-200，允许 20-500', 'memoryBatchSize')">
            <div class="item-copy">
              <div class="item-label">一次最多整理多少条</div>
              <div class="item-help">积压很多消息时会自动分批。建议保持 150；调大可能更慢，调小会增加请求次数。</div>
            </div>
            <div class="item-value"><span class="item-value-text">{{ selectedChat.memoryBatchSize || 150 }} 条</span><span class="arrow">></span></div>
          </div>
        <div class="glass-list-item" @click="openTextModal('每次最多读取多少旧记忆', String(selectedChat.memoryTokenBudget || 1200), '1200', '建议保持 1200', 'memoryTokenBudget')">
          <div class="item-copy">
            <div class="item-label">每次最多读取多少旧记忆</div>
            <div class="item-help">建议保持 1200。调大会读取更多历史，但可能更费额度、干扰当前聊天。</div>
          </div>
          <div class="item-value"><span class="item-value-text">{{ selectedChat.memoryTokenBudget || 1200 }} Token</span><span class="arrow">></span></div>
        </div>
        <div class="glass-list-item">
          <div class="item-copy">
            <div class="item-label">自动压缩很久以前的记忆</div>
            <div class="item-help">阶段总结过多时生成一条更精简的长期总结。建议开启，原记录不会被删除。</div>
          </div>
          <div class="item-value"><label class="switch" @click.stop><input type="checkbox" v-model="selectedChat.autoMemoryConsolidation" @change="saveCurrentChat"><span class="slider"></span></label></div>
        </div>
        <div class="glass-list-item" :class="{ 'disabled-block': selectedChat.autoMemoryConsolidation === false }" @click="openTextModal('积累多少段后自动压缩', String(selectedChat.memoryConsolidationThreshold || 8), '8', '建议保持 8，可填写 4-20', 'memoryConsolidationThreshold')">
          <div class="item-copy">
            <div class="item-label">积累多少段后压缩</div>
            <div class="item-help">建议保持 8。数字越小，旧总结被压缩得越频繁。</div>
          </div>
          <div class="item-value"><span class="item-value-text">{{ selectedChat.memoryConsolidationThreshold || 8 }} 条摘要</span><span class="arrow">></span></div>
        </div>
        <div
          class="glass-list-item"
          @click="openLongTextModal('编辑总结提示词', selectedChat.summaryPrompt || '', defaultSummaryPrompt, '输入总结提示词，建议100-300字...', 'summaryPrompt')"
        >
          <div class="item-copy">
            <div class="item-label">告诉系统要特别注意什么</div>
            <div class="item-help">用于补充特殊要求，例如“重点记住日期”。普通用户使用默认内容即可。</div>
          </div>
          <div class="item-value">
            <span class="item-value-text">{{ promptStatusText }}</span>
            <span class="arrow">></span>
          </div>
        </div>
        <div
          class="glass-list-item"
          @click="presetsModalVisible = true"
        >
          <div class="item-copy">
            <div class="item-label">保存和切换特殊要求</div>
            <div class="item-help">需要在不同总结要求之间切换时使用，普通用户无需设置。</div>
          </div>
          <div class="item-value">
            <span class="item-value-text">管理</span>
            <span class="arrow">></span>
          </div>
        </div>
        </template>
      </div>

      <div class="section-label">需要帮助？</div>
      <div class="glass-panel">
        <div class="glass-list-item" @click="tutorialVisible = true">
          <div class="item-copy">
            <div class="item-label">查看当前设置的详细教程</div>
            <div class="item-help">教程会按照你现在选择的总结方式、自动条件和搜索方式进行说明。</div>
          </div>
          <div class="item-value"><span class="arrow">></span></div>
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
        <div class="choice-title">{{ choiceModal === 'mode' ? '你想怎样整理记忆？' : '什么时候开始自动整理？' }}</div>
        <div class="choice-intro">
          {{ choiceModal === 'mode'
            ? '所有方式都不要求配置向量模型。只需按照自己最想保留的内容选择。'
            : '这只决定开始整理的时间，不会改变总结出来的内容。普通用户选择推荐项即可。' }}
        </div>
        <div class="choice-list">
          <div v-for="item in (choiceModal === 'mode' ? modeOptions : triggerOptions)" :key="item.value" class="choice-item" @click="selectChoice(item.value)">
            <div>
              <div class="choice-name">{{ item.label }}</div>
              <div class="choice-desc">{{ item.desc }}</div>
              <div v-if="choiceModal === 'mode'" class="choice-requirement">无需向量模型 · 可随时更换</div>
            </div>
            <div class="choice-check" v-if="(choiceModal === 'mode' ? (selectedChat?.memoryMode || 'hybrid') : (selectedChat?.autoSummaryTrigger || 'both')) === item.value">✓</div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="tutorialVisible" class="wb-modal-overlay" @click.self="tutorialVisible = false">
      <div class="tutorial-modal">
        <div class="tutorial-header"><div class="choice-title">长期记忆使用教程</div><div class="tutorial-close" @click="tutorialVisible = false">×</div></div>
        <div class="tutorial-body">
          <div class="tutorial-summary">
            <b>你现在的设置</b>
            <span>总结方式：{{ currentMode.label }}</span>
            <span>自动整理：{{ selectedChat?.autoSummaryEnabled ? '已开启' : '未开启' }}</span>
            <span>记忆搜索：{{ vectorReady ? '智能记忆搜索' : '普通记忆搜索' }}</span>
          </div>
          <div class="tutorial-step">
            <b>1. 你选择的“{{ currentMode.label }}”会做什么？</b>
            <span>{{ currentMode.result }}</span>
            <span class="tutorial-example">例子：{{ currentMode.example }}</span>
            <span>适合：{{ currentMode.suitable }}</span>
          </div>
          <div class="tutorial-step">
            <b>2. 自动整理现在会怎样工作？</b>
            <span>{{ automationSummary }}</span>
            <span v-if="!selectedChat?.autoSummaryEnabled">如果希望系统自己处理，请回到页面开启“自动整理记忆”。不开启也不会丢失聊天，你仍可点击“立即总结”。</span>
            <span v-else-if="selectedChat?.autoSummaryTrigger === 'count'">系统只看未整理消息的数量，不考虑每条消息有多长。</span>
            <span v-else-if="selectedChat?.autoSummaryTrigger === 'token'">Token 只是衡量文字长度的单位，不需要自己计算，系统会自动估算。</span>
            <span v-else>消息很多或单条消息很长，任意一种情况达到设置值都会开始整理。</span>
          </div>
          <div v-if="selectedChat?.autoSummaryEnabled" class="tutorial-step">
            <b>3. 额外条件需要开启吗？</b>
            <span>它们都不是必选项。重要标记适合防止重点被遗漏；话题切换可能更频繁触发；离开时整理可能让返回页面变慢；停止聊天后整理适合希望及时保存的人。</span>
            <span>如果不确定，建议只开启“遇到重要标记时整理”，其他保持关闭。</span>
          </div>
          <div class="tutorial-step">
            <b>{{ selectedChat?.autoSummaryEnabled ? '4' : '3' }}. 需要配置向量模型吗？</b>
            <span v-if="vectorReady">你已经配置了向量模型，智能记忆搜索正在工作。它只负责更准确地寻找旧记忆，不负责生成总结。</span>
            <span v-else>不需要。当前普通记忆搜索可以正常工作，会根据关键词、重要程度和时间寻找旧记忆。向量模型只是在记忆特别多时提高搜索准确度。</span>
            <span>无论有没有向量模型，“{{ currentMode.label }}”都会保存相同类型的记忆。</span>
          </div>
          <div class="tutorial-step">
            <b>{{ selectedChat?.autoSummaryEnabled ? '5' : '4' }}. 高级设置需要修改吗？</b>
            <span>通常不需要。一次整理 150 条、每次读取 1200 Token、每 8 段压缩一次，已经适合大多数聊天。</span>
            <span>只有遇到整理失败、费用明显增加或读取旧记忆太少时，才建议逐项调整。</span>
          </div>
          <div class="tutorial-step">
            <b>{{ selectedChat?.autoSummaryEnabled ? '6' : '5' }}. 怎样检查结果？</b>
            <span>整理完成后，点击页面上方的“结构化记忆”查看事件、人物资料、表格和关系。发现错误可以直接修改或删除；重要资料可以锁定，避免以后被自动覆盖。</span>
          </div>
          <div class="tutorial-note">最简单的用法：选择一种总结方式，开启自动整理，然后保持所有推荐值。向量模型和高级设置都不是必需项。</div>
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
        :member-memories="selectedChat?.chatType === 'group' ? selectedChat.memberMemories : undefined"
        :member-names="groupMemberNames"
        @close="structuredMemoryVisible = false"
        @update-state="updateStructuredState"
        @update-member-memories="updateMemberMemories"
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

.step-label {
  color: var(--text-secondary, #666);
  font-size: 13px;
}

.step-label span {
  display: inline-block;
  margin-right: 5px;
  padding: 2px 7px;
  border-radius: 10px;
  color: var(--theme-color, #5b8def);
  background: color-mix(in srgb, var(--theme-color, #5b8def) 12%, white);
  font-size: 11px;
  font-weight: 600;
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
  gap: 14px;
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
  line-height: 1.35;
}

.item-copy {
  min-width: 0;
  flex: 1 1 auto;
}

.item-help {
  margin-top: 4px;
  color: var(--text-tertiary, #999);
  font-size: 11px;
  line-height: 1.45;
}

.item-value {
  font-size: 15px;
  color: var(--text-secondary, #666);
  display: flex;
  align-items: center;
  gap: 8px;
  text-align: right;
  flex: 0 1 auto;
  justify-content: flex-end;
  overflow: hidden;
  min-width: fit-content;
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

.mode-explanation {
  padding: 15px 16px 16px;
  background: color-mix(in srgb, var(--theme-color, #5b8def) 5%, #fff);
  border-top: 1px solid rgba(0, 0, 0, 0.05);
}

.explanation-kicker {
  display: inline-block;
  padding: 3px 8px;
  border-radius: 10px;
  color: var(--theme-color, #5b8def);
  background: color-mix(in srgb, var(--theme-color, #5b8def) 12%, white);
  font-size: 11px;
  font-weight: 600;
}

.explanation-text {
  margin: 9px 0 8px;
  color: var(--text-primary, #222);
  font-size: 13px;
  line-height: 1.6;
}

.explanation-row {
  margin-top: 4px;
  color: var(--text-secondary, #666);
  font-size: 11px;
  line-height: 1.55;
}

.explanation-row b {
  color: var(--text-primary, #333);
}

.safe-note {
  margin-top: 10px;
  padding: 8px 10px;
  border-radius: 8px;
  color: #417453;
  background: #edf8f0;
  font-size: 11px;
  line-height: 1.5;
}

.automation-result {
  display: flex;
  flex-direction: column;
  gap: 5px;
  margin: 12px;
  padding: 11px 12px;
  border-radius: 10px;
  color: #315f9c;
  background: #edf4ff;
  font-size: 12px;
  line-height: 1.55;
}

.automation-result.off {
  color: var(--text-secondary, #666);
  background: #f1f1f2;
}

.automation-result small {
  color: var(--text-tertiary, #888);
  font-size: 11px;
}

.fold-arrow {
  display: inline-block;
  color: var(--text-tertiary, #999);
  font-size: 20px;
  line-height: 1;
  transform: rotate(0);
  transition: transform .2s;
}

.fold-arrow.open {
  transform: rotate(180deg);
}

.vector-status {
  display: flex;
  align-items: flex-start;
  gap: 11px;
  padding: 15px 16px;
}

.status-icon {
  display: flex;
  width: 30px;
  height: 30px;
  flex: 0 0 30px;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  color: #6c6c72;
  background: #ececef;
  font-size: 12px;
  font-weight: 700;
}

.status-icon.active {
  color: #fff;
  background: var(--theme-color, #5b8def);
}

.status-copy {
  display: flex;
  flex-direction: column;
  gap: 5px;
  min-width: 0;
}

.status-copy b {
  color: var(--text-primary, #222);
  font-size: 14px;
}

.status-copy span,
.plain-guidance span {
  color: var(--text-secondary, #666);
  font-size: 11px;
  line-height: 1.55;
}

.plain-guidance {
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: 11px 16px 14px 57px;
  border-top: 1px solid rgba(0, 0, 0, 0.05);
}

.plain-guidance b {
  color: var(--text-primary, #333);
  font-size: 12px;
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
.choice-title { padding: 18px 20px 8px; font-size: 17px; font-weight: 600; color: var(--text-primary, #222); }
.choice-intro { padding: 0 20px 10px; color: var(--text-tertiary, #888); font-size: 11px; line-height: 1.55; }
.choice-list { max-height: 62vh; overflow-y: auto; padding: 0 10px 12px; }
.choice-item { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 13px 10px; border-radius: 11px; cursor: pointer; }
.choice-item:active { background: var(--sys-bg-primary, #f5f5f7); }
.choice-name { font-size: 14px; color: var(--text-primary, #222); }
.choice-desc { margin-top: 3px; font-size: 11px; line-height: 1.4; color: var(--text-tertiary, #999); }
.choice-requirement { display: inline-block; margin-top: 6px; padding: 2px 6px; border-radius: 6px; color: #417453; background: #edf8f0; font-size: 10px; }
.choice-check { color: var(--theme-color, #5b8def); font-weight: 700; }
.tutorial-modal { width: 90%; max-width: 390px; max-height: 78vh; overflow: hidden; border-radius: 18px; background: var(--sys-bg-secondary, #fff); }
.tutorial-header { display: flex; align-items: center; justify-content: space-between; padding-right: 16px; border-bottom: 1px solid rgba(0,0,0,.05); }
.tutorial-close { width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border-radius: 50%; color: var(--text-secondary, #666); font-size: 22px; cursor: pointer; }
.tutorial-body { max-height: 62vh; overflow-y: auto; padding: 14px 20px 20px; }
.tutorial-step { padding: 11px 0; border-bottom: 1px solid rgba(0,0,0,.05); }
.tutorial-step b { display: block; margin-bottom: 4px; font-size: 14px; color: var(--text-primary, #222); }
.tutorial-step span { display: block; font-size: 12px; line-height: 1.55; color: var(--text-secondary, #666); }
.tutorial-step span + span { margin-top: 6px; }
.tutorial-example { padding: 7px 9px; border-radius: 7px; background: var(--sys-bg-primary, #f6f6f7); }
.tutorial-summary { display: flex; flex-direction: column; gap: 5px; margin-bottom: 8px; padding: 11px 12px; border-radius: 10px; color: #315f9c; background: #edf4ff; font-size: 12px; line-height: 1.45; }
.tutorial-summary b { margin-bottom: 2px; color: #244c82; font-size: 13px; }
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
