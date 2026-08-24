<!-- WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ -->
<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  bubbleWorkshopState,
  deleteBubblePreset,
  duplicateBubblePreset,
  setGlobalBubblePreset,
  type BubblePreset
} from '../../../services/bubbleWorkshop'

const props = defineProps<{
  currentId: string
  visible: boolean
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
  select: [preset: BubblePreset]
  create: []
}>()

const searchQuery = ref('')
const deleteTarget = ref<BubblePreset | null>(null)
const isBatchMode = ref(false)
const selectedBatchIds = ref<string[]>([])
const showBatchDeleteConfirm = ref(false)

const presets = computed(() => bubbleWorkshopState.presets)

const filteredPresets = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  if (!query) return presets.value
  return presets.value.filter(item =>
    item.name.toLowerCase().includes(query) ||
    item.description?.toLowerCase().includes(query)
  )
})

const isAllSelected = computed(() => {
  return filteredPresets.value.length > 0 && selectedBatchIds.value.length === filteredPresets.value.length
})

const toggleBatchMode = () => {
  isBatchMode.value = !isBatchMode.value
  selectedBatchIds.value = []
}

const toggleSelectAll = () => {
  if (isAllSelected.value) {
    selectedBatchIds.value = []
  } else {
    selectedBatchIds.value = filteredPresets.value.map(p => p.id)
  }
}

const toggleBatchItem = (id: string) => {
  const index = selectedBatchIds.value.indexOf(id)
  if (index >= 0) {
    selectedBatchIds.value.splice(index, 1)
  } else {
    selectedBatchIds.value.push(id)
  }
}

const handleCardClick = (preset: BubblePreset) => {
  if (isBatchMode.value) {
    toggleBatchItem(preset.id)
  } else {
    handleSelect(preset)
  }
}

const handleSelect = (preset: BubblePreset) => {
  emit('select', preset)
  emit('update:visible', false)
}

const handleCreate = () => {
  emit('create')
  emit('update:visible', false)
}

const handleSetGlobal = (preset: BubblePreset, e: Event) => {
  e.stopPropagation()
  if (bubbleWorkshopState.globalPresetId === preset.id) {
    setGlobalBubblePreset(null)
  } else {
    setGlobalBubblePreset(preset.id)
  }
}

const handleDuplicate = (preset: BubblePreset, e: Event) => {
  e.stopPropagation()
  const copied = duplicateBubblePreset(preset.id)
  emit('select', copied)
  emit('update:visible', false)
}

const promptDelete = (preset: BubblePreset, e: Event) => {
  e.stopPropagation()
  deleteTarget.value = preset
}

const confirmDelete = () => {
  if (deleteTarget.value) {
    deleteBubblePreset(deleteTarget.value.id)
    deleteTarget.value = null
  }
}

const confirmBatchDelete = () => {
  const idsToDelete = [...selectedBatchIds.value]
  if (!idsToDelete.length) return
  idsToDelete.forEach(id => {
    deleteBubblePreset(id)
  })
  selectedBatchIds.value = []
  showBatchDeleteConfirm.value = false
  isBatchMode.value = false
}

