<script setup lang="ts">
import { computed, ref } from 'vue'
import type { CharacterAssetMeta } from '../../../types/chatAssets'
import { downloadCharacterAsset } from '../../../services/chatAssetOpen'

const props = defineProps<{ msg: any; asset?: CharacterAssetMeta | null }>()
const busy = ref(false)
const error = ref('')
const file = computed(() => props.asset || null)
const sizeText = computed(() => {
  const size = Number(props.msg?.fileData?.size || file.value?.size || 0)
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / 1024 / 1024).toFixed(1)} MB`
})
const extension = computed(() => String(props.msg?.fileData?.name || file.value?.name || 'FILE').split('.').pop()?.slice(0, 5).toUpperCase() || 'FILE')
const openFile = async () => {
  if (!file.value || busy.value) return
  busy.value = true; error.value = ''
  try { await downloadCharacterAsset(file.value) } catch (reason) { error.value = reason instanceof Error ? reason.message : '文件无法打开' }
  finally { busy.value = false }
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
    <button class="chat-file-action" type="button" :disabled="!file || busy" @click.stop="openFile">{{ busy ? '处理中' : file ? '打开' : '已丢失' }}</button>
  </div>
</template>

<style scoped>
.chat-file-bubble{width:min(270px,72vw);display:flex;align-items:center;gap:10px;padding:11px 12px;border-radius:10px;background:var(--bubble-left-bg,var(--bg-secondary));color:var(--text-primary);box-sizing:border-box}.chat-file-bubble.unavailable{opacity:.72}.chat-file-icon{width:40px;height:46px;flex:0 0 40px;border:1px solid var(--border-color);border-radius:7px;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:var(--text-secondary);background:var(--bg-primary)}.chat-file-info{flex:1;min-width:0}.chat-file-name{font-size:14px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.chat-file-meta{font-size:11px;color:var(--text-secondary);margin-top:4px}.chat-file-error{font-size:10px;color:#c85d5d;margin-top:3px;line-height:1.25}.chat-file-action{flex:0 0 auto;max-width:58px;border:1px solid var(--border-color);background:transparent;color:var(--text-primary);border-radius:6px;padding:5px 8px;font-size:11px;line-height:1;cursor:pointer}.chat-file-action:disabled{cursor:default;opacity:.55}@media(max-width:340px){.chat-file-bubble{width:min(244px,70vw);gap:8px;padding:9px}.chat-file-icon{width:36px;height:42px;flex-basis:36px}.chat-file-action{padding:5px 6px}}
</style>
