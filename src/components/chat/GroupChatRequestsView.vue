<!-- WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ -->
<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useChatAuth } from '../../composables/useChatAuth'
import { useChatState } from '../../composables/useChatState'
import { readGroupChats, saveGroupChat } from '../../services/groupChat'
import { groupManagementService } from '../../services/groupManagementService'
import type { GroupMembershipRequest } from '../../types/groupManagement'

const emit = defineEmits<{ (e: 'back'): void; (e: 'updated'): void }>()
const { currentChatUserId } = useChatAuth()
const { mockChats } = useChatState()
const groups = ref<any[]>([])
const activeTab = ref<'received' | 'invited' | 'history'>('received')
const busyId = ref('')
const errorText = ref('')

const reload = () => { groups.value = readGroupChats(currentChatUserId.value) }
const rows = computed(() => groups.value.flatMap(group => (group.membershipRequests || []).map((request: GroupMembershipRequest) => ({ group, request }))))
const visibleRows = computed(() => rows.value.filter(({ request }) => {
  if (activeTab.value === 'history') return request.status !== 'pending'
  if (request.status !== 'pending') return false
  return activeTab.value === 'received' ? request.kind === 'rejoin_application' : request.kind === 'former_member_invitation'
}))
const avatar = (memberId: string) => mockChats.value.find(chat => chat.chatType !== 'group' && String(chat.characterEntityId || chat.id) === String(memberId))?.avatarUrl || ''
const formatTime = (time: number) => new Date(time).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
const statusText = (request: GroupMembershipRequest) => request.status === 'pending' ? (request.kind === 'rejoin_application' ? '等待审批' : '等待回应') : ({ accepted: '已同意', rejected: '已拒绝', cancelled: '已失效' } as Record<string, string>)[request.status] || request.status

const review = async (group: any, request: GroupMembershipRequest, accepted: boolean) => {
  busyId.value = request.id; errorText.value = ''
  try {
    groupManagementService.reviewRejoinApplication(group, 'user', request.id, accepted)
    saveGroupChat(currentChatUserId.value, group)
    reload()
    emit('updated')
  } catch (error: any) { errorText.value = error?.message || '处理申请失败' }
  finally { busyId.value = '' }
}

onMounted(() => { reload(); window.addEventListener('clingy:group-requests-updated', reload) })
onUnmounted(() => window.removeEventListener('clingy:group-requests-updated', reload))
</script>

<template>
  <div class="friends-view">
    <header class="friends-header">
      <button type="button" aria-label="返回" @click="emit('back')"><svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m15 18-6-6 6-6"/></svg></button>
      <div><h1>群聊申请</h1><p>仅显示主动退群或被移出成员的再次入群动态</p></div>
      <span class="request-count">{{ rows.length }}</span>
    </header>
    <nav class="request-tabs" aria-label="群聊申请分类">
      <button v-for="tab in ([['received','收到的'],['invited','已邀请'],['history','历史']] as const)" :key="tab[0]" type="button" :class="{ active: activeTab === tab[0] }" @click="activeTab = tab[0]">{{ tab[1] }}</button>
    </nav>
    <div v-if="errorText" class="request-error">{{ errorText }}</div>
    <main class="friends-main">
      <div v-if="!visibleRows.length" class="friends-empty">
        <div class="empty-icon"><svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17 20v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9.5" cy="6" r="4"/><path d="m16 11 2 2 4-5"/></svg></div>
        <h2>{{ activeTab === 'history' ? '还没有历史记录' : '暂时没有新的群聊申请' }}</h2>
        <p>陌生角色不会出现在这里，只有曾经属于该群的成员能够再次申请或收到邀请。</p>
      </div>
      <article v-for="item in visibleRows" :key="item.request.id" class="friend-request-card">
        <div class="request-avatar" :style="avatar(item.request.memberId) ? { backgroundImage: `url(${avatar(item.request.memberId)})` } : {}">{{ avatar(item.request.memberId) ? '' : item.request.memberName.charAt(0) }}</div>
        <div class="request-body">
          <div class="request-name-row"><strong>{{ item.request.memberName }}</strong><span :class="item.request.status">{{ statusText(item.request) }}</span></div>
          <p>{{ item.request.message || (item.request.kind === 'rejoin_application' ? '申请重新加入群聊' : '已收到重新入群邀请') }}</p>
          <div class="request-foot"><span>{{ item.group.name }} · {{ item.request.removalSource === 'left' ? '曾主动退群' : '曾被移出' }}</span><time>{{ formatTime(item.request.updatedAt || item.request.createdAt) }}</time></div>
          <div v-if="item.request.kind === 'rejoin_application' && item.request.status === 'pending'" class="request-actions">
            <button type="button" :disabled="busyId === item.request.id" @click="review(item.group, item.request, false)">拒绝</button>
            <button type="button" class="primary" :disabled="busyId === item.request.id" @click="review(item.group, item.request, true)">{{ busyId === item.request.id ? '处理中…' : '同意入群' }}</button>
          </div>
        </div>
      </article>
    </main>
  </div>
