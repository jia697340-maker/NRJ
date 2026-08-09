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

const currentView = ref<'list' | 'detail'>('list')
const detailMenuVisible = ref(false)

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

const officialPresets = computed(() => offlinePresetSettings.presets.filter(p => p.source === 'builtin'))
const customPresets = computed(() => offlinePresetSettings.presets.filter(p => p.source === 'user'))

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

const openDetail = (preset: OfflinePromptPreset) => {
  // Enter detail/edit mode
  editorDraft.value = JSON.parse(JSON.stringify(preset))
  editorEntries.value = getOfflinePresetEntries(editorDraft.value!)
  editorMode.value = 'entries'
  expandedEntryId.value = ''
  currentView.value = 'detail'
  detailMenuVisible.value = false
}

const openCopy = (preset: OfflinePromptPreset) => {
  editorDraft.value = createOfflinePresetCopy(preset)
  editorEntries.value = getOfflinePresetEntries(editorDraft.value)
  editorMode.value = 'entries'
  expandedEntryId.value = ''
  currentView.value = 'detail'
  detailMenuVisible.value = false
}

const goBack = () => {
  currentView.value = 'list'
  detailMenuVisible.value = false
  editorDraft.value = null
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
  const index = offlinePresetSettings.presets.findIndex(item => item.id === draft.id)
  if (index >= 0) {
    offlinePresetSettings.presets[index] = JSON.parse(JSON.stringify(draft))
  } else {
    offlinePresetSettings.presets.push(JSON.parse(JSON.stringify(draft)))
  }
  props.selectedChat.offlinePresetId = draft.id
  offlinePresetSettings.currentPresetId = draft.id
  emit('save')
  showToast('线下预设已保存')
  goBack()
}

const resetToDefault = () => {
  const draft = editorDraft.value
  if (!draft || !draft.originalPresetId) return
  if (!confirm('这会清除当前的所有修改，恢复为官方初始状态，确认重置吗？')) return
  
  const original = offlinePresetSettings.presets.find(p => p.id === draft.originalPresetId)
  if (!original) {
    showToast('无法找到原版官方预设，重置失败')
    detailMenuVisible.value = false
    return
  }

  // 完全覆盖草稿数据（保留当前副本的 ID、Name、Description 和 originalPresetId）
  draft.mainPrompt = original.mainPrompt
  draft.modePrompt = original.modePrompt
  draft.postHistoryPrompt = original.postHistoryPrompt
  draft.entries = original.entries ? JSON.parse(JSON.stringify(original.entries)) : undefined
  
  // 重新加载编辑器状态
  editorEntries.value = getOfflinePresetEntries(draft)
  setEditorMode('entries')
  expandedEntryId.value = ''
  
  showToast('已恢复为官方默认参数，请点击保存')
  detailMenuVisible.value = false
}

const deleteCurrentPreset = () => {
  const draft = editorDraft.value
  if (!draft || draft.source === 'builtin') return
  if (!confirm(`确定要删除预设 "${draft.name}" 吗？`)) return
  
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
        <span class="editor-title">{{ editorDraft.name || '编辑预设' }}</span>
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
                <select v-model="entry.section" class="field-input" :disabled="editorDraft.source === 'builtin'">
                  <option value="main">主要任务</option>
                  <option value="mode">线下模式</option>
                  <option value="postHistory">回复规则</option>
                </select>
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
        <div v-pre class="editor-hint">可用变量：{{char_name}}、{{user_name}}</div>
      </div>
      
      <div class="editor-footer">
        <button v-if="editorDraft.source === 'builtin'" class="footer-btn primary" @click="openCopy(editorDraft)">复制并修改</button>
        <button v-else class="footer-btn primary" @click="saveEditor">保存修改</button>
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

.editor-footer { padding: 12px 20px; background: var(--sys-bg-secondary); border-top: 1px solid var(--border-color); display: flex; justify-content: flex-end; }
.footer-btn { appearance: none; border: none; font-family: inherit; font-size: 14px; padding: 10px 20px; border-radius: 8px; cursor: pointer; font-weight: 500; width: 100%; }
.footer-btn.primary { background: var(--text-primary); color: var(--sys-bg-secondary); }

.preset-toast { position: fixed; top: 50%; left: 50%; transform: translate(-50%,-50%); z-index: 10023; padding: 10px 16px; border-radius: 8px; background: rgba(0,0,0,.78); color: #fff; font-size: 13px; pointer-events: none; }
.toast-fade-enter-active, .toast-fade-leave-active { transition: opacity .2s; }
.toast-fade-enter-from, .toast-fade-leave-to { opacity: 0; }

@media (max-width: 360px) { 
  .profile-grid { grid-template-columns: 1fr; }
}
</style>
