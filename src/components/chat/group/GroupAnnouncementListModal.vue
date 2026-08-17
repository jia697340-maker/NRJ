<!-- WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ -->
<script setup lang="ts">
import type { GroupAnnouncement, GroupUserPermissions } from '../../../types/groupManagement'

defineProps<{
  visible: boolean
  announcements: GroupAnnouncement[]
  permissions: GroupUserPermissions
  isLoading?: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'select', announcement: GroupAnnouncement): void
  (e: 'create'): void
}>()

const formatDate = (timestamp: number) => {
  if (!timestamp) return ''
  const d = new Date(timestamp)
  return `${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
</script>

<template>
  <div v-if="visible" class="wb-modal-overlay" @click.self="emit('close')">
    <div class="custom-confirm-modal announcement-list-modal">
      <div class="modal-top-bar">
        <div class="modal-title">群公告 ({{ announcements.length }})</div>
        <div class="modal-top-actions">
          <button
            v-if="permissions.canPublishAnnouncement"
            class="create-announcement-btn"
            @click="emit('create')"
          >
            发布公告
          </button>
          <button class="modal-close-icon-btn" title="关闭" @click="emit('close')">
            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      </div>

      <!-- 加载中 Skeleton 骨架屏 -->
      <div v-if="isLoading" class="announcement-skeleton-list">
        <div v-for="i in 3" :key="i" class="skeleton-card">
          <div class="skeleton-line title"></div>
          <div class="skeleton-line desc"></div>
        </div>
      </div>

      <!-- 公告列表 -->
      <div v-else-if="announcements.length" class="announcement-scroll-list">
        <div
          v-for="item in announcements"
          :key="item.id"
          class="announcement-card"
          :class="{ 'is-pinned': item.isPinned }"
          @click="emit('select', item)"
        >
          <div class="card-header">
            <div class="card-title-group">
              <span v-if="item.isPinned" class="pinned-tag">置顶</span>
              <span class="card-title">{{ item.title }}</span>
            </div>
            <span class="card-time">{{ formatDate(item.createdAt) }}</span>
          </div>

          <div class="card-body">
            {{ item.content }}
          </div>

          <div class="card-footer">
            <div class="footer-left">
              <span class="publisher-label">发布者: {{ item.publisherName }}</span>
              <span v-if="item.needConfirm" class="confirm-tag">需确认</span>
            </div>
            <div class="footer-stats">
              <span>已读 {{ item.readCount || 0 }}</span>
              <span v-if="item.needConfirm"> / 确认 {{ item.confirmCount || 0 }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 空公告缺省态 -->
      <div v-else class="empty-state">
        <div class="empty-icon">
          <svg viewBox="0 0 24 24" width="36" height="36" stroke="#bdc3c7" stroke-width="1.5" fill="none">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
          </svg>
        </div>
        <div class="empty-text">暂无群公告</div>
        <button
          v-if="permissions.canPublishAnnouncement"
          class="empty-action-btn"
          @click="emit('create')"
        >
          发布第一条公告
        </button>
      </div>

      <div class="modal-bottom-actions">
        <button class="modal-primary-btn" @click="emit('close')">完成</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.announcement-list-modal {
  max-width: 380px;
  width: 92%;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  padding: 18px;
  background: var(--sys-bg-secondary, #ffffff);
  border-radius: 16px;
  box-shadow: 0 12px 36px rgba(0, 0, 0, 0.15);
}

.modal-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary, #2c3e50);
}

.modal-top-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.modal-close-icon-btn {
  background: transparent;
  border: none;
  border-radius: 50%;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-tertiary, #95a5a6);
  cursor: pointer;
  transition: all 0.2s;
  padding: 0;
}

.modal-close-icon-btn:hover {
  background: rgba(0, 0, 0, 0.05);
  color: var(--text-primary, #2c3e50);
}

.modal-bottom-actions {
  display: flex;
  margin-top: 14px;
  padding-top: 10px;
  border-top: 1px solid var(--border-color, rgba(0, 0, 0, 0.06));
}

.modal-primary-btn {
  width: 100%;
  height: 40px;
  background: var(--text-primary, #2c3e50);
  color: var(--sys-bg-primary, #ffffff);
  border: none;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: opacity 0.2s, transform 0.1s;
}

.modal-primary-btn:active {
  opacity: 0.85;
  transform: scale(0.99);
}

.modal-top-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.create-announcement-btn {
  background: var(--text-primary, #2c3e50);
  color: #fff;
  border: none;
  border-radius: 6px;
  padding: 5px 12px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.2s, transform 0.1s;
}

.create-announcement-btn:active {
  opacity: 0.85;
  transform: scale(0.98);
}

.announcement-scroll-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: 52vh;
  padding-right: 2px;
}

.announcement-card {
  background: #fdfdfd;
  border: 0.5px solid #eaeaea;
  border-radius: 10px;
  padding: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.announcement-card:active {
  background: #f7f9fa;
  transform: scale(0.99);
}

.announcement-card.is-pinned {
  border-left: 3px solid #e67e22;
  background: #fffdfa;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.card-title-group {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  min-width: 0;
}

.pinned-tag {
  font-size: 9.5px;
  background-color: #fff4e5;
  color: #d35400;
  padding: 1px 4px;
  border-radius: 3px;
  font-weight: 600;
  flex-shrink: 0;
}

.card-title {
  font-size: 13.5px;
  font-weight: 600;
  color: #2c3e50;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-time {
  font-size: 10.5px;
  color: #95a5a6;
  flex-shrink: 0;
}

.card-body {
  font-size: 12.5px;
  color: #636e72;
  line-height: 1.45;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  margin-bottom: 8px;
}

.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 11px;
  color: #95a5a6;
  border-top: 0.5px solid #f5f6fa;
  padding-top: 6px;
}

.footer-left {
  display: flex;
  align-items: center;
  gap: 6px;
}

.confirm-tag {
  background: #e8f4fd;
  color: #2980b9;
  padding: 0 4px;
  border-radius: 3px;
  font-size: 9.5px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 36px 0;
  gap: 8px;
}

.empty-text {
  font-size: 13px;
  color: #95a5a6;
}

.empty-action-btn {
  margin-top: 6px;
  background: #f1f2f6;
  color: #2c3e50;
  border: 1px solid #dcdde1;
  border-radius: 6px;
  padding: 6px 14px;
  font-size: 12.5px;
  cursor: pointer;
}

/* Skeleton */
.announcement-skeleton-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 8px 0;
}

.skeleton-card {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 12px;
}

.skeleton-line {
  background: #edf2f7;
  border-radius: 4px;
  animation: pulse 1.5s infinite;
}

.skeleton-line.title {
  width: 60%;
  height: 14px;
  margin-bottom: 8px;
}

.skeleton-line.desc {
  width: 90%;
  height: 12px;
}

@keyframes pulse {
  0% { opacity: 0.6; }
  50% { opacity: 1; }
  100% { opacity: 0.6; }
}
</style>
