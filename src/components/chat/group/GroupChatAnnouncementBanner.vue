<!-- WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ -->
<script setup lang="ts">
import type { GroupAnnouncement } from '../../../types/groupManagement'

defineProps<{
  announcement: GroupAnnouncement | null
  unreadCount?: number
}>()

const emit = defineEmits<{
  (e: 'click'): void
  (e: 'close'): void
}>()
</script>

<template>
  <div v-if="announcement" class="group-announcement-banner" @click="emit('click')">
    <div class="banner-icon-box">
      <!-- 喇叭矢量 SVG 图标，杜绝默认表情符号 -->
      <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
        <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
      </svg>
      <span v-if="unreadCount && unreadCount > 0" class="unread-dot"></span>
    </div>

    <div class="banner-content">
      <span v-if="announcement.isPinned" class="pinned-tag">置顶</span>
      <span class="banner-title">{{ announcement.title }}</span>
      <span class="banner-text">{{ announcement.content }}</span>
    </div>

    <div class="banner-arrow">
      <span class="arrow-text">查看</span>
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M9 18l6-6-6-6"></path>
      </svg>
    </div>
  </div>
</template>

<style scoped>
.group-announcement-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  padding: 7px 12px;
  margin: 6px 12px 0 12px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  border: 0.5px solid rgba(0, 0, 0, 0.06);
  cursor: pointer;
  z-index: 10;
  transition: all 0.2s ease;
}

.group-announcement-banner:active {
  background: rgba(245, 245, 245, 0.95);
  transform: scale(0.995);
}

.banner-icon-box {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #e67e22;
  flex-shrink: 0;
}

.unread-dot {
  position: absolute;
  top: -2px;
  right: -2px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: #ff4d4f;
  border: 1px solid #fff;
}

.banner-content {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  min-width: 0;
  overflow: hidden;
}

.pinned-tag {
  font-size: 10px;
  background-color: #fff4e5;
  color: #d35400;
  padding: 1px 4px;
  border-radius: 3px;
  font-weight: 600;
  flex-shrink: 0;
}

.banner-title {
  font-size: 12px;
  font-weight: 600;
  color: #2c3e50;
  flex-shrink: 0;
  max-width: 100px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.banner-text {
  font-size: 12px;
  color: #7f8c8d;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}

.banner-arrow {
  display: flex;
  align-items: center;
  gap: 2px;
  color: #95a5a6;
  font-size: 11px;
  flex-shrink: 0;
}

.arrow-text {
  font-size: 11px;
}
</style>
