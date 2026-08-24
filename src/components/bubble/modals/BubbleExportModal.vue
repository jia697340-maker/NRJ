<!-- WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ -->
<script setup lang="ts">
import { computed, ref } from 'vue'
import QRCode from 'qrcode'
import {
  createBubbleQrPayload,
  exportBubblePresetBlob,
  type BubbleExportFormat,
  type BubblePreset
} from '../../../services/bubbleWorkshop'

const props = defineProps<{
  preset: BubblePreset
  visible: boolean
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
  toast: [msg: string]
}>()

const exportFormat = ref<BubbleExportFormat>('nrjbubble')
const busy = ref(false)
const qrDataUrl = ref('')
const qrComplete = ref(true)
const shareCode = ref('')

const formatOptions: { id: BubbleExportFormat; name: string; desc: string }[] = [
  { id: 'nrjbubble', name: 'NRJ 完整方案 (.nrjbubble)', desc: '推荐格式，完整保留所有图片素材与精细调节参数' },
  { id: 'zip', name: '开放工程 ZIP 包 (.zip)', desc: '可解压查看原始素材与配置结构，亦可直接导入' },
  { id: 'json-full', name: '完整 JSON (.json)', desc: '素材全量转为 Base64 嵌入单个 JSON，便于文本传输' },
  { id: 'json-light', name: '纯样式轻量 JSON (.json)', desc: '仅含样式参数与补充 CSS，体积极小（不含图片）' }
]

