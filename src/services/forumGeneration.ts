/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { requestForumJson } from './forumAI'
import { generateForumImage } from './forumMediaGeneration'
import { canAccountAppear } from './forumPolicy'
import { removeForumMedia } from './forumRepository'
import type {
  ForumAccount, ForumCircle, ForumComment, ForumContentBatch, ForumDistributionPlan, ForumGenerationConfig,
  ForumGenerationSession, ForumParticipantPolicy, ForumPost, ForumPostPlanSlot, ForumPostType, ForumSnapshot, ForumSubject, ForumContentKind
} from '../types/forum'

const makeId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, Math.round(Number(value) || 0)))
const sample = <T>(values: T[], index: number) => values[index % Math.max(1, values.length)]
const unique = <T>(values: T[]) => [...new Set(values)]
const cloneSnapshot = (snapshot: ForumSnapshot) => JSON.parse(JSON.stringify(snapshot)) as ForumSnapshot

export const defaultForumGenerationConfig = (): ForumGenerationConfig => ({
  postCount: 3, requiredCharacterAccountIds: [], refreshMode: 'incremental', replaceScope: 'latest-batch', replacePostIds: [], postTypeMode: 'natural',
  allowedContentKinds: ['thought', 'life', 'image-share', 'question', 'help', 'complaint', 'experience', 'discussion', 'link', 'poll', 'anonymous', 'circle-topic'],
  ensureEverySelectedKind: true, commentMode: 'natural', commentsPerPost: 3, totalComments: 12, strangerRepeatMode: 'avoid', npcGenerationMode: 'lightweight', discoverCircles: true, includeInitialComments: true,
  anonymousUnavailable: 'create-circle', circleTopicUnavailable: 'create-circle', imageUnavailable: 'ai'
})

export const normalizeForumGenerationConfig = (input: ForumGenerationConfig): ForumGenerationConfig => {
  const defaults = defaultForumGenerationConfig()
  const postCount = Math.max(1, Math.round(Number(input?.postCount || defaults.postCount)))
  const allowed = unique((input?.allowedContentKinds || defaults.allowedContentKinds).filter(kind => postKinds.includes(kind)))
  return {
    ...defaults, ...input, postCount,
    requiredCharacterAccountIds: unique(input?.requiredCharacterAccountIds || []).slice(0, postCount),
    replacePostIds: unique(input?.replacePostIds || []),
    allowedContentKinds: allowed.length ? allowed : [...defaults.allowedContentKinds],
    commentsPerPost: Math.max(0, Math.round(Number(input?.commentsPerPost ?? defaults.commentsPerPost))),
    totalComments: Math.max(0, Math.round(Number(input?.totalComments ?? defaults.totalComments)))
  }
}

const lightweightPolicy = (subjectId: string): ForumParticipantPolicy => ({
  id: makeId('participant'), subjectId, enabled: true, allowedCircleIds: [], blockedCircleIds: [], allowedAccountIds: [], allowedGroupIds: [],
  scope: ['global', 'circle', 'passive', 'post'], allowPublicDiscovery: true, allowNpcKnowledge: false, allowMention: true, allowSearch: true,
  allowRecommendation: true, allowDm: true, allowGroup: false, autonomy: { level: 'off', actions: {} }, updatedAt: Date.now()
})

const uniqueHandle = (snapshot: ForumSnapshot, value: string) => {
  const base = String(value || '').trim().replace(/^@/, '').replace(/[^\p{L}\p{N}_-]+/gu, '_').replace(/^_+|_+$/g, '').slice(0, 28) || `nrj_${Date.now().toString(36)}`
  let result = base; let index = 1
  while (snapshot.accounts.some(item => item.handle.toLowerCase() === result.toLowerCase())) result = `${base.slice(0, 23)}_${index++}`
  return result
}

type AuthorDraft = { name: string; handle: string; avatar?: string; bio?: string; gender?: 'male' | 'female' | 'other' | 'unknown'; expressionStyle?: string; backgroundHints?: string[]; interests?: string[]; identity?: string; personality?: string; occupation?: string; boundaries?: string[]; postingStyle?: string; commentingStyle?: string; dmStyle?: string; emojiStyle?: string; punctuationStyle?: string; activeHours?: string[] }

const assignLibraryAvatar = (snapshot: ForumSnapshot, account: ForumAccount, gender: AuthorDraft['gender']) => {
  if (!snapshot.settings.avatarLibraryEnabled || !snapshot.avatarLibrary.length) return
  const preferredGroup = gender === 'male' || gender === 'female' ? gender : 'other'
  const ordered = [...snapshot.avatarLibrary.filter(item => item.group === preferredGroup), ...snapshot.avatarLibrary.filter(item => item.group !== preferredGroup)]
  const unused = ordered.find(item => !item.assignedAccountIds.length)
  const allowReuse = snapshot.settings.allowAvatarReuse && Math.random() < snapshot.settings.avatarReuseProbability
  const selected = unused || (allowReuse ? ordered[Math.floor(Math.random() * ordered.length)] : undefined)
  if (!selected) return
  selected.assignedAccountIds = unique([...selected.assignedAccountIds, account.id])
  account.avatar = selected.url
  account.avatarLibraryItemId = selected.id
}

