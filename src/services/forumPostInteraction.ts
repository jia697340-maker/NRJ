/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { requestForumJson } from './forumAI'
import { canAccountAppear } from './forumPolicy'
import type { ForumAccount, ForumComment, ForumParticipantPolicy, ForumPostInteractionConfig, ForumSnapshot, ForumSubject, ForumUser } from '../types/forum'

const makeId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
const userOf = (account: ForumAccount): ForumUser => ({ ...account, followersCount: 0, followingCount: 0, postsCount: 0, likesCount: 0 })
const policyFor = (subjectId: string): ForumParticipantPolicy => ({ id: makeId('participant'), subjectId, enabled: true, allowedCircleIds: [], blockedCircleIds: [], allowedAccountIds: [], allowedGroupIds: [], scope: ['global', 'circle', 'passive', 'post'], allowPublicDiscovery: true, allowNpcKnowledge: false, allowMention: true, allowSearch: true, allowRecommendation: true, allowDm: true, allowGroup: false, autonomy: { level: 'off', actions: {} }, updatedAt: Date.now() })

type ActorDraft = { actorKey: string; name: string; handle: string; avatar?: string; bio?: string; expressionStyle?: string }
type CommentDraft = { commentKey: string; actorKey: string; content: string; parentCommentId?: string }

