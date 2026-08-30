<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { Capacitor } from '@capacitor/core'
import type { CharacterAssetMeta } from '../../../types/chatAssets'
import { downloadCharacterAsset } from '../../../services/chatAssetOpen'
import { getChatFilePreviewCapability, loadChatFilePreview, revokeChatFilePreview, type ChatFilePreviewResult } from '../../../services/chatFilePreview'

const props = defineProps<{ visible: boolean; asset: CharacterAssetMeta | null }>()
const emit = defineEmits<{ (event: 'close'): void }>()
const preview = ref<ChatFilePreviewResult | null>(null)
const loading = ref(false)
const saving = ref(false)
const error = ref('')
const forceLargePreview = ref(false)
const LARGE_FILE_BYTES = 20 * 1024 * 1024
const nativePlatform = Capacitor.isNativePlatform()
const capability = computed(() => props.asset ? getChatFilePreviewCapability(props.asset) : { supported: false, label: '文件' })
const needsLargeConfirmation = computed(() => Boolean(props.asset && props.asset.size > LARGE_FILE_BYTES && !forceLargePreview.value))
const sizeText = computed(() => {
  const size = Number(props.asset?.size || 0)
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / 1024 / 1024).toFixed(1)} MB`
})

const clearPreview = () => { revokeChatFilePreview(preview.value); preview.value = null }
const load = async (sheetIndex = 0) => {
  clearPreview(); error.value = ''
  if (!props.visible || !props.asset || needsLargeConfirmation.value || !capability.value.supported) return
  loading.value = true
  try { preview.value = await loadChatFilePreview(props.asset, sheetIndex) }
  catch (reason) { error.value = reason instanceof Error ? reason.message : '文件预览失败' }
  finally { loading.value = false }
}
const confirmLargePreview = () => { forceLargePreview.value = true; void load() }
const switchSheet = (index: number) => { if (index !== preview.value?.activeSheetIndex) void load(index) }
const save = async () => {
  if (!props.asset || saving.value) return
  saving.value = true
  try { await downloadCharacterAsset(props.asset) }
  catch (reason) { error.value = reason instanceof Error ? reason.message : '文件无法保存' }
  finally { saving.value = false }
}
const close = () => emit('close')
const onKeydown = (event: KeyboardEvent) => { if (props.visible && event.key === 'Escape') close() }

watch(() => [props.visible, props.asset?.id] as const, ([visible]) => {
  forceLargePreview.value = false
  window.removeEventListener('keydown', onKeydown)
  if (visible) { window.addEventListener('keydown', onKeydown); void load() }
  else clearPreview()
})
onBeforeUnmount(() => { window.removeEventListener('keydown', onKeydown); clearPreview() })
</script>

<template>
  <Teleport to="body">
    <div v-if="visible" class="file-preview-overlay" role="presentation" @click.self="close">
      <section class="file-preview-modal" role="dialog" aria-modal="true" aria-labelledby="file-preview-title">
        <header class="file-preview-header">
          <button class="file-preview-back" type="button" aria-label="关闭预览" @click="close">‹</button>
          <div class="file-preview-title-wrap">
            <h3 id="file-preview-title" :title="asset?.name">{{ asset?.name || '文件预览' }}</h3>
            <p>{{ capability.label }} · {{ sizeText }}</p>
          </div>
          <button class="file-preview-save" type="button" :disabled="!asset || saving" @click="save">{{ saving ? '处理中' : (nativePlatform ? '保存' : '下载') }}</button>
        </header>

        <nav v-if="preview?.kind === 'xlsx' && (preview.sheetNames?.length || 0) > 1" class="file-preview-sheets" aria-label="工作表">
          <button v-for="(name, index) in preview.sheetNames" :key="`${index}-${name}`" type="button" :class="{ active: index === preview.activeSheetIndex }" @click="switchSheet(index)">{{ name }}</button>
        </nav>

        <main class="file-preview-body" :class="preview ? `kind-${preview.kind}` : ''">
          <div v-if="needsLargeConfirmation" class="file-preview-state">
            <strong>这是一个较大的文件</strong>
            <p>文件大小为 {{ sizeText }}，加载预览可能需要一些时间和内存。你也可以直接下载原文件。</p>
            <button type="button" @click="confirmLargePreview">继续预览</button>
          </div>
          <div v-else-if="!capability.supported" class="file-preview-state">
            <strong>暂不支持应用内预览</strong>
            <p>{{ capability.reason }}</p>
            <button type="button" @click="save">{{ saving ? '处理中' : (nativePlatform ? '打开或保存' : '下载原文件') }}</button>
          </div>
          <div v-else-if="loading" class="file-preview-state"><span class="file-preview-spinner"></span><p>正在读取文件…</p></div>
          <div v-else-if="error" class="file-preview-state error"><strong>预览没有成功</strong><p>{{ error }}</p><button type="button" @click="load(preview?.activeSheetIndex || 0)">重新加载</button></div>
          <pre v-else-if="preview?.text !== undefined" class="file-preview-text">{{ preview.text }}</pre>
          <div v-else-if="preview?.rows" class="file-preview-table-wrap">
            <table class="file-preview-table">
              <tbody><tr v-for="(row, rowIndex) in preview.rows" :key="rowIndex"><component :is="rowIndex === 0 ? 'th' : 'td'" v-for="(cell, cellIndex) in row" :key="cellIndex" :title="cell">{{ cell }}</component></tr></tbody>
            </table>
            <p v-if="preview.truncated" class="file-preview-limit">预览仅显示前 300 行、60 列；下载原文件可查看全部内容。</p>
          </div>
          <iframe v-else-if="preview?.kind === 'pdf' && preview.objectUrl" class="file-preview-frame" :src="preview.objectUrl" title="PDF 文件预览"></iframe>
          <img v-else-if="preview?.kind === 'image' && preview.objectUrl" class="file-preview-image" :src="preview.objectUrl" :alt="asset?.name || '图片预览'">
          <audio v-else-if="preview?.kind === 'audio' && preview.objectUrl" class="file-preview-audio" :src="preview.objectUrl" controls preload="metadata"></audio>
          <video v-else-if="preview?.kind === 'video' && preview.objectUrl" class="file-preview-video" :src="preview.objectUrl" controls playsinline preload="metadata"></video>
        </main>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.file-preview-overlay{position:fixed;inset:0;z-index:13020;display:grid;place-items:center;padding:18px;background:rgba(12,12,14,.48);backdrop-filter:blur(5px);-webkit-backdrop-filter:blur(5px);box-sizing:border-box}.file-preview-modal{width:min(920px,96vw);height:min(760px,92vh);min-height:360px;display:flex;flex-direction:column;overflow:hidden;border:1px solid var(--border-color);border-radius:18px;background:var(--sys-bg-primary,var(--bg-primary,#fff));color:var(--text-primary,#222);box-shadow:0 24px 70px rgba(0,0,0,.24)}.file-preview-header{min-width:0;display:grid;grid-template-columns:34px minmax(0,1fr) auto;align-items:center;gap:9px;padding:12px 14px;border-bottom:1px solid var(--border-color)}.file-preview-back,.file-preview-save,.file-preview-sheets button,.file-preview-state button{border:1px solid var(--border-color);background:transparent;color:inherit;font:inherit;cursor:pointer}.file-preview-back{width:32px;height:32px;padding:0;border-color:transparent;border-radius:50%;font-size:27px;line-height:28px}.file-preview-back:hover{background:var(--sys-bg-secondary,var(--bg-secondary,#f3f3f3))}.file-preview-title-wrap{min-width:0}.file-preview-title-wrap h3{margin:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:14px;font-weight:650}.file-preview-title-wrap p{margin:3px 0 0;color:var(--text-secondary,#888);font-size:10px}.file-preview-save{flex:none;padding:6px 10px;border-radius:7px;font-size:11px}.file-preview-save:disabled{cursor:default;opacity:.5}.file-preview-sheets{display:flex;flex:none;gap:5px;overflow-x:auto;padding:7px 12px;border-bottom:1px solid var(--border-color);scrollbar-width:thin}.file-preview-sheets button{max-width:180px;flex:none;overflow:hidden;padding:5px 9px;border-color:transparent;border-radius:6px;color:var(--text-secondary,#777);font-size:10px;text-overflow:ellipsis;white-space:nowrap}.file-preview-sheets button.active{border-color:var(--border-color);background:var(--sys-bg-secondary,var(--bg-secondary,#f3f3f3));color:var(--text-primary,#222)}.file-preview-body{min-width:0;min-height:0;flex:1;display:flex;overflow:auto;background:var(--sys-bg-secondary,var(--bg-secondary,#f6f6f6))}.file-preview-state{width:min(390px,82%);margin:auto;text-align:center;color:var(--text-secondary,#777)}.file-preview-state strong{display:block;margin-bottom:7px;color:var(--text-primary,#222);font-size:14px}.file-preview-state p{margin:0 auto 13px;font-size:11px;line-height:1.6}.file-preview-state button{padding:7px 12px;border-radius:7px;font-size:11px}.file-preview-state.error strong{color:#b94f4f}.file-preview-spinner{display:block;width:22px;height:22px;margin:0 auto 9px;border:2px solid color-mix(in srgb,var(--text-secondary) 22%,transparent);border-top-color:var(--text-secondary);border-radius:50%;animation:file-preview-spin .8s linear infinite}.file-preview-text{box-sizing:border-box;width:100%;min-height:100%;margin:0;padding:20px 22px;background:var(--sys-bg-primary,var(--bg-primary,#fff));color:var(--text-primary,#222);font:12px/1.75 ui-monospace,SFMono-Regular,Consolas,"Liberation Mono",monospace;tab-size:2;white-space:pre-wrap;overflow-wrap:anywhere}.file-preview-table-wrap{min-width:100%;height:max-content;background:var(--sys-bg-primary,var(--bg-primary,#fff))}.file-preview-table{border-spacing:0;border-collapse:separate;min-width:100%;font-size:11px}.file-preview-table th,.file-preview-table td{max-width:280px;padding:7px 9px;border-right:1px solid var(--border-color);border-bottom:1px solid var(--border-color);overflow:hidden;text-align:left;text-overflow:ellipsis;white-space:nowrap}.file-preview-table th{position:sticky;top:0;z-index:1;background:var(--sys-bg-secondary,var(--bg-secondary,#f2f2f2));font-weight:650}.file-preview-table tr>*:first-child{position:sticky;left:0;background:var(--sys-bg-primary,var(--bg-primary,#fff))}.file-preview-table tr:first-child>*:first-child{z-index:2;background:var(--sys-bg-secondary,var(--bg-secondary,#f2f2f2))}.file-preview-limit{position:sticky;left:0;margin:0;padding:9px 12px;color:var(--text-secondary,#777);font-size:10px}.file-preview-frame{width:100%;height:100%;border:0;background:#fff}.file-preview-image{max-width:100%;max-height:100%;margin:auto;object-fit:contain}.file-preview-audio{width:min(520px,86%);margin:auto}.file-preview-video{width:100%;height:100%;background:#000;object-fit:contain}@keyframes file-preview-spin{to{transform:rotate(360deg)}}@media(max-width:600px){.file-preview-overlay{align-items:end;padding:0}.file-preview-modal{width:100%;height:100%;max-height:none;border:0;border-radius:0}.file-preview-header{padding:calc(8px + env(safe-area-inset-top)) 10px 8px}.file-preview-text{padding:15px 13px calc(18px + env(safe-area-inset-bottom));font-size:11px}.file-preview-table th,.file-preview-table td{max-width:210px;padding:6px 8px}.file-preview-save{padding:6px 8px}}@media(max-width:340px){.file-preview-header{grid-template-columns:30px minmax(0,1fr) auto;gap:6px}.file-preview-back{width:29px;height:29px}.file-preview-title-wrap h3{font-size:13px}.file-preview-save{font-size:10px}}@media(prefers-reduced-motion:reduce){.file-preview-spinner{animation:none}}
</style>
