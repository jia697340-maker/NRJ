import { requestForumJson } from './forumAI'
import { generateForumImage } from './forumMediaGeneration'
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
  rangeDays: 3, postCount: 20, commentMin: 60, commentMax: 120, publicPostCount: 14, circlePostCount: 6,
  strangerAuthorMin: 18, strangerAuthorMax: 20, requiredCharacterAccountIds: [], includeOwnedCircles: false, ownedCirclePostCounts: {}, randomCircleCount: 1, worldBookIds: []
})

export const normalizeForumGenerationConfig = (input: ForumGenerationConfig): ForumGenerationConfig => {
  const postCount = clamp(input.postCount, 1, 50)
  const publicPostCount = clamp(input.publicPostCount, 0, postCount)
  const circlePostCount = postCount - publicPostCount
  const commentMin = clamp(Math.min(input.commentMin, input.commentMax), 0, 600)
  const commentMax = clamp(Math.max(input.commentMin, input.commentMax), commentMin, 600)
  const strangerAuthorMin = clamp(Math.min(input.strangerAuthorMin, input.strangerAuthorMax), 0, 60)
  const strangerAuthorMax = clamp(Math.max(input.strangerAuthorMin, input.strangerAuthorMax), strangerAuthorMin, 60)
  const customStartAt = input.customStartAt && input.customEndAt ? Math.min(input.customStartAt, input.customEndAt) : input.customStartAt
  const customEndAt = input.customStartAt && input.customEndAt ? Math.max(input.customStartAt, input.customEndAt) : input.customEndAt
  return {
    ...input, rangeDays: clamp(input.rangeDays, 1, 365), postCount, publicPostCount, circlePostCount, commentMin, commentMax,
    strangerAuthorMin, strangerAuthorMax, randomCircleCount: clamp(input.randomCircleCount, 0, 8),
    requiredCharacterAccountIds: unique(input.requiredCharacterAccountIds || []), worldBookIds: unique(input.worldBookIds || []),
    ownedCirclePostCounts: Object.fromEntries(Object.entries(input.ownedCirclePostCounts || {}).map(([key, value]) => [key, clamp(value, 0, postCount)])), customStartAt, customEndAt
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

type AuthorDraft = { name: string; handle: string; avatar?: string; bio?: string; expressionStyle?: string; backgroundHints?: string[]; interests?: string[] }

const createLightweightAuthors = async (snapshot: ForumSnapshot, viewerAccountId: string, count: number, batchId: string) => {
  if (!count) return []
  const generated = await requestForumJson<{ authors: AuthorDraft[] }>(snapshot, { viewerAccountId, involvedAccountIds: [], worldBookIds: snapshot.settings.refreshWorldBookIds || [] }, 'forum-population',
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

const createGeneratedCircles = async (snapshot: ForumSnapshot, viewerAccountId: string, count: number, batchId: string) => {
  if (!count) return []
  const generated = await requestForumJson<{ circles: CircleDraft[] }>(snapshot, { viewerAccountId, involvedAccountIds: [], worldBookIds: snapshot.settings.refreshWorldBookIds || [] }, 'forum-post',
    `创建 ${count} 个自然、具体、彼此不同的论坛圈子。圈子像真实小组，不要使用空泛的“生活分享社区”。成员数只是世界观数字。`,
    '{"circles":[{"name":"圈名","avatar":"单字或表情","description":"公开简介","contentScope":"这里主要聊什么，具体约束","tags":["标签"],"memberCount":8421}]}')
  const drafts = Array.isArray(generated.circles) ? generated.circles : []
  const circles: ForumCircle[] = []
  for (let index = 0; index < count; index += 1) {
    const raw = drafts[index] || { name: `新鲜小组 ${index + 1}`, avatar: '组', description: '聊聊最近遇到的具体小事。', contentScope: '围绕日常生活中的具体问题、经验和发现交流。', tags: ['日常'], memberCount: 300 + index * 173 }
    const circle: ForumCircle = {
      id: makeId('circle'), name: String(raw.name).trim().slice(0, 24), avatar: String(raw.avatar || String(raw.name).slice(0, 1)), description: String(raw.description || '').trim().slice(0, 180), contentScope: String(raw.contentScope || raw.description || '').trim().slice(0, 500),
      rules: [], tags: (raw.tags || []).map(String).slice(0, 6), creatorAccountId: `generated:${batchId}`, administratorAccountIds: [], memberCount: clamp(raw.memberCount || 500, 12, 999999), activityScore: 50,
      searchable: true, isPublic: true, joinMode: 'public', contentPermissions: ['text', 'single-image', 'multi-image', 'long-article', 'link', 'poll', 'qa', 'anonymous'], anonymousMode: 'per-post', adminCanResolveAnonymous: false,
      allowPoll: true, allowLottery: false, mediaPermissions: ['image'], participantSubjectIds: [], aiPopulation: 0, aiActivity: 'off', createdAt: Date.now(), source: 'generated', generationBatchId: batchId
    }
    snapshot.circles.push(circle); circles.push(circle)
  }
  return circles
}

const postKinds: ForumPostPlanSlot['contentKind'][] = ['thought', 'life', 'image-share', 'question', 'help', 'complaint', 'experience', 'discussion', 'link', 'poll', 'anonymous', 'circle-topic']
const typeForKind = (kind: ForumPostPlanSlot['contentKind']): ForumPostType => kind === 'poll' ? 'poll' : kind === 'anonymous' ? 'anonymous' : kind === 'image-share' ? 'single-image' : kind === 'discussion' || kind === 'experience' ? 'long-article' : kind === 'question' || kind === 'help' ? 'qa' : kind === 'link' ? 'link' : 'text'

const distributeComments = (postCount: number, min: number, max: number) => {
  const target = min + Math.floor(Math.random() * (max - min + 1))
  const weights = Array.from({ length: postCount }, (_, index) => index < Math.ceil(postCount * .25) ? 0 : index < Math.ceil(postCount * .55) ? 1 + index % 3 : index >= postCount - Math.max(1, Math.round(postCount * .1)) ? 14 + index % 9 : 4 + index % 8)
  const result = Array(postCount).fill(0) as number[]
  const totalWeight = weights.reduce((sum, value) => sum + value, 0) || 1
  weights.forEach((weight, index) => { result[index] = Math.floor(target * weight / totalWeight) })
  let remainder = target - result.reduce((sum, value) => sum + value, 0)
  let cursor = postCount - 1
  while (remainder > 0) { result[Math.max(0, cursor)] += 1; remainder -= 1; cursor = cursor <= Math.ceil(postCount * .25) ? postCount - 1 : cursor - 1 }
  return result
}

export const createForumDistributionPlan = (snapshot: ForumSnapshot, sessionId: string, batchId: string, config: ForumGenerationConfig, authorIds: string[], generatedCircleIds: string[]): ForumDistributionPlan => {
  const comments = distributeComments(config.postCount, config.commentMin, config.commentMax)
  const ownedAssignments = (config.includeOwnedCircles ? Object.entries(config.ownedCirclePostCounts) : []).flatMap(([circleId, count]) => Array(clamp(count, 0, config.circlePostCount)).fill(circleId))
  const otherCircles = unique([...generatedCircleIds, ...snapshot.circles.filter(circle => circle.isPublic && circle.source !== 'user').map(circle => circle.id)])
  const circleAssignments = [...ownedAssignments].slice(0, config.circlePostCount)
  while (circleAssignments.length < config.circlePostCount && otherCircles.length) circleAssignments.push(sample(otherCircles, circleAssignments.length))
  if (circleAssignments.length < config.circlePostCount) throw new Error('圈子帖数量大于当前可用圈子容量，请选择自建圈子或允许生成随机圈子。')
  const circleIndexes = new Set(Array.from({ length: config.circlePostCount }, (_, index) => Math.min(config.postCount - 1, Math.floor((index + .5) * config.postCount / Math.max(1, config.circlePostCount)))))
  let circleCursor = 0
  const endAt = config.customEndAt || Date.now(); const startAt = config.customStartAt || endAt - config.rangeDays * 86400000
  const slots: ForumPostPlanSlot[] = Array.from({ length: config.postCount }, (_, index) => {
    const kind = sample(postKinds, index * 3 + Math.floor(Math.random() * postKinds.length))
    const createdAt = Math.round(startAt + ((index + .35 + Math.random() * .3) / config.postCount) * Math.max(60000, endAt - startAt))
    const commentTarget = comments[index]
    const heat: ForumPostPlanSlot['heat'] = commentTarget === 0 ? 'quiet' : commentTarget >= Math.max(10, config.commentMax / 6) ? 'hot' : 'normal'
    return { id: makeId('post_slot'), authorAccountId: sample(authorIds, index), circleId: circleIndexes.has(index) ? circleAssignments[circleCursor++] : undefined, postType: typeForKind(kind), createdAt, commentTarget, heat, contentKind: kind }
  }).sort((a, b) => b.createdAt - a.createdAt)
  return { id: makeId('distribution'), sessionId, batchId, slots, plannedAuthorIds: unique(slots.map(item => item.authorAccountId)), plannedCircleIds: unique(slots.map(item => item.circleId).filter(Boolean) as string[]), plannedCommentCount: comments.reduce((sum, value) => sum + value, 0), createdAt: Date.now() }
}

type GeneratedPostDraft = { slotId: string; title?: string; content: string; topics?: string[]; pollOptions?: string[]; imagePrompt?: string }

const generatePosts = async (snapshot: ForumSnapshot, viewerAccountId: string, plan: ForumDistributionPlan) => {
  const posts: ForumPost[] = []
  for (let offset = 0; offset < plan.slots.length; offset += 6) {
    const slots = plan.slots.slice(offset, offset + 6)
    const descriptions = slots.map(slot => {
      const author = snapshot.accounts.find(item => item.id === slot.authorAccountId); const circle = slot.circleId ? snapshot.circles.find(item => item.id === slot.circleId) : undefined
      return { slotId: slot.id, authorId: author?.id, author: author?.name, expressionStyle: author?.expressionStyle, backgroundHints: author?.backgroundHints, circleId: circle?.id, circle: circle?.name, contentScope: circle?.contentScope, type: slot.postType, contentKind: slot.contentKind, heat: slot.heat }
    })
    const generated = await requestForumJson<{ posts: GeneratedPostDraft[] }>(snapshot, { viewerAccountId, involvedAccountIds: unique(slots.map(item => item.authorAccountId)), worldBookIds: snapshot.settings.refreshWorldBookIds || [] }, 'forum-post',
      `严格按照下列已经规划好的槽位写帖子，不得改变作者、圈子或数量。帖子文风和长度要明显不同；允许极短碎碎念、普通问题、具体求助、经验、链接讨论和无人理会的普通内容。不要总结人设、鸡汤、档案口吻或整齐模板。\n槽位：${JSON.stringify(descriptions)}`,
      '{"posts":[{"slotId":"必须原样返回","title":"仅长文可选","content":"帖子正文","topics":["最多两个自然话题"],"pollOptions":["投票时可选"],"imagePrompt":"晒图帖必须提供自然照片画面描述"}]}')
    const drafts = Array.isArray(generated.posts) ? generated.posts : []
    for (const slot of slots) {
      const draft = drafts.find(item => item.slotId === slot.id)
      if (!draft?.content?.trim()) throw new Error('模型没有完整返回规划中的帖子，请重试。')
      const author = snapshot.accounts.find(item => item.id === slot.authorAccountId)
      if (!author) throw new Error('帖子规划引用了不存在的作者。')
      const post: ForumPost = {
        id: makeId('post'), author: { ...author, followersCount: 0, followingCount: 0, postsCount: 0, likesCount: 0 }, authorAccountId: author.id, circleId: slot.circleId, type: slot.postType,
        content: String(draft.content).trim().slice(0, 4000), title: draft.title?.trim().slice(0, 120), topics: unique((draft.topics || []).map(item => String(item).replace(/^#+/, '').trim()).filter(Boolean)).slice(0, 2),
        visibility: slot.circleId ? 'circle' : 'public', likeCount: slot.heat === 'hot' ? 8 + slot.commentTarget * 2 : slot.commentTarget ? Math.floor(slot.commentTarget * .8) : Math.random() < .35 ? 1 : 0,
        commentCount: slot.commentTarget, shareCount: slot.heat === 'hot' ? Math.max(1, Math.floor(slot.commentTarget / 4)) : 0, viewCount: slot.heat === 'hot' ? 90 + slot.commentTarget * 19 : 8 + slot.commentTarget * 7,
        effectiveViewCount: slot.heat === 'hot' ? 50 + slot.commentTarget * 9 : 4 + slot.commentTarget * 3, createdAt: slot.createdAt, source: 'generated'
      }
      if (slot.postType === 'anonymous' && slot.circleId) {
        const circle = snapshot.circles.find(item => item.id === slot.circleId)
        if (circle?.anonymousMode !== 'disabled') {
          const anonymous = { id: makeId('anonymous'), circleId: slot.circleId, ownerAccountId: author.id, anonymousCode: String(100 + Math.floor(Math.random() * 900)), rotationMode: circle?.anonymousMode || 'per-post', adminCanResolve: Boolean(circle?.adminCanResolveAnonymous) }
          snapshot.anonymousIdentities.push(anonymous); post.anonymousIdentityId = anonymous.id
        }
      }
      if (slot.postType === 'poll') {
        const options = (draft.pollOptions || ['会','不会','还没想好']).map(String).map(item => item.trim()).filter(Boolean).slice(0, 8)
        if (options.length >= 2) { const pollId = makeId('poll'); snapshot.polls.push({ id: pollId, postId: post.id, multiple: false, anonymous: true, changeable: false, resultsVisible: 'immediate', options: options.map(label => ({ id: makeId('option'), label, votes: Math.floor(Math.random() * 18), voterAccountIds: [] })) }); post.pollId = pollId }
      }
      if (slot.postType === 'single-image' && draft.imagePrompt?.trim()) {
        try { post.media = [await generateForumImage(draft.imagePrompt.trim(), snapshot.settings.preferredImageProvider || 'gpt')] } catch { post.type = 'text' }
      }
      posts.push(post); (slot as ForumPostPlanSlot & { postId?: string }).postId = post.id
    }
  }
  return posts
}

type CommentSpec = { id: string; authorAccountId: string; parentSpecId?: string; replyToAccountId?: string; createdAt: number }

const generateComments = async (snapshot: ForumSnapshot, viewerAccountId: string, plan: ForumDistributionPlan, posts: ForumPost[], authorPool: ForumAccount[]) => {
  const comments: ForumComment[] = []
  for (const slot of plan.slots) {
    if (!slot.commentTarget) continue
    const postId = (slot as ForumPostPlanSlot & { postId?: string }).postId; const post = posts.find(item => item.id === postId)
    if (!post) continue
    const specs: CommentSpec[] = []
    const roots: CommentSpec[] = []
    const commenterPool = authorPool.filter(item => item.id !== post.authorAccountId)
    for (let index = 0; index < slot.commentTarget; index += 1) {
      const makeReply = roots.length > 0 && index % 3 !== 0
      const parent = makeReply ? sample(roots, index * 5) : undefined
      const author = makeReply && index % 5 === 1 ? snapshot.accounts.find(item => item.id === post.authorAccountId)! : sample(commenterPool.length ? commenterPool : authorPool, index * 7 + slot.commentTarget)
      const spec: CommentSpec = { id: `comment_spec_${slot.id}_${index}`, authorAccountId: author.id, parentSpecId: parent?.id, replyToAccountId: parent?.authorAccountId, createdAt: Math.min(Date.now(), Number(post.createdAt) + (index + 1) * Math.max(90000, (Date.now() - Number(post.createdAt)) / (slot.commentTarget + 2))) }
      specs.push(spec); if (!parent) roots.push(spec)
    }
    for (let offset = 0; offset < specs.length; offset += 16) {
      const chunk = specs.slice(offset, offset + 16)
      const brief = chunk.map(spec => ({ specId: spec.id, authorId: spec.authorAccountId, author: snapshot.accounts.find(item => item.id === spec.authorAccountId)?.name, style: snapshot.accounts.find(item => item.id === spec.authorAccountId)?.expressionStyle, parentSpecId: spec.parentSpecId, replyTo: snapshot.accounts.find(item => item.id === spec.replyToAccountId)?.name }))
      const generated = await requestForumJson<{ comments: Array<{ specId: string; content: string }> }>(snapshot, { viewerAccountId, circleId: post.circleId, postId: post.id, involvedAccountIds: unique(chunk.map(item => item.authorAccountId)), worldBookIds: snapshot.settings.refreshWorldBookIds || [] }, 'forum-comment',
        `为当前帖子严格按评论槽位写评论。每条只替指定作者说话；长短不一，允许认真回答、一句话、口语、表情、跑题、追问、共鸣或轻微质疑。parentSpecId 表示楼中楼关系，不得改变数量。\n槽位：${JSON.stringify(brief)}`,
        '{"comments":[{"specId":"必须原样返回","content":"自然评论"}]}')
      const drafts = Array.isArray(generated.comments) ? generated.comments : []
      for (const spec of chunk) {
        const draft = drafts.find(item => item.specId === spec.id); const author = snapshot.accounts.find(item => item.id === spec.authorAccountId)
        if (!draft?.content?.trim() || !author) throw new Error('模型没有完整返回规划中的评论，请重试。')
        const parentComment = spec.parentSpecId ? comments.find(item => (item as ForumComment & { generationSpecId?: string }).generationSpecId === spec.parentSpecId) : undefined
        const comment: ForumComment & { generationSpecId?: string } = {
          id: makeId('comment'), generationSpecId: spec.id, postId: post.id, author: { ...author, followersCount: 0, followingCount: 0, postsCount: 0, likesCount: 0 }, authorAccountId: author.id,
          parentId: parentComment?.id, rootCommentId: parentComment?.rootCommentId || parentComment?.id, replyToCommentId: parentComment?.id, depth: parentComment ? 1 : 0,
          replyToUser: parentComment ? { id: parentComment.authorAccountId, name: parentComment.author.name } : undefined, content: String(draft.content).trim().slice(0, 800), likeCount: Math.random() < .18 ? 1 + Math.floor(Math.random() * 7) : 0, createdAt: spec.createdAt
        }
        comments.push(comment)
      }
    }
  }
  comments.forEach(comment => { delete (comment as ForumComment & { generationSpecId?: string }).generationSpecId })
  return comments
}

export const generateForumContentBatch = async (snapshot: ForumSnapshot, viewerAccountId: string, rawConfig: ForumGenerationConfig, onProgress?: (value: number) => void) => {
  const config = normalizeForumGenerationConfig(rawConfig); const sessionId = makeId('generation'); const batchId = makeId('content_batch')
  const session: ForumGenerationSession = { id: sessionId, status: 'planning', config, batchId, progress: 0, createdAt: Date.now() }
  snapshot.generationSessions.unshift(session)
  try {
    const draft = cloneSnapshot(snapshot); const draftSession = draft.generationSessions.find(item => item.id === sessionId)!; draft.settings.refreshWorldBookIds = config.worldBookIds
    if (config.randomCircleCount > config.circlePostCount) throw new Error('随机圈子数量不能超过圈子帖数量，每个新圈子至少需要一篇初始内容。')
    const generatedCircles = await createGeneratedCircles(draft, viewerAccountId, config.randomCircleCount, batchId); onProgress?.(12)
    const required = config.requiredCharacterAccountIds.map(id => draft.accounts.find(item => item.id === id)).filter(Boolean) as ForumAccount[]
    const desiredStrangers = clamp(config.strangerAuthorMin + Math.floor(Math.random() * (config.strangerAuthorMax - config.strangerAuthorMin + 1)), 0, 60)
    const strangers = await createLightweightAuthors(draft, viewerAccountId, desiredStrangers, batchId); onProgress?.(28)
    const authorPool = unique([...required.map(item => item.id), ...strangers.map(item => item.id)]).map(id => draft.accounts.find(item => item.id === id)!).filter(Boolean)
    if (!authorPool.length) throw new Error('本轮没有可用作者，请增加陌生作者数量或选择参与角色。')
    const plan = createForumDistributionPlan(draft, sessionId, batchId, config, authorPool.map(item => item.id), generatedCircles.map(item => item.id)); draftSession.plan = plan; draftSession.status = 'generating'; draftSession.progress = 32; onProgress?.(32)
    const posts = await generatePosts(draft, viewerAccountId, plan); draft.posts.unshift(...posts.sort((a, b) => Number(b.createdAt) - Number(a.createdAt))); onProgress?.(67)
    const comments = await generateComments(draft, viewerAccountId, plan, posts, authorPool); onProgress?.(92)
    draft.comments.push(...comments)
    const batch: ForumContentBatch = { id: batchId, sessionId, postIds: posts.map(item => item.id), commentIds: comments.map(item => item.id), authorAccountIds: strangers.map(item => item.id), circleIds: generatedCircles.map(item => item.id), createdAt: Date.now() }
    draft.contentBatches.unshift(batch); draftSession.status = 'committed'; draftSession.progress = 100; draftSession.completedAt = Date.now(); draft.settings.refreshWorldBookIds = config.worldBookIds
    Object.assign(snapshot, draft); onProgress?.(100)
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
