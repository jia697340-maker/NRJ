/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { globalSettings } from '../store/global'
import { useForum } from '../composables/useForum'
import type { ForumBridgeMode, ForumCircle, ForumGenerationConfig, ForumMediaItem, ForumMemoryType, ForumPost, ForumUser } from '../types/forum'
import ForumBottomNav from './forum/components/ForumBottomNav.vue'
import ForumLoadingSkeleton from './forum/components/ForumLoadingSkeleton.vue'
import ForumFeedView from './forum/views/ForumFeedView.vue'
import ForumPostDetailView from './forum/views/ForumPostDetailView.vue'
import ForumProfileView from './forum/views/ForumProfileView.vue'
import ForumMessagesView from './forum/views/ForumMessagesView.vue'
import ForumChatRoomView from './forum/views/ForumChatRoomView.vue'
import ForumSearchView from './forum/views/ForumSearchView.vue'
import ForumOnboardingView from './forum/views/ForumOnboardingView.vue'
import ForumCirclesView from './forum/views/ForumCirclesView.vue'
import ForumCircleView from './forum/views/ForumCircleView.vue'
import ForumComposerView from './forum/views/ForumComposerView.vue'
import ForumSettingsView from './forum/views/ForumSettingsView.vue'
import ForumRefreshModal from './forum/modals/ForumRefreshModal.vue'
import ForumNpcManageModal from './forum/modals/ForumNpcManageModal.vue'

const emit=defineEmits<{(e:'close'):void}>()
const forum=useForum()
const composerRef=ref<InstanceType<typeof ForumComposerView>|null>(null)
const mediaBusy=ref(false)
const mediaError=ref('')
const managedUser=ref<ForumUser|null>(null)
const refreshVisible=ref(false)
const refreshProfileAccountId=ref<string|undefined>()
const apiFallbackNotice=ref('')
const managedNpc=ref<ForumUser|null>(null)
const statusPosition=ref<{x:number;y:number}|null>(null)
const isDraggingStatus=ref(false)
let dragStartPointer={x:0,y:0}
let dragStartPos={x:0,y:0}
let hasDraggedStatus=false
let fallbackTimer:ReturnType<typeof setTimeout>|undefined
const handleApiFallback=(event:Event)=>{const detail=(event as CustomEvent).detail||{};apiFallbackNotice.value=`论坛专用节点失败，已按设置回退默认节点：${detail.message||'未知错误'}`;if(fallbackTimer)clearTimeout(fallbackTimer);fallbackTimer=setTimeout(()=>apiFallbackNotice.value='',6000)}
onMounted(()=>window.addEventListener('nrj:forum-api-fallback',handleApiFallback))
onUnmounted(()=>{window.removeEventListener('nrj:forum-api-fallback',handleApiFallback);if(fallbackTimer)clearTimeout(fallbackTimer)})

const handleStatusPointerDown=(e:PointerEvent)=>{
  const target=e.currentTarget as HTMLElement
  if(!target)return
  target.setPointerCapture(e.pointerId)
  isDraggingStatus.value=true
  hasDraggedStatus=false
  dragStartPointer={x:e.clientX,y:e.clientY}
  const rect=target.getBoundingClientRect()
  const containerRect=target.closest('.forum-app-container')?.getBoundingClientRect()
  const currentLeft=containerRect?(rect.left-containerRect.left):rect.left
  const currentTop=containerRect?(rect.top-containerRect.top):rect.top
  dragStartPos={x:statusPosition.value?statusPosition.value.x:currentLeft,y:statusPosition.value?statusPosition.value.y:currentTop}
}

const handleStatusPointerMove=(e:PointerEvent)=>{
  if(!isDraggingStatus.value)return
  const dx=e.clientX-dragStartPointer.x
  const dy=e.clientY-dragStartPointer.y
  if(!hasDraggedStatus&&Math.hypot(dx,dy)>4)hasDraggedStatus=true
  if(hasDraggedStatus){
    const target=e.currentTarget as HTMLElement
    const container=target?.closest('.forum-app-container') as HTMLElement|null
    const containerWidth=container?container.clientWidth:window.innerWidth
    const containerHeight=container?container.clientHeight:window.innerHeight
    const width=target?target.offsetWidth:120
    const height=target?target.offsetHeight:32
    const minX=8
    const maxX=Math.max(8,containerWidth-width-8)
    const minY=8
    const maxY=Math.max(8,containerHeight-height-8)
    statusPosition.value={
      x:Math.min(maxX,Math.max(minX,dragStartPos.x+dx)),
      y:Math.min(maxY,Math.max(minY,dragStartPos.y+dy))
    }
  }
}

