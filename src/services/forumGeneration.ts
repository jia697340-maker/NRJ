/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { requestForumJson } from './forumAI'
import { generateForumImage } from './forumMediaGeneration'
import { canAccountAppear } from './forumPolicy'
import type {
  ForumAccount, ForumCircle, ForumComment, ForumContentBatch, ForumDistributionPlan, ForumGenerationConfig,
  ForumGenerationSession, ForumParticipantPolicy, ForumPost, ForumPostPlanSlot, ForumPostType, ForumSnapshot, ForumSubject
} from '../types/forum'

const makeId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, Math.round(Number(value) || 0)))
const sample = <T>(values: T[], index: number) => values[index % Math.max(1, values.length)]
const unique = <T>(values: T[]) => [...new Set(values)]
const cloneSnapshot = (snapshot: ForumSnapshot) => JSON.parse(JSON.stringify(snapshot)) as ForumSnapshot

export const defaultForumGenerationConfig = (): ForumGenerationConfig => ({
  postCount: 3, requiredCharacterAccountIds: []
})

export const normalizeForumGenerationConfig = (input: ForumGenerationConfig): ForumGenerationConfig => {
  const postCount = clamp(input?.postCount, 1, 20)
  return { postCount, requiredCharacterAccountIds: unique(input?.requiredCharacterAccountIds || []).slice(0, postCount) }
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

type AuthorDraft = { name: string; handle: string; avatar?: string; bio?: string; expressionStyle?: string; backgroundHints?: string[]; interests?: string[] }

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
      joinedAt: Date.now() - (7 + index * 3) * 86400000, circleIds: [], lifecycle: 'lightweight', expressionStyle: String(raw.expressionStyle || '').slice(0, 240),
      backgroundHints: (raw.backgroundHints || []).map(String).slice(0, 4), firstSeenBatchId: batchId, lastSeenAt: Date.now()
    }
    snapshot.subjects.push(subject); snapshot.accounts.push(account); snapshot.participantPolicies.push(lightweightPolicy(subject.id)); result.push(account)
  }
  return result
}

type CircleDraft = { name: string; avatar?: string; description: string; contentScope: string; tags?: string[]; memberCount?: number }

const postKinds: ForumPostPlanSlot['contentKind'][] = ['thought', 'life', 'image-share', 'question', 'help', 'complaint', 'experience', 'discussion', 'link', 'poll', 'anonymous', 'circle-topic']
const typeForKind = (kind: ForumPostPlanSlot['contentKind']): ForumPostType => kind === 'poll' ? 'poll' : kind === 'anonymous' ? 'anonymous' : kind === 'image-share' ? 'single-image' : kind === 'discussion' || kind === 'experience' ? 'long-article' : kind === 'question' || kind === 'help' ? 'qa' : kind === 'link' ? 'link' : 'text'

const distributeComments = (postCount: number) => {
  const result: number[] = Array.from({ length: postCount }, (_, index) => index % 4 === 0 ? 0 : index % 3 === 0 ? 2 : 1)
  if (postCount >= 5) result[postCount - 1] = 3 + Math.floor(Math.random() * 3)
  return result
}

