/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import localforage from 'localforage'
import type { ForumMediaItem, ForumSnapshot } from '../types/forum'

export const FORUM_DB_NAME = 'nrt-forum'
export const FORUM_DATA_STORE = 'forumData'
export const FORUM_MEDIA_STORE = 'forumMedia'
export const FORUM_MEDIA_META_STORE = 'forumMediaMeta'
const SNAPSHOT_KEY = 'current'

const dataStore = localforage.createInstance({ name: FORUM_DB_NAME, storeName: FORUM_DATA_STORE })
const mediaStore = localforage.createInstance({ name: FORUM_DB_NAME, storeName: FORUM_MEDIA_STORE })
const mediaMetaStore = localforage.createInstance({ name: FORUM_DB_NAME, storeName: FORUM_MEDIA_META_STORE })

export const emptyForumSnapshot = (): ForumSnapshot => {
  const now = Date.now()
  return {
    version: 6,
    settings: { initialized: false, activeAccountId: '', defaultSquareEnabled: false, generateStrangers: true, manualGenerationOnly: true, autonomousCommunity: false, ambientPopulationTarget: 0, aiBatchSize: 6, aiContextTokenBudget: 5000, refreshWorldBookIds: [], autoImageProvider: 'pollinations', lastWorldTickAt: now, defaultReplyTiming: 'immediate', avatarLibraryEnabled: false, allowAvatarReuse: false, avatarReuseProbability: 0.02, dm: { autoSummary: false, summaryThreshold: 80, bilingual: false, translationLanguage: '中文', timeAware: true, contextMessageCount: 30, contextTokenBudget: 5000, replyTiming: 'immediate', fixedDelayMinutes: 10, rangeDelayMin: 5, rangeDelayMax: 30, maxBubbleMode: 'natural', maxBubbles: 5, factPersistence: 'auto', context: { publicPosts: true, publicComments: true, circles: true, interactions: true, forumMemories: true, chatSummaries: false }, concurrency: 'queue', pendingVisibility: 'hidden' }, createdAt: now, updatedAt: now },
    subjects: [], accounts: [], personas: [], participantPolicies: [], accountLinks: [], recognitions: [], circles: [], memberships: [], worldBindings: [], posts: [], comments: [], topics: [], relationships: [], blocks: [], mutes: [], visibilityRules: [], anonymousIdentities: [], polls: [], lotteries: [], lotteryEntries: [], lotteryResults: [], conversations: [], messages: [], friendRequests: [], groups: [], groupMembers: [], bridgePolicies: [], memories: [], circleMemories: [], events: [], notifications: [], residentProfiles: [], relationshipEdges: [], exposures: [], scheduledActions: [], generationSessions: [], contentBatches: [], avatarLibrary: [], dmTasks: []
  }
}

const arrays: Array<keyof ForumSnapshot> = [
  'subjects', 'accounts', 'personas', 'participantPolicies', 'accountLinks', 'recognitions', 'circles', 'memberships', 'worldBindings', 'posts', 'comments', 'topics', 'relationships', 'blocks', 'mutes', 'visibilityRules', 'anonymousIdentities', 'polls', 'lotteries', 'lotteryEntries', 'lotteryResults', 'conversations', 'messages', 'friendRequests', 'groups', 'groupMembers', 'bridgePolicies', 'memories', 'circleMemories', 'events', 'notifications', 'residentProfiles', 'relationshipEdges', 'exposures', 'scheduledActions', 'generationSessions', 'contentBatches', 'avatarLibrary', 'dmTasks'
]

