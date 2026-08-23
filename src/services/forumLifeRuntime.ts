import { requestForumJson } from './forumAI'
import { canViewForumPost } from './forumFeedRanking'
import { ensureResidentProfile, projectForumUser } from './forumPopulation'
import type { ForumAccount, ForumCircle, ForumComment, ForumPost, ForumRelationshipEdge, ForumSnapshot } from '../types/forum'

const makeId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
const hash = (value: string) => Array.from(value).reduce((score, char) => ((score << 5) - score + char.charCodeAt(0)) | 0, 0) >>> 0
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))
const postTime = (post: ForumPost) => typeof post.createdAt === 'number' ? post.createdAt : new Date(post.createdAt).getTime() || 0

export const ensureRelationshipEdge = (snapshot: ForumSnapshot, fromAccountId: string, toAccountId: string) => {
  let edge = snapshot.relationshipEdges.find(item => item.fromAccountId === fromAccountId && item.toAccountId === toAccountId)
  if (!edge) {
    edge = { id: makeId('edge'), fromAccountId, toAccountId, familiarity: 0, affinity: 0, trust: 0, tension: 0, interactionCount: 0, impressionSummary: '', updatedAt: Date.now() }
    snapshot.relationshipEdges.push(edge)
  }
  return edge
}

const touchEdge = (edge: ForumRelationshipEdge, patch: { familiarity?: number; affinity?: number; trust?: number; tension?: number; impression?: string }) => {
  edge.familiarity = clamp(edge.familiarity + (patch.familiarity || 0), 0, 100)
  edge.affinity = clamp(edge.affinity + (patch.affinity || 0), -100, 100)
  edge.trust = clamp(edge.trust + (patch.trust || 0), -100, 100)
  edge.tension = clamp(edge.tension + (patch.tension || 0), 0, 100)
  edge.interactionCount += 1; edge.lastInteractionAt = Date.now(); edge.updatedAt = Date.now()
  if (patch.impression) edge.impressionSummary = patch.impression.slice(0, 180)
}

const isActiveNow = (profile: ReturnType<typeof ensureResidentProfile>, now = Date.now()) => {
  const hour = new Date(now).getHours(); const [start, end] = profile.activeHours
  return start < end ? hour >= start && hour < end : hour >= start || hour < end
}

const accountCanAct = (snapshot: ForumSnapshot, account: ForumAccount, circle?: ForumCircle) => {
  const subject = snapshot.subjects.find(item => item.id === account.subjectId)
  const policy = snapshot.participantPolicies.find(item => item.subjectId === account.subjectId)
  if (!subject || subject.kind === 'user' || !policy?.enabled || policy.autonomy.level === 'off') return false
  if (circle?.aiActivity === 'off') return false
  if (circle && !circle.isPublic && !snapshot.memberships.some(item => item.circleId === circle.id && item.accountId === account.id && ['owner', 'admin', 'member'].includes(item.role))) return false
  if (circle && policy.blockedCircleIds.includes(circle.id)) return false
  if (circle && policy.allowedCircleIds.length && !policy.allowedCircleIds.includes(circle.id)) return false
  return true
}

const interestScore = (snapshot: ForumSnapshot, account: ForumAccount, post: ForumPost) => {
  const profile = ensureResidentProfile(snapshot, account, snapshot.subjects.find(item => item.id === account.subjectId)?.kind === 'character' ? 'character' : 'ambient')
  const text = `${post.content} ${post.topics?.join(' ') || ''}`.toLowerCase()
  const topic = profile.interests.reduce((score, item) => score + (item && text.includes(item.toLowerCase()) ? 22 : 0), 0)
  const edge = ensureRelationshipEdge(snapshot, account.id, post.authorAccountId)
  return topic + edge.familiarity * .2 + edge.affinity * .14 + profile.browsingPatience * .18 + (hash(`${account.id}:${post.id}`) % 17)
}

const remember = (snapshot: ForumSnapshot, account: ForumAccount, type: 'post' | 'comment' | 'relationship' | 'important-event', summary: string, sourceEventId: string, importance: number, circleId?: string) => {
  snapshot.memories.push({ id: makeId('memory'), subjectId: account.subjectId, accountId: account.id, circleId, type, summary: summary.slice(0, 500), visibility: 'restricted', sourceEventIds: [sourceEventId], importance, createdAt: Date.now() })
  if (snapshot.memories.length > 1600) snapshot.memories.splice(0, snapshot.memories.length - 1600)
}

const rememberIfCharacter = (snapshot: ForumSnapshot, accountId: string, type: 'comment' | 'relationship' | 'important-event', summary: string, sourceEventId: string, importance: number, circleId?: string) => {
  const account = snapshot.accounts.find(item => item.id === accountId)
  const subject = account ? snapshot.subjects.find(item => item.id === account.subjectId) : undefined
  if (account && subject?.kind === 'character') remember(snapshot, account, type, summary, sourceEventId, importance, circleId)
}

