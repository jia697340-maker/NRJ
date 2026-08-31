<!-- WARNING: 本项目专属“粘人精”，严禁出现违规英文或拼音命名！ -->
<script setup lang="ts">
import { computed, ref } from 'vue'
import AvatarUploadModal from './AvatarUploadModal.vue'
import TextEditModal from './TextEditModal.vue'
import { defaultWidgetConfig, useWidgetInstances, type ProfileCardWidgetConfig } from '../composables/useWidgetInstances'

const props = defineProps<{ instanceId: string; editing?: boolean }>()
const { records, updateConfig } = useWidgetInstances()
const defaults = defaultWidgetConfig('profile-card-widget') as ProfileCardWidgetConfig
const config = computed(() => ({ ...defaults, ...(records[props.instanceId]?.config as Partial<ProfileCardWidgetConfig> | undefined) }))

// 图片上传状态管理
const coverModalVisible = ref(false)
const avatarModalVisible = ref(false)
const loadCoverFailed = ref(false)
const loadAvatarFailed = ref(false)

// 文本编辑状态管理
const textModalVisible = ref(false)
const currentEditingField = ref<'name' | 'handle' | 'bio' | 'location'>('name')

const displayCover = computed(() => config.value.cachedCoverImage || config.value.coverImage)
const displayAvatar = computed(() => config.value.cachedAvatarImage || config.value.avatarImage)

const openCoverEditor = () => {
  if (props.editing) return
  coverModalVisible.value = true
}

const openAvatarEditor = () => {
  if (props.editing) return
  avatarModalVisible.value = true
}

const openTextEditor = (field: 'name' | 'handle' | 'bio' | 'location') => {
  if (props.editing) return
  currentEditingField.value = field
  textModalVisible.value = true
}

const currentFieldTitle = computed(() => {
  switch (currentEditingField.value) {
    case 'name': return '修改名片昵称'
    case 'handle': return '修改账号/副标题'
    case 'bio': return '修改个性签名'
    case 'location': return '修改地点标签'
    default: return '编辑文本'
  }
})

