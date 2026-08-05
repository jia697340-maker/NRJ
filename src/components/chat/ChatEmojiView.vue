/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useChatEmoji } from '../../composables/useChatEmoji'
import ChatEmojiUploadModal from './modals/ChatEmojiUploadModal.vue'
import ChatEmojiGroupManageModal from './modals/ChatEmojiGroupManageModal.vue'
import ChatEmojiMoveModal from './modals/ChatEmojiMoveModal.vue'
import ChatEmojiEditModal from './modals/ChatEmojiEditModal.vue'
import ChatEmojiTransferModal from './modals/ChatEmojiTransferModal.vue'
import type { EmojiItem } from '../../composables/useChatEmoji'

const emit = defineEmits<{
  (e: 'close'): void
}>()

const isManageMode = ref(false)
const selectedIds = ref<Set<string>>(new Set())
const showConfirmModal = ref(false)
const itemToDelete = ref<string | null>(null)

const searchQuery = ref('')
const isSearchVisible = ref(false)

let pressTimer: ReturnType<typeof setTimeout> | null = null
let isLongPressTriggered = false

// TODO: 如果需要获取当前选中的 roleId，可以从 useChatState 或 props 中获取
// 这里先预留 targetRoleId
const targetRoleId = ref<number>(1)

const activeTab = ref<'user' | 'role' | 'global'>('user')
const activeGroupId = ref<string | null>(null) // null 表示'全部'

const { emojis, groups, loadEmojis, deleteEmoji, updateEmoji } = useChatEmoji()

const showUploadModal = ref(false)
const showGroupManageModal = ref(false)
const showMoveModal = ref(false)
const showEditModal = ref(false)
const showTransferModal = ref(false)
const currentEditEmoji = ref<EmojiItem | null>(null)

// 过滤当前选中分组和搜索关键字的表情
const filterByGroup = (list: any[]) => {
  let result = list
  if (activeGroupId.value) {
    result = result.filter(e => e.groupIds && e.groupIds.includes(activeGroupId.value))
  }
  if (searchQuery.value.trim()) {
    const keyword = searchQuery.value.trim().toLowerCase()
    result = result.filter(e => e.name && e.name.toLowerCase().includes(keyword))
  }
  return result
}

// 计算各个分类下的表情列表
const userEmojis = computed(() => filterByGroup(emojis.value.filter(e => e.category === 'user')))
const roleEmojis = computed(() => filterByGroup(emojis.value.filter(e => e.category === 'role')))
const globalEmojis = computed(() => filterByGroup(emojis.value.filter(e => e.category === 'global')))

const currentCategoryGroups = computed(() => groups.value.filter(g => g.category === activeTab.value))

onMounted(() => {
  loadEmojis()
})

const toggleManageMode = () => {
  isManageMode.value = !isManageMode.value
  if (!isManageMode.value) {
    selectedIds.value.clear()
  }
}

const startPress = (id: string, e: PointerEvent) => {
  if (e.pointerType === 'mouse' && e.button !== 0) return
  isLongPressTriggered = false
  pressTimer = setTimeout(() => {
    isLongPressTriggered = true
    if (!isManageMode.value) {
      isManageMode.value = true
    }
    if (!selectedIds.value.has(id)) {
      selectedIds.value.add(id)
    }
  }, 400)
}

const cancelPress = () => {
  if (pressTimer) {
    clearTimeout(pressTimer)
    pressTimer = null
  }
}

const handleClick = (id: string) => {
  if (isLongPressTriggered) {
    isLongPressTriggered = false
    return
  }
  if (isManageMode.value) {
    if (selectedIds.value.has(id)) {
      selectedIds.value.delete(id)
    } else {
      selectedIds.value.add(id)
    }
  } else {
    // 非管理模式下点击，打开编辑弹窗
    const emoji = emojis.value.find(e => e.id === id)
    if (emoji) {
      currentEditEmoji.value = emoji
      showEditModal.value = true
    }
  }
}

const handleEditSave = async (id: string, updates: Partial<EmojiItem>) => {
  await updateEmoji(id, updates)
}

const handleEditDelete = async (id: string) => {
  await deleteEmoji(id)
}

const handleBatchDelete = () => {
  if (selectedIds.value.size === 0) return
  showConfirmModal.value = true
}

