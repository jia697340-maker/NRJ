/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { requestForumJson } from './forumAI'
import { canAccountAppear } from './forumPolicy'
import type { ForumAccount, ForumComment, ForumPost, ForumReplyTimingMode, ForumSnapshot, ForumUser } from '../types/forum'

const makeId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
const userOf = (account: ForumAccount): ForumUser => ({ ...account, followersCount: 0, followingCount: 0, postsCount: 0, likesCount: 0 })
type CommunityAction = 'reply' | 'like' | 'reply-and-like' | 'none'
type CommunityDecision = { action?: CommunityAction; actorAccountId?: string; content?: string; timing?: 'immediate' | 'delayed'; activity?: string; delayMinutes?: number; reason?: string }

const textTokens = (value: string) => new Set(value.toLowerCase().split(/[\s,，。！？!?、#@：:；;（）()\[\]【】]+/).filter(item => item.length >= 2))
const overlapScore = (source: Set<string>, values: string[]) => values.reduce((score, value) => {
  const normalized = value.toLowerCase()
  return score + ([...source].some(token => normalized.includes(token) || token.includes(normalized)) ? 8 : 0)
}, 0)

export const selectCommunityResponseCandidates = (snapshot: ForumSnapshot, viewerAccountId: string, post: ForumPost, userComment: ForumComment) => {
  const circle = post.circleId ? snapshot.circles.find(item => item.id === post.circleId) : undefined
  const blockedAccountIds = new Set(snapshot.blocks.filter(rule => rule.ownerAccountId === viewerAccountId || rule.targetAccountId === viewerAccountId).map(rule => rule.ownerAccountId === viewerAccountId ? rule.targetAccountId : rule.ownerAccountId))
  const postComments = snapshot.comments.filter(item => item.postId === post.id && item.id !== userComment.id)
  const participantIds = new Set(postComments.map(item => item.authorAccountId))
  const topicTokens = textTokens(`${post.title || ''} ${post.content} ${(post.topics || []).join(' ')} ${userComment.content} ${circle?.tags.join(' ') || ''}`)
  const lastActors = snapshot.events
    .filter(event => event.type === 'community-comment-response' && event.entityId === post.id)
    .sort((a, b) => b.createdAt - a.createdAt).slice(0, 3).map(event => event.actorAccountId)

  return snapshot.accounts
    .filter(account => {
      if (account.id === viewerAccountId || account.isArchived || blockedAccountIds.has(account.id) || !canAccountAppear(snapshot, account, circle)) return false
      if (post.anonymousIdentityId && account.id === post.authorAccountId) return false
      return snapshot.subjects.find(subject => subject.id === account.subjectId)?.kind !== 'user'
    })
    .map(account => {
      const persona = snapshot.personas.find(item => item.accountId === account.id)
      const resident = snapshot.residentProfiles.find(item => item.accountId === account.id)
      const samePostCount = postComments.filter(item => item.authorAccountId === account.id).length
      const isAuthor = account.id === post.authorAccountId
      const participated = participantIds.has(account.id)
      const circleRelated = Boolean(circle && (account.circleIds.includes(circle.id) || resident?.homeCircleIds.includes(circle.id)))
      const interests = [...(persona?.interests || []), ...(resident?.interests || []), account.bio || '', ...(account.backgroundHints || [])]
      let score = isAuthor ? 110 : participated ? 78 : circleRelated ? 52 : 30
      score += overlapScore(topicTokens, interests)
      score += Math.round(((persona?.socialInitiative ?? resident?.socialInitiative ?? 45) - 45) / 5)
      score -= samePostCount * 15
      score -= lastActors.filter(id => id === account.id).length * 18
      return { account, score, isAuthor, participated, circleRelated, samePostCount, persona, resident }
    })
    .filter(item => item.isAuthor || item.participated || item.circleRelated || item.score >= 34)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
}

const removePreviousCommunityResponse = (snapshot: ForumSnapshot, comment: ForumComment) => {
  const removableIds = new Set(snapshot.comments.filter(item =>
    item.communityResponseForCommentId === comment.id
    || (item.source === 'generated' && item.replyToCommentId === comment.id && !item.generationBatchId)
  ).map(item => item.id))
  snapshot.comments = snapshot.comments.filter(item => !removableIds.has(item.id))
  const likeEvents = snapshot.events.filter(event => event.type === 'npc-comment-like' && event.entityId === comment.id && event.payload.origin === 'community-response')
  comment.likeCount = Math.max(0, comment.likeCount - likeEvents.length)
  snapshot.events = snapshot.events.filter(event => !removableIds.has(String(event.payload.responseCommentId || '')) && !(event.type === 'npc-comment-like' && event.entityId === comment.id && event.payload.origin === 'community-response'))
  snapshot.notifications = snapshot.notifications.filter(item => !removableIds.has(item.entityId || '') && !(item.entityId === comment.id && item.type === 'like' && likeEvents.some(event => event.actorAccountId === item.actorAccountId)))
}

export const generateCommunityCommentResponse = async (
  snapshot: ForumSnapshot,
  viewerAccountId: string,
  postId: string,
  commentId: string,
  options: { mode?: 'automatic' | 'regenerate'; timing?: ForumReplyTimingMode } = {},
  dependencies: { requestJson?: typeof requestForumJson; random?: () => number } = {}
) => {
  const post = snapshot.posts.find(item => item.id === postId)
  const userComment = snapshot.comments.find(item => item.id === commentId && item.postId === postId)
  if (!post || !userComment || userComment.authorAccountId !== viewerAccountId) throw new Error('这条评论不存在，或不属于当前账号。')
  const candidates = selectCommunityResponseCandidates(snapshot, viewerAccountId, post, userComment)
  if (!candidates.length) return { action: 'none' as const, commentCount: 0, likeCount: 0 }

  const mode = options.mode || 'automatic'
  const timing = options.timing || snapshot.settings.defaultReplyTiming || 'immediate'
  if (mode === 'automatic') {
    const initiatives = candidates.map(item => item.persona?.socialInitiative ?? item.resident?.socialInitiative ?? 45)
    const averageInitiative = initiatives.reduce((sum, value) => sum + value, 0) / initiatives.length
    const invitesConversation = /[?？]|怎么|为什么|请问|求助|谁知道|有人/.test(userComment.content)
    const veryBrief = userComment.content.trim().length <= 5
    const silenceChance = Math.max(0.08, Math.min(0.3, (invitesConversation ? 0.1 : veryBrief ? 0.26 : 0.18) - (averageInitiative - 45) / 500))
    if ((dependencies.random || Math.random)() < silenceChance) return { action: 'none' as const, commentCount: 0, likeCount: 0 }
  }
  const existingContext = snapshot.comments.filter(item => item.postId === postId && item.id !== commentId).slice(-12).map(item => ({ id: item.id, authorAccountId: item.authorAccountId, replyToCommentId: item.replyToCommentId, content: item.content }))
  const previousResponses = snapshot.comments.filter(item => item.replyToCommentId === commentId && item.source === 'generated').map(item => item.content).slice(-3)
  const candidateContext = candidates.map(({ account, isAuthor, participated, circleRelated, samePostCount, persona, resident }) => ({
    actorAccountId: account.id, name: account.name, role: isAuthor ? '帖子作者' : participated ? '已参与评论的人' : circleRelated ? '与圈子有关的可见账号' : '话题匹配的可见账号',
    bio: account.bio, expressionStyle: account.expressionStyle, persona: persona ? { identity: persona.identity, personality: persona.personality, occupation: persona.occupation, interests: persona.interests, boundaries: persona.boundaries, commentingStyle: persona.commentingStyle, emojiStyle: persona.emojiStyle, punctuationStyle: persona.punctuationStyle, socialInitiative: persona.socialInitiative } : undefined,
    resident: resident ? { interests: resident.interests, avoidedTopics: resident.avoidedTopics, commentTendency: resident.commentTendency, socialInitiative: resident.socialInitiative, averageLength: resident.averageLength, commonWords: resident.commonWords, avoidedPhrases: resident.avoidedPhrases } : undefined,
    commentsAlreadyInPost: samePostCount
  }))
  const forceReply = mode === 'regenerate'
  const generated = await (dependencies.requestJson || requestForumJson)<CommunityDecision>(snapshot, { userInitiated: true, viewerAccountId, postId, circleId: post.circleId, involvedAccountIds: candidates.map(item => item.account.id) }, 'forum-comment',
    `这是用户刚发表一条评论后的局部社区事件，不是整篇评论区刷新。原帖：${JSON.stringify({ authorAccountId: post.authorAccountId, title: post.title, content: post.content, topics: post.topics })}\n用户评论：${JSON.stringify({ id: userComment.id, content: userComment.content })}\n必要的已有评论上下文：${JSON.stringify(existingContext)}\n候选回应者（只能从中选一个）：${JSON.stringify(candidateContext)}\n${forceReply ? `用户不满意先前回应，正在主动请求换一个自然回复。action 必须是 reply 或 reply-and-like；避免重复这些旧表述：${JSON.stringify(previousResponses)}。可以换更合适的候选人。` : '请判断真实社交中是否会有后续。普通陈述允许无人回应；但用户主动参与被看见的概率应明显高于 NPC 随机互动。action 可为 reply、like、reply-and-like、none。绝大多数只产生一个动作，最多用 reply-and-like 表示两个动作。不要默认帖主，不要客服式有问必答，也不要为了互动硬回复。'}\n${timing === 'presence-aware' ? '若需要回复，可结合人物状态选择 immediate 或 delayed；延迟时仍须现在给出最终内容、activity 和 delayMinutes。' : '需要回复时 timing 使用 immediate。'} actorAccountId 必须是候选列表中的实际 ID。只有 reply 类 action 才填写 content。reason 只需一句内部判定依据。`,
    '{"action":"reply|like|reply-and-like|none","actorAccountId":"候选实际ID","content":"需要回复时的自然内容","timing":"immediate|delayed","activity":"延迟状态","delayMinutes":30,"reason":"简短依据"}')

  const action = String(generated.action || 'none') as CommunityAction
  if (!['reply', 'like', 'reply-and-like', 'none'].includes(action)) throw new Error('社区回应判定无效，请重试。')
  if (action === 'none') return { action, commentCount: 0, likeCount: 0 }
  const actor = candidates.find(item => item.account.id === generated.actorAccountId)?.account
  if (!actor) throw new Error('社区回应选择了不可用的账号，请重试。')
  const needsReply = action === 'reply' || action === 'reply-and-like'
  const content = String(generated.content || '').trim().slice(0, 800)
  if (needsReply && !content) throw new Error('社区没有返回有效回复，请重试。')

  if (mode === 'regenerate') removePreviousCommunityResponse(snapshot, userComment)
  const requestId = makeId('community_response')
  let responseComment: ForumComment | undefined
  if (needsReply) {
    const delayed = timing === 'presence-aware' && generated.timing === 'delayed'
    const delayMinutes = Math.max(1, Math.min(1440, Number(generated.delayMinutes || 30)))
    responseComment = {
      id: makeId('comment'), postId, author: userOf(actor), authorAccountId: actor.id,
      parentId: userComment.parentId || userComment.id, rootCommentId: userComment.rootCommentId || userComment.id,
      replyToCommentId: userComment.id, depth: 1, replyToUser: { id: userComment.authorAccountId, name: userComment.author.name },
      content, likeCount: 0, createdAt: Date.now(), source: 'generated', communityResponseForCommentId: userComment.id, communityResponseRequestId: requestId,
      revealAt: delayed ? Date.now() + delayMinutes * 60000 : undefined,
      availabilityText: delayed ? `${String(generated.activity || '暂时没看论坛').slice(0, 80)}，预计约 ${Math.round(delayMinutes)} 分钟后回复` : undefined
    }
    snapshot.comments.push(responseComment)
    if (!responseComment.revealAt) snapshot.notifications.push({ id: makeId('notification'), accountId: viewerAccountId, type: 'reply', actorAccountId: actor.id, entityId: responseComment.id, text: `${actor.name}回复了你的评论`, createdAt: Date.now() })
  }
  const needsLike = action === 'like' || action === 'reply-and-like'
  if (needsLike && !snapshot.events.some(event => event.type === 'npc-comment-like' && event.actorAccountId === actor.id && event.entityId === userComment.id)) {
    snapshot.events.push({ id: makeId('event'), type: 'npc-comment-like', actorAccountId: actor.id, targetAccountIds: [viewerAccountId], circleId: post.circleId, entityId: userComment.id, payload: { origin: 'community-response', requestId }, createdAt: Date.now() })
    userComment.likeCount += 1
    snapshot.notifications.push({ id: makeId('notification'), accountId: viewerAccountId, type: 'like', actorAccountId: actor.id, entityId: userComment.id, text: `${actor.name}赞了你的评论`, createdAt: Date.now() })
  }
  snapshot.events.push({ id: makeId('event'), type: 'community-comment-response', actorAccountId: actor.id, targetAccountIds: [viewerAccountId], circleId: post.circleId, entityId: post.id, payload: { action, userCommentId: userComment.id, responseCommentId: responseComment?.id, requestId, reason: String(generated.reason || '').slice(0, 160) }, createdAt: Date.now() })
  post.commentCount = snapshot.comments.filter(item => item.postId === postId).length
  return { action, actorAccountId: actor.id, responseComment, commentCount: responseComment ? 1 : 0, likeCount: needsLike ? 1 : 0 }
}
