/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<template>
  <div class="modal-overlay" v-if="visible" @click.self="close">
    <div class="modal-content">
      <button class="close-btn" @click="close" aria-label="关闭">
        <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
      
      <h2 class="modal-title">{{ title || '更换头像' }}</h2>
      
      <div class="avatar-preview">
        <img v-if="previewUrl" :src="previewUrl" class="avatar-img" :class="shapeClass" />
        <div v-else class="avatar-placeholder" :class="shapeClass">预览</div>
      </div>
      <div v-if="optimizeHint" class="optimize-hint">{{ optimizeHint }}</div>
      
      <div class="upload-options">
        <div class="option-group">
          <label class="custom-file-upload">
            <input type="file" accept="image/*" @change="handleFileChange" class="hidden-file-input" />
            <span class="upload-btn-text">📁 点击选择本地图片</span>
          </label>
        </div>
        
        <div class="option-divider">或</div>
        
        <div class="option-group url-group">
          <label>🔗 网络URL：</label>
          <div class="url-input-wrap">
            <input type="text" v-model="inputUrl" placeholder="输入图片链接..." />
            <button @click="applyUrl" class="btn btn-small">应用</button>
          </div>
        </div>
      </div>
      
      <div class="modal-actions">
        <button @click="resetAvatar" class="btn btn-secondary">重置头像</button>
        <button @click="saveAvatar" class="btn btn-primary" :class="{ 'is-disabled': isOptimizing }">{{ isOptimizing ? '优化中…' : '保存' }}</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'

const props = withDefaults(defineProps<{
  visible: boolean
  currentAvatar?: string | null
  shape?: 'avatar' | 'bg-left' | 'bg-right' | 'circle' | 'portrait' | 'wallpaper' | 'square'
  title?: string
}>(), {
  shape: 'circle',
  currentAvatar: null
})

const shapeClass = computed(() => {
  return `shape-${props.shape}`
})

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'saved', url: string | null): void
}>()

const previewUrl = ref<string | null>(null)
const inputUrl = ref('')
const isOptimizing = ref(false)
const optimizeHint = ref('')

watch(() => props.visible, (newVal) => {
  if (newVal) {
    previewUrl.value = props.currentAvatar
    inputUrl.value = ''
  }
})

const close = () => {
  emit('update:visible', false)
}

const dataUrlSize = (value: string) => {
  const comma = value.indexOf(',')
  if (comma < 0) return new Blob([value]).size
  const body = value.slice(comma + 1)
  const padding = body.endsWith('==') ? 2 : body.endsWith('=') ? 1 : 0
  return Math.max(0, Math.floor(body.length * 3 / 4) - padding)
}

const formatCompactBytes = (bytes: number) => bytes >= 1024 * 1024
  ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
  : `${Math.max(1, Math.round(bytes / 1024))} KB`

const optimizeImage = (source: string, file: File): Promise<string> => new Promise((resolve) => {
  if (file.type === 'image/gif' || file.type === 'image/svg+xml') return resolve(source)
  const image = new Image()
  image.onload = () => {
    const isLargeSurface = ['wallpaper', 'bg-left', 'bg-right'].includes(props.shape)
    const maxSide = isLargeSurface ? 1920 : props.shape === 'square' ? 1024 : 512
    const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
    const context = canvas.getContext('2d')
    if (!context) return resolve(source)
    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = 'high'
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    const optimized = canvas.toDataURL('image/webp', isLargeSurface ? 0.86 : 0.84)
    resolve(dataUrlSize(optimized) < dataUrlSize(source) ? optimized : source)
  }
  image.onerror = () => resolve(source)
  image.src = source
})

const handleFileChange = (e: Event) => {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (file) {
    const reader = new FileReader()
    reader.onload = async (event) => {
      const original = event.target?.result as string
      isOptimizing.value = true
      optimizeHint.value = '正在优化图片…'
      const optimized = await optimizeImage(original, file)
      previewUrl.value = optimized
      const before = dataUrlSize(original)
      const after = dataUrlSize(optimized)
      optimizeHint.value = after < before
        ? `已由 ${formatCompactBytes(before)} 优化至 ${formatCompactBytes(after)}`
        : `图片大小 ${formatCompactBytes(after)}`
      isOptimizing.value = false
    }
    reader.readAsDataURL(file)
  }
}

const applyUrl = () => {
  if (inputUrl.value.trim()) {
    previewUrl.value = inputUrl.value.trim()
  }
}

const resetAvatar = () => {
  previewUrl.value = null
  inputUrl.value = ''
  optimizeHint.value = ''
}

