/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { computed, ref } from 'vue'
import { offlinePresetSettings } from '../../../store'
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

const props = defineProps<{ visible: boolean; selectedChat: any }>()
const emit = defineEmits<{ (e: 'close'): void; (e: 'save'): void }>()

const previewId = ref('')
const editorVisible = ref(false)
const editorDraft = ref<OfflinePromptPreset | null>(null)
const editorMode = ref<'entries' | 'raw'>('entries')
const editorEntries = ref<OfflinePromptEntry[]>([])
const expandedEntryId = ref('')
const draggedEntryIndex = ref<number | null>(null)
const rawModeSnapshot = ref({ mainPrompt: '', modePrompt: '', postHistoryPrompt: '' })
const fileInput = ref<HTMLInputElement | null>(null)
const toast = ref({ visible: false, message: '' })
let toastTimer: ReturnType<typeof setTimeout> | null = null

const modelProfiles: OfflineModelProfile[] = ['auto', 'openai-compatible', 'deepseek-chat', 'deepseek-reasoner', 'claude', 'gemini']
const selectedPresetId = computed(() => props.selectedChat?.offlinePresetId || offlinePresetSettings.currentPresetId || 'offline_default')

const showToast = (message: string) => {
  toast.value = { visible: true, message }
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toast.value.visible = false }, 2200)
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

const togglePreview = (id: string) => {
  previewId.value = previewId.value === id ? '' : id
}

const openCopy = (preset: OfflinePromptPreset) => {
  editorDraft.value = createOfflinePresetCopy(preset)
  editorEntries.value = getOfflinePresetEntries(editorDraft.value)
  editorMode.value = 'entries'
  expandedEntryId.value = ''
  editorVisible.value = true
}

const openEdit = (preset: OfflinePromptPreset) => {
  if (preset.source === 'builtin') return openCopy(preset)
  editorDraft.value = JSON.parse(JSON.stringify(preset))
  editorEntries.value = getOfflinePresetEntries(editorDraft.value!)
  editorMode.value = 'entries'
  expandedEntryId.value = ''
  editorVisible.value = true
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
      // 原文发生修改时按三个用途重新建立条目，避免两种视图内容不一致。
      draft.entries = undefined
      editorEntries.value = createOfflineEntriesFromLegacy(draft)
      expandedEntryId.value = editorEntries.value[0]?.id || ''
    }
  }
  editorMode.value = mode
}