const confirmDelete = async () => {
  if (itemToDelete.value) {
    await deleteEmoji(itemToDelete.value)
    itemToDelete.value = null
  } else {
    await Promise.all(Array.from(selectedIds.value).map(id => deleteEmoji(id)))
    selectedIds.value.clear()
    isManageMode.value = false
  }
  showConfirmModal.value = false
}

const currentList = computed(() => {
  if (activeTab.value === 'user') return userEmojis.value
  if (activeTab.value === 'role') return roleEmojis.value
  return globalEmojis.value
})

const isAllSelected = computed(() => {
  if (currentList.value.length === 0) return false
  return currentList.value.every(e => selectedIds.value.has(e.id))
})

const toggleSelectAll = () => {
  if (isAllSelected.value) {
    currentList.value.forEach(e => selectedIds.value.delete(e.id))
  } else {
    currentList.value.forEach(e => selectedIds.value.add(e.id))
  }
}

const handleOpenMoveModal = () => {
  if (selectedIds.value.size === 0) return
  showMoveModal.value = true
}

const handleMoveSuccess = () => {
  selectedIds.value.clear()
  isManageMode.value = false
}

const handleOpenTransferModal = () => {
  if (selectedIds.value.size === 0) return
  showTransferModal.value = true
}

const handleTransferSuccess = async () => {
  selectedIds.value.clear()
  isManageMode.value = false
  await loadEmojis() // 刷新列表以显示转移结果
}

watch(activeTab, () => {
  selectedIds.value.clear()
  isManageMode.value = false
  activeGroupId.value = null // 切换大类时重置分组选择
  searchQuery.value = '' // 切换大类时重置搜索
})

watch(activeGroupId, () => {
  selectedIds.value.clear()
  isManageMode.value = false
})
</script>

