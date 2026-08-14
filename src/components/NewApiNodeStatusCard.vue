<!-- WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ -->
<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  darkMode?: boolean
  nodeInfo: any
  refreshing?: boolean
}>()

const emit = defineEmits<{
  (e: 'refresh'): void
  (e: 'detail'): void
  (e: 'reimport'): void
  (e: 'unbind'): void
}>()

const statusColor = computed(() => {
  if (!props.nodeInfo || !props.nodeInfo.connected) return 'error'
  if (props.nodeInfo.unlimitedQuota) return 'normal'
  
  const remaining = props.nodeInfo.remainingQuota || 0
  if (remaining <= 0) return 'error'
  if (remaining < 2) return 'warning'
  return 'normal'
})

const formatQuota = (val: number | null) => {
  if (val === null) return '-'
  return (props.nodeInfo?.currencySymbol || '$') + val.toFixed(2)
}

const formatDate = (ts: number | null) => {
  if (!ts) return '-'
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
</script>

<template>
  <div v-if="nodeInfo" class="node-status-card" :class="{ 'is-dark': darkMode }">
    <div class="card-header">
      <div class="brand">
        <div class="logo">
          <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
            <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
            <line x1="12" y1="22.08" x2="12" y2="12"></line>
          </svg>
        </div>
        <div class="name-info">
          <span class="name">{{ nodeInfo.systemName || '未命名节点' }}</span>
          <span class="tag">New API</span>
        </div>
      </div>
      <div class="status-indicator" :class="statusColor">
        <span class="dot"></span>
        <span class="text" v-if="statusColor === 'normal'">运行中</span>
        <span class="text" v-else-if="statusColor === 'warning'">余额偏低</span>
        <span class="text" v-else>离线/耗尽</span>
      </div>
    </div>

    <div class="card-body">
      <div class="data-grid">
        <div class="data-item">
          <span class="label">可用余额</span>
          <span class="value" :class="statusColor">
            {{ nodeInfo.unlimitedQuota ? '无限额度' : (nodeInfo.quotaSupported ? formatQuota(nodeInfo.remainingQuota) : '暂不支持查询') }}
          </span>
        </div>
        <div class="data-item">
          <span class="label">已用额度</span>
          <span class="value">{{ nodeInfo.unlimitedQuota || !nodeInfo.quotaSupported ? '-' : formatQuota(nodeInfo.usedQuota) }}</span>
        </div>
        <div class="data-item">
          <span class="label">可用模型</span>
          <span class="value">{{ nodeInfo.modelCount || 0 }} 个</span>
        </div>
        <div class="data-item">
          <span class="label">API Key</span>
          <span class="value code">{{ nodeInfo.maskedKey || 'sk-••••••' }}</span>
        </div>
      </div>
    </div>

    <div class="card-footer">
      <div class="update-time">
        更新于 {{ formatDate(nodeInfo.checkedAt) }}
      </div>
      <div class="actions">
        <button class="action-btn" :disabled="refreshing" @click="emit('refresh')">{{ refreshing ? '刷新中…' : '刷新余额' }}</button>
        <button class="action-btn" @click="emit('detail')">查看详情</button>
        <button class="action-btn" @click="emit('reimport')">重新导入</button>
        <button class="action-btn danger" @click="emit('unbind')">解除绑定</button>
      </div>
    </div>
  </div>
</template>

<style scoped src="./NewApiNodeStatusCard.css"></style>