export const createForumDistributionPlan = (snapshot: ForumSnapshot, sessionId: string, batchId: string, config: ForumGenerationConfig, authorIds: string[], generatedCircleIds: string[]): ForumDistributionPlan => {
  const comments = distributeComments(config.postCount)
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
    const kind = sample(postKinds, index * 3 + Math.floor(Math.random() * postKinds.length))
    const createdAt = Math.round(startAt + ((index + .35 + Math.random() * .3) / config.postCount) * Math.max(60000, endAt - startAt))
    const commentTarget = comments[index]
    const heat: ForumPostPlanSlot['heat'] = commentTarget === 0 ? 'quiet' : commentTarget >= 4 ? 'hot' : 'normal'
    return { id: makeId('post_slot'), authorAccountId: assignedAuthors[index], circleId: circleIndexes.has(index) ? circleAssignments[circleCursor++] : undefined, postType: typeForKind(kind), createdAt, commentTarget, heat, contentKind: kind }
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

const materializeAuthors = (snapshot: ForumSnapshot, refs: AuthorRef[], drafts: BatchAuthorDraft[], batchId: string) => {
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
      joinedAt: Date.now() - (7 + index * 3) * 86400000, circleIds: [], lifecycle: 'lightweight', expressionStyle: String(raw.expressionStyle || '').slice(0, 240), backgroundHints: (raw.backgroundHints || []).map(String).slice(0, 4), firstSeenBatchId: batchId, lastSeenAt: Date.now()
    }
    snapshot.subjects.push(subject); snapshot.accounts.push(account); snapshot.participantPolicies.push(lightweightPolicy(subject.id)); accounts.set(ref.key, account)
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

const attachGeneratedImages = async (snapshot: ForumSnapshot, jobs: Array<{ postId: string; prompt: string }>, generateImage: typeof generateForumImage) => {
  const provider = snapshot.settings.autoImageProvider
  if (provider === 'off') return
  await Promise.allSettled(jobs.map(async job => {
    const post = snapshot.posts.find(item => item.id === job.postId)
    if (!post) return
    try { post.media = [await generateImage(job.prompt, provider)]; post.updatedAt = Date.now() }
    catch { post.type = 'text'; delete post.media; post.updatedAt = Date.now() }
  }))
}

export const generateForumContentBatch = async (snapshot: ForumSnapshot, viewerAccountId: string, rawConfig: ForumGenerationConfig, onProgress?: (value: number) => void, dependencies: ForumGenerationDependencies = {}) => {
  const config = normalizeForumGenerationConfig(rawConfig); const sessionId = makeId('generation'); const batchId = makeId('content_batch')
  const session: ForumGenerationSession = { id: sessionId, status: 'planning', config, batchId, progress: 0, createdAt: Date.now() }
  snapshot.generationSessions.unshift(session)
  try {
    const draft = cloneSnapshot(snapshot); const draftSession = draft.generationSessions.find(item => item.id === sessionId)!
    const discoverCircleCount = config.postCount >= 3 && (draft.circles.every(circle => circle.source === 'user') || Math.random() < .18) ? 1 : 0
    const required = config.requiredCharacterAccountIds.map(id => draft.accounts.find(item => item.id === id)).filter((item): item is ForumAccount => Boolean(item))
    const allowedRequired = required.filter(account => !account.isArchived && draft.participantPolicies.some(policy => policy.subjectId === account.subjectId && policy.enabled))
    if (allowedRequired.length !== config.requiredCharacterAccountIds.length) throw new Error('所选角色中有未启用或已不可用的论坛参与者。')
    const desiredStrangers = Math.min(20, Math.max(config.postCount - required.length, config.postCount + 2 - required.length))
    const authorRefs: AuthorRef[] = [...allowedRequired.map((account, index) => ({ key: `character_${index + 1}`, account })), ...Array.from({ length: desiredStrangers }, (_, index) => ({ key: `stranger_${index + 1}` }))]
    const existingCircleRefs: CircleRef[] = draft.circles.filter(circle => circle.isPublic).map((circle, index) => ({ key: `circle_existing_${index + 1}`, circle }))
    const generatedCircleRefs: CircleRef[] = Array.from({ length: discoverCircleCount }, (_, index) => ({ key: `circle_new_${index + 1}` }))
    const circleRefs = [...generatedCircleRefs, ...existingCircleRefs]
    if (!authorRefs.length) throw new Error('本轮没有可用作者。')
    const keyedPlan = createForumDistributionPlan({ ...draft, circles: circleRefs.map(ref => ({ ...(ref.circle || draft.circles[0]), id: ref.key, isPublic: true })) as ForumCircle[] }, sessionId, batchId, { ...config, requiredCharacterAccountIds: authorRefs.filter(ref => ref.account).map(ref => ref.key) }, authorRefs.map(ref => ref.key), generatedCircleRefs.map(ref => ref.key))
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
      `一次性生成本轮完整论坛批次，不得增删或改变规划中的 postKey、authorKey、circleKey、commentKey、parentCommentKey。authors 只创建这些轻量陌生人 key：${JSON.stringify(authorRefs.filter(ref => !ref.account).map(ref => ref.key))}；只写公开简介、表达习惯、少量背景和兴趣，不创建长期记忆、复杂人格或关系。circles 只创建这些新圈子 key：${JSON.stringify(generatedCircleRefs.map(ref => ref.key))}。posts 严格按规划写全部帖子及其内嵌 comments；评论只替指定 authorKey 发言，允许部分帖子零评论。图片帖给 imagePrompt，但不要生成图片。帖子长短和语气自然不同，避免模板、总结人设、鸡汤或档案口吻。\n完整规划：${JSON.stringify(promptPlan)}`,
      '{"authors":[{"authorKey":"stranger_1","name":"昵称","handle":"账号","avatar":"单字","bio":"公开简介","expressionStyle":"表达习惯","backgroundHints":["少量背景"],"interests":["兴趣"]}],"circles":[{"circleKey":"circle_new_1","name":"圈名","avatar":"字","description":"简介","contentScope":"内容范围","tags":["标签"],"memberCount":800}],"posts":[{"postKey":"规划值","title":"可选","content":"正文","topics":["话题"],"pollOptions":["投票可选"],"imagePrompt":"图片帖画面描述","comments":[{"commentKey":"规划值","content":"评论"}]}]}')
    onProgress?.(72)
    const authorMap = materializeAuthors(draft, authorRefs, Array.isArray(generated.authors) ? generated.authors : [], batchId)
    const circleMap = materializeCircles(draft, circleRefs, Array.isArray(generated.circles) ? generated.circles : [], batchId)
    const storedPlan: ForumDistributionPlan = { ...keyedPlan, slots: keyedPlan.slots.map(slot => ({ ...slot, authorAccountId: authorMap.get(slot.authorAccountId)!.id, circleId: slot.circleId ? circleMap.get(slot.circleId)?.id : undefined })), plannedAuthorIds: keyedPlan.plannedAuthorIds.map(key => authorMap.get(key)!.id), plannedCircleIds: keyedPlan.plannedCircleIds.map(key => circleMap.get(key)!.id) }
    draftSession.plan = storedPlan
    const postDrafts = Array.isArray(generated.posts) ? generated.posts : []
    const posts: ForumPost[] = []; const comments: ForumComment[] = []; const imageJobs: Array<{ postId: string; prompt: string }> = []
    for (let index = 0; index < keyedPlan.slots.length; index += 1) {
      const keyedSlot = keyedPlan.slots[index]; const slot = storedPlan.slots[index]; const raw = postDrafts.find(item => item.postKey === keyedSlot.id)
      if (!raw?.content?.trim()) throw new Error(`模型没有完整返回帖子 ${keyedSlot.id}。`)
      const author = draft.accounts.find(item => item.id === slot.authorAccountId); if (!author) throw new Error('帖子规划引用了不存在的作者。')
      const imagePrompt = String(raw.imagePrompt || '').trim()
      const post: ForumPost = { id: makeId('post'), author: { ...author, followersCount: 0, followingCount: 0, postsCount: 0, likesCount: 0 }, authorAccountId: author.id, circleId: slot.circleId, type: slot.postType === 'single-image' && (!imagePrompt || draft.settings.autoImageProvider === 'off') ? 'text' : slot.postType, content: String(raw.content).trim().slice(0, 4000), title: raw.title?.trim().slice(0, 120), topics: unique((raw.topics || []).map(item => String(item).replace(/^#+/, '').trim()).filter(Boolean)).slice(0, 2), visibility: slot.circleId ? 'circle' : 'public', likeCount: slot.heat === 'hot' ? 8 + slot.commentTarget * 2 : slot.commentTarget ? Math.floor(slot.commentTarget * .8) : 0, commentCount: slot.commentTarget, shareCount: slot.heat === 'hot' ? Math.max(1, Math.floor(slot.commentTarget / 4)) : 0, viewCount: slot.heat === 'hot' ? 90 + slot.commentTarget * 19 : 8 + slot.commentTarget * 7, effectiveViewCount: slot.heat === 'hot' ? 50 + slot.commentTarget * 9 : 4 + slot.commentTarget * 3, createdAt: slot.createdAt, source: 'generated' }
      if (slot.postType === 'anonymous' && slot.circleId) { const circle = draft.circles.find(item => item.id === slot.circleId); if (circle && circle.anonymousMode !== 'disabled') { const anonymous = { id: makeId('anonymous'), circleId: slot.circleId, ownerAccountId: author.id, anonymousCode: String(100 + Math.floor(Math.random() * 900)), rotationMode: circle.anonymousMode, adminCanResolve: Boolean(circle.adminCanResolveAnonymous) }; draft.anonymousIdentities.push(anonymous); post.anonymousIdentityId = anonymous.id } }
      if (slot.postType === 'poll') { const options = (raw.pollOptions || []).map(String).map(item => item.trim()).filter(Boolean).slice(0, 8); if (options.length >= 2) { const pollId = makeId('poll'); draft.polls.push({ id: pollId, postId: post.id, multiple: false, anonymous: true, changeable: false, resultsVisible: 'immediate', options: options.map(label => ({ id: makeId('option'), label, votes: Math.floor(Math.random() * 18), voterAccountIds: [] })) }); post.pollId = pollId } }
      if (post.type === 'single-image') imageJobs.push({ postId: post.id, prompt: imagePrompt })
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
    const generatedCircles = generatedCircleRefs.map(ref => circleMap.get(ref.key)!)
    const batch: ForumContentBatch = { id: batchId, sessionId, postIds: posts.map(item => item.id), commentIds: comments.map(item => item.id), authorAccountIds: strangers.map(item => item.id), circleIds: generatedCircles.map(item => item.id), createdAt: Date.now() }
    draft.contentBatches.unshift(batch); draftSession.status = 'committed'; draftSession.progress = 100; draftSession.completedAt = Date.now()
    Object.assign(snapshot, draft); onProgress?.(100)
    void attachGeneratedImages(snapshot, imageJobs, dependencies.generateImage || generateForumImage)
    return batch
  } catch (cause) {
    session.status = 'failed'; session.progress = 0; session.error = cause instanceof Error ? cause.message : String(cause); session.completedAt = Date.now(); throw cause
  }
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
