/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { ref, computed } from 'vue'
import { globalSettings, type ApiPreset } from '../store'

const props = defineProps<{
  presets: ApiPreset[]
  currentPresetId: string
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'delete', ids: string[]): void
  (e: 'rename', id: string, newName: string): void
  (e: 'overwrite', id: string): void
}>()

const selectedIds = ref<Set<string>>(new Set())
const editingPresetId = ref<string | null>(null)
const editingPresetName = ref<string>('')

const toggleSelection = (id: string) => {
  if (selectedIds.value.has(id)) {
    selectedIds.value.delete(id)
  } else {
    selectedIds.value.add(id)
  }
}

const isAllSelected = computed(() => {
  return props.presets.length > 0 && selectedIds.value.size === props.presets.length
})

const toggleSelectAll = () => {
  if (isAllSelected.value) {
    selectedIds.value.clear()
  } else {
    props.presets.forEach(p => selectedIds.value.add(p.id))
  }
}

const confirmDelete = () => {
  if (selectedIds.value.size === 0) return
  emit('delete', Array.from(selectedIds.value))
  selectedIds.value.clear()
}

const startRename = (preset: ApiPreset, e: Event) => {
  e.stopPropagation()
  editingPresetId.value = preset.id
  editingPresetName.value = preset.name
}

const saveRename = (id: string, e?: Event) => {
  if (e) e.stopPropagation()
  const trimmed = editingPresetName.value.trim()
  if (trimmed) {
    emit('rename', id, trimmed)
  }
  editingPresetId.value = null
  editingPresetName.value = ''
}

const cancelRename = (e?: Event) => {
  if (e) e.stopPropagation()
  editingPresetId.value = null
  editingPresetName.value = ''
}

const requestOverwrite = (preset: ApiPreset, e: Event) => {
  e.stopPropagation()
  emit('overwrite', preset.id)
}
</script>

<template>
  <div class="preset-manage-modal" :class="{ 'is-dark': globalSettings.darkMode }">
    <div class="modal-overlay" @click="emit('close')"></div>
    <div class="modal-content">
      <div class="modal-header">
        <h2 class="en-title">Presets</h2>
        <span class="cn-subtitle">预设方案管理</span>
        <button class="close-btn" type="button" @click="emit('close')">
          <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="1.5" fill="none"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </div>

      <div class="preset-list" v-if="presets.length > 0">
        <div 
          v-for="preset in presets" 
          :key="preset.id" 
          class="preset-item"
          :class="{ 'is-active': preset.id === currentPresetId }"
          @click="toggleSelection(preset.id)"
        >
          <div class="checkbox" :class="{ 'checked': selectedIds.has(preset.id) }">
            <svg v-if="selectedIds.has(preset.id)" viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2" fill="none"><polyline points="20 6 9 17 4 12"></polyline></svg>
          </div>
          <div class="preset-info">
            <div class="preset-name-row" v-if="editingPresetId === preset.id" @click.stop>
              <input 
                v-model="editingPresetName" 
                class="rename-input" 
                maxlength="40" 
                autofocus 
                @keydown.enter="saveRename(preset.id, $event)"
                @keydown.esc="cancelRename($event)"
              />
              <button class="item-action-btn confirm" type="button" title="确认" @click="saveRename(preset.id, $event)">✓</button>
              <button class="item-action-btn cancel" type="button" title="取消" @click="cancelRename($event)">✕</button>
            </div>
            <div class="preset-name" v-else>
              <span class="name-text">{{ preset.name }}</span>
              <span v-if="preset.id === currentPresetId" class="active-tag">当前生效</span>
            </div>
            <div class="preset-detail">{{ preset.provider === 'custom' ? (preset.customUrl || preset.url) : preset.provider }} • {{ preset.model || '未指定模型' }}</div>
          </div>
          <div class="preset-actions" v-if="editingPresetId !== preset.id">
            <button class="preset-btn" type="button" title="更新覆盖当前配置到此预设" @click="requestOverwrite(preset, $event)">覆盖</button>
            <button class="preset-btn" type="button" title="重命名" @click="startRename(preset, $event)">重命名</button>
          </div>
        </div>
      </div>
      
      <div class="empty-state" v-else>
        <div class="empty-icon">📂</div>
        <p class="empty-text">暂无保存的预设方案</p>
        <p class="empty-hint">在下方调整好节点的各项参数后，点击“保存当前配置”即可创建预设。</p>
      </div>

      <div class="modal-footer" v-if="presets.length > 0">
        <button class="text-action-btn" type="button" @click="toggleSelectAll">
          <span class="cn-text">{{ isAllSelected ? '取消全选' : '全选' }}</span>
          <span class="en-text">{{ isAllSelected ? 'UNSELECT ALL' : 'SELECT ALL' }}</span>
        </button>
        
        <button 
          class="text-action-btn delete-btn" 
          type="button"
          :class="{ 'disabled': selectedIds.size === 0 }"
          @click="confirmDelete"
          :disabled="selectedIds.size === 0"
        >
          <span class="cn-text">删除 ({{ selectedIds.size }})</span>
          <span class="en-text">DELETE</span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;1,400&family=Noto+Serif+SC:wght@300;400;500&display=swap');

.preset-manage-modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  z-index: 2200;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Arial, sans-serif;
}

.modal-overlay {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background-color: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  animation: fadeIn 0.3s ease;
}

.is-dark .modal-overlay {
  background-color: rgba(13, 13, 13, 0.85);
}

.modal-content {
  position: relative;
  width: 90%;
  max-width: 440px;
  background: rgba(255, 255, 255, 0.98);
  border: 1px solid #EEE;
  border-radius: 16px;
  padding: 32px 24px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  z-index: 1;
  animation: slideUp 0.35s cubic-bezier(0.2, 0.8, 0.2, 1);
  box-sizing: border-box;
}