export const normalizeForumSnapshot = (raw: Partial<ForumSnapshot> | null | undefined): ForumSnapshot => {
  const base = emptyForumSnapshot()
  if (!raw || typeof raw !== 'object') return base
  const previousVersion = Number(raw.version || 1)
  const merged = { ...base, ...raw, settings: { ...base.settings, ...(raw.settings || {}) } } as ForumSnapshot
  arrays.forEach(key => {
    if (!Array.isArray(merged[key])) (merged as unknown as Record<string, unknown>)[key] = []
  })
  merged.circles.forEach(circle => {
    circle.contentScope ||= circle.description || `围绕“${circle.name}”进行自然、具体的交流。`
    if (previousVersion < 2 && circle.aiActivity === 'off') circle.aiActivity = 'normal'
  })
  merged.posts.forEach(post => { post.source ||= post.authorAccountId === merged.settings.activeAccountId ? 'user' : 'imported'; post.isKept ??= false })
  if (previousVersion < 3) {
    merged.accounts.forEach(account => {
      const subject = merged.subjects.find(item => item.id === account.subjectId)
      account.lifecycle ||= subject?.kind === 'user' ? 'user' : subject?.kind === 'character' ? 'character' : 'persistent'
    })
    merged.comments.forEach(comment => {
      comment.depth ??= comment.parentId ? 1 : 0
      comment.rootCommentId ||= comment.parentId || comment.id
    })
    merged.circles.forEach(circle => { circle.source ||= circle.creatorAccountId === merged.settings.activeAccountId ? 'user' : 'imported' })
    merged.scheduledActions.forEach(action => { action.completedAt ||= Date.now() })
  }
  merged.settings.autonomousCommunity = false
  merged.settings.manualGenerationOnly = true
  merged.settings.ambientPopulationTarget = 0
  if (!['immediate', 'presence-aware', 'fixed', 'range'].includes(merged.settings.defaultReplyTiming || '')) merged.settings.defaultReplyTiming = 'immediate'
  merged.settings.avatarLibraryEnabled ??= false
  merged.settings.allowAvatarReuse ??= false
  merged.settings.avatarReuseProbability = Math.max(0, Math.min(.1, Number(merged.settings.avatarReuseProbability ?? .02)))
  merged.settings.dm = { ...base.settings.dm, ...(merged.settings.dm || {}), context: { ...base.settings.dm.context, ...(merged.settings.dm?.context || {}) } }
  if (!['immediate', 'presence-aware', 'fixed', 'range'].includes(merged.settings.dm.replyTiming)) merged.settings.dm.replyTiming = 'immediate'
  if (merged.settings.dm.rangeDelayMin > merged.settings.dm.rangeDelayMax) merged.settings.dm.rangeDelayMax = merged.settings.dm.rangeDelayMin
  if (!['novelai', 'gpt', 'gemini', 'flux', 'niji', 'seedream', 'pollinations', 'aihorde', 'off'].includes(merged.settings.autoImageProvider)) merged.settings.autoImageProvider = 'pollinations'
  merged.settings.lastWorldTickAt ||= merged.settings.updatedAt || Date.now()
  merged.participantPolicies.forEach(policy => { policy.autonomy = { level: 'off', actions: {} } })
  merged.comments.forEach(comment => { comment.source ||= comment.authorAccountId === merged.settings.activeAccountId ? 'user' : 'generated' })
  merged.messages.forEach(message => { message.source ||= message.senderId === merged.settings.activeAccountId ? 'user' : 'generated' })
  if (previousVersion < 6) merged.generationSessions.forEach(session => {
    const legacy = session.config as unknown as { postCount?: number; requiredCharacterAccountIds?: string[] }
    session.config = { postCount: Math.max(1, Number(legacy.postCount || 5)), requiredCharacterAccountIds: [...new Set(legacy.requiredCharacterAccountIds || [])], refreshMode: 'incremental', replaceScope: 'latest-batch', replacePostIds: [], postTypeMode: 'natural', allowedContentKinds: ['thought', 'life', 'image-share', 'question', 'help', 'complaint', 'experience', 'discussion', 'link', 'poll', 'anonymous', 'circle-topic'], ensureEverySelectedKind: true, commentMode: 'natural', commentsPerPost: 3, totalComments: 12, strangerRepeatMode: 'avoid', npcGenerationMode: 'lightweight', discoverCircles: true, includeInitialComments: true, anonymousUnavailable: 'create-circle', circleTopicUnavailable: 'create-circle', imageUnavailable: 'ai' }
  })
  if (previousVersion < 2) merged.bridgePolicies.forEach(bridge => {
    if (bridge.forumToChat.mode === 'off' && bridge.chatToForum.mode === 'off' && !bridge.forumToChat.memoryTypes.length && !bridge.chatToForum.memoryTypes.length) {
      bridge.forumToChat = { mode: 'important', memoryTypes: ['post', 'comment', 'relationship', 'important-event'] }
      bridge.chatToForum = { mode: 'reachable-only', memoryTypes: ['chat-daily', 'important-event', 'relationship'] }
    }
  })
  if (previousVersion < 2) {
    const conceptAccount = /(记录簿|记录者|观察员|守夜人|档案|信号|机器人|\bai\b|\bbot\b)/i
    merged.accounts.filter(account => merged.subjects.find(subject => subject.id === account.subjectId)?.kind === 'npc' && conceptAccount.test(`${account.name} ${account.handle}`)).forEach(account => {
      account.isArchived = true
      const subject = merged.subjects.find(item => item.id === account.subjectId)
      if (subject) subject.detachedAt = Date.now()
      const policy = merged.participantPolicies.find(item => item.subjectId === account.subjectId)
      if (policy) { policy.enabled = false; policy.autonomy = { level: 'off', actions: {} } }
    })
  }
  merged.accounts.forEach(account => { account.lockedFields ||= [] })
  merged.avatarLibrary.forEach(item => { item.assignedAccountIds ||= [] })
  merged.dmTasks.forEach(task => { if (task.status === 'running') { task.status = 'interrupted'; task.error = '页面关闭或刷新导致生成中断，可重新生成。' } })
  merged.version = 6
  return merged
}

