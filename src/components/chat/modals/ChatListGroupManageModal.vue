/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
const props = defineProps<{
  customGroups: string[]
  selectedManageGroups: Set<string>
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'toggle-all'): void
  (e: 'toggle-group', group: string): void
  (e: 'rename-group', group: string): void
  (e: 'delete-selected'): void
  (e: 'merge-selected'): void
}>()
</script>

<template>
  <div class="canvas-modal-overlay designer-overlay" @click.self="emit('close')">
    <div class="designer-modal">
      <div class="dm-bg-text">MANAGE</div>
      <div class="dm-header">
        <div class="dm-title-area">
          <span class="dm-cn">管理分组</span>
        </div>
        <span class="dm-select-all" @click="emit('toggle-all')">
          {{ selectedManageGroups.size === customGroups.length && customGroups.length > 0 ? '取消全选' : '全选' }}
        </span>
      </div>
      
      <div class="dm-list">
        <div v-if="customGroups.length === 0" class="dm-empty">
          <span class="dm-empty-cn">暂无自定义分组</span>
        </div>
        <div v-for="g in customGroups" :key="g" class="dm-item" :class="{ 'is-selected': selectedManageGroups.has(g) }" @click="emit('toggle-group', g)">
          <div class="dm-item-info">
            <span class="dm-item-name">{{ g }}</span>
          </div>
          <div class="dm-item-actions">
            <span class="dm-action-text edit" @click.stop="emit('rename-group', g)">重命名</span>
            <div class="dm-status-dot"></div>
          </div>
        </div>
      </div>

      <div class="dm-footer">
        <div class="dm-btn cancel" @click="emit('close')">关闭</div>
        <div class="dm-btn danger" :class="{ disabled: selectedManageGroups.size === 0 }" @click="emit('delete-selected')">删除</div>
        <div class="dm-btn confirm" :class="{ disabled: selectedManageGroups.size < 2 }" @click="emit('merge-selected')">合并</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* =========================================================
   Designer Style Manage Groups Modal (Pure CSS, No SVG) 
   ========================================================= */

.designer-overlay {
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  z-index: 9999;
}

.designer-modal {
  width: 90%;
  max-width: 380px;
  background: #fff;
  border-radius: 20px;
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  max-height: 75vh;
  box-shadow: 0 20px 50px rgba(0,0,0,0.15);
  animation: scaleIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

:root.dark .designer-modal,
.dark-mode .designer-modal {
  background: #1a1a1a;
  border: 1px solid #333;
}

.dm-bg-text {
  display: none; /* Removed as requested */
}

.dm-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  padding: 30px 24px 20px;
  position: relative;
  z-index: 1;
}

.dm-title-area {
  display: flex;
  flex-direction: column;
}

.dm-title-area .dm-cn {
  font-size: 22px;
  font-weight: 600;
  color: #111;
  letter-spacing: 1px;
}

:root.dark .dm-title-area .dm-cn,
.dark-mode .dm-title-area .dm-cn {
  color: #eee;
}

.dm-select-all {
  font-size: 11px;
  font-weight: 700;
  color: #111;
  letter-spacing: 1px;
  cursor: pointer;
  border-bottom: 1px solid #111;
  padding-bottom: 2px;
  transition: opacity 0.2s;
}

:root.dark .dm-select-all,
.dark-mode .dm-select-all {
  color: #eee;
  border-bottom-color: #eee;
}

.dm-select-all:active {
  opacity: 0.5;
}

.dm-list {
  flex: 1;
  overflow-y: auto;
  padding: 10px 24px 20px;
  position: relative;
  z-index: 1;
}

.dm-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 0;
  opacity: 0.5;
}

.dm-empty-cn {
  font-size: 14px;
  color: #888;
}

.dm-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 0;
  border-bottom: 1px solid #f0f0f0;
  cursor: pointer;
  transition: all 0.2s;
}

:root.dark .dm-item,
.dark-mode .dm-item {
  border-bottom-color: #333;
}

.dm-item:last-child {
  border-bottom: none;
}

.dm-item-info {
  flex: 1;
  min-width: 0;
}

.dm-item-name {
  font-size: 16px;
  font-weight: 500;
  color: #333;
  display: block;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: color 0.2s;
}

:root.dark .dm-item-name,
.dark-mode .dm-item-name {
  color: #ccc;
}

.dm-item-actions {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-left: 16px;
}

.dm-action-text {
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 1px;
  color: #999;
  cursor: pointer;
  transition: color 0.2s;
}

.dm-action-text:hover {
  color: #111;
}

:root.dark .dm-action-text:hover,
.dark-mode .dm-action-text:hover {
  color: #fff;
}

.dm-status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #ddd;
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

:root.dark .dm-status-dot,
.dark-mode .dm-status-dot {
  background: #444;
}

.dm-item.is-selected .dm-item-name {
  color: #111;
  font-weight: 600;
}

:root.dark .dm-item.is-selected .dm-item-name,
.dark-mode .dm-item.is-selected .dm-item-name {
  color: #fff;
}

.dm-item.is-selected .dm-status-dot {
  background: #111;
  transform: scale(1.5);
}

:root.dark .dm-item.is-selected .dm-status-dot,
.dark-mode .dm-item.is-selected .dm-status-dot {
  background: #fff;
}

.dm-footer {
  display: flex;
  padding: 20px 24px 24px;
  gap: 12px;
  position: relative;
  z-index: 1;
}

.dm-btn {
  flex: 1;
  text-align: center;
  border-radius: 12px;
  font-size: 14px;
  padding: 14px 0;
  cursor: pointer;
  font-weight: 600;
  letter-spacing: 1px;
  transition: all 0.2s;
}

.dm-btn.cancel {
  background: #f8f8f8;
  color: #666;
}

:root.dark .dm-btn.cancel,
.dark-mode .dm-btn.cancel {
  background: #222;
  color: #999;
}

.dm-btn.danger {
  background: #fff0f0;
  color: #ff3b30;
}

:root.dark .dm-btn.danger,
.dark-mode .dm-btn.danger {
  background: rgba(255, 59, 48, 0.1);
}

.dm-btn.danger.disabled {
  opacity: 0.4;
  pointer-events: none;
}

.dm-btn.confirm {
  background: #111;
  color: #fff;
}

:root.dark .dm-btn.confirm,
.dark-mode .dm-btn.confirm {
  background: #eee;
  color: #111;
}

.dm-btn.confirm.disabled {
  background: #f0f0f0;
  color: #ccc;
  pointer-events: none;
}

:root.dark .dm-btn.confirm.disabled,
.dark-mode .dm-btn.confirm.disabled {
  background: #333;
  color: #666;
}

.dm-btn:active:not(.disabled) {
  transform: scale(0.96);
}

@keyframes scaleIn {
  from { transform: scale(0.95); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}
</style>
