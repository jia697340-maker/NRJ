<!-- WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ -->
<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import NewApiNoticeModal from './NewApiNoticeModal.vue'
import {
  detectNewApiNode,
  NewApiDetectionError,
  type NewApiDetectionResult
} from '../services/newApiNode'

const props = defineProps<{
  visible: boolean
  darkMode?: boolean
  targetName: string
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'detect', data: { baseUrl: string; apiKey: string }): void
  (e: 'confirm', data: NewApiDetectionResult): void
}>()

type ImportStatus = 'idle' | 'detecting' | 'success' | 'error' | 'importing' | 'completed'

const status = ref<ImportStatus>('idle')
const baseUrl = ref('')
const apiKey = ref('')
const showPassword = ref(false)

const NEW_API_NOTICE_DISMISSED_KEY = 'clingy_new_api_notice_dismissed'
const showNewApiNoticeModal = ref(false)
const newApiNoticeDismissed = ref(localStorage.getItem(NEW_API_NOTICE_DISMISSED_KEY) === '1')

const handleNewApiNoticeClose = () => {
  showNewApiNoticeModal.value = false
}

const handleNewApiNoticeContinue = (dontRemindAgain: boolean) => {
  newApiNoticeDismissed.value = dontRemindAgain
  if (dontRemindAgain) localStorage.setItem(NEW_API_NOTICE_DISMISSED_KEY, '1')
  else localStorage.removeItem(NEW_API_NOTICE_DISMISSED_KEY)
  showNewApiNoticeModal.value = false
}

const detectionResult = ref<NewApiDetectionResult | null>(null)
const detectedNode = computed(() => detectionResult.value?.nodeInfo || null)
const errorMessage = ref('')

watch(() => props.visible, (val) => {
  if (val) {
    status.value = 'idle'
    baseUrl.value = ''
    apiKey.value = ''
    detectionResult.value = null
    errorMessage.value = ''
    showPassword.value = false
  }
})

const handleClose = () => {
  if (status.value === 'detecting' || status.value === 'importing') return
  emit('close')
}

const handleDetect = async () => {
  if (!baseUrl.value || !apiKey.value) return

  status.value = 'detecting'
  errorMessage.value = ''
  emit('detect', { baseUrl: baseUrl.value, apiKey: apiKey.value })

  try {
    detectionResult.value = await detectNewApiNode({
      baseUrl: baseUrl.value,
      apiKey: apiKey.value
    })
    baseUrl.value = detectionResult.value.credentials.baseUrl
    status.value = 'success'
  } catch (error: any) {
    detectionResult.value = null
    status.value = 'error'
    errorMessage.value = error instanceof NewApiDetectionError
      ? error.message
      : (error?.message || '节点检测失败，请重试')
  }
}

const handleConfirm = () => {
  if (!detectionResult.value) return
  status.value = 'importing'
  emit('confirm', detectionResult.value)
  status.value = 'completed'
  window.setTimeout(() => emit('close'), 700)
}

const handleRetry = () => {
  status.value = 'idle'
  detectionResult.value = null
  errorMessage.value = ''
}

const formatQuota = (val: number | null, symbol = '$') => {
  if (val === null) return '-'
  return symbol + val.toFixed(2)
}

