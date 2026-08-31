<!-- WARNING: 本项目专属“粘人精”，严禁出现违规英文或拼音命名！ -->
<script setup lang="ts">
import { computed, ref } from 'vue'
import AvatarUploadModal from './AvatarUploadModal.vue'
import TextEditModal from './TextEditModal.vue'
import { defaultWidgetConfig, useWidgetInstances, type DualFrameWidgetConfig } from '../composables/useWidgetInstances'

const props = defineProps<{ instanceId: string; editing?: boolean }>()
const { records, updateConfig } = useWidgetInstances()
const defaults = defaultWidgetConfig('dual-frame') as DualFrameWidgetConfig
const config = computed(() => ({ ...defaults, ...(records[props.instanceId]?.config as Partial<DualFrameWidgetConfig> | undefined) }))

// 图片上传状态
const imageModalVisible = ref(false)
const currentEditingSlot = ref<'left' | 'right'>('left')
const loadLeftFailed = ref(false)
const loadRightFailed = ref(false)

// 文本编辑状态
const textModalVisible = ref(false)
const currentEditingTextType = ref<'title' | 'buttonText'>('title')

const displayLeftImage = computed(() => config.value.leftCachedImage || config.value.leftImage)
const displayRightImage = computed(() => config.value.rightCachedImage || config.value.rightImage)

const openImageEditor = (slot: 'left' | 'right') => {
  if (props.editing) return
  currentEditingSlot.value = slot
  imageModalVisible.value = true
}

const openTextEditor = (type: 'title' | 'buttonText') => {
  if (props.editing) return
  currentEditingTextType.value = type
  textModalVisible.value = true
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
  const slot = currentEditingSlot.value
  const isLocal = Boolean(value?.startsWith('data:') || value?.startsWith('blob:'))
  
  if (slot === 'left') {
    await updateConfig<DualFrameWidgetConfig>(props.instanceId, { leftImage: value, leftCachedImage: null })
    loadLeftFailed.value = false
  } else {
    await updateConfig<DualFrameWidgetConfig>(props.instanceId, { rightImage: value, rightCachedImage: null })
    loadRightFailed.value = false
  }

  if (!value || isLocal) return

  try {
    const response = await fetch(value, { mode: 'cors', credentials: 'omit' })
    if (response.ok) {
      const cached = await optimizeRemoteImage(await response.blob())
      if (slot === 'left') {
        await updateConfig<DualFrameWidgetConfig>(props.instanceId, { leftCachedImage: cached })
      } else {
        await updateConfig<DualFrameWidgetConfig>(props.instanceId, { rightCachedImage: cached })
      }
    }
  } catch {
    // 跨域受限时保留原 URL
  }
}

const handleTextSaved = async (text: string) => {
  if (currentEditingTextType.value === 'title') {
    await updateConfig<DualFrameWidgetConfig>(props.instanceId, { title: text.trim() || '선택해 주십시오.' })
  } else {
    await updateConfig<DualFrameWidgetConfig>(props.instanceId, { buttonText: text.trim() || '사용' })
  }
}
</script>

