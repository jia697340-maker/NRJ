/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { ref } from 'vue'

const emit = defineEmits<{
  (e: 'close'): void
}>()

</script>

<template>
  <div class="app-widget-beautify">
    <div class="header">
      <h2>小组件美化</h2>
    </div>
    
    <div class="content">
      <p class="placeholder-text">小组件美化功能开发中...</p>
    </div>

    <!-- 底部 Home 键指示条 -->
    <div class="home-indicator-area" @click="emit('close')">
      <div class="home-indicator"></div>
    </div>
  </div>
</template>

<style scoped>
.app-widget-beautify {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: var(--sys-bg-primary, #ffffff);
  z-index: 50;
  display: flex;
  flex-direction: column;
  animation: appOpen 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
  color: var(--text-primary, #000000);
}

.header {
  padding: 40px 20px 20px;
  text-align: center;
  border-bottom: 1px solid var(--border-color, #eee);
}

.header h2 {
  margin: 0;
  font-size: 1.2rem;
  font-weight: 600;
}

.content {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.placeholder-text {
  color: var(--text-secondary, #666);
  font-size: 1rem;
}

.home-indicator-area {
  height: 34px;
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  position: absolute;
  bottom: 0;
  cursor: pointer;
  z-index: 60;
}

.home-indicator {
  width: 134px;
  height: 5px;
  background-color: var(--text-primary, #000000);
  border-radius: 10px;
  opacity: 0.8;
}

@keyframes appOpen {
  from {
    transform: scale(0.8);
    opacity: 0;
  }
  to {
    transform: scale(1);
    opacity: 1;
  }
}
</style>
