<!-- WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ -->
<script setup lang="ts">
import { computed } from 'vue'
import type { GroupAnnouncement, GroupUserPermissions } from '../../../types/groupManagement'

const props = defineProps<{
  visible: boolean
  announcement: GroupAnnouncement | null
  permissions: GroupUserPermissions
  currentUserId?: string
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'confirm', id: string): void
  (e: 'edit', announcement: GroupAnnouncement): void
  (e: 'delete', id: string): void
}>()

const isConfirmed = computed(() => {
  if (!props.announcement) return false
  return props.announcement.confirmedUserIds?.includes(props.currentUserId || 'user')
})

const formatDate = (timestamp: number) => {
  if (!timestamp) return ''
  const d = new Date(timestamp)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
</script>

<template>
  <div v-if="visible && announcement" class="wb-modal-overlay" @click.self="emit('close')">
    <div class="custom-confirm-modal announcement-detail-modal">
      <div class="modal-header">
        <div class="header-tag-row">
          <span v-if="announcement.isPinned" class="pinned-badge">置顶公告</span>
          <span v-if="announcement.needConfirm" class="confirm-req-badge">需确认收到</span>
        </div>
        <h3 class="modal-title">{{ announcement.title }}</h3>
        <div class="meta-row">
          <span class="publisher-name">{{ announcement.publisherName }}</span>
          <span class="publish-time">{{ formatDate(announcement.createdAt) }}</span>
        </div>
      </div>

      <div class="modal-body scrollable-content">
        <div class="announcement-content-text">
          {{ announcement.content }}
        </div>

        <div class="stats-panel">
          <div class="stat-item">
            <span class="stat-num">{{ announcement.readCount || 0 }}</span>
            <span class="stat-label">已阅读</span>
          </div>
          <div v-if="announcement.needConfirm" class="stat-item">
            <span class="stat-num highlight">{{ announcement.confirmCount || 0 }}</span>
            <span class="stat-label">已确认收到</span>
          </div>
        </div>
      </div>

      <div class="modal-footer">
        <div v-if="announcement.needConfirm" class="action-btn-row">
          <button
            class="confirm-btn primary-action"
            :class="{ 'is-confirmed': isConfirmed }"
            :disabled="isConfirmed"
            @click="emit('confirm', announcement.id)"
          >
            {{ isConfirmed ? '✓ 我已确认收到' : '确认收到此公告' }}
          </button>
        </div>

        <div class="secondary-btn-row">
          <button v-if="permissions.canManageAnnouncements" class="text-btn danger" @click="emit('delete', announcement.id)">删除</button>
          <button v-if="permissions.canManageAnnouncements" class="text-btn" @click="emit('edit', announcement)">编辑</button>
          <button class="text-btn close" @click="emit('close')">关闭</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.announcement-detail-modal {
  max-width: 360px;
  width: 90%;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  padding: 20px;
  background: #ffffff;
  border-radius: 16px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.15);
}

.modal-header {
  margin-bottom: 14px;
  border-bottom: 0.5px solid #f0f0f0;
  padding-bottom: 12px;
}

.header-tag-row {
  display: flex;
  gap: 6px;
  margin-bottom: 6px;
}

.pinned-badge {
  font-size: 10px;
  background-color: #fff4e5;
  color: #d35400;
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 600;
}

.confirm-req-badge {
  font-size: 10px;
  background-color: #e8f4fd;
  color: #2980b9;
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 600;
}

.modal-title {
  font-size: 16px;
  font-weight: 700;
  color: #2c3e50;
  margin: 0 0 6px 0;
  line-height: 1.4;
  word-break: break-all;
}

.meta-row {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: #95a5a6;
}

.scrollable-content {
  flex: 1;
  overflow-y: auto;
  max-height: 45vh;
  padding-right: 4px;
}

.announcement-content-text {
  font-size: 13.5px;
  line-height: 1.6;
  color: #34495e;
  white-space: pre-wrap;
  word-break: break-word;
  margin-bottom: 16px;
}

.stats-panel {
  display: flex;
  background: #f8f9fa;
  border-radius: 8px;
  padding: 10px;
  justify-content: space-around;
  margin-top: 8px;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.stat-num {
  font-size: 14px;
  font-weight: 700;
  color: #2c3e50;
}

.stat-num.highlight {
  color: #3b82f6;
}

.stat-label {
  font-size: 10.5px;
  color: #7f8c8d;
}

.modal-footer {
  margin-top: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.primary-action {
  width: 100%;
  padding: 10px 0;
  background: var(--text-primary, #2c3e50);
  color: #ffffff;
  border: none;
  border-radius: 8px;
  font-size: 13.5px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.2s, transform 0.1s;
}

.primary-action:active {
  opacity: 0.85;
  transform: scale(0.99);
}

.primary-action.is-confirmed {
  background: #eff6ff;
  color: #3b82f6;
  cursor: default;
  border: 1px solid rgba(59, 130, 246, 0.3);
}

.secondary-btn-row {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  align-items: center;
}

.text-btn {
  background: none;
  border: none;
  font-size: 12.5px;
  color: #7f8c8d;
  cursor: pointer;
  padding: 4px 8px;
}

.text-btn.danger {
  color: #e74c3c;
}

.text-btn.close {
  color: #2c3e50;
  font-weight: 600;
}
</style>
