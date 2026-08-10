/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import {
  acceptFriendRequest,
  blockCharacter,
  createFriendRequest,
  deleteFriendByUser,
  ensureRelationship,
  formatRelationshipPlan,
  markRequestViewed,
  persistRelationship,
  rejectFriendRequest,
  unblockCharacter,
  type FriendRequestRecord
} from '../../composables/useChatRelationship'
import { useRelationshipAdvance } from '../../composables/useRelationshipAdvance'

const props = defineProps<{ chat: any }>()
const emit = defineEmits<{ (e: 'back'): void }>()
const relationship = computed(() => ensureRelationship(props.chat))
const planText = computed(() => formatRelationshipPlan(relationship.value))
const showBlockedMessages = ref(false)
const confirmAction = ref<'block' | 'unblock' | 'delete_friend' | null>(null)
const requestMessage = ref('')
const showRequestComposer = ref(false)
const rejectingRequest = ref<FriendRequestRecord | null>(null)
const rejectionReason = ref('')
const toast = ref('')
const { isAdvancing, relationshipError, advanceRelationship } = useRelationshipAdvance()

const statusTitle = computed(() => {
  if (relationship.value.blockedBy === 'user') return '你已拉黑对方'
  if (relationship.value.blockedBy === 'character') return '对方已拉黑你'
  if (relationship.value.friendship === 'deleted_by_user') return '你已删除好友'
  if (relationship.value.friendship === 'deleted_by_character') return '对方已删除你'
  return '好友关系正常'
})

const statusDescription = computed(() => {
  if (relationship.value.blockedBy === 'user') return '对方尝试发来的消息会被收进黑名单消息。'
  if (relationship.value.blockedBy === 'character') return '你仍可尝试发送消息，但对方目前看不到。'
  if (relationship.value.friendship !== 'friends') return '角色档案、聊天记录和记忆仍然保留。'
  return '双方可以正常收发消息。'
})

const formatTime = (time?: number) => time ? new Date(time).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''
const requestStatus = (request: FriendRequestRecord) => ({ scheduled: '待发送', pending: '等待查看', viewed: '已查看', accepted: '已同意', rejected: '已拒绝', superseded: '已失效' }[request.status])

const notify = (message: string) => {
  toast.value = message
  window.setTimeout(() => { toast.value = '' }, 1800)
}

const runConfirmedAction = async () => {
  const action = confirmAction.value
  confirmAction.value = null
  if (action === 'block') {
    blockCharacter(props.chat)
    notify('已拉黑对方')
    await safeAdvance('user_blocked_character')
  } else if (action === 'unblock') {
    unblockCharacter(props.chat)
    notify('已移出黑名单')
    await safeAdvance('user_unblocked_character')
  } else if (action === 'delete_friend') {
    deleteFriendByUser(props.chat)
    notify('已删除好友，角色档案仍保留')
    await safeAdvance('user_deleted_friend')
  }
}

const safeAdvance = async (trigger: Parameters<typeof advanceRelationship>[1] = 'manual_advance', request?: FriendRequestRecord) => {
  try {
    await advanceRelationship(props.chat, trigger, request)
    if (trigger === 'manual_advance') notify('角色动向已更新')
  } catch (_) {}
}

const revealBlockedMessages = () => {
  showBlockedMessages.value = !showBlockedMessages.value
  if (showBlockedMessages.value) {
    relationship.value.blockedMessages.forEach(message => { message.viewed = true })
    persistRelationship(props.chat)
  }
}

const submitUserRequest = async () => {
  const request = createFriendRequest(props.chat, 'user_to_character', requestMessage.value)
  requestMessage.value = ''
  showRequestComposer.value = false
  notify('好友申请已发送')
  await safeAdvance('user_sent_request', request)
}

const viewRequest = (request: FriendRequestRecord) => {
  markRequestViewed(props.chat, request)
}

const acceptRequest = (request: FriendRequestRecord) => {
  acceptFriendRequest(props.chat, request)
  notify('已恢复好友关系')
}

const submitReject = async () => {
  if (!rejectingRequest.value) return
  const request = rejectingRequest.value
  rejectFriendRequest(props.chat, request, rejectionReason.value)
  rejectingRequest.value = null
  rejectionReason.value = ''
  notify('已拒绝申请')
  await safeAdvance('user_rejected_request', request)
}

onMounted(() => {
  relationship.value.requests.forEach(request => {
    if (request.direction === 'character_to_user' && request.status === 'pending') markRequestViewed(props.chat, request)
  })
})
</script>