const formatDate = (ts: number) => {
  if (!ts) return ''
  const d = new Date(ts)
  return `${d.getMonth() + 1}月${d.getDate()}日 ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}
</script>

<template>
  <div v-if="visible" class="bw-preset-modal-backdrop" @click.self="emit('update:visible', false)">
    <div class="bw-preset-modal">
      <header class="bw-modal-header">
        <div class="bw-modal-title">
          <h3>气泡方案库</h3>
          <span>{{ isBatchMode ? `已选择 ${selectedBatchIds.length} 项` : `共 ${presets.length} 个自定义方案` }}</span>
        </div>
        <div class="bw-modal-header-right">
          <template v-if="!isBatchMode">
            <button v-if="presets.length > 0" class="bw-btn-batch" @click="toggleBatchMode">
              批量管理
            </button>
            <button class="bw-btn-new" @click="handleCreate">
              <svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
              新建方案
            </button>
          </template>
          <template v-else>
            <button class="bw-btn-batch-opt" @click="toggleSelectAll">
              {{ isAllSelected ? '取消全选' : '全选' }}
            </button>
            <button
              class="bw-btn-batch-opt danger"
              :disabled="selectedBatchIds.length === 0"
              @click="showBatchDeleteConfirm = true"
            >
              删除({{ selectedBatchIds.length }})
            </button>
            <button class="bw-btn-batch-opt done" @click="toggleBatchMode">
              完成
            </button>
          </template>
          <button class="bw-btn-close" @click="emit('update:visible', false)">
            <svg viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          </button>
        </div>
      </header>

      <div class="bw-modal-search">
        <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="2" fill="none"/><path d="M20 20l-4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        <input v-model="searchQuery" placeholder="搜索气泡方案名称..." />
        <button v-if="searchQuery" class="bw-btn-clear" @click="searchQuery = ''">×</button>
      </div>

      <div class="bw-preset-grid-scroll">
        <div v-if="filteredPresets.length" class="bw-preset-grid">
          <div
            v-for="preset in filteredPresets"
            :key="preset.id"
            class="bw-preset-card"
            :class="{
              active: !isBatchMode && currentId === preset.id,
              'is-global': bubbleWorkshopState.globalPresetId === preset.id,
              'batch-selected': isBatchMode && selectedBatchIds.includes(preset.id)
            }"
            @click="handleCardClick(preset)"
          >
            <!-- 批量管理多选框 -->
            <div v-if="isBatchMode" class="bw-batch-checkbox" :class="{ checked: selectedBatchIds.includes(preset.id) }">
              <svg v-if="selectedBatchIds.includes(preset.id)" viewBox="0 0 24 24"><path d="M5 12l4 4 10-10" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </div>

            <div class="bw-preset-card-top">
              <div class="bw-preset-badge-group">
                <span v-if="bubbleWorkshopState.globalPresetId === preset.id" class="bw-tag global">全局默认</span>
                <span v-if="preset.source === 'imported'" class="bw-tag imported">导入</span>
                <span v-else class="bw-tag created">自制</span>
              </div>
              <div v-if="!isBatchMode" class="bw-preset-actions">
                <button
                  class="bw-action-icon"
                  :class="{ active: bubbleWorkshopState.globalPresetId === preset.id }"
                  :title="bubbleWorkshopState.globalPresetId === preset.id ? '取消全局' : '设为全局'"
                  @click="handleSetGlobal(preset, $event)"
                >
                  <svg viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" :fill="bubbleWorkshopState.globalPresetId === preset.id ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>
                </button>
                <button
                  class="bw-action-icon"
                  title="复制方案"
                  @click="handleDuplicate(preset, $event)"
                >
                  <svg viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" stroke-width="2" fill="none"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
                </button>
                <button
                  class="bw-action-icon danger"
                  title="删除方案"
                  @click="promptDelete(preset, $event)"
                >
                  <svg viewBox="0 0 24 24"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/></svg>
                </button>
              </div>
            </div>

            <div class="bw-preset-preview-mini">
              <div class="bw-mini-bubble other">
                <span :style="{ background: preset.other.background || '#ffffff', borderColor: preset.other.borderColor || '#dddddd', color: preset.other.textColor || '#333333' }">对方</span>
              </div>
              <div class="bw-mini-bubble self">
                <span :style="{ background: preset.self.background || '#4f7cff', borderColor: preset.self.borderColor || 'transparent', color: preset.self.textColor || '#ffffff' }">我</span>
              </div>
            </div>

            <div class="bw-preset-card-info">
              <strong class="bw-preset-name">{{ preset.name || '未命名气泡' }}</strong>
              <small class="bw-preset-time">{{ formatDate(preset.updatedAt || preset.createdAt) }}</small>
            </div>
          </div>
        </div>

        <div v-else class="bw-preset-empty">
          <div class="bw-empty-icon">🎨</div>
          <h4>{{ searchQuery ? '未找到相关气泡方案' : '暂无气泡方案' }}</h4>
          <p>{{ searchQuery ? '请尝试搜索其他关键词' : '点击右上角“新建方案”开启你的气泡创作' }}</p>
          <button v-if="!searchQuery" class="bw-btn-empty-create" @click="handleCreate">立即新建</button>
        </div>
      </div>
    </div>

    <!-- 单个删除确认弹窗 -->
    <div v-if="deleteTarget" class="bw-preset-modal-backdrop inner" @click.self="deleteTarget = null">
      <div class="bw-confirm-dialog">
        <h4>确认删除该方案？</h4>
        <p>删除「{{ deleteTarget.name }}」后将无法恢复，关联的聊天将恢复系统气泡。</p>
        <div class="bw-dialog-actions">
          <button class="bw-dialog-btn cancel" @click="deleteTarget = null">取消</button>
          <button class="bw-dialog-btn danger" @click="confirmDelete">确认删除</button>
        </div>
      </div>
    </div>

    <!-- 批量删除确认弹窗 -->
    <div v-if="showBatchDeleteConfirm" class="bw-preset-modal-backdrop inner" @click.self="showBatchDeleteConfirm = false">
      <div class="bw-confirm-dialog">
        <h4>确认批量删除？</h4>
        <p>将彻底删除选中的 {{ selectedBatchIds.length }} 个方案，删除后无法恢复，关联的聊天将恢复系统气泡。</p>
        <div class="bw-dialog-actions">
          <button class="bw-dialog-btn cancel" @click="showBatchDeleteConfirm = false">取消</button>
          <button class="bw-dialog-btn danger" @click="confirmBatchDelete">确认删除</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.bw-preset-modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(15, 23, 42, 0.6);
  backdrop-filter: blur(8px);
  padding: 16px;
  animation: bwFadeIn 0.2s ease-out;
}
.bw-preset-modal-backdrop.inner {
  z-index: 220;
}
.bw-preset-modal {
  width: min(880px, 100%);
  max-height: 88vh;
  display: flex;
  flex-direction: column;
  background: var(--sys-bg-secondary, #ffffff);
  border-radius: 20px;
  box-shadow: 0 25px 60px -12px rgba(0, 0, 0, 0.25);
  overflow: hidden;
  border: 1px solid var(--border-color, rgba(0, 0, 0, 0.08));
}
.bw-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 24px;
  border-bottom: 1px solid var(--border-color, rgba(0, 0, 0, 0.06));
  flex-wrap: wrap;
  gap: 10px;
}
.bw-modal-title h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: var(--text-primary, #1e293b);
}
.bw-modal-title span {
  font-size: 12px;
  color: var(--text-tertiary, #94a3b8);
  margin-top: 2px;
  display: block;
}
.bw-modal-header-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.bw-btn-new {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 34px;
  padding: 0 14px;
  background: var(--bw-accent, #4f7cff);
  color: #fff;
  border: none;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}
.bw-btn-new svg {
  width: 16px;
  height: 16px;
}
.bw-btn-new:hover {
  opacity: 0.9;
  transform: translateY(-1px);
}
.bw-btn-batch {
  display: flex;
  align-items: center;
  height: 34px;
  padding: 0 12px;
  background: var(--sys-bg-primary, #f1f5f9);
  color: var(--text-secondary, #475569);
  border: 1px solid var(--border-color, rgba(0, 0, 0, 0.08));
  border-radius: 10px;
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}
.bw-btn-batch:hover {
  color: var(--bw-accent, #4f7cff);
  border-color: var(--bw-accent, #4f7cff);
}
.bw-btn-batch-opt {
  height: 34px;
  padding: 0 12px;
  border-radius: 10px;
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid var(--border-color, rgba(0, 0, 0, 0.08));
  background: var(--sys-bg-primary, #f1f5f9);
  color: var(--text-secondary, #475569);
  transition: all 0.15s;
}
.bw-btn-batch-opt.danger {
  background: #fee2e2;
  color: #ef4444;
  border-color: #fca5a5;
}
.bw-btn-batch-opt.danger:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.bw-btn-batch-opt.done {
  background: var(--bw-accent, #4f7cff);
  color: #fff;
  border-color: var(--bw-accent, #4f7cff);
}
.bw-btn-close {
  width: 34px;
  height: 34px;
  display: grid;
  place-items: center;
  border-radius: 10px;
  background: var(--sys-bg-primary, #f1f5f9);
  color: var(--text-secondary, #64748b);
  border: none;
  cursor: pointer;
}
.bw-btn-close svg {
  width: 18px;
  height: 18px;
}
.bw-modal-search {
  margin: 14px 24px 8px;
  position: relative;
  display: flex;
  align-items: center;
}
.bw-modal-search svg {
  position: absolute;
  left: 12px;
  width: 16px;
  height: 16px;
  color: var(--text-tertiary, #94a3b8);
  pointer-events: none;
}
.bw-modal-search input {
  width: 100%;
  height: 40px;
  padding: 0 36px 0 38px;
  background: var(--sys-bg-primary, #f8fafc);
  border: 1px solid var(--border-color, rgba(0, 0, 0, 0.08));
  border-radius: 12px;
  font-size: 14px;
  color: var(--text-primary, #1e293b);
  outline: none;
  transition: all 0.2s;
}
.bw-modal-search input:focus {
  border-color: var(--bw-accent, #4f7cff);
  background: #fff;
}
.bw-btn-clear {
  position: absolute;
  right: 10px;
  width: 22px;
  height: 22px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  border: none;
  background: var(--sys-bg-tertiary, #cbd5e1);
  color: var(--text-secondary, #475569);
  font-size: 14px;
  cursor: pointer;
}
.bw-preset-grid-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 14px 24px 24px;
  min-height: 280px;
}
.bw-preset-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 16px;
}
.bw-preset-card {
  position: relative;
  display: flex;
  flex-direction: column;
  padding: 14px;
  background: var(--sys-bg-primary, #f8fafc);
  border: 1.5px solid var(--border-color, rgba(0, 0, 0, 0.06));
  border-radius: 14px;
  cursor: pointer;
  transition: all 0.2s ease;
}
.bw-preset-card:hover {
  transform: translateY(-2px);
  border-color: color-mix(in srgb, var(--bw-accent, #4f7cff) 40%, transparent);
  box-shadow: 0 10px 20px -5px rgba(0, 0, 0, 0.06);
}
.bw-preset-card.active {
  border-color: var(--bw-accent, #4f7cff);
  background: color-mix(in srgb, var(--bw-accent, #4f7cff) 4%, #fff);
  box-shadow: 0 0 0 1.5px var(--bw-accent, #4f7cff);
}
.bw-preset-card.batch-selected {
  border-color: #ef4444 !important;
  background: color-mix(in srgb, #ef4444 4%, var(--sys-bg-primary, #f8fafc));
  box-shadow: 0 0 0 1.5px rgba(239, 68, 68, 0.4);
}
.bw-preset-card.is-global {
  border-left: 3.5px solid #eab308;
}
.bw-batch-checkbox {
  position: absolute;
  top: 10px;
  right: 10px;
  width: 22px;
  height: 22px;
  border-radius: 7px;
  border: 1.8px solid var(--border-color, #cbd5e1);
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2;
  transition: all 0.15s;
}
.bw-batch-checkbox.checked {
  background: #ef4444;
  border-color: #ef4444;
  color: #fff;
}
.bw-batch-checkbox svg {
  width: 14px;
  height: 14px;
}
.bw-preset-card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}
.bw-preset-badge-group {
  display: flex;
  align-items: center;
  gap: 5px;
}
.bw-tag {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 7px;
  border-radius: 6px;
}
.bw-tag.global {
  background: #fef08a;
  color: #854d0e;
}
.bw-tag.imported {
  background: #e0e7ff;
  color: #3730a3;
}
.bw-tag.created {
  background: #f1f5f9;
  color: #475569;
}
.bw-preset-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}
.bw-action-icon {
  width: 28px;
  height: 28px;
  display: grid;
  place-items: center;
  border-radius: 7px;
  border: none;
  background: transparent;
  color: var(--text-tertiary, #94a3b8);
  cursor: pointer;
  transition: all 0.15s;
}
.bw-action-icon svg {
  width: 15px;
  height: 15px;
}
.bw-action-icon:hover {
  background: var(--sys-bg-tertiary, #e2e8f0);
  color: var(--text-primary, #1e293b);
}
.bw-action-icon.active {
  color: #eab308;
}
.bw-action-icon.danger:hover {
  background: #fee2e2;
  color: #ef4444;
}
.bw-preset-preview-mini {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  background: var(--sys-bg-secondary, #ffffff);
  border-radius: 10px;
  border: 1px solid var(--border-color, rgba(0, 0, 0, 0.04));
  margin-bottom: 12px;
}
.bw-mini-bubble {
  display: flex;
  width: 100%;
}
.bw-mini-bubble.other {
  justify-content: flex-start;
}
.bw-mini-bubble.self {
  justify-content: flex-end;
}
.bw-mini-bubble span {
  padding: 4px 10px;
  font-size: 11px;
  border-radius: 8px;
  border: 1px solid transparent;
  max-width: 80%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.bw-preset-card-info {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}
.bw-preset-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary, #1e293b);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.bw-preset-time {
  font-size: 11px;
  color: var(--text-tertiary, #94a3b8);
  flex-shrink: 0;
}
.bw-preset-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  text-align: center;
}
.bw-empty-icon {
  font-size: 44px;
  margin-bottom: 12px;
}
.bw-preset-empty h4 {
  margin: 0 0 6px;
  font-size: 16px;
  color: var(--text-primary, #1e293b);
}
.bw-preset-empty p {
  margin: 0 0 18px;
  font-size: 13px;
  color: var(--text-tertiary, #94a3b8);
}
.bw-btn-empty-create {
  height: 38px;
  padding: 0 20px;
  background: var(--bw-accent, #4f7cff);
  color: #fff;
  border: none;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}
.bw-confirm-dialog {
  width: min(380px, 90%);
  background: var(--sys-bg-secondary, #fff);
  border-radius: 16px;
  padding: 22px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.25);
}
.bw-confirm-dialog h4 {
  margin: 0 0 8px;
  font-size: 16px;
  color: var(--text-primary, #1e293b);
}
.bw-confirm-dialog p {
  margin: 0 0 20px;
  font-size: 13px;
  color: var(--text-tertiary, #94a3b8);
}
.bw-dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}
.bw-dialog-btn {
  height: 36px;
  padding: 0 16px;
  border-radius: 9px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}
.bw-dialog-btn.cancel {
  background: var(--sys-bg-primary, #f1f5f9);
  color: var(--text-secondary, #64748b);
  border: 1px solid var(--border-color, rgba(0, 0, 0, 0.08));
}
.bw-dialog-btn.danger {
  background: #ef4444;
  color: #ffffff;
  border: none;
}
@keyframes bwFadeIn {
  from { opacity: 0; transform: scale(0.98); }
  to { opacity: 1; transform: scale(1); }
}
@media (max-width: 640px) {
  .bw-preset-grid {
    grid-template-columns: 1fr;
  }
  .bw-modal-header {
    padding: 14px 16px;
  }
  .bw-modal-search {
    margin: 10px 16px 6px;
  }
  .bw-preset-grid-scroll {
    padding: 10px 16px 20px;
  }
}
</style>
