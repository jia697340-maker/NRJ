/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { computed, ref, watch } from 'vue'
import { listCurrentChatCharacterDirectory } from '../services/characterDirectory'
import { createForumFriendContact } from '../services/characterDirectory'
import { loadCustomContacts } from './chatState/contacts'
import { requestForumJson } from '../services/forumAI'
import { createLightShortVideo, generateForumImage, generateForumVoice } from '../services/forumMediaGeneration'
import { canAccountAppear, visiblePostsFor } from '../services/forumPolicy'
import { emptyForumSnapshot, loadForumSnapshot, removeForumMedia, resolveForumMediaUrl, saveForumSnapshot, storeForumMedia } from '../services/forumRepository'
import { markPostOpened, rankForumFeed, recordFeedExposure, type ForumFeedKind } from '../services/forumFeedRanking'
import { syncForumCharacters } from '../services/forumPopulation'
import { defaultForumGenerationConfig, generateForumContentBatch, promoteLightweightAuthor } from '../services/forumGeneration'
import { forumGenerationRuntime, runSingleForumGenerationTask } from '../services/forumGenerationRuntime'
import { generateForumPostInteractions } from '../services/forumPostInteraction'
import { generateCommunityCommentResponse } from '../services/forumCommentResponse'
import { requestForumDmXml } from '../services/forumAI'
import { parseChatMessageXml } from '../services/chatMessageXml'
import { optimizeImageFile } from '../services/imageOptimization'
import type {
  ForumAccount, ForumAccountKind, ForumAvatarLibraryItem, ForumBlockRule, ForumBridgePolicy, ForumCircle, ForumComment, ForumConversation, ForumDirectMessage, ForumLottery, ForumLotteryResult,
  ForumCommentGenerationMode, ForumDmGenerationTask, ForumGenerationConfig, ForumMediaItem, ForumMuteRule, ForumParticipantPolicy, ForumPoll, ForumPost, ForumPostInteractionConfig, ForumPostType, ForumReplyTimingMode, ForumSnapshot, ForumSubject, ForumUser, ForumVisibilityRule, ForumWorldBinding
} from '../types/forum'

export type ForumTab = 'feed' | 'circles' | 'messages' | 'profile'
export type ForumRoute =
  | { name: 'tab' }
  | { name: 'post_detail'; postId: string }
  | { name: 'user_profile'; userId: string }
  | { name: 'chat_room'; userId: string }
  | { name: 'circle'; circleId: string }
  | { name: 'settings'; section?: string }
  | { name: 'search' }
  | { name: 'publish'; circleId?: string }

const snapshot = ref<ForumSnapshot>(emptyForumSnapshot())
const ready = ref(false)
const busy = ref(false)
const error = ref('')
const activeTab = ref<ForumTab>('feed')
const feedMode = ref<ForumFeedKind>('recommend')
const routeStack = ref<ForumRoute[]>([{ name: 'tab' }])
const feedScrollPositions = ref<Record<string, number>>({ recommend: 0, following: 0, latest: 0 })
const generationBusy = computed(() => forumGenerationRuntime.status === 'running')
const generationProgress = computed(() => forumGenerationRuntime.progress)
const generationError = computed(() => forumGenerationRuntime.error)
const interactionBusy = ref(false)
const interactionError = ref('')
const communityResponseBusyCommentId = ref('')
const friendFeedback = ref('')
let loading: Promise<void> | null = null
let saveTimer: ReturnType<typeof setTimeout> | null = null
const pendingRevealTimers = new Map<string, ReturnType<typeof setTimeout>>()
const dmQueues = new Map<string, Promise<boolean>>()

const id = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
const nowLabel = () => '刚刚'
const scheduleLocalReveal = (kind: 'comment' | 'message', entityId: string, revealAt?: number) => {
  const key = `${kind}:${entityId}`
  const existing = pendingRevealTimers.get(key)
  if (existing) clearTimeout(existing)
  pendingRevealTimers.delete(key)
  if (!revealAt || revealAt <= Date.now()) return
  const timer = setTimeout(() => {
    const entity = kind === 'comment' ? snapshot.value.comments.find(item => item.id === entityId) : snapshot.value.messages.find(item => item.id === entityId)
    if (entity && entity.revealAt && entity.revealAt <= Date.now()) {
      entity.revealAt = Date.now()
      if (kind === 'message' && 'conversationId' in entity) {
        const conversation = snapshot.value.conversations.find(item => item.id === entity.conversationId)
        if (conversation) { conversation.lastMessage = entity.content; conversation.lastMessageTime = nowLabel() }
      }
      void saveForumSnapshot(snapshot.value)
    }
    pendingRevealTimers.delete(key)
  }, Math.min(2147483647, Math.max(0, revealAt - Date.now())))
  pendingRevealTimers.set(key, timer)
}
const defaultPolicy = (subjectId: string, enabled = false): ForumParticipantPolicy => ({
  id: id('participant'), subjectId, enabled, allowedCircleIds: [], blockedCircleIds: [], allowedAccountIds: [], allowedGroupIds: [], scope: ['global'], allowPublicDiscovery: true, allowNpcKnowledge: true, allowMention: true, allowSearch: true, allowRecommendation: true, allowDm: true, allowGroup: true,
  autonomy: { level: 'off', actions: {} }, updatedAt: Date.now()
})
const defaultBridge = (subjectId: string): ForumBridgePolicy => ({ id: id('bridge'), subjectId, forumToChat: { mode: 'off', memoryTypes: [] }, chatToForum: { mode: 'off', memoryTypes: [] }, updatedAt: Date.now() })
const persistAvatarValue = async (value: string, label: string) => {
  if (!value.startsWith('data:image/')) return { url: value, mediaId: undefined as string | undefined }
  const source = await fetch(value).then(response => response.blob())
  const optimized = source.size ? await optimizeImageFile(new File([source], `${label}.png`, { type: source.type || 'image/png' })) : source
  const media = await storeForumMedia(optimized, { type: 'image', mimeType: optimized.type, alt: label })
  return { url: await resolveForumMediaUrl(media), mediaId: media.storageKey }
}

const ensureLoaded = () => {
  if (loading) return loading
  loading = loadForumSnapshot().then(async value => {
    await Promise.all(value.posts.flatMap(post => (post.media || []).map(async media => {
      if (media.storageKey) media.url = await resolveForumMediaUrl(media)
      if (media.audioStorageKey) media.audioUrl = await resolveForumMediaUrl({ url: `localforage:nrt-forum/forumMedia/${media.audioStorageKey}`, storageKey: media.audioStorageKey })
    })))
    await Promise.all(value.avatarLibrary.map(async item => {
      if (item.storageKey) item.url = await resolveForumMediaUrl({ url: item.url, storageKey: item.storageKey })
    }))
    value.accounts.forEach(account => {
      const libraryItem = account.avatarLibraryItemId ? value.avatarLibrary.find(item => item.id === account.avatarLibraryItemId) : undefined
      if (libraryItem) account.avatar = libraryItem.url
    })
    await Promise.all(value.accounts.filter(account => account.avatarMediaId && !value.avatarLibrary.some(item => item.id === account.avatarLibraryItemId)).map(async account => { account.avatar = await resolveForumMediaUrl({ url: account.avatar, storageKey: account.avatarMediaId }) }))
    syncForumCharacters(value)
    value.comments.forEach(item => scheduleLocalReveal('comment', item.id, item.revealAt))
    value.messages.forEach(item => scheduleLocalReveal('message', item.id, item.revealAt))
    snapshot.value = value
    ready.value = true
  })
  return loading
}

watch(snapshot, () => {
  if (!ready.value) return
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => { void saveForumSnapshot(snapshot.value) }, 120)
}, { deep: true })

const accountToUser = (account: ForumAccount): ForumUser => {
  const relationships = snapshot.value.relationships
  return {
    ...account,
    followersCount: relationships.filter(item => item.type === 'follow' && item.toAccountId === account.id).length,
    followingCount: relationships.filter(item => item.type === 'follow' && item.fromAccountId === account.id).length,
    postsCount: snapshot.value.posts.filter(item => item.authorAccountId === account.id).length,
    likesCount: snapshot.value.posts.filter(item => item.authorAccountId === account.id).reduce((sum, item) => sum + item.likeCount, 0),
    joinedDate: new Date(account.joinedAt).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long' }),
    isFollowing: snapshot.value.relationships.some(item => item.type === 'follow' && item.fromAccountId === snapshot.value.settings.activeAccountId && item.toAccountId === account.id)
  }
}

const hydratePost = (post: ForumPost): ForumPost => {
  const account = snapshot.value.accounts.find(item => item.id === post.authorAccountId)
  const actor = account ? accountToUser(account) : post.author
  const viewerId = snapshot.value.settings.activeAccountId
  return {
    ...post,
    author: post.anonymousIdentityId ? { ...actor, id: `anon_${post.anonymousIdentityId}`, name: anonymousLabel(post.anonymousIdentityId), handle: 'anonymous', avatar: '', searchable: false } : actor,
    isLiked: snapshot.value.events.some(event => event.type === 'post-like' && event.actorAccountId === viewerId && event.entityId === post.id),
    isBookmarked: snapshot.value.events.some(event => event.type === 'post-bookmark' && event.actorAccountId === viewerId && event.entityId === post.id)
  }
}

const anonymousLabel = (identityId: string) => {
  const identity = snapshot.value.anonymousIdentities.find(item => item.id === identityId)
  return identity ? `匿名用户 ${identity.anonymousCode}` : '匿名用户'
}

