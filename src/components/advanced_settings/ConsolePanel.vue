/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { ref, computed } from 'vue'
import { useConsoleLog } from '../../composables/useConsoleLog'

const { logs, clearLogs } = useConsoleLog()
const consoleSearch = ref('')
const consoleFilter = ref<'all' | 'log' | 'warn' | 'error'>('all')
const isExpanded = ref(false)
const sortOrder = ref<'asc' | 'desc'>('asc')

const filteredLogs = computed(() => {
  let filtered = logs.value.filter(log => {
    if (consoleFilter.value !== 'all' && log.type !== consoleFilter.value) return false
    if (consoleSearch.value && !log.content.toLowerCase().includes(consoleSearch.value.toLowerCase())) return false
    return true
  })
  
  return filtered.sort((a, b) => {
    if (sortOrder.value === 'asc') {
      return a.timestamp - b.timestamp
    } else {
      return b.timestamp - a.timestamp
    }
  })
})

const exportLogs = () => {
  const content = filteredLogs.value.map(l => `[${new Date(l.timestamp).toLocaleString()}] [${l.type.toUpperCase()}] ${l.content}`).join('\n')
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `app_logs_${new Date().getTime()}.txt`
  a.click()
  URL.revokeObjectURL(url)
}
</script>

<template>
  <div class="settings-panel">
    <!-- 杂志风装饰性标题栏 -->
    <div class="mag-header">
      <div class="mag-title-box">
        <span class="mag-title">应用控制台</span>
        <span class="mag-subtitle">System Logs</span>
      </div>
      <div class="mag-desc">查看应用运行时的实时日志，便于排查与调试。</div>
    </div>
    
    <div class="settings-card console-card" :class="{ 'expanded': isExpanded }">
      <div class="console-toolbar">
        <div class="console-filters">
          <button class="filter-btn" :class="{ active: consoleFilter === 'all' }" @click="consoleFilter = 'all'">全部</button>
          <button class="filter-btn log" :class="{ active: consoleFilter === 'log' }" @click="consoleFilter = 'log'">普通</button>
          <button class="filter-btn warn" :class="{ active: consoleFilter === 'warn' }" @click="consoleFilter = 'warn'">警告</button>
          <button class="filter-btn error" :class="{ active: consoleFilter === 'error' }" @click="consoleFilter = 'error'">错误</button>
        </div>
        <div class="console-actions">
          <input type="text" v-model="consoleSearch" class="console-search" placeholder="搜索关键字..." />
          <button class="console-action-btn" @click="sortOrder = sortOrder === 'asc' ? 'desc' : 'asc'" :title="sortOrder === 'asc' ? '时间正序 (点击切换倒序)' : '时间倒序 (点击切换正序)'">
            <svg v-if="sortOrder === 'asc'" viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline></svg>
            <svg v-else viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><polyline points="19 12 12 19 5 12"></polyline></svg>
          </button>
          <button class="console-action-btn" @click="clearLogs" title="清空日志">
            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
          </button>
          <button class="console-action-btn" @click="exportLogs" title="导出日志">
            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
          </button>
          <button class="console-action-btn" @click="isExpanded = !isExpanded" :title="isExpanded ? '还原' : '放大'">
            <svg v-if="!isExpanded" viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 3 21 3 21 9"></polyline><polyline points="9 21 3 21 3 15"></polyline><line x1="21" y1="3" x2="14" y2="10"></line><line x1="3" y1="21" x2="10" y2="14"></line></svg>
            <svg v-else viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 14 10 14 10 20"></polyline><polyline points="20 10 14 10 14 4"></polyline><line x1="14" y1="10" x2="21" y2="3"></line><line x1="3" y1="21" x2="10" y2="14"></line></svg>
          </button>
        </div>
      </div>
      <div class="console-list">
        <div v-for="log in filteredLogs" :key="log.id" class="console-item" :class="log.type">
          <div class="log-meta">
            <span class="log-time">{{ new Date(log.timestamp).toLocaleTimeString() }}</span>
            <span class="log-type">{{ log.type.toUpperCase() }}</span>
          </div>
          <div class="log-content">{{ log.content }}</div>
        </div>
        <div v-if="filteredLogs.length === 0" class="empty-state" style="height: 100%; min-height: 200px;">
          <div class="empty-text">暂无日志</div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.settings-panel {
  display: flex;
  flex-direction: column;
  min-height: 100%;
  padding-bottom: 30px;
}