export const createLightweightForumAuthors = async (snapshot: ForumSnapshot, viewerAccountId: string, count: number, batchId: string) => {
  if (!count) return []
  const generated = await requestForumJson<{ authors: AuthorDraft[] }>(snapshot, { userInitiated: true, viewerAccountId, involvedAccountIds: [] }, 'forum-population',
    `为一批开放论坛内容创建 ${count} 位彼此不同的轻量陌生作者。只需昵称、账号、头像文字或颜色描述、公开简介、表达习惯、少量背景提示和兴趣。不要创建作息、关系、长期记忆或复杂人格。昵称像普通网友，不使用机器人、观察员、记录者、小编等概念账号。必须尽量返回足量作者。`,
    '{"authors":[{"name":"昵称","handle":"账号","avatar":"头像描述或单字","bio":"简短简介","expressionStyle":"表达习惯","backgroundHints":["必要背景"],"interests":["兴趣"]}]}')
  const drafts = Array.isArray(generated.authors) ? generated.authors : []
  const result: ForumAccount[] = []
  for (let index = 0; index < count; index += 1) {
    const raw = drafts[index] || { name: `路过的人${index + 1}`, handle: `passing_${Date.now().toString(36)}_${index + 1}`, bio: '偶尔上来看看。', expressionStyle: '自然简短' }
    const name = String(raw.name || `路过的人${index + 1}`).trim().slice(0, 20)
    const subject: ForumSubject = { id: makeId('subject_light'), kind: 'npc', displayName: name, persona: String(raw.expressionStyle || raw.bio || '自然表达').slice(0, 240), createdAt: Date.now(), updatedAt: Date.now() }
    const account: ForumAccount = {
      id: makeId('forum_account'), subjectId: subject.id, kind: 'main', name, handle: uniqueHandle(snapshot, raw.handle), avatar: String(raw.avatar || name.slice(0, 1)), bio: String(raw.bio || '').slice(0, 160),
      privacy: 'normal', searchable: true, acceptsFollow: true, followRequiresApproval: false, acceptsDm: 'all', showInRecommendations: true, showOnline: false, showCircles: true,
      joinedAt: Date.now() - (7 + index * 3) * 86400000, circleIds: [], lifecycle: 'lightweight', expressionStyle: String(raw.expressionStyle || '').slice(0, 240), lockedFields: [], gender: raw.gender || 'unknown',
      backgroundHints: (raw.backgroundHints || []).map(String).slice(0, 4), firstSeenBatchId: batchId, lastSeenAt: Date.now()
    }
    assignLibraryAvatar(snapshot, account, raw.gender)
    snapshot.subjects.push(subject); snapshot.accounts.push(account); snapshot.participantPolicies.push(lightweightPolicy(subject.id)); result.push(account)
  }
  return result
}

type CircleDraft = { name: string; avatar?: string; description: string; contentScope: string; tags?: string[]; memberCount?: number }

export const postKinds: ForumContentKind[] = ['thought', 'life', 'image-share', 'question', 'help', 'complaint', 'experience', 'discussion', 'link', 'poll', 'anonymous', 'circle-topic']
const typeForKind = (kind: ForumPostPlanSlot['contentKind']): ForumPostType => kind === 'poll' ? 'poll' : kind === 'anonymous' ? 'anonymous' : kind === 'image-share' ? 'single-image' : kind === 'discussion' || kind === 'experience' ? 'long-article' : kind === 'question' || kind === 'help' ? 'qa' : kind === 'link' ? 'link' : 'text'

export const distributeForumComments = (kinds: ForumContentKind[], config: Pick<ForumGenerationConfig, 'commentMode' | 'commentsPerPost' | 'totalComments' | 'includeInitialComments'>, random: () => number = Math.random) => {
  const postCount = kinds.length
  if (!config.includeInitialComments) return Array(postCount).fill(0)
  if (config.commentMode === 'per-post') return Array(postCount).fill(Math.max(0, Math.round(config.commentsPerPost)))
  const weights = kinds.map((kind, index) => {
    const discussionWeight = ['question', 'help', 'discussion', 'complaint', 'poll'].includes(kind) ? 2.2 : ['experience', 'circle-topic', 'link'].includes(kind) ? 1.45 : .9
    return Math.max(.15, discussionWeight * (.58 + random() * .95) * (index % 4 === 0 ? .45 : 1))
  })
  const target = config.commentMode === 'total'
    ? Math.max(0, Math.round(config.totalComments))
    : Math.max(postCount + 2, Math.round(postCount * 3.2 + random() * postCount * 2.1))
  const weightTotal = weights.reduce((sum, value) => sum + value, 0) || 1
  const exact = weights.map(value => value / weightTotal * target)
  const result = exact.map(Math.floor)
  let remaining = target - result.reduce((sum, value) => sum + value, 0)
  exact.map((value, index) => ({ index, fraction: value - result[index] })).sort((a, b) => b.fraction - a.fraction).forEach(item => { if (remaining > 0) { result[item.index] += 1; remaining -= 1 } })
  const discussionIndexes = kinds.map((kind, index) => ['question', 'help', 'discussion', 'complaint', 'poll'].includes(kind) ? index : -1).filter(index => index >= 0)
  const ordinaryIndexes = kinds.map((kind, index) => discussionIndexes.includes(index) ? -1 : index).filter(index => index >= 0)
  if (discussionIndexes.length && ordinaryIndexes.length && target >= 2) {
    const hot = discussionIndexes.sort((a, b) => weights[b] - weights[a])[0]
    const ordinary = ordinaryIndexes.sort((a, b) => result[b] - result[a])[0]
    while (result[hot] <= result[ordinary] && result[ordinary] > 0) { result[hot] += 1; result[ordinary] -= 1 }
  }
  if (postCount >= 2 && target >= 2 && new Set(result).size === 1) { const high = weights.indexOf(Math.max(...weights)); const low = weights.indexOf(Math.min(...weights)); if (high !== low && result[low] > 0) { result[high] += 1; result[low] -= 1 } }
  return result
}