const rememberForAccount = (accountId: string, type: 'comment' | 'like' | 'follow' | 'relationship' | 'important-event', summary: string, sourceEventId: string, importance = 4, circleId?: string) => {
  const account = snapshot.value.accounts.find(item => item.id === accountId)
  const subject = account ? snapshot.value.subjects.find(item => item.id === account.subjectId) : undefined
  if (!account || subject?.kind !== 'character') return
  snapshot.value.memories.push({ id: id('memory'), subjectId: subject.id, accountId, circleId, type, summary: summary.slice(0, 500), visibility: 'restricted', sourceEventIds: [sourceEventId], importance, createdAt: Date.now() })
}

export function useForum() {
  void ensureLoaded()
  const currentRoute = computed(() => routeStack.value[routeStack.value.length - 1])
  const currentAccount = computed(() => snapshot.value.accounts.find(account => account.id === snapshot.value.settings.activeAccountId) || null)
  const currentForumUser = computed(() => currentAccount.value ? accountToUser(currentAccount.value) : null)
  const forumUsers = computed(() => snapshot.value.accounts.filter(account => canAccountAppear(snapshot.value, account)).map(accountToUser))
  const circles = computed(() => snapshot.value.circles)
  const currentCircle = computed(() => { const route = currentRoute.value; return route.name === 'circle' ? circles.value.find(circle => circle.id === route.circleId) || null : null })
  const posts = computed(() => {
    if (!currentAccount.value) return []
    const ranked = rankForumFeed(snapshot.value, currentAccount.value.id, feedMode.value)
    const latestIds = feedMode.value === 'following' ? [] : forumGenerationRuntime.summary?.postIds || []
    const latest = new Set(latestIds)
    return [...latestIds.map(id => ranked.find(post => post.id === id)).filter((post): post is ForumPost => Boolean(post)), ...ranked.filter(post => !latest.has(post.id))].map(hydratePost)
  })
  const circlePosts = computed(() => currentCircle.value && currentAccount.value ? visiblePostsFor(snapshot.value, currentAccount.value.id, currentCircle.value.id).map(hydratePost) : [])
  const commentsByPost = computed(() => {
    const now = Date.now()
    const viewerId = snapshot.value.settings.activeAccountId
    const flat = snapshot.value.comments.reduce<Record<string, ForumComment[]>>((all, comment) => {
      const account = snapshot.value.accounts.find(item => item.id === comment.authorAccountId)
      if (!account || !canAccountAppear(snapshot.value, account)) return all
      const waiting = Boolean(comment.revealAt && comment.revealAt > now)
      const hydrated = { ...comment, content: waiting ? (comment.availabilityText || '对方暂时没看到，晚些时候回复') : comment.content, pendingReply: waiting, isLiked: snapshot.value.events.some(event => event.type === 'comment-like' && event.actorAccountId === viewerId && event.entityId === comment.id), author: accountToUser(account), replies: [] }
      ;(all[comment.postId] ||= []).push(hydrated)
      return all
    }, {})
    return Object.fromEntries(Object.entries(flat).map(([postId, comments]) => {
      const byId = new Map(comments.map(item => [item.id, item]))
      const roots: ForumComment[] = []
      comments.sort((a, b) => Number(a.createdAt) - Number(b.createdAt)).forEach(comment => {
        const parent = comment.parentId ? byId.get(comment.parentId) : undefined
        if (parent) (parent.replies ||= []).push(comment); else roots.push(comment)
      })
      return [postId, roots]
    }))
  })
  const conversations = computed(() => snapshot.value.conversations.filter(item => item.participantAccountIds.includes(snapshot.value.settings.activeAccountId)).map(item => ({ ...item, user: accountToUser(snapshot.value.accounts.find(account => account.id === item.user.id) || item.user) })))
  const notifications = computed(() => snapshot.value.notifications.filter(item => item.accountId === snapshot.value.settings.activeAccountId).sort((a, b) => b.createdAt - a.createdAt))
  const friendRequests = computed(() => snapshot.value.friendRequests.filter(item => item.requesterAccountId === snapshot.value.settings.activeAccountId || item.receiverAccountId === snapshot.value.settings.activeAccountId).sort((a, b) => b.createdAt - a.createdAt))

  const pushRoute = (route: ForumRoute) => routeStack.value.push(route)
  const popRoute = () => { if (routeStack.value.length > 1) routeStack.value.pop() }
  const resetToTab = (tab: ForumTab) => { activeTab.value = tab; routeStack.value = [{ name: 'tab' }] }

  const completeOnboarding = async (input: { name: string; handle: string; bio?: string; avatar?: string; defaultSquare: boolean; generateStrangers: boolean }) => {
    const createdAt = Date.now()
    const subjectId = id('subject_user')
    const accountId = id('forum_account')
    const personaId = id('forum_persona')
    snapshot.value.subjects.push({ id: subjectId, kind: 'user', displayName: input.name.trim(), persona: input.bio || '', createdAt, updatedAt: createdAt })
    const avatar = await persistAvatarValue(input.avatar || '', `${input.name.trim()}头像`)
    snapshot.value.accounts.push({ id: accountId, subjectId, kind: 'main', name: input.name.trim(), handle: normalizeHandle(input.handle), avatar: avatar.url, avatarMediaId: avatar.mediaId, bio: input.bio || '', privacy: 'public', searchable: true, acceptsFollow: true, followRequiresApproval: false, acceptsDm: 'all', showInRecommendations: true, showOnline: true, showCircles: true, joinedAt: createdAt, personaId, circleIds: [], lifecycle: 'user' })
    snapshot.value.personas.push({ id: personaId, accountId, identity: input.bio || '', interests: [], boundaries: [], socialInitiative: 50, activeHours: [], habits: {}, lockedFields: [] })
    snapshot.value.settings = { ...snapshot.value.settings, initialized: true, activeAccountId: accountId, defaultSquareEnabled: input.defaultSquare, generateStrangers: input.generateStrangers, manualGenerationOnly: true, autonomousCommunity: false, updatedAt: createdAt }
    if (input.defaultSquare) createDefaultSquare(accountId)
  }

  const updateForumProfile = async (input: Pick<ForumAccount, 'name' | 'handle' | 'avatar'> & Partial<Pick<ForumAccount, 'bio' | 'location'>>) => {
    const account = currentAccount.value
    if (!account) return false
    const name = input.name.trim()
    const handle = normalizeHandle(input.handle)
    if (!name || snapshot.value.accounts.some(item => item.id !== account.id && item.handle.toLowerCase() === handle.toLowerCase())) return false
    account.name = name
    account.handle = handle
    const avatar = await persistAvatarValue(input.avatar || '', `${name}头像`)
    account.avatar = avatar.url
    if (avatar.mediaId) account.avatarMediaId = avatar.mediaId
    account.bio = input.bio?.trim() || ''
    account.location = input.location?.trim() || ''
    if (account.kind === 'main') {
      const subject = snapshot.value.subjects.find(item => item.id === account.subjectId && item.kind === 'user')
      if (subject) {
        subject.displayName = name
        subject.persona = account.bio
        subject.updatedAt = Date.now()
      }
    }
    return true
  }

  const createDefaultSquare = (accountId: string) => {
    const circleId = id('circle')
    snapshot.value.circles.push({ id: circleId, name: '公共广场', avatar: '广', description: '开放的公共交流空间', contentScope: '不限定单一主题，允许普通日常、临时感受、分享和公开讨论；避免把它写成公告栏或人设展示区。', rules: ['尊重彼此，内容由发布者负责'], tags: ['日常'], creatorAccountId: accountId, administratorAccountIds: [accountId], memberCount: 1, activityScore: 0, searchable: true, isPublic: true, joinMode: 'public', contentPermissions: ['text', 'single-image', 'multi-image', 'long-article', 'quote', 'repost', 'poll', 'qa', 'voice', 'short-video', 'link', 'location', 'anonymous', 'lottery', 'event'], anonymousMode: 'per-post', adminCanResolveAnonymous: false, allowPoll: true, allowLottery: true, mediaPermissions: ['image', 'voice', 'short-video', 'music'], participantSubjectIds: [], aiPopulation: 0, aiActivity: 'off', createdAt: Date.now(), source: 'user' })
    snapshot.value.memberships.push({ id: id('member'), circleId, accountId, role: 'owner', joinedAt: Date.now() })
    const account = snapshot.value.accounts.find(item => item.id === accountId)
    if (account) account.circleIds.push(circleId)
  }

  const addForumAccount = (input: { subjectId?: string; name: string; handle: string; kind: ForumAccountKind; privacy?: ForumAccount['privacy']; bio?: string }) => {
    let subjectId = input.subjectId
    if (!subjectId) {
      subjectId = currentAccount.value?.subjectId || id('subject_user')
      if (!snapshot.value.subjects.some(subject => subject.id === subjectId)) snapshot.value.subjects.push({ id: subjectId, kind: 'user', displayName: input.name, persona: input.bio || '', createdAt: Date.now(), updatedAt: Date.now() })
    }
    const subjectKind = snapshot.value.subjects.find(item => item.id === subjectId)?.kind
    const account: ForumAccount = { id: id('forum_account'), subjectId, kind: input.kind, name: input.name.trim(), handle: uniqueHandle(input.handle), avatar: '', bio: input.bio || '', privacy: input.privacy || 'normal', searchable: input.privacy !== 'hidden', acceptsFollow: true, followRequiresApproval: input.privacy === 'private', acceptsDm: input.privacy === 'private' ? 'following' : 'all', showInRecommendations: input.privacy !== 'hidden', showOnline: true, showCircles: true, joinedAt: Date.now(), circleIds: [], lifecycle: subjectKind === 'character' ? 'character' : 'user' }
    snapshot.value.accounts.push(account)
    const link = snapshot.value.accountLinks.find(item => item.subjectId === subjectId)
    if (link) link.accountIds.push(account.id)
    else snapshot.value.accountLinks.push({ id: id('account_link'), subjectId, accountIds: snapshot.value.accounts.filter(item => item.subjectId === subjectId).map(item => item.id), share: { persona: true, appearance: true, worldbook: true, memory: false, interests: false, 'circle-relations': false, 'dm-memory': false, location: false, 'ip-location': false } })
    return account
  }

  const switchAccount = (accountId: string) => {
    if (!snapshot.value.accounts.some(account => account.id === accountId && !account.isArchived)) return
    snapshot.value.settings.activeAccountId = accountId
    resetToTab('feed')
  }

  const listParticipantCandidates = () => {
    const existingBySource = new Map(snapshot.value.subjects.filter(subject => subject.kind === 'character').map(subject => [subject.sourceId, subject]))
    return listCurrentChatCharacterDirectory().map(entry => ({ ...entry, subject: existingBySource.get(entry.entityId), enabled: existingBySource.get(entry.entityId) ? snapshot.value.participantPolicies.find(policy => policy.subjectId === existingBySource.get(entry.entityId)?.id)?.enabled === true : false }))
  }

  const syncParticipantCandidates = () => {
    syncForumCharacters(snapshot.value)
    return listParticipantCandidates()
  }

  const setCharacterParticipation = (entry: ReturnType<typeof listCurrentChatCharacterDirectory>[number], enabled: boolean) => {
    let subject = snapshot.value.subjects.find(item => item.kind === 'character' && item.sourceId === entry.entityId)
    if (!subject) {
      subject = { id: id('subject_character'), kind: 'character', sourceId: entry.entityId, sourceAccountId: entry.ownerAccountId, displayName: entry.name, persona: entry.persona, avatarKey: entry.avatarKey, createdAt: Date.now(), updatedAt: Date.now() }
      snapshot.value.subjects.push(subject)
    }
    let policy = snapshot.value.participantPolicies.find(item => item.subjectId === subject?.id)
    if (!policy) { policy = defaultPolicy(subject.id, enabled); snapshot.value.participantPolicies.push(policy) }
    policy.enabled = enabled
    policy.updatedAt = Date.now()
    if (!snapshot.value.bridgePolicies.some(item => item.subjectId === subject?.id)) snapshot.value.bridgePolicies.push(defaultBridge(subject.id))
    if (enabled && !snapshot.value.accounts.some(item => item.subjectId === subject?.id)) addForumAccount({ subjectId: subject.id, name: entry.socialProfile?.nickname || entry.name, handle: entry.socialProfile?.socialId || entry.name, kind: 'main', bio: entry.socialProfile?.signature || '' })
  }

  const updateParticipantPolicy = (subjectId: string, patch: Partial<ForumParticipantPolicy>) => {
    let policy = snapshot.value.participantPolicies.find(item => item.subjectId === subjectId)
    if (!policy) { policy = defaultPolicy(subjectId); snapshot.value.participantPolicies.push(policy) }
    Object.assign(policy, patch, { updatedAt: Date.now() })
  }

  const updateBridgePolicy = (subjectId: string, patch: Partial<ForumBridgePolicy>) => {
    let policy = snapshot.value.bridgePolicies.find(item => item.subjectId === subjectId)
    if (!policy) { policy = defaultBridge(subjectId); snapshot.value.bridgePolicies.push(policy) }
    Object.assign(policy, patch, { updatedAt: Date.now() })
  }

  const createCircle = (input: Pick<ForumCircle, 'name' | 'description' | 'contentScope'> & Partial<ForumCircle>) => {
    if (!currentAccount.value) throw new Error('请先创建论坛账号')
    const circle: ForumCircle = { id: id('circle'), name: input.name.trim(), avatar: input.avatar || input.name.trim().slice(0, 1), description: input.description.trim(), contentScope: input.contentScope.trim(), announcement: input.announcement || '', rules: input.rules || [], tags: input.tags || [], creatorAccountId: currentAccount.value.id, administratorAccountIds: [currentAccount.value.id], memberCount: 1, activityScore: 0, searchable: input.searchable ?? true, isPublic: input.isPublic ?? true, joinMode: input.joinMode || 'public', contentPermissions: input.contentPermissions || ['text', 'single-image', 'multi-image', 'long-article', 'quote', 'repost', 'poll', 'qa', 'voice', 'short-video', 'link', 'location', 'anonymous', 'lottery', 'event'], anonymousMode: input.anonymousMode || 'per-post', adminCanResolveAnonymous: input.adminCanResolveAnonymous ?? false, allowPoll: input.allowPoll ?? true, allowLottery: input.allowLottery ?? true, mediaPermissions: input.mediaPermissions || ['image', 'voice', 'short-video'], participantSubjectIds: input.participantSubjectIds || [], aiPopulation: 0, aiActivity: 'off', createdAt: Date.now(), source: 'user' }
    snapshot.value.circles.push(circle)
    snapshot.value.memberships.push({ id: id('member'), circleId: circle.id, accountId: currentAccount.value.id, role: 'owner', joinedAt: Date.now() })
    currentAccount.value.circleIds.push(circle.id)
    return circle
  }

  const joinCircle = (circleId: string) => {
    if (!currentAccount.value || snapshot.value.memberships.some(item => item.circleId === circleId && item.accountId === currentAccount.value?.id)) return
    const circle = snapshot.value.circles.find(item => item.id === circleId)
    if (!circle) return
    const role = ['application', 'invite', 'password', 'specified-account', 'specified-character'].includes(circle.joinMode) ? 'pending' : 'member'
    snapshot.value.memberships.push({ id: id('member'), circleId, accountId: currentAccount.value.id, role, joinedAt: Date.now() })
    if (role === 'member') { circle.memberCount += 1; currentAccount.value.circleIds.push(circleId) }
  }

  const bindCircleWorldBooks = (circleId: string, bookIds: string[], groupIds: string[] = [], entryIds: string[] = []) => {
    const circle = snapshot.value.circles.find(item => item.id === circleId)
    if (!circle) return
    let binding = snapshot.value.worldBindings.find(item => item.circleId === circleId)
    if (!binding) { binding = { id: id('world_binding'), circleId, bookIds: [], groupIds: [], entryIds: [], weights: {}, priorities: [], followUpdates: false, lastSnapshots: {} }; snapshot.value.worldBindings.push(binding); circle.worldBindingId = binding.id }
    Object.assign(binding, { bookIds, groupIds, entryIds })
  }

  const publishNewPost = (postData: Partial<ForumPost> & { pollOptions?: string[]; lottery?: Partial<ForumLottery> }) => {
    if (!currentForumUser.value) return
    const circle = postData.circleId ? snapshot.value.circles.find(item => item.id === postData.circleId) : undefined
    if (postData.circleId && (!circle || !snapshot.value.memberships.some(item => item.circleId === postData.circleId && item.accountId === currentForumUser.value?.id && ['owner', 'admin', 'member'].includes(item.role)))) { error.value = '你尚未加入这个圈子。'; return }
    if (circle && !circle.contentPermissions.includes(postData.type || 'text')) { error.value = '该圈子不允许发布这种内容。'; return }
    let anonymousIdentityId: string | undefined
    if ((postData.type === 'anonymous' || postData.anonymousIdentityId) && circle && circle.anonymousMode !== 'disabled') {
      const identity = { id: id('anonymous'), circleId: circle.id, ownerAccountId: currentForumUser.value.id, anonymousCode: String(Math.floor(100 + Math.random() * 900)), rotationMode: circle.anonymousMode as 'per-post' | 'circle-fixed' | 'daily', adminCanResolve: circle.adminCanResolveAnonymous }
      snapshot.value.anonymousIdentities.push(identity); anonymousIdentityId = identity.id
    }
    const post: ForumPost = { id: id('post'), author: currentForumUser.value, authorAccountId: currentForumUser.value.id, circleId: postData.circleId, type: postData.type || 'text', content: postData.content || '', title: postData.title, topics: postData.topics || [], media: postData.media || [], visibility: postData.visibility || (postData.circleId ? 'circle' : 'public'), anonymousIdentityId, likeCount: 0, commentCount: 0, shareCount: 0, viewCount: 1, effectiveViewCount: 1, createdAt: Date.now(), source: 'user' }
    if (post.type === 'poll' && postData.pollOptions?.length) { const poll: ForumPoll = { id: id('poll'), postId: post.id, multiple: false, anonymous: true, changeable: false, resultsVisible: 'immediate', options: postData.pollOptions.filter(Boolean).map(label => ({ id: id('option'), label, votes: 0, voterAccountIds: [] })) }; snapshot.value.polls.push(poll); post.pollId = poll.id }
    if (post.type === 'lottery' && postData.lottery?.prize) { const lottery: ForumLottery = { id: id('lottery'), postId: post.id, prize: postData.lottery.prize, winnerCount: postData.lottery.winnerCount || 1, drawAt: postData.lottery.drawAt || Date.now(), conditions: postData.lottery.conditions || ['none'], anonymous: postData.lottery.anonymous ?? false }; snapshot.value.lotteries.push(lottery); post.lotteryId = lottery.id }
    snapshot.value.posts.unshift(post)
    snapshot.value.events.push({ id: id('event'), type: 'post-created', actorAccountId: post.authorAccountId, targetAccountIds: [], circleId: post.circleId, entityId: post.id, payload: {}, createdAt: Date.now() })
    popRoute()
  }

  const addComment = async (postId: string, content: string, replyTo?: ForumComment, options: { generateReply?: boolean; timing?: ForumReplyTimingMode } = {}) => {
    if (!currentForumUser.value || !content.trim()) return
    const parentId = replyTo?.parentId || replyTo?.id
    const userComment: ForumComment = { id: id('comment'), postId, author: currentForumUser.value, authorAccountId: currentForumUser.value.id, parentId, rootCommentId: replyTo?.rootCommentId || replyTo?.id, replyToCommentId: replyTo?.id, depth: replyTo ? 1 : 0, content: content.trim(), likeCount: 0, createdAt: Date.now(), replyToUser: replyTo ? { id: replyTo.authorAccountId, name: replyTo.author.name } : undefined, source: 'user' }
    snapshot.value.comments.push(userComment)
    const post = snapshot.value.posts.find(item => item.id === postId)
    if (post) {
      post.commentCount += 1
      const eventId = id('event')
      snapshot.value.events.push({ id: eventId, type: 'user-comment', actorAccountId: currentForumUser.value.id, targetAccountIds: [post.authorAccountId], circleId: post.circleId, entityId: post.id, payload: { content: content.trim() }, createdAt: Date.now() })
      rememberForAccount(post.authorAccountId, 'comment', `${currentForumUser.value.name}在论坛回复：${content.trim()}`, eventId, 5, post.circleId)
    }
    if (!replyTo) {
      if (options.generateReply === false || busy.value) return
      busy.value = true; communityResponseBusyCommentId.value = userComment.id; error.value = ''
      try {
        const result = await generateCommunityCommentResponse(snapshot.value, currentForumUser.value.id, postId, userComment.id, { timing: options.timing })
        if (result.responseComment) scheduleLocalReveal('comment', result.responseComment.id, result.responseComment.revealAt)
        await saveForumSnapshot(snapshot.value)
      } catch (cause) { error.value = cause instanceof Error ? cause.message : String(cause) }
      finally { busy.value = false; communityResponseBusyCommentId.value = '' }
      return
    }
    if (replyTo.authorAccountId === currentForumUser.value.id || options.generateReply === false || busy.value) return
    const target = snapshot.value.accounts.find(item => item.id === replyTo.authorAccountId)
    if (!target) return
    busy.value = true; error.value = ''
    try {
      const timing = options.timing || 'immediate'
      const generated = await requestForumJson<{ content?: string; timing?: 'immediate' | 'delayed'; activity?: string; delayMinutes?: number }>(snapshot.value, { userInitiated: true, viewerAccountId: currentForumUser.value.id, postId, circleId: post?.circleId, involvedAccountIds: [target.id] }, 'forum-comment',
        `用户刚刚直接回复了这位作者：“${content.trim()}”。只替目标作者生成一次自然回应。${timing === 'presence-aware' ? '结合人物状态判断立即看到还是稍后看到；若延迟，仍需现在生成最终回复内容，并给出正在做的事和等待分钟数。' : '默认立即看到并回复。'}不得替其他人发言。`,
        '{"content":"最终回复内容","timing":"immediate或delayed","activity":"延迟时的简短状态","delayMinutes":30}')
      const response = String(generated.content || '').trim().slice(0, 800)
      if (!response) throw new Error('对方没有返回有效回复，请重试。')
      const delayed = timing === 'presence-aware' && generated.timing === 'delayed'
      const delayMinutes = Math.max(1, Math.min(1440, Number(generated.delayMinutes || 30)))
      const generatedComment: ForumComment = { id: id('comment'), postId, author: accountToUser(target), authorAccountId: target.id, parentId: userComment.parentId || userComment.id, rootCommentId: userComment.rootCommentId || userComment.id, replyToCommentId: userComment.id, depth: 1, content: response, likeCount: 0, createdAt: Date.now(), replyToUser: { id: currentForumUser.value.id, name: currentForumUser.value.name }, source: 'generated', communityResponseForCommentId: userComment.id, communityResponseRequestId: id('direct_response'), revealAt: delayed ? Date.now() + delayMinutes * 60000 : undefined, availabilityText: delayed ? `${String(generated.activity || '暂时没看论坛').slice(0, 80)}，预计约 ${Math.round(delayMinutes)} 分钟后回复` : undefined }
      snapshot.value.comments.push(generatedComment); scheduleLocalReveal('comment', generatedComment.id, generatedComment.revealAt)
      if (post) post.commentCount += 1
    } catch (cause) { error.value = cause instanceof Error ? cause.message : String(cause) }
    finally { busy.value = false }
  }

  const toggleLikePost = (postId: string) => toggleEvent('post-like', postId, count => {
    const post = snapshot.value.posts.find(item => item.id === postId); if (!post) return
    post.likeCount = Math.max(0, post.likeCount + count)
    if (count > 0 && currentAccount.value) {
      const eventId = id('event')
      snapshot.value.events.push({ id: eventId, type: 'user-like', actorAccountId: currentAccount.value.id, targetAccountIds: [post.authorAccountId], circleId: post.circleId, entityId: post.id, payload: {}, createdAt: Date.now() })
      rememberForAccount(post.authorAccountId, 'like', `${currentAccount.value.name}赞了自己的帖子`, eventId, 2, post.circleId)
    }
  })
  const toggleLikeComment = (commentId: string) => toggleEvent('comment-like', commentId, count => {
    const comment = snapshot.value.comments.find(item => item.id === commentId); if (!comment) return
    comment.likeCount = Math.max(0, comment.likeCount + count)
    if (count > 0 && currentAccount.value) {
      snapshot.value.events.push({ id: id('event'), type: 'user-comment-like', actorAccountId: currentAccount.value.id, targetAccountIds: [comment.authorAccountId], entityId: comment.id, payload: {}, createdAt: Date.now() })
    }
  })

  const regenerateCommunityResponse = async (commentId: string) => {
    if (!currentAccount.value || busy.value) return false
    const comment = snapshot.value.comments.find(item => item.id === commentId)
    if (!comment || comment.authorAccountId !== currentAccount.value.id) return false
    busy.value = true; communityResponseBusyCommentId.value = commentId; error.value = ''
    try {
      const result = await generateCommunityCommentResponse(snapshot.value, currentAccount.value.id, comment.postId, comment.id, { mode: 'regenerate', timing: snapshot.value.settings.defaultReplyTiming })
      if (result.responseComment) scheduleLocalReveal('comment', result.responseComment.id, result.responseComment.revealAt)
      await saveForumSnapshot(snapshot.value)
      return true
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : String(cause)
      return false
    } finally { busy.value = false; communityResponseBusyCommentId.value = '' }
  }
  const toggleBookmarkPost = (postId: string) => {
    toggleEvent('post-bookmark', postId)
    const post = snapshot.value.posts.find(item => item.id === postId); if (post) promoteLightweightAuthor(snapshot.value, post.authorAccountId, '用户收藏其内容')
  }
  const deleteCircles = (circleIds: string[]) => {
    const selectedIds = new Set(circleIds.filter(Boolean))
    if (!selectedIds.size || !currentAccount.value) return 0

    const currentAccountId = currentAccount.value.id
    selectedIds.forEach(targetCircleId => {
      const circle = snapshot.value.circles.find(c => c.id === targetCircleId)
      if (!circle) return

      const isOwner = circle.creatorAccountId === currentAccountId
      if (isOwner) {
        // 解散自建圈子：完全移除圈子、相关绑定、圈内帖子与成员记录
        snapshot.value.circles = snapshot.value.circles.filter(c => c.id !== targetCircleId)
        snapshot.value.worldBindings = snapshot.value.worldBindings.filter(wb => wb.circleId !== targetCircleId)
        snapshot.value.memberships = snapshot.value.memberships.filter(m => m.circleId !== targetCircleId)
        snapshot.value.accounts.forEach(acc => {
          if (acc.circleIds) acc.circleIds = acc.circleIds.filter(cid => cid !== targetCircleId)
        })
        snapshot.value.participantPolicies.forEach(policy => {
          if (policy.allowedCircleIds) policy.allowedCircleIds = policy.allowedCircleIds.filter(cid => cid !== targetCircleId)
          if (policy.blockedCircleIds) policy.blockedCircleIds = policy.blockedCircleIds.filter(cid => cid !== targetCircleId)
        })
        snapshot.value.mutes = snapshot.value.mutes.filter(m => m.circleId !== targetCircleId)
        const circlePostIds = snapshot.value.posts.filter(p => p.circleId === targetCircleId).map(p => p.id)
        if (circlePostIds.length) deletePosts(circlePostIds)
      } else {
        // 退出加入的圈子
        const memIdx = snapshot.value.memberships.findIndex(m => m.circleId === targetCircleId && m.accountId === currentAccountId)
        if (memIdx >= 0) {
          snapshot.value.memberships.splice(memIdx, 1)
          circle.memberCount = Math.max(0, (circle.memberCount || 1) - 1)
        }
        if (currentAccount.value && currentAccount.value.circleIds) {
          currentAccount.value.circleIds = currentAccount.value.circleIds.filter(cid => cid !== targetCircleId)
        }
      }
    })
    return selectedIds.size
  }
  const deletePosts = (postIds: string[]) => {
    const selectedPostIds = new Set(postIds.filter(Boolean))
    if (!selectedPostIds.size) return 0

    const selectedLotteryIds = new Set(snapshot.value.lotteries.filter(item => selectedPostIds.has(item.postId)).map(item => item.id))
    snapshot.value.posts = snapshot.value.posts.filter(item => !selectedPostIds.has(item.id))
    snapshot.value.comments = snapshot.value.comments.filter(item => !selectedPostIds.has(item.postId))
    snapshot.value.polls = snapshot.value.polls.filter(item => !selectedPostIds.has(item.postId))
    snapshot.value.lotteries = snapshot.value.lotteries.filter(item => !selectedPostIds.has(item.postId))
    snapshot.value.lotteryEntries = snapshot.value.lotteryEntries.filter(item => !selectedLotteryIds.has(item.lotteryId))
    snapshot.value.lotteryResults = snapshot.value.lotteryResults.filter(item => !selectedLotteryIds.has(item.lotteryId))
    snapshot.value.events = snapshot.value.events.filter(item => !item.entityId || !selectedPostIds.has(item.entityId))
    snapshot.value.notifications = snapshot.value.notifications.filter(item => !item.entityId || !selectedPostIds.has(item.entityId))
    snapshot.value.visibilityRules.forEach(rule => {
      if (rule.postIds) rule.postIds = rule.postIds.filter(postId => !selectedPostIds.has(postId))
    })
    return selectedPostIds.size
  }
  const toggleEvent = (type: string, entityId: string, update?: (delta: number) => void) => {
    if (!currentAccount.value) return
    const index = snapshot.value.events.findIndex(event => event.type === type && event.actorAccountId === currentAccount.value?.id && event.entityId === entityId)
    if (index >= 0) { snapshot.value.events.splice(index, 1); update?.(-1) }
    else { snapshot.value.events.push({ id: id('event'), type, actorAccountId: currentAccount.value.id, targetAccountIds: [], entityId, payload: {}, createdAt: Date.now() }); update?.(1) }
  }

  const toggleFollowUser = (targetId: string) => {
    if (!currentAccount.value || targetId === currentAccount.value.id) return
    const index = snapshot.value.relationships.findIndex(item => item.type === 'follow' && item.fromAccountId === currentAccount.value?.id && item.toAccountId === targetId)
    if (index >= 0) snapshot.value.relationships.splice(index, 1)
    else {
      promoteLightweightAuthor(snapshot.value, targetId, '用户主动关注')
      snapshot.value.relationships.push({ id: id('relationship'), fromAccountId: currentAccount.value.id, toAccountId: targetId, type: 'follow', createdAt: Date.now() })
      const eventId = id('event')
      snapshot.value.events.push({ id: eventId, type: 'user-follow', actorAccountId: currentAccount.value.id, targetAccountIds: [targetId], payload: {}, createdAt: Date.now() })
      rememberForAccount(targetId, 'follow', `${currentAccount.value.name}开始关注自己`, eventId, 5)
    }
  }

  const forumFriendStatus = (targetId: string) => {
    const account = snapshot.value.accounts.find(item => item.id === targetId)
    if (!account || !currentAccount.value) return 'none' as const
    const subject = snapshot.value.subjects.find(item => item.id === account.subjectId)
    if (subject?.kind === 'character' && subject.sourceId) return 'friends' as const
    const request = friendRequests.value.find(item => item.status === 'pending' && ((item.requesterAccountId === currentAccount.value?.id && item.receiverAccountId === targetId) || (item.receiverAccountId === currentAccount.value?.id && item.requesterAccountId === targetId)))
    if (!request) return 'none' as const
    return request.requesterAccountId === currentAccount.value.id ? 'outgoing' as const : 'incoming' as const
  }

  const sendForumFriendRequest = (targetId: string, message = '想和你加个好友，之后也在聊天 App 联系。') => {
    if (!currentAccount.value || targetId === currentAccount.value.id || forumFriendStatus(targetId) !== 'none') return null
    const target = snapshot.value.accounts.find(item => item.id === targetId)
    if (!target) return null
    promoteLightweightAuthor(snapshot.value, targetId, '论坛好友申请')
    const request = { id: id('forum_friend_request'), requesterAccountId: currentAccount.value.id, receiverAccountId: targetId, message: message.trim().slice(0, 240), status: 'pending' as const, createdAt: Date.now() }
    snapshot.value.friendRequests.unshift(request)
    snapshot.value.notifications.push({ id: id('notification'), accountId: currentAccount.value.id, type: 'friend-request', actorAccountId: targetId, entityId: request.id, text: `已向 ${target.name} 发送好友申请；需要你手动生成对方答复`, createdAt: Date.now() })
    friendFeedback.value = `已向 ${target.name} 发送好友申请`
    return request
  }

  const acceptForumFriendRequest = async (requestId: string, chatOptions: boolean | { create: boolean; existingEntityId?: string; copyAvatar?: boolean; copyPublicProfile?: boolean; copyPersona?: boolean; copySummary?: boolean } = false) => {
    if (!currentAccount.value) return false
    const request = snapshot.value.friendRequests.find(item => item.id === requestId && item.status === 'pending')
    if (!request || (request.requesterAccountId !== currentAccount.value.id && request.receiverAccountId !== currentAccount.value.id)) return false
    const strangerId = request.requesterAccountId === currentAccount.value.id ? request.receiverAccountId : request.requesterAccountId
    const account = snapshot.value.accounts.find(item => item.id === strangerId)
    const subject = account ? snapshot.value.subjects.find(item => item.id === account.subjectId) : undefined
    if (!account || !subject) return false
    request.status = 'accepted'; request.respondedAt = Date.now()
    account.persistenceReason = '论坛好友关系'
    const addToChatApp = typeof chatOptions === 'boolean' ? chatOptions : chatOptions.create
    const options: { existingEntityId?: string; copyAvatar?: boolean; copyPublicProfile?: boolean; copyPersona?: boolean; copySummary?: boolean } = typeof chatOptions === 'boolean' ? { copyAvatar: true, copyPublicProfile: true, copyPersona: true, copySummary: false } : chatOptions
    if (addToChatApp) {
      const persona = snapshot.value.personas.find(item => item.accountId === account.id)
      const interactionSummary = [...snapshot.value.posts.filter(item => item.authorAccountId === account.id).slice(0, 6).map(item => `论坛帖子：${item.content}`), ...snapshot.value.comments.filter(item => item.authorAccountId === account.id || item.replyToUser?.id === account.id).slice(-8).map(item => `论坛评论：${item.content}`), ...snapshot.value.messages.filter(item => item.senderId === account.id || item.receiverId === account.id).slice(-12).map(item => `论坛私信：${item.content}`)].join('\n').slice(0, 3000)
      const { entry } = createForumFriendContact({ forumAccountId: account.id, existingEntityId: options.existingEntityId, name: account.name, handle: options.copyPublicProfile ? account.handle : '', avatar: options.copyAvatar ? account.avatar : '', bio: options.copyPublicProfile ? account.bio : '', persona: options.copyPersona ? persona?.personality || account.expressionStyle || subject.persona : '', interactionSummary: options.copySummary ? interactionSummary : '' })
      request.characterEntityId = entry.entityId
      subject.kind = 'character'; subject.sourceId = entry.entityId; subject.sourceAccountId = entry.ownerAccountId; subject.updatedAt = Date.now()
      account.lifecycle = 'character'
      const policy = snapshot.value.participantPolicies.find(item => item.subjectId === subject.id)
      if (policy) { policy.enabled = true; policy.autonomy = { level: 'off', actions: {} } }
      if (!snapshot.value.bridgePolicies.some(item => item.subjectId === subject.id)) snapshot.value.bridgePolicies.push({ id: id('bridge'), subjectId: subject.id, forumToChat: { mode: 'important', memoryTypes: ['post', 'comment', 'dm', 'important-event'] }, chatToForum: { mode: 'reachable-only', memoryTypes: ['chat-daily', 'important-event', 'relationship'] }, updatedAt: Date.now() })
      try { await loadCustomContacts() } catch {}
    }
    snapshot.value.notifications.push({ id: id('notification'), accountId: currentAccount.value.id, type: 'friend-request', actorAccountId: account.id, entityId: request.id, text: addToChatApp ? `已和 ${account.name} 成为好友，并添加到聊天 App` : `已和 ${account.name} 成为论坛好友`, createdAt: Date.now() })
    friendFeedback.value = addToChatApp ? `已成为好友并添加到聊天 App` : `已成为论坛好友（未添加到聊天 App）`
    return true
  }

  const rejectForumFriendRequest = (requestId: string) => {
    const request = snapshot.value.friendRequests.find(item => item.id === requestId && item.status === 'pending')
    if (!request || !currentAccount.value || request.receiverAccountId !== currentAccount.value.id) return false
    request.status = 'rejected'; request.respondedAt = Date.now(); friendFeedback.value = '已拒绝这条好友申请'; return true
  }

  const generateForumFriendDecision = async (targetId: string) => {
    if (!currentAccount.value || busy.value) return false
    const target = snapshot.value.accounts.find(item => item.id === targetId)
    if (!target) return false
    const outgoing = snapshot.value.friendRequests.find(item => item.status === 'pending' && item.requesterAccountId === currentAccount.value?.id && item.receiverAccountId === targetId)
    busy.value = true; error.value = ''
    try {
      const recentMessages = snapshot.value.messages.filter(item => item.senderId === targetId || item.receiverId === targetId).slice(-12).map(item => `${item.senderId}: ${item.content}`).join('\n')
      const generated = await requestForumJson<{ action?: 'accept' | 'reject' | 'request' | 'none'; message?: string }>(snapshot.value, { userInitiated: true, viewerAccountId: currentAccount.value.id, involvedAccountIds: [targetId] }, 'forum-dm', outgoing ? `用户已经向这个人发送论坛好友申请。只调用这一次，根据人物性格和近期私信决定接受或拒绝。近期私信：\n${recentMessages}` : `用户手动查看这个人的好友动向。根据人物性格和近期私信，决定是否主动向用户提出好友申请；没有合适理由可以不申请。近期私信：\n${recentMessages}`, '{"action":"accept或reject或request或none","message":"自然的申请或答复"}')
      if (outgoing) {
        if (generated.action === 'accept') return await acceptForumFriendRequest(outgoing.id)
        outgoing.status = 'rejected'; outgoing.respondedAt = Date.now()
        snapshot.value.notifications.push({ id: id('notification'), accountId: currentAccount.value.id, type: 'friend-request', actorAccountId: targetId, entityId: outgoing.id, text: generated.message || `${target.name}暂时没有同意好友申请`, createdAt: Date.now() })
        friendFeedback.value = generated.message || `${target.name}暂时没有同意好友申请`; return false
      }
      if (generated.action === 'request') {
        const request = { id: id('forum_friend_request'), requesterAccountId: targetId, receiverAccountId: currentAccount.value.id, message: String(generated.message || '可以加个好友吗？').slice(0, 240), status: 'pending' as const, createdAt: Date.now() }
        snapshot.value.friendRequests.unshift(request)
        snapshot.value.notifications.push({ id: id('notification'), accountId: currentAccount.value.id, type: 'friend-request', actorAccountId: targetId, entityId: request.id, text: `${target.name}向你发送了好友申请`, createdAt: Date.now() })
        friendFeedback.value = `${target.name}向你发送了好友申请`
        return true
      }
      snapshot.value.notifications.push({ id: id('notification'), accountId: currentAccount.value.id, type: 'friend-request', actorAccountId: targetId, text: `${target.name}现在没有提出加好友`, createdAt: Date.now() })
      friendFeedback.value = `${target.name}现在没有好友动向`
      return false
    } catch (cause) { error.value = cause instanceof Error ? cause.message : String(cause); return false }
    finally { busy.value = false }
  }

  const sendDirectMessage = (targetId: string, content: string, media?: ForumMediaItem) => {
    if (!currentAccount.value || (!content.trim() && !media)) return
    let conversation = snapshot.value.conversations.find(item => item.kind !== 'group' && item.participantAccountIds.includes(currentAccount.value!.id) && item.participantAccountIds.includes(targetId))
    const target = snapshot.value.accounts.find(item => item.id === targetId)
    if (!target) return
    promoteLightweightAuthor(snapshot.value, targetId, '用户主动私聊')
    if (!conversation) { conversation = { id: id('conversation'), kind: 'direct', user: accountToUser(target), participantAccountIds: [currentAccount.value.id, targetId], lastMessage: '', lastMessageTime: '', unreadCount: 0, requestState: target.acceptsDm === 'all' ? 'accepted' : 'pending' }; snapshot.value.conversations.unshift(conversation) }
    const message: ForumDirectMessage = { id: id('dm'), conversationId: conversation.id, senderId: currentAccount.value.id, receiverId: targetId, content: content.trim(), type: media?.type === 'voice' ? 'voice' : media ? 'image' : 'text', mediaId: media?.id, mediaUrl: media?.url, createdAt: Date.now(), isSelf: true, source: 'user' }
    snapshot.value.messages.push(message); conversation.lastMessage = content.trim() || (media?.type === 'voice' ? '[语音]' : '[图片]'); conversation.lastMessageTime = nowLabel()
  }

  const createForumGroup = (name: string, memberAccountIds: string[], temporary = false) => {
    if (!currentAccount.value || !name.trim()) return null
    const groupId = id('forum_group')
    const members = [...new Set([currentAccount.value.id, ...memberAccountIds])].filter(accountId => snapshot.value.accounts.some(account => account.id === accountId))
    const group = { id: groupId, name: name.trim(), avatar: name.trim().slice(0, 1), ownerAccountId: currentAccount.value.id, administratorAccountIds: [currentAccount.value.id], temporary, createdAt: Date.now() }
    snapshot.value.groups.push(group)
    members.forEach(accountId => snapshot.value.groupMembers.push({ id: id('group_member'), groupId, accountId, role: accountId === currentAccount.value?.id ? 'owner' : 'member', joinedAt: Date.now() }))
    const user = { ...accountToUser(currentAccount.value), id: `group:${groupId}`, name: group.name, handle: 'forum-group', avatar: '', bio: `${members.length} 位成员` }
    snapshot.value.conversations.unshift({ id: id('conversation'), kind: 'group', user, participantAccountIds: members, groupId, lastMessage: '群聊已创建', lastMessageTime: nowLabel(), unreadCount: 0, requestState: 'accepted' })
    return group
  }

  const sendGroupMessage = (groupId: string, content: string, media?: ForumMediaItem) => {
    if (!currentAccount.value || (!content.trim() && !media)) return
    const conversation = snapshot.value.conversations.find(item => item.groupId === groupId)
    if (!conversation || !conversation.participantAccountIds.includes(currentAccount.value.id)) return
    snapshot.value.messages.push({ id: id('group_message'), conversationId: conversation.id, senderId: currentAccount.value.id, content: content.trim(), type: media?.type === 'voice' ? 'voice' : media ? 'image' : 'text', mediaId: media?.id, mediaUrl: media?.url, createdAt: Date.now(), isSelf: true })
    conversation.lastMessage = content.trim() || (media?.type === 'voice' ? '[语音]' : '[图片]')
    conversation.lastMessageTime = nowLabel()
  }

  const conversationMessages = (conversationId: string) => {
    const now = Date.now()
    return snapshot.value.messages.filter(message => message.conversationId === conversationId).map(message => {
      const waiting = Boolean(message.revealAt && message.revealAt > now)
      return waiting ? { ...message, content: message.availabilityText || '对方暂时没看到，晚些时候回复', pendingReply: true } : { ...message, pendingReply: false }
    })
  }
  const addBlock = (targetAccountId: string, effects: ForumBlockRule['effects'] = ['posts', 'search', 'follow', 'dm', 'comment', 'mention', 'group-invite', 'recommendation', 'profile']) => { if (currentAccount.value) snapshot.value.blocks.push({ id: id('block'), ownerAccountId: currentAccount.value.id, targetAccountId, effects, createdAt: Date.now() }) }
  const addMute = (rule: Omit<ForumMuteRule, 'id' | 'ownerAccountId'>) => { if (currentAccount.value) snapshot.value.mutes.push({ id: id('mute'), ownerAccountId: currentAccount.value.id, ...rule }) }
  const addVisibilityRule = (rule: Omit<ForumVisibilityRule, 'id' | 'ownerAccountId'>) => { if (currentAccount.value) snapshot.value.visibilityRules.push({ id: id('visibility'), ownerAccountId: currentAccount.value.id, ...rule }) }

  const votePoll = (pollId: string, optionId: string) => {
    if (!currentAccount.value) return
    const poll = snapshot.value.polls.find(item => item.id === pollId); if (!poll) return
    const previous = poll.options.find(option => option.voterAccountIds.includes(currentAccount.value!.id))
    if (previous && (!poll.changeable || previous.id === optionId)) return
    if (previous) { previous.voterAccountIds = previous.voterAccountIds.filter(value => value !== currentAccount.value!.id); previous.votes -= 1 }
    const option = poll.options.find(item => item.id === optionId); if (option) { option.voterAccountIds.push(currentAccount.value.id); option.votes += 1 }
  }

  const enterLottery = (lotteryId: string) => { if (currentAccount.value && !snapshot.value.lotteryEntries.some(item => item.lotteryId === lotteryId && item.accountId === currentAccount.value?.id)) snapshot.value.lotteryEntries.push({ id: id('lottery_entry'), lotteryId, accountId: currentAccount.value.id, enteredAt: Date.now() }) }
  const drawLottery = (lotteryId: string) => {
    const lottery = snapshot.value.lotteries.find(item => item.id === lotteryId); if (!lottery || lottery.drawnAt) return null
    const entrants = snapshot.value.lotteryEntries.filter(item => item.lotteryId === lotteryId).map(item => item.accountId)
    const randomSeed = crypto.getRandomValues(new Uint32Array(1))[0].toString(36)
    const winners = entrants.map(value => ({ value, score: hash(`${randomSeed}:${value}`) })).sort((a, b) => a.score - b.score).slice(0, lottery.winnerCount).map(item => item.value)
    const result: ForumLotteryResult = { id: id('lottery_result'), lotteryId, winnerAccountIds: winners, drawnAt: Date.now(), randomSeed }
    snapshot.value.lotteryResults.push(result); lottery.drawnAt = result.drawnAt
    return result
  }

  const importMediaFile = async (file: File, type: ForumMediaItem['type'] = 'image') => storeForumMedia(file, { type, mimeType: file.type, alt: file.name })
  const addAvatarFiles = async (files: File[], group: ForumAvatarLibraryItem['group']) => {
    const added: ForumAvatarLibraryItem[] = []
    for (const file of files.filter(item => item.type.startsWith('image/'))) {
      const optimized = await optimizeImageFile(file)
      const media = await storeForumMedia(optimized, { type: 'image', mimeType: optimized.type || file.type, alt: file.name })
      const item: ForumAvatarLibraryItem = { id: media.id, group, url: media.url, storageKey: media.storageKey, mimeType: media.mimeType, label: file.name, assignedAccountIds: [], createdAt: Date.now() }
      snapshot.value.avatarLibrary.push(item)
      item.url = await resolveForumMediaUrl({ url: item.url, storageKey: item.storageKey })
      added.push(item)
    }
    return added
  }
  const addAvatarUrl = (url: string, group: ForumAvatarLibraryItem['group'], label = '') => {
    const normalized = url.trim()
    if (!/^https?:\/\//i.test(normalized)) return null
    const item: ForumAvatarLibraryItem = { id: id('avatar'), group, url: normalized, label: label.trim() || undefined, assignedAccountIds: [], createdAt: Date.now() }
    snapshot.value.avatarLibrary.push(item)
    return item
  }
  const generateAvatarLibraryItem = async (prompt: string, group: ForumAvatarLibraryItem['group']) => {
    const media = await generateForumImage(`论坛 NPC 圆形头像，单人半身，清晰背景，${prompt.trim() || '自然真实的社交头像'}`, snapshot.value.settings.preferredImageProvider === 'gpt' ? 'gpt' : 'pollinations')
    const item: ForumAvatarLibraryItem = { id: media.id, group, url: media.url, storageKey: media.storageKey, mimeType: media.mimeType, label: prompt.trim().slice(0, 40), assignedAccountIds: [], createdAt: Date.now() }
    snapshot.value.avatarLibrary.push(item)
    return item
  }
  const removeAvatarLibraryItem = async (avatarId: string, deleteMedia = false) => {
    const item = snapshot.value.avatarLibrary.find(entry => entry.id === avatarId)
    if (!item) return false
    const referenced = item.assignedAccountIds.some(accountId => snapshot.value.accounts.some(account => account.id === accountId && !account.isArchived))
    snapshot.value.avatarLibrary = snapshot.value.avatarLibrary.filter(entry => entry.id !== avatarId)
    if (deleteMedia && item.storageKey && !referenced) {
      await removeForumMedia(item.storageKey)
    }
    return true
  }
  const assignAvatarToAccount = (accountId: string, avatarId: string) => {
    const account = snapshot.value.accounts.find(item => item.id === accountId)
    const avatar = snapshot.value.avatarLibrary.find(item => item.id === avatarId)
    if (!account || !avatar) return false
    const activeAssignments = avatar.assignedAccountIds.filter(id => id !== accountId && snapshot.value.accounts.some(item => item.id === id && !item.isArchived))
    if (activeAssignments.length && (!snapshot.value.settings.allowAvatarReuse || Math.random() > snapshot.value.settings.avatarReuseProbability)) return false
    snapshot.value.avatarLibrary.forEach(item => { item.assignedAccountIds = item.assignedAccountIds.filter(id => id !== accountId) })
    avatar.assignedAccountIds.push(accountId)
    account.avatarLibraryItemId = avatar.id
    account.avatarMediaId = avatar.storageKey
    account.avatar = avatar.url
    account.lockedFields = [...new Set([...(account.lockedFields || []), 'avatar'])]
    return true
  }
  const updateNpcProfile = (accountId: string, accountPatch: Partial<Pick<ForumAccount, 'name' | 'handle' | 'avatar' | 'banner' | 'bio' | 'location' | 'gender'>> & { lockedFields?: string[] }, personaPatch: Record<string, unknown> & { lockedFields?: string[] }) => {
    const account = snapshot.value.accounts.find(item => item.id === accountId)
    const persona = snapshot.value.personas.find(item => item.accountId === accountId)
    if (!account || account.lifecycle === 'user' || !persona) return false
    const nextHandle = accountPatch.handle === undefined ? account.handle : normalizeHandle(accountPatch.handle)
    if (snapshot.value.accounts.some(item => item.id !== accountId && item.handle.toLowerCase() === nextHandle.toLowerCase())) return false
    Object.assign(account, { ...accountPatch, name: accountPatch.name?.trim() || account.name, handle: nextHandle, bio: accountPatch.bio?.trim() ?? account.bio, location: accountPatch.location?.trim() ?? account.location })
    const allowedPersonaFields = ['identity', 'personality', 'occupation', 'interests', 'boundaries', 'postingStyle', 'commentingStyle', 'dmStyle', 'emojiStyle', 'punctuationStyle', 'activeHours', 'socialInitiative', 'habits']
    allowedPersonaFields.forEach(field => { if (field in personaPatch) (persona as unknown as Record<string, unknown>)[field] = personaPatch[field] })
    account.lockedFields = [...new Set(accountPatch.lockedFields || account.lockedFields || [])]
    persona.lockedFields = [...new Set(personaPatch.lockedFields || persona.lockedFields || [])]
    return true
  }
  const generateImageMedia = (prompt: string) => generateForumImage(prompt, snapshot.value.settings.preferredImageProvider === 'gpt' ? 'gpt' : 'pollinations')
  const generateVoiceMedia = (text: string) => generateForumVoice(text)
  const buildLightVideo = (image: ForumMediaItem, voice?: ForumMediaItem, subtitle = '') => createLightShortVideo(image, voice, subtitle)

  const generateNewContent = async (config: ForumGenerationConfig = defaultForumGenerationConfig()) => {
    if (!currentAccount.value) return false
    error.value = ''
    return runSingleForumGenerationTask(async onProgress => {
      syncForumCharacters(snapshot.value)
      const batch = await generateForumContentBatch(snapshot.value, currentAccount.value!.id, config, onProgress)
      const generatedPosts = batch.postIds.map(id => snapshot.value.posts.find(post => post.id === id)).filter((post): post is ForumPost => Boolean(post))
      const generatedCircles = batch.circleIds.map(id => snapshot.value.circles.find(circle => circle.id === id)).filter((circle): circle is ForumCircle => Boolean(circle))
      forumGenerationRuntime.summary = {
        postIds: generatedPosts.map(post => post.id), postCount: generatedPosts.length,
        kindCounts: generatedPosts.reduce<Record<string, number>>((counts, post) => { const kind = post.contentKind || 'unknown'; counts[kind] = (counts[kind] || 0) + 1; return counts }, {}),
        circleIds: generatedCircles.map(circle => circle.id), circleNames: generatedCircles.map(circle => circle.name)
      }
      await saveForumSnapshot(snapshot.value)
    })
  }

  const generatePostComments = async (postId: string, mode: ForumCommentGenerationMode = 'incremental', requestedCount = 3) => {
    if (!currentAccount.value || busy.value) return
    const post = snapshot.value.posts.find(item => item.id === postId); if (!post) return
    busy.value = true; error.value = ''
    try {
      const count = Math.max(1, Math.round(requestedCount || 3))
      if (mode === 'replace-generated') {
        const comments = snapshot.value.comments.filter(item => item.postId === postId)
        const protectedIds = new Set(comments.filter(item => item.source === 'user' || item.communityResponseForCommentId).map(item => item.id))
        let changed = true
        while (changed) {
          changed = false
          comments.forEach(item => {
            if (protectedIds.has(item.id) && item.parentId && !protectedIds.has(item.parentId)) { protectedIds.add(item.parentId); changed = true }
          })
        }
        snapshot.value.comments = snapshot.value.comments.filter(item => item.postId !== postId || item.source === 'user' || protectedIds.has(item.id))
      }
      await generateForumPostInteractions(snapshot.value, currentAccount.value.id, postId, { comments: true, replies: true, postLikes: false, commentLikes: false, shares: false, bookmarks: false, follows: false, views: false, countMode: 'custom', commentCount: count, replyCount: Math.floor(count / 4), actorCount: Math.min(count, Math.max(1, Math.ceil(count * .7))), postLikeCount: 0, commentLikeCount: 0, shareCount: 0, bookmarkCount: 0, followCount: 0, viewCount: 0 })
      post.commentCount = snapshot.value.comments.filter(item => item.postId === postId).length
      await saveForumSnapshot(snapshot.value)
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : String(cause)
    } finally { busy.value = false }
  }

  const generatePostInteractions = async (postId: string, config: ForumPostInteractionConfig) => {
    if (!currentAccount.value || interactionBusy.value) return false
    interactionBusy.value = true; interactionError.value = ''
    try {
      await generateForumPostInteractions(snapshot.value, currentAccount.value.id, postId, config)
      await saveForumSnapshot(snapshot.value)
      return true
    } catch (cause) {
      interactionError.value = cause instanceof Error ? cause.message : String(cause)
      return false
    } finally { interactionBusy.value = false }
  }

  const generateConversationReply = (conversationId: string, requestedTiming?: ForumReplyTimingMode) => {
    if (!currentAccount.value) return Promise.resolve(false)
    const initiatingAccountId = currentAccount.value.id
    const execute = async () => {
      const conversation = snapshot.value.conversations.find(item => item.id === conversationId)
      if (!conversation) return false
      const senderId = conversation.participantAccountIds.find(accountId => accountId !== initiatingAccountId)
      const sender = senderId ? snapshot.value.accounts.find(item => item.id === senderId) : undefined
      if (!senderId || !sender || !canAccountAppear(snapshot.value, sender)) { error.value = '当前对话没有可生成回复的参与者。'; return false }
      if (conversation.kind === 'group') { error.value = '群聊回复请从群聊功能生成；本入口仅使用论坛单聊 XML。'; return false }
      const requestId = id('forum_dm_request')
      const timing = requestedTiming || snapshot.value.settings.dm.replyTiming
      if (timing === 'range' && snapshot.value.settings.dm.rangeDelayMin > snapshot.value.settings.dm.rangeDelayMax) { error.value = '私信延迟范围无效：最短分钟不能大于最长分钟。'; return false }
      const task: ForumDmGenerationTask = { id: requestId, conversationId, senderId, status: 'running', timing, createdAt: Date.now() }
      snapshot.value.dmTasks.unshift(task)
      error.value = ''
      try {
        const timingInstruction = timing === 'presence-aware'
          ? '根据人物当前状态决定是否延迟显示。如需延迟，在 persona_updates 中返回 field="system.replyDelayMinutes" 的整数分钟和可选 field="system.activity"；最终消息仍必须本轮生成。'
          : timing === 'fixed' ? `最终消息本轮生成，将在 ${snapshot.value.settings.dm.fixedDelayMinutes} 分钟后本地显示。`
            : timing === 'range' ? `最终消息本轮生成，将在 ${snapshot.value.settings.dm.rangeDelayMin}～${snapshot.value.settings.dm.rangeDelayMax} 分钟内本地显示。`
              : '立即回复。'
        const raw = await requestForumDmXml(snapshot.value, { viewerAccountId: initiatingAccountId, senderId, conversationId, timingInstruction })
        const parsed = parseChatMessageXml(raw, snapshot.value.settings.dm.maxBubbleMode === 'limit' ? snapshot.value.settings.dm.maxBubbles : undefined)
        if (!parsed.messages.length) throw new Error('模型没有返回可用的论坛私聊消息。')
        if (!snapshot.value.conversations.some(item => item.id === conversationId) || snapshot.value.settings.activeAccountId !== initiatingAccountId) { Object.assign(task, { status: 'cancelled' as const, completedAt: Date.now(), error: '会话已删除或账号已切换，迟到结果已废弃。' }); return false }
        const delayFact = parsed.facts.find(fact => fact.field === 'system.replyDelayMinutes')
        const activityFact = parsed.facts.find(fact => fact.field === 'system.activity')
        const delayMinutes = timing === 'fixed' ? snapshot.value.settings.dm.fixedDelayMinutes
          : timing === 'range' ? snapshot.value.settings.dm.rangeDelayMin + Math.random() * Math.max(0, snapshot.value.settings.dm.rangeDelayMax - snapshot.value.settings.dm.rangeDelayMin)
            : timing === 'presence-aware' ? Math.max(0, Math.min(1440, Number(delayFact?.value || 0))) : 0
        const revealAt = delayMinutes > 0 ? Date.now() + delayMinutes * 60000 : undefined
        const availabilityText = revealAt ? `${String(activityFact?.value || '对方正在忙').slice(0, 80)}，预计约 ${Math.round(delayMinutes)} 分钟后回复` : undefined
        parsed.messages.forEach((message, index) => {
          const generatedMessage: ForumDirectMessage = { id: id('generated_message'), conversationId, senderId, receiverId: initiatingAccountId, content: message.content.slice(0, 2000), type: 'text', createdAt: Date.now() + index, isSelf: false, source: 'generated', requestId, revealAt, availabilityText, contentLanguage: message.contentLanguage, translation: message.translation, translationLanguage: message.translationLanguage }
          snapshot.value.messages.push(generatedMessage); scheduleLocalReveal('message', generatedMessage.id, generatedMessage.revealAt)
        })
        const stableFacts = parsed.facts.filter(fact => !fact.field.startsWith('system.'))
        applyPersonaFacts(sender, stableFacts)
        conversation.lastMessage = revealAt ? '对方将在稍后回复' : parsed.messages.at(-1)!.content
        conversation.lastMessageTime = nowLabel()
        Object.assign(task, { status: 'completed' as const, completedAt: Date.now() })
        await saveForumSnapshot(snapshot.value)
        return true
      } catch (cause) {
        Object.assign(task, { status: 'failed' as const, error: cause instanceof Error ? cause.message : String(cause), completedAt: Date.now() })
        error.value = task.error || ''
        return false
      }
    }
    if (snapshot.value.settings.dm.concurrency === 'parallel') return execute()
    const previous = dmQueues.get(conversationId) || Promise.resolve(true)
    const queued = previous.catch(() => false).then(execute)
    dmQueues.set(conversationId, queued)
    void queued.finally(() => { if (dmQueues.get(conversationId) === queued) dmQueues.delete(conversationId) })
    return queued
  }

  const applyPersonaFacts = (account: ForumAccount, facts: Array<{ field: string; value: string }>) => {
    if (!facts.length || snapshot.value.settings.dm.factPersistence === 'conversation-only') return
    if (snapshot.value.settings.dm.factPersistence === 'confirm') {
      facts.forEach(fact => snapshot.value.notifications.push({ id: id('notification'), accountId: snapshot.value.settings.activeAccountId, type: 'dm', actorAccountId: account.id, text: `待确认的人物新事实：${fact.field} = ${fact.value}`.slice(0, 240), createdAt: Date.now() }))
      return
    }
    const persona = snapshot.value.personas.find(item => item.accountId === account.id)
    facts.forEach(fact => {
      const field = fact.field.replace(/^account\./, '').replace(/^persona\./, '')
      const target = fact.field.startsWith('account.') ? account as unknown as Record<string, unknown> : persona as unknown as Record<string, unknown> | undefined
      const current = String(target?.[field] || '').trim()
      if (current && current !== fact.value.trim()) { snapshot.value.notifications.push({ id: id('notification'), accountId: snapshot.value.settings.activeAccountId, type: 'dm', actorAccountId: account.id, text: `人物事实与已知资料冲突，未自动覆盖：${field}`.slice(0, 240), createdAt: Date.now() }); return }
      if (fact.field.startsWith('account.') && !account.lockedFields?.includes(field) && ['bio', 'location', 'expressionStyle'].includes(field)) (account as unknown as Record<string, unknown>)[field] = fact.value.slice(0, 500)
      else if (persona && !persona.lockedFields.includes(field) && ['identity', 'personality', 'occupation', 'postingStyle', 'commentingStyle', 'dmStyle', 'emojiStyle', 'punctuationStyle'].includes(field)) (persona as unknown as Record<string, unknown>)[field] = fact.value.slice(0, 500)
      else if (!account.lockedFields?.includes('backgroundHints')) account.backgroundHints = [...new Set([...(account.backgroundHints || []), fact.value.slice(0, 240)])].slice(-12)
    })
  }

  const isConversationGenerating = (conversationId: string) => snapshot.value.dmTasks.some(task => task.conversationId === conversationId && task.status === 'running')

  const adjustPendingReply = (kind: 'comment' | 'message', entityId: string, minutes?: number) => {
    const entity = kind === 'comment' ? snapshot.value.comments.find(item => item.id === entityId) : snapshot.value.messages.find(item => item.id === entityId)
    if (!entity?.revealAt) return
    if (minutes === undefined || minutes <= 0) entity.revealAt = Date.now()
    else entity.revealAt = Date.now() + Math.min(1440, Math.max(1, Math.round(minutes))) * 60000
    scheduleLocalReveal(kind, entityId, entity.revealAt)
  }

  const togglePinPost = (postId: string) => {
    const post = snapshot.value.posts.find(item => item.id === postId)
    if (!post) return false
    post.pinned = !post.pinned
    return true
  }

  const toggleKeepPost = (postId: string) => {
    const post = snapshot.value.posts.find(item => item.id === postId)
    if (!post || post.source !== 'generated') return false
    post.isKept = !post.isKept
    post.keptAt = post.isKept ? Date.now() : undefined
    void saveForumSnapshot(snapshot.value)
    return true
  }

  const movePost = (postId: string, direction: 'up' | 'down') => {
    const postList = snapshot.value.posts
    const index = postList.findIndex(item => item.id === postId)
    if (index < 0) return false

    if (direction === 'up' && index > 0) {
      const targetIndex = index - 1
      const current = postList[index]
      const prev = postList[targetIndex]
      const currentCreated = Number(current.createdAt) || Date.now()
      const prevCreated = Number(prev.createdAt) || Date.now()
      if (currentCreated <= prevCreated) {
        current.createdAt = prevCreated + 1000
      }
      postList[index] = prev
      postList[targetIndex] = current
      return true
    } else if (direction === 'down' && index < postList.length - 1) {
      const targetIndex = index + 1
      const current = postList[index]
      const next = postList[targetIndex]
      const currentCreated = Number(current.createdAt) || Date.now()
      const nextCreated = Number(next.createdAt) || Date.now()
      if (currentCreated >= nextCreated) {
        current.createdAt = Math.max(0, nextCreated - 1000)
      }
      postList[index] = next
      postList[targetIndex] = current
      return true
    }
    return false
  }

  return {
    snapshot, ready, busy, error, generationBusy, generationProgress, generationError, generationSummary: computed(() => forumGenerationRuntime.summary), dismissGenerationSummary: () => { forumGenerationRuntime.summary = undefined }, interactionBusy, interactionError, communityResponseBusyCommentId, friendFeedback, activeTab, feedMode, routeStack, currentRoute, currentAccount, currentForumUser, forumUsers, circles, currentCircle, posts, circlePosts, commentsByPost, conversations, notifications, friendRequests,
    feedScrollPositions,
    getFeedScrollPosition: (mode: string) => feedScrollPositions.value[mode] || 0,
    setFeedScrollPosition: (mode: string, top: number) => { feedScrollPositions.value[mode] = Math.max(0, top) },
    pushRoute, popRoute, resetToTab, completeOnboarding, updateForumProfile, addForumAccount, switchAccount, listParticipantCandidates, syncParticipantCandidates, setCharacterParticipation, updateParticipantPolicy, updateBridgePolicy, createCircle, joinCircle, bindCircleWorldBooks,
    publishNewPost, addComment, regenerateCommunityResponse, toggleLikePost, toggleLikeComment, toggleBookmarkPost, togglePinPost, toggleKeepPost, movePost, deletePosts, deleteCircles, toggleFollowUser, sendDirectMessage, createForumGroup, sendGroupMessage, conversationMessages, addBlock, addMute, addVisibilityRule, votePoll, enterLottery, drawLottery, importMediaFile, addAvatarFiles, addAvatarUrl, generateAvatarLibraryItem, removeAvatarLibraryItem, assignAvatarToAccount, updateNpcProfile, generateImageMedia, generateVoiceMedia, buildLightVideo, generateNewContent, generatePostComments, generatePostInteractions, generateConversationReply, isConversationGenerating, adjustPendingReply, forumFriendStatus, sendForumFriendRequest, acceptForumFriendRequest, rejectForumFriendRequest, generateForumFriendDecision,
    recordFeedShown: (posts: ForumPost[], source: ForumFeedKind | 'circle') => currentAccount.value && recordFeedExposure(snapshot.value, currentAccount.value.id, posts, source),
    markPostOpened: (postId: string) => currentAccount.value && markPostOpened(snapshot.value, currentAccount.value.id, postId)
  }
}

const normalizeHandle = (value: string) => value.trim().replace(/^@/, '').replace(/\s+/g, '_').slice(0, 32) || `nrj_${Date.now().toString(36)}`
const uniqueHandle = (value: string) => {
  const base = normalizeHandle(value)
  let result = base; let index = 1
  while (snapshot.value.accounts.some(account => account.handle.toLowerCase() === result.toLowerCase())) result = `${base}_${index++}`
  return result
}
const hash = (value: string) => Array.from(value).reduce((score, char) => ((score << 5) - score + char.charCodeAt(0)) | 0, 0) >>> 0
const postSignature = (value: unknown) => String(value || '').trim().toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, '').slice(0, 120)