<template>
  <div class="emoji-view-container glass-overlay">
    <header class="emoji-header">
      <div class="icon-btn back-btn" @click="emit('close')">
        <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="15 18 9 12 15 6"></polyline>
        </svg>
      </div>
      <div class="emoji-title">表情包管理</div>
      <div class="header-right">
        <div class="icon-btn search-toggle-btn" @click="isSearchVisible = !isSearchVisible">
          <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
        </div>
        <span class="manage-btn" @click="toggleManageMode">
          {{ isManageMode ? '完成' : '管理' }}
        </span>
      </div>
    </header>

    <transition name="slide-down">
      <div v-if="isSearchVisible" class="search-bar-container">
        <div class="search-input-wrapper">
          <svg class="search-icon" viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input 
            v-model="searchQuery" 
            type="text" 
            placeholder="搜索表情包..." 
            class="search-input"
          />
          <div v-if="searchQuery" class="clear-btn" @click="searchQuery = ''">
            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </div>
        </div>
      </div>
    </transition>

    <div class="emoji-tabs">
      <div class="emoji-tab" :class="{ active: activeTab === 'user' }" @click="activeTab = 'user'">用户</div>
      <div class="emoji-tab" :class="{ active: activeTab === 'role' }" @click="activeTab = 'role'">此角色</div>
      <div class="emoji-tab" :class="{ active: activeTab === 'global' }" @click="activeTab = 'global'">全局角色</div>
    </div>

    <!-- 新增：分组导航栏 -->
    <div class="group-nav-bar">
      <div class="group-nav-scroll">
        <div class="group-pill" :class="{ active: activeGroupId === null }" @click="activeGroupId = null">
          全部
        </div>
        <div 
          v-for="g in currentCategoryGroups" 
          :key="g.id"
          class="group-pill"
          :class="{ active: activeGroupId === g.id }"
          @click="activeGroupId = g.id"
        >
          {{ g.name }}
        </div>
      </div>
      <div class="group-manage-btn" @click="showGroupManageModal = true">
        <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="3"></circle>
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
        </svg>
      </div>
    </div>

    <div class="emoji-content" :class="{ 'has-bottom-bar': isManageMode }">
      <transition name="fade" mode="out-in">
        <div v-if="activeTab === 'user'" key="user" class="emoji-tab-content">
          <div v-if="userEmojis.length === 0" class="emoji-grid-empty">
            <div class="empty-icon">
              <svg viewBox="0 0 24 24" width="56" height="56" stroke="currentColor" stroke-width="1" fill="none" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                <circle cx="8.5" cy="8.5" r="1.5"></circle>
                <polyline points="21 15 16 10 5 21"></polyline>
              </svg>
            </div>
            <div class="empty-text">暂无用户表情包</div>
            <button class="add-emoji-btn" @click="showUploadModal = true">添加表情</button>
          </div>
          <div v-else class="emoji-grid-container">
            <div class="emoji-grid">
              <div 
                v-for="item in userEmojis" 
                :key="item.id" 
                class="emoji-grid-item"
                :class="{ 'manage-mode': isManageMode, 'is-selected': selectedIds.has(item.id) }"
                @pointerdown="startPress(item.id, $event)"
                @pointerup="cancelPress"
                @pointerleave="cancelPress"
                @pointercancel="cancelPress"
                @click="handleClick(item.id)"
                @contextmenu.prevent
              >
                <img :src="item.previewUrl" :alt="item.name" class="emoji-img" loading="lazy" />
                <div class="emoji-name" :title="item.name">{{ item.name }}</div>
                <div v-if="isManageMode" class="emoji-select-overlay">
                  <div class="select-checkbox" :class="{ 'is-checked': selectedIds.has(item.id) }">
                    <svg v-if="selectedIds.has(item.id)" viewBox="0 0 24 24" width="14" height="14" stroke="white" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                  </div>
                </div>
              </div>
            </div>
            <div v-if="!isManageMode" class="floating-add-btn" @click="showUploadModal = true">
              <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            </div>
          </div>
        </div>
        
        <div v-else-if="activeTab === 'role'" key="role" class="emoji-tab-content">
          <div v-if="roleEmojis.length === 0" class="emoji-grid-empty">
            <div class="empty-icon">
              <svg viewBox="0 0 24 24" width="56" height="56" stroke="currentColor" stroke-width="1" fill="none" stroke-linecap="round" stroke-linejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="9" cy="7" r="4"></circle>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
              </svg>
            </div>
            <div class="empty-text">该角色暂无专属表情</div>
            <button class="add-emoji-btn" @click="showUploadModal = true">添加表情</button>
          </div>
          <div v-else class="emoji-grid-container">
            <div class="emoji-grid">
              <div 
                v-for="item in roleEmojis" 
                :key="item.id" 
                class="emoji-grid-item"
                :class="{ 'manage-mode': isManageMode, 'is-selected': selectedIds.has(item.id) }"
                @pointerdown="startPress(item.id, $event)"
                @pointerup="cancelPress"
                @pointerleave="cancelPress"
                @pointercancel="cancelPress"
                @click="handleClick(item.id)"
                @contextmenu.prevent
              >
                <img :src="item.previewUrl" :alt="item.name" class="emoji-img" loading="lazy" />
                <div class="emoji-name" :title="item.name">{{ item.name }}</div>
                <div v-if="isManageMode" class="emoji-select-overlay">
                  <div class="select-checkbox" :class="{ 'is-checked': selectedIds.has(item.id) }">
                    <svg v-if="selectedIds.has(item.id)" viewBox="0 0 24 24" width="14" height="14" stroke="white" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                  </div>
                </div>
              </div>
            </div>
            <div v-if="!isManageMode" class="floating-add-btn" @click="showUploadModal = true">
              <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            </div>
          </div>
        </div>

        <div v-else-if="activeTab === 'global'" key="global" class="emoji-tab-content">
          <div v-if="globalEmojis.length === 0" class="emoji-grid-empty">
            <div class="empty-icon">
              <svg viewBox="0 0 24 24" width="56" height="56" stroke="currentColor" stroke-width="1" fill="none" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="2" y1="12" x2="22" y2="12"></line>
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
              </svg>
            </div>
            <div class="empty-text">暂无全局角色表情包</div>
            <button class="add-emoji-btn" @click="showUploadModal = true">添加表情</button>
          </div>
          <div v-else class="emoji-grid-container">
            <div class="emoji-grid">
              <div 
                v-for="item in globalEmojis" 
                :key="item.id" 
                class="emoji-grid-item"
                :class="{ 'manage-mode': isManageMode, 'is-selected': selectedIds.has(item.id) }"
                @pointerdown="startPress(item.id, $event)"
                @pointerup="cancelPress"
                @pointerleave="cancelPress"
                @pointercancel="cancelPress"
                @click="handleClick(item.id)"
                @contextmenu.prevent
              >
                <img :src="item.previewUrl" :alt="item.name" class="emoji-img" loading="lazy" />
                <div class="emoji-name" :title="item.name">{{ item.name }}</div>
                <div v-if="isManageMode" class="emoji-select-overlay">
                  <div class="select-checkbox" :class="{ 'is-checked': selectedIds.has(item.id) }">
                    <svg v-if="selectedIds.has(item.id)" viewBox="0 0 24 24" width="14" height="14" stroke="white" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                  </div>
                </div>
              </div>
            </div>
            <div v-if="!isManageMode" class="floating-add-btn" @click="showUploadModal = true">
              <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            </div>
          </div>
        </div>
      </transition>
    </div>

    <!-- 底部管理操作栏 -->
    <transition name="slide-up">
      <div v-if="isManageMode" class="bottom-action-bar glass-overlay">
        <div class="select-all-btn" @click="toggleSelectAll">
          <div class="select-checkbox" :class="{ 'is-checked': isAllSelected }">
            <svg v-if="isAllSelected" viewBox="0 0 24 24" width="14" height="14" stroke="white" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
          </div>
          <span>全选</span>
        </div>
        <div class="actions-right">
          <div class="action-btn transfer-btn" :class="{ 'is-disabled': selectedIds.size === 0 }" @click="handleOpenTransferModal">
            转移/复制
          </div>
          <div class="action-btn move-btn" :class="{ 'is-disabled': selectedIds.size === 0 }" @click="handleOpenMoveModal">
            移动分组
          </div>
          <div class="action-btn delete-btn" :class="{ 'is-disabled': selectedIds.size === 0 }" @click="handleBatchDelete">
            删除 {{ selectedIds.size > 0 ? `(${selectedIds.size})` : '' }}
          </div>
        </div>
      </div>
    </transition>

    <!-- 自定义确认删除弹窗 -->
    <transition name="fade">
      <div v-if="showConfirmModal" class="confirm-modal-overlay">
        <div class="confirm-modal">
          <div class="confirm-title">确认删除</div>
          <div class="confirm-desc">
            {{ itemToDelete ? '确定要删除这个表情包吗？' : `确定要删除选中的 ${selectedIds.size} 个表情包吗？` }}
          </div>
          <div class="confirm-actions">
            <button class="btn-cancel" @click="showConfirmModal = false; itemToDelete = null">取消</button>
            <button class="btn-delete" @click="confirmDelete">删除</button>
          </div>
        </div>
      </div>
    </transition>

    <!-- 挂载复杂的上传解析弹窗 -->
    <ChatEmojiUploadModal
      :visible="showUploadModal"
      :target-category="activeTab"
      :target-role-id="targetRoleId"
      @close="showUploadModal = false"
      @imported="loadEmojis"
    />

    <!-- 分组管理弹窗 -->
    <ChatEmojiGroupManageModal
      v-model:visible="showGroupManageModal"
      v-model:category="activeTab"
    />

    <!-- 移动/添加分组选择弹窗 -->
    <ChatEmojiMoveModal
      v-model:visible="showMoveModal"
      :category="activeTab"
      :selected-emoji-ids="Array.from(selectedIds)"
      :current-group-id="activeGroupId"
      @success="handleMoveSuccess"
    />

    <!-- 单个表情编辑/删除弹窗 -->
    <ChatEmojiEditModal
      v-model:visible="showEditModal"
      :emoji="currentEditEmoji"
      @save="handleEditSave"
      @delete="handleEditDelete"
    />

    <!-- 表情大类转移弹窗 -->
    <ChatEmojiTransferModal
      v-model:visible="showTransferModal"
      :current-category="activeTab"
      :selected-emoji-ids="Array.from(selectedIds)"
      :target-role-id="targetRoleId"
      @success="handleTransferSuccess"
    />
  </div>
