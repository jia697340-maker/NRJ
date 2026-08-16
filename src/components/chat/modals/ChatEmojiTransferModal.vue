/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useChatEmoji } from '../../../composables/useChatEmoji'
import type { EmojiCategory } from '../../../services/chatEmojiScope'

const props = defineProps<{
  visible: boolean
  currentCategory: EmojiCategory
  selectedEmojiIds: string[]
  targetRoleId?: string
  targetGroupId?: string
}>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'success'): void
}>()

const { transferEmojis } = useChatEmoji()

// 过滤掉当前所在的大类，只显示可供转移的其他大类
const availableCategories = computed(() => {
  const all: { id: 'user' | 'role' | 'global', name: string }[] = [
    { id: 'user', name: '用户' },
    { id: 'role', name: '此角色' },
    { id: 'global', name: '全局角色' }
  ]
  return all.filter(c => c.id !== props.currentCategory && (c.id !== 'role' || Boolean(props.targetRoleId)))
})

const selectedTargetCategories = ref<Set<'user' | 'role' | 'global'>>(new Set())
const isCopyMode = ref(false) // 默认是“同步清除”（移动模式）
const validationMessage = ref('')

const toggleCategory = (id: 'user' | 'role' | 'global') => {
  if (selectedTargetCategories.value.has(id)) {
    selectedTargetCategories.value.delete(id)
  } else {
    selectedTargetCategories.value.add(id)
  }
}

const handleClose = () => {
  emit('update:visible', false)
}

const handleConfirm = async () => {
  if (selectedTargetCategories.value.size === 0) {
    validationMessage.value = '请至少选择一个要转移至的大类'
    return
  }
  validationMessage.value = ''

  await transferEmojis(
    props.selectedEmojiIds,
    Array.from(selectedTargetCategories.value),
    props.targetRoleId,
    isCopyMode.value,
    props.targetGroupId
  )

  emit('success')
  handleClose()
}

watch(() => props.visible, (val) => {
  if (val) {
    // 每次打开重置状态
    selectedTargetCategories.value.clear()
    isCopyMode.value = false
  }
})
</script>

<template>
  <transition name="fade">
    <div v-if="visible" class="modal-overlay" @click.self="handleClose">
      <div class="modal-container">
        <header class="modal-header">
          <div class="header-left">
            <span class="close-btn" @click="handleClose">取消</span>
          </div>
          <div class="modal-title">转移表情包</div>
          <div class="header-right">
            <span class="confirm-btn" @click="handleConfirm">确定</span>
          </div>
        </header>

        <div class="modal-content">
          <div class="section-title">选择目标大类：</div>
          <div v-if="validationMessage" class="option-desc">{{ validationMessage }}</div>
          <div class="category-list">
            <div 
              v-for="cat in availableCategories" 
              :key="cat.id"
              class="category-item"
              @click="toggleCategory(cat.id)"
            >
              <div class="category-name">{{ cat.name }}</div>
              <div class="checkbox" :class="{ checked: selectedTargetCategories.has(cat.id) }">
                <svg v-if="selectedTargetCategories.has(cat.id)" viewBox="0 0 24 24" width="14" height="14" stroke="white" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
              </div>
            </div>
          </div>

          <div class="options-area">
            <label class="option-label">
              <div class="checkbox" :class="{ checked: isCopyMode }">
                <svg v-if="isCopyMode" viewBox="0 0 24 24" width="14" height="14" stroke="white" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
              </div>
              <input type="checkbox" v-model="isCopyMode" style="display:none;" />
              <span>保留原表情（复制模式）</span>
            </label>
            <div class="option-desc">
              勾选后，表情包将复制一份到目标大类，当前大类中的表情将不会被删除。如果不勾选，则表情将从当前大类彻底移走。
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
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  z-index: 10000;
  display: flex;
  align-items: flex-end;
}

.modal-container {
  width: 100%;
  background: #ffffff;
  border-radius: 20px 20px 0 0;
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: hidden;
  box-shadow: 0 -10px 40px rgba(0, 0, 0, 0.3);
  padding-bottom: env(safe-area-inset-bottom);
}

.dark-theme .modal-container {
  background: #1e1e1e;
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

.close-btn, .confirm-btn {
  font-size: 15px;
  cursor: pointer;
  padding: 8px;
}

.close-btn {
  color: var(--text-secondary);
}

.confirm-btn {
  color: #3b82f6;
  font-weight: 500;
}

.modal-content {
  padding: 20px;
  background: #f3f4f6;
}

.dark-theme .modal-content {
  background: #121212;
}

.section-title {
  font-size: 14px;
  color: var(--text-secondary);
  margin-bottom: 12px;
  padding-left: 4px;
}

.category-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 24px;
}

.category-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  background: #ffffff;
  border-radius: 12px;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
}

.dark-theme .category-item {
  background: #1e1e1e;
}

.category-item:active {
  transform: scale(0.98);
}

.category-name {
  font-size: 15px;
  color: var(--text-primary);
  font-weight: 500;
}

.options-area {
  padding: 16px;
  background: #ffffff;
  border: 1px solid rgba(59, 130, 246, 0.2);
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
}

.dark-theme .options-area {
  background: #1e1e1e;
}

.option-label {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 15px;
  color: var(--text-primary);
  cursor: pointer;
  margin-bottom: 8px;
  font-weight: 500;
}

.checkbox {
  width: 22px;
  height: 22px;
  border-radius: 6px;
  border: 2px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.checkbox.checked {
  background: #3b82f6;
  border-color: #3b82f6;
}

.option-desc {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.5;
  padding-left: 32px;
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
</style>
