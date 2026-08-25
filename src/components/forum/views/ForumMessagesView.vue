/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { computed, ref } from 'vue'
import type { ForumConversation, ForumFriendRequest, ForumNotification, ForumUser } from '../../../types/forum'
import ForumHeader from '../components/ForumHeader.vue'
import ForumAvatar from '../components/ForumAvatar.vue'
import ForumEmptyState from '../components/ForumEmptyState.vue'

const props = defineProps<{ conversations: ForumConversation[]; notifications?: ForumNotification[]; users?: ForumUser[]; friendRequests?: ForumFriendRequest[]; currentAccountId: string }>()
const emit = defineEmits<{ (e: 'back'): void; (e: 'click-conversation', conversation: ForumConversation): void; (e: 'click-user', user: ForumUser): void; (e: 'create-group', name: string, members: string[]): void; (e: 'accept-friend', requestId: string): void; (e: 'reject-friend', requestId: string): void; (e: 'resolve-friend', targetId: string): void }>()
const tab = ref<'notice' | 'direct' | 'group' | 'request'>('direct')
const creating = ref(false)
const groupName = ref('')
const members = ref<string[]>([])
const rows = computed(() => props.conversations.filter(item => tab.value === 'group' ? item.kind === 'group' : item.kind !== 'group' && item.requestState !== 'pending'))
const requestRows = computed(() => (props.friendRequests || []).map(request => {
  const outgoing = request.requesterAccountId === props.currentAccountId
  const targetId = outgoing ? request.receiverAccountId : request.requesterAccountId
  return { request, outgoing, user: props.users?.find(user => user.id === targetId) }
}))
const submit = () => {
  if (!groupName.value.trim()) return
  emit('create-group', groupName.value, members.value)
  groupName.value = ''; members.value = []; creating.value = false; tab.value = 'group'
}
const requestStatus = (status: ForumFriendRequest['status']) => ({ pending: '待处理', accepted: '已同意', rejected: '已拒绝', cancelled: '已取消' }[status])
</script>

<template>
  <div class="messages-view">
    <ForumHeader title="消息" show-back @back="emit('back')"><template #right><button class="head-action" type="button" @click="creating=!creating">{{creating?'取消':'建群'}}</button></template></ForumHeader>
    <nav class="message-tabs"><button :class="{active:tab==='notice'}" @click="tab='notice'">通知</button><button :class="{active:tab==='direct'}" @click="tab='direct'">私信</button><button :class="{active:tab==='group'}" @click="tab='group'">群</button><button :class="{active:tab==='request'}" @click="tab='request'">好友申请</button></nav>
    <form v-if="creating" class="group-form" @submit.prevent="submit"><input v-model="groupName" maxlength="24" placeholder="群名"><div class="member-picks"><label v-for="user in users" :key="user.id"><input v-model="members" type="checkbox" :value="user.id"><span>{{user.name}}</span></label></div><button :disabled="!groupName.trim()">创建群聊</button></form>
    <div class="message-scroll">
      <template v-if="tab==='notice'"><button v-for="notice in notifications" :key="notice.id" class="notice-row"><span class="notice-dot"></span><span><b>{{notice.text}}</b><small>{{new Date(notice.createdAt).toLocaleString('zh-CN')}}</small></span></button><ForumEmptyState v-if="!notifications?.length" title="暂无通知" description="点赞、回复、关注和圈子消息会出现在这里"/></template>
      <template v-else-if="tab==='request'"><article v-for="item in requestRows" :key="item.request.id" class="friend-request-row"><ForumAvatar :src="item.user?.avatar||''" :name="item.user?.name||'论坛用户'" size="md"/><div><b>{{item.user?.name||'论坛用户'}}</b><p>{{item.request.message}}</p><small>{{item.outgoing?'你发出的申请':'对方向你申请'}} · {{requestStatus(item.request.status)}}</small></div><span v-if="item.request.status==='pending'" class="request-actions"><button v-if="item.outgoing" type="button" @click="item.user&&emit('resolve-friend',item.user.id)">生成答复</button><template v-else><button type="button" @click="emit('accept-friend',item.request.id)">同意</button><button class="reject" type="button" @click="emit('reject-friend',item.request.id)">拒绝</button></template></span></article><ForumEmptyState v-if="!requestRows.length" title="暂无好友申请" description="论坛私信不会自动成为聊天好友"/></template>
      <template v-else><button v-for="conv in rows" :key="conv.id" class="conversation-row" @click="emit('click-conversation',conv)"><div class="avatar-col"><ForumAvatar :src="conv.user.avatar" :name="conv.user.name" size="md" @click.stop="emit('click-user',conv.user)"/><span v-if="conv.unreadCount" class="unread-badge">{{conv.unreadCount}}</span></div><span class="info-col"><span><b>{{conv.user.name}}</b><em>{{conv.lastMessageTime}}</em></span><small>{{conv.lastMessage}}</small></span></button><ForumEmptyState v-if="!rows.length" :title="tab==='group'?'暂无群聊':'暂无私信'" description="这里还没有新内容"/></template>
    </div>
  </div>
