/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
const props = defineProps<{
  customPresetSvgs: any[]
  selectedManagePresets: Set<number>
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'toggle-all'): void
  (e: 'toggle-preset', index: number): void
  (e: 'delete-selected'): void
}>()
</script>

<template>
  <div class="canvas-modal-overlay" style="z-index: 10005;" @click.self="emit('close')">
    <div class="manage-groups-modal">
      <div class="mg-header">
        <span class="mg-title">SVG 预设管理</span>
        <span class="mg-close" @click="emit('toggle-all')">{{ selectedManagePresets.size === customPresetSvgs.length && customPresetSvgs.length > 0 ? '取消全选' : '全选' }}</span>
      </div>
      <div class="mg-list">
        <div v-if="customPresetSvgs.length === 0" class="mg-empty">
          暂无自定义预设
        </div>
        <div v-for="(p, idx) in customPresetSvgs" :key="idx" class="mg-item" @click="emit('toggle-preset', idx)">
          <div style="display: flex; align-items: center; gap: 12px; flex: 1; overflow: hidden;">
            <div v-html="p.svg" style="width: 24px; height: 24px; display: flex; align-items: center; justify-content: center;"></div>
            <span class="mg-name">{{ p.name }}</span>
          </div>
          <div class="mg-checkbox" :class="{ checked: selectedManagePresets.has(idx) }">
            <svg v-if="selectedManagePresets.has(idx)" viewBox="0 0 24 24" width="14" height="14" stroke="white" stroke-width="3" fill="none"><polyline points="20 6 9 17 4 12"></polyline></svg>
          </div>
        </div>
      </div>
      <div class="mg-footer">
        <div class="cd-btn cancel" @click="emit('close')">关闭</div>
        <div class="cd-btn danger" :class="{ disabled: selectedManagePresets.size === 0 }" @click="emit('delete-selected')">删除</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 分组管理列表弹窗 */
.manage-groups-modal {
  width: 90%;
  max-width: 360px;
  background: var(--sys-bg-primary);
  border-radius: 16px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  max-height: 70vh;
  box-shadow: 0 20px 40px rgba(0,0,0,0.15);
}
.mg-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  background: var(--sys-bg-secondary);
  border-bottom: 1px solid var(--border-color);
}
.mg-title {
  font-size: 17px;
  font-weight: 600;
  color: var(--text-primary);
}
.mg-close {
  font-size: 15px;
  color: #007aff;
  font-weight: 500;
  cursor: pointer;
}
.mg-list {
  flex: 1;
  overflow-y: auto;
  padding: 12px 20px;
}
.mg-empty {
  text-align: center;
  color: var(--text-tertiary);
  font-size: 14px;
  padding: 30px 0;
}
.mg-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--sys-bg-secondary);
  padding: 12px 16px;
  border-radius: 12px;
  margin-bottom: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.02);
}
.mg-name {
  font-size: 15px;
  color: var(--text-primary);
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.mg-checkbox {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}
.mg-checkbox.checked {
  background: #ff3b30;
  border-color: #ff3b30;
}

.mg-footer {
  display: flex;
  padding: 16px;
  gap: 12px;
  border-top: 1px solid var(--border-color);
  background: var(--sys-bg-secondary);
}
.mg-footer .cd-btn {
  flex: 1;
  text-align: center;
  border-radius: 8px;
  font-size: 15px;
  padding: 10px 0;
  cursor: pointer;
  font-weight: 600;
  transition: all 0.2s;
}
.mg-footer .cancel {
  background: var(--sys-bg-primary);
  color: var(--text-primary);
}
.mg-footer .danger {
  background: #ff3b30;
  color: #fff;
}
.mg-footer .danger.disabled {
  background: #ffcccc;
  pointer-events: none;
}
.canvas-modal-overlay {
  z-index: 10005;
}
</style>