const addEvent = (snapshot: ForumSnapshot, type: string, actorAccountId: string, targetAccountIds: string[], entityId?: string, circleId?: string, payload: Record<string, unknown> = {}) => {
  const event = { id: makeId('event'), type, actorAccountId, targetAccountIds, entityId, circleId, payload, createdAt: Date.now() }
  snapshot.events.push(event)
  if (snapshot.events.length > 2400) snapshot.events.splice(0, snapshot.events.length - 2400)
  return event
}

const createResidentPost = async (snapshot: ForumSnapshot, viewerAccountId: string, actor: ForumAccount, circle?: ForumCircle, force = false) => {
  const profile = ensureResidentProfile(snapshot, actor, snapshot.subjects.find(item => item.id === actor.subjectId)?.kind === 'character' ? 'character' : 'ambient')
  if (!force && (!isActiveNow(profile) || Date.now() - Number(profile.lastPostAt || 0) < 4 * 3600000)) return null
  const scope = circle ? `这是一条发在“${circle.name}”圈子的内容。圈子讨论范围：${circle.contentScope}。必须自然符合范围和圈规；如果此人现在没有适合公开到该圈子的内容，可以不发。` : '这是一条不属于任何圈子的公开动态，可以是普通生活、临时感受、分享或提问。'
  const generated = await requestForumJson<{ willPost: boolean; motivation?: string; content?: string; topics?: string[] }>(snapshot, { viewerAccountId, circleId: circle?.id, involvedAccountIds: [actor.id] }, 'forum-post', `只判断 involvedAccounts 中这个居民此刻是否有真实发帖动机，并在决定发布时写一条帖子。不要介绍人设，不要写工作汇报、档案口吻、泛泛鸡汤、机械早晚安，也不要为了维持活跃强行发帖。${scope}${force ? '本次是用户主动刷新社区，可适当提高发现值得分享的小事的概率，但仍必须保持人物真实。' : ''}`, '{"willPost":true,"motivation":"内部动机","content":"最终正文","topics":["最多两个自然话题"]}')
  if (!generated.willPost || !String(generated.content || '').trim()) return null
  const content = String(generated.content).trim().slice(0, 1600)
  if (snapshot.posts.slice(0, 80).some(item => normalizeText(item.content) === normalizeText(content))) return null
  if (circle && !snapshot.memberships.some(item => item.circleId === circle.id && item.accountId === actor.id && ['owner', 'admin', 'member'].includes(item.role))) {
    snapshot.memberships.push({ id: makeId('member'), circleId: circle.id, accountId: actor.id, role: 'member', joinedAt: Date.now() })
    actor.circleIds = [...new Set([...actor.circleIds, circle.id])]; profile.homeCircleIds = [...new Set([...profile.homeCircleIds, circle.id])]; circle.memberCount += 1
  }
  const post: ForumPost = { id: makeId('post'), author: projectForumUser(snapshot, actor), authorAccountId: actor.id, circleId: circle?.id, type: 'text', content, topics: [...new Set((generated.topics || []).map(item => String(item).replace(/^#+/, '').trim()).filter(Boolean))].slice(0, 2), visibility: circle ? 'circle' : 'public', likeCount: 0, commentCount: 0, shareCount: 0, viewCount: 0, effectiveViewCount: 0, createdAt: Date.now(), source: 'autonomy' }
  snapshot.posts.unshift(post); profile.lastPostAt = Date.now(); profile.lastActiveAt = Date.now(); profile.recentSamples = [content.slice(0, 240), ...profile.recentSamples].slice(0, 8)
  const event = addEvent(snapshot, 'resident-post', actor.id, [], post.id, circle?.id, { motivation: generated.motivation || '' })
  remember(snapshot, actor, 'post', `自己在${circle ? `“${circle.name}”圈子` : '公开动态'}发布：${content}`, event.id, 5, circle?.id)
  queuePostReactions(snapshot, post)
  return post
}

export const generateResidentPosts = async (snapshot: ForumSnapshot, viewerAccountId: string, circleId?: string, limit = 2, force = true) => {
  const circle = circleId ? snapshot.circles.find(item => item.id === circleId) : undefined
  const accounts = snapshot.accounts.filter(item => item.id !== viewerAccountId && accountCanAct(snapshot, item, circle))
  const ranked = accounts.map(account => {
    const profile = ensureResidentProfile(snapshot, account, snapshot.subjects.find(item => item.id === account.subjectId)?.kind === 'character' ? 'character' : 'ambient')
    const circleFit = circle ? (profile.homeCircleIds.includes(circle.id) || account.circleIds.includes(circle.id) ? 40 : profile.interests.some(item => circle.contentScope.includes(item)) ? 22 : 0) : 10
    return { account, score: circleFit + profile.socialInitiative + hash(`${account.id}:${Math.floor(Date.now() / 1800000)}`) % 25 }
  }).sort((a, b) => b.score - a.score)
  const posts: ForumPost[] = []
  for (const item of ranked.slice(0, Math.max(limit * 2, 4))) {
    if (posts.length >= limit) break
    try { const post = await createResidentPost(snapshot, viewerAccountId, item.account, circle, force); if (post) posts.push(post) } catch { /* one resident failing must not stop the community */ }
  }
  return posts
}

export const queuePostReactions = (snapshot: ForumSnapshot, post: ForumPost) => {
  const circle = post.circleId ? snapshot.circles.find(item => item.id === post.circleId) : undefined
  const candidates = snapshot.accounts.filter(item => item.id !== post.authorAccountId && item.id !== snapshot.settings.activeAccountId && accountCanAct(snapshot, item, circle) && canViewForumPost(snapshot, post, item.id)).map(account => ({ account, score: interestScore(snapshot, account, post) })).sort((a, b) => b.score - a.score).slice(0, 5)
  const now = Date.now()
  candidates.forEach((item, index) => snapshot.scheduledActions.push({ id: makeId('scheduled'), actorAccountId: item.account.id, type: 'view', postId: post.id, dueAt: now + 30_000 + index * 75_000, reason: '信息流自然曝光' }))
}

const applyReaction = async (snapshot: ForumSnapshot, action: ForumSnapshot['scheduledActions'][number]) => {
  const actor = snapshot.accounts.find(item => item.id === action.actorAccountId)
  const post = action.postId ? snapshot.posts.find(item => item.id === action.postId) : undefined
  if (!actor || !post || !canViewForumPost(snapshot, post, actor.id)) { action.completedAt = Date.now(); return }
  const profile = ensureResidentProfile(snapshot, actor, snapshot.subjects.find(item => item.id === actor.subjectId)?.kind === 'character' ? 'character' : 'ambient')
  const score = interestScore(snapshot, actor, post)
  post.viewCount = Number(post.viewCount || 0) + 1
  if (score > 52) post.effectiveViewCount = Number(post.effectiveViewCount || 0) + 1
  const edge = ensureRelationshipEdge(snapshot, actor.id, post.authorAccountId)
  touchEdge(edge, { familiarity: score > 48 ? .8 : .2, affinity: score > 70 ? .5 : 0 })
  const event = addEvent(snapshot, 'resident-view', actor.id, [post.authorAccountId], post.id, post.circleId, { attentionScore: score })
  if (score > 58 && hash(`${action.id}:like`) % 100 < profile.likeTendency && !snapshot.events.some(item => item.type === 'resident-like' && item.actorAccountId === actor.id && item.entityId === post.id)) {
    post.likeCount += 1; const likeEvent = addEvent(snapshot, 'resident-like', actor.id, [post.authorAccountId], post.id, post.circleId); touchEdge(edge, { familiarity: .7, affinity: .8 })
    rememberIfCharacter(snapshot, post.authorAccountId, 'important-event', `${actor.name}赞了自己的帖子`, likeEvent.id, 2, post.circleId)
    if (post.authorAccountId === snapshot.settings.activeAccountId) snapshot.notifications.unshift({ id: makeId('notice'), accountId: post.authorAccountId, type: 'like', actorAccountId: actor.id, entityId: post.id, text: `${actor.name}赞了你的帖子`, createdAt: Date.now() })
  }
  const shouldComment = score > 72 && hash(`${action.id}:comment`) % 100 < profile.commentTendency
  if (shouldComment && !snapshot.comments.some(item => item.postId === post.id && item.authorAccountId === actor.id)) {
    try {
      const generated = await requestForumJson<{ content: string }>(snapshot, { viewerAccountId: snapshot.settings.activeAccountId, circleId: post.circleId, postId: post.id, involvedAccountIds: [actor.id] }, 'forum-comment', '这个居民已经认真读过帖子并确实有话想说。只写一条符合其表达习惯的自然评论；可以补充、共鸣、质疑或提出具体问题，不要总结原帖，不要客服式夸奖。', '{"content":"评论正文"}')
      const content = String(generated.content || '').trim().slice(0, 500)
      if (content) {
        const comment: ForumComment = { id: makeId('comment'), postId: post.id, author: projectForumUser(snapshot, actor), authorAccountId: actor.id, content, likeCount: 0, createdAt: Date.now() }
        snapshot.comments.push(comment); post.commentCount += 1
        const commentEvent = addEvent(snapshot, 'resident-comment', actor.id, [post.authorAccountId], post.id, post.circleId, { commentId: comment.id }); touchEdge(edge, { familiarity: 1.8, affinity: .5 })
        remember(snapshot, actor, 'comment', `自己评论了${post.author.name}的帖子：${content}`, commentEvent.id, 4, post.circleId)
        rememberIfCharacter(snapshot, post.authorAccountId, 'comment', `${actor.name}评论了自己的帖子：${content}`, commentEvent.id, 5, post.circleId)
        if (post.authorAccountId === snapshot.settings.activeAccountId) snapshot.notifications.unshift({ id: makeId('notice'), accountId: post.authorAccountId, type: 'comment', actorAccountId: actor.id, entityId: post.id, text: `${actor.name}评论了你：${content.slice(0, 80)}`, createdAt: Date.now() })
      }
    } catch { /* keep the view/like even if expression generation fails */ }
  }
  if (score > 84 && !snapshot.relationships.some(item => item.type === 'follow' && item.fromAccountId === actor.id && item.toAccountId === post.authorAccountId) && hash(`${action.id}:follow`) % 100 < profile.followTendency) {
    snapshot.relationships.push({ id: makeId('relationship'), fromAccountId: actor.id, toAccountId: post.authorAccountId, type: 'follow', createdAt: Date.now() }); touchEdge(edge, { familiarity: 2, trust: .8 })
    const followEvent = addEvent(snapshot, 'resident-follow', actor.id, [post.authorAccountId]); remember(snapshot, actor, 'relationship', `开始关注${post.author.name}`, followEvent.id, 5)
    rememberIfCharacter(snapshot, post.authorAccountId, 'relationship', `${actor.name}开始关注自己`, followEvent.id, 5)
    if (post.authorAccountId === snapshot.settings.activeAccountId) snapshot.notifications.unshift({ id: makeId('notice'), accountId: post.authorAccountId, type: 'follow', actorAccountId: actor.id, text: `${actor.name}关注了你`, createdAt: Date.now() })
  }
  profile.lastActiveAt = Date.now(); action.completedAt = Date.now()
  if (!snapshot.memories.some(item => item.sourceEventIds.includes(event.id)) && score > 78) remember(snapshot, actor, 'important-event', `认真看过${post.author.name}发布的内容：${post.content.slice(0, 180)}`, event.id, 4, post.circleId)
}

export const advanceForumWorld = async (snapshot: ForumSnapshot, viewerAccountId: string, options: { force?: boolean; circleId?: string } = {}) => {
  if (!snapshot.settings.autonomousCommunity && !options.force) return { posts: 0, actions: 0 }
  const now = Date.now(); const last = Number(snapshot.settings.lastWorldTickAt || now); const elapsed = Math.max(0, now - last)
  if (!options.force && elapsed < 10 * 60000) return { posts: 0, actions: 0 }
  snapshot.settings.lastWorldTickAt = now
  const actionBudget = options.force ? Math.min(6, snapshot.settings.aiBatchSize) : Math.min(3, snapshot.settings.aiBatchSize)
  const due = snapshot.scheduledActions.filter(item => !item.completedAt && (options.force || item.dueAt <= now)).slice(0, actionBudget)
  for (const action of due) await applyReaction(snapshot, action)
  const shouldPost = options.force || elapsed >= 2 * 3600000 || !snapshot.posts.length
  const posts: ForumPost[] = []
  if (shouldPost && options.circleId) {
    const circle = snapshot.circles.find(item => item.id === options.circleId)
    const limit = circle?.aiActivity === 'high' ? 3 : circle?.aiActivity === 'low' ? 1 : 2
    posts.push(...await generateResidentPosts(snapshot, viewerAccountId, options.circleId, Math.min(limit, Math.max(1, snapshot.settings.aiBatchSize)), Boolean(options.force)))
  } else if (shouldPost) {
    posts.push(...await generateResidentPosts(snapshot, viewerAccountId, undefined, 1, Boolean(options.force)))
    const activeCircles = snapshot.circles.filter(circle => circle.aiActivity !== 'off' && (circle.isPublic || snapshot.memberships.some(item => item.circleId === circle.id && item.accountId === viewerAccountId && ['owner', 'admin', 'member'].includes(item.role))))
    if (activeCircles.length) {
      const circle = activeCircles[hash(`${Math.floor(now / 1800000)}:${viewerAccountId}`) % activeCircles.length]
      posts.push(...await generateResidentPosts(snapshot, viewerAccountId, circle.id, 1, Boolean(options.force)))
    }
  }
  if (snapshot.scheduledActions.length > 1200) snapshot.scheduledActions = snapshot.scheduledActions.filter(item => !item.completedAt || now - item.completedAt < 7 * 86400000).slice(-1200)
  return { posts: posts.length, actions: due.length }
}

const normalizeText = (value: unknown) => String(value || '').trim().toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, '').slice(0, 180)
