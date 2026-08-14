<!-- WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ -->
<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import CharacterProfileAiModal from './CharacterProfileAiModal.vue'
import { applySocialProfilePatch, ensureSocialProfile, type CharacterSocialProfile, type SocialCoverStyle, type SocialManagementMode } from '../../../services/characterSocialProfile'
import { createCharacterMoment, deleteCharacterMoment, listMomentsByAuthor, updateCharacterMoment } from '../../../services/momentRepository'
import type { SocialGenerationResult } from '../../../services/characterSocialGenerator'
import { isDirectoryOwner, saveCharacterDirectoryProfile } from '../../../services/characterDirectory'
import { appendRelationshipEvent, blockCharacter, createFriendRequest, deleteFriendByUser, ensureRelationship, persistRelationship, unblockCharacter, type FriendRequestRecord } from '../../../composables/useChatRelationship'
import { useRelationshipAdvance } from '../../../composables/useRelationshipAdvance'
import { useChatAuth } from '../../../composables/useChatAuth'

const props = defineProps<{ chat: any }>()
const emit = defineEmits<{ (event: 'back'): void; (event: 'open-chat'): void; (event: 'save'): void | Promise<void> }>()

const profile = ref<CharacterSocialProfile>(ensureSocialProfile(props.chat))
const currentPage = ref<'profile' | 'moments'>('profile')
const moments = ref<any[]>([])
const loadingMoments = ref(true)
const momentError = ref('')
const showManage = ref(false)
const manageTab = ref<'profile' | 'permissions' | 'history'>('profile')
const showMoreMenu = ref(false)
const showAi = ref(false)
const showManualMoment = ref(false)
const manualMomentText = ref('')
const manualSubmitting = ref(false)
const editingMoment = ref<any | null>(null)
const editingText = ref('')
const deleteTarget = ref<any | null>(null)
const toast = ref('')
const showRequestComposer = ref(false)
const requestMessage = ref('')
const lastRequestAt = ref(0)
const manageSnapshot = ref({ nickname: profile.value.nickname, socialId: profile.value.socialId, signature: profile.value.signature, coverStyle: profile.value.coverStyle })
let toastTimer: number | null = null

const now = ref(Date.now())
let timeUpdateTimer: ReturnType<typeof setInterval> | null = null

const getStatusText = () => {
  if (!props.chat?.enableImmersiveStatus) return ''
  const offlineUntil = props.chat?.offlineUntil || 0
  const isOffline = offlineUntil > now.value
  const baseStatus = props.chat?.statusText || ''

  if (isOffline) {
    const diff = offlineUntil - now.value
    const m = Math.floor(diff / 60000)
    const s = Math.floor((diff % 60000) / 1000)
    const timeStr = m > 0 ? `约 ${m} 分 ${s} 秒后恢复` : `还有 ${s} 秒回归`
    return baseStatus ? `${baseStatus}（离线中，${timeStr}）` : `离线中，${timeStr}`
  }
  return baseStatus || '在线'
}

const relationship = computed(() => ensureRelationship(props.chat))
const canManageProfile = computed(() => isDirectoryOwner(String(props.chat.characterEntityId || props.chat.id)))
const { chatAccounts, currentAccount } = useChatAuth()
const { isAdvancing, relationshipError, advanceRelationship } = useRelationshipAdvance()
const linkedAccounts = computed(() => (currentAccount.value?.linkedAccountIds || [])
  .map(id => chatAccounts.value.find(account => account.id === id))
  .filter(Boolean))
const activeOutgoingRequest = computed<FriendRequestRecord | null>(() => relationship.value.requests.find((request: FriendRequestRecord) => (
  request.direction === 'user_to_character' && ['scheduled', 'pending', 'viewed'].includes(request.status)
)) || null)
const latestOutgoingRequest = computed<FriendRequestRecord | null>(() => relationship.value.requests.find((request: FriendRequestRecord) => request.direction === 'user_to_character') || null)
const profileActionLabel = computed(() => {
  if (relationship.value.blockedBy === 'character') return '对方已将你拉黑'
  if (relationship.value.friendship === 'friends') return '发消息'
  if (activeOutgoingRequest.value) return activeOutgoingRequest.value.status === 'viewed' ? '请求重新考虑' : '补充申请'
  if (latestOutgoingRequest.value?.status === 'rejected') return '再次申请'
  return '申请添加'
})

