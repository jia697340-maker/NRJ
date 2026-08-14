/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import LongTextEditModal from '../../LongTextEditModal.vue'

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

const sourceText = computed(() => {
  if (!props.message || !props.message.imageData) return ''
  return props.message.imageData.sourceText || props.message.imageData.text || ''
})

const isBookOpen = ref(false)
const showDeleteConfirm = ref(false)
const showFullscreen = ref(false)
const showLongTextModal = ref(false)

const toggleBook = (open?: boolean) => {
  if (typeof open === 'boolean') {
    isBookOpen.value = open
  } else {
    isBookOpen.value = !isBookOpen.value
  }
  if (!isBookOpen.value) {
    showDeleteConfirm.value = false
  }
}

watch(() => props.visible, (newVal) => {
  if (newVal) {
    if (history.value.length > 0) {
      currentIndex.value = history.value.length - 1
    }
    showDeleteConfirm.value = false
    isBookOpen.value = false // 重置为合上状态
  }
})

watch(currentIndex, () => {
  showDeleteConfirm.value = false
  isBookOpen.value = false // 翻页时自动合上
})

// 监听 currentItem 的变化，确保数据异步加载时提示词也能正确填充
watch(() => currentItem.value, (newVal) => {
  if (newVal) {
    promptInput.value = newVal.prompt || ''
  } else {
    promptInput.value = ''
  }
}, { immediate: true, deep: true })

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

const handleDelete = () => {
  showDeleteConfirm.value = true
}

const confirmDelete = () => {
  emit('delete', currentIndex.value)
  if (currentIndex.value >= history.value.length - 1) {
    currentIndex.value = Math.max(0, history.value.length - 2)
  }
  showDeleteConfirm.value = false
  isBookOpen.value = false // 删除后合上
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
  isBookOpen.value = false
}

const handleSaveLongText = (newText: string) => {
  promptInput.value = newText
}
</script>

