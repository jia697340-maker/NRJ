/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { computed, ref } from 'vue'
import { globalPromptSettings, offlinePresetSettings } from '../../../store'
import {
  createOfflinePresetCopy,
  createOfflineEntriesFromLegacy,
  getOfflinePresetEntries,
  getOfflineModelProfileLabel,
  syncOfflinePresetLegacyFields,
  validateImportedOfflinePresets,
  type OfflinePromptEntry,
  type OfflinePromptSection,
  type OfflineModelProfile,
  type OfflinePromptPreset
} from '../../../services/offlinePresets'
import { getEnglishOfflinePreset } from '../../../services/offlinePresetEnglish'
import { buildOfflinePromptGenerationGuide, generateOfflinePromptOnline, parseGeneratedOfflinePrompt, type GeneratedOfflinePromptPayload } from '../../../services/promptSchemeAI'

const props = defineProps<{ visible: boolean; selectedChat: any }>()
const emit = defineEmits<{ (e: 'close'): void; (e: 'save'): void }>()

const currentView = ref<'list' | 'detail'>('list')
const detailMenuVisible = ref(false)

const editorDraft = ref<OfflinePromptPreset | null>(null)
const editorStoredPreset = ref<OfflinePromptPreset | null>(null)
const editorMode = ref<'entries' | 'raw'>('entries')
const editorEntries = ref<OfflinePromptEntry[]>([])
const expandedEntryId = ref('')
const draggedEntryIndex = ref<number | null>(null)
const rawModeSnapshot = ref({ mainPrompt: '', modePrompt: '', postHistoryPrompt: '' })
const fileInput = ref<HTMLInputElement | null>(null)
const toast = ref({ visible: false, message: '' })
const confirmState = ref({ visible: false, message: '', resolve: null as null | ((value: boolean) => void) })
const aiVisible = ref(false)
const aiRequirement = ref('')
const aiPaste = ref('')
const aiLoading = ref(false)
const aiError = ref('')
const aiResult = ref<GeneratedOfflinePromptPayload | null>(null)
const aiUnknownVariables = ref<string[]>([])
let aiController: AbortController | null = null
let toastTimer: ReturnType<typeof setTimeout> | null = null

const modelProfiles: OfflineModelProfile[] = ['auto', 'openai-compatible', 'openai-responses', 'deepseek-chat', 'deepseek-reasoner', 'glm', 'claude', 'gemini']
const selectedPresetId = computed(() => props.selectedChat?.offlinePresetId || offlinePresetSettings.currentPresetId || 'offline_default')

const officialPresets = computed(() => offlinePresetSettings.presets.filter(p => p.source === 'builtin'))
const customPresets = computed(() => offlinePresetSettings.presets.filter(p => p.source === 'user'))

const showToast = (message: string) => {
  toast.value = { visible: true, message }
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toast.value.visible = false }, 2200)
}

const askConfirm = (message: string) => new Promise<boolean>(resolve => {
  confirmState.value = { visible: true, message, resolve }
})
const settleConfirm = (value: boolean) => {
  confirmState.value.resolve?.(value)
  confirmState.value = { visible: false, message: '', resolve: null }
}

const localizedPreset = (preset: OfflinePromptPreset) => {
  if (globalPromptSettings.language === 'en') return getEnglishOfflinePreset(preset)
  const chinese = preset.source === 'user' ? preset.languageVariants?.zh : undefined
  return chinese ? { ...preset, ...chinese } : preset
}

const selectPreset = (preset: OfflinePromptPreset) => {
  props.selectedChat.offlinePresetId = preset.id
  offlinePresetSettings.currentPresetId = preset.id
  emit('save')
}

const selectProfile = (profile: OfflineModelProfile) => {
  props.selectedChat.offlineModelProfile = profile
  emit('save')
}

const openDetail = (preset: OfflinePromptPreset) => {
  editorStoredPreset.value = JSON.parse(JSON.stringify(preset))
  editorDraft.value = JSON.parse(JSON.stringify(localizedPreset(preset)))
  editorEntries.value = getOfflinePresetEntries(editorDraft.value!)
  editorMode.value = 'entries'
  expandedEntryId.value = ''
  currentView.value = 'detail'
  detailMenuVisible.value = false
}

const openCopy = (preset: OfflinePromptPreset) => {
  const copy = createOfflinePresetCopy(preset)
  const english = getEnglishOfflinePreset(preset)
  copy.languageVariants = {
    zh: { mainPrompt: preset.mainPrompt, modePrompt: preset.modePrompt, postHistoryPrompt: preset.postHistoryPrompt, entries: preset.entries ? JSON.parse(JSON.stringify(preset.entries)) : undefined },
    en: { mainPrompt: english.mainPrompt, modePrompt: english.modePrompt, postHistoryPrompt: english.postHistoryPrompt, entries: english.entries ? JSON.parse(JSON.stringify(english.entries)) : undefined }
  }
  editorStoredPreset.value = JSON.parse(JSON.stringify(copy))
  editorDraft.value = JSON.parse(JSON.stringify(localizedPreset(copy)))
  editorEntries.value = getOfflinePresetEntries(editorDraft.value!)
  editorMode.value = 'entries'
  expandedEntryId.value = ''
  currentView.value = 'detail'
  detailMenuVisible.value = false
}

