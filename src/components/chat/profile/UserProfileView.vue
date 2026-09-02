<!-- WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ -->
<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useChatAuth } from '../../../composables/useChatAuth'
import { useChatState } from '../../../composables/useChatState'
import { ensureRelationship } from '../../../composables/useChatRelationship'
import { getAppearanceStyleId } from '../../../store'
import { listMoments } from '../../../services/momentRepository'
import {
  applyUserPrivacyPreset,
  loadUserSocialProfile,
  saveUserSocialProfile,
  userProfileCoverStore,
  type UserCharacterPrivacyOverride,
  type UserProfileAudience,
  type UserProfileSection,
  type UserSocialProfile
} from '../../../services/userSocialProfile'
import AvatarUploadModal from '../../AvatarUploadModal.vue'
import MagazineProfileStyle from './MagazineProfileStyle.vue'
import LetterProfileStyle from './LetterProfileStyle.vue'

const props = withDefaults(defineProps<{ backLabel?: string }>(), { backLabel: '返回' })
const emit = defineEmits<{ (event: 'back'): void; (event: 'open-discover'): void; (event: 'open-character', chat: any): void }>()
const { currentAccount, updateAccount } = useChatAuth()
const { mockChats, loadMyProfile } = useChatState()

const profile = ref<UserSocialProfile | null>(null)
const coverUrl = ref('')
const moments = ref<any[]>([])
const loading = ref(true)
const showCoverUpload = ref(false)
const showAvatarUpload = ref(false)
const showManage = ref(false)
const manageTab = ref<'profile' | 'privacy' | 'characters' | 'status'>('profile')
const currentPage = ref<'profile' | 'moments' | 'relationships'>('profile')
const toast = ref('')
const selectedCharacterIds = ref<string[]>([])
const characterSearch = ref('')
const expandedCharacterId = ref('')
const customStatusExpiry = ref('')
const pendingPrivacyChange = ref<{ summary: string; apply: () => void } | null>(null)
let toastTimer: number | undefined

const audienceOptions: Array<{ id: UserProfileAudience; label: string; desc: string }> = [
  { id: 'public', label: '公开', desc: '符合发现条件的角色可见' },
  { id: 'friends', label: '好友可见', desc: '仅好友角色可见' },
  { id: 'private', label: '私密', desc: '只有自己可见' }
]
const appearanceStyleId = computed(() => getAppearanceStyleId('characterProfile'))
const displayName = computed(() => profile.value?.displayName || currentAccount.value?.name || '我')
const displaySignature = computed(() => profile.value?.hiddenSections.includes('signature') ? '' : (profile.value?.signature || '这个人还没有写个性签名'))
const profileChat = computed(() => ({
  avatarUrl: currentAccount.value?.avatarUrl || '',
  socialProfile: { socialId: profile.value?.hiddenSections.includes('socialId') ? '' : (profile.value?.socialId || currentAccount.value?.accountId || '') }
}))
const activeChats = computed(() => mockChats.value.filter((chat: any) => chat.id !== 1 && !chat.isCreate && chat.chatType !== 'group'))
const filteredChats = computed(() => {
  const query = characterSearch.value.trim().toLowerCase()
  if (!query) return activeChats.value
  return activeChats.value.filter((chat: any) => `${chat.name || ''} ${chat.realName || ''} ${chat.remark || ''}`.toLowerCase().includes(query))
})
const visibleRelationships = computed(() => {
  if (!profile.value?.showCharacterRelationships) return []
  return activeChats.value
    .filter((chat: any) => {
      const override = profile.value!.overrides[String(chat.characterEntityId || chat.id)]
      return override?.showOnUserProfile === true && ensureRelationship(chat).blockedBy === 'none'
    })
    .sort((a: any, b: any) => {
      const ao = profile.value!.overrides[String(a.characterEntityId || a.id)]
      const bo = profile.value!.overrides[String(b.characterEntityId || b.id)]
      return Number(bo?.pinned) - Number(ao?.pinned) || Number(ao?.pinOrder || 0) - Number(bo?.pinOrder || 0)
    })
})
const statusActive = computed(() => Boolean(profile.value?.statusText && (!profile.value.statusExpiresAt || profile.value.statusExpiresAt > Date.now())))

