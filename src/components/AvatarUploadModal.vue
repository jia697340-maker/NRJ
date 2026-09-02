/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<template>
  <Teleport to="body">
    <div class="modal-overlay" v-if="visible" @click.self="close">
    <div class="modal-content">
      <button class="close-btn" @click="close" aria-label="关闭">
        <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>

      <div class="modal-scroll-area">
        <h2 class="modal-title">{{ title || '更换头像' }}</h2>
        
        <template v-if="cropMode">
          <div
            class="crop-viewport"
            :class="{ 'is-circle': shape === 'circle', 'is-rounded': shape === 'avatar' }"
            @pointerdown="handleCropPointerDown"
            @pointermove="handleCropPointerMove"
            @pointerup="handleCropPointerUp"
            @pointercancel="handleCropPointerUp"
          >
            <img :src="cropSource" :style="cropImageStyle" alt="待裁剪头像" draggable="false" />
            <div class="crop-frame"></div>
          </div>
          <div class="crop-hint">拖动图片调整位置，双指或滑块缩放</div>
          <label class="crop-zoom-row">
            <span>缩小</span>
            <input v-model.number="cropZoom" type="range" min="1" max="4" step="0.01" @input="clampCropOffset" />
            <span>放大</span>
          </label>
          <div class="modal-actions crop-actions">
            <button @click="cancelCrop" class="btn btn-secondary">取消裁剪</button>
            <button @click="finishCrop" class="btn btn-primary">完成裁剪</button>
          </div>
        </template>

        <template v-else>
          <div class="avatar-preview">
            <img v-if="previewUrl" :src="previewUrl" class="avatar-img" :class="shapeClass" :style="previewStyle" />
            <div v-else class="avatar-placeholder" :class="shapeClass" :style="previewStyle">预览</div>
          </div>
          <div v-if="optimizeHint" class="optimize-hint">{{ optimizeHint }}</div>

          <div class="upload-options">
          <div class="option-group">
            <label class="custom-file-upload">
              <input ref="fileInput" type="file" accept="image/*" @change="handleFileChange" class="hidden-file-input" />
              <span class="upload-btn-text">选择本地图片</span>
            </label>
          </div>
          
          <div class="option-divider">或</div>
          
          <div class="option-group url-group">
            <label>网络图片地址</label>
            <div class="url-input-wrap">
              <input type="text" v-model="inputUrl" placeholder="输入图片链接..." />
              <button @click="applyUrl" class="btn btn-small">应用</button>
            </div>
          </div>
          </div>

          <slot name="extra"></slot>

          <div class="modal-actions">
            <button @click="resetAvatar" class="btn btn-secondary">恢复默认</button>
            <button @click="saveAvatar" class="btn btn-primary" :class="{ 'is-disabled': isOptimizing }">{{ isOptimizing ? '优化中…' : '保存' }}</button>
          </div>
        </template>
      </div>
    </div>
  </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { globalSettings } from '../store/global'

const props = withDefaults(defineProps<{
  visible: boolean
  currentAvatar?: string | null
  shape?: 'avatar' | 'bg-left' | 'bg-right' | 'circle' | 'portrait' | 'wallpaper' | 'square'
  title?: string
  previewFit?: 'cover' | 'contain'
  previewPosition?: string
  previewRadius?: number
  enableCrop?: boolean
}>(), {
  shape: 'circle',
  currentAvatar: null,
  previewFit: undefined,
  previewPosition: undefined,
  previewRadius: undefined,
  enableCrop: false
})

const previewStyle = computed(() => ({
  ...(props.previewFit ? { objectFit: props.previewFit } : {}),
  ...(props.previewPosition ? { objectPosition: props.previewPosition } : {}),
  ...(props.previewRadius !== undefined ? { borderRadius: `${props.previewRadius}%` } : {})
}))

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
const fileInput = ref<HTMLInputElement | null>(null)
const cropMode = ref(false)
const cropSource = ref('')
const cropNaturalWidth = ref(0)
const cropNaturalHeight = ref(0)
const cropZoom = ref(1)
const cropOffsetX = ref(0)
const cropOffsetY = ref(0)
const cropImage = ref<HTMLImageElement | null>(null)
const cropViewportSize = 220
const activeCropPointers = new Map<number, { x: number; y: number }>()
let lastPinchDistance = 0