export const createForumDistributionPlan = (snapshot: ForumSnapshot, sessionId: string, batchId: string, config: ForumGenerationConfig, authorIds: string[], generatedCircleIds: string[], random: () => number = Math.random): ForumDistributionPlan => {
  const allowedKinds = config.postTypeMode === 'custom' ? config.allowedContentKinds : postKinds
  const kinds = Array.from({ length: config.postCount }, (_, index) => config.postTypeMode === 'custom' && config.ensureEverySelectedKind && index < allowedKinds.length ? allowedKinds[index] : sample(allowedKinds, index * 3 + Math.floor(random() * allowedKinds.length)))
  const comments = distributeForumComments(kinds, config, random)
  const availableCircles = unique([...generatedCircleIds, ...snapshot.circles.filter(circle => circle.isPublic).map(circle => circle.id)])
  const circlePostCount = availableCircles.length ? Math.min(config.postCount - 1, Math.max(generatedCircleIds.length, Math.floor(config.postCount * .3))) : 0
  const circleAssignments = Array.from({ length: circlePostCount }, (_, index) => sample(availableCircles, index * 3 + batchId.length))
  const circleIndexes = new Set(Array.from({ length: circlePostCount }, (_, index) => Math.min(config.postCount - 1, Math.floor((index + .65) * config.postCount / Math.max(1, circlePostCount)))))
  let circleCursor = 0
  const endAt = Date.now(); const startAt = endAt - (config.postCount <= 3 ? 8 : 36) * 3600000
  const requiredIds = config.requiredCharacterAccountIds.filter(id => authorIds.includes(id))
  const strangerIds = authorIds.filter(id => !requiredIds.includes(id))
  const assignedAuthors = [
    ...requiredIds,
    ...Array.from({ length: Math.max(0, config.postCount - requiredIds.length) }, (_, index) => sample(strangerIds.length ? strangerIds : requiredIds, index))
  ]
  const slots: ForumPostPlanSlot[] = Array.from({ length: config.postCount }, (_, index) => {
    let kind = kinds[index]
    const createdAt = Math.round(startAt + ((index + .35 + random() * .3) / config.postCount) * Math.max(60000, endAt - startAt))
    let circleId = circleIndexes.has(index) ? circleAssignments[circleCursor++] : undefined
    if ((kind === 'anonymous' || kind === 'circle-topic') && !circleId && availableCircles.length) circleId = sample(availableCircles, index + batchId.length)
    if ((kind === 'anonymous' || kind === 'circle-topic') && !circleId) kind = 'thought'
    const commentTarget = comments[index]
    const heat: ForumPostPlanSlot['heat'] = commentTarget === 0 ? 'quiet' : commentTarget >= 4 ? 'hot' : 'normal'
    return { id: makeId('post_slot'), authorAccountId: assignedAuthors[index], circleId, postType: typeForKind(kind), createdAt, commentTarget, heat, contentKind: kind }
  }).sort((a, b) => b.createdAt - a.createdAt)
  return { id: makeId('distribution'), sessionId, batchId, slots, plannedAuthorIds: unique(slots.map(item => item.authorAccountId)), plannedCircleIds: unique(slots.map(item => item.circleId).filter(Boolean) as string[]), plannedCommentCount: comments.reduce((sum, value) => sum + value, 0), createdAt: Date.now() }
}

type BatchAuthorDraft = AuthorDraft & { authorKey: string }
type BatchCircleDraft = CircleDraft & { circleKey: string }
type BatchCommentDraft = { commentKey: string; content: string }
type BatchPostDraft = { postKey: string; title?: string; content: string; topics?: string[]; pollOptions?: string[]; imagePrompt?: string; comments?: BatchCommentDraft[] }
type ForumBatchDraft = { authors?: BatchAuthorDraft[]; circles?: BatchCircleDraft[]; posts?: BatchPostDraft[] }
type AuthorRef = { key: string; account?: ForumAccount }
type CircleRef = { key: string; circle?: ForumCircle }
type CommentSpec = { commentKey: string; authorKey: string; parentCommentKey?: string; createdAt: number }
type ForumGenerationDependencies = { requestJson?: typeof requestForumJson; generateImage?: typeof generateForumImage }

const materializeAuthors = (snapshot: ForumSnapshot, refs: AuthorRef[], drafts: BatchAuthorDraft[], batchId: string, mode: ForumGenerationConfig['npcGenerationMode']) => {
  const accounts = new Map<string, ForumAccount>()
  refs.forEach((ref, index) => {
    if (ref.account) { accounts.set(ref.key, ref.account); return }
    const raw = drafts.find(item => item.authorKey === ref.key)
    if (!raw?.name?.trim() || !raw.handle?.trim()) throw new Error(`模型没有完整返回轻量作者 ${ref.key}。`)
    const name = String(raw.name).trim().slice(0, 20)
    const subject: ForumSubject = { id: makeId('subject_light'), kind: 'npc', displayName: name, persona: String(raw.expressionStyle || raw.bio || '自然表达').slice(0, 240), createdAt: Date.now(), updatedAt: Date.now() }
    const account: ForumAccount = {
      id: makeId('forum_account'), subjectId: subject.id, kind: 'main', name, handle: uniqueHandle(snapshot, raw.handle), avatar: String(raw.avatar || name.slice(0, 1)), bio: String(raw.bio || '').slice(0, 160),
      privacy: 'normal', searchable: true, acceptsFollow: true, followRequiresApproval: false, acceptsDm: 'all', showInRecommendations: true, showOnline: false, showCircles: true,
      joinedAt: Date.now() - (7 + index * 3) * 86400000, circleIds: [], lifecycle: mode === 'full' ? 'persistent' : 'lightweight', expressionStyle: String(raw.expressionStyle || '').slice(0, 240), backgroundHints: (raw.backgroundHints || []).map(String).slice(0, mode === 'full' ? 8 : 4), firstSeenBatchId: batchId, lastSeenAt: Date.now(), lockedFields: [], gender: raw.gender || 'unknown'
    }
    assignLibraryAvatar(snapshot, account, raw.gender)
    snapshot.subjects.push(subject); snapshot.accounts.push(account); snapshot.participantPolicies.push(lightweightPolicy(subject.id)); accounts.set(ref.key, account)
    if (mode === 'full') {
      const personaId = makeId('forum_persona'); account.personaId = personaId
      snapshot.personas.push({ id: personaId, accountId: account.id, identity: String(raw.identity || raw.bio || '').slice(0, 500), personality: String(raw.personality || raw.expressionStyle || '').slice(0, 500), occupation: String(raw.occupation || '').slice(0, 120), interests: (raw.interests || []).map(String).slice(0, 12), boundaries: (raw.boundaries || []).map(String).slice(0, 10), postingStyle: String(raw.postingStyle || raw.expressionStyle || '').slice(0, 300), commentingStyle: String(raw.commentingStyle || raw.expressionStyle || '').slice(0, 300), dmStyle: String(raw.dmStyle || raw.expressionStyle || '').slice(0, 300), emojiStyle: String(raw.emojiStyle || '').slice(0, 120), punctuationStyle: String(raw.punctuationStyle || '').slice(0, 120), socialInitiative: 45, activeHours: (raw.activeHours || []).map(String).slice(0, 6), habits: {}, lockedFields: [] })
    }
  })
  return accounts
}