const currentFieldValue = computed(() => {
  switch (currentEditingField.value) {
    case 'name': return config.value.name
    case 'handle': return config.value.handle
    case 'bio': return config.value.bio
    case 'location': return config.value.location
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

const handleCoverSaved = async (value: string | null) => {
  const isLocal = Boolean(value?.startsWith('data:') || value?.startsWith('blob:'))
  await updateConfig<ProfileCardWidgetConfig>(props.instanceId, { coverImage: value, cachedCoverImage: null })
  loadCoverFailed.value = false

  if (!value || isLocal) return
  try {
    const response = await fetch(value, { mode: 'cors', credentials: 'omit' })
    if (response.ok) {
      const cached = await optimizeRemoteImage(await response.blob())
      await updateConfig<ProfileCardWidgetConfig>(props.instanceId, { cachedCoverImage: cached })
    }
  } catch {
    // 跨域时保留原链接
  }
}

const handleAvatarSaved = async (value: string | null) => {
  const isLocal = Boolean(value?.startsWith('data:') || value?.startsWith('blob:'))
  await updateConfig<ProfileCardWidgetConfig>(props.instanceId, { avatarImage: value, cachedAvatarImage: null })
  loadAvatarFailed.value = false

  if (!value || isLocal) return
  try {
    const response = await fetch(value, { mode: 'cors', credentials: 'omit' })
    if (response.ok) {
      const cached = await optimizeRemoteImage(await response.blob())
      await updateConfig<ProfileCardWidgetConfig>(props.instanceId, { cachedAvatarImage: cached })
    }
  } catch {
    // 跨域时保留原链接
  }
}

const handleTextSaved = async (text: string) => {
  const trimmed = text.trim()
  switch (currentEditingField.value) {
    case 'name':
      await updateConfig<ProfileCardWidgetConfig>(props.instanceId, { name: trimmed || '名片昵称' })
      break
    case 'handle':
      await updateConfig<ProfileCardWidgetConfig>(props.instanceId, { handle: trimmed || '@用户名或状态' })
      break
    case 'bio':
      await updateConfig<ProfileCardWidgetConfig>(props.instanceId, { bio: trimmed || '点击编辑个性签名' })
      break
    case 'location':
      await updateConfig<ProfileCardWidgetConfig>(props.instanceId, { location: trimmed || '城市' })
      break
  }
}
</script>

<template>
  <div class="clingy-profile-card-widget">
    <!-- 1. 上半部分：封面背景（严格占满上半部 50%） -->
    <div
      class="profile-card-cover-section"
      title="点击更换背景图片"
      @click.stop="openCoverEditor"
    >
      <img
        v-if="displayCover && !loadCoverFailed"
        :src="displayCover"
        alt="封面背景"
        class="cover-image-element"
        @error="loadCoverFailed = true"
        @load="loadCoverFailed = false"
      />
      <div v-else class="cover-placeholder-content">
        <svg class="placeholder-icon" viewBox="0 0 24 24">
          <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14zm-5.04-6.71l-2.75 3.54-1.96-2.36L6.5 17h11l-3.54-4.71z"/>
        </svg>
        <span class="placeholder-label">更换背景</span>
      </div>
    </div>

    <!-- 2. 下半部分：白底信息区（严格占满下半部 50%） -->
    <div class="profile-card-info-section">
      <div class="info-content-wrap">
        <!-- 昵称 -->
        <button
          type="button"
          class="btn-text-field field-name"
          title="点击修改昵称"
          @click.stop="openTextEditor('name')"
        >
          <span>{{ config.name }}</span>
        </button>

        <!-- 副标题/状态 -->
        <button
          type="button"
          class="btn-text-field field-handle"
          title="点击修改副标题"
          @click.stop="openTextEditor('handle')"
        >
          <span>{{ config.handle }}</span>
        </button>

        <!-- 个性签名 -->
        <button
          type="button"
          class="btn-text-field field-bio"
          title="点击修改个性签名"
          @click.stop="openTextEditor('bio')"
        >
          <span>{{ config.bio }}</span>
        </button>

        <!-- 地点标签 -->
        <button
          type="button"
          class="btn-text-field field-location"
          title="点击修改地点"
          @click.stop="openTextEditor('location')"
        >
          <svg class="location-pin" viewBox="0 0 24 24">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
          </svg>
          <span>{{ config.location }}</span>
        </button>
      </div>
    </div>

    <!-- 3. 中心悬浮大头像：严格居中悬浮在 50% 水平分割线上 -->
    <button
      type="button"
      class="profile-card-floating-avatar"
      title="点击更换头像"
      @click.stop="openAvatarEditor"
    >
      <div class="avatar-circle">
        <img
          v-if="displayAvatar && !loadAvatarFailed"
          :src="displayAvatar"
          alt="头像"
          class="avatar-img"
          @error="loadAvatarFailed = true"
          @load="loadAvatarFailed = false"
        />
        <div v-else class="avatar-placeholder">
          <svg class="avatar-placeholder-icon" viewBox="0 0 24 24">
            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
          </svg>
        </div>
      </div>
    </button>
  </div>

  <!-- 背景图片上传弹窗（IndexedDB 安全存取） -->
  <AvatarUploadModal
    v-model:visible="coverModalVisible"
    title="设置封面背景图片"
    shape="square"
    :current-avatar="config.coverImage"
    @saved="handleCoverSaved"
  />

  <!-- 头像上传弹窗（IndexedDB 安全存取） -->
  <AvatarUploadModal
    v-model:visible="avatarModalVisible"
    title="设置名片头像"
    shape="circle"
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
.clingy-profile-card-widget {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 100%;
  border-radius: 28px;
  overflow: hidden;
  background: var(--card-bg-solid, #ffffff);
  box-shadow: 0 6px 20px var(--shadow-color, rgba(0, 0, 0, 0.08));
  user-select: none;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
}

/* 1. 上半部分：风景背景封面（占比 42%） */
.profile-card-cover-section {
  width: 100%;
  height: 42%;
  flex: 0 0 42%;
  position: relative;
  background: linear-gradient(135deg, #dbeafe 0%, #cbd5e1 100%);
  overflow: hidden;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
}

.cover-image-element {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.cover-placeholder-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  color: #64748b;
  opacity: 0.85;
  transition: opacity 0.2s ease;
}

.cover-placeholder-content:hover {
  opacity: 1;
}

.placeholder-icon {
  width: 24px;
  height: 24px;
  fill: currentColor;
}

.placeholder-label {
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.2px;
}

/* 2. 下半部分：白底信息卡片（占比 58%，从上往下排布，留出给头像的切入空间） */
.profile-card-info-section {
  width: 100%;
  height: 58%;
  flex: 0 0 58%;
  background: var(--card-bg-solid, #ffffff);
  border-top-left-radius: 26px;
  border-top-right-radius: 26px;
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  padding: 34px 14px 14px;
  box-sizing: border-box;
}

.info-content-wrap {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
}

/* 3. 悬浮头像：饱满大尺寸（68px），定位在 36% 偏上位置（约 65% 露在背景，仅 35% 浅切入白卡） */
.profile-card-floating-avatar {
  position: absolute;
  top: 36%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 68px;
  height: 68px;
  border-radius: 50%;
  background: #ffffff;
  padding: 3.5px;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.12);
  cursor: pointer;
  border: none;
  outline: none;
  z-index: 3;
  box-sizing: border-box;
  transition: transform 0.18s ease;
}

.profile-card-floating-avatar:active {
  transform: translate(-50%, -50%) scale(0.95);
}

.avatar-circle {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  overflow: hidden;
  background: #f1f5f9;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}

.avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.avatar-placeholder-icon {
  width: 30px;
  height: 30px;
  fill: #94a3b8;
}

/* 文本字段按钮：字号与间距精致舒展，完全对齐图2 */
.btn-text-field {
  background: transparent;
  border: none;
  padding: 1px 6px;
  margin: 0;
  outline: none;
  cursor: pointer;
  max-width: 100%;
  text-align: center;
  line-height: 1.2;
}

.field-name span {
  font-size: 16px;
  font-weight: 800;
  color: var(--text-primary, #0f172a);
  letter-spacing: -0.2px;
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: block;
}

.field-handle span {
  font-size: 11px;
  color: var(--text-secondary, #94a3b8);
  font-weight: 500;
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: block;
}

.field-bio span {
  font-size: 11px;
  color: var(--text-primary, #334155);
  font-weight: 500;
  margin-top: 1px;
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: block;
}

.field-location {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 3px;
  font-size: 11px;
  color: var(--text-secondary, #64748b);
  font-weight: 600;
  margin-top: 3px;
  padding: 1px 6px;
}

.field-location span {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 220px;
}

.location-pin {
  width: 11px;
  height: 11px;
  fill: #94a3b8;
  flex-shrink: 0;
}
</style>
