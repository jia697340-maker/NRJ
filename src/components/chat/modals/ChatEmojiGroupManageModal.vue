/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { useChatEmoji } from '../../../composables/useChatEmoji'
import type { EmojiCategory } from '../../../services/chatEmojiScope'

defineEmits<{
  (e: 'close'): void
}>()

const props = defineProps<{
  targetRoleId?: string
  targetGroupId?: string
}>()

const visible = defineModel<boolean>('visible')
const category = defineModel<EmojiCategory>('category')

const { groups, addGroup, updateGroup, deleteGroups, mergeGroups } = useChatEmoji()

// 只显示当前分类下的分组
const currentGroups = computed(() => groups.value.filter(g => g.category === category.value
  && (g.category !== 'role' || String(g.ownerCharacterId || g.roleId || '') === String(props.targetRoleId || ''))
  && (g.category !== 'group' || String(g.groupId || '') === String(props.targetGroupId || ''))))

const isManageMode = ref(false)
const selectedIds = ref<Set<string>>(new Set())

const editingId = ref<string | null>(null)
const editName = ref('')
const nameInputRef = ref<HTMLInputElement | null>(null)

const showNewGroupInput = ref(false)
const newGroupName = ref('')
const newNameInputRef = ref<HTMLInputElement | null>(null)

const showMergeModal = ref(false)
const mergeTargetGroupId = ref<string | null>(null)

const showDeleteModal = ref(false)
const deleteTargetIds = ref<string[]>([])
const deleteMessage = ref('')
const validationMessage = ref('')

const toggleManageMode = () => {
  isManageMode.value = !isManageMode.value
  if (!isManageMode.value) {
    selectedIds.value.clear()
  }
}

const toggleSelect = (id: string) => {
  if (selectedIds.value.has(id)) {
    selectedIds.value.delete(id)
  } else {
    selectedIds.value.add(id)
  }
}

const isAllSelected = computed(() => {
  if (currentGroups.value.length === 0) return false
  return currentGroups.value.every(g => selectedIds.value.has(g.id))
})

const toggleSelectAll = () => {
  if (isAllSelected.value) {
    currentGroups.value.forEach(g => selectedIds.value.delete(g.id))
  } else {
    currentGroups.value.forEach(g => selectedIds.value.add(g.id))
  }
}

// 新建分组（改为弹窗形式）
const showCreateModal = ref(false)

const startCreate = async () => {
  newGroupName.value = ''
  showCreateModal.value = true
  await nextTick()
  newNameInputRef.value?.focus()
}

const handleCreateGroup = async () => {
  if (!newGroupName.value.trim()) {
    validationMessage.value = '分组名称不能为空'
    return
  }
  validationMessage.value = ''
  await addGroup(newGroupName.value.trim(), category.value || 'user', props.targetRoleId, props.targetGroupId)
  newGroupName.value = ''
  showCreateModal.value = false
}

const cancelCreate = () => {
  newGroupName.value = ''
  showCreateModal.value = false
}

// 重命名分组
const startEdit = async (id: string, name: string) => {
  if (isManageMode.value) return
  editingId.value = id
  editName.value = name
  await nextTick()
  nameInputRef.value?.focus()
}

const saveEdit = async () => {
  if (editingId.value && editName.value.trim()) {
    await updateGroup(editingId.value, editName.value.trim())
  }
  editingId.value = null
}

// 删除选中分组
const handleDeleteSelected = async () => {
  if (selectedIds.value.size === 0) return
  deleteTargetIds.value = Array.from(selectedIds.value)
  deleteMessage.value = `确定要删除选中的 ${selectedIds.value.size} 个分组吗？\n（这不会删除其中的表情包，只会将其从这些分组中移除）`
  showDeleteModal.value = true
}

// 单个删除
const handleDeleteSingle = async (id: string) => {
  deleteTargetIds.value = [id]
  deleteMessage.value = '确定要删除这个分组吗？\n（这不会删除其中的表情包，只会将其从该分组中移除）'
  showDeleteModal.value = true
}

const confirmDelete = async () => {
  if (deleteTargetIds.value.length === 0) {
    showDeleteModal.value = false
    return
  }
  await deleteGroups(deleteTargetIds.value)
  
  if (isManageMode.value) {
    selectedIds.value.clear()
    isManageMode.value = false
  }
  
  showDeleteModal.value = false
  deleteTargetIds.value = []
}