</template>

<style scoped>
.emoji-view-container {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: var(--bg-primary);
  z-index: 9999;
  display: flex;
  flex-direction: column;
}

.glass-overlay {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
}

.dark-theme .glass-overlay {
  background: rgba(30, 30, 30, 0.95);
}

.emoji-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  height: 60px;
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
}

.back-btn {
  color: var(--text-primary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  transition: background 0.2s;
}

.back-btn:active {
  background: var(--bg-secondary);
}

.emoji-title {
  font-size: 17px;
  font-weight: 600;
  color: var(--text-primary);
  letter-spacing: 0.5px;
}

.header-right {
  min-width: 48px;
  display: flex;
  justify-content: flex-end;
}

.manage-btn {
  font-size: 14px;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  transition: all 0.2s;
}

.manage-btn:active {
  background: var(--bg-secondary);
}

/* 搜索功能样式 */
.search-toggle-btn {
  color: var(--text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  margin-right: 4px;
  transition: background 0.2s;
}

.search-toggle-btn:active {
  background: var(--bg-secondary);
}

.search-bar-container {
  padding: 8px 16px;
  background: var(--bg-primary);
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
  overflow: hidden;
}

.search-input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  background: var(--bg-secondary);
  border-radius: 20px;
  padding: 6px 12px;
  transition: all 0.2s;
}

.search-input-wrapper:focus-within {
  background: var(--bg-primary);
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
}

.search-icon {
  color: var(--text-secondary);
  margin-right: 8px;
  flex-shrink: 0;
}

.search-input {
  flex: 1;
  border: none;
  background: transparent;
  font-size: 14px;
  color: var(--text-primary);
  outline: none;
  width: 100%;
}

.search-input::placeholder {
  color: #9ca3af;
}

.clear-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  cursor: pointer;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  margin-left: 8px;
  flex-shrink: 0;
  transition: background 0.2s;
}