const cropEnabled = computed(() => (
  props.enableCrop && globalSettings.enableAvatarCrop && (props.shape === 'avatar' || props.shape === 'circle')
))

const cropBaseScale = computed(() => Math.max(
  cropViewportSize / Math.max(1, cropNaturalWidth.value),
  cropViewportSize / Math.max(1, cropNaturalHeight.value)
))
const cropScale = computed(() => cropBaseScale.value * cropZoom.value)
const cropImageStyle = computed(() => ({
  width: `${cropNaturalWidth.value * cropScale.value}px`,
  height: `${cropNaturalHeight.value * cropScale.value}px`,
  left: `calc(50% + ${cropOffsetX.value}px)`,
  top: `calc(50% + ${cropOffsetY.value}px)`
}))

watch(() => props.visible, (newVal) => {
  if (newVal) {
    previewUrl.value = props.currentAvatar
    inputUrl.value = ''
    optimizeHint.value = ''
    cancelCrop()
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

const clampCropOffset = () => {
  const maxX = Math.max(0, (cropNaturalWidth.value * cropScale.value - cropViewportSize) / 2)
  const maxY = Math.max(0, (cropNaturalHeight.value * cropScale.value - cropViewportSize) / 2)
  cropOffsetX.value = Math.max(-maxX, Math.min(maxX, cropOffsetX.value))
  cropOffsetY.value = Math.max(-maxY, Math.min(maxY, cropOffsetY.value))
}

const beginCrop = (source: string) => new Promise<boolean>((resolve) => {
  const image = new Image()
  if (/^https?:/i.test(source)) image.crossOrigin = 'anonymous'
  image.onload = () => {
    cropImage.value = image
    cropSource.value = source
    cropNaturalWidth.value = image.naturalWidth
    cropNaturalHeight.value = image.naturalHeight
    cropZoom.value = 1
    cropOffsetX.value = 0
    cropOffsetY.value = 0
    cropMode.value = true
    resolve(true)
  }
  image.onerror = () => resolve(false)
  image.src = source
})

const cancelCrop = () => {
  cropMode.value = false
  cropSource.value = ''
  cropImage.value = null
  cropNaturalWidth.value = 0
  cropNaturalHeight.value = 0
  cropZoom.value = 1
  cropOffsetX.value = 0
  cropOffsetY.value = 0
  activeCropPointers.clear()
  lastPinchDistance = 0
}

const handleCropPointerDown = (event: PointerEvent) => {
  const target = event.currentTarget as HTMLElement
  target.setPointerCapture?.(event.pointerId)
  activeCropPointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
  if (activeCropPointers.size === 2) {
    const [first, second] = [...activeCropPointers.values()]
    lastPinchDistance = Math.hypot(second.x - first.x, second.y - first.y)
  }
}

const handleCropPointerMove = (event: PointerEvent) => {
  const previous = activeCropPointers.get(event.pointerId)
  if (!previous) return
  activeCropPointers.set(event.pointerId, { x: event.clientX, y: event.clientY })

  if (activeCropPointers.size === 1) {
    cropOffsetX.value += event.clientX - previous.x
    cropOffsetY.value += event.clientY - previous.y
  } else if (activeCropPointers.size === 2) {
    const [first, second] = [...activeCropPointers.values()]
    const distance = Math.hypot(second.x - first.x, second.y - first.y)
    if (lastPinchDistance > 0) {
      cropZoom.value = Math.max(1, Math.min(4, cropZoom.value * distance / lastPinchDistance))
    }
    lastPinchDistance = distance
  }
  clampCropOffset()
}

const handleCropPointerUp = (event: PointerEvent) => {
  activeCropPointers.delete(event.pointerId)
  if (activeCropPointers.size < 2) lastPinchDistance = 0
}

const finishCrop = () => {
  const image = cropImage.value
  if (!image) return
  const sourceSize = cropViewportSize / cropScale.value
  const sourceX = cropNaturalWidth.value / 2 + (-cropViewportSize / 2 - cropOffsetX.value) / cropScale.value
  const sourceY = cropNaturalHeight.value / 2 + (-cropViewportSize / 2 - cropOffsetY.value) / cropScale.value
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 512
  const context = canvas.getContext('2d')
  if (!context) return
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  try {
    context.drawImage(image, sourceX, sourceY, sourceSize, sourceSize, 0, 0, 512, 512)
    previewUrl.value = canvas.toDataURL('image/webp', 0.88)
    optimizeHint.value = '已裁剪为 512 × 512 头像'
    cancelCrop()
  } catch {
    optimizeHint.value = '该网络图片不允许裁剪，请下载后从本地上传'
    cancelCrop()
  }
}

const handleFileChange = (e: Event) => {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (file) {
    const reader = new FileReader()
    reader.onload = async (event) => {
      const original = event.target?.result as string
      if (cropEnabled.value) {
        isOptimizing.value = true
        optimizeHint.value = '正在读取图片…'
        const loaded = await beginCrop(original)
        optimizeHint.value = loaded ? '' : '无法读取该图片，请重新选择'
        isOptimizing.value = false
        if (fileInput.value) fileInput.value.value = ''
        return
      }
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
      if (fileInput.value) fileInput.value.value = ''
    }
    reader.readAsDataURL(file)
  }
}

const applyUrl = async () => {
  if (inputUrl.value.trim()) {
    const source = inputUrl.value.trim()
    if (!cropEnabled.value) {
      previewUrl.value = source
      return
    }
    isOptimizing.value = true
    optimizeHint.value = '正在读取网络图片…'
    const loaded = await beginCrop(source)
    optimizeHint.value = loaded ? '' : '该网络图片不允许裁剪，请下载后从本地上传'
    isOptimizing.value = false
  }
}

const resetAvatar = () => {
  previewUrl.value = null
  inputUrl.value = ''
  optimizeHint.value = ''
  cancelCrop()
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
  z-index: 20000;
  animation: fadeIn 0.2s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.modal-content {
  background: var(--sys-bg-secondary);
  border-radius: 24px;
  padding: 0;
  width: 85%;
  max-width: 320px;
  max-height: 80vh;
  overflow: hidden;
  box-shadow: 0 10px 30px rgba(0,0,0,0.1);
  display: flex;
  flex-direction: column;
  animation: slideUp 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  position: relative;
}

.modal-scroll-area {
  padding: 24px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 20px;
  width: 100%;
  box-sizing: border-box;
  -ms-overflow-style: none;
  scrollbar-width: none;
}

/* 隐藏滚动条但保留滚动功能 */
.modal-scroll-area::-webkit-scrollbar {
  display: none;
}

.close-btn {
  position: absolute;
  top: 16px;
  right: 16px;
  z-index: 10;
  background: color-mix(in srgb, var(--sys-bg-secondary) 85%, transparent);
  backdrop-filter: blur(8px);
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

.crop-viewport {
  position: relative;
  width: 220px;
  height: 220px;
  max-width: 100%;
  align-self: center;
  overflow: hidden;
  border-radius: 18px;
  background: #161616;
  box-shadow: 0 8px 24px rgba(0,0,0,0.18);
  cursor: grab;
  touch-action: none;
  user-select: none;
}

.crop-viewport:active {
  cursor: grabbing;
}

.crop-viewport.is-circle,
.crop-viewport.is-circle .crop-frame {
  border-radius: 50%;
}

.crop-viewport.is-rounded,
.crop-viewport.is-rounded .crop-frame {
  border-radius: 22%;
}

.crop-viewport img {
  position: absolute;
  max-width: none;
  transform: translate(-50%, -50%);
  pointer-events: none;
  -webkit-user-drag: none;
}

.crop-frame {
  position: absolute;
  inset: 0;
  border: 2px solid rgba(255,255,255,0.9);
  box-sizing: border-box;
  box-shadow: inset 0 0 0 1px rgba(0,0,0,0.18);
  pointer-events: none;
}

.crop-frame::before,
.crop-frame::after {
  content: '';
  position: absolute;
  background: rgba(255,255,255,0.38);
}

.crop-frame::before {
  top: 0;
  bottom: 0;
  left: 50%;
  width: 1px;
}

.crop-frame::after {
  left: 0;
  right: 0;
  top: 50%;
  height: 1px;
}

.crop-hint {
  margin-top: -8px;
  color: var(--text-tertiary);
  font-size: 12px;
  line-height: 1.5;
  text-align: center;
}

.crop-zoom-row {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 10px;
  color: var(--text-tertiary);
  font-size: 11px;
}

.crop-zoom-row input {
  width: 100%;
  accent-color: var(--accent-color, #333);
}

.crop-actions {
  margin-top: 0;
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