const goBack = () => {
  currentView.value = 'list'
  detailMenuVisible.value = false
  editorDraft.value = null
  editorStoredPreset.value = null
}

const sectionLabels: Record<OfflinePromptSection, string> = {
  main: '主要任务',
  mode: '线下模式',
  postHistory: '回复规则'
}

const setEditorMode = (mode: 'entries' | 'raw') => {
  const draft = editorDraft.value
  if (!draft || editorMode.value === mode) return
  if (mode === 'raw') {
    draft.entries = JSON.parse(JSON.stringify(editorEntries.value))
    syncOfflinePresetLegacyFields(draft)
    rawModeSnapshot.value = {
      mainPrompt: draft.mainPrompt,
      modePrompt: draft.modePrompt,
      postHistoryPrompt: draft.postHistoryPrompt
    }
  } else {
    const rawChanged = draft.mainPrompt !== rawModeSnapshot.value.mainPrompt
      || draft.modePrompt !== rawModeSnapshot.value.modePrompt
      || draft.postHistoryPrompt !== rawModeSnapshot.value.postHistoryPrompt
    if (rawChanged) {
      draft.entries = undefined
      editorEntries.value = createOfflineEntriesFromLegacy(draft)
      expandedEntryId.value = editorEntries.value[0]?.id || ''
    }
  }
  editorMode.value = mode
}

const addEntry = () => {
  if (editorDraft.value?.source === 'builtin') return
  const entry: OfflinePromptEntry = {
    id: `offline_entry_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name: `新条目 ${editorEntries.value.length + 1}`,
    content: '',
    enabled: true,
    section: 'mode'
  }
  editorEntries.value.push(entry)
  expandedEntryId.value = entry.id
}

const duplicateEntry = (index: number) => {
  if (editorDraft.value?.source === 'builtin') return
  const source = editorEntries.value[index]
  const copy = { ...source, id: `offline_entry_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, name: `${source.name} 副本` }
  editorEntries.value.splice(index + 1, 0, copy)
  expandedEntryId.value = copy.id
}

const moveEntry = (index: number, offset: number) => {
  if (editorDraft.value?.source === 'builtin') return
  const target = index + offset
  if (target < 0 || target >= editorEntries.value.length) return
  const [entry] = editorEntries.value.splice(index, 1)
  editorEntries.value.splice(target, 0, entry)
}

const startEntryDrag = (index: number) => {
  if (editorDraft.value?.source === 'builtin') return
  draggedEntryIndex.value = index
}

const dragEntryOver = (event: DragEvent, targetIndex: number) => {
  if (editorDraft.value?.source === 'builtin') return
  event.preventDefault()
  const sourceIndex = draggedEntryIndex.value
  if (sourceIndex === null || sourceIndex === targetIndex) return
  const [entry] = editorEntries.value.splice(sourceIndex, 1)
  editorEntries.value.splice(targetIndex, 0, entry)
  draggedEntryIndex.value = targetIndex
}

const endEntryDrag = () => {
  draggedEntryIndex.value = null
}

const deleteEntry = (index: number) => {
  if (editorDraft.value?.source === 'builtin') return
  const [removed] = editorEntries.value.splice(index, 1)
  if (expandedEntryId.value === removed?.id) expandedEntryId.value = ''
}

const saveEditor = () => {
  const draft = editorDraft.value
  if (!draft) return
  if (draft.source === 'builtin') {
    showToast('官方预设不可修改')
    return
  }
  
  if (editorMode.value === 'entries') {
    draft.entries = JSON.parse(JSON.stringify(editorEntries.value))
    syncOfflinePresetLegacyFields(draft)
  } else {
    draft.entries = createOfflineEntriesFromLegacy(draft)
  }
  if (!draft.name.trim() || !draft.mainPrompt.trim() || !draft.postHistoryPrompt.trim()) {
    showToast('名称、主提示词和末尾规则不能为空')
    return
  }
  const stored = JSON.parse(JSON.stringify(editorStoredPreset.value || draft)) as OfflinePromptPreset
  stored.name = draft.name
  stored.description = draft.description
  stored.languageVariants ||= {}
  const localized = {
    mainPrompt: draft.mainPrompt,
    modePrompt: draft.modePrompt,
    postHistoryPrompt: draft.postHistoryPrompt,
    entries: draft.entries ? JSON.parse(JSON.stringify(draft.entries)) : undefined
  }
  stored.languageVariants[globalPromptSettings.language] = localized
  if (globalPromptSettings.language === 'zh') Object.assign(stored, localized)
  const index = offlinePresetSettings.presets.findIndex(item => item.id === draft.id)
  if (index >= 0) {
    offlinePresetSettings.presets[index] = stored
  } else {
    offlinePresetSettings.presets.push(stored)
  }
  props.selectedChat.offlinePresetId = draft.id
  offlinePresetSettings.currentPresetId = draft.id
  emit('save')
  showToast('线下预设已保存')
  goBack()
}

