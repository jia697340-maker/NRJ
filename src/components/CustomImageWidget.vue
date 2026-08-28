<!-- WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ -->
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import AvatarUploadModal from './AvatarUploadModal.vue'
import { defaultWidgetConfig, useWidgetInstances, type CustomImageWidgetConfig } from '../composables/useWidgetInstances'

const props = defineProps<{ instanceId: string; editing?: boolean }>()
const { records, updateConfig } = useWidgetInstances()
const defaults = defaultWidgetConfig('custom-image') as CustomImageWidgetConfig
const config = computed(() => ({ ...defaults, ...(records[props.instanceId]?.config as Partial<CustomImageWidgetConfig> | undefined) }))
const modalVisible = ref(false)
const draft = ref<CustomImageWidgetConfig>({ ...defaults })
const loadFailed = ref(false)
const urlCaching = ref(false)
const focusOptions = ['0% 0%', '50% 0%', '100% 0%', '0% 50%', '50% 50%', '100% 50%', '0% 100%', '50% 100%', '100% 100%']
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
  const next: CustomImageWidgetConfig = {
    ...draft.value,
    imageSourceType: value ? (isLocal ? 'local' : 'url') : null,
    imageValue: value,
    cachedImageValue: null
  }
  await updateConfig<CustomImageWidgetConfig>(props.instanceId, next)
  loadFailed.value = false

  if (!value || isLocal) return
  urlCaching.value = true
  try {
    const response = await fetch(value, { mode: 'cors', credentials: 'omit' })
    if (response.ok) {
      const cachedImageValue = await optimizeRemoteImage(await response.blob())
      await updateConfig<CustomImageWidgetConfig>(props.instanceId, { cachedImageValue })
    }
  } catch {
    // 跨域不允许缓存时保留原 URL，仍可由浏览器直接显示。
  } finally {
    urlCaching.value = false
  }
}
</script>

<template>
  <button type="button" class="custom-image-widget" :class="{ empty: !config.imageValue }" :style="{ borderRadius: `${config.borderRadius}%` }" @click="openEditor">
    <img v-if="displayedImage" :src="displayedImage" alt="自定义图片" :style="{ objectFit: config.objectFit, objectPosition: config.objectPosition }" @error="loadFailed = true" @load="loadFailed = false" />
    <span v-if="!displayedImage" class="empty-content"><b>＋</b><small>添加图片</small></span>
    <span v-else-if="loadFailed" class="load-error"><b>!</b><small>图片加载失败</small></span>
    <span v-if="urlCaching" class="cache-hint">正在缓存图片…</span>
  </button>

  <AvatarUploadModal
    v-model:visible="modalVisible"
    title="设置图片"
    shape="square"
    :current-avatar="config.imageValue"
    :preview-fit="draft.objectFit"
    :preview-position="draft.objectPosition"
    :preview-radius="draft.borderRadius"
    @saved="handleImageSaved"
  >
    <template #extra>
      <div class="custom-settings">
        <div class="setting-row"><span>显示方式</span><div><button type="button" :class="{ active: draft.objectFit === 'cover' }" @click="draft.objectFit = 'cover'">填满裁剪</button><button type="button" :class="{ active: draft.objectFit === 'contain' }" @click="draft.objectFit = 'contain'">完整显示</button></div></div>
        <div class="focus-setting"><span>裁剪焦点</span><div><button v-for="position in focusOptions" :key="position" type="button" :class="{ active: draft.objectPosition === position }" :aria-label="`焦点 ${position}`" @click="draft.objectPosition = position"></button></div></div>
        <label class="range-row"><span>圆角</span><input v-model.number="draft.borderRadius" type="range" min="0" max="30" step="1" /><b>{{ draft.borderRadius }}%</b></label>
      </div>
    </template>
  </AvatarUploadModal>
</template>

<style scoped>
.custom-image-widget { width: 100%; height: auto; max-height: 100%; aspect-ratio: 1; padding: 0; border: 0; overflow: hidden; position: absolute; top: 50%; transform: translateY(-50%); display: block; background: transparent; color: var(--text-primary); }
.custom-image-widget img { width: 100%; height: 100%; display: block; }
.custom-image-widget.empty { border: 1px dashed color-mix(in srgb, var(--text-secondary) 45%, transparent); background: color-mix(in srgb, var(--card-bg-solid) 42%, transparent); }
.empty-content,.load-error { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; color: var(--text-secondary); }
.empty-content b,.load-error b { font-size: 25px; font-weight: 300; line-height: 1; }
.empty-content small,.load-error small { font-size: 11px; }
.load-error { background: color-mix(in srgb, var(--card-bg-solid) 90%, transparent); color: #c95b56; }
.cache-hint { position: absolute; inset: auto 6px 6px; padding: 4px 6px; border-radius: 7px; background: rgba(30,30,32,.72); color: #fff; font-size: 10px; }
.custom-settings { display: flex; flex-direction: column; gap: 16px; }
.setting-row > span,.focus-setting > span { display: block; margin-bottom: 7px; color: var(--text-secondary); font-size: 12px; }
.setting-row > div { display: flex; gap: 8px; }
.setting-row button { min-height: 36px; padding: 0 13px; border: 0; border-radius: 12px; background: var(--sys-bg-primary); color: var(--text-primary); font: inherit; font-size: 13px; }
.setting-row button.active { background: var(--text-primary); color: var(--sys-bg-primary); }
.focus-setting > div { width: 76px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 5px; }
.focus-setting button { width: 22px; height: 22px; padding: 0; border: 1px solid var(--border-color); border-radius: 7px; background: var(--sys-bg-primary); }
.focus-setting button.active { background: var(--text-primary); box-shadow: inset 0 0 0 6px var(--text-primary); }
.range-row { display: grid; grid-template-columns: 46px 1fr 38px; align-items: center; gap: 9px; color: var(--text-secondary); font-size: 12px; }
.range-row input { width: 100%; accent-color: var(--text-primary); }
.range-row b { color: var(--text-primary); font-size: 12px; text-align: right; }
</style>
