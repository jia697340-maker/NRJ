<!-- WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ -->
<script setup lang="ts">
import { ref } from 'vue'
import {
  importBubblePresetFile,
  importBubbleQrPayload,
  type BubblePreset
} from '../../../services/bubbleWorkshop'

defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
  imported: [presets: BubblePreset[]]
  toast: [msg: string]
}>()

const fileInput = ref<HTMLInputElement | null>(null)
const qrImageInput = ref<HTMLInputElement | null>(null)
const importCode = ref('')
const busy = ref(false)

const handleFileSelect = async (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return

  try {
    busy.value = true
    const result = await importBubblePresetFile(file)
    emit('update:visible', false)
    emit('imported', result)
    emit('toast', `成功导入 ${result.length} 个气泡方案`)
  } catch (err: any) {
    emit('toast', err?.message || '解析方案文件失败')
  } finally {
    busy.value = false
  }
}

const handleImportCode = async () => {
  const code = importCode.value.trim()
  if (!code) return

  try {
    busy.value = true
    const result = await importBubbleQrPayload(code)
    emit('update:visible', false)
    importCode.value = ''
    emit('imported', result)
    emit('toast', `成功导入气泡方案「${result[0]?.name || ''}」`)
  } catch (err: any) {
    emit('toast', err?.message || '分享代码或口令无效')
  } finally {
    busy.value = false
  }
}

const handleQrImageSelect = async (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return

  try {
    busy.value = true
    const Detector = (window as any).BarcodeDetector
    if (!Detector) {
      throw new Error('当前环境不支持直接识别二维码图片，请使用口令粘贴导入')
    }
    const bitmap = await createImageBitmap(file)
    const results = await new Detector({ formats: ['qr_code'] }).detect(bitmap)
    if (!results[0]?.rawValue) {
      throw new Error('未能从图片中识别到气泡二维码')
    }
    importCode.value = results[0].rawValue
    await handleImportCode()
  } catch (err: any) {
    emit('toast', err?.message || '二维码识别失败')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div v-if="visible" class="bw-import-backdrop" @click.self="emit('update:visible', false)">
    <div class="bw-import-modal">
      <header class="bw-import-header">
        <div>
          <h3>导入气泡方案</h3>
          <span>支持导入方案文件、扫描二维码或粘贴分享口令</span>
        </div>
        <button class="bw-import-close" @click="emit('update:visible', false)">×</button>
      </header>

      <div class="bw-import-body">
        <div class="bw-import-card-btn" @click="fileInput?.click()">
          <div class="bw-import-icon file">
            <svg viewBox="0 0 24 24"><path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z" stroke="currentColor" stroke-width="2" fill="none"/><polyline points="13 2 13 9 20 9" stroke="currentColor" stroke-width="2" fill="none"/></svg>
          </div>
          <div class="bw-import-text">
            <strong>从方案文件导入</strong>
            <p>支持 .nrjbubble 完整包、.zip 工程包、.json 文件</p>
          </div>
        </div>

        <div class="bw-import-card-btn" @click="qrImageInput?.click()">
          <div class="bw-import-icon qr">
            <svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" stroke="currentColor" stroke-width="2" fill="none"/><rect x="14" y="3" width="7" height="7" stroke="currentColor" stroke-width="2" fill="none"/><rect x="14" y="14" width="7" height="7" stroke="currentColor" stroke-width="2" fill="none"/><rect x="3" y="14" width="7" height="7" stroke="currentColor" stroke-width="2" fill="none"/></svg>
          </div>
          <div class="bw-import-text">
            <strong>识别二维码图片</strong>
            <p>从本地相册选择包含气泡方案的二维码截图</p>
          </div>
        </div>

        <div class="bw-code-box">
          <label>粘贴分享口令 / 二维码文本</label>
          <textarea
            v-model="importCode"
            placeholder="在此粘贴以 nrjbubble: 开头的分享字符串..."
            rows="3"
          />
          <button
            class="bw-btn-import-code"
            :disabled="!importCode.trim() || busy"
            @click="handleImportCode"
          >
            {{ busy ? '正在导入...' : '导入分享口令' }}
          </button>
        </div>
      </div>
    </div>

    <input ref="fileInput" type="file" accept=".nrjbubble,.json,.zip" hidden @change="handleFileSelect" />
    <input ref="qrImageInput" type="file" accept="image/*" hidden @change="handleQrImageSelect" />
  </div>
</template>

<style scoped>
.bw-import-backdrop {
  position: fixed;
  inset: 0;
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(15, 23, 42, 0.6);
  backdrop-filter: blur(8px);
  padding: 16px;
  animation: bwFadeIn 0.2s ease-out;
}
.bw-import-modal {
  width: min(500px, 100%);
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  background: var(--sys-bg-secondary, #ffffff);
  border-radius: 20px;
  box-shadow: 0 25px 60px -12px rgba(0, 0, 0, 0.25);
  overflow: hidden;
  border: 1px solid var(--border-color, rgba(0, 0, 0, 0.08));
}
.bw-import-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 22px;
  border-bottom: 1px solid var(--border-color, rgba(0, 0, 0, 0.06));
}
.bw-import-header h3 {
  margin: 0;
  font-size: 17px;
  font-weight: 700;
  color: var(--text-primary, #1e293b);
}
.bw-import-header span {
  font-size: 12px;
  color: var(--text-tertiary, #94a3b8);
  margin-top: 3px;
  display: block;
}
.bw-import-close {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: var(--sys-bg-primary, #f1f5f9);
  color: var(--text-secondary, #64748b);
  border: none;
  font-size: 18px;
  cursor: pointer;
}
.bw-import-body {
  padding: 20px 22px 24px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.bw-import-card-btn {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 16px;
  background: var(--sys-bg-primary, #f8fafc);
  border: 1.5px solid var(--border-color, rgba(0, 0, 0, 0.06));
  border-radius: 14px;
  cursor: pointer;
  transition: all 0.2s;
}
.bw-import-card-btn:hover {
  transform: translateY(-2px);
  border-color: color-mix(in srgb, var(--bw-accent, #4f7cff) 40%, transparent);
}
.bw-import-icon {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  display: grid;
  place-items: center;
  flex-shrink: 0;
}
.bw-import-icon.file {
  background: #e0e7ff;
  color: #4338ca;
}
.bw-import-icon.qr {
  background: #fef3c7;
  color: #b45309;
}
.bw-import-icon svg {
  width: 22px;
  height: 22px;
}
.bw-import-text strong {
  display: block;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary, #1e293b);
}
.bw-import-text p {
  margin: 3px 0 0;
  font-size: 12px;
  color: var(--text-tertiary, #94a3b8);
}
.bw-code-box {
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.bw-code-box label {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary, #64748b);
}
.bw-code-box textarea {
  width: 100%;
  padding: 10px 12px;
  background: var(--sys-bg-primary, #f8fafc);
  border: 1px solid var(--border-color, rgba(0, 0, 0, 0.08));
  border-radius: 12px;
  font-size: 13px;
  font-family: Consolas, monospace;
  color: var(--text-primary, #1e293b);
  outline: none;
  resize: vertical;
}
.bw-code-box textarea:focus {
  border-color: var(--bw-accent, #4f7cff);
  background: #fff;
}
.bw-btn-import-code {
  height: 38px;
  background: var(--bw-accent, #4f7cff);
  color: #fff;
  border: none;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}
.bw-btn-import-code:disabled {
  opacity: 0.5;
}
@keyframes bwFadeIn {
  from { opacity: 0; transform: scale(0.98); }
  to { opacity: 1; transform: scale(1); }
}
</style>
