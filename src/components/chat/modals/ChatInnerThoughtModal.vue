<!-- WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ -->
<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useChatState } from '../../../composables/useChatState'

const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const { selectedChat } = useChatState()

const daysKnown = computed(() => {
  if (!selectedChat.value || !selectedChat.value.messages || selectedChat.value.messages.length === 0) return 0
  const firstMsg = selectedChat.value.messages[0]
  const firstTime = firstMsg.id > 1000000000000 ? firstMsg.id : Date.now()
  const now = Date.now()
  const diff = Math.max(0, now - firstTime)
  return Math.floor(diff / (1000 * 60 * 60 * 24))
})

const currentIndex = ref(0)
const currentThought = computed(() => {
  if (!selectedChat.value || !selectedChat.value.innerThoughts) return null
  return selectedChat.value.innerThoughts[currentIndex.value] || null
})

const nextThought = () => {
  if (selectedChat.value && selectedChat.value.innerThoughts && currentIndex.value < selectedChat.value.innerThoughts.length - 1) {
    currentIndex.value++
  }
}

const prevThought = () => {
  if (currentIndex.value > 0) {
    currentIndex.value--
  }
}

watch(() => props.visible, (newVal) => {
  if (newVal) {
    currentIndex.value = 0
  }
})
</script>

<template>
  <transition name="elegant-fade">
    <div v-if="visible" class="elegant-overlay" @click="emit('close')" @touchmove.prevent>
      
      <!-- 统一的模态框容器 -->
      <div class="modal-container" @click.stop>

        <!-- 外部顶部操作区 (毛玻璃质感) -->
        <div class="floating-controls-top">
          <div style="width: 38px;"></div> <!-- 占位保持关闭按钮右对齐 -->
          <div class="glass-btn close-btn" @click="emit('close')">
            <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </div>
        </div>
      
        <!-- 纯净的悬浮卡片 (支持内部滚动) -->
        <div class="elegant-card">
        
          <!-- 四角装饰 SVG -->
          <div class="corner top-left">
            <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="1" fill="none">
              <path d="M4 20v-8a8 8 0 0 1 8-8h8" stroke-linecap="round"/>
            </svg>
          </div>
          <div class="corner top-right">
            <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="1" fill="none" style="transform: rotate(90deg);">
              <path d="M4 20v-8a8 8 0 0 1 8-8h8" stroke-linecap="round"/>
            </svg>
          </div>
          <div class="corner bottom-right">
            <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="1" fill="none" style="transform: rotate(180deg);">
              <path d="M4 20v-8a8 8 0 0 1 8-8h8" stroke-linecap="round"/>
            </svg>
          </div>
          <div class="corner bottom-left">
            <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="1" fill="none" style="transform: rotate(-90deg);">
              <path d="M4 20v-8a8 8 0 0 1 8-8h8" stroke-linecap="round"/>
            </svg>
          </div>

          <!-- 内部滚动区域，替代原本的 border 层 -->
          <div class="scrollable-content">

            <!-- 顶部头像与信息区 -->
            <div class="profile-header" v-if="selectedChat">
              <div class="avatar-wrapper">
                <img v-if="selectedChat.avatarUrl" :src="selectedChat.avatarUrl" class="avatar-img" />
                <div v-else class="avatar-text-fallback">{{ selectedChat.avatarText || '?' }}</div>
              </div>
              <div class="profile-info">
                <div class="char-name">{{ selectedChat.remark || selectedChat.name }}</div>
                <div class="char-signature">▷ 相识第 {{ daysKnown }} 天 𝄞 ₊·♫</div>
              </div>
            </div>

            <!-- 中间心声文字区域 -->
            <div class="thought-content-area">
              <template v-if="currentThought">
                <div class="text-content">
                  {{ currentThought.content }}
                </div>
              </template>
              <template v-else>
                <div class="empty-thought-state">
                  <div class="empty-text">当前还没有任何心声</div>
                </div>
              </template>
            </div>

            <!-- 底部预留图片区域 (靠左对齐) -->
            <div class="bottom-image-placeholder">
              <div class="placeholder-box">
                <svg viewBox="0 0 24 24" width="32" height="32" stroke="#D0D0D0" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19"></line>
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
              </div>
            </div>

          </div>

        </div>

      </div>
      
      <!-- 外部底部指示器与翻页 -->
      <div class="floating-controls-bottom" v-if="currentThought">
        <div class="glass-bar">
          <div class="nav-controls" v-if="selectedChat && selectedChat.innerThoughts && selectedChat.innerThoughts.length > 0">
            <div class="glass-btn nav-btn" :class="{ disabled: currentIndex === 0 }" @click.stop="prevThought">
              <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
            </div>
            
            <div class="nav-page-number">
              {{ currentIndex + 1 }} / {{ selectedChat.innerThoughts.length }}
            </div>
            
            <div class="glass-btn nav-btn" :class="{ disabled: currentIndex === selectedChat.innerThoughts.length - 1 }" @click.stop="nextThought">
              <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
            </div>
          </div>
        </div>
      </div>

    </div>
  </transition>