const addEntry = () => {
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
  const source = editorEntries.value[index]
  const copy = { ...source, id: `offline_entry_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, name: `${source.name} 副本` }
  editorEntries.value.splice(index + 1, 0, copy)
  expandedEntryId.value = copy.id
}

const moveEntry = (index: number, offset: number) => {
  const target = index + offset
  if (target < 0 || target >= editorEntries.value.length) return
  const [entry] = editorEntries.value.splice(index, 1)
  editorEntries.value.splice(target, 0, entry)
}

const startEntryDrag = (index: number) => {
  draggedEntryIndex.value = index
}

const dragEntryOver = (event: DragEvent, targetIndex: number) => {
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
  const [removed] = editorEntries.value.splice(index, 1)
  if (expandedEntryId.value === removed?.id) expandedEntryId.value = ''
}

const openPresetEntry = (preset: OfflinePromptPreset, entryIndex: number) => {
  openEdit(preset)
  expandedEntryId.value = editorEntries.value[entryIndex]?.id || ''
}

const togglePresetEntry = (preset: OfflinePromptPreset, entryIndex: number) => {
  if (preset.source === 'builtin') {
    openCopy(preset)
    if (editorEntries.value[entryIndex]) editorEntries.value[entryIndex].enabled = !editorEntries.value[entryIndex].enabled
    showToast('官方预设已复制，请确认条目后保存')
    return
  }
  preset.entries = getOfflinePresetEntries(preset)
  const entry = preset.entries[entryIndex]
  if (!entry) return
  entry.enabled = !entry.enabled
  syncOfflinePresetLegacyFields(preset)
  emit('save')
}

const saveEditor = () => {
  const draft = editorDraft.value
  if (draft && editorMode.value === 'entries') {
    draft.entries = JSON.parse(JSON.stringify(editorEntries.value))
    syncOfflinePresetLegacyFields(draft)
  } else if (draft) {
    draft.entries = createOfflineEntriesFromLegacy(draft)
  }
  if (!draft || !draft.name.trim() || !draft.mainPrompt.trim() || !draft.postHistoryPrompt.trim()) {
    showToast('名称、主提示词和末尾规则不能为空')
    return
  }
  const index = offlinePresetSettings.presets.findIndex(item => item.id === draft.id)
  if (index >= 0) offlinePresetSettings.presets[index] = JSON.parse(JSON.stringify(draft))
  else offlinePresetSettings.presets.push(JSON.parse(JSON.stringify(draft)))
  props.selectedChat.offlinePresetId = draft.id
  offlinePresetSettings.currentPresetId = draft.id
  editorVisible.value = false
  emit('save')
  showToast('线下预设已保存')
}

const deletePreset = (preset: OfflinePromptPreset) => {
  if (preset.source === 'builtin') return
  offlinePresetSettings.presets = offlinePresetSettings.presets.filter(item => item.id !== preset.id)
  if (selectedPresetId.value === preset.id) {
    props.selectedChat.offlinePresetId = 'offline_default'
    offlinePresetSettings.currentPresetId = 'offline_default'
  }
  emit('save')
  showToast('已删除自定义预设')
}

const exportPresets = () => {
  const data = {
    schema: 'clingy-offline-presets',
    version: 1,
    presets: offlinePresetSettings.presets.filter(item => item.source === 'user')
  }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `线下预设-${new Date().toISOString().slice(0, 10)}.json`
  anchor.click()
  URL.revokeObjectURL(url)
  showToast(data.presets.length ? '已导出自定义预设' : '当前没有自定义预设，已导出空模板')
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
  } catch (error: any) {
    showToast(error?.message || '导入失败，请检查文件格式')
  }
}
</script>

<template>
  <div v-if="visible" class="modal-overlay" @click.self="emit('close')">
    <div class="preset-modal">
      <div class="modal-header">
        <div>
          <div class="nav-title">线下预设</div>
          <div class="nav-subtitle">OFFLINE PRESETS</div>
        </div>
        <button class="close-btn" @click="emit('close')">×</button>
      </div>

      <div class="preset-actions-bar">
        <button class="action-btn" @click="fileInput?.click()">导入</button>
        <button class="action-btn" @click="exportPresets">导出</button>
        <button class="action-btn primary" @click="openCopy(offlinePresetSettings.presets.find(p => p.id === selectedPresetId) || offlinePresetSettings.presets[0])">复制当前</button>
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
              <span v-if="(selectedChat.offlineModelProfile || 'auto') === profile" class="profile-check">✓</span>
            </div>
          </div>
          <div class="section-hint">自动模式会根据当前 API 节点与模型名称选择请求协议。仅在中转识别错误时手动指定。</div>
        </section>

        <section class="modal-section preset-section">
          <div class="section-title">预设方案</div>
          <div
            v-for="preset in offlinePresetSettings.presets"
            :key="preset.id"
            class="preset-item-wrap"
          >
            <div class="preset-item" :class="{ active: selectedPresetId === preset.id }" @click="selectPreset(preset)">
              <div class="preset-info">
                <div class="preset-name-line">
                  <span class="preset-name">{{ preset.name }}</span>
                  <span class="source-tag" :class="preset.source">{{ preset.source === 'builtin' ? '官方' : '自定义' }}</span>
                </div>
                <span class="preset-preview">{{ preset.description || '未填写说明' }}</span>
              </div>
              <div class="preset-check" :class="{ checked: selectedPresetId === preset.id }">
                <span v-if="selectedPresetId === preset.id">✓</span>
              </div>
            </div>

            <div class="item-actions">
              <button class="inline-btn" @click="togglePreview(preset.id)">{{ previewId === preset.id ? '收起条目' : '查看条目' }}</button>
              <button class="inline-btn" @click="openEdit(preset)">{{ preset.source === 'builtin' ? '复制修改' : '编辑' }}</button>
              <button v-if="preset.source === 'user'" class="inline-btn danger" @click="deletePreset(preset)">删除</button>
            </div>

            <div v-if="previewId === preset.id" class="prompt-preview-list">
              <div v-for="(entry, entryIndex) in getOfflinePresetEntries(preset)" :key="entry.id" class="prompt-preview-card" :class="{ disabled: !entry.enabled }">
                <span class="preview-drag">≡</span>
                <div class="preview-entry-copy">
                  <strong>{{ entry.name }}</strong>
                  <span>{{ sectionLabels[entry.section] }} · {{ entry.content.length }} 字</span>
                </div>
                <button class="preview-toggle" :class="{ checked: entry.enabled }" @click.stop="togglePresetEntry(preset, entryIndex)"><i></i></button>
                <button class="preview-edit-btn" @click="openPresetEntry(preset, entryIndex)">编辑</button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>

    <div v-if="editorVisible && editorDraft" class="editor-overlay" @click.self="editorVisible = false">
      <div class="editor-modal">
        <div class="editor-header">
          <button class="nav-btn" @click="editorVisible = false">取消</button>
          <span class="editor-title">编辑线下预设</span>
          <button class="nav-btn done" @click="saveEditor">完成</button>
        </div>
        <div class="editor-body">
          <label class="field-label">预设名称</label>
          <input v-model="editorDraft.name" class="field-input" maxlength="40" placeholder="请输入预设名称">
          <label class="field-label">说明</label>
          <input v-model="editorDraft.description" class="field-input" maxlength="100" placeholder="简要说明预设用途">
          <div class="editor-mode-switch">
            <button :class="{ active: editorMode === 'entries' }" @click="setEditorMode('entries')">条目模式</button>
            <button :class="{ active: editorMode === 'raw' }" @click="setEditorMode('raw')">大框模式</button>
          </div>

          <template v-if="editorMode === 'entries'">
            <div class="entries-toolbar">
              <span>{{ editorEntries.length }} 个条目</span>
              <button @click="addEntry">＋ 新增条目</button>
            </div>
            <div class="entry-list">
              <div v-for="(entry, index) in editorEntries" :key="entry.id" class="entry-card" :class="{ disabled: !entry.enabled, dragging: draggedEntryIndex === index }" @dragover="dragEntryOver($event, index)">
                <div class="entry-card-head">
                  <span class="entry-order" draggable="true" title="拖动排序" @dragstart="startEntryDrag(index)" @dragend="endEntryDrag">≡</span>
                  <div class="entry-summary">
                    <strong>{{ entry.name || `条目 ${index + 1}` }}</strong>
                    <span>{{ sectionLabels[entry.section] }} · {{ entry.content.length }} 字</span>
                  </div>
                  <label class="entry-switch" @click.stop><input v-model="entry.enabled" type="checkbox"><i></i></label>
                </div>
                <div class="entry-card-controls">
                  <span>{{ entry.enabled ? '参与提示词拼接' : '已停用，不会发送' }}</span>
                  <div>
                    <button @click="expandedEntryId = expandedEntryId === entry.id ? '' : entry.id">{{ expandedEntryId === entry.id ? '收起' : '编辑' }}</button>
                    <button class="danger" @click="deleteEntry(index)">删除</button>
                  </div>
                </div>
                <div v-if="expandedEntryId === entry.id" class="entry-card-body">
                  <input v-model="entry.name" class="field-input" placeholder="条目名称">
                  <select v-model="entry.section" class="field-input">
                    <option value="main">主要任务</option>
                    <option value="mode">线下模式</option>
                    <option value="postHistory">回复规则</option>
                  </select>
                  <textarea v-model="entry.content" class="field-textarea entry-textarea" spellcheck="false" placeholder="输入这一条提示词内容"></textarea>
                  <div class="entry-actions">
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
            <textarea v-model="editorDraft.mainPrompt" class="field-textarea small" spellcheck="false"></textarea>
            <label class="field-label">线下模式上下文</label>
            <textarea v-model="editorDraft.modePrompt" class="field-textarea" spellcheck="false"></textarea>
            <label class="field-label">Post-History Instructions</label>
            <textarea v-model="editorDraft.postHistoryPrompt" class="field-textarea" spellcheck="false"></textarea>
          </template>
          <div v-pre class="editor-hint">可用变量：{{char_name}}、{{user_name}}</div>
        </div>
      </div>
    </div>

    <transition name="toast-fade"><div v-if="toast.visible" class="preset-toast">{{ toast.message }}</div></transition>
  </div>
</template>

<style scoped>
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.45); display: flex; align-items: center; justify-content: center; z-index: 10020; }
.preset-modal { width: 90%; max-width: 410px; max-height: 82vh; background: var(--sys-bg-primary); border-radius: 20px; overflow: hidden; display: flex; flex-direction: column; box-shadow: 0 18px 45px rgba(0,0,0,.16); }
.modal-header { padding: 16px 20px; background: var(--sys-bg-secondary); border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; }
.nav-title { font-size: 17px; font-weight: 600; color: var(--text-primary); }
.nav-subtitle { margin-top: 2px; font-size: 9px; letter-spacing: 1.4px; color: var(--text-tertiary); }
.close-btn, .action-btn, .inline-btn, .nav-btn { appearance: none; border: none; font-family: inherit; cursor: pointer; }
.close-btn { background: transparent; color: var(--text-tertiary); font-size: 25px; line-height: 1; padding: 2px 0 2px 12px; }
.preset-actions-bar { display: flex; gap: 8px; padding: 12px 20px; background: var(--sys-bg-secondary); border-bottom: 1px solid var(--border-color); }
.action-btn { padding: 7px 12px; border-radius: 7px; background: var(--sys-bg-primary); color: var(--text-secondary); font-size: 13px; }
.action-btn.primary { flex: 1; background: var(--text-primary); color: var(--sys-bg-secondary); }
.hidden-file-input { position: absolute; width: 1px; height: 1px; opacity: 0; pointer-events: none; }
.modal-scroll { overflow-y: auto; padding: 16px 20px 22px; }
.modal-section + .modal-section { margin-top: 22px; }
.section-title { margin-bottom: 10px; color: var(--text-secondary); font-size: 12px; font-weight: 600; letter-spacing: .8px; }
.section-hint, .editor-hint { color: var(--text-tertiary); font-size: 11px; line-height: 1.5; margin-top: 9px; }
.profile-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.profile-option { min-height: 38px; padding: 9px 11px; box-sizing: border-box; border-radius: 9px; background: var(--sys-bg-secondary); color: var(--text-secondary); display: flex; justify-content: space-between; align-items: center; font-size: 12px; cursor: pointer; border: 1px solid transparent; }
.profile-option.active { color: var(--text-primary); border-color: var(--text-primary); font-weight: 500; }
.profile-check { font-size: 12px; }
.preset-item-wrap { overflow: hidden; margin-bottom: 10px; background: var(--sys-bg-secondary); border-radius: 12px; border: 1px solid transparent; }
.preset-item-wrap:has(.preset-item.active) { border-color: rgba(0,0,0,.12); }
.is-dark .preset-item-wrap:has(.preset-item.active) { border-color: rgba(255,255,255,.15); }
.preset-item { padding: 13px 14px 10px; display: flex; align-items: center; cursor: pointer; }
.preset-info { flex: 1; min-width: 0; padding-right: 10px; }
.preset-name-line { display: flex; align-items: center; gap: 7px; margin-bottom: 5px; }
.preset-name { color: var(--text-primary); font-size: 15px; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.source-tag { flex-shrink: 0; padding: 2px 6px; border-radius: 8px; font-size: 9px; color: var(--text-tertiary); background: var(--sys-bg-primary); }
.source-tag.builtin { color: var(--text-primary); }
.preset-preview { display: block; color: var(--text-tertiary); font-size: 11px; line-height: 1.4; }
.preset-check { width: 21px; height: 21px; flex-shrink: 0; border-radius: 50%; border: 1px solid var(--border-color); display: flex; align-items: center; justify-content: center; font-size: 11px; color: var(--sys-bg-secondary); }
.preset-check.checked { background: var(--text-primary); border-color: var(--text-primary); }
.item-actions { display: flex; padding: 0 10px 9px; gap: 4px; }
.inline-btn { background: transparent; color: var(--text-tertiary); font-size: 11px; padding: 5px 7px; border-radius: 6px; }
.inline-btn:active { background: var(--sys-bg-primary); }
.inline-btn.danger { color: #ff3b30; margin-left: auto; }
.prompt-preview-list { margin: 0 12px 12px; display: flex; flex-direction: column; gap: 7px; }
.prompt-preview-card { padding: 11px 10px; border-radius: 9px; background: var(--sys-bg-primary); display: flex; align-items: center; gap: 8px; }
.prompt-preview-card.disabled { opacity: .55; }
.preview-drag { color: var(--text-tertiary); }
.preview-entry-copy { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.preview-entry-copy strong { color: var(--text-primary); font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.preview-entry-copy span { color: var(--text-tertiary); font-size: 9px; }
.preview-edit-btn { border: 0; border-radius: 7px; padding: 6px 8px; background: var(--sys-bg-secondary); color: var(--text-secondary); font: inherit; font-size: 10px; cursor: pointer; }
.preview-toggle { position: relative; width: 32px; height: 18px; flex-shrink: 0; padding: 0; border: 0; border-radius: 12px; background: var(--border-color); cursor: pointer; }
.preview-toggle i { position: absolute; width: 14px; height: 14px; left: 2px; top: 2px; border-radius: 50%; background: var(--sys-bg-primary); transition: transform .2s; }
.preview-toggle.checked { background: var(--text-primary); }
.preview-toggle.checked i { transform: translateX(14px); }
.preview-text { white-space: pre-wrap; word-break: break-word; color: var(--text-secondary); font-size: 11px; line-height: 1.55; }
.editor-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.5); z-index: 10021; display: flex; align-items: center; justify-content: center; }
.editor-modal { width: 92%; max-width: 430px; height: 82vh; background: var(--sys-bg-primary); border-radius: 18px; overflow: hidden; display: flex; flex-direction: column; }
.editor-header { flex-shrink: 0; padding: 15px 18px; background: var(--sys-bg-secondary); border-bottom: 1px solid var(--border-color); display: flex; align-items: center; justify-content: space-between; }
.editor-title { color: var(--text-primary); font-size: 16px; font-weight: 600; }
.nav-btn { background: transparent; color: var(--text-secondary); font-size: 14px; padding: 4px; }
.nav-btn.done { color: var(--text-primary); font-weight: 600; }
.editor-body { overflow-y: auto; padding: 18px 20px 24px; }
.field-label { display: block; margin: 15px 0 7px; color: var(--text-secondary); font-size: 12px; }
.field-label:first-child { margin-top: 0; }
.field-input, .field-textarea { appearance: none; box-sizing: border-box; width: 100%; border: 1px solid var(--border-color); outline: none; border-radius: 9px; background: var(--sys-bg-secondary); color: var(--text-primary); font-family: inherit; font-size: 13px; padding: 10px 12px; }
.field-input:focus, .field-textarea:focus { border-color: var(--text-primary); }
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
.entry-order { width: 22px; height: 22px; border-radius: 7px; background: var(--sys-bg-primary); color: var(--text-tertiary); display: grid; place-items: center; font-size: 14px; flex-shrink: 0; cursor: grab; }
.entry-summary { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.entry-summary strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--text-primary); font-size: 13px; }
.entry-summary span { color: var(--text-tertiary); font-size: 10px; }
.entry-switch { position: relative; width: 32px; height: 18px; flex-shrink: 0; }
.entry-switch input { opacity: 0; width: 0; height: 0; }
.entry-switch i { position: absolute; inset: 0; border-radius: 12px; background: var(--border-color); }
.entry-switch i::before { content: ''; position: absolute; width: 14px; height: 14px; left: 2px; top: 2px; border-radius: 50%; background: var(--sys-bg-primary); transition: transform .2s; }
.entry-switch input:checked + i { background: var(--text-primary); }
.entry-switch input:checked + i::before { transform: translateX(14px); }
.entry-card-controls { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 0 12px 10px 43px; color: var(--text-tertiary); font-size: 10px; }
.entry-card-controls > div { display: flex; gap: 6px; }
.entry-card-controls button { border: 0; border-radius: 7px; padding: 6px 10px; background: var(--sys-bg-primary); color: var(--text-secondary); font: inherit; font-size: 10px; cursor: pointer; }
.entry-card-controls button.danger { color: #ff3b30; }
.entry-card-body { display: flex; flex-direction: column; gap: 8px; padding: 0 12px 12px; border-top: 1px solid var(--border-color); padding-top: 11px; }
.entry-textarea { min-height: 118px; }
.entry-actions { display: flex; gap: 6px; justify-content: flex-end; }
.entry-actions button:disabled { opacity: .35; cursor: default; }
.entry-actions button.danger { color: #ff3b30; }
.entries-empty, .raw-mode-note { padding: 14px; border-radius: 9px; background: var(--sys-bg-secondary); color: var(--text-tertiary); font-size: 11px; line-height: 1.5; }
.raw-mode-note { margin-bottom: 12px; }
.preset-toast { position: fixed; top: 50%; left: 50%; transform: translate(-50%,-50%); z-index: 10023; padding: 10px 16px; border-radius: 8px; background: rgba(0,0,0,.78); color: #fff; font-size: 13px; pointer-events: none; }
.toast-fade-enter-active, .toast-fade-leave-active { transition: opacity .2s; }
.toast-fade-enter-from, .toast-fade-leave-to { opacity: 0; }
@media (max-width: 360px) { .profile-grid { grid-template-columns: 1fr; } .preset-actions-bar { padding-left: 14px; padding-right: 14px; } }
</style>