const formatDate = (ts: number | null) => {
  if (!ts) return '-'
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
</script>

<template>
  <div v-if="visible" class="import-modal-overlay" :class="{ 'is-dark': darkMode }">
    <div class="import-modal-content">
      
      <!-- Idle State -->
      <div v-if="status === 'idle'" class="state-container">
        <div class="page-header" style="display: flex; justify-content: space-between; align-items: flex-end; padding-bottom: 24px; border-bottom: 1px solid rgba(0,0,0,0.05);">
          <div class="modal-header" style="margin-bottom: 0; text-align: left;">
            <h2 class="en-title">IMPORT NEW API NODE</h2>
            <span class="cn-subtitle">导入 New API 节点</span>
          </div>
          <button class="text-btn" style="padding: 0; display: flex; flex-direction: column; align-items: flex-end;" type="button" @click="showNewApiNoticeModal = true">
            <span style="font-size: 10px; color: #999; letter-spacing: 0.2em;">说明</span>
            <span style="font-family: 'Didot', 'Times New Roman', serif; font-size: 14px; letter-spacing: 0.1em; color: #1a1a1a;">GUIDE</span>
          </button>
        </div>

        <div class="info-banner">
          <span class="label">导入到：</span>
          <span class="value">{{ targetName }}</span>
        </div>

        <div class="form-group">
          <label class="form-label">中转站地址</label>
          <input v-model="baseUrl" class="line-input" placeholder="请输入你已持有的节点地址" spellcheck="false" autocomplete="off" />
          <div class="input-hint">仅导入你已合法取得并充分信任的 New API、One API 兼容节点</div>
        </div>

        <div class="form-group">
          <label class="form-label">API Key</label>
          <div class="input-with-action">
            <input :type="showPassword ? 'text' : 'password'" v-model="apiKey" class="line-input" placeholder="示例：sk-xxxxxxxx" spellcheck="false" autocomplete="off" />
            <button class="icon-action-btn" @click="showPassword = !showPassword" :title="showPassword ? '隐藏' : '显示'">
              <svg v-if="!showPassword" viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="1.2" fill="none"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
              <svg v-else viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="1.2" fill="none"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
            </button>
          </div>
        </div>

        <div class="security-notice">
          隐私提示：配置保存在当前浏览器；检测与调用会由浏览器直接向你填写的第三方接口发送 API Key 和请求数据，请仅使用可信地址。
        </div>

        <div class="modal-actions">
          <button class="text-btn" @click="handleClose">取消</button>
          <button class="primary-btn" :disabled="!baseUrl || !apiKey" @click="handleDetect">检测节点</button>
        </div>
      </div>

      <!-- Detecting State -->
      <div v-else-if="status === 'detecting' || status === 'importing' || status === 'completed'" class="state-container center-content">
        <div class="loader-spinner" :class="{ 'completed': status === 'completed' }"></div>
        <div class="loader-text">
          <span v-if="status === 'detecting'">正在识别站点并验证 API Key……</span>
          <span v-else-if="status === 'importing'">正在导入节点配置……</span>
          <span v-else-if="status === 'completed'">导入完成</span>
        </div>
      </div>

      <!-- Success State -->
      <div v-else-if="status === 'success' && detectedNode" class="state-container">
        <div class="modal-header">
          <h2 class="en-title">NODE DETECTED</h2>
          <span class="cn-subtitle">检测结果预览</span>
        </div>

        <div class="result-list">
          <div class="result-item">
            <span class="label">站点名称</span>
            <span class="value highlight">{{ detectedNode.systemName }}</span>
          </div>
          <div class="result-item">
            <span class="label">站点类型</span>
            <span class="value tag">{{ detectedNode.platform === 'new-api' ? 'New API' : 'One API' }}</span>
          </div>
          <div class="result-item">
            <span class="label">站点地址</span>
            <span class="value">{{ detectedNode.baseUrl }}</span>
          </div>
          <div class="result-item">
            <span class="label">连接状态</span>
            <span class="value success-text">
              <span class="status-dot"></span>连接正常
            </span>
          </div>
          <div class="result-item">
            <span class="label">API Key</span>
            <span class="value code">{{ detectedNode.maskedKey }}</span>
          </div>
          <div class="result-item">
            <span class="label">可用模型</span>
            <span class="value">{{ detectedNode.modelCount }} 个</span>
          </div>
          <div class="result-item">
            <span class="label">账户额度</span>
            <span class="value" v-if="detectedNode.unlimitedQuota">无限额度</span>
            <span class="value" v-else-if="detectedNode.quotaSupported">
              剩余 {{ formatQuota(detectedNode.remainingQuota, detectedNode.currencySymbol) }}
              <span class="sub-text">(已用 {{ formatQuota(detectedNode.usedQuota, detectedNode.currencySymbol) }} / 总 {{ formatQuota(detectedNode.totalQuota, detectedNode.currencySymbol) }})</span>
            </span>
            <span class="value" v-else>站点不支持 Key 额度查询</span>
          </div>
          <div class="result-item">
            <span class="label">到期时间</span>
            <span class="value">{{ formatDate(detectedNode.expiresAt) }}</span>
          </div>
          <div class="result-item">
            <span class="label">检测时间</span>
            <span class="value">{{ formatDate(detectedNode.checkedAt) }}</span>
          </div>
        </div>

        <div class="modal-actions">
          <button class="text-btn" @click="handleClose">取消</button>
          <button class="text-btn" @click="handleRetry">重新填写</button>
          <button class="primary-btn" @click="handleConfirm">确认导入</button>
        </div>
      </div>

      <!-- Error State -->
      <div v-else-if="status === 'error'" class="state-container">
        <div class="modal-header">
          <h2 class="en-title error-title">DETECTION FAILED</h2>
          <span class="cn-subtitle">节点检测失败</span>
        </div>

        <div class="error-box">
          {{ errorMessage || '未知错误，请重试' }}
        </div>

        <div class="modal-actions">
          <button class="text-btn" @click="handleClose">取消</button>
          <button class="primary-btn" @click="handleRetry">修改信息</button>
        </div>
      </div>

    </div>

    <!-- New API 兼容功能公告 -->
    <NewApiNoticeModal
      :visible="showNewApiNoticeModal"
      :dark-mode="darkMode"
      :initial-dont-remind="newApiNoticeDismissed"
      @close="handleNewApiNoticeClose"
      @continue="handleNewApiNoticeContinue"
    />
  </div>
</template>

<style scoped src="./NewApiImportModal.css"></style>
