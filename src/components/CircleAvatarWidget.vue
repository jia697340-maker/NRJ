<!-- WARNING: 本项目专属“粘人精”，严禁出现违规英文或拼音命名！ -->
<script setup lang="ts">
import { computed, ref } from 'vue'
import AvatarUploadModal from './AvatarUploadModal.vue'
import TextEditModal from './TextEditModal.vue'
import { defaultWidgetConfig, useWidgetInstances, type CircleAvatarWidgetConfig } from '../composables/useWidgetInstances'

const props = defineProps<{ instanceId: string; editing?: boolean }>()
const { records, updateConfig } = useWidgetInstances()
const defaults = defaultWidgetConfig('circle-avatar-widget') as CircleAvatarWidgetConfig
const config = computed(() => ({ ...defaults, ...(records[props.instanceId]?.config as Partial<CircleAvatarWidgetConfig> | undefined) }))

// 头像上传状态
const avatarModalVisible = ref(false)
const loadAvatarFailed = ref(false)

// 文本编辑状态
const textModalVisible = ref(false)
const currentEditingTextType = ref<'title' | 'subtitle'>('title')

const displayAvatar = computed(() => config.value.cachedAvatarImage || config.value.avatarImage)

const openAvatarEditor = () => {
  if (props.editing) return
  avatarModalVisible.value = true
}

const openTextEditor = (type: 'title' | 'subtitle') => {
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

const handleAvatarSaved = async (value: string | null) => {
  const isLocal = Boolean(value?.startsWith('data:') || value?.startsWith('blob:'))
  await updateConfig<CircleAvatarWidgetConfig>(props.instanceId, { avatarImage: value, cachedAvatarImage: null })
  loadAvatarFailed.value = false

  if (!value || isLocal) return

  try {
    const response = await fetch(value, { mode: 'cors', credentials: 'omit' })
    if (response.ok) {
      const cached = await optimizeRemoteImage(await response.blob())
      await updateConfig<CircleAvatarWidgetConfig>(props.instanceId, { cachedAvatarImage: cached })
    }
  } catch {
    // 跨域受限时保留原 URL
  }
}

const handleTextSaved = async (text: string) => {
  if (currentEditingTextType.value === 'title') {
    await updateConfig<CircleAvatarWidgetConfig>(props.instanceId, { title: text.trim() || '主文案占位' })
  } else {
    await updateConfig<CircleAvatarWidgetConfig>(props.instanceId, { subtitle: text.trim() || '胶囊占位' })
  }
}
</script>

<template>
  <div class="clingy-circle-avatar-widget-root">
    <!-- 1. 顶部圆形头像 -->
    <button
      type="button"
      class="widget-avatar-btn"
      title="点击更换头像"
      @click.stop="openAvatarEditor"
    >
      <img
        v-if="displayAvatar && !loadAvatarFailed"
        :src="displayAvatar"
        alt="圆形头像"
        class="avatar-img"
        @error="loadAvatarFailed = true"
        @load="loadAvatarFailed = false"
      />
      <div v-else class="avatar-placeholder">
        <svg class="placeholder-icon" viewBox="0 0 24 24">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
          <circle cx="12" cy="7" r="4"></circle>
        </svg>
        <span class="placeholder-label">头像占位</span>
      </div>
    </button>

    <!-- 2. 中间主文案 -->
    <button
      type="button"
      class="widget-center-title-btn"
      title="点击修改主文案"
      @click.stop="openTextEditor('title')"
    >
      <span>{{ config.title }}</span>
    </button>

    <!-- 3. 底部圆角框文案 -->
    <button
      type="button"
      class="widget-bottom-box-btn"
      title="点击修改底部文案"
      @click.stop="openTextEditor('subtitle')"
    >
      <span>{{ config.subtitle }}</span>
    </button>
  </div>

  <!-- 头像上传弹窗 (IndexedDB 安全存储，绝不存 localStorage) -->
  <AvatarUploadModal
    v-model:visible="avatarModalVisible"
    title="设置圆形头像"
    shape="circle"
    :current-avatar="config.avatarImage"
    @saved="handleAvatarSaved"
  />

  <!-- 文本修改弹窗 -->
  <TextEditModal
    v-model:visible="textModalVisible"
    :title="currentEditingTextType === 'title' ? '修改主文案' : '修改底部文案'"
    :current-text="currentEditingTextType === 'title' ? config.title : config.subtitle"
    :default-text="currentEditingTextType === 'title' ? defaults.title : defaults.subtitle"
    @saved="handleTextSaved"
  />
</template>

<style scoped>
.clingy-circle-avatar-widget-root {
  width: 100%;
  height: 100%;
  max-width: 100%;
  max-height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: transparent;
  padding: 4px;
  box-sizing: border-box;
  user-select: none;
}

/* 1. 圆形头像按钮 */
.widget-avatar-btn {
  width: 76px;
  height: 76px;
  border-radius: 50%;
  background: var(--card-bg-solid, #ffffff);
  border: 1.5px solid var(--border-color, rgba(0, 0, 0, 0.06));
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  padding: 0;
  margin: 0;
  outline: none;
  cursor: pointer;
  transition: transform 0.18s ease, box-shadow 0.18s ease;
}

.widget-avatar-btn:active {
  transform: scale(0.96);
}

.avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.avatar-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
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

.placeholder-label {
  font-size: 9px;
  font-weight: 500;
  letter-spacing: 0.2px;
  color: var(--text-secondary, #94a3b8);
}

/* 2. 中间主文案按钮 */
.widget-center-title-btn {
  background: transparent;
  border: none;
  padding: 0 4px;
  margin: 0;
  outline: none;
  cursor: pointer;
  max-width: 90%;
  text-align: center;
}

.widget-center-title-btn span {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary, #1e293b);
  letter-spacing: 0.2px;
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: block;
  text-shadow: 0 1px 2px rgba(255, 255, 255, 0.8);
}

/* 3. 底部圆角矩形按钮 */
.widget-bottom-box-btn {
  width: 92%;
  max-width: 154px;
  height: 32px;
  padding: 0 10px;
  border-radius: 10px;
  background: var(--card-bg-solid, #ffffff);
  border: 1px solid var(--border-color, rgba(0, 0, 0, 0.06));
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.03);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  outline: none;
  transition: transform 0.18s ease, background 0.18s ease;
}

.widget-bottom-box-btn:active {
  transform: scale(0.97);
}

.widget-bottom-box-btn span {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary, #334155);
  letter-spacing: 0.3px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