const resetToDefault = async () => {
  const draft = editorDraft.value
  if (!draft || !draft.originalPresetId) return
  if (!await askConfirm('这会清除当前语言下的修改，恢复为官方初始状态。确认重置吗？')) return
  
  const original = offlinePresetSettings.presets.find(p => p.id === draft.originalPresetId)
  if (!original) {
    showToast('无法找到原版官方预设，重置失败')
    detailMenuVisible.value = false
    return
  }

  // 完全覆盖草稿数据（保留当前副本的 ID、Name、Description 和 originalPresetId）
  const localizedOriginal = localizedPreset(original)
  draft.mainPrompt = localizedOriginal.mainPrompt
  draft.modePrompt = localizedOriginal.modePrompt
  draft.postHistoryPrompt = localizedOriginal.postHistoryPrompt
  draft.entries = localizedOriginal.entries ? JSON.parse(JSON.stringify(localizedOriginal.entries)) : undefined
  
  // 重新加载编辑器状态
  editorEntries.value = getOfflinePresetEntries(draft)
  setEditorMode('entries')
  expandedEntryId.value = ''
  
  showToast('已恢复为官方默认参数，请点击保存')
  detailMenuVisible.value = false
}

const deleteCurrentPreset = async () => {
  const draft = editorDraft.value
  if (!draft || draft.source === 'builtin') return
  if (!await askConfirm(`确定要删除预设“${draft.name}”吗？`)) return
  
  offlinePresetSettings.presets = offlinePresetSettings.presets.filter(item => item.id !== draft.id)
  if (selectedPresetId.value === draft.id) {
    props.selectedChat.offlinePresetId = 'offline_default'
    offlinePresetSettings.currentPresetId = 'offline_default'
  }
  emit('save')
  showToast('已删除预设')
  goBack()
}

const exportSinglePreset = () => {
  const draft = editorDraft.value
  if (!draft) return
  const data = {
    schema: 'clingy-offline-presets',
    version: 1,
    presets: [draft]
  }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `线下预设-${draft.name}-${new Date().toISOString().slice(0, 10)}.json`
  anchor.click()
  URL.revokeObjectURL(url)
  showToast('已导出该预设')
  detailMenuVisible.value = false
}

const importPresets = async (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  try {
    const parsed = JSON.parse(await file.text())
    const imported = validateImportedOfflinePresets(parsed)
    offlinePresetSettings.presets.push(...imported)
    showToast(`已导入 ${imported.length} 个预设`)
    emit('save')
  } catch (error: any) {
    showToast(error?.message || '导入失败，请检查文件格式')
  }
}

const copyAiGuide = async () => {
  const draft = editorDraft.value
  if (!draft) return
  await navigator.clipboard.writeText(buildOfflinePromptGenerationGuide(globalPromptSettings.language, draft))
  showToast('已复制线下预设生成说明')
}

const openAi = () => {
  aiVisible.value = true
  aiError.value = ''
  aiResult.value = null
  aiUnknownVariables.value = []
}

const runAi = async () => {
  const draft = editorDraft.value
  if (!draft || aiLoading.value) return
  aiController = new AbortController()
  aiLoading.value = true
  aiError.value = ''
  try {
    const result = await generateOfflinePromptOnline({ requirement: aiRequirement.value, language: globalPromptSettings.language, current: draft, signal: aiController.signal })
    aiResult.value = result.payload
    aiUnknownVariables.value = result.unknownVariables
  } catch (error: any) {
    if (error?.name !== 'AbortError') aiError.value = error?.message || '在线生成失败'
  } finally {
    aiLoading.value = false
    aiController = null
  }
}
const stopAi = () => aiController?.abort()

const parseAiPaste = () => {
  try {
    const result = parseGeneratedOfflinePrompt(aiPaste.value)
    aiResult.value = result.payload
    aiUnknownVariables.value = result.unknownVariables
    aiError.value = ''
  } catch (error: any) {
    aiError.value = error?.message || '无法解析 AI 返回内容'
  }
}

const applyAi = () => {
  const result = aiResult.value
  const source = editorStoredPreset.value || editorDraft.value
  if (!result || !source) return
  const copy = createOfflinePresetCopy(source, result.name)
  copy.description = result.description
  const localized = { mainPrompt: result.mainPrompt, modePrompt: result.modePrompt, postHistoryPrompt: result.postHistoryPrompt }
  copy.languageVariants ||= {}
  copy.languageVariants[globalPromptSettings.language] = localized
  if (globalPromptSettings.language === 'zh') Object.assign(copy, localized)
  editorStoredPreset.value = JSON.parse(JSON.stringify(copy))
  editorDraft.value = JSON.parse(JSON.stringify(localizedPreset(copy)))
  editorEntries.value = getOfflinePresetEntries(editorDraft.value!)
  editorMode.value = 'raw'
  aiVisible.value = false
  showToast('已生成新的线下预设草稿')
}
</script>

