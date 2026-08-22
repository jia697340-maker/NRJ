<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'

const props = defineProps<{
  selectedChat: any
  totalUnreadCount: number
  currentDateStr: string
  currentDayStr: string
}>()

const emit = defineEmits<{
  (e: 'back'): void
  (e: 'open-settings'): void
  (e: 'show-inner-thought-modal'): void
  (e: 'show-memory-modal'): void
  (e: 'open-call-records'): void
  (e: 'open-offline-meet'): void
  (e: 'click-overlay'): void
  (e: 'open-timelines'): void
}>()

const activeTimelineName = computed(() => props.selectedChat?.timelineState?.timelines?.find(
  (item: any) => item.id === props.selectedChat?.timelineState?.activeTimelineId
)?.name || '主时间线')

const now = ref(Date.now())
let timer: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  timer = setInterval(() => {
    now.value = Date.now()
  }, 1000)
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
})

const getStatusText = () => {
  if (!props.selectedChat?.enableImmersiveStatus) return ''

  const offlineUntil = props.selectedChat?.offlineUntil || 0
  const isOffline = offlineUntil > now.value
  const baseStatus = props.selectedChat?.statusText || ''

  if (isOffline) {
    const diff = offlineUntil - now.value
    const m = Math.floor(diff / 60000)
    const s = Math.floor((diff % 60000) / 1000)
    const timeStr = m > 0 ? `约 ${m} 分 ${s} 秒后恢复` : `还有 ${s} 秒回归`
    return baseStatus ? `${baseStatus}（离线中，${timeStr}）` : `离线中，${timeStr}`
  }

  return baseStatus || '在线'
}

const showStatusRow = () => {
  return !!props.selectedChat?.enableImmersiveStatus
}
</script>

<template>
  <header class="chat-advanced-header glass-header" @click="emit('click-overlay')">
    <div class="chat-header-main">
      <div class="chat-header-top-row">
        <div class="chat-header-profile">
          <div v-if="totalUnreadCount > 0" class="back-btn-wrapper" @click="emit('back')">
            <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round" class="back-arrow"><polyline points="15 18 9 12 15 6"></polyline></svg>
            <div class="back-unread-badge">{{ totalUnreadCount > 99 ? '99+' : totalUnreadCount }}</div>
          </div>
          <div class="chat-header-avatar" @click="emit('back')" :style="selectedChat?.avatarUrl ? { backgroundImage: `url(${selectedChat.avatarUrl})` } : {}">{{ selectedChat?.avatarUrl ? '' : (selectedChat?.avatarText || '伴') }}</div>
          <div style="display: flex; flex-direction: column; justify-content: center;" @click="emit('open-call-records')" class="clickable-header-name">
            <div class="chat-header-name">{{ selectedChat?.name || '消息' }}</div>
            <div
              v-if="showStatusRow()"
              style="font-size: 11px; color: var(--text-tertiary); display: flex; align-items: center; gap: 4px; margin-top: 2px; font-weight: normal;"
            >
              {{ getStatusText() }}
            </div>
            <div v-if="(selectedChat?.timelineState?.timelines?.length || 0) > 1" class="header-timeline-chip" @click.stop="emit('open-timelines')">{{ activeTimelineName }}⌄</div>
          </div>
        </div>

        <div style="display: flex; gap: 8px; margin-right: 4px;">
          <div
            v-if="selectedChat?.offlineMeetEnabled && selectedChat?.offlineMeetMode === 'separate'"
            class="icon-btn offline-meet-entry"
            title="进入线下见面"
            @click="emit('open-offline-meet')"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" style="color: #999999;">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
          </div>
          <div class="icon-btn" @click="emit('show-inner-thought-modal')">
            <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" style="color: #999999;">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
              <polyline points="22,6 12,13 2,6"></polyline>
            </svg>
          </div>
          <div class="icon-btn" @click="emit('show-memory-modal')">
            <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" style="color: #999999;">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
            </svg>
          </div>
          <div class="icon-btn" @click="emit('open-settings')">
            <svg viewBox="0 0 24 24" width="20" height="20" stroke="none" fill="#999999"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
          </div>
        </div>
      </div>

      <div class="chat-time-capsule">
        <div class="capsule-content">
          <span class="capsule-date">{{ currentDateStr }}</span>
          <span class="capsule-day">{{ currentDayStr }}</span>
        </div>
      </div>
    </div>
  </header>
</template>

<style scoped>
@import '../ChatRoomView.css';

.clickable-header-name {
  cursor: pointer;
  transition: opacity 0.2s;
}
.clickable-header-name:active {
  opacity: 0.7;
}
.header-timeline-chip{align-self:flex-start;margin-top:3px;padding:2px 7px;border-radius:8px;background:rgba(143,124,255,.1);color:#7561dc;font-size:9px;line-height:1.4;cursor:pointer;max-width:130px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
</style>