<template>
  <transition name="gallery-fade">
    <div v-if="visible" class="gallery-overlay" @click.self="closeModal">
      
      <!-- 右上角全局关闭按钮 -->
      <button class="global-close-btn" @click="closeModal" title="关闭">
        <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>

      <!-- 左右导航按钮 (固定显示) -->
      <button class="nav-btn prev-btn" @click="prevImage" :disabled="currentIndex === 0">
        <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="15 18 9 12 15 6"></polyline>
        </svg>
      </button>

      <button class="nav-btn next-btn" @click="nextImage" :disabled="currentIndex >= history.length - 1">
        <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="9 18 15 12 9 6"></polyline>
        </svg>
      </button>

      <!-- 整本书 180 度翻转结构 -->
      <div class="scene">
        <div class="flip-book" :class="{ 'is-flipped': isBookOpen }">
          
          <!-- 正面：封面图 -->
          <div class="flip-front" @click="toggleBook(true)">
            <img v-if="currentItem && currentItem.url" :src="currentItem.url" alt="Cover Image" />
            <div v-else class="cover-empty">图片已失效</div>
            
            <!-- 放大预览按钮 -->
            <button v-if="!isBookOpen && currentItem && currentItem.url" class="zoom-btn" @click.stop="showFullscreen = true" title="全屏查看">
              <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="15 3 21 3 21 9"></polyline>
                <polyline points="9 21 3 21 3 15"></polyline>
                <line x1="21" y1="3" x2="14" y2="10"></line>
                <line x1="3" y1="21" x2="10" y2="14"></line>
              </svg>
            </button>

            <!-- 封面左侧微小装饰线 -->
            <div class="spine-line"></div>
          </div>

          <!-- 背面：控制塔 -->
          <div class="flip-back">
            <div class="inner-header">
              <h3 class="inner-title">创作控制塔</h3>
              <span class="inner-id" v-if="currentItem && currentItem.imageId">ID: {{ currentItem.imageId.substring(0,8) }}</span>
            </div>

            <div class="action-list">
              <!-- 重构区域 -->
              <div class="remix-area">
                <div class="prompt-section" v-if="sourceText">
                  <div class="prompt-label">原始中文对照</div>
                  <div class="source-text">{{ sourceText }}</div>
                </div>

                <div class="prompt-section flex-1">
                  <div class="prompt-header">
                    <div class="prompt-label">英文生成参数 (可编辑)</div>
                    <button class="expand-btn" @click="showLongTextModal = true" title="放大编辑">
                      <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="15 3 21 3 21 9"></polyline>
                        <polyline points="9 21 3 21 3 15"></polyline>
                        <line x1="21" y1="3" x2="14" y2="10"></line>
                        <line x1="3" y1="21" x2="10" y2="14"></line>
                      </svg>
                    </button>
                  </div>
                  <textarea v-model="promptInput" class="remix-textarea" placeholder="输入灵感提示词..."></textarea>
                </div>
                
                <button class="btn btn-primary" @click="handleRegenerate" :disabled="!promptInput.trim()">
                  <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"></polygon>
                  </svg>
                  基于此参数重构
                </button>
              </div>
            </div>
          </div>

        </div>
      </div>

      <!-- 底部悬浮控制栏（移出书本外） -->
      <transition name="fade-up">
        <div class="external-action-bar" v-if="isBookOpen">
          <button class="ext-btn btn-close" @click="toggleBook(false)">
            合上控制塔
          </button>
          
          <div class="ext-actions-right">
            <!-- 下载按钮 -->
            <button class="ext-btn btn-download" @click="downloadImage" title="保存到本地">
              <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
            </button>

            <!-- 删除按钮包裹区（含二次确认气泡） -->
            <div class="delete-wrapper">
              <button v-if="!showDeleteConfirm" class="ext-btn btn-danger" @click="handleDelete" title="丢弃此图">
                <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
              </button>
              <!-- 确认删除气泡 -->
              <div v-else class="delete-confirm-popover">
                <span>确定丢弃？</span>
                <div class="pop-btns">
                  <button class="pop-btn yes" @click="confirmDelete">确定</button>
                  <button class="pop-btn no" @click="cancelDelete">取消</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </transition>

      <!-- 底部提示文字 -->
      <div class="hint-text" :class="{ 'is-hidden': isBookOpen }">
        <svg class="hint-icon" viewBox="0 0 24 24" fill="currentColor">
            <path d="M9 11.24V7.5a2.5 2.5 0 0 1 5 0v3.74c1.21-.81 2-2.18 2-3.74C16 5.01 14.2 3 11.5 3S7 5.01 7 7.5c0 1.56.79 2.93 2 3.74zm9.84 4.63l-4.54-2.26c-.17-.07-.35-.11-.54-.11H13v-6c0-.83-.67-1.5-1.5-1.5S10 6.67 10 7.5v10.74l-3.43-.72c-.08-.01-.15-.03-.24-.03-.31 0-.59.13-.79.33l-.79.8 4.94 4.94c.27.27.65.44 1.06.44h6.79c.75 0 1.33-.55 1.44-1.28l.75-5.27c.01-.07.02-.14.02-.21 0-.69-.47-1.26-1.12-1.37z"/>
        </svg>
        <span>点击封面，翻开控制塔</span>
      </div>

      <!-- 顶部分页指示器（悬浮固定显示） -->
      <div class="page-indicator">
        {{ currentIndex + 1 }} / {{ Math.max(1, history.length) }}
      </div>
      
    </div>
  </transition>

  <!-- 全屏大图遮罩 -->
  <transition name="gallery-fade">
    <div v-if="showFullscreen && currentItem && currentItem.url" class="fullscreen-overlay" @click="showFullscreen = false">
      <img :src="currentItem.url" class="fullscreen-img" />
    </div>
  </transition>

  <!-- 长文本编辑弹窗 -->
  <LongTextEditModal
    v-model:visible="showLongTextModal"
    title="编辑提示词"
    :current-text="promptInput"
    :default-text="currentItem ? (currentItem.prompt || '') : ''"
    placeholder="输入灵感提示词..."
    @saved="handleSaveLongText"
  />
</template>

<style scoped>
/* 全屏遮罩保留原有样式 */
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

/* 3D 书本画册新样式 */
.gallery-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
}

