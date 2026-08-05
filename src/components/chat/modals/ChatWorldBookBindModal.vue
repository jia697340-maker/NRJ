/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { useChatState } from '../../../composables/useChatState'
import { worldBooks, worldBookGroups } from '../../../store'

const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'save'): void
}>()

const { selectedChat } = useChatState()

const closeModal = () => {
  emit('update:visible', false)
}

const toggleWorldBookBind = (bookId: string) => {
  if (!selectedChat.value) return
  if (!selectedChat.value.boundWorldBooks) {
    selectedChat.value.boundWorldBooks = []
  }
  const idx = selectedChat.value.boundWorldBooks.indexOf(bookId)
  if (idx > -1) {
    selectedChat.value.boundWorldBooks.splice(idx, 1)
  } else {
    selectedChat.value.boundWorldBooks.push(bookId)
  }
  emit('save')
}

const toggleWorldBookGroupBind = (groupId: string) => {
  if (!selectedChat.value) return
  if (!selectedChat.value.boundWorldBookGroups) {
    selectedChat.value.boundWorldBookGroups = []
  }
  const idx = selectedChat.value.boundWorldBookGroups.indexOf(groupId)
  if (idx > -1) {
    selectedChat.value.boundWorldBookGroups.splice(idx, 1)
  } else {
    selectedChat.value.boundWorldBookGroups.push(groupId)
  }
  emit('save')
}
</script>

<template>
  <div v-if="visible" class="wb-modal-overlay" @click.self="closeModal">
    <div class="wb-modal-content">
      <div class="wb-modal-header">
        <div class="wb-modal-title">管理关联设定</div>
        <div class="wb-modal-close" @click="closeModal">
          <svg viewBox="0 0 24 24" width="20" height="20" stroke="#333" stroke-width="2" fill="none"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </div>
      </div>
      <div class="wb-modal-body">
        <div class="wb-selector-panel">
          <div class="wb-section">
            <div class="wb-section-title">世界书分组</div>
            <div class="wb-list">
              <div 
                v-for="group in worldBookGroups" 
                :key="group.id"
                class="wb-item"
                :class="{ active: selectedChat?.boundWorldBookGroups?.includes(group.id) }"
                @click="toggleWorldBookGroupBind(group.id)"
              >
                <div class="wb-item-icon">📁</div>
                <div class="wb-item-name">{{ group.name }}</div>
              </div>
              <div v-if="worldBookGroups.length === 0" class="wb-empty">暂无分组</div>
            </div>
          </div>
          
          <div class="wb-section" style="margin-top: 12px;">
            <div class="wb-section-title">单本世界书</div>
            <div class="wb-list">
              <div 
                v-for="book in worldBooks.filter(b => b.type === 'book')" 
                :key="book.id"
                class="wb-item"
                :class="{ active: selectedChat?.boundWorldBooks?.includes(book.id) }"
                @click="toggleWorldBookBind(book.id)"
              >
                <div class="wb-item-icon" :style="{ backgroundColor: book.coverColor }">📖</div>
                <div class="wb-item-name">{{ book.title }}</div>
              </div>
              <div v-if="worldBooks.filter(b => b.type === 'book').length === 0" class="wb-empty">暂无单本世界书</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.wb-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.4);
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
}

.wb-modal-content {
  background: var(--sys-bg-secondary);
  width: 85%;
  max-width: 400px;
  max-height: 80vh;
  border-radius: 16px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.wb-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid var(--border-color);
}

.wb-modal-title {
  font-size: 16px;
  font-weight: bold;
  color: var(--text-primary);
}

.wb-modal-close {
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px;
  border-radius: 50%;
  transition: background 0.2s;
}

.wb-modal-close:hover {
  background: var(--sys-bg-primary);
}

.wb-modal-body {
  padding: 16px;
  overflow-y: auto;
}

.wb-selector-panel {
  background: #fcfcfc;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 12px;
}
.is-dark .wb-selector-panel {
  background: rgba(0,0,0,0.2);
}

.wb-section-title {
  font-size: 12px;
  color: var(--text-tertiary);
  margin-bottom: 8px;
  font-weight: 500;
}

.wb-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.wb-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  background: var(--sys-bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
  user-select: none;
}

.wb-item.active {
  background: #111;
  color: #fff;
  border-color: var(--text-primary);
}
.is-dark .wb-item.active {
  background: #eee;
  color: #111;
}

.wb-item-icon {
  font-size: 14px;
}

.wb-empty {
  font-size: 12px;
  color: #ccc;
  font-style: italic;
  padding: 4px 0;
}
</style>