const materializeCircles = (snapshot: ForumSnapshot, refs: CircleRef[], drafts: BatchCircleDraft[], batchId: string) => {
  const circles = new Map<string, ForumCircle>()
  refs.forEach(ref => {
    if (ref.circle) { circles.set(ref.key, ref.circle); return }
    const raw = drafts.find(item => item.circleKey === ref.key)
    if (!raw?.name?.trim() || !raw.description?.trim() || !raw.contentScope?.trim()) throw new Error(`模型没有完整返回圈子 ${ref.key}。`)
    const circle: ForumCircle = {
      id: makeId('circle'), name: String(raw.name).trim().slice(0, 24), avatar: String(raw.avatar || raw.name.slice(0, 1)), description: String(raw.description).trim().slice(0, 180), contentScope: String(raw.contentScope).trim().slice(0, 500), rules: [], tags: (raw.tags || []).map(String).slice(0, 6),
      creatorAccountId: `generated:${batchId}`, administratorAccountIds: [], memberCount: clamp(raw.memberCount || 500, 12, 999999), activityScore: 50, searchable: true, isPublic: true, joinMode: 'public', contentPermissions: ['text', 'single-image', 'multi-image', 'long-article', 'link', 'poll', 'qa', 'anonymous'], anonymousMode: 'per-post', adminCanResolveAnonymous: false, allowPoll: true, allowLottery: false, mediaPermissions: ['image'], participantSubjectIds: [], aiPopulation: 0, aiActivity: 'off', createdAt: Date.now(), source: 'generated', generationBatchId: batchId
    }
    snapshot.circles.push(circle); circles.set(ref.key, circle)
  })
  return circles
}

const canUseAuthorInCircle = (snapshot: ForumSnapshot, author: AuthorRef, circle?: CircleRef) => {
  if (!author.account || !circle) return true
  if (circle.circle) return canAccountAppear(snapshot, author.account, circle.circle)
  const policy = snapshot.participantPolicies.find(item => item.subjectId === author.account?.subjectId)
  return Boolean(policy?.enabled && !policy.allowedCircleIds.length)
}

const planComments = (snapshot: ForumSnapshot, plan: ForumDistributionPlan, authors: AuthorRef[], circles: CircleRef[]) => new Map(plan.slots.map(slot => {
  const roots: CommentSpec[] = []
  const circle = circles.find(item => item.key === slot.circleId)
  const eligibleKeys = authors.filter(author => canUseAuthorInCircle(snapshot, author, circle)).map(author => author.key)
  const pool = eligibleKeys.filter(key => key !== slot.authorAccountId)
  const specs = Array.from({ length: slot.commentTarget }, (_, index) => {
    const parent = roots.length && index % 3 !== 0 ? sample(roots, index * 5) : undefined
    const authorKey = parent && index % 5 === 1 ? slot.authorAccountId : sample(pool.length ? pool : eligibleKeys, index * 7 + slot.commentTarget)
    const spec: CommentSpec = { commentKey: `comment_${slot.id}_${index + 1}`, authorKey, parentCommentKey: parent?.commentKey, createdAt: Math.min(Date.now(), Number(slot.createdAt) + (index + 1) * Math.max(90000, (Date.now() - Number(slot.createdAt)) / (slot.commentTarget + 2))) }
    if (!parent) roots.push(spec)
    return spec
  })
  return [slot.id, specs]
}))

const attachGeneratedImages = async (snapshot: ForumSnapshot, jobs: Array<{ postId: string; prompt: string; batchId: string }>, generateImage: typeof generateForumImage) => {
  const provider = snapshot.settings.autoImageProvider
  if (provider === 'off') return
  await Promise.allSettled(jobs.map(async job => {
    if (!snapshot.posts.some(item => item.id === job.postId && item.generationBatchId === job.batchId)) return
    try {
      const media = await generateImage(job.prompt, provider)
      const current = snapshot.posts.find(item => item.id === job.postId && item.generationBatchId === job.batchId)
      if (!current) { if (media.storageKey) void removeForumMedia(media.storageKey); return }
      current.media = [media]; current.updatedAt = Date.now()
    } catch {
      const current = snapshot.posts.find(item => item.id === job.postId && item.generationBatchId === job.batchId)
      if (current) { current.type = 'text'; delete current.media; current.updatedAt = Date.now() }
    }
  }))
}

