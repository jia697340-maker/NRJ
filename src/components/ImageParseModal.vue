/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { ref } from 'vue'
import { readImageMetadata, metadataToGenerationParams } from '../composables/useImageMetadata'
import { sendChatMessage } from '../services/api'

const emit = defineEmits<{ (e: 'close'): void; (e: 'apply', params: any, image: string): void }>()
const fileInput = ref<HTMLInputElement | null>(null)
const image = ref('')
const fileBlob = ref<Blob | null>(null)
const metadata = ref<any>(null)
const analysis = ref('')
const busy = ref(false)
const error = ref('')

const upload = () => fileInput.value?.click()
const onFile = async (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  image.value = await new Promise<string>((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(String(r.result)); r.onerror = reject; r.readAsDataURL(file) })
  fileBlob.value = file
  error.value = ''
  try { metadata.value = await readImageMetadata(file) } catch { metadata.value = null }
}
const analyze = async () => {
  if (!image.value) return
  busy.value = true; error.value = ''
  try {
    const result: any = await sendChatMessage([{ role: 'user', content: [{ type: 'text', text: 'Analyze this image for NovelAI image generation. Reply in Chinese with a short visual breakdown, then strict JSON only in a code block: {"positive_en":"comma separated English tags","negative_en":"comma separated English negative tags","width":number,"height":number}. Do not claim you know its original seed or prompt.' }, { type: 'image_url', image_url: { url: image.value } }] }], undefined, false, true)
    analysis.value = typeof result === 'string' ? result : result.content || ''
  } catch (e: any) { error.value = e.message || '图片分析失败：请确认当前聊天模型支持视觉输入。' } finally { busy.value = false }
}
const apply = () => {
  if (!image.value) return
  const parsed = metadataToGenerationParams(metadata.value?.novelAi)
  if (parsed) emit('apply', parsed, image.value)
  else {
    const json = analysis.value.match(/\{[\s\S]*\}/)?.[0]
    try { const p = JSON.parse(json || ''); emit('apply', { input: p.positive_en || '', negative_prompt: p.negative_en || '', width: p.width, height: p.height }, image.value) } catch { error.value = '还没有可载入的参数；请先解析图片。' }
  }
}
</script>
<template>
  <div class="modal-overlay" style="z-index:30000" @click.self="emit('close')">
    <div class="modal-content">
      <div class="modal-header">
        <button class="nav-btn cancel-btn" @click="emit('close')">取消</button>
        <span class="nav-title">图片解析与反推</span>
        <button class="nav-btn done-btn" :class="{ disabled: !image }" @click="apply">载入</button>
      </div>
      
      <div class="modal-body">
        <p class="desc-text">PNG 元数据只在本地读取；普通图片会发送给配置的视觉模型。</p>
        
        <input ref="fileInput" type="file" accept="image/*" hidden @change="onFile" />
        <div class="upload-area" @click="upload" :class="{'has-image': image}">
          <div v-if="!image" class="upload-placeholder">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:#999;margin-bottom:8px"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
            <span>点击选择图片</span>
          </div>
          <img v-else :src="image" class="preview-image" />
        </div>
        
        <div v-if="metadata?.novelAi" class="info-box success">
          <div class="info-title">检测到 NovelAI PNG 参数：</div>
          <div class="info-content">{{ metadataToGenerationParams(metadata.novelAi)?.input }}</div>
        </div>
        <div v-else-if="image" class="info-box neutral">
          未发现可复现的参数，可使用视觉反推。
        </div>
        
        <button v-if="image && !metadata?.novelAi" class="action-btn" :disabled="busy" @click="analyze">
          <span v-if="busy" class="spinner"></span>
          {{ busy ? '解析中…' : '✨ 视觉反推' }}
        </button>
        
        <pre v-if="analysis" class="analysis-result">{{ analysis }}</pre>
        <div v-if="error" class="error-msg">{{ error }}</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(4px);
  display: flex;
  justify-content: center;
  align-items: center;
  animation: fadeIn 0.2s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.modal-content {
  background: var(--sys-bg-secondary, #fff);
  border-radius: 20px;
  width: 90%;
  max-width: 400px;
  box-shadow: 0 24px 48px rgba(0,0,0,0.15);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: slideUp 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

@keyframes slideUp {
  from { transform: translateY(20px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color, #eee);
  background: var(--sys-bg-primary, #fff);
}

.nav-btn {
  background: none;
  border: none;
  font-size: 16px;
  cursor: pointer;
  padding: 0;
  transition: opacity 0.2s;
}

.nav-btn.disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.nav-btn:active:not(.disabled) {
  opacity: 0.5;
}

.cancel-btn {
  color: var(--text-tertiary, #8e8e93);
  font-weight: 400;
}

.done-btn {
  color: var(--theme-color, #007aff);
  font-weight: 600;
}

.nav-title {
  font-size: 17px;
  font-weight: 600;
  color: var(--text-primary, #000);
  letter-spacing: -0.4px;
}

.modal-body {
  padding: 20px;
  max-height: 70vh;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  background: var(--sys-bg-secondary, #f2f2f7);
}

.modal-body::-webkit-scrollbar {
  display: none;
}

.desc-text {
  font-size: 13px; color: var(--text-secondary, #666); line-height: 1.5; margin: 0 0 16px 0; text-align: center;
}
.upload-area {
  border: 2px dashed var(--border-color, #d1d1d6); border-radius: 16px; padding: 24px; text-align: center;
  cursor: pointer; transition: all 0.2s ease; background: var(--sys-bg-primary, #fff);
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  min-height: 160px; margin-bottom: 16px; overflow: hidden;
}
.upload-area:hover { border-color: var(--theme-color, #007aff); background: rgba(0, 122, 255, 0.05); }
.upload-area.has-image { padding: 8px; border-style: solid; border-color: transparent; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
.upload-placeholder { display: flex; flex-direction: column; align-items: center; color: var(--text-tertiary, #999); font-size: 14px; font-weight: 500; }
.preview-image { max-width: 100%; max-height: 240px; border-radius: 10px; object-fit: contain; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
.info-box { padding: 14px; border-radius: 12px; font-size: 13px; line-height: 1.5; margin-bottom: 16px; box-shadow: 0 2px 6px rgba(0,0,0,0.02); }
.info-box.success { background: #f0fdf4; color: #166534; border: 1px solid #bbf7d0; }
.info-box.neutral { background: var(--sys-bg-primary, #fff); color: var(--text-secondary, #666); text-align: center; border: 1px solid var(--border-color, #eee); }
.info-title { font-weight: 600; margin-bottom: 6px; }
.info-content { white-space: pre-wrap; word-break: break-all; opacity: 0.9; font-family: ui-monospace, SFMono-Regular, monospace; font-size: 12px; }
.action-btn {
  width: 100%; padding: 14px; border-radius: 12px; border: none; background: #2c2c2e; color: #fff;
  font-size: 16px; font-weight: 600; cursor: pointer; transition: all 0.2s; margin-bottom: 16px;
  display: flex; align-items: center; justify-content: center; gap: 8px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}
.action-btn:active:not(:disabled) { transform: scale(0.97); }
.action-btn:disabled { background: var(--border-color, #ccc); color: var(--text-secondary, #888); box-shadow: none; cursor: not-allowed; }
.analysis-result {
  background: #1c1c1e; color: #e5e5ea; padding: 16px; border-radius: 12px; font-size: 13px;
  line-height: 1.6; white-space: pre-wrap; max-height: 200px; overflow-y: auto; margin: 0 0 16px 0;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  box-shadow: inset 0 2px 10px rgba(0,0,0,0.2);
}
.error-msg {
  color: #ff3b30; font-size: 13px; text-align: center; background: #ffeceb; padding: 12px; border-radius: 12px; margin-bottom: 16px;
  font-weight: 500;
}
.spinner {
  width: 18px; height: 18px; border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff;
  border-radius: 50%; animation: spin 0.8s linear infinite;
}
@keyframes spin { 100% { transform: rotate(360deg); } }
</style>