export const loadForumSnapshot = async () => normalizeForumSnapshot(await dataStore.getItem<ForumSnapshot>(SNAPSHOT_KEY))
export const saveForumSnapshot = async (snapshot: ForumSnapshot) => {
  snapshot.settings.updatedAt = Date.now()
  await dataStore.setItem(SNAPSHOT_KEY, JSON.parse(JSON.stringify(snapshot)))
}

export const clearForumData = async () => {
  await Promise.all([dataStore.clear(), mediaStore.clear(), mediaMetaStore.clear()])
}

export const storeForumMedia = async (blob: Blob, meta: Omit<ForumMediaItem, 'id' | 'url' | 'storageKey'> & { id?: string }) => {
  const id = meta.id || `media_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  await mediaStore.setItem(id, blob)
  const item: ForumMediaItem = { ...meta, id, url: `localforage:${FORUM_DB_NAME}/${FORUM_MEDIA_STORE}/${id}`, storageKey: id, mimeType: meta.mimeType || blob.type }
  await mediaMetaStore.setItem(id, item)
  return item
}

export const resolveForumMediaUrl = async (item?: Pick<ForumMediaItem, 'url' | 'storageKey'> | null) => {
  if (!item) return ''
  if (!item.storageKey) return item.url
  const blob = await mediaStore.getItem<Blob>(item.storageKey)
  return blob ? URL.createObjectURL(blob) : ''
}

export const removeForumMedia = async (id: string) => Promise.all([mediaStore.removeItem(id), mediaMetaStore.removeItem(id)])

export const exportForumSnapshot = async () => ({ snapshot: await loadForumSnapshot(), exportedAt: Date.now() })
export const importForumSnapshot = async (raw: unknown) => {
  const container = raw && typeof raw === 'object' && 'snapshot' in raw ? (raw as { snapshot: Partial<ForumSnapshot> }).snapshot : raw as Partial<ForumSnapshot>
  const snapshot = normalizeForumSnapshot(container)
  await saveForumSnapshot(snapshot)
  return snapshot
}
