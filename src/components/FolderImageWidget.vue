<!-- WARNING: 本项目专属“粘人精”，严禁出现违规英文或拼音命名！ -->
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import AvatarUploadModal from './AvatarUploadModal.vue'
import { defaultWidgetConfig, useWidgetInstances, type FolderWidgetConfig } from '../composables/useWidgetInstances'

const props = defineProps<{ instanceId: string; editing?: boolean }>()
const { records, updateConfig } = useWidgetInstances()
const defaults = defaultWidgetConfig('folder-widget') as FolderWidgetConfig
const config = computed(() => ({ ...defaults, ...(records[props.instanceId]?.config as Partial<FolderWidgetConfig> | undefined) }))
const modalVisible = ref(false)
const draft = ref<FolderWidgetConfig>({ ...defaults })
const loadFailed = ref(false)
const urlCaching = ref(false)
const displayedImage = computed(() => config.value.cachedImageValue || config.value.imageValue)

watch(modalVisible, visible => {
  if (!visible) return
  draft.value = { ...config.value }
  loadFailed.value = false
})

const openEditor = () => {
  if (!props.editing) modalVisible.value = true
}

const toggleHeart = async (e: Event) => {
  e.stopPropagation()
  if (props.editing) return
  const nextPink = !config.value.heartPink
  await updateConfig<FolderWidgetConfig>(props.instanceId, { heartPink: nextPink })
  navigator.vibrate?.(10)
}

const blobToDataUrl = (blob: Blob) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(String(reader.result || ''))
  reader.onerror = reject
  reader.readAsDataURL(blob)
})

const optimizeRemoteImage = async (blob: Blob) => {
  const source = await blobToDataUrl(blob)
  if (blob.type === 'image/gif' || blob.type === 'image/svg+xml') return source
  return await new Promise<string>(resolve => {
    const image = new Image()
    image.onload = () => {
      const scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight))
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
      const context = canvas.getContext('2d')
      if (!context) return resolve(source)
      context.imageSmoothingEnabled = true
      context.imageSmoothingQuality = 'high'
      context.drawImage(image, 0, 0, canvas.width, canvas.height)
      resolve(canvas.toDataURL('image/webp', 0.86))
    }
    image.onerror = () => resolve(source)
    image.src = source
  })
}

const handleImageSaved = async (value: string | null) => {
  const isLocal = Boolean(value?.startsWith('data:') || value?.startsWith('blob:'))
  const next: FolderWidgetConfig = {
    ...draft.value,
    imageSourceType: value ? (isLocal ? 'local' : 'url') : null,
    imageValue: value,
    cachedImageValue: null
  }
  await updateConfig<FolderWidgetConfig>(props.instanceId, next)
  loadFailed.value = false

  if (!value || isLocal) return
  urlCaching.value = true
  try {
    const response = await fetch(value, { mode: 'cors', credentials: 'omit' })
    if (response.ok) {
      const cachedImageValue = await optimizeRemoteImage(await response.blob())
      await updateConfig<FolderWidgetConfig>(props.instanceId, { cachedImageValue })
    }
  } catch {
    // 跨域不允许缓存时保留原 URL
  } finally {
    urlCaching.value = false
  }
}
</script>

<template>
  <div class="folder-widget-container">
    <!-- 顶部左侧标签页（点击爱心切换粉色/灰色） -->
    <div class="folder-tab" :class="{ 'is-pink': config.heartPink }" title="点击切换爱心颜色" @click.stop="toggleHeart">
      <svg class="folder-tab-heart" viewBox="0 0 24 24">
        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
      </svg>
    </div>

    <!-- 文件夹主体与视窗卡片（点击中间触发上传） -->
    <div class="folder-body">
      <button
        type="button"
        class="folder-inner-window"
        :style="{ borderRadius: `${config.borderRadius}px` }"
        aria-label="上传或更换相框图片"
        @click="openEditor"
      >
        <img
          v-if="displayedImage && !loadFailed"
          :src="displayedImage"
          alt="相框图片"
          class="folder-preview-image"
          :style="{ objectFit: config.objectFit, objectPosition: config.objectPosition }"
          @error="loadFailed = true"
          @load="loadFailed = false"
        />
        <div v-else-if="loadFailed" class="placeholder-content load-error">
          <b>!</b>
          <span class="placeholder-text">加载失败</span>
        </div>
        <div v-else class="placeholder-content">
          <svg class="placeholder-icon" viewBox="0 0 24 24">
            <rect x="3" y="3" width="18" height="18" rx="4" ry="4"></rect>
            <circle cx="8.5" cy="8.5" r="1.5"></circle>
            <polyline points="21 15 16 10 5 21"></polyline>
          </svg>
          <span class="placeholder-text">添加照片</span>
        </div>
        <span v-if="urlCaching" class="cache-hint">正在缓存…</span>
      </button>
    </div>
  </div>

  <AvatarUploadModal
    v-model:visible="modalVisible"
    title="设置文件夹相框图片"
    shape="square"
    :current-avatar="config.imageValue"
    :preview-fit="draft.objectFit"
    :preview-position="draft.objectPosition"
    :preview-radius="draft.borderRadius"
    @saved="handleImageSaved"
  >
    <template #extra>
      <div class="custom-settings">
        <div class="radius-control-card">
          <div class="radius-header">
            <span class="radius-label">视窗圆角</span>
            <div class="radius-meta">
              <span class="radius-val">{{ draft.borderRadius }}px</span>
              <button
                type="button"
                class="btn-reset-radius"
                :disabled="draft.borderRadius === defaults.borderRadius"
                @click="draft.borderRadius = defaults.borderRadius"
              >
                重置
              </button>
            </div>
          </div>
          <input v-model.number="draft.borderRadius" type="range" min="0" max="30" step="1" class="radius-slider" />
        </div>
      </div>
    </template>
  </AvatarUploadModal>