</template>

<style scoped>
/* 基础遮罩与动画 */
.elegant-fade-enter-active,
.elegant-fade-leave-active {
  transition: opacity 0.3s ease;
}
.elegant-fade-enter-from,
.elegant-fade-leave-to {
  opacity: 0;
}

.elegant-overlay {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

/* 毛玻璃通用样式 */
.glass-btn {
  background: rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.3);
  color: #FFFFFF;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}
.glass-btn:hover {
  background: rgba(255, 255, 255, 0.25);
}
.glass-btn:active {
  background: rgba(255, 255, 255, 0.35);
  transform: scale(0.95);
}

.close-btn {
  width: 38px;
  height: 38px;
  border-radius: 50%;
}

/* 外层容器 */
.modal-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  max-width: 400px;
  gap: 20px;
}

/* 外部悬浮顶部操作区 */
.floating-controls-top {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 4px;
}

/* 居中悬浮纯白卡片 */
.elegant-card {
  position: relative;
  background: #FFFFFF;
  border-radius: 12px;
  width: 100%;
  max-height: 85vh; /* 弹性高度，防止溢出 */
  box-shadow: 0 15px 35px rgba(0, 0, 0, 0.15), 0 5px 15px rgba(0, 0, 0, 0.05);
  padding: 24px;
  display: flex;
  flex-direction: column;
}

/* 外部四角装饰 */
.corner {
  position: absolute;
  color: #D0D0D0;
}
.top-left { top: 12px; left: 12px; }
.top-right { top: 12px; right: 12px; }
.bottom-left { bottom: 12px; left: 12px; }
.bottom-right { bottom: 12px; right: 12px; }

/* 内部可滚动区域 */
.scrollable-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  /* 隐藏滚动条但保留滚动功能 */
  scrollbar-width: none; 
  -ms-overflow-style: none;
}
.scrollable-content::-webkit-scrollbar {
  display: none;
}

/* --- 新的顶部角色信息区 --- */
.profile-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 24px;
  padding-bottom: 20px;
  border-bottom: 1px solid #F0F0F0;
}

.avatar-wrapper {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  overflow: hidden;
  background: #F5F5F5;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid #FFFFFF;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
}

.avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-text-fallback {
  font-size: 24px;
  color: #999;
  font-family: "STKaiti", "KaiTi", "Songti SC", serif;
}

.profile-info {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 6px;
}

.char-name {
  font-size: 16px;
  font-weight: 600;
  color: #333;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}

.char-signature {
  font-size: 13px;
  color: #888;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  letter-spacing: 0.5px;
}

/* 中间心声文字区域 */
.thought-content-area {
  display: flex;
  flex-direction: column;
  margin-bottom: 24px;
}

.text-content {
  font-family: "STKaiti", "KaiTi", "Songti SC", "Georgia", serif;
  font-size: 15px;
  line-height: 1.8;
  color: #404040;
  text-align: justify;
  letter-spacing: 1px;
  white-space: pre-wrap;
}

.empty-thought-state {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  color: #A0A0A0;
}

.empty-text {
  font-family: "STKaiti", "KaiTi", "Songti SC", "Georgia", serif;
  font-size: 16px;
  letter-spacing: 1px;
}

/* 底部预留图片区域 (靠左对齐) */
.bottom-image-placeholder {
  display: flex;
  justify-content: flex-start;
  align-items: flex-end;
  margin-bottom: 10px; /* 为滚动到底部留点边距 */
}

.placeholder-box {
  width: 140px;
  height: 140px;
  background-color: #F9F9F9;
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px dashed #E0E0E0;
  cursor: pointer;
  transition: all 0.2s ease;
}

.placeholder-box:active {
  background-color: #F0F0F0;
  transform: scale(0.98);
}

/* 外部悬浮底部控制区 */
.floating-controls-bottom {
  position: absolute;
  bottom: 24px;
  left: 0;
  width: 100%;
  display: flex;
  justify-content: center;
  z-index: 1001;
}

.glass-bar {
  display: flex;
  align-items: center;
  background: rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 30px;
  padding: 6px 12px;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.15);
}

.nav-controls {
  display: flex;
  align-items: center;
  gap: 12px;
}

.nav-btn {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: none;
  box-shadow: none;
  background: transparent;
}
.nav-btn.disabled {
  opacity: 0.3;
  cursor: not-allowed;
}
.nav-btn.disabled:active {
  transform: none;
  background: transparent;
}

.nav-page-number {
  color: #FFFFFF;
  font-family: "Georgia", serif;
  font-size: 15px;
  letter-spacing: 1px;
  min-width: 48px;
  text-align: center;
  user-select: none;
}
</style>
