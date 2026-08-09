/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { apiLogger, type ApiLogEntry } from '../../../services/apiLogger'

const props = defineProps<{
  show: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const logs = ref<ApiLogEntry[]>([])
const loading = ref(false)

const loadLogs = async () => {
  loading.value = true
  try {
    logs.value = await apiLogger.getLogs()
  } catch (e) {
    console.error(e)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  if (props.show) {
    loadLogs()
  }
})

// 监听弹窗显示状态重新加载
import { watch } from 'vue'
watch(() => props.show, (newVal) => {
  if (newVal) loadLogs()
})

const formatTime = (ts: number) => {
  const d = new Date(ts)
  const h = d.getHours().toString().padStart(2, '0')
  const m = d.getMinutes().toString().padStart(2, '0')
  const s = d.getSeconds().toString().padStart(2, '0')
  return `${h}:${m}:${s}`
}

const formatDate = (ts: number) => {
  const d = new Date(ts)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

const handleClear = async () => {
  await apiLogger.clearLogs()
  logs.value = []
}

// 图标映射
const getIcon = (type: string) => {
  switch(type) {
    case 'Chat': return '💬'
    case 'Vision': return '🖼️'
    case 'Summary': return '📚'
    case 'Moment': return '📱'
    default: return '⚡'
  }
}

</script>

<template>
  <Teleport defer to="#app">
    <Transition name="fade">
      <div v-if="show" class="modal-overlay" @click.self="emit('close')">
        <Transition name="slide-up">
          <div v-if="show" class="modal-content">
            <div class="modal-header">
              <div class="header-left">
                <h3>详细调用日志</h3>
                <span class="log-count">{{ logs.length }} 条记录</span>
              </div>
              <div class="header-actions">
                <button v-if="logs.length > 0" class="clear-btn" @click="handleClear">清空</button>
                <button class="close-btn" @click="emit('close')">
                  <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              </div>
            </div>
            
            <div class="modal-body">
              <div v-if="loading" class="loading-state">
                <div class="spinner"></div>
                <span>读取中...</span>
              </div>
              
              <div v-else-if="logs.length === 0" class="empty-state">
                <svg viewBox="0 0 24 24" width="48" height="48" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                  <line x1="16" y1="13" x2="8" y2="13"></line>
                  <line x1="16" y1="17" x2="8" y2="17"></line>
                  <polyline points="10 9 9 9 8 9"></polyline>
                </svg>
                <p>暂无日志记录</p>
                <span class="empty-hint">开启记录并在聊天后，这里会显示详细的耗时与轨迹。</span>
              </div>
              
              <div v-else class="log-list">
                <div v-for="log in logs" :key="log.id" class="log-item" :class="{ error: !log.success }">
                  <div class="log-icon">{{ getIcon(log.type) }}</div>
                  <div class="log-main">
                    <div class="log-top">
                      <span class="log-type">{{ log.type }}</span>
                      <span class="log-model">{{ log.model }}</span>
                    </div>
                    <div class="log-bottom">
                      <span v-if="!log.success" class="error-msg">{{ log.errorMsg || '请求失败' }}</span>
                      <span v-else class="log-tokens" v-if="log.tokens">耗费 {{ log.tokens }} Tokens</span>
                    </div>
                  </div>
                  <div class="log-meta">
                    <div class="log-time">
                      <span class="date">{{ formatDate(log.timestamp) }}</span>
                      {{ formatTime(log.timestamp) }}
                    </div>
                    <div class="log-duration" :class="{ fast: log.duration < 1000, slow: log.duration > 5000 }">
                      {{ log.duration }} ms
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
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
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}

.modal-content {
  background: var(--bg-color, #f5f5f7);
  border-radius: 20px;
  width: 100%;
  max-width: 480px;
  height: 80vh;
  max-height: 700px;
  display: flex;
  flex-direction: column;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
  overflow: hidden;
  border: 1px solid var(--border-color);
}

.modal-header {
  padding: 16px 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--card-bg-solid);
  border-bottom: 1px solid var(--border-color);
  z-index: 2;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.modal-header h3 {
  margin: 0;
  font-size: 17px;
  font-weight: 600;
  color: var(--text-primary);
}

.log-count {
  font-size: 12px;
  background: var(--sys-bg-tertiary);
  color: var(--text-secondary);
  padding: 2px 8px;
  border-radius: 12px;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.clear-btn {
  background: transparent;
  border: none;
  color: #ff4757;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 6px;
}

.clear-btn:hover {
  background: rgba(255, 71, 87, 0.1);
}

.close-btn {
  background: transparent;
  border: none;
  color: var(--text-tertiary);
  cursor: pointer;
  padding: 4px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.close-btn:hover {
  background: var(--sys-bg-tertiary);
  color: var(--text-primary);
}

.modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  background: var(--sys-bg-primary);
}

.loading-state, .empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--text-tertiary);
  gap: 12px;
}

.empty-state svg {
  margin-bottom: 8px;
  opacity: 0.5;
}

.empty-state p {
  margin: 0;
  font-size: 15px;
  font-weight: 500;
  color: var(--text-secondary);
}

.empty-hint {
  font-size: 13px;
  text-align: center;
  max-width: 260px;
  line-height: 1.5;
}

.spinner {
  width: 24px;
  height: 24px;
  border: 2px solid var(--border-color);
  border-top-color: var(--primary-color, #007aff);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.log-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.log-item {
  background: var(--card-bg-solid);
  border-radius: 12px;
  padding: 12px 16px;
  display: flex;
  align-items: center;
  gap: 16px;
  border: 1px solid var(--border-color);
  transition: transform 0.2s ease;
}

.log-item:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.03);
}

.log-item.error {
  border-color: rgba(255, 71, 87, 0.3);
  background: linear-gradient(to right, rgba(255, 71, 87, 0.05), transparent);
}

.log-icon {
  font-size: 20px;
  width: 36px;
  height: 36px;
  background: var(--sys-bg-tertiary);
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.log-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.log-top {
  display: flex;
  align-items: center;
  gap: 8px;
}

.log-type {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.log-model {
  font-size: 12px;
  color: var(--text-tertiary);
  background: var(--sys-bg-secondary);
  padding: 2px 6px;
  border-radius: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 150px;
}

.log-bottom {
  font-size: 12px;
}

.log-tokens {
  color: var(--text-secondary);
}

.error-msg {
  color: #ff4757;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.log-meta {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
  flex-shrink: 0;
}

.log-time {
  font-size: 12px;
  color: var(--text-tertiary);
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

.log-time .date {
  font-size: 10px;
}

.log-duration {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
  font-variant-numeric: tabular-nums;
}

.log-duration.fast {
  color: #2ed573;
}

.log-duration.slow {
  color: #ffa502;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
}

.slide-up-enter-from,
.slide-up-leave-to {
  opacity: 0;
  transform: translateY(20px);
}
</style>
