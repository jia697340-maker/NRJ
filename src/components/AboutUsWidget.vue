<!-- WARNING: 本项目专属“粘人精”，严禁出现违规英文或拼音命名！ -->
<script setup lang="ts">
import { computed, ref } from 'vue'
import AvatarUploadModal from './AvatarUploadModal.vue'
import TextEditModal from './TextEditModal.vue'
import { defaultWidgetConfig, useWidgetInstances, type AboutUsWidgetConfig } from '../composables/useWidgetInstances'

const props = defineProps<{ instanceId: string; editing?: boolean }>()
const { records, updateConfig } = useWidgetInstances()
const defaults = defaultWidgetConfig('about-us-widget') as AboutUsWidgetConfig
const config = computed(() => ({ ...defaults, ...(records[props.instanceId]?.config as Partial<AboutUsWidgetConfig> | undefined) }))

// 弹窗状态管理
const cardImageModalVisible = ref(false)
const avatarModalVisible = ref(false)
const textModalVisible = ref(false)
const currentEditingField = ref<'title' | 'tag1' | 'tag2' | 'slogan'>('title')

const loadCardImageFailed = ref(false)
const loadAvatarFailed = ref(false)

const displayCardImage = computed(() => config.value.cachedCardImage || config.value.cardImage)
const displayAvatar = computed(() => config.value.cachedAvatarImage || config.value.avatarImage)

const openCardImageEditor = () => {
  if (props.editing) return
  cardImageModalVisible.value = true
}

const openAvatarEditor = () => {
  if (props.editing) return
  avatarModalVisible.value = true
}

const openTextEditor = (field: 'title' | 'tag1' | 'tag2' | 'slogan') => {
  if (props.editing) return
  currentEditingField.value = field
  textModalVisible.value = true
}

const currentFieldTitle = computed(() => {
  switch (currentEditingField.value) {
    case 'title': return '修改顶部标题'
    case 'tag1': return '修改标签一'
    case 'tag2': return '修改标签二'
    case 'slogan': return '修改底部签名文案'
    default: return '编辑文本'
  }
})

const currentFieldValue = computed(() => {
  switch (currentEditingField.value) {
    case 'title': return config.value.title
    case 'tag1': return config.value.tag1
    case 'tag2': return config.value.tag2
    case 'slogan': return config.value.slogan
    default: return ''
  }
})
const currentFieldDefault = computed(() => defaults[currentEditingField.value])

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

const handleCardImageSaved = async (value: string | null) => {
  const isLocal = Boolean(value?.startsWith('data:') || value?.startsWith('blob:'))
  await updateConfig<AboutUsWidgetConfig>(props.instanceId, { cardImage: value, cachedCardImage: null })
  loadCardImageFailed.value = false

  if (!value || isLocal) return
  try {
    const response = await fetch(value, { mode: 'cors', credentials: 'omit' })
    if (response.ok) {
      const cached = await optimizeRemoteImage(await response.blob())
      await updateConfig<AboutUsWidgetConfig>(props.instanceId, { cachedCardImage: cached })
    }
  } catch {
    // 跨域时保留原链接
  }
}

const handleAvatarSaved = async (value: string | null) => {
  const isLocal = Boolean(value?.startsWith('data:') || value?.startsWith('blob:'))
  await updateConfig<AboutUsWidgetConfig>(props.instanceId, { avatarImage: value, cachedAvatarImage: null })
  loadAvatarFailed.value = false

  if (!value || isLocal) return
  try {
    const response = await fetch(value, { mode: 'cors', credentials: 'omit' })
    if (response.ok) {
      const cached = await optimizeRemoteImage(await response.blob())
      await updateConfig<AboutUsWidgetConfig>(props.instanceId, { cachedAvatarImage: cached })
    }
  } catch {
    // 跨域时保留原链接
  }
}