.clear-btn:active {
  background: rgba(0, 0, 0, 0.1);
}

.slide-down-enter-active,
.slide-down-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.slide-down-enter-from,
.slide-down-leave-to {
  opacity: 0;
  transform: translateY(-10px);
  margin-top: -49px;
}

.emoji-tabs {
  display: flex;
  padding: 12px 20px;
  gap: 12px;
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
}

.emoji-tab {
  font-size: 14px;
  color: var(--text-secondary);
  padding: 8px 16px;
  border-radius: 20px;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  font-weight: 500;
  background: transparent;
}

.emoji-tab.active {
  color: var(--text-primary);
  background: var(--bg-secondary);
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
  transform: scale(1.05);
}

.group-nav-bar {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  background: var(--bg-primary);
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
}

.group-nav-scroll {
  flex: 1;
  display: flex;
  overflow-x: auto;
  gap: 8px;
  padding-right: 12px;
}

.group-nav-scroll::-webkit-scrollbar {
  display: none;
}

.group-pill {
  padding: 6px 14px;
  border-radius: 16px;
  background: var(--bg-secondary);
  color: var(--text-secondary);
  font-size: 13px;
  white-space: nowrap;
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid transparent;
}

.group-pill.active {
  background: rgba(59, 130, 246, 0.1);
  color: #3b82f6;
  border-color: rgba(59, 130, 246, 0.3);
  font-weight: 500;
}

.group-manage-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  cursor: pointer;
  border-radius: 50%;
  flex-shrink: 0;
  margin-left: 4px;
}

.group-manage-btn:active {
  background: var(--bg-secondary);
}

.emoji-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  position: relative;
  display: flex;
  flex-direction: column;
}

.emoji-grid-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--text-secondary);
  flex: 1;
}

.emoji-tab-content {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.emoji-grid-container {
  flex: 1;
  position: relative;
  height: 100%;
}

.emoji-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(76px, 1fr));
  gap: 12px;
  padding-bottom: 80px; /* 为浮动按钮留出空间 */
}

.emoji-grid-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  cursor: pointer;
  position: relative;
  border-radius: 8px;
  overflow: hidden;
  background: var(--bg-secondary);
  -webkit-touch-callout: none;
  -webkit-user-select: none;
  user-select: none;
}

.emoji-img {
  width: 100%;
  aspect-ratio: 1;
  object-fit: cover;
  -webkit-user-drag: none;
  pointer-events: none;
}

