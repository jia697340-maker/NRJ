/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { computed } from 'vue'
import type { ForumUser } from '../../../types/forum'

const props = withDefaults(
  defineProps<{
    user: ForumUser
    time?: number | string
    ipLocation?: string
    showHandle?: boolean
  }>(),
  {
    time: '',
    ipLocation: '',
    showHandle: true
  }
)

const displayTime = computed(() => formatForumTime(props.time))

const formatForumTime = (value: number | string) => {
  if (value === '' || value === null || value === undefined) return ''
  if (typeof value === 'string' && !/^\d{10,}$/.test(value)) return value
  const timestamp = Number(value)
  if (!Number.isFinite(timestamp)) return String(value)
  const delta = Math.max(0, Date.now() - timestamp)
  if (delta < 60_000) return '刚刚'
  if (delta < 3_600_000) return `${Math.floor(delta / 60_000)} 分钟前`
  if (delta < 86_400_000) return `${Math.floor(delta / 3_600_000)} 小时前`
  const time = new Date(timestamp).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit',hour12:false})
  if (delta < 2 * 86_400_000) return `昨天 ${time}`
  if (delta < 3 * 86_400_000) return `前天 ${time}`
  if (delta < 7 * 86_400_000) return `${Math.floor(delta / 86_400_000)} 天前 ${time}`
  const date = new Date(timestamp)
  const now = new Date()
  return date.getFullYear() === now.getFullYear()
    ? `${date.getMonth() + 1}月${date.getDate()}日`
    : `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`
}

const emit = defineEmits<{
  (e: 'click-user', user: ForumUser): void
}>()
</script>

<template>
  <div class="user-identity-box">
    <div class="user-main-line" @click="emit('click-user', user)">
      <span class="user-name">{{ user.name }}</span>
      <span v-if="user.verified" class="verified-icon" title="认证用户">
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
        </svg>
      </span>
      <span v-if="showHandle && user.handle" class="user-handle">@{{ user.handle }}</span>
    </div>
    <div v-if="displayTime || ipLocation || user.ipLocation" class="user-sub-line">
      <span v-if="displayTime" class="time-text">{{ displayTime }}</span>
      <span v-if="displayTime && (ipLocation || user.ipLocation)" class="dot-divider">·</span>
      <span v-if="ipLocation || user.ipLocation" class="ip-text">IP 属地{{ ipLocation || user.ipLocation }}</span>
    </div>
  </div>
</template>

<style scoped>
.user-identity-box {
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-width: 0;
  line-height: 1.3;
}

.user-main-line {
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  min-width: 0;
}

.user-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary, #333333);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.user-main-line:hover .user-name {
  text-decoration: underline;
}

.verified-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  color: #2b7de9;
  flex-shrink: 0;
}

.verified-icon svg {
  width: 14px;
  height: 14px;
}

.user-handle {
  font-size: 13px;
  color: var(--text-tertiary, #999999);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.user-sub-line {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 2px;
  font-size: 12px;
  color: var(--text-secondary, #666666);
}

.dot-divider {
  color: var(--text-tertiary, #999999);
}

.time-text,
.ip-text {
  font-size: 11px;
  color: var(--text-secondary, #777777);
}
</style>