<template>
  <div v-if="visible" class="modal-overlay" @click.self="emit('close')">
    <!-- 第一层：主列表页 -->
    <div v-if="currentView === 'list'" class="preset-modal">
      <div class="modal-header">
        <div>
          <div class="nav-title">线下预设</div>
          <div class="nav-subtitle">OFFLINE PRESETS</div>
        </div>
        <div class="header-actions">
          <button class="text-btn" @click="fileInput?.click()">导入</button>
          <button class="close-btn" @click="emit('close')">关闭</button>
        </div>
        <input ref="fileInput" class="hidden-file-input" type="file" accept="application/json,.json" @change="importPresets">
      </div>

      <div class="modal-scroll">
        <section class="modal-section">
          <div class="section-title">模型适配</div>
          <div class="profile-grid">
            <div
              v-for="profile in modelProfiles"
              :key="profile"
              class="profile-option"
              :class="{ active: (selectedChat.offlineModelProfile || 'auto') === profile }"
              @click="selectProfile(profile)"
            >
              <span>{{ getOfflineModelProfileLabel(profile) }}</span>
              <span v-if="(selectedChat.offlineModelProfile || 'auto') === profile" class="profile-check">选中</span>
            </div>
          </div>
          <div class="section-hint">自动模式会根据当前 API 节点与模型名称选择请求协议。仅在中转识别错误时手动指定。</div>
        </section>

        <section class="modal-section preset-section">
          <div class="section-title">官方推荐</div>
          <div class="preset-list">
            <div
              v-for="preset in officialPresets"
              :key="preset.id"
              class="preset-item-wrap"
            >
              <div class="preset-item" :class="{ active: selectedPresetId === preset.id }" @click="selectPreset(preset)">
                <div class="preset-info">
                  <div class="preset-name-line">
                    <span class="preset-name">{{ preset.name }}</span>
                    <span class="source-tag builtin">官方</span>
                  </div>
                  <span class="preset-preview">{{ preset.description || '未填写说明' }}</span>
                </div>
                <div class="preset-check" :class="{ checked: selectedPresetId === preset.id }">
                  <span v-if="selectedPresetId === preset.id">当前</span>
                </div>
              </div>
              <div class="item-enter" @click="openDetail(preset)">详情</div>
            </div>
          </div>
        </section>

        <section class="modal-section preset-section">
          <div class="section-title">我的预设</div>
          <div v-if="!customPresets.length" class="empty-hint">暂无自定义预设，您可以复制官方预设进行修改或导入。</div>
          <div class="preset-list">
            <div
              v-for="preset in customPresets"
              :key="preset.id"
              class="preset-item-wrap"
            >
              <div class="preset-item" :class="{ active: selectedPresetId === preset.id }" @click="selectPreset(preset)">
                <div class="preset-info">
                  <div class="preset-name-line">
                    <span class="preset-name">{{ preset.name }}</span>
                    <span class="source-tag user">自定义</span>
                  </div>
                  <span class="preset-preview">{{ preset.description || '未填写说明' }}</span>
                </div>
                <div class="preset-check" :class="{ checked: selectedPresetId === preset.id }">
                  <span v-if="selectedPresetId === preset.id">当前</span>
                </div>
              </div>
              <div class="item-enter" @click="openDetail(preset)">编辑</div>
            </div>
          </div>
        </section>
      </div>
    </div>

    <!-- 第二层：独立详情/编辑页 -->
    <div v-if="currentView === 'detail' && editorDraft" class="preset-modal detail-modal">
      <div class="modal-header">
        <button class="nav-back-btn" @click="goBack">返回</button>
        <span class="editor-title">{{ editorDraft.name || '编辑预设' }} · {{ globalPromptSettings.language === 'en' ? 'EN' : '中文' }}</span>
        <div class="header-right">
          <button class="nav-menu-btn" @click="detailMenuVisible = !detailMenuVisible">更多</button>
          <!-- 更多菜单弹窗 -->
          <div v-if="detailMenuVisible" class="detail-menu">
            <button class="menu-item" @click="exportSinglePreset">导出该预设</button>
            <button v-if="editorDraft.source === 'user' && editorDraft.originalPresetId" class="menu-item" @click="resetToDefault">恢复默认参数</button>
            <button v-if="editorDraft.source === 'user'" class="menu-item danger" @click="deleteCurrentPreset">删除该预设</button>
          </div>
        </div>
      </div>
      <!-- 点击空白处关闭菜单的遮罩 -->
      <div v-if="detailMenuVisible" class="menu-overlay" @click="detailMenuVisible = false"></div>

      <div class="editor-body">
        <div v-if="editorDraft.source === 'builtin'" class="readonly-notice">这是官方预设，不可修改。如需调整，请点击底部的“复制并修改”。</div>

        <label class="field-label">预设名称</label>
        <input v-model="editorDraft.name" class="field-input" maxlength="40" placeholder="请输入预设名称" :disabled="editorDraft.source === 'builtin'">
        
        <label class="field-label">说明</label>
        <input v-model="editorDraft.description" class="field-input" maxlength="100" placeholder="简要说明预设用途" :disabled="editorDraft.source === 'builtin'">
        
        <div class="editor-mode-switch">
          <button :class="{ active: editorMode === 'entries' }" @click="setEditorMode('entries')">条目模式</button>
          <button :class="{ active: editorMode === 'raw' }" @click="setEditorMode('raw')">大框模式</button>
        </div>

        <template v-if="editorMode === 'entries'">
          <div class="entries-toolbar">
            <span>{{ editorEntries.length }} 个条目</span>
            <button v-if="editorDraft.source === 'user'" @click="addEntry">新增条目</button>
          </div>
          <div class="entry-list">
            <div v-for="(entry, index) in editorEntries" :key="entry.id" class="entry-card" :class="{ disabled: !entry.enabled, dragging: draggedEntryIndex === index }" @dragover="dragEntryOver($event, index)">
              <div class="entry-card-head" @click="expandedEntryId = expandedEntryId === entry.id ? '' : entry.id">
                <span v-if="editorDraft.source === 'user'" class="entry-order" draggable="true" title="拖动排序" @click.stop @dragstart="startEntryDrag(index)" @dragend="endEntryDrag">排序</span>
                <div class="entry-summary">
                  <strong>{{ entry.name || `条目 ${index + 1}` }}</strong>
                  <span>{{ sectionLabels[entry.section] }} · {{ entry.content.length }} 字</span>
                </div>
                <label class="entry-switch" @click.stop>
                  <input v-model="entry.enabled" type="checkbox" :disabled="editorDraft.source === 'builtin'">
                  <div class="switch-box"><span class="switch-knob"></span></div>
                </label>
              </div>
              <div class="entry-card-controls">
                <span>{{ entry.enabled ? '参与提示词拼接' : '已停用，不会发送' }}</span>
                <div>
                  <button @click="expandedEntryId = expandedEntryId === entry.id ? '' : entry.id">{{ expandedEntryId === entry.id ? '收起' : '查看' }}</button>
                  <button v-if="editorDraft.source === 'user'" class="danger" @click="deleteEntry(index)">删除</button>
                </div>
              </div>
              <div v-if="expandedEntryId === entry.id" class="entry-card-body">
                <input v-model="entry.name" class="field-input" placeholder="条目名称" :disabled="editorDraft.source === 'builtin'">
                <div class="section-picker" :class="{ disabled: editorDraft.source === 'builtin' }">
                  <button v-for="(label, value) in sectionLabels" :key="value" :class="{ active: entry.section === value }" :disabled="editorDraft.source === 'builtin'" @click="entry.section = value">{{ label }}</button>
                </div>
                <textarea v-model="entry.content" class="field-textarea entry-textarea" spellcheck="false" placeholder="输入这一条提示词内容" :disabled="editorDraft.source === 'builtin'"></textarea>
                <div v-if="editorDraft.source === 'user'" class="entry-actions">
                  <button :disabled="index === 0" @click="moveEntry(index, -1)">上移</button>
                  <button :disabled="index === editorEntries.length - 1" @click="moveEntry(index, 1)">下移</button>
                  <button @click="duplicateEntry(index)">复制</button>
                </div>
              </div>
            </div>
            <div v-if="!editorEntries.length" class="entries-empty">还没有条目，点击“新增条目”开始编写。</div>
          </div>
        </template>

        <template v-else>
          <div class="raw-mode-note">原文模式适合整体粘贴或检查。切回条目模式时，会按下面三个用途重新生成条目。</div>
          <label class="field-label">Main Prompt</label>
          <textarea v-model="editorDraft.mainPrompt" class="field-textarea small" spellcheck="false" :disabled="editorDraft.source === 'builtin'"></textarea>
          <label class="field-label">线下模式上下文</label>
          <textarea v-model="editorDraft.modePrompt" class="field-textarea" spellcheck="false" :disabled="editorDraft.source === 'builtin'"></textarea>
          <label class="field-label">Post-History Instructions</label>
          <textarea v-model="editorDraft.postHistoryPrompt" class="field-textarea" spellcheck="false" :disabled="editorDraft.source === 'builtin'"></textarea>
        </template>
        <div v-pre class="editor-hint">可用变量：{{char_name}}、{{user_name}}。中文和英文内容会分别保存。</div>
      </div>
      
      <div class="editor-footer">
        <button class="footer-btn secondary" @click="copyAiGuide">复制给 AI</button>
        <button class="footer-btn secondary" @click="openAi">AI 生成</button>
        <button v-if="editorDraft.source === 'builtin'" class="footer-btn primary" @click="openCopy(editorStoredPreset || editorDraft)">复制并修改</button>
        <button v-else class="footer-btn primary" @click="saveEditor">保存修改</button>
      </div>
    </div>

    <div v-if="confirmState.visible" class="sub-modal-overlay">
      <div class="confirm-card">
        <div class="confirm-title">请确认</div><div class="confirm-message">{{ confirmState.message }}</div>
        <div class="confirm-actions"><button @click="settleConfirm(false)">取消</button><button class="primary" @click="settleConfirm(true)">确定</button></div>
      </div>
    </div>

    <div v-if="aiVisible" class="sub-modal-overlay" @click.self="!aiLoading && (aiVisible = false)">
      <div class="ai-card">
        <div class="ai-card-header"><div><strong>AI 生成线下预设</strong><span>只创建新草稿，不覆盖当前预设</span></div><button @click="aiVisible = false">关闭</button></div>
        <div class="ai-card-body">
          <label class="field-label">希望达到的效果</label>
          <textarea v-model="aiRequirement" class="field-textarea" placeholder="例如：动作更克制，保持空间与物品连续……" spellcheck="false"></textarea>
          <label class="field-label">也可以粘贴其他 AI 返回的 JSON</label>
          <textarea v-model="aiPaste" class="field-textarea small" placeholder="粘贴 JSON 后点击解析" spellcheck="false"></textarea>
          <div class="ai-inline-actions"><button @click="copyAiGuide">复制生成说明</button><button @click="parseAiPaste">解析粘贴内容</button><button v-if="aiLoading" class="danger" @click="stopAi">停止</button><button v-else class="primary" @click="runAi">在线生成</button></div>
          <div v-if="aiLoading" class="ai-state">正在使用当前配置的模型生成……</div>
          <div v-if="aiError" class="ai-error">{{ aiError }}</div>
          <div v-if="aiResult" class="ai-preview"><strong>{{ aiResult.name }}</strong><span>{{ aiResult.description }}</span><small>主要任务、线下模式、回复规则均已生成</small><div v-if="aiUnknownVariables.length" class="ai-error">未知变量：{{ aiUnknownVariables.join('、') }}</div></div>
        </div>
        <div class="ai-card-footer"><button @click="aiVisible = false">取消</button><button class="primary" :disabled="!aiResult" @click="applyAi">作为新草稿打开</button></div>
      </div>
    </div>

    <transition name="toast-fade"><div v-if="toast.visible" class="preset-toast">{{ toast.message }}</div></transition>
  </div>