const displayName = computed(() => profile.value.nickname || props.chat.realName || props.chat.name || '未命名角色')
const recentMoments = computed(() => moments.value.slice(0, 3))
const pendingChanges = computed(() => profile.value.changes.filter(change => change.status === 'pending'))
const permissionRows = [
  { key: 'nickname', title: '修改网名', description: '允许角色调整对外显示的昵称' },
  { key: 'socialId', title: '修改社交 ID', description: '身份标识较稳定，建议谨慎开启' },
  { key: 'signature', title: '修改个性签名', description: '允许角色根据状态更新签名' },
  { key: 'publishMoments', title: '发布朋友圈', description: '允许角色主动发布新内容' },
  { key: 'editMoments', title: '编辑自己的朋友圈', description: '默认仅管理角色自己生成的内容' },
  { key: 'deleteMoments', title: '删除自己的朋友圈', description: '高风险操作，默认关闭' },
  { key: 'manageUserMoments', title: '管理用户代发内容', description: '允许角色修改或删除你替其发布的内容' },
  { key: 'generateImages', title: '生成朋友圈配图', description: '可能消耗图像额度' }
] as const

const isNavScrolled = ref(false)

const handleScroll = (e: Event) => {
  const target = e.target as HTMLElement
  isNavScrolled.value = target.scrollTop > 50
}

const copyId = async () => {
  if (profile.value.socialId) {
    try {
      await navigator.clipboard.writeText(profile.value.socialId)
      notify('ID 已复制')
    } catch {
      notify('复制失败')
    }
  }
}

const handleLike = (momentId: string) => {
  notify('已点赞')
}

const notify = (message: string) => {
  toast.value = message
  if (toastTimer) window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => { toast.value = '' }, 2200)
}

const openManage = (tab: 'profile' | 'permissions' | 'history' = 'profile') => {
  if (!canManageProfile.value) return
  manageSnapshot.value = { nickname: profile.value.nickname, socialId: profile.value.socialId, signature: profile.value.signature }
  manageTab.value = tab
  showManage.value = true
}

const loadMoments = async () => {
  loadingMoments.value = true
  momentError.value = ''
  try {
    moments.value = await listMomentsByAuthor(props.chat.id)
  } catch (error: any) {
    momentError.value = error?.message || '朋友圈加载失败'
  } finally {
    loadingMoments.value = false
  }
}

const persist = async () => {
  props.chat.socialProfile = profile.value
  if (canManageProfile.value) saveCharacterDirectoryProfile(props.chat)
  await emit('save')
}

const saveProfile = async () => {
  const patch = {
    nickname: profile.value.nickname.trim() || props.chat.realName || props.chat.name,
    socialId: profile.value.socialId.trim().replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 20),
    signature: profile.value.signature.trim()
  }
  const now = Date.now()
  Object.entries(patch).forEach(([field, value]) => {
    const before = (manageSnapshot.value as any)[field]
    if (before === value) return
    profile.value.changes.unshift({ id: `${now}_${field}_manual`, field, before, after: value, source: 'user', createdAt: now, status: 'applied' })
  })
  Object.assign(profile.value, patch, { updatedAt: now })
  props.chat.socialProfile = profile.value
  profile.value = props.chat.socialProfile
  try {
    await persist()
  } catch (error: any) {
    notify(error?.message || '主页资料保存失败')
    return
  }
  manageSnapshot.value = { ...patch }
  notify('主页资料已保存')
}

const handlePrimaryAction = () => {
  if (relationship.value.blockedBy === 'character') return
  if (relationship.value.friendship === 'friends') {
    emit('open-chat')
    return
  }
  requestMessage.value = ''
  showRequestComposer.value = true
}

const toggleBlock = () => {
  if (relationship.value.blockedBy === 'user') {
    unblockCharacter(props.chat)
    notify('已解除拉黑')
  } else {
    blockCharacter(props.chat)
    notify('已拉黑该角色')
  }
  showMoreMenu.value = false
}