const handleTextSaved = async (text: string) => {
  const trimmed = text.trim()
  switch (currentEditingField.value) {
    case 'title':
      await updateConfig<AboutUsWidgetConfig>(props.instanceId, { title: trimmed || '标题占位' })
      break
    case 'tag1':
      await updateConfig<AboutUsWidgetConfig>(props.instanceId, { tag1: trimmed || '#标签一' })
      break
    case 'tag2':
      await updateConfig<AboutUsWidgetConfig>(props.instanceId, { tag2: trimmed || '#标签二' })
      break
    case 'slogan':
      await updateConfig<AboutUsWidgetConfig>(props.instanceId, { slogan: trimmed || '☆⁺底部签名占位文案⁺☆' })
      break
  }
}
</script>

<template>
  <div class="clingy-about-us-widget">
    <!-- 1. Header 区域：头像 + 标题 + 右侧按钮 -->
    <div class="about-us-header">
      <div class="header-left">
        <button
          type="button"
          class="avatar-badge-btn"
          title="点击更换头像"
          @click.stop="openAvatarEditor"
        >
          <img
            v-if="displayAvatar && !loadAvatarFailed"
            :src="displayAvatar"
            alt="头像"
            class="avatar-badge-img"
            @error="loadAvatarFailed = true"
            @load="loadAvatarFailed = false"
          />
          <div v-else class="avatar-badge-placeholder">
            <svg class="avatar-icon" viewBox="0 0 24 24">
              <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/>
            </svg>
          </div>
        </button>

        <button
          type="button"
          class="title-btn"
          title="点击修改标题"
          @click.stop="openTextEditor('title')"
        >
          <span>{{ config.title }}</span>
        </button>
      </div>

      <div class="header-right">
        <!-- 装饰性搜索按钮 -->
        <button type="button" class="icon-btn" title="搜索">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <circle cx="11" cy="11" r="7"/>
            <line x1="16.5" y1="16.5" x2="21.5" y2="21.5"/>
          </svg>
        </button>
        <!-- 装饰性加号按钮 -->
        <button type="button" class="icon-btn" title="添加">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
        </button>
      </div>
    </div>

    <!-- 2. 标签栏（Tags） -->
    <div class="about-us-tags">
      <button
        type="button"
        class="tag-pill-btn"
        title="点击修改标签一"
        @click.stop="openTextEditor('tag1')"
      >
        <span>{{ config.tag1 }}</span>
      </button>

      <button
        type="button"
        class="tag-pill-btn"
        title="点击修改标签二"
        @click.stop="openTextEditor('tag2')"
      >
        <span>{{ config.tag2 }}</span>
      </button>
    </div>

    <!-- 3. 中间展示大卡片（白底立体圆角卡片） -->
    <div
      class="about-us-card-stage"
      title="点击更换展示图片"
      @click.stop="openCardImageEditor"
    >
      <img
        v-if="displayCardImage && !loadCardImageFailed"
        :src="displayCardImage"
        alt="展示图片"
        class="card-image-elem"
        @error="loadCardImageFailed = true"
        @load="loadCardImageFailed = false"
      />
      <div v-else class="card-placeholder-inner">
        <div class="placeholder-icon-wrap">
          <svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="4" ry="4"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <polyline points="21 15 16 10 5 21"/>
          </svg>
        </div>
        <span class="placeholder-tip">点击配置展示图片</span>
      </div>
    </div>

    <!-- 4. 底部 Slogan 签名 -->
    <div class="about-us-footer">
      <button
        type="button"
        class="slogan-btn"
        title="点击修改底部签名"
        @click.stop="openTextEditor('slogan')"
      >
        <span>{{ config.slogan }}</span>
      </button>
    </div>
  </div>

  <!-- 主图上传弹窗（IndexedDB 安全存取） -->
  <AvatarUploadModal
    v-model:visible="cardImageModalVisible"
    title="设置相框展示图片"
    shape="square"
    :current-avatar="config.cardImage"
    @saved="handleCardImageSaved"
  />

  <!-- 头像上传弹窗（IndexedDB 安全存取） -->
  <AvatarUploadModal
    v-model:visible="avatarModalVisible"
    title="设置头像徽章"
    shape="circle"
    enable-crop
    :current-avatar="config.avatarImage"
    @saved="handleAvatarSaved"
  />

  <!-- 文本修改弹窗 -->
  <TextEditModal
    v-model:visible="textModalVisible"
    :title="currentFieldTitle"
    :current-text="currentFieldValue"
    :default-text="currentFieldDefault"
    @saved="handleTextSaved"
  />