.is-dark .modal-content {
  background: rgba(26, 26, 26, 0.98);
  border-color: #333;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
}

.modal-header {
  display: flex;
  align-items: baseline;
  margin-bottom: 24px;
  position: relative;
}

.en-title {
  font-family: 'Playfair Display', serif;
  font-style: italic;
  font-size: 32px;
  font-weight: 400;
  color: #111;
  margin: 0;
}
.is-dark .en-title { color: #F5F5F5; }

.cn-subtitle {
  font-family: 'Noto Serif SC', serif;
  font-size: 10px;
  color: #999;
  letter-spacing: 4px;
  margin-left: 14px;
}
.is-dark .cn-subtitle { color: #666; }

.close-btn {
  position: absolute;
  right: 0;
  top: 4px;
  background: none;
  border: none;
  color: #999;
  cursor: pointer;
  padding: 4px;
  transition: color 0.3s;
}
.close-btn:hover { color: #111; }
.is-dark .close-btn:hover { color: #EEE; }

.preset-list {
  max-height: 48vh;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-right: 4px;
  margin-bottom: 24px;
}

.preset-list::-webkit-scrollbar {
  width: 4px;
}
.preset-list::-webkit-scrollbar-thumb {
  background: #E0E0E0;
  border-radius: 4px;
}
.is-dark .preset-list::-webkit-scrollbar-thumb {
  background: #333;
}

.preset-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border: 1px solid #EEE;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s;
  background: rgba(0,0,0,0.015);
}
.is-dark .preset-item {
  border-color: #333;
  background: rgba(255,255,255,0.02);
}

.preset-item:hover {
  border-color: #CCC;
}
.is-dark .preset-item:hover {
  border-color: #555;
}

.preset-item.is-active {
  border-color: #222;
  background: rgba(0,0,0,0.04);
}
.is-dark .preset-item.is-active {
  border-color: #EEE;
  background: rgba(255,255,255,0.06);
}

.checkbox {
  width: 18px;
  height: 18px;
  border: 1px solid #CCC;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 0.2s;
  color: transparent;
}
.is-dark .checkbox { border-color: #555; }

.checkbox.checked {
  background: #111;
  border-color: #111;
  color: #FFF;
}
.is-dark .checkbox.checked {
  background: #EEE;
  border-color: #EEE;
  color: #111;
}

.preset-info {
  flex: 1;
  min-width: 0;
}

.preset-name-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
}

.rename-input {
  flex: 1;
  font-size: 13px;
  border: 1px solid #999;
  border-radius: 4px;
  padding: 3px 6px;
  background: transparent;
  color: inherit;
  outline: none;
}

.item-action-btn {
  border: 0;
  background: transparent;
  cursor: pointer;
  font-size: 12px;
  padding: 2px 5px;
  color: #666;
}
.item-action-btn.confirm { color: #2e7d32; font-weight: bold; }
.item-action-btn.cancel { color: #c62828; }

.preset-name {
  font-family: 'Noto Serif SC', serif;
  font-size: 14px;
  font-weight: 500;
  color: #111;
  margin-bottom: 4px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.is-dark .preset-name { color: #EEE; }

.name-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.active-tag {
  font-family: 'Noto Serif SC', serif;
  font-size: 9px;
  color: #C62828;
  border: 1px solid rgba(198, 40, 40, 0.3);
  padding: 1px 5px;
  border-radius: 8px;
  flex-shrink: 0;
}

.preset-detail {
  font-size: 11px;
  color: #888;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.is-dark .preset-detail { color: #666; }

.preset-actions {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}

.preset-btn {
  border: 1px solid #ddd;
  border-radius: 4px;
  background: transparent;
  padding: 3px 7px;
  font-size: 10px;
  color: #666;
  cursor: pointer;
  transition: all 0.2s;
}
.is-dark .preset-btn {
  border-color: #444;
  color: #aaa;
}
.preset-btn:hover {
  border-color: #222;
  color: #222;
}
.is-dark .preset-btn:hover {
  border-color: #eee;
  color: #eee;
}

.empty-state {
  text-align: center;
  padding: 36px 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}
.empty-icon {
  font-size: 32px;
  opacity: 0.8;
}
.empty-text {
  font-family: 'Noto Serif SC', serif;
  font-size: 14px;
  font-weight: 500;
  color: #333;
  margin: 0;
}
.is-dark .empty-text { color: #ddd; }
.empty-hint {
  font-size: 11px;
  color: #999;
  margin: 0;
  max-width: 260px;
  line-height: 1.6;
}
.is-dark .empty-hint { color: #666; }

.modal-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 14px;
  border-top: 1px solid #EEE;
}
.is-dark .modal-footer { border-color: #333; }

.text-action-btn {
  background: none;
  border: none;
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  color: #666;
  cursor: pointer;
  padding: 6px 12px;
  transition: all 0.3s;
}
.text-action-btn .cn-text {
  font-family: 'Noto Serif SC', serif;
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 1px;
}
.text-action-btn .en-text {
  font-family: 'Playfair Display', serif;
  font-size: 9px;
  font-style: italic;
  text-transform: uppercase;
  letter-spacing: 1px;
  opacity: 0.75;
}
.is-dark .text-action-btn { color: #999; }
.text-action-btn:hover { color: #111; }
.is-dark .text-action-btn:hover { color: #EEE; }

.text-action-btn.delete-btn { color: #C62828; }
.text-action-btn.delete-btn:hover:not(.disabled) { opacity: 0.8; }
.text-action-btn.disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slideUp {
  from { opacity: 0; transform: translateY(16px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