</template>

<style scoped>
.folder-widget-container {
  width: 100%;
  max-width: 100%;
  aspect-ratio: 1.36 / 1;
  max-height: 100%;
  padding: 0;
  border: 0;
  outline: none;
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  background: transparent;
  color: var(--text-primary);
  cursor: pointer;
  filter: drop-shadow(0 6px 14px rgba(0, 0, 0, 0.08)) drop-shadow(0 1px 3px rgba(0, 0, 0, 0.04));
  box-sizing: border-box;
}

.folder-tab {
  position: absolute;
  top: 0;
  left: 0;
  height: 28px;
  width: 42%;
  max-width: 90px;
  background: #ffffff;
  border-top-left-radius: 14px;
  border-top-right-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding-bottom: 5px;
  border: 1.5px solid rgba(0, 0, 0, 0.07);
  border-bottom: none;
  box-sizing: border-box;
  z-index: 1;
}

.folder-tab::after {
  content: "";
  position: absolute;
  bottom: 0px;
  right: -12px;
  width: 12px;
  height: 12px;
  background: transparent;
  border-bottom-left-radius: 12px;
  box-shadow: -4px 4px 0 0 #ffffff;
  pointer-events: none;
}

.folder-tab-heart {
  width: 15px;
  height: 15px;
  fill: #a8a29e;
  transition: fill 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
  pointer-events: none;
}

.folder-tab:active .folder-tab-heart {
  transform: scale(0.85);
}

.folder-tab.is-pink .folder-tab-heart {
  fill: #ff7597;
  filter: drop-shadow(0 1px 3px rgba(255, 117, 151, 0.45));
  transform: scale(1.08);
}

.folder-body {
  position: absolute;
  top: 18px;
  left: 0;
  right: 0;
  bottom: 0;
  background: #ffffff;
  border-radius: 18px;
  border-top-left-radius: 4px;
  border: 1.5px solid rgba(0, 0, 0, 0.07);
  padding: 7px 8px 8px;
  display: flex;
  flex-direction: column;
  z-index: 2;
  box-sizing: border-box;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.8);
}

.folder-inner-window {
  width: 100%;
  height: 100%;
  background: #f8f9fc;
  border: 1px solid rgba(0, 0, 0, 0.06);
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s ease;
}

.folder-preview-image {
  width: 100%;
  height: 100%;
  display: block;
}

.placeholder-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 5px;
  color: #94a3b8;
}

.placeholder-icon {
  width: 24px;
  height: 24px;
  stroke: currentColor;
  stroke-width: 1.6;
  stroke-linecap: round;
  stroke-linejoin: round;
  fill: none;
  opacity: 0.85;
}

.placeholder-text {
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.2px;
}

.load-error {
  color: #c95b56;
}

.cache-hint {
  position: absolute;
  inset: auto 6px 6px;
  padding: 3px 6px;
  border-radius: 6px;
  background: rgba(30, 30, 32, 0.75);
  color: #fff;
  font-size: 10px;
}

.custom-settings {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.radius-control-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  background: #f9fafb;
  padding: 14px 16px;
  border-radius: 16px;
}

.radius-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.radius-label {
  font-size: 13px;
  color: var(--text-secondary);
  font-weight: 500;
}

.radius-meta {
  display: flex;
  align-items: center;
  gap: 8px;
}

.radius-val {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  min-width: 32px;
  text-align: right;
}

.btn-reset-radius {
  padding: 2px 8px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  background: #fff;
  color: var(--text-secondary);
  font-size: 11px;
  cursor: pointer;
  transition: all 0.2s;
  line-height: 1.6;
}

.btn-reset-radius:not(:disabled):hover {
  color: var(--text-primary);
  border-color: var(--text-secondary);
}

.btn-reset-radius:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.radius-slider {
  width: 100%;
  accent-color: var(--text-primary);
  cursor: pointer;
  margin: 2px 0;
}
</style>