const generateSingleForumContentBatch = async (snapshot: ForumSnapshot, viewerAccountId: string, rawConfig: ForumGenerationConfig, onProgress?: (value: number) => void, dependencies: ForumGenerationDependencies = {}) => {
  const normalized = normalizeForumGenerationConfig(rawConfig)
  const noCircle = !snapshot.circles.some(circle => circle.isPublic)
  let allowedContentKinds = [...normalized.allowedContentKinds]
  const needsAnonymousCircle = normalized.postTypeMode === 'custom' && allowedContentKinds.includes('anonymous') && noCircle
  const needsTopicCircle = normalized.postTypeMode === 'custom' && allowedContentKinds.includes('circle-topic') && noCircle
  if (needsAnonymousCircle && normalized.anonymousUnavailable === 'skip') allowedContentKinds = allowedContentKinds.filter(kind => kind !== 'anonymous')
  if (needsTopicCircle && normalized.circleTopicUnavailable === 'skip') allowedContentKinds = allowedContentKinds.filter(kind => kind !== 'circle-topic')
  if ((needsAnonymousCircle && normalized.anonymousUnavailable === 'existing-circle') || (needsTopicCircle && normalized.circleTopicUnavailable === 'existing-circle')) throw new Error('所选帖子类型需要圈子；请先选择/创建圈子，或改为跳过该类型。')
  const needsCreatedCircle = needsAnonymousCircle && normalized.anonymousUnavailable === 'create-circle' || needsTopicCircle && normalized.circleTopicUnavailable === 'create-circle'
  if (normalized.postTypeMode === 'custom' && allowedContentKinds.includes('image-share') && snapshot.settings.autoImageProvider === 'off') {
    if (normalized.imageUnavailable === 'skip') allowedContentKinds = allowedContentKinds.filter(kind => kind !== 'image-share')
    if (normalized.imageUnavailable === 'ai') throw new Error('图片分享选择了 AI 生图，但论坛自动配图当前已关闭。')
  }
  if (!allowedContentKinds.length) throw new Error('当前不可用类型处理后没有剩余帖子类型。')
  const config: ForumGenerationConfig = { ...normalized, allowedContentKinds, discoverCircles: normalized.discoverCircles || needsCreatedCircle }
  const sessionId = makeId('generation'); const batchId = makeId('content_batch')
  const session: ForumGenerationSession = { id: sessionId, status: 'planning', config, batchId, progress: 0, createdAt: Date.now() }
  snapshot.generationSessions.unshift(session)
  try {
    const draft = cloneSnapshot(snapshot); const draftSession = draft.generationSessions.find(item => item.id === sessionId)!
    const discoverCircleCount = config.discoverCircles && (needsCreatedCircle || config.postCount >= 3 && (draft.circles.every(circle => circle.source === 'user') || Math.random() < .18)) ? 1 : 0
    const requiredIds = config.profileAccountId ? unique([config.profileAccountId, ...config.requiredCharacterAccountIds]) : config.requiredCharacterAccountIds
    const required = requiredIds.map(id => draft.accounts.find(item => item.id === id)).filter((item): item is ForumAccount => Boolean(item))
    const allowedRequired = required.filter(account => !account.isArchived && draft.participantPolicies.some(policy => policy.subjectId === account.subjectId && policy.enabled))
    if (allowedRequired.length !== required.length) throw new Error('所选角色中有未启用或已不可用的论坛参与者。')
    const recentAuthorIds = new Set(draft.posts.slice(0, 30).map(item => item.authorAccountId))
    const reusable = draft.accounts.filter(account => account.lifecycle === 'lightweight' && !account.isArchived && canAccountAppear(draft, account) && account.id !== viewerAccountId && (config.strangerRepeatMode === 'allow' || config.strangerRepeatMode === 'natural' && !recentAuthorIds.has(account.id)))
    const reuseCount = config.profileAccountId || config.strangerRepeatMode === 'avoid' ? 0 : Math.min(reusable.length, Math.max(1, Math.floor(config.postCount * (config.strangerRepeatMode === 'allow' ? .6 : .25))))
    const reused = reusable.slice(0, reuseCount)
    const desiredStrangers = config.profileAccountId ? 0 : Math.min(20, Math.max(0, config.postCount + 2 - allowedRequired.length - reused.length))
    const authorRefs: AuthorRef[] = [...allowedRequired.map((account, index) => ({ key: `character_${index + 1}`, account })), ...reused.map((account, index) => ({ key: `resident_${index + 1}`, account })), ...Array.from({ length: desiredStrangers }, (_, index) => ({ key: `stranger_${index + 1}` }))]
    const existingCircleRefs: CircleRef[] = draft.circles.filter(circle => circle.isPublic).map((circle, index) => ({ key: `circle_existing_${index + 1}`, circle }))
    const generatedCircleRefs: CircleRef[] = Array.from({ length: discoverCircleCount }, (_, index) => ({ key: `circle_new_${index + 1}` }))
    const circleRefs = [...generatedCircleRefs, ...existingCircleRefs]
    if (!authorRefs.length) throw new Error('本轮没有可用作者。')
    const keyedPlan = createForumDistributionPlan({ ...draft, circles: circleRefs.map(ref => ({ ...(ref.circle || draft.circles[0]), id: ref.key, isPublic: true })) as ForumCircle[] }, sessionId, batchId, { ...config, requiredCharacterAccountIds: config.profileAccountId ? authorRefs.filter(ref => ref.account?.id === config.profileAccountId).map(ref => ref.key) : authorRefs.filter(ref => ref.account).map(ref => ref.key) }, authorRefs.map(ref => ref.key), generatedCircleRefs.map(ref => ref.key))
    if (config.profileAccountId) keyedPlan.slots.forEach(slot => { slot.authorAccountId = authorRefs.find(ref => ref.account?.id === config.profileAccountId)!.key })
    keyedPlan.slots.forEach(slot => {
      const author = authorRefs.find(ref => ref.key === slot.authorAccountId); const circle = circleRefs.find(ref => ref.key === slot.circleId)
      if (author && circle && !canUseAuthorInCircle(draft, author, circle)) { delete slot.circleId; if (slot.postType === 'anonymous') { slot.postType = 'text'; slot.contentKind = 'thought' } }
    })
    keyedPlan.plannedCircleIds = unique(keyedPlan.slots.map(slot => slot.circleId).filter(Boolean) as string[])
    const commentSpecs = planComments(draft, keyedPlan, authorRefs, circleRefs)
    const promptPlan = keyedPlan.slots.map(slot => ({
      postKey: slot.id, authorKey: slot.authorAccountId, author: authorRefs.find(ref => ref.key === slot.authorAccountId)?.account ? { name: authorRefs.find(ref => ref.key === slot.authorAccountId)!.account!.name, expressionStyle: authorRefs.find(ref => ref.key === slot.authorAccountId)!.account!.expressionStyle, backgroundHints: authorRefs.find(ref => ref.key === slot.authorAccountId)!.account!.backgroundHints } : '由 authors 中同 key 的轻量陌生人承担',
      circleKey: slot.circleId, circle: circleRefs.find(ref => ref.key === slot.circleId)?.circle ? { name: circleRefs.find(ref => ref.key === slot.circleId)!.circle!.name, contentScope: circleRefs.find(ref => ref.key === slot.circleId)!.circle!.contentScope, rules: circleRefs.find(ref => ref.key === slot.circleId)!.circle!.rules } : slot.circleId ? '由 circles 中同 key 的新圈子' : undefined,
      type: slot.postType, kind: slot.contentKind, heat: slot.heat, comments: commentSpecs.get(slot.id)?.map(spec => ({ commentKey: spec.commentKey, authorKey: spec.authorKey, parentCommentKey: spec.parentCommentKey })) || []
    }))
    draftSession.status = 'generating'; draftSession.progress = 18; onProgress?.(18)
    const requestJson = dependencies.requestJson || requestForumJson
    const generated = await requestJson<ForumBatchDraft>(draft, { userInitiated: true, viewerAccountId, involvedAccountIds: allowedRequired.map(item => item.id) }, 'forum-post',
      `一次性生成本轮完整论坛子批次，不得增删或改变规划中的 postKey、authorKey、circleKey、commentKey、parentCommentKey。authors 只创建这些${config.npcGenerationMode === 'full' ? '完整' : '轻量'}陌生人 key：${JSON.stringify(authorRefs.filter(ref => !ref.account).map(ref => ref.key))}。${config.npcGenerationMode === 'full' ? '完整 NPC 补充 identity、personality、occupation 和发帖/评论/私聊风格，但不伪造与用户的关系。' : '轻量 NPC 只写公开简介、表达习惯、少量背景和兴趣，不创建复杂人格。'}circles 只创建这些新圈子 key：${JSON.stringify(generatedCircleRefs.map(ref => ref.key))}。posts 严格按规划写全部帖子及内嵌 comments，不得少评论。图片帖给 imagePrompt，但不要生成图片。\n完整规划：${JSON.stringify(promptPlan)}`,
      '{"authors":[{"authorKey":"stranger_1","name":"昵称","handle":"账号","avatar":"单字","gender":"male/female/other/unknown","bio":"公开简介","expressionStyle":"表达习惯","backgroundHints":["背景"],"interests":["兴趣"],"identity":"完整模式可用","personality":"完整模式可用","occupation":"职业","postingStyle":"发帖风格","commentingStyle":"评论风格","dmStyle":"私聊风格"}],"circles":[{"circleKey":"circle_new_1","name":"圈名","avatar":"字","description":"简介","contentScope":"内容范围","tags":["标签"],"memberCount":800}],"posts":[{"postKey":"规划值","title":"可选","content":"正文","topics":["话题"],"pollOptions":["投票可选"],"imagePrompt":"画面描述","comments":[{"commentKey":"规划值","content":"评论"}]}]}')
    onProgress?.(72)
    const authorMap = materializeAuthors(draft, authorRefs, Array.isArray(generated.authors) ? generated.authors : [], batchId, config.npcGenerationMode)
    const circleMap = materializeCircles(draft, circleRefs, Array.isArray(generated.circles) ? generated.circles : [], batchId)
    const storedPlan: ForumDistributionPlan = { ...keyedPlan, slots: keyedPlan.slots.map(slot => ({ ...slot, authorAccountId: authorMap.get(slot.authorAccountId)!.id, circleId: slot.circleId ? circleMap.get(slot.circleId)?.id : undefined })), plannedAuthorIds: keyedPlan.plannedAuthorIds.map(key => authorMap.get(key)!.id), plannedCircleIds: keyedPlan.plannedCircleIds.map(key => circleMap.get(key)!.id) }
    draftSession.plan = storedPlan
    const postDrafts = Array.isArray(generated.posts) ? generated.posts : []
    const posts: ForumPost[] = []; const comments: ForumComment[] = []; const imageJobs: Array<{ postId: string; prompt: string; batchId: string }> = []
    for (let index = 0; index < keyedPlan.slots.length; index += 1) {
      const keyedSlot = keyedPlan.slots[index]; const slot = storedPlan.slots[index]; const raw = postDrafts.find(item => item.postKey === keyedSlot.id)
      if (!raw?.content?.trim()) throw new Error(`模型没有完整返回帖子 ${keyedSlot.id}。`)
      const author = draft.accounts.find(item => item.id === slot.authorAccountId); if (!author) throw new Error('帖子规划引用了不存在的作者。')
      const imagePrompt = String(raw.imagePrompt || '').trim()
      const post: ForumPost = { id: makeId('post'), author: { ...author, followersCount: 0, followingCount: 0, postsCount: 0, likesCount: 0 }, authorAccountId: author.id, circleId: slot.circleId, type: slot.postType === 'single-image' && (!imagePrompt || draft.settings.autoImageProvider === 'off') ? 'text' : slot.postType, content: String(raw.content).trim().slice(0, 4000), title: raw.title?.trim().slice(0, 120), topics: unique((raw.topics || []).map(item => String(item).replace(/^#+/, '').trim()).filter(Boolean)).slice(0, 2), visibility: slot.circleId ? 'circle' : 'public', likeCount: slot.heat === 'hot' ? 8 + slot.commentTarget * 2 : slot.commentTarget ? Math.floor(slot.commentTarget * .8) : 0, commentCount: slot.commentTarget, shareCount: slot.heat === 'hot' ? Math.max(1, Math.floor(slot.commentTarget / 4)) : 0, viewCount: slot.heat === 'hot' ? 90 + slot.commentTarget * 19 : 8 + slot.commentTarget * 7, effectiveViewCount: slot.heat === 'hot' ? 50 + slot.commentTarget * 9 : 4 + slot.commentTarget * 3, createdAt: slot.createdAt, source: 'generated', generationBatchId: batchId, isKept: false }
      if (slot.postType === 'anonymous' && slot.circleId) { const circle = draft.circles.find(item => item.id === slot.circleId); if (circle && circle.anonymousMode !== 'disabled') { const anonymous = { id: makeId('anonymous'), circleId: slot.circleId, ownerAccountId: author.id, anonymousCode: String(100 + Math.floor(Math.random() * 900)), rotationMode: circle.anonymousMode, adminCanResolve: Boolean(circle.adminCanResolveAnonymous) }; draft.anonymousIdentities.push(anonymous); post.anonymousIdentityId = anonymous.id } }
      if (slot.postType === 'poll') { const options = (raw.pollOptions || []).map(String).map(item => item.trim()).filter(Boolean).slice(0, 8); if (options.length >= 2) { const pollId = makeId('poll'); draft.polls.push({ id: pollId, postId: post.id, multiple: false, anonymous: true, changeable: false, resultsVisible: 'immediate', options: options.map(label => ({ id: makeId('option'), label, votes: Math.floor(Math.random() * 18), voterAccountIds: [] })) }); post.pollId = pollId } }
      if (post.type === 'single-image') imageJobs.push({ postId: post.id, prompt: imagePrompt, batchId })
      posts.push(post)
      const rawComments = Array.isArray(raw.comments) ? raw.comments : []; const commentMap = new Map<string, ForumComment>()
      for (const spec of commentSpecs.get(keyedSlot.id) || []) {
        const content = rawComments.find(item => item.commentKey === spec.commentKey)?.content?.trim(); if (!content) throw new Error(`模型没有完整返回评论 ${spec.commentKey}。`)
        const commentAuthor = authorMap.get(spec.authorKey); const parent = spec.parentCommentKey ? commentMap.get(spec.parentCommentKey) : undefined
        if (!commentAuthor || (spec.parentCommentKey && !parent)) throw new Error('评论作者或楼中楼关联无效。')
        const comment: ForumComment = { id: makeId('comment'), postId: post.id, author: { ...commentAuthor, followersCount: 0, followingCount: 0, postsCount: 0, likesCount: 0 }, authorAccountId: commentAuthor.id, parentId: parent?.id, rootCommentId: parent?.rootCommentId || parent?.id, replyToCommentId: parent?.id, depth: parent ? 1 : 0, replyToUser: parent ? { id: parent.authorAccountId, name: parent.author.name } : undefined, content: String(content).slice(0, 800), likeCount: 0, createdAt: spec.createdAt, source: 'generated', generationBatchId: batchId }
        comments.push(comment); commentMap.set(spec.commentKey, comment)
      }
    }
    draft.posts.unshift(...posts.sort((a, b) => Number(b.createdAt) - Number(a.createdAt))); draft.comments.push(...comments)
    const strangers = authorRefs.filter(ref => !ref.account).map(ref => authorMap.get(ref.key)!)
    const usedCircleIds = new Set(posts.map(item => item.circleId).filter(Boolean))
    const generatedCircles = generatedCircleRefs.map(ref => circleMap.get(ref.key)!).filter(circle => circle && usedCircleIds.has(circle.id))
    draft.circles = draft.circles.filter(circle => circle.source !== 'generated' || circle.generationBatchId !== batchId || usedCircleIds.has(circle.id))
    const batch: ForumContentBatch = { id: batchId, sessionId, postIds: posts.map(item => item.id), commentIds: comments.map(item => item.id), authorAccountIds: strangers.map(item => item.id), circleIds: generatedCircles.map(item => item.id), createdAt: Date.now() }
    draft.contentBatches.unshift(batch); draftSession.status = 'committed'; draftSession.progress = 100; draftSession.completedAt = Date.now()
    Object.assign(snapshot, draft); onProgress?.(100)
    void attachGeneratedImages(snapshot, imageJobs, dependencies.generateImage || generateForumImage)
    return batch
  } catch (cause) {
    session.status = 'failed'; session.progress = 0; session.error = cause instanceof Error ? cause.message : String(cause); session.completedAt = Date.now(); throw cause
  }
}

const removeGeneratedPostsForReplacement = (snapshot: ForumSnapshot, config: ForumGenerationConfig) => {
  if (config.refreshMode !== 'replace') return [] as string[]
  const latestBatchId = snapshot.contentBatches.find(batch => batch.postIds.some(postId => snapshot.posts.some(post => post.id === postId)))?.id
  const requested = config.replaceScope === 'selected'
    ? new Set(config.replacePostIds)
    : config.replaceScope === 'latest-batch'
      ? new Set(snapshot.contentBatches.find(item => item.id === latestBatchId)?.postIds || [])
      : new Set(snapshot.posts.filter(post => post.source !== 'user').map(post => post.id))
  const protectedPostIds = new Set(snapshot.posts.filter(post => post.source === 'user' || post.isKept || snapshot.comments.some(comment => comment.postId === post.id && comment.source === 'user')).map(post => post.id))
  const removing = new Set(snapshot.posts.filter(post => requested.has(post.id) && post.source !== 'user' && !protectedPostIds.has(post.id)).map(post => post.id))
  if (!removing.size) return []
  const removedMediaKeys = snapshot.posts.filter(post => removing.has(post.id)).flatMap(post => (post.media || []).flatMap(media => [media.storageKey, media.audioStorageKey].filter(Boolean) as string[]))
  const retainedMediaKeys = new Set(snapshot.posts.filter(post => !removing.has(post.id)).flatMap(post => (post.media || []).flatMap(media => [media.storageKey, media.audioStorageKey].filter(Boolean) as string[])))
  const lotteryIds = new Set(snapshot.lotteries.filter(item => removing.has(item.postId)).map(item => item.id))
  snapshot.posts = snapshot.posts.filter(item => !removing.has(item.id))
  snapshot.comments = snapshot.comments.filter(item => !removing.has(item.postId))
  snapshot.polls = snapshot.polls.filter(item => !removing.has(item.postId))
  snapshot.lotteries = snapshot.lotteries.filter(item => !removing.has(item.postId))
  snapshot.lotteryEntries = snapshot.lotteryEntries.filter(item => !lotteryIds.has(item.lotteryId))
  snapshot.lotteryResults = snapshot.lotteryResults.filter(item => !lotteryIds.has(item.lotteryId))
  snapshot.events = snapshot.events.filter(item => !item.entityId || !removing.has(item.entityId))
  snapshot.notifications = snapshot.notifications.filter(item => !item.entityId || !removing.has(item.entityId))
  snapshot.contentBatches.forEach(batch => { batch.postIds = batch.postIds.filter(id => !removing.has(id)); batch.commentIds = batch.commentIds.filter(id => snapshot.comments.some(comment => comment.id === id)) })
  removedMediaKeys.filter(key => !retainedMediaKeys.has(key)).forEach(key => { void removeForumMedia(key) })
  return [...removing]
}

export const estimateForumBatchSize = (config: ForumGenerationConfig, contextTokenBudget = 5000) => {
  const commentsPerPost = config.commentMode === 'per-post' ? config.commentsPerPost : config.commentMode === 'total' ? config.totalComments / Math.max(1, config.postCount) : 4
  const personaCost = config.npcGenerationMode === 'full' ? 2.2 : 1
  const contextCost = Math.max(.7, Math.min(2, contextTokenBudget / 5000))
  return Math.max(1, Math.min(20, Math.floor(22 / Math.max(1, (1 + commentsPerPost / 5) * personaCost * contextCost))))
}

export const generateForumContentBatch = async (snapshot: ForumSnapshot, viewerAccountId: string, rawConfig: ForumGenerationConfig, onProgress?: (value: number) => void, dependencies: ForumGenerationDependencies = {}) => {
  const config = normalizeForumGenerationConfig(rawConfig)
  const working = cloneSnapshot(snapshot)
  removeGeneratedPostsForReplacement(working, config)
  const batchSize = estimateForumBatchSize(config, snapshot.settings.aiContextTokenBudget)
  const batches: ForumContentBatch[] = []
  let remaining = config.postCount
  let generatedPosts = 0
  let requiredCursor = 0
  let kindCursor = 0
  try {
    while (remaining > 0) {
      const count = Math.min(batchSize, remaining)
      const requiredIds = config.profileAccountId ? [] : config.requiredCharacterAccountIds.slice(requiredCursor, requiredCursor + count)
      requiredCursor += requiredIds.length
      const uncoveredKinds = config.postTypeMode === 'custom' && config.ensureEverySelectedKind ? config.allowedContentKinds.slice(kindCursor, kindCursor + count) : []
      kindCursor += uncoveredKinds.length
      const batchConfig: ForumGenerationConfig = {
        ...config,
        postCount: count,
        refreshMode: 'incremental',
        requiredCharacterAccountIds: requiredIds,
        allowedContentKinds: uncoveredKinds.length ? uncoveredKinds : config.allowedContentKinds,
        totalComments: config.commentMode === 'total'
          ? Math.max(0, Math.round(config.totalComments * (generatedPosts + count) / config.postCount) - Math.round(config.totalComments * generatedPosts / config.postCount))
          : config.totalComments,
        ensureEverySelectedKind: uncoveredKinds.length > 0
      }
      const batch = await generateSingleForumContentBatch(working, viewerAccountId, batchConfig, value => onProgress?.(Math.round((generatedPosts / config.postCount + value / 100 * count / config.postCount) * 100)), dependencies)
      batches.push(batch)
      generatedPosts += count
      remaining -= count
    }
  } catch (cause) {
    if (batches.length) Object.assign(snapshot, working)
    const reason = cause instanceof Error ? cause.message : String(cause)
    throw new Error(batches.length ? `已保留 ${generatedPosts} 篇成功内容；剩余 ${remaining} 篇未完成，可按相同设置重试。${reason}` : reason)
  }
  Object.assign(snapshot, working)
  if (batches.length === 1) return batches[0]
  const combined: ForumContentBatch = { id: makeId('content_batch_group'), sessionId: batches[0].sessionId, postIds: batches.flatMap(item => item.postIds), commentIds: batches.flatMap(item => item.commentIds), authorAccountIds: unique(batches.flatMap(item => item.authorAccountIds)), circleIds: unique(batches.flatMap(item => item.circleIds)), createdAt: Date.now() }
  snapshot.contentBatches.unshift(combined)
  onProgress?.(100)
  return combined
}

export const promoteLightweightAuthor = (snapshot: ForumSnapshot, accountId: string, reason: string) => {
  const account = snapshot.accounts.find(item => item.id === accountId)
  if (!account || account.lifecycle !== 'lightweight') return account
  account.lifecycle = 'persistent'; account.persistenceReason = reason; account.lastSeenAt = Date.now()
  const subject = snapshot.subjects.find(item => item.id === account.subjectId)
  if (subject && !snapshot.personas.some(item => item.accountId === account.id)) {
    const personaId = makeId('forum_persona'); account.personaId = personaId
    snapshot.personas.push({ id: personaId, accountId: account.id, identity: account.bio, personality: account.expressionStyle, interests: [], boundaries: [], postingStyle: account.expressionStyle, socialInitiative: 30, activeHours: [], habits: {}, lockedFields: [] })
  }
  return account
}