const cancelDelete = () => {
  showDeleteModal.value = false
  deleteTargetIds.value = []
}

// 合并分组
const handleMerge = () => {
  if (selectedIds.value.size < 1) return
  mergeTargetGroupId.value = null
  showMergeModal.value = true
}

const confirmMerge = async () => {
  if (!mergeTargetGroupId.value) {
    validationMessage.value = '请选择目标分组'
    return
  }
  
  // 如果选中的分组包含目标分组，先把目标分组移出选中列表
  const sourceIds = Array.from(selectedIds.value).filter(id => id !== mergeTargetGroupId.value)
  
  if (sourceIds.length === 0) {
    showMergeModal.value = false
    return
  }

  await mergeGroups(sourceIds, mergeTargetGroupId.value)
  showMergeModal.value = false
  selectedIds.value.clear()
  isManageMode.value = false
}

// 目标分组选项 (当前大类下，不包含选中的要被合并掉的分组 - 但如果想合并到选中项中的一个，也是允许的，上面逻辑已处理)
const mergeTargetOptions = computed(() => {
  return currentGroups.value
})

watch(visible, (val) => {
  if (!val) {
    isManageMode.value = false
    selectedIds.value.clear()
    editingId.value = null
    showNewGroupInput.value = false
    showMergeModal.value = false
    showDeleteModal.value = false
  }
})
</script>