.scene {
  perspective: 2000px;
  position: relative;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 整本书容器 */
.flip-book {
  width: 450px;
  height: 650px;
  position: relative;
  transform-style: preserve-3d;
  transition: transform 0.8s cubic-bezier(0.645, 0.045, 0.355, 1);
  box-shadow: 20px 20px 40px rgba(0,0,0,0.15), 0 0 20px rgba(0,0,0,0.05);
  border-radius: 4px 12px 12px 4px;
}

.flip-book.is-flipped {
  transform: rotateY(-180deg);
  border-radius: 12px 4px 4px 12px;
}

.flip-front, .flip-back {
  position: absolute;
  width: 100%;
  height: 100%;
  backface-visibility: hidden;
  border-radius: inherit;
  overflow: hidden;
}

/* 正面（封面） */
.flip-front {
  background: #fff;
  cursor: pointer;
  z-index: 2;
}

.flip-front img {
  width: 100%; height: 100%;
  object-fit: cover;
  display: block;
}

.spine-line {
  position: absolute;
  left: 0; top: 0; bottom: 0; width: 15px;
  background: linear-gradient(to right, rgba(255,255,255,0.4), rgba(0,0,0,0.1) 40%, rgba(255,255,255,0.2) 60%, transparent);
  pointer-events: none;
}

.cover-empty {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #a0aab5;
  font-size: 14px;
}

/* 放大按钮 */
.zoom-btn {
  position: absolute;
  top: 15px;
  right: 15px;
  background: rgba(255,255,255,0.7);
  backdrop-filter: blur(4px);
  border: none;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: #333;
  opacity: 0;
  transition: opacity 0.2s, background 0.2s;
}
.flip-front:hover .zoom-btn {
  opacity: 1;
}
.zoom-btn:hover {
  background: #fff;
  box-shadow: 0 2px 8px rgba(0,0,0,0.15);
}

/* 背面（控制塔） */
.flip-back {
  background: #fdfbf7;
  transform: rotateY(180deg);
  padding: 25px 25px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  background-image: url("data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100' height='100' filter='url(%23noise)' opacity='0.03'/%3E%3C/svg%3E");
  z-index: 1;
}

.inner-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
  border-bottom: 1px solid rgba(0,0,0,0.06);
  padding-bottom: 15px;
}

.inner-title {
  font-size: 18px;
  color: #333;
  letter-spacing: 1px;
  margin: 0;
  font-weight: 600;
}

.inner-id {
  font-size: 12px;
  color: #64748b;
  font-family: monospace;
  background: rgba(0,0,0,0.04);
  padding: 4px 8px;
  border-radius: 6px;
}

.action-list {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.remix-area {
  display: flex;
  flex-direction: column;
  gap: 15px;
  height: 100%;
}

.prompt-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.prompt-section.flex-1 {
  flex: 1;
}

.prompt-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.prompt-label {
  font-size: 13px;
  color: #64748b;
  font-weight: 600;
}

.expand-btn {
  background: none;
  border: none;
  color: #94a3b8;
  cursor: pointer;
  padding: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: all 0.2s;
}
.expand-btn:hover {
  background: rgba(0,0,0,0.05);
  color: #3b82f6;
}

.source-text {
  font-size: 13px;
  color: #475569;
  background: rgba(255, 255, 255, 0.5);
  border: 1px solid rgba(0,0,0,0.05);
  padding: 10px 12px;
  border-radius: 8px;
  line-height: 1.5;
  max-height: 80px;
  overflow-y: auto;
  word-break: break-all;
}

.remix-textarea {
  flex: 1;
  width: 100%;
  background: rgba(255,255,255,0.7);
  border: 1px solid rgba(0,0,0,0.1);
  border-radius: 8px;
  padding: 12px;
  color: #333;
  font-size: 14px;
  line-height: 1.5;
  resize: none;
  box-sizing: border-box;
  transition: all 0.2s;
}
.remix-textarea:focus {
  outline: none;
  background: #fff;
  border-color: #3b82f6;
  box-shadow: 0 0 0 2px rgba(59,130,246,0.1);
}

.btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 8px;
  background: transparent;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
  color: #444;
}
.btn-primary {
  background: #3b82f6;
  color: white;
  border-color: #3b82f6;
  border: none;
  font-weight: 600;
}
.btn-primary:hover:not(:disabled) {
  background: #2563eb;
  color: white;
}
.btn-primary:disabled {
  background: #94a3b8;
  cursor: not-allowed;
  opacity: 0.8;
}

/* 外部悬浮控制栏（核心更改点） */
.external-action-bar {
  position: absolute;
  bottom: 40px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 450px;
  padding: 12px 20px;
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(10px);
  border-radius: 100px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.5);
  box-sizing: border-box;
  z-index: 100;
}

.ext-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  cursor: pointer;
  border-radius: 50px;
  transition: all 0.2s;
}

.btn-close {
  padding: 8px 16px;
  font-size: 14px;
  color: #475569;
  font-weight: 600;
  border: 1px solid #e2e8f0;
  background: #f8fafc;
}
.btn-close:hover {
  background: #f1f5f9;
  color: #0f172a;
}

.ext-actions-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.btn-download, .btn-danger {
  width: 40px;
  height: 40px;
  color: #475569;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 50%;
}
.btn-download:hover {
  background: #f1f5f9;
  color: #3b82f6;
  border-color: #3b82f6;
}
.btn-danger {
  color: #ef4444;
  background: #fef2f2;
  border-color: #fecaca;
}
.btn-danger:hover {
  background: #fee2e2;
  color: #dc2626;
  border-color: #ef4444;
}