const saveAvatar = () => {
  if (isOptimizing.value) return
  emit('saved', previewUrl.value)
  close()
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(4px);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
  animation: fadeIn 0.2s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.modal-content {
  background: var(--sys-bg-secondary);
  border-radius: 24px;
  padding: 24px;
  width: 85%;
  max-width: 320px;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: 0 10px 30px rgba(0,0,0,0.1);
  display: flex;
  flex-direction: column;
  gap: 20px;
  animation: slideUp 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  position: relative;
}

/* 隐藏滚动条但保留滚动功能 */
.modal-content::-webkit-scrollbar {
  display: none;
}
.modal-content {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

.close-btn {
  position: absolute;
  top: 16px;
  right: 16px;
  background: none;
  border: none;
  color: var(--text-tertiary);
  cursor: pointer;
  padding: 4px;
  display: flex;
  justify-content: center;
  align-items: center;
  border-radius: 50%;
  transition: all 0.2s;
}

.close-btn:hover {
  background: var(--sys-bg-primary);
  color: var(--text-secondary);
}

@keyframes slideUp {
  from { transform: translateY(20px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

.modal-title {
  margin: 0;
  font-size: 18px;
  text-align: center;
  color: var(--text-primary);
  font-weight: 600;
}

.avatar-preview {
  display: flex;
  justify-content: center;
  margin: 10px 0;
  max-height: 200px;
}

.optimize-hint {
  margin-top: -12px;
  color: var(--text-tertiary);
  font-size: 12px;
  line-height: 1.5;
  text-align: center;
}

.btn.is-disabled {
  cursor: default;
  opacity: 0.55;
  pointer-events: none;
}

.avatar-img, .avatar-placeholder {
  object-fit: cover;
  box-shadow: 0 4px 10px rgba(0,0,0,0.08);
  transition: all 0.3s ease;
  max-width: 100%;
}

/* 为了防止特殊图片过长导致失真，允许使用 contain，并在需要的地方保留原比例 */
.avatar-img.shape-square {
  object-fit: contain;
  background: rgba(0,0,0,0.05);
}

.shape-square {
  width: 160px;
  height: 160px;
  border-radius: 12px;
}

.shape-circle {
  width: 90px;
  height: 90px;
  border-radius: 50%;
}

.shape-avatar {
  width: 80px;
  height: 80px;
  border-radius: 20px;
}

.shape-bg-left {
  width: 140px;
  height: 80px;
  border-radius: 16px 0 0 0;
}

.shape-bg-right {
  width: 140px;
  height: 80px;
  border-radius: 0 16px 0 0;
}

.shape-portrait {
  width: 90px;
  height: 120px;
  border-radius: 8px;
}

.shape-wallpaper {
  width: 100%;
  height: 140px;
  border-radius: 8px;
}

.avatar-placeholder {
  background: var(--sys-bg-primary);
  display: flex;
  justify-content: center;
  align-items: center;
  color: var(--text-tertiary);
  font-size: 14px;
  font-weight: 500;
  box-shadow: inset 0 2px 4px rgba(0,0,0,0.02);
}

.upload-options {
  display: flex;
  flex-direction: column;
  gap: 16px;
  background: #f9fafb;
  padding: 16px;
  border-radius: 16px;
}

.option-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 13px;
  color: var(--text-secondary);
  font-weight: 500;
}

.hidden-file-input {
  display: none;
}

.custom-file-upload {
  display: flex;
  justify-content: center;
  align-items: center;
  background: var(--sys-bg-secondary);
  border: 1px dashed var(--border-color);
  border-radius: 12px;
  padding: 12px;
  cursor: pointer;
  transition: all 0.2s;
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 500;
}

.custom-file-upload:hover {
  background: var(--sys-bg-primary);
  border-color: var(--text-tertiary);
}

.custom-file-upload:active {
  transform: scale(0.98);
}

.option-divider {
  text-align: center;
  font-size: 12px;
  color: var(--text-tertiary);
  position: relative;
}

.option-divider::before,
.option-divider::after {
  content: "";
  position: absolute;
  top: 50%;
  width: 40%;
  height: 1px;
  background: #e5e7eb;
}

.option-divider::before { left: 0; }
.option-divider::after { right: 0; }

.url-input-wrap {
  display: flex;
  gap: 8px;
}

.url-input-wrap input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  outline: none;
  font-size: 12px;
  width: 100%;
  min-width: 0;
}

.url-input-wrap input:focus {
  border-color: #3b82f6;
  box-shadow: 0 0 0 2px rgba(59,130,246,0.1);
}

.btn {
  border: none;
  border-radius: 12px;
  cursor: pointer;
  font-weight: 600;
  transition: all 0.2s;
  display: flex;
  justify-content: center;
  align-items: center;
}

.btn:active {
  transform: scale(0.96);
}

.btn-small {
  padding: 0 12px;
  font-size: 12px;
  background: #e5e7eb;
  color: var(--text-secondary);
  border-radius: 8px;
  white-space: nowrap;
}

.modal-actions {
  display: flex;
  gap: 12px;
  margin-top: 8px;
}

.btn-primary {
  background: #333333;
  color: white;
  flex: 1.5;
  padding: 12px;
  font-size: 14px;
}

.btn-secondary {
  background: var(--sys-bg-primary);
  color: var(--text-secondary);
  flex: 1;
  padding: 12px;
  font-size: 14px;
}
</style>