const notify = (message: string) => {
  toast.value = message
  if (toastTimer) window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => { toast.value = '' }, 2200)
}
const audienceRank = (value: UserProfileAudience) => ({ private: 0, friends: 1, public: 2 }[value])
const requestPrivacyChange = (summary: string, apply: () => void, options: { sensitive?: boolean; privateToPublic?: boolean } = {}) => {
  if (!profile.value) return
  const mode = profile.value.privacyConfirmation
  const needsConfirm = mode === 'always' || (mode === 'sensitive' && options.sensitive) || (mode === 'private_to_public' && options.privateToPublic)
  if (!needsConfirm) { apply(); return }
  pendingPrivacyChange.value = { summary, apply }
}
const confirmPrivacyChange = () => {
  pendingPrivacyChange.value?.apply()
  pendingPrivacyChange.value = null
}
const load = async () => {
  if (!currentAccount.value) return
  profile.value = loadUserSocialProfile(currentAccount.value)
  loading.value = true
  try {
    const [savedCover, savedMoments] = await Promise.all([
      userProfileCoverStore.getItem<string>(profile.value.coverImageKey), listMoments()
    ])
    coverUrl.value = savedCover || ''
    moments.value = savedMoments.filter(item => item.isOwn !== false).sort((a, b) => Number(b.time || 0) - Number(a.time || 0))
  } finally { loading.value = false }
}
const persist = () => { if (profile.value) saveUserSocialProfile(profile.value) }
const saveProfile = async () => {
  if (!profile.value || !currentAccount.value || !profile.value.displayName.trim()) return
  profile.value.displayName = profile.value.displayName.trim()
  updateAccount(currentAccount.value.id, { name: profile.value.displayName })
  persist()
  await loadMyProfile()
  notify('用户主页已保存')
}
const saveCover = async (url: string | null) => {
  if (!profile.value) return
  if (url) await userProfileCoverStore.setItem(profile.value.coverImageKey, url)
  else await userProfileCoverStore.removeItem(profile.value.coverImageKey)
  coverUrl.value = url || ''
  notify(url ? '主页背景已更新' : '已恢复默认背景')
}
const saveAvatar = async (url: string | null) => {
  if (!currentAccount.value) return
  updateAccount(currentAccount.value.id, { avatarUrl: url || '' })
  await loadMyProfile()
  notify(url ? '账号头像已更新' : '已清除账号头像')
}
const copyId = async () => {
  try { await navigator.clipboard.writeText(profile.value?.socialId || ''); notify('账号 ID 已复制') }
  catch { notify('复制失败') }
}
const setPreset = (audience: UserProfileAudience) => {
  if (!profile.value) return
  const previous = profile.value.profileAudience
  const apply = () => {
    applyUserPrivacyPreset(profile.value!, audience)
    persist()
    notify(`已应用${audience === 'public' ? '公开' : audience === 'friends' ? '好友可见' : '私密'}设置`)
  }
  if (audienceRank(audience) > audienceRank(previous)) requestPrivacyChange(`主页和对应分区将从“${audienceLabel(previous)}”扩大为“${audienceLabel(audience)}”。`, apply, { sensitive: true, privateToPublic: previous === 'private' && audience === 'public' })
  else apply()
}
const setSectionAudience = (section: UserProfileSection, audience: UserProfileAudience) => {
  if (!profile.value) return
  const previous = profile.value.sectionAudiences[section]
  const apply = () => {
    profile.value!.sectionAudiences[section] = audience
    profile.value!.hiddenSections = profile.value!.hiddenSections.filter(item => item !== section)
    persist()
  }
  if (audienceRank(audience) > audienceRank(previous)) requestPrivacyChange(`“${{socialId:'账号 ID',signature:'个性签名',status:'当前状态',moments:'用户动态',relationships:'角色关系',identity:'基础资料'}[section]}”将扩大为${audienceLabel(audience)}。`, apply, { sensitive: section === 'moments' || section === 'relationships', privateToPublic: previous === 'private' && audience === 'public' })
  else apply()
}
const toggleBooleanPermission = (key: keyof UserSocialProfile, enabled: boolean) => {
  if (!profile.value) return
  const apply = () => { (profile.value as any)[key] = enabled; persist() }
  const labels: Record<string, string> = { discoverable: '允许角色发现我', allowFriendRequests: '接收角色好友申请', participateInCharacterNetworks: '参与角色人脉', showCharacterRelationships: '展示角色关系', showStatus: '在主页显示状态', allowProfileAwareness: '允许角色感知主页', allowMomentLikes: '允许角色点赞', allowMomentComments: '允许角色评论', allowMomentMentions: '允许角色提到动态' }
  if (enabled) requestPrivacyChange(`将开启“${labels[String(key)] || String(key)}”。`, apply, { sensitive: ['showCharacterRelationships','allowMomentComments','allowMomentMentions'].includes(String(key)) })
  else apply()
}
const toggleHiddenSection = (section: UserProfileSection) => {
  if (!profile.value) return
  const restoring = profile.value.hiddenSections.includes(section)
  const apply = () => {
    profile.value!.hiddenSections = restoring
      ? profile.value!.hiddenSections.filter(item => item !== section)
      : [...profile.value!.hiddenSections, section]
    persist()
  }
  if (restoring) requestPrivacyChange(`将恢复显示“${{socialId:'账号 ID',signature:'个性签名',status:'当前状态',moments:'用户动态',relationships:'角色关系',identity:'基础资料'}[section]}”。`, apply, { sensitive: section === 'moments' || section === 'relationships' })
  else apply()
}
const overrideFor = (chat: any): UserCharacterPrivacyOverride => {
  const id = String(chat.characterEntityId || chat.id)
  if (!profile.value!.overrides[id]) profile.value!.overrides[id] = { characterId: id, updatedAt: Date.now() }
  return profile.value!.overrides[id]
}
const networkMode = (chat: any) => overrideFor(chat).networkPresentation || 'inherit'
const cycleNetworkMode = (chat: any) => {
  const override = overrideFor(chat)
  const modes = ['inherit', 'full', 'compact', 'anonymous', 'hidden'] as const
  const next = modes[(modes.indexOf((override.networkPresentation || 'inherit') as any) + 1) % modes.length]
  const apply = () => { override.networkPresentation = next; override.updatedAt = Date.now(); persist() }
  if (['full', 'compact', 'anonymous'].includes(next)) requestPrivacyChange(`将允许“${chat.realName || chat.name}”以${{full:'完整',compact:'简要',anonymous:'匿名'}[next as 'full'|'compact'|'anonymous']}方式在人脉中展示你。`, apply, { sensitive: true })
  else apply()
}
const networkModeLabel = (chat: any) => ({ inherit: '跟随默认', full: '完整展示', compact: '简要展示', anonymous: '匿名参与', hidden: '完全隐藏' }[networkMode(chat)] || '跟随默认')
const toggleRelationshipDisplay = (chat: any) => {
  const override = overrideFor(chat)
  const enabled = override.showOnUserProfile !== true
  const apply = () => {
    override.showOnUserProfile = enabled
    if (enabled && !override.publicRelationLabel) override.publicRelationLabel = ensureRelationship(chat).friendship === 'friends' ? '好友' : '认识的人'
    override.updatedAt = Date.now()
    persist()
  }
  if (enabled) requestPrivacyChange(`将在用户主页展示你与“${chat.realName || chat.name}”的关系。`, apply, { sensitive: true })
  else apply()
}
const togglePinned = (chat: any) => {
  const override = overrideFor(chat)
  override.pinned = !override.pinned
  if (override.pinned) override.pinOrder = Math.max(0, ...Object.values(profile.value!.overrides).map(item => Number(item.pinOrder || 0))) + 1
  persist()
}
const toggleSelect = (chat: any) => {
  const id = String(chat.characterEntityId || chat.id)
  selectedCharacterIds.value = selectedCharacterIds.value.includes(id)
    ? selectedCharacterIds.value.filter(item => item !== id) : [...selectedCharacterIds.value, id]
}
const selectAllFiltered = () => {
  const ids = filteredChats.value.map((chat: any) => String(chat.characterEntityId || chat.id))
  const allSelected = ids.every(id => selectedCharacterIds.value.includes(id))
  selectedCharacterIds.value = allSelected ? selectedCharacterIds.value.filter(id => !ids.includes(id)) : Array.from(new Set([...selectedCharacterIds.value, ...ids]))
}
const batchNetworkMode = (mode: 'inherit' | 'full' | 'compact' | 'anonymous' | 'hidden') => {
  if (!profile.value) return
  const apply = () => {
    selectedCharacterIds.value.forEach(id => {
      profile.value!.overrides[id] = { ...(profile.value!.overrides[id] || { characterId: id }), networkPresentation: mode, updatedAt: Date.now() }
    })
    persist(); notify(`已更新 ${selectedCharacterIds.value.length} 位角色`)
  }
  if (['full','compact','anonymous'].includes(mode)) requestPrivacyChange(`${selectedCharacterIds.value.length} 位角色的人脉展示将改为“${{full:'完整',compact:'简要',anonymous:'匿名'}[mode as 'full'|'compact'|'anonymous']}”。`, apply, { sensitive: true })
  else apply()
}
const cycleOverrideAudience = (chat: any, key: 'profileAudience' | 'momentsAudience' | 'relationshipsAudience' | 'statusAudience') => {
  const override = overrideFor(chat)
  const values = ['inherit', 'public', 'friends', 'private'] as const
  const previous = override[key] || 'inherit'
  const next = values[(values.indexOf(previous as any) + 1) % values.length]
  const apply = () => { override[key] = next; override.updatedAt = Date.now(); persist() }
  const effectivePrevious = previous === 'inherit' ? profile.value!.profileAudience : previous
  const effectiveNext = next === 'inherit' ? profile.value!.profileAudience : next
  if (audienceRank(effectiveNext) > audienceRank(effectivePrevious)) requestPrivacyChange(`将扩大“${chat.realName || chat.name}”对该分区的可见范围。`, apply, { sensitive: key === 'momentsAudience' || key === 'relationshipsAudience', privateToPublic: effectivePrevious === 'private' && effectiveNext === 'public' })
  else apply()
}
const overrideAudienceLabel = (value: UserProfileAudience | 'inherit' | undefined) => ({ inherit: '跟随默认', public: '公开', friends: '好友可见', private: '仅自己' }[value || 'inherit'])
const cycleOverrideBoolean = (chat: any, key: 'discoverable' | 'allowFriendRequests' | 'allowMomentLikes' | 'allowMomentComments' | 'allowMomentMentions' | 'allowProfileAwareness') => {
  const override = overrideFor(chat)
  const value = override[key]
  const next = value === null || value === undefined ? true : value === true ? false : null
  const apply = () => { (override as any)[key] = next; override.updatedAt = Date.now(); persist() }
  if (next === true) requestPrivacyChange(`将单独允许“${chat.realName || chat.name}”使用此项权限。`, apply, { sensitive: key === 'allowMomentComments' || key === 'allowMomentMentions' })
  else apply()
}
const overrideBooleanLabel = (value: boolean | null | undefined) => value === true ? '允许' : value === false ? '禁止' : '跟随默认'
const approveRelationLabel = (chat: any, approved: boolean) => {
  const override = overrideFor(chat)
  if (approved) {
    override.relationLabelApproved = true
    override.showOnUserProfile = true
  } else {
    override.publicRelationLabel = ''
    override.relationLabelApproved = false
  }
  persist(); notify(approved ? '关系标签已公开' : '已拒绝关系标签')
}
const setStatusExpiry = (value: string) => {
  if (!profile.value) return
  const now = Date.now()
  profile.value.statusCreatedAt = profile.value.statusText ? now : 0
  profile.value.statusExpiresAt = value === 'never' ? null
    : value === 'today' ? new Date(new Date().setHours(23, 59, 59, 999)).getTime()
      : now + Number(value) * 60000
  persist()
}
const setCustomStatusExpiry = () => {
  if (!profile.value || !customStatusExpiry.value) return
  const time = new Date(customStatusExpiry.value).getTime()
  if (!Number.isFinite(time) || time <= Date.now()) { notify('请选择未来的时间'); return }
  profile.value.statusCreatedAt = profile.value.statusText ? Date.now() : 0
  profile.value.statusExpiresAt = time
  persist(); notify('状态过期时间已更新')
}
const restoreStatus = (item: { text: string }) => {
  if (!profile.value) return
  profile.value.statusText = item.text
  profile.value.statusCreatedAt = Date.now()
  profile.value.statusExpiresAt = null
  persist()
}
const formatTime = (time: number) => new Date(time).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
const audienceLabel = (audience: UserProfileAudience) => ({ public: '公开', friends: '好友可见', private: '仅自己' }[audience])

