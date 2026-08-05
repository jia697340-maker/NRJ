/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
const props = defineProps<{
  customGroups: string[]
  tempSelectedGroups: Set<string>
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'toggle-group', group: string): void
  (e: 'confirm'): void
}>()
</script>

<template>
  <div class="canvas-modal-overlay" @click.self="emit('close')">
    <div class="canvas-modal-content" style="max-height: 500px; padding: 0;">
      <div style="padding: 20px; font-size: 16px; font-weight: 600; text-align: center; border-bottom: 1px solid var(--border-color);">
        移动分组
      </div>
      <div style="flex: 1; overflow-y: auto; padding: 12px;">
        <div v-if="customGroups.length === 0" style="text-align: center; color: var(--text-tertiary); font-size: 13px; margin: 20px 0;">
          暂无自定义分组，请先新建分组
        </div>
        <div 
          v-for="g in customGroups" 
          :key="g" 
          class="assign-group-item"
          @click="emit('toggle-group', g)"
          style="display: flex; align-items: center; justify-content: space-between; padding: 12px; cursor: pointer; transition: background 0.2s;"
        >
          <span style="font-size: 15px;">{{ g }}</span>
          <div class="checkbox" :class="{ checked: tempSelectedGroups.has(g) }" style="width: 20px; height: 20px; border-radius: 50%; border: 1px solid var(--border-color); display: flex; align-items: center; justify-content: center; transition: all 0.2s;">
            <svg v-if="tempSelectedGroups.has(g)" viewBox="0 0 24 24" width="14" height="14" stroke="white" stroke-width="3" fill="none"><polyline points="20 6 9 17 4 12"></polyline></svg>
          </div>
        </div>
      </div>
      <div style="padding: 16px; display: flex; gap: 12px; border-top: 1px solid var(--border-color);">
        <div class="cd-btn cancel" style="flex: 1; padding: 14px 0; text-align: center; cursor: pointer; background: var(--sys-bg-primary); border-radius: 8px; font-size: 15px; transition: background 0.2s;" @click="emit('close')">取消</div>
        <div class="cd-btn confirm" style="flex: 1; padding: 14px 0; text-align: center; cursor: pointer; background: #111; color: #fff; border-radius: 8px; font-size: 15px; transition: background 0.2s;" @click="emit('confirm')">确定</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.canvas-modal-overlay {
  z-index: 9999;
}
.canvas-modal-content {
  width: 90%;
  max-width: 360px;
  background: var(--sys-bg-primary);
  border-radius: 16px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 10px 30px rgba(0,0,0,0.1);
}
.cd-btn {
  font-weight: 600;
  cursor: pointer;
}
</style>