</template>

<style scoped>
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.45); display: flex; align-items: center; justify-content: center; z-index: 10020; }
.preset-modal { width: 90%; max-width: 410px; height: 82vh; max-height: 82vh; background: var(--sys-bg-primary); border-radius: 20px; overflow: hidden; display: flex; flex-direction: column; box-shadow: 0 18px 45px rgba(0,0,0,.16); }
.detail-modal { max-width: 430px; }
.modal-header { padding: 16px 20px; background: var(--sys-bg-secondary); border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; position: relative; flex-shrink: 0; }
.nav-title { font-size: 17px; font-weight: 600; color: var(--text-primary); }
.nav-subtitle { margin-top: 2px; font-size: 9px; letter-spacing: 1.4px; color: var(--text-tertiary); }

.header-actions { display: flex; gap: 12px; align-items: center; }
.text-btn, .close-btn, .nav-back-btn, .nav-menu-btn { appearance: none; border: none; background: transparent; font-family: inherit; cursor: pointer; color: var(--text-secondary); font-size: 14px; padding: 4px; }
.text-btn:hover, .close-btn:hover, .nav-back-btn:hover, .nav-menu-btn:hover { color: var(--text-primary); }
.close-btn { color: var(--text-tertiary); }

.editor-title { color: var(--text-primary); font-size: 16px; font-weight: 600; flex: 1; text-align: center; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding: 0 10px; }
.header-right { position: relative; }

