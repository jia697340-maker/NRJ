<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { Capacitor } from '@capacitor/core'
import type { CharacterAssetMeta } from '../../../types/chatAssets'
import { downloadCharacterAsset } from '../../../services/chatAssetOpen'
import { getChatFilePreviewCapability } from '../../../services/chatFilePreview'
import ChatFilePreviewModal from '../modals/ChatFilePreviewModal.vue'

const props = defineProps<{ msg: any; asset?: CharacterAssetMeta | null }>()
const busy = ref(false)
const error = ref('')
const previewVisible = ref(false)
const actionVisible = ref(false)
const actionDialog = ref<HTMLElement | null>(null)
const file = computed(() => props.asset || null)
const previewCapability = computed(() => file.value ? getChatFilePreviewCapability(file.value) : { supported: false, label: '文件' })
const nativePlatform = Capacitor.isNativePlatform()
const sizeText = computed(() => {
  const size = Number(props.msg?.fileData?.size || file.value?.size || 0)
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / 1024 / 1024).toFixed(1)} MB`
})
const extension = computed(() => String(props.msg?.fileData?.name || file.value?.name || 'FILE').split('.').pop()?.slice(0, 5).toUpperCase() || 'FILE')
const saveFile = async () => {
  if (!file.value || busy.value) return
  busy.value = true; error.value = ''
  try { await downloadCharacterAsset(file.value); actionVisible.value = false } catch (reason) { error.value = reason instanceof Error ? reason.message : '文件无法保存' }
  finally { busy.value = false }
}
const openActions = () => {
  if (!file.value) return
  error.value = ''; actionVisible.value = true
  void nextTick(() => actionDialog.value?.focus())
}
const previewFile = () => {
  if (!file.value || !previewCapability.value.supported) return
  actionVisible.value = false; previewVisible.value = true
}
</script>

<template>
  <div class="chat-file-bubble" :class="{ unavailable: !file }">
    <div class="chat-file-icon">{{ extension }}</div>
    <div class="chat-file-info">
      <div class="chat-file-name" :title="msg.fileData?.name">{{ msg.fileData?.name || '未命名文件' }}</div>
      <div class="chat-file-meta">{{ sizeText }}<span v-if="msg.fileData?.source === 'generated'"> · 角色生成</span></div>
      <div v-if="error" class="chat-file-error">{{ error }}</div>
    </div>
    <button class="chat-file-action" type="button" :disabled="!file" @click.stop="openActions">{{ file ? '查看' : '已丢失' }}</button>
  </div>
  <Teleport to="body">
    <div v-if="actionVisible" class="chat-file-action-overlay" @click.self="actionVisible = false">
      <section ref="actionDialog" class="chat-file-action-dialog" role="dialog" aria-modal="true" aria-labelledby="chat-file-action-title" tabindex="-1" @keydown.esc="actionVisible = false">
        <header>
          <div>
            <h3 id="chat-file-action-title" :title="msg.fileData?.name">{{ msg.fileData?.name || '文件' }}</h3>
            <p>{{ sizeText }}<span v-if="msg.fileData?.source === 'generated'"> · 角色生成</span></p>
          </div>
          <button type="button" aria-label="关闭" @click="actionVisible = false">×</button>
        </header>
        <div class="chat-file-action-choices">
          <button type="button" :disabled="!previewCapability.supported" @click="previewFile">
            <strong>预览</strong><span>{{ previewCapability.supported ? `在应用内查看${previewCapability.label}` : previewCapability.reason }}</span>
          </button>
          <button type="button" :disabled="busy" @click="saveFile">
            <strong>{{ busy ? '处理中…' : (nativePlatform ? '打开或保存' : '下载') }}</strong><span>{{ nativePlatform ? '使用系统面板保存、分享或用其他应用打开' : '保存原文件到电脑' }}</span>
          </button>
        </div>
        <p v-if="error" class="chat-file-action-error">{{ error }}</p>
      </section>
    </div>
  </Teleport>
  <ChatFilePreviewModal :visible="previewVisible" :asset="file" @close="previewVisible = false" />
</template>

<style scoped>
.chat-file-bubble{width:min(270px,72vw);display:flex;align-items:center;gap:9px;padding:11px 12px;border-radius:10px;background:var(--bubble-left-bg,var(--bg-secondary));color:var(--text-primary);box-sizing:border-box}.chat-file-bubble.unavailable{opacity:.72}.chat-file-icon{width:40px;height:46px;flex:0 0 40px;border:1px solid var(--border-color);border-radius:7px;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:var(--text-secondary);background:var(--bg-primary)}.chat-file-info{flex:1;min-width:0}.chat-file-name{font-size:14px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.chat-file-meta{font-size:11px;color:var(--text-secondary);margin-top:4px}.chat-file-error{font-size:10px;color:#c85d5d;margin-top:3px;line-height:1.25}.chat-file-action{flex:0 0 auto;border:1px solid var(--border-color);background:transparent;color:var(--text-primary);border-radius:6px;padding:5px 8px;font-size:11px;line-height:1;cursor:pointer}.chat-file-action:disabled{cursor:default;opacity:.55}.chat-file-action-overlay{position:fixed;inset:0;z-index:13015;display:grid;place-items:center;padding:16px;background:rgba(12,12,14,.42);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);box-sizing:border-box}.chat-file-action-dialog{box-sizing:border-box;width:min(340px,calc(100vw - 32px));outline:0;overflow:hidden;border:1px solid var(--border-color);border-radius:15px;background:var(--sys-bg-primary,var(--bg-primary,#fff));color:var(--text-primary,#222);box-shadow:0 20px 60px rgba(0,0,0,.22)}.chat-file-action-dialog header{min-width:0;display:flex;align-items:flex-start;gap:10px;padding:14px 15px 11px;border-bottom:1px solid var(--border-color)}.chat-file-action-dialog header>div{min-width:0;flex:1}.chat-file-action-dialog h3{margin:0;overflow:hidden;font-size:14px;font-weight:650;text-overflow:ellipsis;white-space:nowrap}.chat-file-action-dialog header p{margin:4px 0 0;color:var(--text-secondary,#888);font-size:10px}.chat-file-action-dialog header button{width:26px;height:26px;flex:none;padding:0;border:0;border-radius:50%;background:transparent;color:var(--text-secondary,#777);font-family:inherit;font-size:20px;line-height:24px;cursor:pointer}.chat-file-action-dialog header button:hover{background:var(--sys-bg-secondary,var(--bg-secondary,#f2f2f2))}.chat-file-action-choices{display:grid;gap:7px;padding:11px}.chat-file-action-choices button{min-width:0;display:flex;align-items:flex-start;flex-direction:column;gap:3px;padding:10px 11px;border:1px solid var(--border-color);border-radius:9px;background:transparent;color:inherit;text-align:left;font:inherit;cursor:pointer}.chat-file-action-choices button:hover:not(:disabled){background:var(--sys-bg-secondary,var(--bg-secondary,#f4f4f4))}.chat-file-action-choices button:disabled{cursor:default;opacity:.48}.chat-file-action-choices strong{font-size:12px;font-weight:650}.chat-file-action-choices span{max-width:100%;color:var(--text-secondary,#777);font-size:10px;line-height:1.45;overflow-wrap:anywhere}.chat-file-action-error{margin:0;padding:0 14px 12px;color:#bc5555;font-size:10px;line-height:1.4}@media(max-width:340px){.chat-file-bubble{width:min(244px,70vw);gap:7px;padding:9px}.chat-file-icon{width:36px;height:42px;flex-basis:36px}.chat-file-name{font-size:13px}.chat-file-meta{font-size:10px}.chat-file-action-dialog{width:calc(100vw - 24px)}.chat-file-action-dialog header{padding:12px 13px 10px}.chat-file-action-choices{padding:9px}}
</style>