const safeFilename = computed(() => (props.preset.name || '气泡方案').replace(/[\\/:*?"<>|]/g, '-'))

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const handleExport = async () => {
  try {
    busy.value = true
    const blob = await exportBubblePresetBlob(props.preset, exportFormat.value)
    const ext = exportFormat.value === 'nrjbubble' ? 'nrjbubble' : exportFormat.value === 'zip' ? 'zip' : 'json'
    downloadBlob(blob, `${safeFilename.value}.${ext}`)
    emit('toast', `已成功导出 ${safeFilename.value}.${ext}`)
  } catch (error: any) {
    emit('toast', error?.message || '导出方案失败')
  } finally {
    busy.value = false
  }
}

const generateQr = async () => {
  try {
    busy.value = true
    const result = await createBubbleQrPayload(props.preset)
    shareCode.value = result.payload
    qrComplete.value = result.complete
    qrDataUrl.value = await QRCode.toDataURL(result.payload, {
      width: 280,
      margin: 2,
      errorCorrectionLevel: 'L',
      color: { dark: '#0f172a', light: '#ffffff' }
    })
  } catch (error: any) {
    emit('toast', error?.message || '生成分享二维码失败')
  } finally {
    busy.value = false
  }
}

const saveQr = () => {
  if (!qrDataUrl.value) return
  const a = document.createElement('a')
  a.href = qrDataUrl.value
  a.download = `${safeFilename.value}-气泡分享码.png`
  a.click()
  emit('toast', '二维码已保存到本地')
}

const copyShareCode = async () => {
  try {
    await navigator.clipboard.writeText(shareCode.value)
    emit('toast', '分享代码已复制到剪贴板')
  } catch {
    emit('toast', '未能自动复制，请手动长按复制')
  }
}
</script>

<template>
  <div v-if="visible" class="bw-export-backdrop" @click.self="emit('update:visible', false)">
    <div class="bw-export-modal">
      <header class="bw-export-header">
        <div>
          <h3>分享与导出气泡</h3>
          <span>将「{{ preset.name }}」导出为方案文件或二维码分享给好友</span>
        </div>
        <button class="bw-export-close" @click="emit('update:visible', false)">×</button>
      </header>

      <div class="bw-export-body">
        <label class="bw-export-section-title">选择方案导出格式</label>
        <div class="bw-format-list">
          <div
            v-for="fmt in formatOptions"
            :key="fmt.id"
            class="bw-format-item"
            :class="{ active: exportFormat === fmt.id }"
            @click="exportFormat = fmt.id"
          >
            <div class="bw-format-radio">
              <span v-if="exportFormat === fmt.id" />
            </div>
            <div class="bw-format-text">
              <strong>{{ fmt.name }}</strong>
              <p>{{ fmt.desc }}</p>
            </div>
          </div>
        </div>

        <button class="bw-btn-export-main" :disabled="busy" @click="handleExport">
          {{ busy ? '正在生成...' : '立即导出方案文件' }}
        </button>

        <div class="bw-qr-wrapper">
          <div class="bw-qr-head">
            <div>
              <strong>生成分享二维码 / 字符口令</strong>
              <small>支持通过相机扫码或粘贴口令直接恢复气泡方案</small>
            </div>
            <button class="bw-btn-gen-qr" :disabled="busy" @click="generateQr">
              {{ qrDataUrl ? '刷新二维码' : '生成二维码' }}
            </button>
          </div>

          <div v-if="qrDataUrl" class="bw-qr-preview-box">
            <img :src="qrDataUrl" alt="气泡二维码" />
            <div class="bw-qr-status-tag" :class="{ warning: !qrComplete }">
              {{ qrComplete ? '✅ 完整方案（含素材）' : '⚠️ 轻量方案（素材过大，仅含参数）' }}
            </div>
            <div class="bw-qr-actions">
              <button class="bw-qr-btn" @click="saveQr">保存图片</button>
              <button class="bw-qr-btn" @click="copyShareCode">复制口令</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.bw-export-backdrop {
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
.bw-export-modal {
  width: min(560px, 100%);
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  background: var(--sys-bg-secondary, #ffffff);
  border-radius: 20px;
  box-shadow: 0 25px 60px -12px rgba(0, 0, 0, 0.25);
  overflow: hidden;
  border: 1px solid var(--border-color, rgba(0, 0, 0, 0.08));
}
.bw-export-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 22px;
  border-bottom: 1px solid var(--border-color, rgba(0, 0, 0, 0.06));
}
.bw-export-header h3 {
  margin: 0;
  font-size: 17px;
  font-weight: 700;
  color: var(--text-primary, #1e293b);
}
.bw-export-header span {
  font-size: 12px;
  color: var(--text-tertiary, #94a3b8);
  margin-top: 3px;
  display: block;
}
.bw-export-close {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: var(--sys-bg-primary, #f1f5f9);
  color: var(--text-secondary, #64748b);
  border: none;
  font-size: 18px;
  cursor: pointer;
}
.bw-export-body {
  flex: 1;
  overflow-y: auto;
  padding: 18px 22px 24px;
}
.bw-export-section-title {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary, #64748b);
  margin-bottom: 10px;
}
.bw-format-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 14px;
}
.bw-format-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 14px;
  background: var(--sys-bg-primary, #f8fafc);
  border: 1.5px solid var(--border-color, rgba(0, 0, 0, 0.06));
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s;
}
.bw-format-item:hover {
  border-color: color-mix(in srgb, var(--bw-accent, #4f7cff) 40%, transparent);
}
.bw-format-item.active {
  border-color: var(--bw-accent, #4f7cff);
  background: color-mix(in srgb, var(--bw-accent, #4f7cff) 4%, #fff);
}
.bw-format-radio {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 2px solid var(--border-color, #cbd5e1);
  display: grid;
  place-items: center;
  margin-top: 2px;
  flex-shrink: 0;
}
.bw-format-item.active .bw-format-radio {
  border-color: var(--bw-accent, #4f7cff);
}
.bw-format-radio span {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--bw-accent, #4f7cff);
}
.bw-format-text strong {
  display: block;
  font-size: 14px;
  color: var(--text-primary, #1e293b);
  font-weight: 600;
}
.bw-format-text p {
  margin: 3px 0 0;
  font-size: 12px;
  color: var(--text-tertiary, #94a3b8);
  line-height: 1.4;
}
.bw-btn-export-main {
  width: 100%;
  height: 42px;
  background: var(--bw-accent, #4f7cff);
  color: #fff;
  border: none;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}
.bw-btn-export-main:disabled {
  opacity: 0.6;
}
.bw-qr-wrapper {
  margin-top: 20px;
  padding-top: 18px;
  border-top: 1px solid var(--border-color, rgba(0, 0, 0, 0.08));
}
.bw-qr-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.bw-qr-head strong {
  display: block;
  font-size: 14px;
  color: var(--text-primary, #1e293b);
}
.bw-qr-head small {
  font-size: 12px;
  color: var(--text-tertiary, #94a3b8);
}
.bw-btn-gen-qr {
  height: 32px;
  padding: 0 12px;
  border-radius: 8px;
  background: var(--sys-bg-primary, #f1f5f9);
  color: var(--bw-accent, #4f7cff);
  border: 1px solid var(--border-color, rgba(0, 0, 0, 0.08));
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
}
.bw-qr-preview-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-top: 14px;
  padding: 16px;
  background: var(--sys-bg-primary, #f8fafc);
  border-radius: 14px;
  border: 1px solid var(--border-color, rgba(0, 0, 0, 0.06));
}
.bw-qr-preview-box img {
  width: 190px;
  height: 190px;
  background: #fff;
  padding: 8px;
  border-radius: 10px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.06);
}
.bw-qr-status-tag {
  margin-top: 10px;
  font-size: 12px;
  font-weight: 500;
  color: #10b981;
}
.bw-qr-status-tag.warning {
  color: #f59e0b;
}
.bw-qr-actions {
  display: flex;
  gap: 10px;
  margin-top: 12px;
}
.bw-qr-btn {
  height: 32px;
  padding: 0 14px;
  border-radius: 8px;
  background: var(--sys-bg-secondary, #fff);
  border: 1px solid var(--border-color, rgba(0, 0, 0, 0.1));
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary, #475569);
  cursor: pointer;
}
@keyframes bwFadeIn {
  from { opacity: 0; transform: scale(0.98); }
  to { opacity: 1; transform: scale(1); }
}
</style>