<template>
  <div class="clingy-dual-widget-root">
    <!-- 1. 顶部标题文案 -->
    <button
      type="button"
      class="widget-top-title-btn"
      title="点击修改标题文案"
      @click.stop="openTextEditor('title')"
    >
      {{ config.title }}
    </button>

    <!-- 2. 中间两张图片占位卡片 -->
    <div class="widget-dual-cards">
      <!-- 左图 -->
      <button
        type="button"
        class="widget-card-item"
        :style="{ borderRadius: `${config.borderRadius}px` }"
        aria-label="上传或更换左侧图片"
        @click.stop="openImageEditor('left')"
      >
        <img
          v-if="displayLeftImage && !loadLeftFailed"
          :src="displayLeftImage"
          alt="左侧图片"
          class="card-img"
          @error="loadLeftFailed = true"
          @load="loadLeftFailed = false"
        />
        <div v-else class="card-placeholder">
          <svg class="placeholder-icon" viewBox="0 0 24 24">
            <rect x="3" y="3" width="18" height="18" rx="4" ry="4"></rect>
            <circle cx="8.5" cy="8.5" r="1.5"></circle>
            <polyline points="21 15 16 10 5 21"></polyline>
          </svg>
          <span class="placeholder-label">图片占位 1</span>
        </div>
      </button>

      <!-- 右图 -->
      <button
        type="button"
        class="widget-card-item"
        :style="{ borderRadius: `${config.borderRadius}px` }"
        aria-label="上传或更换右侧图片"
        @click.stop="openImageEditor('right')"
      >
        <img
          v-if="displayRightImage && !loadRightFailed"
          :src="displayRightImage"
          alt="右侧图片"
          class="card-img"
          @error="loadRightFailed = true"
          @load="loadRightFailed = false"
        />
        <div v-else class="card-placeholder">
          <svg class="placeholder-icon" viewBox="0 0 24 24">
            <rect x="3" y="3" width="18" height="18" rx="4" ry="4"></rect>
            <circle cx="8.5" cy="8.5" r="1.5"></circle>
            <polyline points="21 15 16 10 5 21"></polyline>
          </svg>
          <span class="placeholder-label">图片占位 2</span>
        </div>
      </button>
    </div>

    <!-- 3. 底部胶囊药丸文案 -->
    <button
      type="button"
      class="widget-bottom-pill-btn"
      title="点击修改胶囊按钮文案"
      @click.stop="openTextEditor('buttonText')"
    >
      <span>{{ config.buttonText }}</span>
    </button>
  </div>

  <!-- 图片上传弹窗 (统一使用 IndexedDB 存储) -->
  <AvatarUploadModal
    v-model:visible="imageModalVisible"
    :title="currentEditingSlot === 'left' ? '设置左侧相框图片' : '设置右侧相框图片'"
    shape="square"
    :current-avatar="currentEditingSlot === 'left' ? config.leftImage : config.rightImage"
    :preview-radius="config.borderRadius"
    @saved="handleImageSaved"
  />

  <!-- 文本修改弹窗 -->
  <TextEditModal
    v-model:visible="textModalVisible"
    :title="currentEditingTextType === 'title' ? '修改顶部标题' : '修改胶囊按钮文案'"
    :current-text="currentEditingTextType === 'title' ? config.title : config.buttonText"
    :default-text="currentEditingTextType === 'title' ? defaults.title : defaults.buttonText"
    @saved="handleTextSaved"
  />
</template>

<style scoped>
.clingy-dual-widget-root {
  width: 100%;
  height: 100%;
  max-width: 100%;
  max-height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  background: transparent;
  padding: 6px 4px;
  box-sizing: border-box;
  user-select: none;
}

/* 1. 顶部标题按钮 */
.widget-top-title-btn {
  background: transparent;
  border: none;
  padding: 0;
  margin: 0;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary, #333333);
  letter-spacing: 0.2px;
  text-align: center;
  line-height: 1.2;
  cursor: pointer;
  outline: none;
  transition: opacity 0.2s ease;
}

.widget-top-title-btn:hover {
  opacity: 0.8;
}

/* 2. 中间卡片区 */
.widget-dual-cards {
  width: 100%;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  align-items: center;
  justify-content: center;
  flex: 1;
  margin: 6px 0;
}

.widget-card-item {
  width: 100%;
  aspect-ratio: 1 / 1;
  background: var(--card-bg-solid, #ffffff);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.06), 0 1px 3px rgba(0, 0, 0, 0.02);
  border: 1px solid var(--border-color, rgba(0, 0, 0, 0.04));
  padding: 0;
  margin: 0;
  outline: none;
  cursor: pointer;
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  transition: transform 0.18s ease;
}

.widget-card-item:active {
  transform: scale(0.96);
}

.card-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.card-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  color: #94a3b8;
}

.placeholder-icon {
  width: 26px;
  height: 26px;
  stroke: currentColor;
  stroke-width: 1.6;
  stroke-linecap: round;
  stroke-linejoin: round;
  fill: none;
  opacity: 0.85;
}

.placeholder-label {
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 0.2px;
  color: var(--text-secondary, #94a3b8);
}

/* 3. 底部胶囊按钮 */
.widget-bottom-pill-btn {
  width: 82%;
  max-width: 200px;
  height: 34px;
  border-radius: 9999px;
  border: 1px solid var(--border-color, #d4d4d8);
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  outline: none;
  transition: transform 0.18s ease, opacity 0.18s ease, background 0.2s ease;
}

.widget-bottom-pill-btn:active {
  transform: scale(0.97);
  opacity: 0.8;
}

.widget-bottom-pill-btn span {
  font-size: 12.5px;
  font-weight: 400;
  color: var(--text-secondary, #666666);
  letter-spacing: 0.4px;
}
</style>