const deleteFriend = () => {
  deleteFriendByUser(props.chat)
  notify('已删除好友')
  showMoreMenu.value = false
}

const submitFriendRequest = async () => {
  if (isAdvancing.value) return
  const now = Date.now()
  const latestRequestTime = Number(latestOutgoingRequest.value?.sentAt || latestOutgoingRequest.value?.createdAt || 0)
  if (now - Math.max(lastRequestAt.value, latestRequestTime) < 30000) {
    notify('刚刚已经提交过申请，请稍后再试')
    return
  }
  const wasActive = Boolean(activeOutgoingRequest.value)
  const request = createFriendRequest(props.chat, 'user_to_character', requestMessage.value)
  lastRequestAt.value = now
  requestMessage.value = ''
  showRequestComposer.value = false
  notify(wasActive ? '补充申请已发送' : '好友申请已发送')
  try { await advanceRelationship(props.chat, 'user_sent_request', request) } catch {}
}

const toggleLinkedAccountDisclosure = (accountId: string) => {
  const disclosed = relationship.value.disclosedLinkedAccountIds
  const isDisclosed = disclosed.includes(accountId)
  relationship.value.disclosedLinkedAccountIds = isDisclosed
    ? disclosed.filter(id => id !== accountId)
    : [...disclosed, accountId]
  const account = chatAccounts.value.find(item => item.id === accountId)
  appendRelationshipEvent(
    props.chat,
    isDisclosed ? 'linked_account_hidden' : 'linked_account_disclosed',
    isDisclosed ? '你撤回了账号关联说明' : '你说明了另一个账号也是自己',
    account ? `关联账号：${account.name}（ID：${account.accountId}）` : ''
  )
  persistRelationship(props.chat)
  notify(isDisclosed ? '已停止向角色公开该关联' : '已告诉角色这个账号关联')
}

const setManagementMode = async (mode: SocialManagementMode) => {
  profile.value.managementMode = mode
  profile.value.updatedAt = Date.now()
  await persist()
}

const togglePermission = async (key: keyof CharacterSocialProfile['permissions']) => {
  profile.value.permissions[key] = !profile.value.permissions[key]
  profile.value.updatedAt = Date.now()
  await persist()
}

const submitManualMoment = async () => {
  const content = manualMomentText.value.trim()
  if (!content || manualSubmitting.value) return
  manualSubmitting.value = true
  try {
    await createCharacterMoment(props.chat, content, 'manual', { createdBy: 'user' })
    manualMomentText.value = ''
    showManualMoment.value = false
    await loadMoments()
    notify('朋友圈已发布')
  } catch (error: any) {
    notify(error?.message || '发布失败，请重试')
  } finally {
    manualSubmitting.value = false
  }
}

const openEditMoment = (moment: any) => {
  editingMoment.value = moment
  editingText.value = moment.content || ''
}

const saveEditedMoment = async () => {
  if (!editingMoment.value || !editingText.value.trim()) return
  try {
    await updateCharacterMoment(editingMoment.value.id, { content: editingText.value.trim() })
    editingMoment.value = null
    await loadMoments()
    notify('朋友圈已更新')
  } catch (error: any) {
    notify(error?.message || '修改失败')
  }
}

const confirmDelete = async () => {
  if (!deleteTarget.value) return
  try {
    await deleteCharacterMoment(deleteTarget.value.id)
    deleteTarget.value = null
    await loadMoments()
    notify('朋友圈已删除')
  } catch (error: any) {
    notify(error?.message || '删除失败')
  }
}

const applyAiResult = async (generated: SocialGenerationResult, generation: { includeRecentChat: boolean; allowChatDetails: boolean; momentCount: number }) => {
  const patch: any = {}
  ;(['nickname', 'socialId', 'signature'] as const).forEach(field => {
    if (generated[field] !== undefined) patch[field] = generated[field]
  })
  if (Object.keys(patch).length) {
    applySocialProfilePatch(props.chat, patch, 'ai-assist')
    profile.value = props.chat.socialProfile
    await persist()
  }
  profile.value.generation = { ...generation }
  await persist()
  if (generated.moments?.length) {
    for (const content of generated.moments) await createCharacterMoment(props.chat, content, 'ai-assist', { createdBy: 'user' })
    await loadMoments()
  }
  notify(generated.moments?.length ? `已采用资料并发布 ${generated.moments.length} 条朋友圈` : '已采用生成的主页资料')
}