const handleStatusPointerUp=(e:PointerEvent)=>{
  if(!isDraggingStatus.value)return
  const target=e.currentTarget as HTMLElement
  if(target&&target.hasPointerCapture(e.pointerId))target.releasePointerCapture(e.pointerId)
  isDraggingStatus.value=false
}

const handleStatusClick=()=>{
  if(hasDraggedStatus)return
  refreshVisible.value=true
}

const characterUsers=computed(()=>{
  const activeSourceIds=new Set(forum.listParticipantCandidates().map(entry=>entry.entityId))
  return forum.forumUsers.value.filter(user=>{
    if(user.lifecycle!=='character')return false
    const subject=forum.snapshot.value.subjects.find(item=>item.id===user.subjectId)
    return Boolean(subject?.sourceId&&activeSourceIds.has(subject.sourceId))
  })
})
const openGenerator=()=>{forum.error.value='';forum.syncParticipantCandidates();refreshProfileAccountId.value=undefined;refreshVisible.value=true}
const refreshNpcProfile=(user:ForumUser)=>{refreshProfileAccountId.value=user.id;refreshVisible.value=true}
const managedNpcPersona=computed(()=>managedNpc.value?forum.snapshot.value.personas.find(item=>item.accountId===managedNpc.value!.id)||null:null)
const runGeneration=async(config:ForumGenerationConfig)=>{if(await forum.generateNewContent(config))refreshVisible.value=false}
const activeDetailPost=computed(()=>{const route=forum.currentRoute.value;return route.name==='post_detail'?forum.posts.value.find(item=>item.id===route.postId)||null:null})
const activeProfileUser=computed(()=>{
  const route=forum.currentRoute.value
  if(route.name==='user_profile')return forum.forumUsers.value.find(item=>item.id===route.userId)||null
  return forum.currentForumUser.value
})
const activeChatUser=computed(()=>{
  const route=forum.currentRoute.value
  if(route.name!=='chat_room')return null
  return forum.forumUsers.value.find(item=>item.id===route.userId)||forum.conversations.value.find(item=>item.user.id===route.userId)?.user||null
})
const activeConversation=computed(()=>{
  const route=forum.currentRoute.value
  if(route.name!=='chat_room')return null
  return forum.conversations.value.find(item=>item.user.id===route.userId)||(activeChatUser.value?forum.conversations.value.find(item=>item.kind!=='group'&&item.participantAccountIds.includes(activeChatUser.value!.id)):null)
})
const activeChatMessages=computed(()=>activeConversation.value?forum.conversationMessages(activeConversation.value.id).map(message=>({...message,isSelf:message.senderId===forum.currentAccount.value?.id})):[])
const isJoined=(circle:ForumCircle)=>forum.snapshot.value.memberships.some(item=>item.circleId===circle.id&&item.accountId===forum.currentAccount.value?.id&&!['pending','banned'].includes(item.role))
const openPost=(post:ForumPost)=>{forum.markPostOpened(post.id);forum.pushRoute({name:'post_detail',postId:post.id})}
const openUser=(user:ForumUser)=>{if(!user.id.startsWith('anon_')&&!user.id.startsWith('group:'))forum.pushRoute({name:'user_profile',userId:user.id})}
const openChat=(user:ForumUser)=>forum.pushRoute({name:'chat_room',userId:user.id})
const openConversation=(conversation:any)=>forum.pushRoute({name:'chat_room',userId:conversation.user.id})
const openCircle=(circle:ForumCircle)=>forum.pushRoute({name:'circle',circleId:circle.id})
const handleBack=()=>{if(forum.routeStack.value.length>1)forum.popRoute();else emit('close')}
const uploadMedia=async(file:File,type:ForumMediaItem['type'])=>{const item=await forum.importMediaFile(file,type);item.url=URL.createObjectURL(file);composerRef.value?.addMedia(item)}
const runMediaTask=async(task:()=>Promise<ForumMediaItem>)=>{if(mediaBusy.value)return;mediaBusy.value=true;mediaError.value='';try{composerRef.value?.addMedia(await task())}catch(cause){mediaError.value=cause instanceof Error?cause.message:String(cause)}finally{mediaBusy.value=false}}
const changeBridge=(subjectId:string,direction:'forumToChat'|'chatToForum',mode:ForumBridgeMode)=>{const existing=forum.snapshot.value.bridgePolicies.find(item=>item.subjectId===subjectId);const memoryTypes=existing?.[direction].memoryTypes||[];const defaults:ForumMemoryType[]=direction==='forumToChat'?['post','comment','dm','important-event']:['chat-daily','important-event','relationship'];forum.updateBridgePolicy(subjectId,{[direction]:{mode,memoryTypes:mode==='selected'&&!memoryTypes.length?defaults:memoryTypes}})}
const changeBridgeTypes=(subjectId:string,direction:'forumToChat'|'chatToForum',memoryTypes:ForumMemoryType[])=>{const existing=forum.snapshot.value.bridgePolicies.find(item=>item.subjectId===subjectId);forum.updateBridgePolicy(subjectId,{[direction]:{mode:existing?.[direction].mode||'selected',memoryTypes}})}
const chooseFriendChatOptions=()=>{if(!window.confirm('同意论坛好友后，是否同时添加到聊天 App？\n取消则仅保留论坛好友。'))return false;const candidates=forum.listParticipantCandidates().filter(entry=>entry.entityId);if(candidates.length&&window.confirm('是否关联到已有聊天联系人？\n取消则创建独立联系人。')){const listing=candidates.map((entry,index)=>`${index+1}. ${entry.socialProfile?.nickname||entry.name} (${entry.entityId})`).join('\n');const selected=window.prompt(`输入要关联的序号；取消则不创建聊天关联：\n${listing}`);if(selected===null)return false;const entry=candidates[Number(selected)-1];if(entry)return{create:true,existingEntityId:entry.entityId,copyAvatar:false,copyPublicProfile:false,copyPersona:false,copySummary:false}}return{create:true,copyAvatar:window.confirm('复制论坛头像到新联系人？'),copyPublicProfile:window.confirm('复制论坛公开资料？'),copyPersona:window.confirm('复制 NPC persona？'),copySummary:window.confirm('复制论坛私聊/互动摘要？（默认建议取消）')}}
const handleFriendAction=async(user:ForumUser,fromChat=false)=>{const status=forum.forumFriendStatus(user.id);if(status==='incoming'){const request=forum.friendRequests.value.find(item=>item.status==='pending'&&item.requesterAccountId===user.id&&item.receiverAccountId===forum.currentAccount.value?.id);if(request)await forum.acceptForumFriendRequest(request.id,chooseFriendChatOptions())}else if(status==='outgoing'||fromChat)await forum.generateForumFriendDecision(user.id);else forum.sendForumFriendRequest(user.id)}
const acceptFriendFromList=(requestId:string)=>forum.acceptForumFriendRequest(requestId,chooseFriendChatOptions())
const assignNpcAvatar=(accountId:string,avatarId:string)=>{if(!forum.assignAvatarToAccount(accountId,avatarId))window.alert('该头像正在被有效 NPC 使用。请换一张，或在头像库开启极低概率复用。')}
</script>

