/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { ref, computed, watch } from 'vue'

const props = defineProps<{
  visible: boolean
  message: any
}>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'regenerate', prompt: string): void
  (e: 'delete', index: number): void
}>()

const currentIndex = ref(0)
const promptInput = ref('')

const history = computed(() => {
  if (!props.message || !props.message.imageData) return []
  const hist = props.message.imageData.history || []
  if (hist.length > 0) {
    return hist
  }
  if (props.message.imageData.imageId) {
    return [{
      imageId: props.message.imageData.imageId,
      prompt: props.message.imageData.prompt || '',
      url: props.message._localImageUrl || ''
    }]
  }
  return []
})

const currentItem = computed(() => {
  if (history.value.length === 0) return null
  return history.value[currentIndex.value]
})

watch(() => props.visible, (newVal) => {
  if (newVal && history.value.length > 0) {
    currentIndex.value = history.value.length - 1
    promptInput.value = currentItem.value?.prompt || ''
    showDeleteConfirm.value = false
  }
})

watch(currentIndex, () => {
  promptInput.value = currentItem.value?.prompt || ''
  showDeleteConfirm.value = false
})

const nextImage = () => {
  if (currentIndex.value < history.value.length - 1) {
    currentIndex.value++
  }
}

const prevImage = () => {
  if (currentIndex.value > 0) {
    currentIndex.value--
  }
}

const handleRegenerate = () => {
  if (!promptInput.value.trim()) return
  emit('regenerate', promptInput.value.trim())
}

const showDeleteConfirm = ref(false)

const handleDelete = () => {
  showDeleteConfirm.value = true
}

const confirmDelete = () => {
  emit('delete', currentIndex.value)
  if (currentIndex.value >= history.value.length - 1) {
    currentIndex.value = Math.max(0, history.value.length - 2)
  }
  showDeleteConfirm.value = false
}

const cancelDelete = () => {
  showDeleteConfirm.value = false
}

const downloadImage = () => {
  if (!currentItem.value || !currentItem.value.url) return
  const link = document.createElement('a')
  link.href = currentItem.value.url
  link.download = `image_${Date.now()}.png`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

const closeModal = () => {
  emit('update:visible', false)
}

const showFullscreen = ref(false)
</script>

<template>
  <transition name="gallery-fade">
    <div v-if="visible" class="gallery-board-overlay" @click.self="closeModal">
      <div class="gallery-board-container">
        
        <!-- 左侧画板区 -->
        <div class="board-left-panel" @click.self="closeModal">
          
          <div class="image-showcase">
            <img v-if="currentItem && currentItem.url" :src="currentItem.url" class="showcase-img" @click="showFullscreen = true" style="cursor: zoom-in;" title="点击放大" />
            <div v-else class="showcase-empty">
              <svg viewBox="0 0 24 24" width="48" height="48" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                <circle cx="8.5" cy="8.5" r="1.5"></circle>
                <polyline points="21 15 16 10 5 21"></polyline>
              </svg>
              <span>图片已失效或不存在</span>
            </div>
          </div>

          <!-- 悬浮控制台 -->
          <div class="floating-controls" v-if="history.length > 0">
            <button class="control-btn" @click="prevImage" :disabled="currentIndex === 0">
              <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="15 18 9 12 15 6"></polyline>
              </svg>
            </button>
            <span class="control-indicator">{{ currentIndex + 1 }} / {{ history.length }}</span>
            <button class="control-btn" @click="nextImage" :disabled="currentIndex === history.length - 1">
              <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
            </button>
          </div>
        </div>

        <!-- 右侧控制塔 -->
        <div class="board-right-panel">
          <div class="panel-header">
            <h3 class="panel-title">创作控制塔</h3>
            <button class="panel-close-btn" @click="closeModal" title="关闭">
              <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>

          <div class="panel-content">
            <div class="info-card">
              <span class="info-tag">
                <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px; vertical-align: middle;">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                </svg>
                AI 生成
              </span>
              <span class="info-tag" v-if="currentItem && currentItem.imageId">
                ID: {{ currentItem.imageId.substring(0,8) }}
              </span>
            </div>

            <div class="action-cards" v-if="currentItem">
              <button class="action-card" @click="downloadImage">
                <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="7 10 12 15 17 10"></polyline>
                  <line x1="12" y1="15" x2="12" y2="3"></line>
                </svg>
                <span>保存到本地</span>
              </button>
              
              <div class="action-card danger-action" v-if="!showDeleteConfirm" @click="handleDelete">
                <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
                <span>丢弃此图</span>
              </div>

              <!-- 内联确认删除 -->
              <div class="action-confirm-card" v-if="showDeleteConfirm">
                <span class="confirm-text">确定丢弃？</span>
                <div class="confirm-actions">
                  <button class="confirm-btn yes" @click="confirmDelete">确定</button>
                  <button class="confirm-btn no" @click="cancelDelete">取消</button>
                </div>
              </div>
            </div>

            <div class="remix-area">
              <div class="remix-header">
                <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                </svg>
                <span>灵感重构 (Remix)</span>
              </div>
              <textarea v-model="promptInput" class="remix-textarea" rows="6" placeholder="输入灵感提示词..."></textarea>
              <button class="remix-submit-btn" @click="handleRegenerate" :disabled="!promptInput.trim()">
                <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"></polygon>
                </svg>
                基于此参数二次生成
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  </transition>

  <!-- 全屏大图遮罩 -->
  <transition name="gallery-fade">
    <div v-if="showFullscreen && currentItem && currentItem.url" class="fullscreen-overlay" @click="showFullscreen = false">
      <img :src="currentItem.url" class="fullscreen-img" />
    </div>
  </transition>
</template>

<style scoped>
.fullscreen-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.9);
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: zoom-out;
}