<template>
  <transition name="fade">
    <div v-if="visible" class="modal-overlay" @click.self="visible = false">
      <div class="modal-container">
        <header class="modal-header">
          <div class="header-left">
            <span class="close-btn" @click="visible = false">取消</span>
          </div>
          <div class="modal-title">分组管理 ({{ category === 'user' ? '用户' : category === 'role' ? '此角色' : category === 'group' ? '本群共用' : '全局' }})</div>
          <div class="header-right">
            <span class="manage-btn" @click="toggleManageMode">
              {{ isManageMode ? '完成' : '多选' }}
            </span>
          </div>
        </header>

        <div class="group-list-content">
          <!-- 新建按钮 -->
          <div v-if="!isManageMode" class="create-btn-row" @click="startCreate">
            <svg viewBox="0 0 24 24" width="20" height="20" stroke="#3b82f6" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            <span>新建分组</span>
          </div>

          <!-- 分组列表 -->
          <div class="group-list">
            <div 
              v-for="group in currentGroups" 
              :key="group.id" 
              class="group-item"
              :class="{ 'is-selected': selectedIds.has(group.id), 'manage-mode': isManageMode }"
              @click="isManageMode ? toggleSelect(group.id) : null"
            >
              <!-- 左侧：多选框 或 拖拽图标(暂无) -->
              <div v-if="isManageMode" class="checkbox" :class="{ checked: selectedIds.has(group.id) }">
                <svg v-if="selectedIds.has(group.id)" viewBox="0 0 24 24" width="14" height="14" stroke="white" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
              </div>

              <!-- 名称 / 编辑框 -->
              <div class="group-name-area" @click="!isManageMode && startEdit(group.id, group.name)">
                <input 
                  v-if="editingId === group.id"
                  ref="nameInputRef"
                  v-model="editName"
                  class="name-input"
                  @blur="saveEdit"
                  @keyup.enter="saveEdit"
                />
                <span v-else class="group-name">{{ group.name }}</span>
              </div>

              <!-- 右侧：非管理模式下单删按钮 -->
              <div v-if="!isManageMode && editingId !== group.id" class="delete-icon-btn" @click.stop="handleDeleteSingle(group.id)">
                <svg viewBox="0 0 24 24" width="18" height="18" stroke="#ef4444" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </div>
            </div>
            
            <div v-if="currentGroups.length === 0" class="empty-hint">
              暂无分组，点击上方新建
            </div>
          </div>
        </div>

        <!-- 底部多选操作栏 -->
        <transition name="slide-up">
          <div v-if="isManageMode" class="bottom-action-bar">
            <div class="select-all-btn" @click="toggleSelectAll">
              <div class="checkbox" :class="{ checked: isAllSelected }">
                <svg v-if="isAllSelected" viewBox="0 0 24 24" width="14" height="14" stroke="white" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
              </div>
              <span>全选</span>
            </div>
            
            <div class="actions-right">
              <button 
                class="action-btn merge-btn" 
                :disabled="selectedIds.size < 1"
                @click="handleMerge"
              >
                合并
              </button>
              <button 
                class="action-btn delete-btn" 
                :disabled="selectedIds.size === 0"
                @click="handleDeleteSelected"
              >
                删除({{ selectedIds.size }})
              </button>
            </div>
          </div>
        </transition>

        <!-- 新建分组弹窗 (内部小弹窗) -->
        <div v-if="showCreateModal" class="inner-modal-overlay">
          <div class="inner-modal">
            <div class="inner-title">新建分组</div>
            <div v-if="validationMessage" class="inner-subtitle">{{ validationMessage }}</div>
            <div class="inner-input-area">
              <input 
                ref="newNameInputRef"
                v-model="newGroupName" 
                type="text" 
                class="inner-name-input" 
                placeholder="请输入分组名称..."
                @keyup.enter="handleCreateGroup"
              />
            </div>
            <div class="inner-actions">
              <button class="btn-cancel" @click="cancelCreate">取消</button>
              <button class="btn-confirm" @click="handleCreateGroup">确认</button>
            </div>
          </div>
        </div>

        <!-- 合并分组选择弹窗 (内部小弹窗) -->
        <div v-if="showMergeModal" class="inner-modal-overlay">
          <div class="inner-modal">
            <div class="inner-title">合并到分组</div>
            <div class="inner-desc">选择一个目标分组，选中的其它分组内容将全部移入该分组，并删除原分组。</div>
            
            <div class="target-select-list">
              <div 
                v-for="opt in mergeTargetOptions" 
                :key="opt.id"
                class="target-opt"
                  :class="{ active: mergeTargetGroupId === opt.id }"
                  @click="mergeTargetGroupId = opt.id"
              >
                {{ opt.name }}
                  <svg v-if="mergeTargetGroupId === opt.id" viewBox="0 0 24 24" width="16" height="16" stroke="#3b82f6" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
              </div>
            </div>

            <div class="inner-actions">
              <button class="btn-cancel" @click="showMergeModal = false">取消</button>
              <button class="btn-confirm" @click="confirmMerge">确认合并</button>
            </div>
          </div>
        </div>

        <!-- 删除确认弹窗 (内部小弹窗) -->
        <div v-if="showDeleteModal" class="inner-modal-overlay">
          <div class="inner-modal">
            <div class="inner-title">删除确认</div>
            <div class="inner-desc" style="white-space: pre-wrap;">{{ deleteMessage }}</div>
            
            <div class="inner-actions" style="margin-top: 16px;">
              <button class="btn-cancel" @click="cancelDelete">取消</button>
              <button class="btn-confirm" style="background: #ef4444;" @click="confirmDelete">确认删除</button>
            </div>
          </div>
        </div>

      </div>
    </div>
  </transition>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.6); /* 加深背景遮罩 */
  backdrop-filter: blur(4px); /* 添加背景模糊 */
  -webkit-backdrop-filter: blur(4px);
  z-index: 10000;
  display: flex;
  align-items: flex-end; /* 从底部弹起的感觉 */
}

.modal-container {
  width: 100%;
  height: 80%;
  background: #ffffff; /* 强制白底，解决透明穿透问题 */
  border-radius: 20px 20px 0 0;
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: hidden;
  box-shadow: 0 -10px 40px rgba(0, 0, 0, 0.2);
}

/* 适配暗黑模式 */
.dark-theme .modal-container {
  background: #1e1e1e; /* 强制暗底 */
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  height: 56px;
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
}

.modal-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.close-btn, .manage-btn {
  font-size: 15px;
  color: #3b82f6;
  cursor: pointer;
  padding: 8px;
}

.group-list-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  background: #f3f4f6; /* 使用实体浅灰色背景，避免使用可能有透明度的变量 */
}

.dark-theme .group-list-content {
  background: #121212;
}

.create-btn-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background: #ffffff;
  border-radius: 12px;
  margin-bottom: 16px;
  color: #3b82f6;
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
}

.dark-theme .create-btn-row {
  background: #1e1e1e;
}

.create-btn-row:active {
  transform: scale(0.98);
}