<template>
  <div class="forum-app-container" :class="{'is-dark':globalSettings.darkMode,'is-light':!globalSettings.darkMode}">
    <div v-if="!forum.ready.value" class="forum-loading"><ForumLoadingSkeleton/></div>
    <ForumOnboardingView v-else-if="!forum.snapshot.value.settings.initialized" @complete="forum.completeOnboarding"/>
    <template v-else-if="forum.currentForumUser.value">
      <main class="forum-main-viewport">
        <ForumPostDetailView v-if="forum.currentRoute.value.name==='post_detail'&&activeDetailPost" :post="activeDetailPost" :comments="forum.commentsByPost.value[activeDetailPost.id]||[]" :busy="forum.busy.value" :error="forum.error.value" :current-account-id="forum.currentAccount.value?.id" :refreshing-comment-id="forum.communityResponseBusyCommentId.value" @back="forum.popRoute" @click-user="openUser" @like="p=>forum.toggleLikePost(p.id)" @like-comment="c=>forum.toggleLikeComment(c.id)" @bookmark="p=>forum.toggleBookmarkPost(p.id)" @send-comment="(text,reply,options)=>forum.addComment(activeDetailPost!.id,text,reply,options)" @refresh-response="c=>forum.regenerateCommunityResponse(c.id)" @generate-comments="(mode,count)=>forum.generatePostComments(activeDetailPost!.id,mode,count)" @adjust-pending="(id,minutes)=>forum.adjustPendingReply('comment',id,minutes)"/>
        <ForumProfileView v-else-if="forum.currentRoute.value.name==='user_profile'&&activeProfileUser" :user="activeProfileUser" :posts="forum.posts.value" :is-self="activeProfileUser.id===forum.currentForumUser.value.id" :friend-status="forum.forumFriendStatus(activeProfileUser.id)" show-back @back="forum.popRoute" @toggle-follow="forum.toggleFollowUser" @send-dm="openChat" @friend-action="handleFriendAction" @manage-user="user=>managedUser=user" @manage-npc="user=>managedNpc=user" @refresh-profile="refreshNpcProfile" @edit-profile="forum.pushRoute({name:'settings'})" @click-post="openPost" @like="p=>forum.toggleLikePost(p.id)" @bookmark="p=>forum.toggleBookmarkPost(p.id)"/>
        <ForumChatRoomView v-else-if="forum.currentRoute.value.name==='chat_room'&&activeChatUser" :target-user="activeChatUser" :messages="activeChatMessages" :busy="activeConversation?forum.isConversationGenerating(activeConversation.id):false" :error="forum.error.value" :default-timing="forum.snapshot.value.settings.dm.replyTiming" :friend-feedback="forum.friendFeedback.value" :friend-status="forum.forumFriendStatus(activeChatUser.id)" :allow-friend="activeConversation?.kind!=='group'" @back="forum.popRoute" @click-user="openUser" @send="text=>activeConversation?.kind==='group'?forum.sendGroupMessage(activeConversation.groupId!,text):forum.sendDirectMessage(activeChatUser!.id,text)" @generate-reply="timing=>activeConversation&&forum.generateConversationReply(activeConversation.id,timing)" @adjust-pending="(id,minutes)=>forum.adjustPendingReply('message',id,minutes)" @friend-action="handleFriendAction(activeChatUser!,true)"/>
        <ForumSearchView v-else-if="forum.currentRoute.value.name==='search'" :posts="forum.posts.value" :topics="forum.snapshot.value.topics" :users="forum.forumUsers.value" :circles="forum.circles.value" @back="forum.popRoute" @click-post="openPost" @click-user="openUser" @click-circle="openCircle" @toggle-follow="forum.toggleFollowUser" @like="p=>forum.toggleLikePost(p.id)" @bookmark="p=>forum.toggleBookmarkPost(p.id)"/>
        <ForumComposerView v-else-if="forum.currentRoute.value.name==='publish'" ref="composerRef" :current-user="forum.currentForumUser.value" :circles="forum.circles.value.filter(isJoined)" :initial-circle-id="forum.currentRoute.value.circleId" :media-busy="mediaBusy" :media-error="mediaError" @back="forum.popRoute" @media="uploadMedia" @generate-image="prompt=>runMediaTask(()=>forum.generateImageMedia(prompt))" @generate-voice="text=>runMediaTask(()=>forum.generateVoiceMedia(text))" @build-video="value=>runMediaTask(()=>forum.buildLightVideo(value.image,value.voice,value.subtitle))" @publish="forum.publishNewPost"/>
        <ForumCircleView v-else-if="forum.currentRoute.value.name==='circle'&&forum.currentCircle.value" :circle="forum.currentCircle.value" :posts="forum.circlePosts.value" :joined="isJoined(forum.currentCircle.value)" :busy="forum.busy.value" :error="forum.error.value" @back="forum.popRoute" @join="forum.joinCircle(forum.currentCircle.value!.id)" @publish="forum.pushRoute({name:'publish',circleId:forum.currentCircle.value!.id})" @generate="openGenerator" @settings="forum.pushRoute({name:'settings',section:'circles'})" @click-post="openPost" @click-user="openUser" @like="p=>forum.toggleLikePost(p.id)" @bookmark="p=>forum.toggleBookmarkPost(p.id)"/>
        <ForumSettingsView v-else-if="forum.currentRoute.value.name==='settings'" :snapshot="forum.snapshot.value" :active-account-id="forum.currentAccount.value!.id" :participant-candidates="forum.listParticipantCandidates" @back="forum.popRoute" @switch-account="forum.switchAccount" @update-profile="forum.updateForumProfile" @add-account="forum.addForumAccount" @participation="forum.setCharacterParticipation" @participant-policy="forum.updateParticipantPolicy" @bridge="changeBridge" @bridge-types="changeBridgeTypes" @bind-world="forum.bindCircleWorldBooks" @add-avatar-files="forum.addAvatarFiles" @add-avatar-url="forum.addAvatarUrl" @generate-avatar="forum.generateAvatarLibraryItem" @remove-avatar="forum.removeAvatarLibraryItem"/>
        <template v-else>
          <ForumFeedView v-if="forum.activeTab.value==='feed'" :posts="forum.posts.value" :mode="forum.feedMode.value" :busy="forum.busy.value" :error="forum.error.value" :generation-summary="forum.generationSummary.value" @dismiss-generation-summary="forum.dismissGenerationSummary" @open-generated-circle="id=>forum.pushRoute({name:'circle',circleId:id})" @back="emit('close')" @open-search="forum.pushRoute({name:'search'})" @generate="openGenerator()" @change-mode="mode=>forum.feedMode.value=mode" @shown="forum.recordFeedShown" @delete-posts="forum.deletePosts" @toggle-pin="id=>forum.togglePinPost(id)" @toggle-keep="id=>forum.toggleKeepPost(id)" @move-post="(id,dir)=>forum.movePost(id,dir)" @click-post="openPost" @click-user="openUser" @like="p=>forum.toggleLikePost(p.id)" @bookmark="p=>forum.toggleBookmarkPost(p.id)"/>
          <ForumCirclesView v-else-if="forum.activeTab.value==='circles'" :circles="forum.circles.value" :active-account-id="forum.snapshot.value.settings.activeAccountId" :memberships="forum.snapshot.value.memberships" @back="emit('close')" @open="openCircle" @join="forum.joinCircle" @create="value=>openCircle(forum.createCircle(value))" @delete-circles="forum.deleteCircles"/>
          <ForumMessagesView v-else-if="forum.activeTab.value==='messages'" :conversations="forum.conversations.value" :notifications="forum.notifications.value" :users="forum.forumUsers.value.filter(user=>user.id!==forum.currentAccount.value?.id)" :friend-requests="forum.friendRequests.value" :current-account-id="forum.currentAccount.value!.id" @back="emit('close')" @click-conversation="openConversation" @click-user="openUser" @create-group="forum.createForumGroup" @accept-friend="acceptFriendFromList" @reject-friend="forum.rejectForumFriendRequest" @resolve-friend="forum.generateForumFriendDecision"/>
          <ForumProfileView v-else :user="forum.currentForumUser.value" :posts="forum.posts.value" is-self @edit-profile="forum.pushRoute({name:'settings'})" @click-post="openPost" @like="p=>forum.toggleLikePost(p.id)" @bookmark="p=>forum.toggleBookmarkPost(p.id)"/>
        </template>
      </main>
      <ForumBottomNav v-if="forum.currentRoute.value.name==='tab'" :active-tab="forum.activeTab.value" :unread-messages-count="forum.conversations.value.reduce((n,c)=>n+c.unreadCount,0)" @select-tab="forum.resetToTab" @click-publish="forum.pushRoute({name:'publish'})"/>
      <button
        v-if="forum.generationBusy.value&&!refreshVisible"
        class="generation-status"
        :class="{'is-dragging':isDraggingStatus}"
        :style="statusPosition?{left:`${statusPosition.x}px`,top:`${statusPosition.y}px`,right:'auto'}:{}"
        type="button"
        @pointerdown="handleStatusPointerDown"
        @pointermove="handleStatusPointerMove"
        @pointerup="handleStatusPointerUp"
        @pointercancel="handleStatusPointerUp"
        @click="handleStatusClick"
      >
        <i></i>论坛更新中… {{forum.generationProgress.value}}%
      </button>
      <ForumRefreshModal :visible="refreshVisible" :characters="characterUsers" :posts="forum.snapshot.value.posts" :profile-account-id="refreshProfileAccountId" :busy="forum.generationBusy.value" :progress="forum.generationProgress.value" :error="forum.generationError.value" @close="refreshVisible=false" @confirm="runGeneration"/>
      <ForumNpcManageModal :visible="Boolean(managedNpc)" :account="managedNpc" :persona="managedNpcPersona" :avatars="forum.snapshot.value.avatarLibrary" @close="managedNpc=null" @save="forum.updateNpcProfile" @assign-avatar="assignNpcAvatar" @refresh-profile="id=>{managedNpc=null;refreshProfileAccountId=id;refreshVisible=true}"/>
      <div v-if="managedUser" class="relation-overlay" @click.self="managedUser=null"><section><header><b>{{managedUser.name}}</b><button @click="managedUser=null">×</button></header><button @click="forum.addMute({targetAccountId:managedUser!.id});managedUser=null"><span>不看 TA</span><small>只过滤你看到的内容，对方不知道</small></button><button @click="forum.addMute({targetAccountId:managedUser!.id,expiresAt:Date.now()+7*86400000});managedUser=null"><span>静音 7 天</span><small>保持关注关系，暂时隐藏内容</small></button><button @click="forum.addVisibilityRule({targetAccountId:managedUser!.id,scopes:['all']});managedUser=null"><span>不让 TA 看</span><small>限制对方查看你的论坛内容</small></button><button class="danger" @click="forum.addBlock(managedUser!.id);managedUser=null"><span>拉黑</span><small>阻断搜索、关注、私信和互动</small></button></section></div>
      <div v-if="apiFallbackNotice" class="forum-toast">{{apiFallbackNotice}}</div>
    </template>
  </div>