.detail-menu { position: absolute; right: 0; top: 100%; margin-top: 8px; background: var(--sys-bg-primary); border: 1px solid var(--border-color); border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,.1); z-index: 10022; min-width: 120px; display: flex; flex-direction: column; padding: 4px; }
.menu-item { appearance: none; border: none; background: transparent; font-family: inherit; font-size: 13px; color: var(--text-primary); padding: 10px 12px; text-align: left; cursor: pointer; border-radius: 4px; }
.menu-item:hover { background: var(--sys-bg-secondary); }
.menu-item.danger { color: #ff3b30; }
.menu-overlay { position: fixed; inset: 0; z-index: 10021; }

.hidden-file-input { position: absolute; width: 1px; height: 1px; opacity: 0; pointer-events: none; }
.modal-scroll { overflow-y: auto; padding: 16px 20px 22px; flex: 1; }
.modal-section + .modal-section { margin-top: 22px; }
.section-title { margin-bottom: 10px; color: var(--text-secondary); font-size: 12px; font-weight: 600; letter-spacing: .8px; }
.section-hint, .editor-hint, .empty-hint { color: var(--text-tertiary); font-size: 11px; line-height: 1.5; margin-top: 9px; }
.empty-hint { margin: 0 0 10px; }
.readonly-notice { padding: 10px 14px; background: rgba(0,0,0,0.04); color: var(--text-secondary); font-size: 12px; border-radius: 8px; margin-bottom: 15px; border-left: 3px solid var(--text-tertiary); }
.is-dark .readonly-notice { background: rgba(255,255,255,0.05); }

.profile-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.profile-option { min-height: 38px; padding: 9px 11px; box-sizing: border-box; border-radius: 9px; background: var(--sys-bg-secondary); color: var(--text-secondary); display: flex; justify-content: space-between; align-items: center; font-size: 12px; cursor: pointer; border: 1px solid transparent; }
.profile-option.active { color: var(--text-primary); border-color: var(--text-primary); font-weight: 500; }
.profile-check { font-size: 11px; }

.preset-list { display: flex; flex-direction: column; gap: 10px; }
.preset-item-wrap { display: flex; background: var(--sys-bg-secondary); border-radius: 12px; border: 1px solid transparent; overflow: hidden; align-items: stretch; }
.preset-item-wrap:has(.preset-item.active) { border-color: rgba(0,0,0,.12); }
.is-dark .preset-item-wrap:has(.preset-item.active) { border-color: rgba(255,255,255,.15); }
.preset-item { flex: 1; padding: 13px 14px; display: flex; align-items: center; cursor: pointer; min-width: 0; }
.preset-info { flex: 1; min-width: 0; padding-right: 10px; }
.preset-name-line { display: flex; align-items: center; gap: 7px; margin-bottom: 5px; }
.preset-name { color: var(--text-primary); font-size: 15px; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
.source-tag { flex-shrink: 0; padding: 2px 6px; border-radius: 8px; font-size: 9px; color: var(--text-tertiary); background: var(--sys-bg-primary); }
.source-tag.builtin { color: var(--text-primary); }
.preset-preview { display: block; color: var(--text-tertiary); font-size: 11px; line-height: 1.4; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.preset-check { flex-shrink: 0; font-size: 11px; color: transparent; width: 32px; text-align: right; }
.preset-check.checked { color: var(--text-primary); font-weight: 600; }
.item-enter { flex-shrink: 0; padding: 0 16px; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.03); color: var(--text-secondary); font-size: 12px; cursor: pointer; font-weight: 500; }
.is-dark .item-enter { background: rgba(255,255,255,0.04); }
.item-enter:active { background: rgba(0,0,0,0.06); }
.is-dark .item-enter:active { background: rgba(255,255,255,0.08); }

.editor-body { overflow-y: auto; padding: 18px 20px 24px; flex: 1; }
.field-label { display: block; margin: 15px 0 7px; color: var(--text-secondary); font-size: 12px; }
.field-label:first-child { margin-top: 0; }
.field-input, .field-textarea { appearance: none; box-sizing: border-box; width: 100%; border: 1px solid var(--border-color); outline: none; border-radius: 9px; background: var(--sys-bg-secondary); color: var(--text-primary); font-family: inherit; font-size: 13px; padding: 10px 12px; transition: opacity 0.2s; }
.field-input:focus:not(:disabled), .field-textarea:focus:not(:disabled) { border-color: var(--text-primary); }
.field-input:disabled, .field-textarea:disabled { opacity: 0.7; cursor: not-allowed; }
.field-textarea { min-height: 132px; resize: vertical; line-height: 1.55; }
.field-textarea.small { min-height: 82px; }

.editor-mode-switch { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; margin: 18px 0 12px; padding: 4px; border-radius: 10px; background: var(--sys-bg-secondary); }
.editor-mode-switch button { border: 0; border-radius: 7px; padding: 8px; background: transparent; color: var(--text-tertiary); font-family: inherit; cursor: pointer; }
.editor-mode-switch button.active { background: var(--sys-bg-primary); color: var(--text-primary); font-weight: 600; box-shadow: 0 1px 5px rgba(0,0,0,.07); }

.entries-toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 9px; color: var(--text-tertiary); font-size: 11px; }
.entries-toolbar button, .entry-actions button { border: 0; border-radius: 7px; background: var(--sys-bg-secondary); color: var(--text-secondary); padding: 7px 10px; font-family: inherit; cursor: pointer; }
.entry-list { display: flex; flex-direction: column; gap: 8px; }
.entry-card { overflow: hidden; border: 1px solid var(--border-color); border-radius: 11px; background: var(--sys-bg-secondary); }
.entry-card.disabled { opacity: .58; }
.entry-card.dragging { opacity: .35; }
.entry-card-head { display: flex; align-items: center; gap: 9px; padding: 11px 12px; cursor: pointer; }
.entry-order { font-size: 11px; padding: 4px 6px; border-radius: 6px; background: var(--sys-bg-primary); color: var(--text-tertiary); flex-shrink: 0; cursor: grab; }
.entry-summary { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.entry-summary strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--text-primary); font-size: 13px; }
.entry-summary span { color: var(--text-tertiary); font-size: 10px; }