const reviewChange = async (change: any, accept: boolean) => {
  if (accept) {
    if (change.field === 'momentEdit') await updateCharacterMoment(change.before, { content: change.after })
    else if (change.field === 'momentDelete') await deleteCharacterMoment(change.before)
    else if (change.field === 'momentPublish') await createCharacterMoment(props.chat, change.after, 'ai-chat', { createdBy: 'character' })
    else (profile.value as any)[change.field] = change.after
    change.status = 'applied'
  } else change.status = 'rejected'
  profile.value.updatedAt = Date.now()
  await persist()
  if (String(change.field).startsWith('moment')) await loadMoments()
}

const formatTime = (timestamp: number) => {
  const date = new Date(timestamp)
  const now = new Date()
  if (date.toDateString() === now.toDateString()) return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  return `${date.getMonth() + 1}月${date.getDate()}日`
}

const sourceLabel = (moment: any) => ({ manual: '用户代发', 'ai-assist': 'AI 辅助', 'ai-chat': '角色发布', autonomy: '自主发布' } as Record<string, string>)[moment.source] || '历史内容'

onMounted(() => {
  void loadMoments()
  window.addEventListener('clingy:moments-updated', loadMoments)
  timeUpdateTimer = setInterval(() => { now.value = Date.now() }, 1000)
})
onUnmounted(() => {
  window.removeEventListener('clingy:moments-updated', loadMoments)
  if (toastTimer) window.clearTimeout(toastTimer)
  if (timeUpdateTimer) clearInterval(timeUpdateTimer)
})
</script>