<template>
  <div class="relationship-view">
    <header class="relationship-header">
      <button class="header-icon" type="button" aria-label="返回" @click="emit('back')">
        <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
      </button>
      <div><div class="header-title">关系动态</div><div class="header-subtitle">{{ chat.name }}</div></div>
      <button class="header-progress" type="button" :disabled="isAdvancing" @click="safeAdvance()">
        <svg v-if="!isAdvancing" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 11a8.1 8.1 0 0 0-15.5-2M4 5v4h4"/><path d="M4 13a8.1 8.1 0 0 0 15.5 2M20 19v-4h-4"/></svg>
        <span v-else class="small-spinner"></span><span>推进</span>
      </button>
    </header>

    <main class="relationship-main">
      <section class="status-card" :class="`block-${relationship.blockedBy}`">
        <div class="status-avatar" :style="chat.avatarUrl ? { backgroundImage: `url(${chat.avatarUrl})` } : {}">{{ chat.avatarUrl ? '' : chat.avatarText }}</div>
        <div class="status-copy"><div class="status-eyebrow">当前关系</div><h1>{{ statusTitle }}</h1><p>{{ statusDescription }}</p></div>
        <div class="status-dot"></div>
      </section>

      <section class="plan-card">
        <div class="section-heading"><span>对方下一步</span><span class="live-label"><i></i>实时状态</span></div>
        <div class="plan-content">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
          <span>{{ planText }}</span>
        </div>
        <button class="plan-button" type="button" :disabled="isAdvancing" @click="safeAdvance()">{{ isAdvancing ? '正在询问角色…' : '立即让角色重新考虑' }}</button>
        <p v-if="relationshipError" class="inline-error">{{ relationshipError }}</p>
      </section>

      <section v-if="relationship.blockedBy === 'user'" class="message-vault">
        <button class="vault-toggle" type="button" @click="revealBlockedMessages">
          <span><b>黑名单消息</b><small>{{ relationship.blockedMessages.length ? `收到 ${relationship.blockedMessages.length} 条尝试消息` : '目前没有消息' }}</small></span>
          <span class="vault-action">{{ showBlockedMessages ? '收起' : '查看' }}</span>
        </button>
        <div v-if="showBlockedMessages" class="vault-list">
          <div v-if="!relationship.blockedMessages.length" class="compact-empty">对方还没有尝试发来消息</div>
          <article v-for="message in relationship.blockedMessages" :key="message.id" class="vault-message"><p>{{ message.content }}</p><time>{{ formatTime(message.createdAt) }}</time></article>
        </div>
      </section>

      <section v-if="relationship.requests.length" class="requests-section">
        <div class="section-heading"><span>好友申请</span><small>{{ relationship.requests.length }} 条记录</small></div>
        <article v-for="request in relationship.requests" :key="request.id" class="request-card" @click="viewRequest(request)">
          <div class="request-top"><span class="direction-tag">{{ request.direction === 'character_to_user' ? '对方向你申请' : '你向对方申请' }}</span><span class="request-status" :class="request.status">{{ requestStatus(request) }}</span></div>
          <p>{{ request.message }}</p>
          <div class="request-meta"><span>{{ formatTime(request.sentAt || request.scheduledAt || request.createdAt) }}</span><span v-if="request.viewedAt">查看于 {{ formatTime(request.viewedAt) }}</span></div>
          <div v-if="request.rejectionReason" class="rejection-note">拒绝理由：{{ request.rejectionReason }}</div>
          <div v-if="request.direction === 'character_to_user' && ['pending', 'viewed'].includes(request.status)" class="request-actions">
            <button type="button" class="secondary" @click.stop="rejectingRequest = request">拒绝</button>
            <button type="button" class="primary" @click.stop="acceptRequest(request)">同意</button>
          </div>
        </article>
      </section>

      <section class="timeline-section">
        <div class="section-heading"><span>关系时间线</span><small>最多保留 100 条</small></div>
        <div v-if="!relationship.events.length" class="empty-state">
          <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 12h16M12 4v16"/></svg>
          <span>关系正常，暂无特殊动态</span>
        </div>
        <div v-else class="timeline-list">
          <article v-for="event in relationship.events" :key="event.id" class="timeline-item"><i></i><div><div class="timeline-title">{{ event.title }}</div><p v-if="event.detail">{{ event.detail }}</p><time>{{ formatTime(event.createdAt) }}</time></div></article>
        </div>
      </section>

      <section class="danger-section">
        <div class="section-heading"><span>关系操作</span></div>
        <button v-if="relationship.blockedBy === 'user'" type="button" @click="confirmAction = 'unblock'">移出黑名单</button>
        <button v-else type="button" @click="confirmAction = 'block'">拉黑对方</button>
        <button v-if="relationship.friendship === 'friends'" type="button" class="danger" @click="confirmAction = 'delete_friend'">删除好友</button>
        <button v-else-if="relationship.friendship === 'deleted_by_character'" type="button" class="primary-row" @click="showRequestComposer = true">发送好友申请</button>
        <p>这里的“删除好友”只改变聊天关系，不会删除角色档案。物理删除仍在聊天列表长按菜单中。</p>
      </section>
    </main>

    <transition name="fade"><div v-if="toast" class="relationship-toast">{{ toast }}</div></transition>

    <div v-if="confirmAction" class="relation-modal" @click.self="confirmAction = null">
      <div class="relation-dialog">
        <div class="dialog-icon danger-icon"><svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M12 9v4m0 4h.01"/><path d="M10.3 3.7 2.7 17a2 2 0 0 0 1.7 3h15.2a2 2 0 0 0 1.7-3L13.7 3.7a2 2 0 0 0-3.4 0Z"/></svg></div>
        <h2>{{ confirmAction === 'block' ? '拉黑对方？' : confirmAction === 'unblock' ? '移出黑名单？' : '删除好友？' }}</h2>
        <p>{{ confirmAction === 'block' ? '对方发来的消息将默认隐藏，但你仍可在关系动态中查看。' : confirmAction === 'unblock' ? '解除后，角色可能通过后续互动才发现关系变化。' : '这不会物理删除角色，聊天记录和角色记忆会继续保留。' }}</p>
        <div class="dialog-actions"><button type="button" @click="confirmAction = null">取消</button><button type="button" class="danger-confirm" @click="runConfirmedAction">确认</button></div>
      </div>
    </div>

    <div v-if="showRequestComposer" class="relation-modal" @click.self="showRequestComposer = false">
      <div class="relation-dialog composer"><h2>发送好友申请</h2><label for="request-message">验证消息</label><textarea id="request-message" v-model="requestMessage" maxlength="160" placeholder="写一句你想让对方看到的话"></textarea><div class="char-count">{{ requestMessage.length }}/160</div><div class="dialog-actions"><button type="button" @click="showRequestComposer = false">取消</button><button type="button" class="primary-confirm" @click="submitUserRequest">发送</button></div></div>
    </div>

    <div v-if="rejectingRequest" class="relation-modal" @click.self="rejectingRequest = null">
      <div class="relation-dialog composer"><h2>拒绝好友申请</h2><label for="reject-reason">理由（选填）</label><textarea id="reject-reason" v-model="rejectionReason" maxlength="160" placeholder="不填写也可以直接拒绝"></textarea><div class="char-count">{{ rejectionReason.length }}/160</div><div class="dialog-actions"><button type="button" @click="rejectingRequest = null">取消</button><button type="button" class="danger-confirm" @click="submitReject">拒绝</button></div></div>
    </div>
  </div>
