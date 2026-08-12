/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
const emit = defineEmits(['close'])

const handleBack = () => {
  emit('close')
}
</script>

<template>
  <div class="wardrobe-container">
    <div class="header">
      <div class="back-btn" @click="handleBack">
        <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="15 18 9 12 15 6"></polyline>
        </svg>
      </div>
      <div class="title">衣柜</div>
      <div class="header-right"></div>
    </div>
    <div class="content">
      <div class="empty-state">
        <div class="empty-text">衣柜功能开发中...</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.wardrobe-container {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: var(--sys-bg-primary);
  z-index: 1000;
  display: flex;
  flex-direction: column;
}

.header {
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  border-bottom: 1px solid var(--border-color);
  padding-top: env(safe-area-inset-top);
}

.back-btn {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  cursor: pointer;
  color: var(--text-primary);
}

.title {
  font-size: 17px;
  font-weight: 600;
  color: var(--text-primary);
}

.header-right {
  width: 40px;
}

.content {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow-y: auto;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  opacity: 0.6;
}

.empty-text {
  font-size: 15px;
  color: var(--text-secondary);
}
</style>