.fullscreen-img {
  max-width: 95vw;
  max-height: 95vh;
  object-fit: contain;
  user-select: none;
}

/* Reset all styles from previous dark mode */
.gallery-board-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(255, 255, 255, 0.75);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px;
  box-sizing: border-box;
}

.gallery-board-container {
  width: 100%;
  max-width: 1200px;
  height: 100%;
  max-height: 800px;
  background: #ffffff;
  border-radius: 24px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.08), 0 0 0 1px rgba(0,0,0,0.02);
  display: flex;
  overflow: hidden;
  position: relative;
}

/* 左侧画板区 */
.board-left-panel {
  flex: 1;
  background: #f8f9fa;
  background-image: 
    linear-gradient(to right, rgba(0,0,0,0.03) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(0,0,0,0.03) 1px, transparent 1px);
  background-size: 20px 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  position: relative;
}

.image-showcase {
  width: calc(100% - 80px);
  height: calc(100% - 120px);
  display: flex;
  align-items: center;
  justify-content: center;
}

.showcase-img {
  max-width: 100%;
  max-height: 100%;
  border-radius: 12px;
  box-shadow: 0 10px 30px rgba(0,0,0,0.1);
  border: 8px solid #ffffff;
  object-fit: contain;
  transition: transform 0.3s ease;
}

.showcase-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  color: #a0aab5;
}

.floating-controls {
  position: absolute;
  bottom: 30px;
  display: flex;
  align-items: center;
  gap: 16px;
  background: rgba(255, 255, 255, 0.9);
  padding: 8px 24px;
  border-radius: 40px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.06);
  backdrop-filter: blur(8px);
}

.control-btn {
  background: transparent;
  border: none;
  color: #4a5568;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px;
  border-radius: 50%;
  transition: color 0.2s, background 0.2s;
}

.control-btn:disabled {
  color: #cbd5e1;
  cursor: not-allowed;
}

.control-btn:not(:disabled):hover {
  color: var(--theme-color, #3b82f6);
  background: rgba(0,0,0,0.04);
}

.control-indicator {
  font-size: 14px;
  font-weight: 600;
  color: #4a5568;
  letter-spacing: 1px;
}

/* 右侧控制塔 */
.board-right-panel {
  width: 360px;
  background: #ffffff;
  border-left: 1px solid #edf2f7;
  display: flex;
  flex-direction: column;
}

.panel-header {
  padding: 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid #edf2f7;
}

.panel-title {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: #1a202c;
}

.panel-close-btn {
  background: #f1f5f9;
  border: none;
  color: #64748b;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.2s, color 0.2s;
}

.panel-close-btn:hover {
  background: #e2e8f0;
  color: #0f172a;
}

.panel-content {
  flex: 1;
  padding: 24px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 24px;
  min-height: 0;
}

/* 优雅的自定义滚动条 */
.panel-content::-webkit-scrollbar {
  width: 6px;
}
.panel-content::-webkit-scrollbar-track {
  background: transparent;
}
.panel-content::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.1);
  border-radius: 10px;
}
.panel-content::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 0, 0, 0.2);
}