.group-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-bottom: 80px;
}

.group-item {
  display: flex;
  align-items: center;
  padding: 14px 16px;
  background: #ffffff;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
  transition: all 0.2s;
}

.dark-theme .group-item {
  background: #1e1e1e;
}

.group-item.manage-mode {
  cursor: pointer;
}

.group-item.manage-mode:active {
  transform: scale(0.98);
}

.checkbox {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 2px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 12px;
  transition: all 0.2s;
  flex-shrink: 0;
}

.checkbox.checked {
  background: #3b82f6;
  border-color: #3b82f6;
}

.group-name-area {
  flex: 1;
  font-size: 16px;
  color: var(--text-primary);
  cursor: text;
}

.name-input {
  width: 100%;
  border: none;
  background: transparent;
  font-size: 16px;
  color: var(--text-primary);
  outline: none;
  border-bottom: 1px solid #3b82f6;
  padding-bottom: 4px;
}

.delete-icon-btn {
  padding: 8px;
  margin-right: -8px;
  cursor: pointer;
  opacity: 0.6;
}

.delete-icon-btn:active {
  opacity: 1;
}

.empty-hint {
  text-align: center;
  color: var(--text-secondary);
  font-size: 14px;
  padding: 32px 0;
}

.bottom-action-bar {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 64px;
  background: #ffffff;
  border-top: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  z-index: 100;
  box-shadow: 0 -4px 16px rgba(0,0,0,0.05);
}

.dark-theme .bottom-action-bar {
  background: #1e1e1e;
}

.select-all-btn {
  display: flex;
  align-items: center;
  font-size: 15px;
  color: var(--text-primary);
  cursor: pointer;
}

.actions-right {
  display: flex;
  gap: 12px;
}

.action-btn {
  padding: 8px 16px;
  border-radius: 20px;
  font-size: 14px;
  font-weight: 500;
  border: none;
  cursor: pointer;
}

.merge-btn {
  background: rgba(59, 130, 246, 0.1);
  color: #3b82f6;
}

.delete-btn {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}

.action-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* 内部合并弹窗 */
.inner-modal-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0,0,0,0.4);
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
}

.inner-modal {
  width: 300px;
  max-height: 80%;
  background: #ffffff;
  border-radius: 16px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  box-shadow: 0 10px 40px rgba(0,0,0,0.2);
}

.dark-theme .inner-modal {
  background: #2d2d2d;
}

.inner-title {
  font-size: 17px;
  font-weight: 600;
  text-align: center;
  margin-bottom: 8px;
}

.inner-desc {
  font-size: 13px;
  color: var(--text-secondary);
  text-align: center;
  margin-bottom: 16px;
  line-height: 1.4;
}

.target-select-list {
  flex: 1;
  overflow-y: auto;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  margin-bottom: 20px;
  max-height: 200px;
}

.target-opt {
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
  font-size: 14px;
}

.target-opt:last-child {
  border-bottom: none;
}

.target-opt.active {
  background: rgba(59, 130, 246, 0.05);
  color: #3b82f6;
}

.inner-actions {
  display: flex;
  gap: 12px;
}

.inner-input-area {
  margin: 16px 0 24px;
}

.inner-name-input {
  width: 100%;
  padding: 12px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-secondary);
  color: var(--text-primary);
  font-size: 15px;
  outline: none;
}

.inner-name-input:focus {
  border-color: #3b82f6;
  background: transparent;
}

.inner-actions button {
  flex: 1;
  padding: 10px 0;
  border-radius: 8px;
  border: none;
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
}

.btn-cancel {
  background: var(--bg-secondary);
  color: var(--text-primary);
}

.btn-confirm {
  background: #3b82f6;
  color: white;
}

/* Transitions */
.fade-enter-active, .fade-leave-active {
  transition: opacity 0.3s;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}
.fade-enter-active .modal-container {
  animation: slide-up-anim 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}
.fade-leave-active .modal-container {
  animation: slide-up-anim 0.3s cubic-bezier(0.16, 1, 0.3, 1) reverse;
}

@keyframes slide-up-anim {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}

.slide-up-enter-active,
.slide-up-leave-active {
  transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease;
}

.slide-up-enter-from,
.slide-up-leave-to {
  transform: translateY(100%);
  opacity: 0;
}
</style>