.emoji-name {
  font-size: 11px;
  color: var(--text-secondary);
  text-align: center;
  padding: 0 4px 6px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.emoji-select-overlay {
  position: absolute;
  top: 4px;
  right: 4px;
  z-index: 2;
}

.select-checkbox {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.8);
  background: rgba(0, 0, 0, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.select-checkbox.is-checked {
  background: #3b82f6;
  border-color: #3b82f6;
}

.emoji-grid-item.is-selected::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(59, 130, 246, 0.15);
  pointer-events: none;
}

.emoji-grid-item.manage-mode {
  transform: scale(0.96);
  border: 1px solid transparent;
}

.emoji-grid-item.is-selected {
  border-color: #3b82f6;
}

.emoji-content.has-bottom-bar {
  padding-bottom: 64px;
}

.floating-add-btn {
  position: fixed;
  bottom: 30px;
  right: 24px;
  width: 52px;
  height: 52px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  color: var(--text-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.5);
  border: 1px solid rgba(0, 0, 0, 0.05);
  cursor: pointer;
  z-index: 10;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.dark-theme .floating-add-btn {
  background: rgba(45, 45, 45, 0.85);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #e0e0e0;
}

.floating-add-btn:active {
  transform: scale(0.92);
  background: var(--bg-secondary);
}

.empty-icon {
  margin-bottom: 20px;
  color: #c0c0c0;
  opacity: 0.8;
}

.empty-text {
  font-size: 15px;
  margin-bottom: 28px;
  letter-spacing: 0.5px;
}

.add-emoji-btn {
  padding: 12px 28px;
  border-radius: 24px;
  background: var(--bg-secondary);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.05);
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  letter-spacing: 1px;
}

.add-emoji-btn:active {
  transform: scale(0.96);
  background: var(--border-color);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.fade-enter-from {
  opacity: 0;
  transform: translateY(10px);
}

.fade-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

.bottom-action-bar {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 64px;
  border-top: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  z-index: 100;
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

.select-all-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text-primary);
  font-size: 15px;
  cursor: pointer;
}

.select-all-btn .select-checkbox {
  border-color: var(--text-secondary);
  background: transparent;
}

.select-all-btn .select-checkbox.is-checked {
  background: #3b82f6;
  border-color: #3b82f6;
}

.actions-right {
  display: flex;
  gap: 12px;
}

.action-btn {
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  padding: 8px 16px;
  border-radius: 20px;
  transition: all 0.2s;
}

.action-btn.is-disabled {
  opacity: 0.5;
  cursor: not-allowed;
  pointer-events: none;
}

.transfer-btn {
  color: #8b5cf6;
  background: rgba(139, 92, 246, 0.1);
}

.transfer-btn:active {
  background: rgba(139, 92, 246, 0.2);
}

.move-btn {
  color: #3b82f6;
  background: rgba(59, 130, 246, 0.1);
}

.move-btn:active {
  background: rgba(59, 130, 246, 0.2);
}

.delete-btn {
  color: #ef4444;
  background: rgba(239, 68, 68, 0.1);
}

.delete-btn:active {
  background: rgba(239, 68, 68, 0.2);
}

.confirm-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.6); /* 加深遮罩 */
  backdrop-filter: blur(8px); /* 加强模糊 */
  -webkit-backdrop-filter: blur(8px);
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.confirm-modal {
  background: #ffffff; /* 强制纯白绝对不透明 */
  border-radius: 16px;
  width: 280px;
  padding: 24px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
  text-align: center;
}

.dark-theme .confirm-modal {
  background: #2d2d2d; /* 暗色模式也绝对不透明 */
}

.confirm-title {
  font-size: 17px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 12px;
}

.confirm-desc {
  font-size: 14px;
  color: var(--text-secondary);
  margin-bottom: 24px;
  line-height: 1.5;
}

.confirm-actions {
  display: flex;
  gap: 12px;
}

.confirm-actions button {
  flex: 1;
  padding: 10px 0;
  border-radius: 8px;
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  border: none;
  transition: all 0.2s;
}

.btn-cancel {
  background: #f3f4f6; /* 实体灰色 */
  color: var(--text-primary);
}

.dark-theme .btn-cancel {
  background: #3f3f46;
}

.btn-cancel:active {
  background: #e5e7eb;
}

.btn-delete {
  background: #ef4444;
  color: white;
}

.btn-delete:active {
  background: #dc2626;
}
</style>