.info-card {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.info-tag {
  background: #f1f5f9;
  color: #475569;
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 500;
}

.action-cards {
  display: flex;
  gap: 12px;
}

.action-card {
  flex: 1;
  background: #f8fafc;
  border: 1px solid #f1f5f9;
  border-radius: 12px;
  padding: 16px 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  cursor: pointer;
  color: #475569;
  transition: all 0.2s;
}

.action-card:hover {
  background: #ffffff;
  border-color: #cbd5e1;
  box-shadow: 0 4px 12px rgba(0,0,0,0.03);
  transform: translateY(-2px);
}

.action-card.danger-action:hover {
  color: #ef4444;
  border-color: #fca5a5;
  background: #fef2f2;
}

.action-card span {
  font-size: 13px;
  font-weight: 500;
}

.action-confirm-card {
  flex: 1;
  background: #fef2f2;
  border: 1px solid #fca5a5;
  border-radius: 12px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.confirm-text {
  font-size: 13px;
  font-weight: 600;
  color: #ef4444;
}

.confirm-actions {
  display: flex;
  gap: 8px;
  width: 100%;
}

.confirm-btn {
  flex: 1;
  border: none;
  padding: 6px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
}

.confirm-btn.yes {
  background: #ef4444;
  color: white;
}

.confirm-btn.no {
  background: white;
  color: #64748b;
  border: 1px solid #cbd5e1;
}

.remix-area {
  background: #f8fafc;
  border-radius: 16px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.remix-header {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #334155;
  font-weight: 600;
  font-size: 15px;
}

.remix-textarea {
  width: 100%;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 16px;
  color: #1e293b;
  font-size: 14px;
  line-height: 1.6;
  resize: vertical;
  box-sizing: border-box;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.remix-textarea:focus {
  outline: none;
  border-color: var(--theme-color, #3b82f6);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.remix-textarea::placeholder {
  color: #94a3b8;
}

.remix-submit-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  background: linear-gradient(135deg, var(--theme-color, #3b82f6), #6366f1);
  color: white;
  border: none;
  padding: 14px;
  border-radius: 12px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
}

.remix-submit-btn:hover:not(:disabled) {
  box-shadow: 0 6px 16px rgba(59, 130, 246, 0.4);
  transform: translateY(-1px);
}

.remix-submit-btn:active:not(:disabled) {
  transform: translateY(1px);
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
}

.remix-submit-btn:disabled {
  background: #cbd5e1;
  box-shadow: none;
  cursor: not-allowed;
  opacity: 0.7;
}

/* 过渡动画 */
.gallery-fade-enter-active,
.gallery-fade-leave-active {
  transition: opacity 0.3s ease, backdrop-filter 0.3s ease;
}
.gallery-fade-enter-active .gallery-board-container,
.gallery-fade-leave-active .gallery-board-container {
  transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease;
}

.gallery-fade-enter-from,
.gallery-fade-leave-to {
  opacity: 0;
  backdrop-filter: blur(0px);
}
.gallery-fade-enter-from .gallery-board-container,
.gallery-fade-leave-to .gallery-board-container {
  transform: translateY(20px) scale(0.98);
  opacity: 0;
}

@media (max-width: 800px) {
  .gallery-board-overlay {
    padding: 16px;
  }
  .gallery-board-container {
    flex-direction: column;
  }
  .board-left-panel {
    flex: 1;
    min-height: 45%;
    max-height: 55%;
  }
  .board-right-panel {
    width: 100%;
    border-left: none;
    border-top: 1px solid #edf2f7;
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }
  .panel-content {
    padding: 16px;
  }
}
</style>