<template>
  <div class="editorial-profile-view">
    <Transition name="social-toast"><div v-if="toast" class="character-social-toast" role="status">{{ toast }}</div></Transition>

    <nav class="floating-nav-bar" :class="{ 'is-scrolled': isNavScrolled, 'solid-nav': currentPage !== 'profile' }">
      <button class="nav-circle-btn" type="button" aria-label="返回" @click="currentPage === 'moments' ? currentPage = 'profile' : emit('back')">
        <svg viewBox="0 0 24 24"><path d="m15 5-7 7 7 7"/></svg>
      </button>
      <span v-if="isNavScrolled || currentPage !== 'profile'" class="nav-title">{{ currentPage === 'moments' ? '随笔手记' : displayName }}</span>
      <button v-if="canManageProfile && currentPage === 'profile'" class="nav-circle-btn" type="button" @click="openManage()">
        <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="2.5"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
      </button>
      <div v-else class="nav-spacer"></div>
    </nav>

    <div class="profile-scroll-container" :class="{ 'with-solid-nav': currentPage !== 'profile' }" @scroll="handleScroll">
      <template v-if="currentPage === 'profile'">
        <header class="character-hero-cover">
          <div 
            class="cover-image" 
            :style="props.chat.avatarUrl ? { backgroundImage: `url(${props.chat.avatarUrl})` } : {}"
          ></div>
          <div class="hero-fog-overlay"></div>
          <div v-if="props.chat.enableImmersiveStatus" class="character-live-status">
            <span class="status-pulse" :style="(props.chat.offlineUntil || 0) > now ? { backgroundColor: '#999', animation: 'none' } : {}"></span>
            <span>{{ getStatusText() }}</span>
          </div>
        </header>

        <main class="editorial-body">
          <section class="identity-section">
            <div class="name-badge-row">
              <h1 class="character-name">{{ displayName }}</h1>
              <span v-if="props.chat.remark" class="remark-pill">{{ props.chat.remark }}</span>
            </div>
            <p class="social-id-row" @click="copyId">
              <span>@{{ profile.socialId }}</span>
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
            </p>
          </section>

          <blockquote class="character-quote">
            “{{ profile.signature || '这个人还没有写个性签名' }}”
          </blockquote>

          <section class="moments-stream">
            <div class="stream-header">
              <h2>随笔手记</h2>
              <span>({{ moments.length }})</span>
            </div>

            <div v-if="loadingMoments" class="empty-stream">
              <span class="character-loading-ring"></span>
            </div>
            <div v-else-if="!moments.length" class="empty-stream">
              <div class="empty-hint">还没有发布内容</div>
            </div>
            <div v-else class="stream-cards">
              <article v-for="item in recentMoments" :key="item.id" class="editorial-card" @click="currentPage = 'moments'">
                <div class="card-meta">
                  <time>{{ formatTime(item.time) }}</time>
                  <span v-if="item.source" class="card-tag">{{ sourceLabel(item) }}</span>
                </div>
                <p class="card-text">{{ item.content }}</p>
                <div v-if="item.images && item.images.length" class="card-grid" :class="`grid-${Math.min(item.images.length, 3)}`">
                  <img v-for="(img, idx) in item.images.slice(0, 3)" :key="idx" :src="typeof img === 'string' ? img : img.url" alt="moment photo" loading="lazy" />
                </div>
              </article>

              <button v-if="moments.length > 3" class="view-all-btn" type="button" @click="currentPage = 'moments'">
                查看全部 {{ moments.length }} 篇手记
              </button>
            </div>
          </section>

          <section v-if="canManageProfile" class="editorial-note character-awareness-note" :class="{ enabled: profile.awarenessEnabled }">
            <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 11v5m0-9h.01"/></svg>
            <div><strong>{{ profile.awarenessEnabled ? '角色已感知自己的主页' : '主页目前仅对你可见' }}</strong><span>{{ profile.awarenessEnabled ? `管理模式：${profile.managementMode === 'readonly' ? '只读' : profile.managementMode === 'confirm' ? '修改需确认' : '自主管理'}` : '开启后角色才能感知' }}</span></div>
            <button type="button" @click="openManage('permissions')">设置</button>
          </section>

          <section v-if="linkedAccounts.length" class="editorial-links character-account-links">
            <header><strong>关联账号</strong><span>默认保密，只在你选择后告诉这个角色</span></header>
            <button v-for="account in linkedAccounts" :key="account!.id" type="button" :class="{ disclosed: relationship.disclosedLinkedAccountIds.includes(account!.id) }" @click="toggleLinkedAccountDisclosure(account!.id)">
              <span><b>{{ account!.name }}</b><small>ID：{{ account!.accountId }}</small></span>
              <em>{{ relationship.disclosedLinkedAccountIds.includes(account!.id) ? '角色已知' : '告诉角色' }}</em>
            </button>
          </section>
        </main>
      </template>

      <template v-else>
        <div class="full-stream">
          <div class="editorial-moment-toolbar">
            <div>
              <strong>主页动态</strong>
              <span>手动发布或让 AI 生成草稿</span>
            </div>
            <div class="toolbar-actions">
              <button type="button" @click="showManualMoment = true"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>发手记</button>
              <button class="accent" type="button" @click="showAi = true"><svg viewBox="0 0 24 24"><path d="m12 3 1.4 4.1 4.1 1.4-4.1 1.4L12 14l-1.4-4.1-4.1-1.4 4.1-1.4z"/></svg>AI</button>
            </div>
          </div>

          <div v-if="loadingMoments" class="character-state-card" aria-live="polite"><span class="character-loading-ring"></span><strong>正在加载朋友圈</strong><p>正在整理该角色的主页内容</p></div>
          <div v-else-if="momentError" class="character-state-card error" role="alert"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v6m0 4h.01"/></svg><strong>朋友圈暂时无法加载</strong><p>{{ momentError }}</p><button type="button" @click="loadMoments">重新加载</button></div>
          <div v-else-if="!moments.length" class="character-state-card empty"><svg viewBox="0 0 24 24"><path d="M5 5h14v14H5zM8 15l3-3 2 2 3-4 3 4"/></svg><strong>还没有朋友圈</strong><p>可以手动替角色发布，也可以按字段选择让 AI 生成。</p><div><button type="button" @click="showManualMoment = true">写第一条</button><button class="accent" type="button" @click="showAi = true">AI 帮我生成</button></div></div>
          
          <div v-else class="stream-cards">
            <article v-for="item in moments" :key="item.id" class="editorial-card">
              <div class="card-meta">
                <time>{{ formatTime(item.time) }}</time>
                <span class="card-tag">{{ sourceLabel(item) }}</span>
              </div>
              <p class="card-text">{{ item.content }}</p>
              <div v-if="item.images && item.images.length" class="card-grid" :class="`grid-${Math.min(item.images.length, 3)}`">
                <img v-for="(img, idx) in item.images" :key="idx" :src="typeof img === 'string' ? img : img.url" alt="moment photo" loading="lazy" />
              </div>
              <footer class="card-footer">
                <span>{{ item.visibility || '公开' }}</span>
                <span v-if="item.updatedAt">· 已编辑</span>
                <div class="footer-actions">
                  <button type="button" @click="openEditMoment(item)">编辑</button>
                  <button class="danger" type="button" @click="deleteTarget = item">删除</button>
                </div>
              </footer>
            </article>
          </div>
        </div>
      </template>
    </div>

    <!-- Thumb Dock -->
    <div v-if="currentPage === 'profile'" class="floating-thumb-dock">
      <button class="primary-chat-btn" type="button" :disabled="relationship.blockedBy === 'character' || isAdvancing" @click="handlePrimaryAction">
        <svg viewBox="0 0 24 24"><path d="M5 5h14v11H9l-4 3z"/></svg>
        <span>{{ isAdvancing ? '等待角色回应…' : profileActionLabel }}</span>
      </button>
      <div class="more-menu-wrapper">
        <button class="icon-dock-btn" type="button" @click="showMoreMenu = true">
          <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="2"/><circle cx="12" cy="5" r="2"/><circle cx="12" cy="19" r="2"/></svg>
        </button>
      </div>
    </div>

    <!-- Modals (Unchanged structure) -->
    <Teleport to="body">
      <Transition name="social-sheet">
        <div v-if="showRequestComposer" class="character-sheet-overlay center" @click.self="showRequestComposer = false"><section class="character-editor-modal friend-request-editor" role="dialog" aria-modal="true"><header><div><h2>{{ latestOutgoingRequest?.status === 'rejected' ? '再次申请好友' : activeOutgoingRequest ? '补充好友申请' : '申请添加好友' }}</h2><span>角色会根据人设和关系经历自主决定</span></div><button type="button" aria-label="关闭" @click="showRequestComposer = false"><svg viewBox="0 0 24 24"><path d="m6 6 12 12M18 6 6 18"/></svg></button></header><label><span>验证消息（选填）</span><textarea v-model="requestMessage" maxlength="240" placeholder="想对对方说些什么…"></textarea><small>{{ requestMessage.length }}/240</small></label><footer><button type="button" @click="showRequestComposer = false">取消</button><button class="primary" type="button" :disabled="isAdvancing" @click="submitFriendRequest">发送申请</button></footer></section></div>
      </Transition>

      <Transition name="social-sheet">
        <div v-if="showManage" class="character-sheet-overlay" @click.self="showManage = false">
          <section class="character-manage-sheet" role="dialog" aria-modal="true" aria-labelledby="manage-title">
            <header><div><p>PROFILE CONTROL</p><h2 id="manage-title">管理角色主页</h2></div><button type="button" aria-label="关闭" @click="showManage = false"><svg viewBox="0 0 24 24"><path d="m6 6 12 12M18 6 6 18"/></svg></button></header>
            <nav aria-label="主页管理分类"><button v-for="tab in [{id:'profile',label:'资料'},{id:'permissions',label:'角色权限'},{id:'history',label:'变更记录'}]" :key="tab.id" type="button" :class="{ active: manageTab === tab.id }" @click="manageTab = tab.id as any">{{ tab.label }}<span v-if="tab.id === 'history' && pendingChanges.length">{{ pendingChanges.length }}</span></button></nav>
            <div class="character-manage-scroll">
              <template v-if="manageTab === 'profile'">
                <div class="manage-intro"><div><strong>主页资料</strong><span>手动填写，或只选择一个字段让 AI 帮忙</span></div><button type="button" @click="showAi = true"><svg viewBox="0 0 24 24"><path d="m12 3 1.4 4.1 4.1 1.4-4.1 1.4L12 14l-1.4-4.1-4.1-1.4 4.1-1.4z"/></svg>AI 完善</button></div>
                <label class="manage-field"><span>网名<small>{{ profile.nickname.length }}/30</small></span><input v-model="profile.nickname" maxlength="30" placeholder="角色对外显示的名字"></label>
                <label class="manage-field"><span>社交 ID<small>4～20 位</small></span><input v-model="profile.socialId" maxlength="20" pattern="[A-Za-z0-9_-]+" placeholder="字母、数字、下划线或短横线"></label>
                <label class="manage-field"><span>个性签名<small>{{ profile.signature.length }}/120</small></span><textarea v-model="profile.signature" maxlength="120" placeholder="写一句这个角色会放在主页的话"></textarea></label>
                <button class="manage-save-button" type="button" :disabled="!profile.nickname.trim() || profile.socialId.length < 4" @click="saveProfile">保存主页资料</button>
              </template>

              <template v-else-if="manageTab === 'permissions'">
                <section class="permission-master"><div><strong>角色可感知自己的主页</strong><span>开启后，资料会作为角色的社交身份进入上下文</span></div><label class="character-switch"><input v-model="profile.awarenessEnabled" type="checkbox" @change="persist"><span></span></label></section>
                <section class="management-mode" :class="{ disabled: !profile.awarenessEnabled }"><header><strong>主页管理模式</strong><span>决定角色提出的修改如何生效</span></header><div><button v-for="mode in [{id:'readonly',label:'只读',desc:'只能记住'},{id:'confirm',label:'需确认',desc:'修改进入审核'},{id:'autonomous',label:'自主管理',desc:'允许直接生效'}]" :key="mode.id" type="button" :disabled="!profile.awarenessEnabled" :class="{ active: profile.managementMode === mode.id }" @click="setManagementMode(mode.id as SocialManagementMode)"><strong>{{ mode.label }}</strong><span>{{ mode.desc }}</span></button></div></section>
                <section class="permission-list" :class="{ disabled: !profile.awarenessEnabled || profile.managementMode === 'readonly' }"><header><strong>允许的操作</strong><span>高风险权限默认关闭</span></header><div v-for="row in permissionRows" :key="row.key" class="permission-row"><div><strong>{{ row.title }}</strong><span>{{ row.description }}</span></div><label class="character-switch"><input type="checkbox" :checked="profile.permissions[row.key]" :disabled="!profile.awarenessEnabled || profile.managementMode === 'readonly'" @change="togglePermission(row.key)"><span></span></label></div></section>
              </template>

              <template v-else>
                <div v-if="!profile.changes.length" class="manage-history-empty"><svg viewBox="0 0 24 24"><path d="M12 8v5l3 2M4 12a8 8 0 1 0 2-5.3L4 9M4 4v5h5"/></svg><strong>还没有主页变更</strong><span>用户、AI 和角色的修改都会记录在这里</span></div>
                <div v-else class="manage-history-list"><article v-for="change in profile.changes" :key="change.id" :class="change.status"><header><strong>{{ {nickname:'网名',socialId:'社交 ID',signature:'个性签名',momentEdit:'编辑朋友圈',momentDelete:'删除朋友圈',momentPublish:'发布朋友圈'}[change.field] || change.field }}</strong><span>{{ change.source === 'user' ? '用户修改' : change.source === 'ai-assist' ? 'AI 辅助' : '角色申请' }}</span></header><p><del>{{ change.before || '空' }}</del><svg viewBox="0 0 24 24"><path d="M5 12h14m-5-5 5 5-5 5"/></svg><b>{{ change.after }}</b></p><footer><time>{{ new Date(change.createdAt).toLocaleString('zh-CN') }}</time><div v-if="change.status === 'pending'"><button type="button" @click="reviewChange(change,false)">拒绝</button><button class="accept" type="button" @click="reviewChange(change,true)">同意</button></div><span v-else>{{ change.status === 'applied' ? '已生效' : '已拒绝' }}</span></footer></article></div>
              </template>
            </div>
          </section>
        </div>
      </Transition>

      <Transition name="social-sheet">
        <div v-if="showManualMoment" class="character-sheet-overlay center" @click.self="showManualMoment = false"><section class="character-editor-modal" role="dialog" aria-modal="true"><header><div><h2>替角色发布朋友圈</h2><span>发布后角色可按权限感知和管理</span></div><button type="button" aria-label="关闭" @click="showManualMoment = false"><svg viewBox="0 0 24 24"><path d="m6 6 12 12M18 6 6 18"/></svg></button></header><label><span>朋友圈内容</span><textarea v-model="manualMomentText" maxlength="1000" autofocus placeholder="记录这一刻的想法…"></textarea><small>{{ manualMomentText.length }}/1000</small></label><footer><button type="button" @click="showManualMoment = false">取消</button><button class="primary" type="button" :disabled="!manualMomentText.trim() || manualSubmitting" @click="submitManualMoment"><span v-if="manualSubmitting" class="character-loading-ring small"></span>{{ manualSubmitting ? '发布中…' : '发布' }}</button></footer></section></div>
      </Transition>

      <Transition name="social-sheet">
        <div v-if="editingMoment" class="character-sheet-overlay center" @click.self="editingMoment = null"><section class="character-editor-modal" role="dialog" aria-modal="true"><header><div><h2>编辑朋友圈</h2><span>{{ sourceLabel(editingMoment) }} · {{ formatTime(editingMoment.time) }}</span></div><button type="button" aria-label="关闭" @click="editingMoment = null"><svg viewBox="0 0 24 24"><path d="m6 6 12 12M18 6 6 18"/></svg></button></header><label><span>朋友圈内容</span><textarea v-model="editingText" maxlength="1000"></textarea><small>{{ editingText.length }}/1000</small></label><footer><button class="danger-text" type="button" @click="deleteTarget = editingMoment; editingMoment = null">删除</button><button type="button" @click="editingMoment = null">取消</button><button class="primary" type="button" :disabled="!editingText.trim()" @click="saveEditedMoment">保存</button></footer></section></div>
      </Transition>

      <Transition name="social-sheet">
        <div v-if="deleteTarget" class="character-sheet-overlay center" @click.self="deleteTarget = null"><section class="character-confirm-modal" role="alertdialog" aria-modal="true"><div class="confirm-icon"><svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v5m4-5v5"/></svg></div><h2>删除这条朋友圈？</h2><p>删除后无法恢复，其他角色也将无法再看到它。</p><div><button type="button" @click="deleteTarget = null">取消</button><button class="danger" type="button" @click="confirmDelete">删除</button></div></section></div>
      </Transition>

      <Transition name="social-sheet">
        <div v-if="showMoreMenu" class="character-sheet-overlay" @click.self="showMoreMenu = false">
          <section class="character-manage-sheet relationship-manage-sheet" role="dialog" aria-modal="true">
            <header><div><p>RELATIONSHIP</p><h2>关系管理</h2></div><button type="button" aria-label="关闭" @click="showMoreMenu = false"><svg viewBox="0 0 24 24"><path d="m6 6 12 12M18 6 6 18"/></svg></button></header>
            <div class="relationship-actions">
              <button type="button" @click="toggleBlock">
                <div class="action-icon" :class="{ active: relationship.blockedBy === 'user' }">
                  <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="m4.93 4.93 14.14 14.14"/></svg>
                </div>
                <div class="action-text">
                  <strong>{{ relationship.blockedBy === 'user' ? '解除拉黑' : '拉黑对方' }}</strong>
                  <span>{{ relationship.blockedBy === 'user' ? '恢复接收对方消息' : '不再接收对方发来的消息' }}</span>
                </div>
              </button>
              <button v-if="relationship.friendship === 'friends'" class="danger" type="button" @click="deleteFriend">
                <div class="action-icon danger">
                  <svg viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="18" y1="8" x2="23" y2="13"/><line x1="23" y1="8" x2="18" y2="13"/></svg>
                </div>
                <div class="action-text">
                  <strong>删除好友</strong>
                  <span>从联系人列表中移除</span>
                </div>
              </button>
            </div>
          </section>
        </div>
      </Transition>
    </Teleport>

    <CharacterProfileAiModal :visible="showAi" :chat="props.chat" :existing-moments="moments" @close="showAi = false" @apply="applyAiResult" />
  </div>
</template>

<style scoped src="./CharacterProfileView.css"></style>
