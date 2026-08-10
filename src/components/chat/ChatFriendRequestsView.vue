/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { computed, ref } from 'vue'
import { useChatRelationship } from '../../composables/useChatRelationship'

const emit = defineEmits<{ (e: 'back'): void; (e: 'open-relationship', chat: any): void }>()
const activeTab = ref<'received' | 'sent' | 'history'>('received')
const { allRequests } = useChatRelationship()
const visibleRequests = computed(() => allRequests.value.filter(({ request }) => {
  const active = ['scheduled', 'pending', 'viewed'].includes(request.status)
  if (activeTab.value === 'history') return !active
  return active && (activeTab.value === 'received' ? request.direction === 'character_to_user' : request.direction === 'user_to_character')
}))
const formatTime = (time?: number) => time ? new Date(time).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''
const statusText = (status: string) => ({ scheduled: '待发送', pending: '等待查看', viewed: '已查看', accepted: '已同意', rejected: '已拒绝', superseded: '已失效' } as Record<string,string>)[status] || status
</script>

<template>
  <div class="friends-view">
    <header class="friends-header">
      <button type="button" aria-label="返回" @click="emit('back')"><svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg></button>
      <div><h1>新的朋友</h1><p>申请不会覆盖，所有变化都会保留</p></div><span class="request-count">{{ allRequests.length }}</span>
    </header>
    <nav class="request-tabs" aria-label="好友申请分类">
      <button v-for="tab in ([['received','收到的'],['sent','发出的'],['history','历史']] as const)" :key="tab[0]" type="button" :class="{ active: activeTab === tab[0] }" @click="activeTab = tab[0]">{{ tab[1] }}</button>
    </nav>
    <main class="friends-main">
      <div v-if="!visibleRequests.length" class="friends-empty">
        <div class="empty-icon"><svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><path d="M19 8v6m3-3h-6"/></svg></div>
        <h2>{{ activeTab === 'history' ? '还没有历史记录' : '暂时没有新的申请' }}</h2>
        <p>角色的申请计划和查看动态会在这里持续更新。</p>
      </div>
      <article v-for="item in visibleRequests" :key="item.request.id" class="friend-request-card" tabindex="0" @click="emit('open-relationship', item.chat)" @keyup.enter="emit('open-relationship', item.chat)">
        <div class="request-avatar" :style="item.chat.avatarUrl ? { backgroundImage: `url(${item.chat.avatarUrl})` } : {}">{{ item.chat.avatarUrl ? '' : item.chat.avatarText }}</div>
        <div class="request-body"><div class="request-name-row"><strong>{{ item.chat.name }}</strong><span :class="item.request.status">{{ statusText(item.request.status) }}</span></div><p>{{ item.request.direction === 'character_to_user' && item.request.status === 'pending' ? '点击查看申请内容' : item.request.message }}</p><div class="request-foot"><span>{{ item.request.direction === 'character_to_user' ? '对方向你申请' : '你向对方申请' }}</span><time>{{ formatTime(item.request.sentAt || item.request.scheduledAt || item.request.createdAt) }}</time></div></div>
        <svg class="request-arrow" viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.7"><path d="m9 18 6-6-6-6"/></svg>
      </article>
    </main>
  </div>
</template>

<style scoped>
.friends-view{position:absolute;inset:0;z-index:90;display:flex;flex-direction:column;background:var(--sys-bg-primary);color:var(--text-primary)}.friends-header{height:68px;display:grid;grid-template-columns:44px 1fr 36px;align-items:center;gap:10px;padding:env(safe-area-inset-top,0) 16px 0;background:rgba(255,255,255,.78);backdrop-filter:blur(14px);border-bottom:1px solid var(--border-color)}.is-dark .friends-header{background:rgba(28,28,30,.82)}.friends-header button{width:40px;height:40px;border:0;border-radius:50%;display:grid;place-items:center;background:transparent;color:var(--text-primary);cursor:pointer}.friends-header button:hover{background:var(--sys-bg-tertiary)}.friends-header h1{font-size:17px;margin:0}.friends-header p{font-size:10px;color:var(--text-tertiary);margin:3px 0 0}.request-count{min-width:27px;height:27px;padding:0 7px;border-radius:14px;display:grid;place-items:center;background:var(--sys-bg-tertiary);font-size:11px;color:var(--text-secondary)}.request-tabs{display:grid;grid-template-columns:repeat(3,1fr);gap:4px;padding:10px max(14px,calc((100% - 680px)/2));background:var(--sys-bg-secondary);border-bottom:1px solid var(--border-color)}.request-tabs button{height:36px;border:0;border-radius:10px;background:transparent;color:var(--text-secondary);font:inherit;font-size:13px;cursor:pointer}.request-tabs button.active{background:var(--sys-bg-tertiary);color:var(--text-primary);font-weight:650}.request-tabs button:focus-visible,.friend-request-card:focus-visible{outline:2px solid #3b82f6;outline-offset:2px}.friends-main{flex:1;overflow:auto;padding:15px max(14px,calc((100% - 680px)/2)) calc(24px + env(safe-area-inset-bottom))}.friend-request-card{position:relative;display:grid;grid-template-columns:48px 1fr 18px;align-items:center;gap:13px;padding:15px;margin-bottom:10px;border:1px solid var(--border-color);border-radius:16px;background:var(--card-bg-solid);cursor:pointer;transition:transform .16s,background .16s}.friend-request-card:hover{background:var(--sys-bg-secondary);transform:translateY(-1px)}.friend-request-card:active{transform:scale(.992)}.request-avatar{width:48px;height:48px;border-radius:50%;display:grid;place-items:center;background:var(--sys-bg-tertiary);background-size:cover;background-position:center;font-weight:650}.request-body{min-width:0}.request-name-row{display:flex;align-items:center;justify-content:space-between;gap:10px}.request-name-row strong{font-size:14px}.request-name-row span{padding:2px 7px;border-radius:999px;background:var(--sys-bg-tertiary);font-size:9px;color:var(--text-secondary)}.request-name-row span.pending,.request-name-row span.viewed{background:rgba(52,120,200,.1);color:#3478c8}.request-name-row span.accepted{background:rgba(67,163,111,.1);color:#34835a}.request-name-row span.rejected{background:rgba(216,74,69,.1);color:#c3433f}.request-body>p{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin:7px 0;color:var(--text-secondary);font-size:12px}.request-foot{display:flex;justify-content:space-between;gap:10px;color:var(--text-tertiary);font-size:9px}.request-arrow{color:var(--text-tertiary)}.friends-empty{height:60%;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;color:var(--text-tertiary)}.empty-icon{width:58px;height:58px;border-radius:20px;display:grid;place-items:center;margin-bottom:14px;background:var(--sys-bg-secondary);border:1px solid var(--border-color)}.friends-empty h2{font-size:15px;color:var(--text-secondary);margin:0 0 7px}.friends-empty p{max-width:240px;font-size:11px;line-height:1.55;margin:0}@media(max-width:520px){.friends-header{height:60px;padding-left:10px;padding-right:12px}.friends-main{padding-top:12px}.friend-request-card{border-radius:14px}}
</style>
