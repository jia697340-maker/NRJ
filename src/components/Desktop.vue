/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { ref } from 'vue'
import { globalSettings } from '../store'
import AppIcon from './AppIcon.vue'
import MomentCard from './MomentCard.vue'
import DualAvatarWidget from './DualAvatarWidget.vue'
import { useChatState } from '../composables/useChatState'

const chatState = useChatState()

const scrollContainer = ref<HTMLElement | null>(null)
const currentPage = ref(0)

const handleScroll = () => {
  if (scrollContainer.value) {
    const scrollLeft = scrollContainer.value.scrollLeft
    const width = scrollContainer.value.clientWidth
    currentPage.value = Math.round(scrollLeft / width)
  }
}

defineProps<{
  apps: Array<{
    id: string
    name: string
    icon: string
    color: string
  }>
}>()

defineEmits(['open-app'])
</script>

<template>
  <div class="desktop">
    <!-- 横向滑动的页面容器 -->
    <div class="pages-container" ref="scrollContainer" @scroll="handleScroll">
      
      <!-- 第一页 -->
      <div class="page">
        <!-- 顶部预留大型组件区 -->
        <div class="top-widget-area">
          <MomentCard />
        </div>

        <!-- 中部内容区：左侧 APP 网格，右侧预留小组件区 -->
        <div class="middle-content">
          <div class="app-grid">
            <!-- 左侧桌面仅渲染索引 4 之后的应用 (共4个) -->
            <AppIcon 
              v-for="app in apps.slice(4, 8)" 
              :key="app.id" 
              :app="app"
              :badge="app.id === 'chat' ? chatState.totalUnreadCount.value : 0"
              @click="$emit('open-app', app.id)"
            />
          </div>
          <div class="right-widget-area">
            <DualAvatarWidget />
          </div>
        </div>
      </div>

      <!-- 第二页 -->
      <div class="page">
        <!-- 第二页应用网格，使用全宽 -->
        <div class="page-two-grid">
          <AppIcon 
            v-for="app in apps.slice(8)" 
            :key="app.id" 
            :app="app"
            :badge="app.id === 'chat' ? chatState.totalUnreadCount.value : 0"
            @click="$emit('open-app', app.id)"
          />
        </div>
      </div>

    </div>

    <!-- 页面指示器 -->
    <div class="page-indicator">
      <div class="dot" :class="{ active: currentPage === 0 }"></div>
      <div class="dot" :class="{ active: currentPage === 1 }"></div>
    </div>
    
    <!-- 底部固定 Dock 栏 -->
    <div class="dock-container">
      <div class="dock">
        <!-- 抽取前几个作为 dock 应用 -->
        <AppIcon 
          v-for="app in apps.slice(0, 4)" 
          :key="`dock-${app.id}`" 
          :app="{...app, name: globalSettings.showDockAppNames ? app.name : ''}"
          :badge="app.id === 'chat' ? chatState.totalUnreadCount.value : 0"
          @click="$emit('open-app', app.id)"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.desktop {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding-top: 6vh; /* 状态栏高度的响应式预留 */
  position: relative;
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  overflow: hidden;
  color: var(--text-primary);
}

.pages-container {
  flex: 1;
  display: flex;
  width: 100%;
  overflow-x: auto;
  overflow-y: hidden;
  scroll-snap-type: x mandatory;
  scrollbar-width: none; /* Firefox */
  -ms-overflow-style: none;  /* IE and Edge */
}
.pages-container::-webkit-scrollbar {
  display: none; /* Chrome, Safari, Opera */
}

.page {
  flex: 0 0 100%;
  width: 100%;
  height: 100%;
  scroll-snap-align: start;
  display: flex;
  flex-direction: column;
}

.page-two-grid {
  padding: 4vh 6vw;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 4vh 2vw;
}

.page-indicator {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 1.5vw;
  padding-bottom: 1vh;
}

.dot {
  width: 1.5vw;
  height: 1.5vw;
  background-color: rgba(255, 255, 255, 0.4);
  border-radius: 50%;
  transition: all 0.3s ease;
}

.dot.active {
  background-color: rgba(255, 255, 255, 0.9);
  width: 2vw;
  height: 2vw;
}

.top-widget-area {
  margin: 1.5vh 5vw;
  display: flex;
  justify-content: center;
}

.middle-content {
  flex: 1;
  display: flex;
  padding: 0 5vw;
  gap: 4vw;
  box-sizing: border-box;
}

.app-grid {
  flex: 1; /* 占据左侧空间 */
  display: grid;
  grid-template-columns: repeat(2, 1fr); /* 一行两个 */
  gap: 2.5vh 3vw; /* 稍微拉开一点间距，让排版更舒展 */
  align-content: center; /* 改为居中对齐，和小组件保持水平一致 */
  width: 100%; /* 确保填满左半边 */
}

.right-widget-area {
  flex: 1; /* 占据右侧空间 */
  border-radius: 4vw;
  display: flex;
  flex-direction: column;
  justify-content: center; /* 确保内部小组件垂直居中 */
}

.dock-container {
  padding: 1.5vh 4vw 3vh;
  width: 100%;
  box-sizing: border-box;
}

.dock {
  background-color: var(--dock-bg);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-radius: 6vw; /* 基于宽度的响应式大圆角 */
  padding: 2vh 3vw;
  display: flex;
  justify-content: space-around;
  align-items: center;
  width: 100%;
  transition: background-color 0.3s;
}

/* PC 端宽屏适配 */
@media (min-width: 768px) {
  .page-two-grid {
    padding: 60px;
    gap: 40px 60px; /* 调整间距：上下40px，左右60px */
    grid-template-columns: repeat(auto-fill, minmax(64px, 1fr)); /* 基于缩小后的图标调整网格列宽 */
    justify-content: center; /* 居中网格内容 */
  }

  .middle-content {
    padding: 0 40px;
    gap: 60px; /* 拉开左右两边的间距 */
    max-width: 960px; /* 限制中间内容区最大宽度，避免太散 */
    margin: 0 auto;
  }

  .app-grid {
    gap: 30px 40px; /* 固定间距 */
  }
  
  .dock-container {
    display: flex;
    justify-content: center;
  }

  .dock {
    max-width: 500px; /* 限制 Dock 栏最大宽度 */
    border-radius: 28px; /* 固定圆角 */
    padding: 2vh 20px;
  }
}
</style>
