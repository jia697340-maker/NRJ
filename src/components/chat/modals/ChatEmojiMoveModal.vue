/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useChatEmoji } from '../../../composables/useChatEmoji'

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'success'): void
}>()

const visible = defineModel<boolean>('visible')
const props = defineProps<{
  category: 'user' | 'role' | 'global'
  selectedEmojiIds: string[]
  currentGroupId: string | null // 如果当前正在某个分组下查看，传入此ID
}>()

const { groups, updateEmojisGroup } = useChatEmoji()

const currentCategoryGroups = computed(() => groups.value.filter(g => g.category === props.category))

const selectedTargetGroupIds = ref<Set<string>>(new Set())

// 是否要从当前查看的分组中移出
const removeFromCurrent = ref(true)

const handleConfirm = async () => {
  if (selectedTargetGroupIds.value.size === 0) {
    alert('请至少选择一个目标分组')
    return
  }

  const targetIds = Array.from(selectedTargetGroupIds.value)

  // 先追加到目标分组
  await updateEmojisGroup(props.selectedEmojiIds, targetIds, 'add')

  // 如果是在特定分组下，并且选择了“移出当前分组”，并且目标不包含当前分组
  if (props.currentGroupId && removeFromCurrent.value && !targetIds.includes(props.currentGroupId)) {
    await updateEmojisGroup(props.selectedEmojiIds, [props.currentGroupId], 'remove')
  }

  emit('success')
  visible.value = false
}

const toggleSelect = (id: string) => {
  if (selectedTargetGroupIds.value.has(id)) {
    selectedTargetGroupIds.value.delete(id)
  } else {
    selectedTargetGroupIds.value.add(id)
  }
}

watch(visible, (val) => {
  if (!val) {
    selectedTargetGroupIds.value.clear()
    removeFromCurrent.value = true
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
          <div class="modal-title">移动 / 添加到分组</div>
          <div class="header-right">
            <span class="confirm-btn" @click="handleConfirm">确定</span>
          </div>
        </header>

        <div class="modal-content">
          <div v-if="currentCategoryGroups.length === 0" class="empty-hint">
            该分类下暂无分组，请先去管理分组中创建。
          </div>
          
          <template v-else>
            <div class="group-list">
              <div 
                v-for="group in currentCategoryGroups" 
                :key="group.id"
                class="group-item"
                @click="toggleSelect(group.id)"
              >
                <div class="group-name">{{ group.name }}</div>
                <div class="checkbox" :class="{ checked: selectedTargetGroupIds.has(group.id) }">
                  <svg v-if="selectedTargetGroupIds.has(group.id)" viewBox="0 0 24 24" width="14" height="14" stroke="white" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                </div>
              </div>
            </div>

            <div v-if="props.currentGroupId" class="options-area">
              <label class="option-label">
                <div class="checkbox mini" :class="{ checked: removeFromCurrent }">
                  <svg v-if="removeFromCurrent" viewBox="0 0 24 24" width="12" height="12" stroke="white" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                </div>
                <input type="checkbox" v-model="removeFromCurrent" style="display:none;" />
                <span>同时从当前分组中移出 (移动操作)</span>
              </label>
              <div class="option-desc">如果不勾选，则为添加到新分组，表情包将同时存在于当前分组和目标分组中。</div>
            </div>
          </template>
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
  max-height: 70%;
  background: #ffffff; /* 强制纯白，杜绝透明 */
  border-radius: 20px 20px 0 0;
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: hidden;
  box-shadow: 0 -10px 40px rgba(0, 0, 0, 0.3);
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
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  background: #f3f4f6; /* 内容区底色 */
}

.dark-theme .modal-content {
  background: #121212;
}

.empty-hint {
  text-align: center;
  color: var(--text-secondary);
  font-size: 14px;
  padding: 32px 0;
}

.group-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.group-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  background: #ffffff;
  border-radius: 12px;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
}

.dark-theme .group-item {
  background: #1e1e1e;
}

.group-item:active {
  transform: scale(0.98);
}

.group-name {
  font-size: 15px;
  color: var(--text-primary);
}

.checkbox {
  width: 22px;
  height: 22px;
  border-radius: 50%;
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

.options-area {
  margin-top: 24px;
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
  gap: 8px;
  font-size: 14px;
  color: var(--text-primary);
  cursor: pointer;
  margin-bottom: 8px;
}

.checkbox.mini {
  width: 18px;
  height: 18px;
}

.option-desc {
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.4;
  padding-left: 26px;
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