</template>

<style scoped>
.forum-app-container{position:absolute;inset:0;z-index:1000;display:flex;flex-direction:column;overflow:hidden;background:var(--sys-bg-primary,#f5f5f7);color:var(--text-primary,#333);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;user-select:none;-webkit-tap-highlight-color:transparent}.forum-main-viewport{position:relative;min-width:0;min-height:0;flex:1;width:100%;overflow:hidden}.forum-loading{height:100%;padding-top:52px;box-sizing:border-box}.relation-overlay{position:absolute;inset:0;z-index:500;display:flex;align-items:flex-end;background:rgba(0,0,0,.32)}.relation-overlay section{box-sizing:border-box;width:100%;max-height:min(75vh,520px);overflow:auto;border-radius:16px 16px 0 0;background:var(--sys-bg-secondary,#fff);padding:5px 16px calc(10px + env(safe-area-inset-bottom,0px))}.relation-overlay header{display:flex;align-items:center;justify-content:space-between;height:42px;border-bottom:1px solid var(--border-color,rgba(0,0,0,.06))}.relation-overlay header b{min-width:0;overflow:hidden;font-size:14px;white-space:nowrap;text-overflow:ellipsis}.relation-overlay header button{width:30px;height:30px;border:0;border-radius:50%;background:transparent;color:var(--text-secondary,#777);font-size:20px}.relation-overlay section>button{display:flex;width:100%;align-items:flex-start;flex-direction:column;gap:3px;min-height:52px;justify-content:center;border:0;border-bottom:1px solid var(--border-color,rgba(0,0,0,.05));background:transparent;color:var(--text-primary,#222);text-align:left}.relation-overlay section>button span{font-size:13.5px}.relation-overlay section>button small{font-size:10.5px;color:var(--text-tertiary,#999)}.relation-overlay section>button.danger span{color:#d44c4c}@media(max-width:340px){.forum-main-viewport{max-width:100vw}.relation-overlay section{padding-left:12px;padding-right:12px}}
.generation-status{position:absolute;z-index:510;top:10px;right:12px;display:flex;height:30px;align-items:center;gap:6px;border:1px solid color-mix(in srgb,var(--accent-color,#2b7de9) 18%,transparent);border-radius:999px;background:color-mix(in srgb,var(--sys-bg-secondary,#fff) 92%,transparent);padding:0 11px;color:var(--text-secondary,#666);box-shadow:0 3px 12px rgba(0,0,0,.08);font:inherit;font-size:10.5px;touch-action:none;cursor:grab;user-select:none;transition:box-shadow .15s ease,transform .15s ease}.generation-status:active,.generation-status.is-dragging{cursor:grabbing;box-shadow:0 6px 18px rgba(0,0,0,.15);transform:scale(1.02)}.generation-status i{width:7px;height:7px;border-radius:50%;background:var(--accent-color,#2b7de9);animation:generation-pulse 1.2s ease-in-out infinite}@keyframes generation-pulse{50%{opacity:.3}}
.forum-toast{position:absolute;z-index:800;right:12px;bottom:76px;left:12px;border-radius:10px;background:rgba(35,35,38,.94);padding:10px 12px;color:#fff;font-size:11px;line-height:1.45;box-shadow:0 5px 18px rgba(0,0,0,.2)}
</style>
