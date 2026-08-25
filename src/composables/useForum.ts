import { computed, ref, watch } from 'vue'
import { listCharacterDirectory, refreshCharacterDirectoryFromAllAccounts } from '../services/characterDirectory'
import { requestForumJson } from '../services/forumAI'
import { createLightShortVideo, generateForumImage, generateForumVoice } from '../services/forumMediaGeneration'
import { canAccountAppear, visiblePostsFor } from '../services/forumPolicy'
import { emptyForumSnapshot, loadForumSnapshot, resolveForumMediaUrl, saveForumSnapshot, storeForumMedia } from '../services/forumRepository'
import { markPostOpened, rankForumFeed, recordFeedExposure, type ForumFeedKind } from '../services/forumFeedRanking'
import { ensureResidentProfile, syncForumCharacters } from '../services/forumPopulation'
import { defaultForumGenerationConfig, generateForumContentBatch, promoteLightweightAuthor } from '../services/forumGeneration'
import type {
  ForumAccount, ForumAccountKind, ForumBlockRule, ForumBridgePolicy, ForumCircle, ForumComment, ForumConversation, ForumDirectMessage, ForumLottery, ForumLotteryResult,
  ForumGenerationConfig, ForumMediaItem, ForumMuteRule, ForumParticipantPolicy, ForumPoll, ForumPost, ForumPostType, ForumSnapshot, ForumSubject, ForumUser, ForumVisibilityRule, ForumWorldBinding
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
const generationProgress = ref(0)
let loading: Promise<void> | null = null
let saveTimer: ReturnType<typeof setTimeout> | null = null

const id = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
const nowLabel = () => '刚刚'
const defaultPolicy = (subjectId: string, enabled = false): ForumParticipantPolicy => ({
  id: id('participant'), subjectId, enabled, allowedCircleIds: [], blockedCircleIds: [], allowedAccountIds: [], allowedGroupIds: [], scope: ['global'], allowPublicDiscovery: true, allowNpcKnowledge: true, allowMention: true, allowSearch: true, allowRecommendation: true, allowDm: true, allowGroup: true,
  autonomy: { level: 'off', actions: {} }, updatedAt: Date.now()
})
const defaultBridge = (subjectId: string): ForumBridgePolicy => ({ id: id('bridge'), subjectId, forumToChat: { mode: 'off', memoryTypes: [] }, chatToForum: { mode: 'off', memoryTypes: [] }, updatedAt: Date.now() })

const ensureLoaded = () => {
  if (loading) return loading
  loading = loadForumSnapshot().then(async value => {
    await Promise.all(value.posts.flatMap(post => (post.media || []).map(async media => {
      if (media.storageKey) media.url = await resolveForumMediaUrl(media)
      if (media.audioStorageKey) media.audioUrl = await resolveForumMediaUrl({ url: `localforage:nrt-forum/forumMedia/${media.audioStorageKey}`, storageKey: media.audioStorageKey })
    })))
    syncForumCharacters(value)
    value.accounts.forEach(account => {
      const subject = value.subjects.find(item => item.id === account.subjectId)
      if (subject && (subject.kind === 'character' || account.lifecycle === 'persistent')) ensureResidentProfile(value, account, subject.kind === 'character' ? 'character' : 'ambient')
    })
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
    return rankForumFeed(snapshot.value, currentAccount.value.id, feedMode.value).map(hydratePost)
  })
  const circlePosts = computed(() => currentCircle.value && currentAccount.value ? visiblePostsFor(snapshot.value, currentAccount.value.id, currentCircle.value.id).map(hydratePost) : [])
  const commentsByPost = computed(() => {
    const flat = snapshot.value.comments.reduce<Record<string, ForumComment[]>>((all, comment) => {
      const account = snapshot.value.accounts.find(item => item.id === comment.authorAccountId)
      if (!account || !canAccountAppear(snapshot.value, account)) return all
      const hydrated = { ...comment, author: accountToUser(account), replies: [] }
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

  const pushRoute = (route: ForumRoute) => routeStack.value.push(route)
  const popRoute = () => { if (routeStack.value.length > 1) routeStack.value.pop() }
  const resetToTab = (tab: ForumTab) => { activeTab.value = tab; routeStack.value = [{ name: 'tab' }] }

  const completeOnboarding = (input: { name: string; handle: string; bio?: string; avatar?: string; defaultSquare: boolean; generateStrangers: boolean }) => {
    const createdAt = Date.now()
    const subjectId = id('subject_user')
    const accountId = id('forum_account')
    const personaId = id('forum_persona')
    snapshot.value.subjects.push({ id: subjectId, kind: 'user', displayName: input.name.trim(), persona: input.bio || '', createdAt, updatedAt: createdAt })
    snapshot.value.accounts.push({ id: accountId, subjectId, kind: 'main', name: input.name.trim(), handle: normalizeHandle(input.handle), avatar: input.avatar || '', bio: input.bio || '', privacy: 'public', searchable: true, acceptsFollow: true, followRequiresApproval: false, acceptsDm: 'all', showInRecommendations: true, showOnline: true, showCircles: true, joinedAt: createdAt, personaId, circleIds: [], lifecycle: 'user' })
    snapshot.value.personas.push({ id: personaId, accountId, identity: input.bio || '', interests: [], boundaries: [], socialInitiative: 50, activeHours: [], habits: {}, lockedFields: [] })
    snapshot.value.settings = { ...snapshot.value.settings, initialized: true, activeAccountId: accountId, defaultSquareEnabled: input.defaultSquare, generateStrangers: input.generateStrangers, manualGenerationOnly: true, autonomousCommunity: false, updatedAt: createdAt }
    if (input.defaultSquare) createDefaultSquare(accountId)
  }

  const updateForumProfile = (input: Pick<ForumAccount, 'name' | 'handle' | 'avatar'> & Partial<Pick<ForumAccount, 'bio' | 'location'>>) => {
    const account = currentAccount.value
    if (!account) return false
    const name = input.name.trim()
    const handle = normalizeHandle(input.handle)
    if (!name || snapshot.value.accounts.some(item => item.id !== account.id && item.handle.toLowerCase() === handle.toLowerCase())) return false
    account.name = name
    account.handle = handle
    account.avatar = input.avatar || ''
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
    refreshCharacterDirectoryFromAllAccounts()
    const existingBySource = new Map(snapshot.value.subjects.filter(subject => subject.kind === 'character').map(subject => [subject.sourceId, subject]))
    return listCharacterDirectory().map(entry => ({ ...entry, subject: existingBySource.get(entry.entityId), enabled: existingBySource.get(entry.entityId) ? snapshot.value.participantPolicies.find(policy => policy.subjectId === existingBySource.get(entry.entityId)?.id)?.enabled === true : false }))
  }

  const setCharacterParticipation = (entry: ReturnType<typeof listCharacterDirectory>[number], enabled: boolean) => {
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

  const addComment = (postId: string, content: string, replyTo?: ForumComment) => {
    if (!currentForumUser.value || !content.trim()) return
    const parentId = replyTo?.parentId || replyTo?.id
    snapshot.value.comments.push({ id: id('comment'), postId, author: currentForumUser.value, authorAccountId: currentForumUser.value.id, parentId, rootCommentId: replyTo?.rootCommentId || replyTo?.id, replyToCommentId: replyTo?.id, depth: replyTo ? 1 : 0, content: content.trim(), likeCount: 0, createdAt: Date.now(), replyToUser: replyTo ? { id: replyTo.authorAccountId, name: replyTo.author.name } : undefined })
    const post = snapshot.value.posts.find(item => item.id === postId)
    if (post) {
      post.commentCount += 1
      const eventId = id('event')
      snapshot.value.events.push({ id: eventId, type: 'user-comment', actorAccountId: currentForumUser.value.id, targetAccountIds: [post.authorAccountId], circleId: post.circleId, entityId: post.id, payload: { content: content.trim() }, createdAt: Date.now() })
      rememberForAccount(post.authorAccountId, 'comment', `${currentForumUser.value.name}评论了自己的帖子：${content.trim()}`, eventId, 5, post.circleId)
    }
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

  const sendDirectMessage = (targetId: string, content: string, media?: ForumMediaItem) => {
    if (!currentAccount.value || (!content.trim() && !media)) return
    let conversation = snapshot.value.conversations.find(item => item.kind !== 'group' && item.participantAccountIds.includes(currentAccount.value!.id) && item.participantAccountIds.includes(targetId))
    const target = snapshot.value.accounts.find(item => item.id === targetId)
    if (!target) return
    promoteLightweightAuthor(snapshot.value, targetId, '用户主动私聊')
    if (!conversation) { conversation = { id: id('conversation'), kind: 'direct', user: accountToUser(target), participantAccountIds: [currentAccount.value.id, targetId], lastMessage: '', lastMessageTime: '', unreadCount: 0, requestState: target.acceptsDm === 'all' ? 'accepted' : 'pending' }; snapshot.value.conversations.unshift(conversation) }
    const message: ForumDirectMessage = { id: id('dm'), conversationId: conversation.id, senderId: currentAccount.value.id, receiverId: targetId, content: content.trim(), type: media?.type === 'voice' ? 'voice' : media ? 'image' : 'text', mediaId: media?.id, mediaUrl: media?.url, createdAt: Date.now(), isSelf: true }
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

  const conversationMessages = (conversationId: string) => snapshot.value.messages.filter(message => message.conversationId === conversationId)
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
  const generateImageMedia = (prompt: string) => generateForumImage(prompt, snapshot.value.settings.preferredImageProvider || 'gpt')
  const generateVoiceMedia = (text: string) => generateForumVoice(text)
  const buildLightVideo = (image: ForumMediaItem, voice?: ForumMediaItem, subtitle = '') => createLightShortVideo(image, voice, subtitle)

  const generateNewContent = async (config: ForumGenerationConfig = defaultForumGenerationConfig()) => {
    if (!currentAccount.value || busy.value) return false
    busy.value = true; error.value = ''
    try {
      syncForumCharacters(snapshot.value)
      generationProgress.value = 0
      await generateForumContentBatch(snapshot.value, currentAccount.value.id, config, value => { generationProgress.value = value })
      return true
    } catch (cause) { error.value = cause instanceof Error ? cause.message : String(cause); return false }
    finally { busy.value = false }
  }

  const generatePostComments = async (postId: string) => {
    if (!currentAccount.value || busy.value) return
    const post = snapshot.value.posts.find(item => item.id === postId); if (!post) return
    const circle = post.circleId ? snapshot.value.circles.find(item => item.id === post.circleId) : undefined
    const eligible = snapshot.value.accounts.filter(account => account.id !== currentAccount.value?.id && canAccountAppear(snapshot.value, account, circle)).slice(0, snapshot.value.settings.aiBatchSize)
    if (!eligible.length) { error.value = '没有允许参与当前讨论的角色或陌生网友。'; return }
    busy.value = true; error.value = ''
    try {
      for (const account of shuffle(eligible).slice(0, 3)) {
        const generated = await requestForumJson<{ willComment?: boolean; content?: string }>(snapshot.value, { viewerAccountId: currentAccount.value.id, circleId: post.circleId, postId, involvedAccountIds: [account.id] }, 'forum-comment', '这个作者刚刚看到了帖子。先判断是否真的有话想说；沉默完全正常。决定评论时只写符合本人习惯的一条自然评论，不总结原帖，不使用客服式赞美。', '{"willComment":true,"content":"评论正文"}')
        const content = String(generated.content || '').trim().slice(0, 500)
        if (generated.willComment !== false && content) { snapshot.value.comments.push({ id: id('comment'), postId, author: accountToUser(account), authorAccountId: account.id, content, likeCount: 0, createdAt: Date.now() }); post.commentCount += 1 }
      }
    } catch (cause) { error.value = cause instanceof Error ? cause.message : String(cause) } finally { busy.value = false }
  }

  const generateConversationReply = async (conversationId: string) => {
    if (!currentAccount.value || busy.value) return
    const conversation = snapshot.value.conversations.find(item => item.id === conversationId); if (!conversation) return
    const candidates = conversation.participantAccountIds.filter(accountId => accountId !== currentAccount.value?.id).filter(accountId => {
      const account = snapshot.value.accounts.find(item => item.id === accountId); return account ? canAccountAppear(snapshot.value, account) : false
    })
    if (!candidates.length) { error.value = '当前对话没有可生成回复的参与者。'; return }
    busy.value = true; error.value = ''
    try {
      const recent = snapshot.value.messages.filter(item => item.conversationId === conversationId).slice(-20).map(item => `${item.senderId}: ${item.content}`).join('\n')
      const purpose = conversation.kind === 'group' ? 'forum-group' : 'forum-dm'
      for (const senderId of shuffle(candidates).slice(0, conversation.kind === 'group' ? 3 : 1)) {
        const generated = await requestForumJson<{ willReply?: boolean; content?: string }>(snapshot.value, { viewerAccountId: currentAccount.value.id, involvedAccountIds: [senderId] }, purpose, `只替 involvedAccounts 中这一个作者判断是否会回复近期对话。允许不回复；回复时保持本人的聊天习惯，不替其他人发言。\n近期对话：\n${recent}`, '{"willReply":true,"content":"回复正文"}')
        const content = String(generated.content || '').trim().slice(0, 1000)
        if (generated.willReply === false || !content) continue
        snapshot.value.messages.push({ id: id('generated_message'), conversationId, senderId, receiverId: conversation.kind === 'group' ? undefined : currentAccount.value.id, content, type: 'text', createdAt: Date.now(), isSelf: false })
        conversation.lastMessage = content; conversation.lastMessageTime = nowLabel()
      }
    } catch (cause) { error.value = cause instanceof Error ? cause.message : String(cause) } finally { busy.value = false }
  }

  return {
    snapshot, ready, busy, error, generationProgress, activeTab, feedMode, routeStack, currentRoute, currentAccount, currentForumUser, forumUsers, circles, currentCircle, posts, circlePosts, commentsByPost, conversations, notifications,
    pushRoute, popRoute, resetToTab, completeOnboarding, updateForumProfile, addForumAccount, switchAccount, listParticipantCandidates, setCharacterParticipation, updateParticipantPolicy, updateBridgePolicy, createCircle, joinCircle, bindCircleWorldBooks,
    publishNewPost, addComment, toggleLikePost, toggleBookmarkPost, deletePosts, deleteCircles, toggleFollowUser, sendDirectMessage, createForumGroup, sendGroupMessage, conversationMessages, addBlock, addMute, addVisibilityRule, votePoll, enterLottery, drawLottery, importMediaFile, generateImageMedia, generateVoiceMedia, buildLightVideo, generateNewContent, generatePostComments, generateConversationReply,
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
const shuffle = <T>(values: T[]) => {
  const result = [...values]
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1))
    ;[result[index], result[target]] = [result[target], result[index]]
  }
  return result
}
const postSignature = (value: unknown) => String(value || '').trim().toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, '').slice(0, 120)