export const generateForumPostInteractions = async (snapshot: ForumSnapshot, viewerAccountId: string, postId: string, config: ForumPostInteractionConfig, dependencies: { requestJson?: typeof requestForumJson } = {}) => {
  const post = snapshot.posts.find(item => item.id === postId)
  if (!post) throw new Error('当前帖子不存在。')
  const commentCount = config.comments ? Math.max(0, Math.round(config.countMode === 'natural' ? 2 + Math.random() * 6 : config.commentCount)) : 0
  const replyCount = config.replies ? Math.max(0, Math.round(config.countMode === 'natural' ? Math.random() * 4 : config.replyCount)) : 0
  const targetCommentCount = snapshot.comments.filter(item => item.postId === postId).length + commentCount + replyCount
  if (config.countMode === 'custom' && config.commentLikes && config.commentLikeCount > 0 && targetCommentCount === 0) throw new Error('当前没有可点赞的评论；请先勾选新增评论或将评论点赞数设为 0。')
  const commentLikeActors = config.countMode === 'custom' ? Math.ceil(config.commentLikeCount / Math.max(1, targetCommentCount)) : 1
  const requestedActionActors = config.countMode === 'custom' ? Math.max(config.postLikeCount, config.shareCount, config.bookmarkCount, config.followCount, commentLikeActors, 1) : 1
  const actorCount = Math.max(1, Math.round(config.countMode === 'natural' ? 3 + Math.random() * 4 : Math.max(config.actorCount || 3, requestedActionActors)))
  const batchId = makeId('interaction_batch')
  const existing = snapshot.accounts.filter(account => account.id !== viewerAccountId && account.id !== post.authorAccountId && snapshot.subjects.find(subject => subject.id === account.subjectId)?.kind !== 'user' && canAccountAppear(snapshot, account)).slice(0, Math.floor(actorCount / 2))
  const actorKeys = [...existing.map((_, index) => `existing_${index + 1}`), ...Array.from({ length: Math.max(0, actorCount - existing.length) }, (_, index) => `new_${index + 1}`)]
  const commentSlots = Array.from({ length: commentCount + replyCount }, (_, index) => ({ commentKey: `comment_${index + 1}`, actorKey: actorKeys[index % actorKeys.length], reply: index >= commentCount }))
  const generated = await (dependencies.requestJson || requestForumJson)<{ actors?: ActorDraft[]; comments?: CommentDraft[] }>(snapshot, { userInitiated: true, viewerAccountId, postId, circleId: post.circleId, involvedAccountIds: existing.map(item => item.id) }, 'forum-comment',
    `只为当前这一篇帖子生成用户勾选的 NPC 增量互动。绝不能替 viewerAccountId=${viewerAccountId} 的用户执行任何行为。需要创建的最小 NPC：${JSON.stringify(actorKeys.filter(key => key.startsWith('new_')))}。评论槽位：${JSON.stringify(commentSlots)}。reply=true 时自然回复当前帖子已有评论或本轮较早评论。不要生成未勾选行为的正文。`,
    '{"actors":[{"actorKey":"new_1","name":"昵称","handle":"账号","avatar":"单字","bio":"简介","expressionStyle":"表达风格"}],"comments":[{"commentKey":"comment_1","actorKey":"new_1","content":"评论","parentCommentId":"可选的已有评论ID"}]}')

  const actors = new Map<string, ForumAccount>()
  existing.forEach((account, index) => actors.set(`existing_${index + 1}`, account))
  for (const key of actorKeys.filter(item => item.startsWith('new_'))) {
    const raw = generated.actors?.find(item => item.actorKey === key)
    if (!raw?.name?.trim()) throw new Error(`模型没有返回互动作者 ${key}。`)
    const subject: ForumSubject = { id: makeId('subject_light'), kind: 'npc', displayName: raw.name.trim().slice(0, 20), persona: String(raw.expressionStyle || raw.bio || '自然表达').slice(0, 240), createdAt: Date.now(), updatedAt: Date.now() }
    const baseHandle = String(raw.handle || key).trim().replace(/^@/, '').replace(/\s+/g, '_').slice(0, 28) || key
    let handle = baseHandle; let suffix = 1
    while (snapshot.accounts.some(item => item.handle.toLowerCase() === handle.toLowerCase())) handle = `${baseHandle.slice(0, 23)}_${suffix++}`
    const account: ForumAccount = { id: makeId('forum_account'), subjectId: subject.id, kind: 'main', name: subject.displayName, handle, avatar: String(raw.avatar || subject.displayName.slice(0, 1)), bio: String(raw.bio || '').slice(0, 160), privacy: 'normal', searchable: true, acceptsFollow: true, followRequiresApproval: false, acceptsDm: 'all', showInRecommendations: true, showOnline: false, showCircles: true, joinedAt: Date.now() - 86400000 * (7 + suffix), circleIds: [], lifecycle: 'lightweight', expressionStyle: String(raw.expressionStyle || '').slice(0, 240), firstSeenBatchId: batchId, lastSeenAt: Date.now(), lockedFields: [], gender: 'unknown' }
    snapshot.subjects.push(subject); snapshot.accounts.push(account); snapshot.participantPolicies.push(policyFor(subject.id)); actors.set(key, account)
  }

  const created: ForumComment[] = []
  for (const slot of commentSlots) {
    const raw = generated.comments?.find(item => item.commentKey === slot.commentKey)
    const actor = actors.get(slot.actorKey)
    if (!raw?.content?.trim() || !actor) throw new Error(`模型没有完整返回互动评论 ${slot.commentKey}。`)
    const possibleParents = [...snapshot.comments.filter(item => item.postId === postId), ...created]
    const parent = slot.reply ? possibleParents.find(item => item.id === raw.parentCommentId) || possibleParents[possibleParents.length - 1] : undefined
    created.push({ id: makeId('comment'), postId, author: userOf(actor), authorAccountId: actor.id, parentId: parent?.id, rootCommentId: parent?.rootCommentId || parent?.id, replyToCommentId: parent?.id, depth: parent ? 1 : 0, replyToUser: parent ? { id: parent.authorAccountId, name: parent.author.name } : undefined, content: raw.content.trim().slice(0, 800), likeCount: 0, createdAt: Date.now() + created.length * 1000, source: 'generated', generationBatchId: batchId })
  }
  snapshot.comments.push(...created)
  post.commentCount = snapshot.comments.filter(item => item.postId === postId).length

  const actorList = [...actors.values()].filter(actor => actor.id !== viewerAccountId)
  const naturalCount = () => Math.max(1, Math.min(actorList.length, 1 + Math.floor(Math.random() * actorList.length)))
  const requested = (custom: number) => config.countMode === 'natural' ? naturalCount() : Math.max(0, Math.round(custom))
  const addEvents = (type: string, entityId: string, count: number) => {
    let added = 0
    actorList.slice(0, count).forEach(actor => { if (!snapshot.events.some(event => event.type === type && event.actorAccountId === actor.id && event.entityId === entityId)) { snapshot.events.push({ id: makeId('event'), type, actorAccountId: actor.id, targetAccountIds: [post.authorAccountId], circleId: post.circleId, entityId, payload: {}, createdAt: Date.now() }); added += 1 } })
    return added
  }
  if (config.postLikes) post.likeCount += addEvents('npc-post-like', post.id, requested(config.postLikeCount))
  if (config.commentLikes) {
    const targets = [...snapshot.comments.filter(item => item.postId === postId)]
    let remaining = requested(config.commentLikeCount); let cursor = 0
    while (remaining > 0 && targets.length && cursor < remaining + actorList.length * targets.length) { const comment = targets[cursor % targets.length]; const actor = actorList[Math.floor(cursor / targets.length) % actorList.length]; if (actor && !snapshot.events.some(event => event.type === 'npc-comment-like' && event.actorAccountId === actor.id && event.entityId === comment.id)) { snapshot.events.push({ id: makeId('event'), type: 'npc-comment-like', actorAccountId: actor.id, targetAccountIds: [comment.authorAccountId], entityId: comment.id, payload: {}, createdAt: Date.now() }); comment.likeCount += 1; remaining -= 1 } cursor += 1 }
  }
  if (config.shares) post.shareCount += addEvents('npc-post-share', post.id, requested(config.shareCount))
  if (config.bookmarks) addEvents('npc-post-bookmark', post.id, requested(config.bookmarkCount))
  if (config.views) { const count = config.countMode === 'natural' ? Math.max(naturalCount(), Math.round(actorCount * (2 + Math.random() * 5))) : Math.max(0, Math.round(config.viewCount)); post.viewCount = (post.viewCount || 0) + count; post.effectiveViewCount = (post.effectiveViewCount || 0) + Math.round(count * .6) }
  if (config.follows) actorList.slice(0, requested(config.followCount)).forEach(actor => { if (actor.id !== post.authorAccountId && !snapshot.relationships.some(item => item.type === 'follow' && item.fromAccountId === actor.id && item.toAccountId === post.authorAccountId)) snapshot.relationships.push({ id: makeId('relationship'), fromAccountId: actor.id, toAccountId: post.authorAccountId, type: 'follow', createdAt: Date.now() }) })
  return { commentCount: created.length, actorCount: actorList.length, batchId }
}
