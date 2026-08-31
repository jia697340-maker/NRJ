<!-- WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ -->
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import AvatarUploadModal from './AvatarUploadModal.vue'
import { defaultWidgetConfig, useWidgetInstances, type RectangleImageWidgetConfig } from '../composables/useWidgetInstances'

const props = defineProps<{ instanceId: string; editing?: boolean }>()
const { records, updateConfig } = useWidgetInstances()
const defaults = defaultWidgetConfig('rectangle-image') as RectangleImageWidgetConfig
const config = computed(() => ({ ...defaults, ...(records[props.instanceId]?.config as Partial<RectangleImageWidgetConfig> | undefined) }))
const modalVisible = ref(false)
const draft = ref<RectangleImageWidgetConfig>({ ...defaults })
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
  const next: RectangleImageWidgetConfig = {
    ...draft.value,
    imageSourceType: value ? (isLocal ? 'local' : 'url') : null,
    imageValue: value,
    cachedImageValue: null
  }
  await updateConfig<RectangleImageWidgetConfig>(props.instanceId, next)
  loadFailed.value = false

  if (!value || isLocal) return
  urlCaching.value = true
  try {
    const response = await fetch(value, { mode: 'cors', credentials: 'omit' })
    if (response.ok) {
      const cachedImageValue = await optimizeRemoteImage(await response.blob())
      await updateConfig<RectangleImageWidgetConfig>(props.instanceId, { cachedImageValue })
    }
  } catch {
    // 跨域不允许缓存时保留原 URL，仍可由浏览器直接显示。
  } finally {
    urlCaching.value = false
  }
}
</script>

<template>
  <button type="button" class="rectangle-image-widget" :class="{ empty: !config.imageValue }" :style="{ borderRadius: `${config.borderRadius}px` }" @click="openEditor">
    <img v-if="displayedImage" :src="displayedImage" alt="长方形图片" :style="{ objectFit: config.objectFit, objectPosition: config.objectPosition }" @error="loadFailed = true" @load="loadFailed = false" />
    <span v-if="!displayedImage" class="empty-content"><b>＋</b><small>添加长方形图片</small></span>
    <span v-else-if="loadFailed" class="load-error"><b>!</b><small>图片加载失败</small></span>
    <span v-if="urlCaching" class="cache-hint">正在缓存图片…</span>
  </button>

  <AvatarUploadModal
    v-model:visible="modalVisible"
    title="设置长方形图片"
    shape="wallpaper"
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
            <span class="radius-label">圆角大小</span>
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
          <input v-model.number="draft.borderRadius" type="range" min="0" max="32" step="1" class="radius-slider" />
        </div>
      </div>
    </template>
  </AvatarUploadModal>
</template>

<style scoped>
.rectangle-image-widget {
  width: 100%;
  height: 100%;
  padding: 0;
  border: 0;
  overflow: hidden;
  position: relative;
  display: block;
  background: transparent;
  color: var(--text-primary);
  box-shadow: 0 4px 14px color-mix(in srgb, var(--shadow-color) 45%, transparent);
}
.rectangle-image-widget img {
  width: 100%;
  height: 100%;
  display: block;
}
.rectangle-image-widget.empty {
  border: 1px dashed color-mix(in srgb, var(--text-secondary) 45%, transparent);
  background: color-mix(in srgb, var(--card-bg-solid) 42%, transparent);
  box-shadow: none;
}
.empty-content, .load-error {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  color: var(--text-secondary);
}
.empty-content b, .load-error b {
  font-size: 25px;
  font-weight: 300;
  line-height: 1;
}
.empty-content small, .load-error small {
  font-size: 11px;
}
.load-error {
  background: color-mix(in srgb, var(--card-bg-solid) 90%, transparent);
  color: #c95b56;
}
.cache-hint {
  position: absolute;
  inset: auto 6px 6px;
  padding: 4px 6px;
  border-radius: 7px;
  background: rgba(30,30,32,.72);
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
  min-width: 36px;
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
.btn-reset-radius:not(:disabled):active {
  transform: scale(0.95);
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