/* 确认删除气泡 */
.delete-wrapper {
  position: relative;
}
.delete-confirm-popover {
  position: absolute;
  bottom: 50px;
  right: 0;
  background: #fff;
  border-radius: 12px;
  padding: 12px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.15);
  border: 1px solid #fee2e2;
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 140px;
  align-items: center;
  z-index: 101;
}
.delete-confirm-popover::after {
  content: '';
  position: absolute;
  bottom: -6px;
  right: 14px;
  width: 10px;
  height: 10px;
  background: #fff;
  border-right: 1px solid #fee2e2;
  border-bottom: 1px solid #fee2e2;
  transform: rotate(45deg);
}
.delete-confirm-popover span {
  font-size: 13px;
  color: #ef4444;
  font-weight: 600;
}
.pop-btns {
  display: flex;
  gap: 8px;
  width: 100%;
}
.pop-btn {
  flex: 1;
  padding: 6px;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
  border: none;
}
.pop-btn.yes {
  background: #ef4444;
  color: white;
}
.pop-btn.no {
  background: #f1f5f9;
  color: #475569;
}

/* 提示文字 & 分页指示器 */
.hint-text {
  position: absolute;
  bottom: 40px;
  left: 50%;
  transform: translateX(-50%);
  color: #64748b;
  font-size: 14px;
  letter-spacing: 2px;
  display: flex;
  align-items: center;
  gap: 8px;
  animation: pulse 2s infinite;
  transition: opacity 0.3s;
  pointer-events: none;
}
.hint-text.is-hidden {
  opacity: 0;
  animation: none;
}
@keyframes pulse {
  0% { opacity: 0.5; }
  50% { opacity: 1; transform: translate(-50%, -3px); }
  100% { opacity: 0.5; }
}

.hint-icon {
  width: 18px; height: 18px; fill: currentColor;
}

.page-indicator {
  position: absolute;
  top: 40px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0,0,0,0.5);
  color: white;
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 13px;
  letter-spacing: 1px;
  backdrop-filter: blur(4px);
  z-index: 100;
  transition: opacity 0.3s;
}

/* 全局关闭按钮 */
.global-close-btn {
  position: absolute;
  top: 20px;
  right: 20px;
  background: rgba(0,0,0,0.2);
  color: #334155;
  border: 1px solid rgba(0,0,0,0.05);
  width: 44px;
  height: 44px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 1001;
  backdrop-filter: blur(8px);
  transition: all 0.2s;
}
.global-close-btn:hover {
  background: #fff;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  transform: scale(1.05);
}

/* Nav Buttons */
.nav-btn {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  background: rgba(255,255,255,0.7);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(0,0,0,0.1);
  color: #334155;
  width: 50px;
  height: 50px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 1000;
  transition: all 0.2s;
}
.nav-btn:hover:not(:disabled) {
  background: #fff;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  transform: translateY(-50%) scale(1.05);
}
.nav-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}
.prev-btn { left: 40px; }
.next-btn { right: 40px; }

.gallery-fade-enter-active,
.gallery-fade-leave-active {
  transition: opacity 0.3s ease, backdrop-filter 0.3s ease;
}
.gallery-fade-enter-from,
.gallery-fade-leave-to {
  opacity: 0;
  backdrop-filter: blur(0px);
}

.fade-up-enter-active,
.fade-up-leave-active {
  transition: opacity 0.3s, transform 0.3s;
}
.fade-up-enter-from,
.fade-up-leave-to {
  opacity: 0;
  transform: translateY(20px);
}

@media (max-width: 900px) {
  .flip-book {
    width: 340px;
    height: 510px;
  }
  .external-action-bar {
    width: 340px;
  }
}

@media (max-width: 600px) {
  .flip-book {
    width: 280px;
    height: 420px;
  }
  .external-action-bar {
    width: 280px;
  }
  .prev-btn { left: 10px; width: 40px; height: 40px; }
  .next-btn { right: 10px; width: 40px; height: 40px; }
  .nav-btn svg { width: 24px; height: 24px; }
  .global-close-btn { top: 10px; right: 10px; width: 36px; height: 36px; }
  .global-close-btn svg { width: 20px; height: 20px; }
}

@media (max-width: 400px) {
  .flip-book {
    width: 260px;
    height: 390px;
  }
  .external-action-bar {
    width: 260px;
  }
}
</style>