</template>

<style scoped>
.clingy-about-us-widget {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 100%;
  background: transparent;
  box-shadow: none;
  border: none;
  padding: 4px 6px;
  user-select: none;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

/* 1. 顶部 Header */
.about-us-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  flex-shrink: 0;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.avatar-badge-btn {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  background-color: #fcecee;
  border: none;
  outline: none;
  padding: 0;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  flex-shrink: 0;
  transition: transform 0.15s ease;
}

.avatar-badge-btn:active {
  transform: scale(0.92);
}

.avatar-badge-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.avatar-badge-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.avatar-icon {
  width: 22px;
  height: 22px;
  fill: #b3bac5;
  margin-top: 3px;
}

.title-btn {
  background: transparent;
  border: none;
  outline: none;
  cursor: pointer;
  padding: 0;
  text-align: left;
  min-width: 0;
}

.title-btn span {
  font-size: 22px;
  font-weight: 800;
  color: var(--text-primary, #333333);
  letter-spacing: -0.5px;
  line-height: 1.1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: block;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.icon-btn {
  background: transparent;
  border: none;
  outline: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 3px;
  color: var(--text-primary, #3b4049);
  transition: transform 0.15s ease, opacity 0.15s ease;
}

.icon-btn:active {
  transform: scale(0.9);
  opacity: 0.7;
}

.icon-btn svg {
  width: 20px;
  height: 20px;
  stroke-width: 2.2;
}

/* 2. 标签栏 */
.about-us-tags {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 6px;
  flex-shrink: 0;
}

.tag-pill-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 4px 12px;
  border-radius: 20px;
  border: 1.5px solid var(--border-color, #d5d9df);
  background-color: transparent;
  color: var(--text-secondary, #676d77);
  font-size: 11.5px;
  font-weight: 600;
  letter-spacing: -0.2px;
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
}

.tag-pill-btn:active {
  background-color: rgba(0, 0, 0, 0.05);
  transform: scale(0.95);
}

.tag-pill-btn span {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 130px;
}

/* 3. 中间大卡片展示区 */
.about-us-card-stage {
  margin-top: 8px;
  margin-bottom: 8px;
  width: 100%;
  flex: 1;
  min-height: 0;
  background: #ffffff;
  border-radius: 26px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08), 0 2px 6px rgba(0, 0, 0, 0.03);
  padding: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
  cursor: pointer;
  box-sizing: border-box;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.about-us-card-stage:active {
  transform: scale(0.985);
}

.card-image-elem {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 20px;
  display: block;
}

.card-placeholder-inner {
  width: 100%;
  height: 100%;
  border-radius: 20px;
  border: 2px dashed #e2e8f0;
  background-color: #fafbfc;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: #94a3b8;
  transition: all 0.2s ease;
}

.about-us-card-stage:hover .card-placeholder-inner {
  border-color: #cbd5e1;
  background-color: #f1f5f9;
  color: #64748b;
}

.placeholder-icon-wrap {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.04);
}

.placeholder-icon-wrap svg {
  width: 20px;
  height: 20px;
  stroke: currentColor;
}

.placeholder-tip {
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.2px;
}

/* 4. 底部签名 */
.about-us-footer {
  text-align: center;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.slogan-btn {
  background: transparent;
  border: none;
  outline: none;
  cursor: pointer;
  padding: 2px 6px;
  margin: 0;
  max-width: 100%;
}

.slogan-btn span {
  font-size: 13.5px;
  font-weight: 700;
  color: var(--text-primary, #2b303a);
  letter-spacing: 0.3px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: block;
}
</style>