/* 杂志风内部头部 */
.mag-header {
  margin-bottom: 20px;
  padding: 0 10px;
}

.mag-title-box {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 6px;
}

.mag-title {
  font-size: 18px;
  font-weight: 600;
  color: #1F2937;
  letter-spacing: 1px;
}

.mag-subtitle {
  font-family: Georgia, serif;
  font-size: 13px;
  font-style: italic;
  color: #D1D5DB;
}

.mag-desc {
  font-size: 12px;
  color: #6B7280;
  line-height: 1.5;
}

.settings-card {
  background: #ffffff;
  border: 1px solid #E5E7EB;
  border-radius: 16px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.01);
}

.console-card {
  display: flex;
  flex-direction: column;
  height: 65vh;
  min-height: 400px;
  padding: 0;
  overflow: hidden;
  transition: all 0.3s ease;
}

.console-card.expanded {
  position: fixed;
  inset: 16px;
  height: auto;
  z-index: 9999;
  box-shadow: 0 10px 40px rgba(0,0,0,0.15);
  border-color: transparent;
}

.console-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px dashed #E5E7EB;
  background: #FFFFFF;
  flex-wrap: wrap;
  gap: 8px;
}
.console-filters {
  display: flex;
  gap: 4px;
}
.filter-btn {
  background: transparent;
  border: 1px solid transparent;
  padding: 4px 10px;
  font-size: 12px;
  border-radius: 8px;
  cursor: pointer;
  color: #6B7280;
  transition: all 0.2s;
}
.filter-btn:active {
  background: rgba(0,0,0,0.02);
}
.filter-btn.active {
  background: #ffffff;
  border-color: #E5E7EB;
  color: #1F2937;
  font-weight: 500;
  box-shadow: 0 1px 3px rgba(0,0,0,0.02);
}
.filter-btn.warn.active { color: #d97706; border-color: rgba(245,158,11,0.2); background: rgba(251,191,36,0.05); }
.filter-btn.error.active { color: #dc2626; border-color: rgba(239,68,68,0.2); background: rgba(239,68,68,0.05); }

.console-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}
.console-search {
  background: #F9FAFB;
  border: 1px solid #E5E7EB;
  border-radius: 8px;
  padding: 6px 12px;
  font-size: 12px;
  width: 140px;
  color: #1F2937;
  outline: none;
  transition: all 0.2s;
}
.console-search:focus {
  background: #ffffff;
  border-color: #D1D5DB;
  box-shadow: 0 0 0 2px rgba(209, 213, 219, 0.2);
}

.console-action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border: 1px solid transparent;
  background: transparent;
  color: #6B7280;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}
.console-action-btn:active {
  background: #F9FAFB;
  border-color: #E5E7EB;
  color: #1F2937;
  transform: scale(0.95);
}

.console-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
  background: #FFFFFF; /* 纯白背景 */
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
}
.console-item {
  padding: 10px 16px;
  border-bottom: 1px solid #E5E7EB;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.console-item:last-child {
  border-bottom: none;
}

.console-item.warn {
  background: rgba(251, 191, 36, 0.03);
  border-left: 3px solid rgba(245,158,11,0.5);
}
.console-item.error {
  background: rgba(239, 68, 68, 0.03);
  border-left: 3px solid rgba(239,68,68,0.5);
}
.log-meta {
  display: flex;
  gap: 8px;
  font-size: 11px;
  color: #6B7280;
}
.log-type {
  font-weight: 600;
}
.console-item.warn .log-type { color: #d97706; }
.console-item.error .log-type { color: #dc2626; }

.log-content {
  font-size: 12px;
  color: #1F2937;
  white-space: pre-wrap;
  word-break: break-all;
  line-height: 1.6;
}

.empty-state {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.empty-text {
  color: #6B7280;
  font-family: Georgia, serif;
  font-size: 14px;
  font-style: italic;
  letter-spacing: 1px;
}
</style>
