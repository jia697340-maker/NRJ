/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  appId: string
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

// 根据 appId 简单模拟不同界面的背景色和标题
const appDetails = computed(() => {
  const map: Record<string, { title: string, bg: string }> = {
    phone: { title: '电话', bg: '#f2f2f7' },
    messages: { title: '信息', bg: '#ffffff' },
    browser: { title: '浏览器', bg: '#ffffff' },
    camera: { title: '相机', bg: '#000000' },
    weather: { title: '天气', bg: '#4a90e2' },
    calculator: { title: '计算器', bg: '#000000' },
  }
  return map[props.appId] || { title: '应用', bg: '#ffffff' }
})
</script>

<template>
  <div class="app-container" :style="{ backgroundColor: appDetails.bg }">
    <div class="app-content">
      <h1 :style="{ color: appDetails.bg === '#000000' ? 'white' : 'black' }">
        {{ appDetails.title }}
      </h1>
      <p :style="{ color: appDetails.bg === '#000000' ? '#ccc' : '#666' }">
        这是一个模拟的 {{ appDetails.title }} 应用界面
      </p>
    </div>
    
    <!-- 底部 Home 键/指示条，点击返回桌面 -->
    <div class="home-indicator-area" @click="emit('close')">
      <div class="home-indicator" :class="{ 'dark': appDetails.bg !== '#000000' }"></div>
    </div>
  </div>
</template>

<style scoped>
.app-container {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 50;
  display: flex;
  flex-direction: column;
  animation: appOpen 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
}

.app-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 20px;
  text-align: center;
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
  background-color: var(--sys-bg-secondary);
  border-radius: 10px;
}

.home-indicator.dark {
  background-color: var(--text-primary);
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
