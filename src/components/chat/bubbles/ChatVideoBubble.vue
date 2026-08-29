<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import type { CharacterAssetMeta } from '../../../types/chatAssets'
import { createCharacterAssetObjectUrl, downloadCharacterAsset } from '../../../services/chatAssetOpen'

const props = defineProps<{ msg: any; asset?: CharacterAssetMeta | null }>()
const url = ref('')
const error = ref('')
const busy = ref(false)
const clearUrl = () => { if (url.value) URL.revokeObjectURL(url.value); url.value = '' }
const load = async () => {
  clearUrl(); error.value = ''
  if (!props.asset) { error.value = '真实视频资源已丢失'; return }
  try { url.value = await createCharacterAssetObjectUrl(props.asset) } catch (reason) { error.value = reason instanceof Error ? reason.message : '视频无法读取' }
}
const share = async () => {
  if (!props.asset || busy.value) return
  busy.value = true
  try { await downloadCharacterAsset(props.asset) } catch (reason) { error.value = reason instanceof Error ? reason.message : '视频无法保存' }
  finally { busy.value = false }
}
watch(() => props.asset?.id, () => void load(), { immediate: true })
onBeforeUnmount(clearUrl)
</script>

<template>
  <div class="chat-video-bubble">
    <video v-if="url" :src="url" controls playsinline preload="metadata" class="chat-video-player" @error="error = '视频解码失败'" />
    <div v-else class="chat-video-state">{{ error || '正在读取视频…' }}</div>
    <div class="chat-video-footer">
      <span :title="msg.videoData?.name">{{ msg.videoData?.name || '视频' }}</span>
      <button type="button" :disabled="!asset || busy" @click.stop="share">{{ busy ? '处理中' : '保存' }}</button>
    </div>
  </div>
</template>

<style scoped>
.chat-video-bubble{width:min(300px,74vw);overflow:hidden;border-radius:10px;background:#111;color:#fff}.chat-video-player{display:block;width:100%;max-height:360px;aspect-ratio:16/9;background:#000;object-fit:contain}.chat-video-state{min-height:148px;display:flex;align-items:center;justify-content:center;padding:18px;text-align:center;font-size:12px;color:rgba(255,255,255,.72)}.chat-video-footer{min-width:0;display:flex;align-items:center;gap:8px;padding:7px 9px;background:rgba(0,0,0,.72)}.chat-video-footer span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px}.chat-video-footer button{flex:0 0 auto;border:1px solid rgba(255,255,255,.28);border-radius:5px;background:transparent;color:#fff;padding:4px 7px;font-size:10px;cursor:pointer}.chat-video-footer button:disabled{opacity:.5;cursor:default}@media(max-width:340px){.chat-video-bubble{width:min(260px,72vw)}}
</style>