</template>

<style scoped>
.messages-view{display:flex;flex-direction:column;height:100%;background:var(--sys-bg-primary,#f5f5f7)}.head-action{border:0;background:transparent;color:var(--accent-color,#2b7de9);padding:5px;font-size:12px}.message-tabs{display:flex;gap:3px;padding:7px 10px;background:var(--sys-bg-secondary,#fff);border-bottom:1px solid var(--border-color,rgba(0,0,0,.06))}.message-tabs button{flex:1;height:29px;border:0;border-radius:8px;background:transparent;color:var(--text-secondary,#777);font-size:11px}.message-tabs button.active{background:var(--sys-bg-tertiary,#f0f1f3);color:var(--text-primary,#222);font-weight:600}.group-form{padding:9px 12px;background:var(--sys-bg-secondary,#fff);border-bottom:1px solid var(--border-color,rgba(0,0,0,.06))}.group-form>input{box-sizing:border-box;width:100%;height:32px;border:1px solid var(--border-color,#ddd);border-radius:8px;background:var(--sys-bg-primary,#f7f7f8);padding:0 8px;color:var(--text-primary,#222)}.member-picks{display:flex;gap:5px;overflow:auto;padding:7px 0}.member-picks label{position:relative;flex:0 0 auto}.member-picks input{position:absolute;opacity:0}.member-picks span{display:block;border-radius:999px;background:var(--sys-bg-primary,#f1f2f4);padding:5px 8px;color:var(--text-secondary,#777);font-size:10.5px}.member-picks input:checked+span{color:var(--accent-color,#576b95)}.group-form>button{height:29px;border:0;border-radius:8px;background:var(--accent-color,#2b7de9);color:#fff;padding:0 11px}.message-scroll{flex:1;overflow:auto;background:var(--sys-bg-secondary,#fff)}.conversation-row,.notice-row{display:flex;width:100%;align-items:center;gap:11px;min-height:60px;padding:9px 16px;border:0;border-bottom:1px solid var(--border-color,rgba(0,0,0,.055));background:transparent;color:var(--text-primary,#222);text-align:left}.avatar-col{position:relative}.unread-badge{position:absolute;top:-2px;right:-2px;display:grid;min-width:15px;height:15px;place-items:center;border-radius:999px;background:#e05252;color:#fff;font-size:9px}.info-col{display:flex;min-width:0;flex:1;flex-direction:column;gap:4px}.info-col>span{display:flex;justify-content:space-between;gap:9px}.info-col b{overflow:hidden;font-size:13.5px;white-space:nowrap;text-overflow:ellipsis}.info-col em{color:var(--text-tertiary,#999);font-size:10px;font-style:normal}.info-col small{overflow:hidden;color:var(--text-secondary,#777);font-size:11.5px;white-space:nowrap;text-overflow:ellipsis}.notice-dot{flex:0 0 8px;height:8px;border-radius:50%;background:var(--accent-color,#576b95)}.notice-row>span:last-child{display:flex;flex-direction:column;gap:4px}.notice-row b{font-size:12.5px}.notice-row small{font-size:10px;color:var(--text-tertiary,#999)}.friend-request-row{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:10px;padding:11px 14px;border-bottom:1px solid var(--border-color,rgba(0,0,0,.055))}.friend-request-row>div{min-width:0}.friend-request-row b{font-size:12.5px}.friend-request-row p{margin:3px 0;color:var(--text-secondary,#666);font-size:10.5px;line-height:1.35}.friend-request-row small{color:var(--text-tertiary,#999);font-size:9px}.request-actions{display:flex;gap:4px}.request-actions button{height:27px;border:0;border-radius:7px;background:var(--accent-color,#576b95);color:#fff;padding:0 8px;font-size:9.5px}.request-actions button.reject{background:var(--sys-bg-primary,#eee);color:#b14a4a}@media(max-width:340px){.conversation-row,.notice-row{padding-left:12px;padding-right:12px}.message-tabs button{font-size:10px}}
</style>