.entry-switch { position: relative; width: 32px; height: 18px; flex-shrink: 0; cursor: pointer; }
.entry-switch input { opacity: 0; width: 0; height: 0; position: absolute; }
.switch-box { position: absolute; inset: 0; border-radius: 12px; background: var(--border-color); transition: background 0.2s; }
.switch-knob { position: absolute; width: 14px; height: 14px; left: 2px; top: 2px; border-radius: 50%; background: var(--sys-bg-primary); transition: transform .2s; }
.entry-switch input:checked + .switch-box { background: var(--text-primary); }
.entry-switch input:checked + .switch-box .switch-knob { transform: translateX(14px); }
.entry-switch input:disabled + .switch-box { opacity: 0.6; cursor: not-allowed; }

.entry-card-controls { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 0 12px 10px 43px; color: var(--text-tertiary); font-size: 10px; }
.entry-card-controls > div { display: flex; gap: 6px; }
.entry-card-controls button { border: 0; border-radius: 7px; padding: 6px 10px; background: var(--sys-bg-primary); color: var(--text-secondary); font: inherit; font-size: 10px; cursor: pointer; }
.entry-card-controls button.danger { color: #ff3b30; }

.entry-card-body { display: flex; flex-direction: column; gap: 8px; padding: 0 12px 12px; border-top: 1px solid var(--border-color); padding-top: 11px; }
.entry-textarea { min-height: 118px; }
.entry-actions { display: flex; gap: 6px; justify-content: flex-end; }
.entry-actions button:disabled { opacity: .35; cursor: default; }

.entries-empty, .raw-mode-note { padding: 14px; border-radius: 9px; background: var(--sys-bg-secondary); color: var(--text-tertiary); font-size: 11px; line-height: 1.5; }
.raw-mode-note { margin-bottom: 12px; }

.editor-footer { padding: 12px 20px; background: var(--sys-bg-secondary); border-top: 1px solid var(--border-color); display: flex; justify-content: flex-end; gap: 8px; flex-wrap: wrap; }
.footer-btn { appearance: none; border: none; font-family: inherit; font-size: 12px; padding: 9px 13px; border-radius: 8px; cursor: pointer; font-weight: 500; }
.footer-btn.primary { background: var(--text-primary); color: var(--sys-bg-secondary); }
.footer-btn.secondary { background: var(--sys-bg-primary); color: var(--text-secondary); border: 1px solid var(--border-color); }
.section-picker { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; padding: 4px; border-radius: 9px; background: var(--sys-bg-primary); }
.section-picker button { appearance: none; border: 0; border-radius: 7px; padding: 7px 4px; background: transparent; color: var(--text-tertiary); font: inherit; font-size: 11px; cursor: pointer; }
.section-picker button.active { background: var(--text-primary); color: var(--sys-bg-primary); }
.section-picker.disabled { opacity: .65; }
.sub-modal-overlay { position: fixed; inset: 0; z-index: 10024; display: flex; align-items: center; justify-content: center; padding: 18px; background: rgba(0,0,0,.48); box-sizing: border-box; }
.confirm-card,.ai-card { width: min(360px,100%); max-height: 88vh; overflow: hidden; display: flex; flex-direction: column; border: 1px solid var(--border-color); border-radius: 16px; background: var(--sys-bg-primary); box-shadow: 0 16px 44px rgba(0,0,0,.2); }
.confirm-title { padding: 18px 18px 7px; color: var(--text-primary); font-size: 16px; font-weight: 600; }.confirm-message { padding: 5px 18px 18px; white-space: pre-wrap; color: var(--text-secondary); font-size: 13px; line-height: 1.55; }.confirm-actions,.ai-card-footer { display: flex; justify-content: flex-end; gap: 8px; padding: 12px 16px; border-top: 1px solid var(--border-color); background: var(--sys-bg-secondary); }
.confirm-actions button,.ai-card button,.ai-inline-actions button { appearance: none; border: 1px solid var(--border-color); border-radius: 8px; padding: 8px 12px; background: var(--sys-bg-primary); color: var(--text-secondary); font: inherit; font-size: 12px; cursor: pointer; }.confirm-actions button.primary,.ai-card button.primary,.ai-inline-actions button.primary { border-color: var(--text-primary); background: var(--text-primary); color: var(--sys-bg-primary); }.ai-card button:disabled { opacity: .4; cursor: not-allowed; }
.ai-card { width: min(430px,100%); }.ai-card-header { display:flex;align-items:center;justify-content:space-between;padding:16px 18px;border-bottom:1px solid var(--border-color)}.ai-card-header>div{display:flex;flex-direction:column;gap:3px}.ai-card-header strong{color:var(--text-primary);font-size:15px}.ai-card-header span{color:var(--text-tertiary);font-size:10px}.ai-card-header button{border:0;background:transparent}.ai-card-body{overflow-y:auto;padding:4px 18px 20px}.ai-inline-actions{display:flex;justify-content:flex-end;gap:6px;flex-wrap:wrap;margin-top:10px}.ai-state,.ai-error,.ai-preview{margin-top:10px;padding:10px 12px;border-radius:9px;background:var(--sys-bg-secondary);color:var(--text-secondary);font-size:11px;line-height:1.5}.ai-error{color:#c06f67;border:1px solid rgba(192,111,103,.25)}.ai-preview{display:flex;flex-direction:column;gap:4px}.ai-preview strong{color:var(--text-primary)}.ai-preview small{color:var(--text-tertiary)}

.preset-toast { position: fixed; top: 50%; left: 50%; transform: translate(-50%,-50%); z-index: 10023; padding: 10px 16px; border-radius: 8px; background: rgba(0,0,0,.78); color: #fff; font-size: 13px; pointer-events: none; }
.toast-fade-enter-active, .toast-fade-leave-active { transition: opacity .2s; }
.toast-fade-enter-from, .toast-fade-leave-to { opacity: 0; }

@media (max-width: 360px) { 
  .profile-grid { grid-template-columns: 1fr; }
}
</style>