</template>

<style scoped>
.relationship-view{position:absolute;inset:0;z-index:120;display:flex;flex-direction:column;background:var(--sys-bg-primary);color:var(--text-primary)}
.relationship-header{height:64px;padding:env(safe-area-inset-top,0) 16px 0;display:grid;grid-template-columns:44px 1fr auto;align-items:center;gap:10px;background:rgba(255,255,255,.76);backdrop-filter:blur(14px);border-bottom:1px solid var(--border-color);flex:none}.is-dark .relationship-header{background:rgba(28,28,30,.8)}
button{font:inherit}.header-icon,.header-progress{border:0;background:transparent;color:var(--text-primary);cursor:pointer}.header-icon{width:40px;height:40px;border-radius:50%;display:grid;place-items:center}.header-icon:hover{background:var(--sys-bg-tertiary)}.header-title{font-size:16px;font-weight:650}.header-subtitle{margin-top:2px;font-size:11px;color:var(--text-tertiary)}.header-progress{min-height:38px;padding:0 12px;display:flex;align-items:center;gap:6px;border-radius:12px;background:var(--sys-bg-tertiary);font-size:13px;font-weight:600}.header-progress:disabled{opacity:.55;cursor:not-allowed}
.relationship-main{flex:1;overflow:auto;padding:18px max(16px,calc((100% - 720px)/2)) calc(30px + env(safe-area-inset-bottom));scrollbar-width:thin}.status-card,.plan-card,.message-vault,.requests-section,.timeline-section,.danger-section{border:1px solid var(--border-color);background:var(--card-bg-solid);border-radius:18px;margin-bottom:14px}.status-card{position:relative;display:flex;align-items:center;gap:14px;padding:18px;overflow:hidden}.status-avatar{width:54px;height:54px;border-radius:50%;display:grid;place-items:center;background:var(--sys-bg-tertiary);background-size:cover;background-position:center;font-weight:650;flex:none}.status-copy{min-width:0}.status-eyebrow{font-size:11px;color:var(--text-tertiary);margin-bottom:4px}.status-copy h1{font-size:18px;margin:0 0 5px}.status-copy p{font-size:12px;color:var(--text-secondary);line-height:1.55;margin:0}.status-dot{position:absolute;top:17px;right:17px;width:8px;height:8px;border-radius:50%;background:#43a36f;box-shadow:0 0 0 4px rgba(67,163,111,.1)}.block-user .status-dot,.block-character .status-dot{background:#e59a45;box-shadow:0 0 0 4px rgba(229,154,69,.12)}
.plan-card,.requests-section,.timeline-section,.danger-section{padding:16px}.section-heading{display:flex;align-items:center;justify-content:space-between;margin-bottom:13px;font-size:14px;font-weight:650}.section-heading small{font-size:11px;font-weight:400;color:var(--text-tertiary)}.live-label{display:flex;align-items:center;gap:5px;color:var(--text-tertiary);font-size:10px;font-weight:500}.live-label i{width:6px;height:6px;border-radius:50%;background:#43a36f}.plan-content{display:flex;align-items:flex-start;gap:10px;padding:13px;border-radius:13px;background:var(--sys-bg-primary);font-size:13px;line-height:1.5}.plan-content svg{flex:none;color:var(--text-secondary)}.plan-button{width:100%;min-height:42px;margin-top:11px;border:1px solid var(--border-color);border-radius:12px;background:var(--sys-bg-secondary);color:var(--text-primary);font-size:13px;font-weight:600;cursor:pointer}.plan-button:hover{background:var(--sys-bg-tertiary)}.plan-button:active{transform:scale(.99)}.plan-button:focus-visible,.danger-section button:focus-visible,.request-actions button:focus-visible{outline:2px solid #3b82f6;outline-offset:2px}.inline-error{margin:9px 2px 0;color:#d84a45;font-size:11px}
.message-vault{overflow:hidden}.vault-toggle{width:100%;padding:15px 16px;border:0;background:transparent;color:var(--text-primary);display:flex;align-items:center;justify-content:space-between;text-align:left;cursor:pointer}.vault-toggle span:first-child{display:flex;flex-direction:column;gap:4px}.vault-toggle b{font-size:14px}.vault-toggle small{font-size:11px;color:var(--text-tertiary)}.vault-action{font-size:12px;color:#3478c8}.vault-list{padding:0 14px 14px}.vault-message{padding:12px;margin-top:8px;border-radius:12px;background:var(--sys-bg-primary)}.vault-message p{font-size:13px;line-height:1.55}.vault-message time,.compact-empty{font-size:10px;color:var(--text-tertiary)}.compact-empty{text-align:center;padding:18px}
.request-card{padding:14px;border-radius:14px;background:var(--sys-bg-primary);margin-top:10px}.request-top,.request-meta{display:flex;justify-content:space-between;gap:12px}.direction-tag,.request-status{font-size:10px}.direction-tag{color:var(--text-secondary)}.request-status{padding:2px 7px;border-radius:999px;background:var(--sys-bg-tertiary);color:var(--text-secondary)}.request-status.pending,.request-status.viewed{background:rgba(52,120,200,.1);color:#3478c8}.request-status.accepted{background:rgba(67,163,111,.1);color:#34835a}.request-status.rejected{background:rgba(216,74,69,.1);color:#c3433f}.request-card>p{font-size:13px;line-height:1.55;margin:10px 0}.request-meta{font-size:10px;color:var(--text-tertiary)}.rejection-note{margin-top:9px;padding:8px 10px;border-radius:9px;background:rgba(216,74,69,.07);color:#b94440;font-size:11px}.request-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px}.request-actions button{height:38px;border-radius:11px;border:1px solid var(--border-color);cursor:pointer}.request-actions .secondary{background:var(--sys-bg-secondary);color:var(--text-primary)}.request-actions .primary{border-color:var(--text-primary);background:var(--text-primary);color:var(--sys-bg-secondary)}
.timeline-list{position:relative}.timeline-item{position:relative;display:grid;grid-template-columns:16px 1fr;gap:10px;padding:0 0 16px}.timeline-item:not(:last-child)::before{content:"";position:absolute;left:4px;top:10px;bottom:-1px;width:1px;background:var(--border-color)}.timeline-item>i{width:9px;height:9px;margin-top:4px;border:2px solid var(--card-bg-solid);border-radius:50%;background:var(--text-tertiary);box-shadow:0 0 0 1px var(--border-color);z-index:1}.timeline-title{font-size:13px;font-weight:600}.timeline-item p{font-size:11px;color:var(--text-secondary);line-height:1.5;margin:4px 0}.timeline-item time{font-size:10px;color:var(--text-tertiary)}.empty-state{display:flex;flex-direction:column;align-items:center;gap:8px;padding:26px;color:var(--text-tertiary);font-size:12px}
.danger-section button{width:100%;height:44px;margin-top:8px;border:1px solid var(--border-color);border-radius:12px;background:var(--sys-bg-primary);color:var(--text-primary);cursor:pointer}.danger-section button.danger{color:#d84a45}.danger-section button.primary-row{background:var(--text-primary);color:var(--sys-bg-secondary)}.danger-section>p{font-size:10px;color:var(--text-tertiary);line-height:1.55;margin:11px 2px 0}
.relationship-toast{position:fixed;z-index:160;left:50%;bottom:calc(28px + env(safe-area-inset-bottom));transform:translateX(-50%);padding:10px 16px;border-radius:10px;background:rgba(20,20,22,.86);color:white;font-size:12px;white-space:nowrap}.relation-modal{position:fixed;inset:0;z-index:170;display:grid;place-items:center;padding:20px;background:rgba(0,0,0,.38);backdrop-filter:blur(5px)}.relation-dialog{width:min(100%,340px);padding:22px;border:1px solid rgba(255,255,255,.4);border-radius:20px;background:var(--card-bg-solid);box-shadow:0 16px 40px rgba(0,0,0,.16)}.dialog-icon{width:44px;height:44px;border-radius:50%;display:grid;place-items:center;margin:0 auto 12px}.danger-icon{background:rgba(216,74,69,.1);color:#d84a45}.relation-dialog h2{text-align:center;font-size:17px;margin:0 0 8px}.relation-dialog>p{text-align:center;font-size:12px;color:var(--text-secondary);line-height:1.6}.dialog-actions{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:18px}.dialog-actions button{height:42px;border:1px solid var(--border-color);border-radius:12px;background:var(--sys-bg-primary);color:var(--text-primary);cursor:pointer}.dialog-actions .danger-confirm{border-color:#d84a45;background:#d84a45;color:white}.dialog-actions .primary-confirm{border-color:var(--text-primary);background:var(--text-primary);color:var(--sys-bg-secondary)}.composer h2{text-align:left}.composer label{display:block;margin:15px 0 7px;font-size:12px;color:var(--text-secondary)}.composer textarea{width:100%;height:92px;resize:none;padding:11px;border:1px solid var(--border-color);border-radius:12px;outline:0;background:var(--sys-bg-primary);color:var(--text-primary);font:inherit;font-size:13px;line-height:1.5}.composer textarea:focus{border-color:#6c8fb8;box-shadow:0 0 0 3px rgba(67,120,184,.1)}.char-count{text-align:right;margin-top:5px;font-size:10px;color:var(--text-tertiary)}.small-spinner{width:15px;height:15px;border:2px solid var(--border-color);border-top-color:currentColor;border-radius:50%;animation:relation-spin .7s linear infinite}@keyframes relation-spin{to{transform:rotate(360deg)}}
@media (max-width:520px){.relationship-header{height:58px;padding-left:10px;padding-right:12px}.relationship-main{padding:14px 12px calc(24px + env(safe-area-inset-bottom))}.status-card,.plan-card,.message-vault,.requests-section,.timeline-section,.danger-section{border-radius:16px}.status-card{padding:16px}.status-avatar{width:48px;height:48px}.status-copy h1{font-size:16px}}
@media (prefers-reduced-motion:reduce){*,*::before,*::after{scroll-behavior:auto!important;transition:none!important;animation-duration:.01ms!important}}
</style>