</template>

<style scoped>
.friends-view{position:absolute;inset:0;z-index:90;display:flex;flex-direction:column;background:var(--sys-bg-primary);color:var(--text-primary)}.friends-header{height:68px;display:grid;grid-template-columns:44px 1fr 36px;align-items:center;gap:10px;padding:env(safe-area-inset-top,0) 16px 0;background:rgba(255,255,255,.78);backdrop-filter:blur(14px);border-bottom:1px solid var(--border-color)}.is-dark .friends-header{background:rgba(28,28,30,.82)}.friends-header button{width:40px;height:40px;border:0;border-radius:50%;display:grid;place-items:center;background:transparent;color:var(--text-primary);cursor:pointer}.friends-header button:hover{background:var(--sys-bg-tertiary)}.friends-header h1{font-size:17px;margin:0}.friends-header p{font-size:10px;color:var(--text-tertiary);margin:3px 0 0}.request-count{min-width:27px;height:27px;padding:0 7px;border-radius:14px;display:grid;place-items:center;background:var(--sys-bg-tertiary);font-size:11px;color:var(--text-secondary)}.request-tabs{display:grid;grid-template-columns:repeat(3,1fr);gap:4px;padding:10px max(14px,calc((100% - 680px)/2));background:var(--sys-bg-secondary);border-bottom:1px solid var(--border-color)}.request-tabs button{height:36px;border:0;border-radius:10px;background:transparent;color:var(--text-secondary);font:inherit;font-size:13px;cursor:pointer}.request-tabs button.active{background:var(--sys-bg-tertiary);color:var(--text-primary);font-weight:650}.friends-main{flex:1;overflow:auto;padding:15px max(14px,calc((100% - 680px)/2)) calc(24px + env(safe-area-inset-bottom))}.friend-request-card{display:grid;grid-template-columns:48px minmax(0,1fr);align-items:start;gap:13px;padding:15px;margin-bottom:10px;border:1px solid var(--border-color);border-radius:16px;background:var(--card-bg-solid)}.request-avatar{width:48px;height:48px;border-radius:50%;display:grid;place-items:center;background:var(--sys-bg-tertiary);background-size:cover;background-position:center;font-weight:650}.request-body{min-width:0}.request-name-row{display:flex;align-items:center;justify-content:space-between;gap:10px}.request-name-row strong{font-size:14px}.request-name-row span{padding:2px 7px;border-radius:999px;background:var(--sys-bg-tertiary);font-size:9px;color:var(--text-secondary)}.request-name-row span.pending{background:rgba(52,120,200,.1);color:#3478c8}.request-name-row span.accepted{background:rgba(67,163,111,.1);color:#34835a}.request-name-row span.rejected{background:rgba(216,74,69,.1);color:#c3433f}.request-body>p{margin:7px 0;color:var(--text-secondary);font-size:12px;line-height:1.5}.request-foot{display:flex;justify-content:space-between;gap:10px;color:var(--text-tertiary);font-size:9px}.request-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:13px}.request-actions button{height:38px;border:0;border-radius:10px;background:var(--sys-bg-tertiary);color:var(--text-secondary);font:600 11px inherit;cursor:pointer}.request-actions button.primary{background:var(--text-primary);color:var(--sys-bg-secondary)}.request-actions button:disabled{opacity:.5;cursor:default}.request-error{margin:10px 14px 0;padding:9px 12px;border-radius:10px;background:rgba(190,76,70,.08);color:#b64c48;font-size:11px}.friends-empty{height:60%;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;color:var(--text-tertiary)}.empty-icon{width:58px;height:58px;border-radius:20px;display:grid;place-items:center;margin-bottom:14px;background:var(--sys-bg-secondary);border:1px solid var(--border-color)}.friends-empty h2{font-size:15px;color:var(--text-secondary);margin:0 0 7px}.friends-empty p{max-width:280px;font-size:11px;line-height:1.55;margin:0}@media(max-width:520px){.friends-header{height:60px;padding-left:10px;padding-right:12px}.friend-request-card{border-radius:14px}}
</style>