onMounted(() => { void load(); window.addEventListener('clingy:moments-updated', load) })
onUnmounted(() => { window.removeEventListener('clingy:moments-updated', load); if (toastTimer) window.clearTimeout(toastTimer) })
</script>

<template>
  <div v-if="profile" class="user-profile-view">
    <Transition name="social-toast"><div v-if="toast" class="character-social-toast">{{ toast }}</div></Transition>
    <nav class="floating-nav-bar solid-nav">
      <button class="nav-circle-btn" type="button" aria-label="返回" @click="currentPage !== 'profile' ? currentPage = 'profile' : emit('back')"><svg viewBox="0 0 24 24"><path d="m15 5-7 7 7 7"/></svg></button>
      <span class="nav-title">{{ currentPage === 'moments' ? '我的动态' : currentPage === 'relationships' ? '我的关系' : displayName }}</span>
      <button v-if="currentPage === 'profile'" class="nav-circle-btn" type="button" aria-label="编辑主页" @click="showManage = true"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .3 1.8l.1.1-2.8 2.8-.1-.1a1.65 1.65 0 0 0-1.8-.3 1.65 1.65 0 0 0-1 1.5v.2h-4v-.2a1.65 1.65 0 0 0-1-1.5 1.65 1.65 0 0 0-1.8.3l-.1.1-2.8-2.8.1-.1a1.65 1.65 0 0 0 .3-1.8 1.65 1.65 0 0 0-1.5-1H3v-4h.2a1.65 1.65 0 0 0 1.5-1 1.65 1.65 0 0 0-.3-1.8l-.1-.1 2.8-2.8.1.1a1.65 1.65 0 0 0 1.8.3 1.65 1.65 0 0 0 1-1.5V3h4v.2a1.65 1.65 0 0 0 1 1.5 1.65 1.65 0 0 0 1.8-.3l.1-.1 2.8 2.8-.1.1a1.65 1.65 0 0 0-.3 1.8 1.65 1.65 0 0 0 1.5 1h.2v4h-.2a1.65 1.65 0 0 0-1.4 1z"/></svg></button>
      <div v-else class="nav-spacer"></div>
    </nav>

    <div class="profile-scroll-container with-solid-nav">
      <template v-if="currentPage === 'profile'">
        <template v-if="appearanceStyleId === 'default'">
          <header class="character-hero-cover user-hero"><div class="cover-image" :style="coverUrl ? { backgroundImage: `url(${coverUrl})` } : {}"></div><div class="hero-fog-overlay"></div></header>
          <main class="editorial-body">
            <section class="user-avatar-identity">
              <button class="user-profile-avatar" type="button" :style="currentAccount?.avatarUrl ? { backgroundImage: `url(${currentAccount.avatarUrl})` } : {}" @click="showAvatarUpload = true">{{ currentAccount?.avatarUrl ? '' : displayName.charAt(0) }}</button>
              <div><h1>{{ displayName }}</h1><button v-if="!profile.hiddenSections.includes('socialId')" type="button" @click="copyId">@{{ profile.socialId }}</button></div>
            </section>
            <blockquote v-if="displaySignature" class="character-quote">“{{ displaySignature }}”</blockquote>
            <section class="editorial-note user-privacy-note"><svg viewBox="0 0 24 24"><path d="M12 3 4 7v5c0 5 3.4 8 8 9 4.6-1 8-4 8-9V7z"/><path d="M9 12h6"/></svg><div><strong>{{ audienceLabel(profile.profileAudience) }}</strong><span>分区和角色例外可以进一步收紧或开放</span></div><button type="button" @click="showManage = true; manageTab = 'privacy'">设置</button></section>
            <section v-if="profile.showStatus && statusActive && !profile.hiddenSections.includes('status')" class="editorial-note user-status-note"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M8 12h8"/></svg><div><strong>当前状态</strong><span>{{ profile.statusText }}<template v-if="profile.statusExpiresAt"> · {{ formatTime(profile.statusExpiresAt) }} 过期</template></span></div></section>
            <section v-if="!profile.hiddenSections.includes('moments')" class="moments-stream"><div class="stream-header"><h2>我的动态</h2><span>({{ moments.length }})</span></div><div v-if="loading" class="empty-stream"><span class="character-loading-ring"></span></div><div v-else-if="!moments.length" class="empty-stream"><div class="empty-hint">还没有发布内容</div></div><div v-else class="stream-cards"><article v-for="item in moments.slice(0,3)" :key="item.id" class="editorial-card" @click="currentPage='moments'"><div class="card-meta"><time>{{ formatTime(item.time) }}</time><span class="card-tag">{{ item.visibility || '公开' }}</span></div><p class="card-text">{{ item.content }}</p><div v-if="item.images?.length" class="card-grid" :class="`grid-${Math.min(item.images.length,3)}`"><img v-for="(img,index) in item.images.slice(0,3)" :key="index" :src="typeof img==='string'?img:img.url" alt="动态图片" /></div></article><button v-if="moments.length>3" class="view-all-btn" type="button" @click="currentPage='moments'">查看全部 {{ moments.length }} 条动态</button></div></section>
            <section v-if="profile.showCharacterRelationships && !profile.hiddenSections.includes('relationships')" class="editorial-links social-network-preview"><header><strong>我的关系</strong><span>{{ visibleRelationships.length }} 位公开角色</span></header><button v-for="chat in visibleRelationships.slice(0,4)" :key="chat.id" type="button" @click="emit('open-character',chat)"><span class="network-avatar" :style="chat.avatarUrl?{backgroundImage:`url(${chat.avatarUrl})`}:{}">{{ chat.avatarUrl?'':(chat.name||'角').charAt(0) }}</span><span><b>{{ chat.realName||chat.name }}</b><small>{{ overrideFor(chat).publicRelationLabel || '好友' }}</small></span><em>查看</em></button><button v-if="visibleRelationships.length>4" class="network-all" type="button" @click="currentPage='relationships'">查看全部</button></section>
          </main>
        </template>
        <template v-else>
          <MagazineProfileStyle v-if="appearanceStyleId==='magazine'" :chat="profileChat" :cover-url="coverUrl" :display-name="displayName" :display-signature="displaySignature" :moments="moments" :loading="loading" :can-view-moments="!profile.hiddenSections.includes('moments')" @copy-id="copyId" @open-moments="currentPage='moments'" />
          <LetterProfileStyle v-else :chat="profileChat" :cover-url="coverUrl" :display-name="displayName" :display-signature="displaySignature" :moments="moments" :loading="loading" :can-view-moments="!profile.hiddenSections.includes('moments')" @copy-id="copyId" @open-moments="currentPage='moments'" />
          <main class="editorial-body alternate-user-extras">
            <section class="editorial-note user-privacy-note"><svg viewBox="0 0 24 24"><path d="M12 3 4 7v5c0 5 3.4 8 8 9 4.6-1 8-4 8-9V7z"/></svg><div><strong>{{ audienceLabel(profile.profileAudience) }}</strong><span>这是当前账号的用户主页</span></div><button type="button" @click="showManage=true;manageTab='privacy'">设置</button></section>
            <section v-if="profile.showStatus && statusActive && !profile.hiddenSections.includes('status')" class="editorial-note user-status-note"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M8 12h8"/></svg><div><strong>当前状态</strong><span>{{ profile.statusText }}<template v-if="profile.statusExpiresAt"> · {{ formatTime(profile.statusExpiresAt) }} 过期</template></span></div></section>
            <section v-if="profile.showCharacterRelationships && !profile.hiddenSections.includes('relationships')" class="editorial-links social-network-preview"><header><strong>我的关系</strong><span>{{ visibleRelationships.length }} 位公开角色</span></header><button v-for="chat in visibleRelationships.slice(0,4)" :key="chat.id" type="button" @click="emit('open-character',chat)"><span class="network-avatar" :style="chat.avatarUrl?{backgroundImage:`url(${chat.avatarUrl})`}:{}">{{ chat.avatarUrl?'':(chat.name||'角').charAt(0) }}</span><span><b>{{ chat.realName||chat.name }}</b><small>{{ overrideFor(chat).publicRelationLabel || '好友' }}</small></span><em>查看</em></button><button v-if="visibleRelationships.length>4" class="network-all" type="button" @click="currentPage='relationships'">查看全部</button></section>
          </main>
        </template>
      </template>

      <div v-else-if="currentPage==='moments'" class="full-stream"><div class="editorial-moment-toolbar"><div><strong>我的动态</strong><span>展示范围同时受主页与单条动态隐私控制</span></div><button type="button" @click="emit('open-discover')">前往朋友圈</button></div><div v-if="!moments.length" class="character-state-card empty"><strong>还没有动态</strong><p>可以前往朋友圈手动发布。</p></div><div v-else class="stream-cards"><article v-for="item in moments" :key="item.id" class="editorial-card"><div class="card-meta"><time>{{ formatTime(item.time) }}</time><span class="card-tag">{{ item.visibility || '公开' }}</span></div><p class="card-text">{{ item.content }}</p><div v-if="item.images?.length" class="card-grid" :class="`grid-${Math.min(item.images.length,3)}`"><img v-for="(img,index) in item.images" :key="index" :src="typeof img==='string'?img:img.url" alt="动态图片" /></div></article></div></div>
      <div v-else class="full-stream social-network-page"><div class="editorial-moment-toolbar"><div><strong>公开角色关系</strong><span>只有你明确允许的角色会显示</span></div></div><div v-if="!visibleRelationships.length" class="character-state-card empty"><strong>没有公开关系</strong><p>可以在主页设置中选择角色并确认公开标签。</p></div><div v-else class="network-page-list"><button v-for="chat in visibleRelationships" :key="chat.id" type="button" @click="emit('open-character',chat)"><span class="network-avatar large" :style="chat.avatarUrl?{backgroundImage:`url(${chat.avatarUrl})`}:{}">{{ chat.avatarUrl?'':(chat.name||'角').charAt(0) }}</span><span class="network-copy"><b>{{ chat.realName||chat.name }}</b><small>{{ overrideFor(chat).publicRelationLabel||'好友' }}</small><em>{{ overrideFor(chat).pinned?'已固定在主页':'公开展示' }}</em></span><svg viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"/></svg></button></div></div>
    </div>

    <div v-if="currentPage==='profile'" class="floating-thumb-dock user-thumb-dock"><button class="primary-chat-btn" type="button" @click="showManage=true"><svg viewBox="0 0 24 24"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4z"/></svg><span>编辑主页</span></button><button class="icon-dock-btn" type="button" title="更换背景" @click="showCoverUpload=true"><svg viewBox="0 0 24 24"><path d="M3 5h18v14H3zM3 15l5-5 4 4 3-3 6 6"/></svg></button></div>

    <Teleport to="body">
      <Transition name="social-sheet"><div v-if="showManage" class="character-sheet-overlay" @click.self="showManage=false"><section class="character-manage-sheet user-manage-sheet"><header><div><p>ACCOUNT PROFILE</p><h2>管理用户主页</h2></div><button type="button" aria-label="关闭" @click="showManage=false"><svg viewBox="0 0 24 24"><path d="m6 6 12 12M18 6 6 18"/></svg></button></header><nav><button v-for="tab in [{id:'profile',label:'资料'},{id:'privacy',label:'隐私'},{id:'characters',label:'角色例外'},{id:'status',label:'状态'}]" :key="tab.id" type="button" :class="{active:manageTab===tab.id}" @click="manageTab=tab.id as any">{{ tab.label }}</button></nav><div class="manage-scroll">
        <div v-if="manageTab==='profile'" class="manage-pane"><label class="manage-field"><span>账号网名<small>{{ profile.displayName.length }}/40</small></span><input v-model="profile.displayName" maxlength="40" placeholder="输入主页显示名称" /></label><label class="manage-field"><span>个性签名<small>{{ profile.signature.length }}/160</small></span><textarea v-model="profile.signature" maxlength="160" placeholder="写一句想放在主页的话"></textarea></label><fieldset class="manage-cover-field"><legend>主页形象</legend><button type="button" @click="showAvatarUpload=true"><span :style="currentAccount?.avatarUrl?{backgroundImage:`url(${currentAccount.avatarUrl})`,backgroundSize:'cover',backgroundPosition:'center'}:{}"></span><b>账号头像</b><svg viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"/></svg></button><button type="button" @click="showCoverUpload=true"><span :style="coverUrl?{backgroundImage:`url(${coverUrl})`,backgroundSize:'cover',backgroundPosition:'center'}:{}"></span><b>主页背景</b><svg viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"/></svg></button></fieldset><button class="manage-save-button" type="button" :disabled="!profile.displayName.trim()" @click="saveProfile">保存主页资料</button></div>
        <div v-else-if="manageTab==='privacy'" class="manage-pane privacy-pane">
          <section class="privacy-presets"><header><strong>主页可见范围</strong><span>选择后仍可单独调整每个区域</span></header><div><button v-for="option in audienceOptions" :key="option.id" type="button" :class="{active:profile.profileAudience===option.id}" @click="setPreset(option.id)"><strong>{{ option.label }}</strong><span>{{ option.desc }}</span></button></div></section>
          <section class="permission-list"><label v-for="item in [{key:'discoverable',label:'允许角色发现我',desc:'角色可通过聊天与人脉发现主页'},{key:'allowFriendRequests',label:'接收角色好友申请',desc:'角色可以自主提出好友申请'},{key:'participateInCharacterNetworks',label:'参与角色人脉',desc:'允许自己出现在角色主页的人脉中'},{key:'showCharacterRelationships',label:'展示我的角色关系',desc:'在用户主页展示已确认的角色关系'},{key:'allowProfileAwareness',label:'角色感知主页',desc:'可见资料可进入正常聊天上下文'},{key:'allowMomentLikes',label:'允许角色点赞',desc:'角色可对有权查看的动态点赞'},{key:'allowMomentComments',label:'允许角色评论',desc:'角色可对有权查看的动态评论'},{key:'allowMomentMentions',label:'允许提到动态',desc:'角色可在聊天中自然提起可见动态'}]" :key="item.key"><span><strong>{{ item.label }}</strong><small>{{ item.desc }}</small></span><span class="character-switch"><input :checked="Boolean((profile as any)[item.key])" type="checkbox" @change="toggleBooleanPermission(item.key as keyof UserSocialProfile, ($event.target as HTMLInputElement).checked)"><i></i></span></label></section>
          <section class="section-privacy"><header><strong>分区可见范围</strong><span>完全隐藏后自己主页也不显示该区域</span></header><article v-for="section in [{id:'socialId',label:'账号 ID'},{id:'signature',label:'个性签名'},{id:'status',label:'当前状态'},{id:'moments',label:'用户动态'},{id:'relationships',label:'角色关系'}]" :key="section.id"><div><strong>{{ section.label }}</strong><small>{{ profile.hiddenSections.includes(section.id as any)?'完全隐藏':audienceLabel(profile.sectionAudiences[section.id as UserProfileSection]) }}</small></div><div class="compact-actions"><button type="button" @click="setSectionAudience(section.id as UserProfileSection, profile.sectionAudiences[section.id as UserProfileSection]==='public'?'friends':profile.sectionAudiences[section.id as UserProfileSection]==='friends'?'private':'public')">切换范围</button><button type="button" :class="{danger:profile.hiddenSections.includes(section.id as any)}" @click="toggleHiddenSection(section.id as UserProfileSection)">{{ profile.hiddenSections.includes(section.id as any)?'恢复':'隐藏' }}</button></div></article></section>
          <section class="privacy-confirm"><label><span><strong>扩大公开范围时</strong><small>缩小范围始终立即生效</small></span><select v-model="profile.privacyConfirmation" @change="persist"><option value="always">每次确认</option><option value="sensitive">仅动态和关系确认</option><option value="private_to_public">仅私密改公开时确认</option><option value="never">不再确认</option></select></label></section>
        </div>
        <div v-else-if="manageTab==='characters'" class="manage-pane character-exceptions">
          <div class="exception-toolbar"><input v-model="characterSearch" placeholder="搜索角色" /><button type="button" @click="selectAllFiltered">全选/取消</button></div>
          <div v-if="selectedCharacterIds.length" class="batch-actions"><span>已选 {{ selectedCharacterIds.length }} 位</span><button type="button" @click="batchNetworkMode('full')">完整</button><button type="button" @click="batchNetworkMode('compact')">简要</button><button type="button" @click="batchNetworkMode('anonymous')">匿名</button><button type="button" @click="batchNetworkMode('hidden')">隐藏</button><button type="button" @click="batchNetworkMode('inherit')">默认</button></div>
          <article v-for="chat in filteredChats" :key="chat.id" class="exception-card">
            <button class="exception-select" type="button" :class="{active:selectedCharacterIds.includes(String(chat.characterEntityId||chat.id))}" @click="toggleSelect(chat)"><svg v-if="selectedCharacterIds.includes(String(chat.characterEntityId||chat.id))" viewBox="0 0 24 24"><path d="m5 12 4 4L19 6"/></svg></button>
            <span class="network-avatar" :style="chat.avatarUrl?{backgroundImage:`url(${chat.avatarUrl})`}:{}">{{ chat.avatarUrl?'':(chat.name||'角').charAt(0) }}</span>
            <div><strong>{{ chat.realName||chat.name }}</strong><small>{{ ensureRelationship(chat).friendship==='friends'?'好友':'非好友' }} · {{ networkModeLabel(chat) }}</small></div>
            <div class="exception-actions"><button type="button" @click="cycleNetworkMode(chat)">人脉</button><button type="button" :class="{active:overrideFor(chat).showOnUserProfile}" @click="toggleRelationshipDisplay(chat)">主页</button><button type="button" :disabled="!overrideFor(chat).showOnUserProfile" :class="{active:overrideFor(chat).pinned}" @click="togglePinned(chat)">固定</button><button type="button" :class="{active:expandedCharacterId===String(chat.characterEntityId||chat.id)}" @click="expandedCharacterId=expandedCharacterId===String(chat.characterEntityId||chat.id)?'':String(chat.characterEntityId||chat.id)">详细</button></div>
            <label v-if="overrideFor(chat).showOnUserProfile" class="relation-label-editor"><span>公开关系标签</span><input v-model="overrideFor(chat).publicRelationLabel" maxlength="20" placeholder="例如：好友" @change="overrideFor(chat).relationLabelApproved=true;persist()" /></label>
            <div v-if="overrideFor(chat).publicRelationLabel && !overrideFor(chat).relationLabelApproved" class="relation-proposal"><span>对方提议公开“{{ overrideFor(chat).publicRelationLabel }}”</span><button type="button" @click="approveRelationLabel(chat,true)">同意</button><button type="button" @click="approveRelationLabel(chat,false)">拒绝</button></div>
            <div v-if="expandedCharacterId===String(chat.characterEntityId||chat.id)" class="exception-detail">
              <button type="button" @click="cycleOverrideAudience(chat,'profileAudience')"><span>主页</span><b>{{ overrideAudienceLabel(overrideFor(chat).profileAudience) }}</b></button>
              <button type="button" @click="cycleOverrideAudience(chat,'momentsAudience')"><span>动态</span><b>{{ overrideAudienceLabel(overrideFor(chat).momentsAudience) }}</b></button>
              <button type="button" @click="cycleOverrideAudience(chat,'relationshipsAudience')"><span>关系</span><b>{{ overrideAudienceLabel(overrideFor(chat).relationshipsAudience) }}</b></button>
              <button type="button" @click="cycleOverrideAudience(chat,'statusAudience')"><span>状态</span><b>{{ overrideAudienceLabel(overrideFor(chat).statusAudience) }}</b></button>
              <button v-for="item in [{key:'discoverable',label:'发现我'},{key:'allowFriendRequests',label:'好友申请'},{key:'allowMomentLikes',label:'动态点赞'},{key:'allowMomentComments',label:'动态评论'},{key:'allowMomentMentions',label:'聊天提及'},{key:'allowProfileAwareness',label:'主页感知'}]" :key="item.key" type="button" @click="cycleOverrideBoolean(chat,item.key as any)"><span>{{ item.label }}</span><b>{{ overrideBooleanLabel((overrideFor(chat) as any)[item.key]) }}</b></button>
            </div>
          </article>
        </div>
        <div v-else class="manage-pane status-pane"><section class="status-editor"><label class="manage-field"><span>当前状态<small>{{ profile.statusText.length }}/80</small></span><textarea v-model="profile.statusText" maxlength="80" placeholder="正在做什么，或者此刻的心情"></textarea></label><div class="status-expiry"><strong>自动过期</strong><div><button type="button" @click="setStatusExpiry('30')">30 分钟</button><button type="button" @click="setStatusExpiry('60')">1 小时</button><button type="button" @click="setStatusExpiry('240')">4 小时</button><button type="button" @click="setStatusExpiry('today')">今天结束</button><button type="button" @click="setStatusExpiry('never')">永不过期</button></div><label class="custom-expiry"><input v-model="customStatusExpiry" type="datetime-local" /><button type="button" @click="setCustomStatusExpiry">应用自定义时间</button></label></div><label class="toggle-row"><span><strong>在主页显示状态</strong><small>仍受状态分区隐私控制</small></span><span class="character-switch"><input v-model="profile.showStatus" type="checkbox" @change="persist"><i></i></span></label><label class="toggle-row"><span><strong>保留过期状态</strong><small>保存在最近状态中，仅自己可见</small></span><span class="character-switch"><input v-model="profile.keepExpiredStatus" type="checkbox" @change="persist"><i></i></span></label><button class="manage-save-button" type="button" @click="profile.statusCreatedAt=profile.statusText?Date.now():0;persist();notify('状态已保存')">保存状态</button></section><section v-if="profile.recentStatuses.length" class="recent-statuses"><header><strong>最近状态</strong></header><button v-for="item in profile.recentStatuses" :key="`${item.createdAt}_${item.text}`" type="button" @click="restoreStatus(item)"><span>{{ item.text }}</span><small>{{ formatTime(item.expiredAt) }}</small></button></section></div>
      </div></section></div></Transition>
      <Transition name="social-sheet"><div v-if="pendingPrivacyChange" class="character-sheet-overlay center" @click.self="pendingPrivacyChange=null"><section class="character-editor-modal privacy-change-confirm" role="dialog" aria-modal="true"><header><div><p>PRIVACY CHECK</p><h2>确认扩大可见范围</h2></div><button type="button" aria-label="关闭" @click="pendingPrivacyChange=null"><svg viewBox="0 0 24 24"><path d="m6 6 12 12M18 6 6 18"/></svg></button></header><p>{{ pendingPrivacyChange.summary }}</p><small>缩小范围会立即生效；你可以随时在隐私设置中改变确认方式。</small><footer><button type="button" @click="pendingPrivacyChange=null">取消</button><button class="primary" type="button" @click="confirmPrivacyChange">确认公开</button></footer></section></div></Transition>
    </Teleport>
    <AvatarUploadModal v-model:visible="showCoverUpload" :current-avatar="coverUrl" shape="wallpaper" title="设置用户主页背景" @saved="saveCover" />
    <AvatarUploadModal v-model:visible="showAvatarUpload" :current-avatar="currentAccount?.avatarUrl" shape="avatar" title="更换账号头像" enable-crop @saved="saveAvatar" />
  </div>
</template>

<style scoped src="./CharacterProfileView.css"></style>
<style scoped src="./UserProfileView.css"></style>
