/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { worldBooks } from '../store'
import type { AllowedForumContext, ForumAccount, ForumCircle, ForumMemory, ForumPost, ForumSnapshot, ForumSubject } from '../types/forum'

export interface ForumContextRequest {
  userInitiated?: true
  viewerAccountId: string
  circleId?: string
  postId?: string
  involvedAccountIds?: string[]
  observerAccountId?: string
  worldBookIds?: string[]
}

/** The only supported path for constructing forum model context. */
export const buildAllowedForumContext = (snapshot: ForumSnapshot, request: ForumContextRequest): AllowedForumContext => {
  const viewer = snapshot.accounts.find(account => account.id === request.viewerAccountId)
  if (!viewer) throw new Error('当前论坛账号不存在')
  const circle = request.circleId ? snapshot.circles.find(item => item.id === request.circleId) : undefined
  const post = request.postId ? snapshot.posts.find(item => item.id === request.postId) : undefined
  const requestedAccountIds = new Set([...(request.involvedAccountIds || []), ...(post ? [post.authorAccountId] : [])])

  const subjectAllowed = (subject: ForumSubject) => {
    if (subject.kind === 'user') return true
    const policy = snapshot.participantPolicies.find(item => item.subjectId === subject.id)
    if (!policy?.enabled) return false
    if (circle) {
      if (policy.blockedCircleIds.includes(circle.id)) return false
      if (policy.allowedCircleIds.length && !policy.allowedCircleIds.includes(circle.id)) return false
      if (circle.participantSubjectIds.length && !circle.participantSubjectIds.includes(subject.id)) return false
    }
    return true
  }

  const involvedAccounts = snapshot.accounts.filter(account => requestedAccountIds.has(account.id) && subjectAllowed(snapshot.subjects.find(subject => subject.id === account.subjectId) || { id: '', kind: 'npc', displayName: '', persona: '', createdAt: 0, updatedAt: 0 }))
  const involvedSubjectIds = new Set(involvedAccounts.map(account => account.subjectId))
  const involvedSubjects = snapshot.subjects.filter(subject => involvedSubjectIds.has(subject.id) && subjectAllowed(subject)).map(({ id, kind, displayName, persona }) => ({ id, kind, displayName, persona }))

  const reachableMemories = snapshot.memories.filter(memory => {
    if (memory.subjectId && !involvedSubjectIds.has(memory.subjectId)) return false
    if (memory.circleId && memory.circleId !== circle?.id) return false
    if (memory.visibility === 'private' && memory.accountId !== (request.observerAccountId || viewer.id)) return false
    return !memory.subjectId || involvedSubjects.some(subject => subject.id === memory.subjectId)
  })

  const worldBinding = circle?.worldBindingId ? snapshot.worldBindings.find(item => item.id === circle.worldBindingId) : undefined
  const requestedWorldBookIds = request.worldBookIds === undefined
    ? worldBinding?.bookIds || []
    : request.worldBookIds
  const requestedGroupIds = request.worldBookIds === undefined ? worldBinding?.groupIds || [] : []
  const requestedEntryIds = request.worldBookIds === undefined ? worldBinding?.entryIds || [] : []
  const worldBookEntries = fitWorldBookEntries(worldBooks
    .filter(book => book.type === 'book' && book.enabled && (requestedWorldBookIds.includes(book.id) || book.groupIds?.some(id => requestedGroupIds.includes(id))))
    .flatMap(book => book.entries
      .filter(entry => entry.enabled && (!requestedEntryIds.length || requestedEntryIds.includes(entry.id)))
      .map(entry => ({ bookId: book.id, entryId: entry.id, title: entry.title, content: entry.content, weight: worldBinding?.weights[entry.id] ?? entry.weight * book.globalWeight })))
    .sort((a, b) => b.weight - a.weight), snapshot.settings.aiContextTokenBudget)

  const involvedPersonas = snapshot.personas
    .filter(persona => requestedAccountIds.has(persona.accountId))
    .map(({ accountId, identity, personality, occupation, interests, boundaries, postingStyle, emojiStyle, punctuationStyle, activeHours }) => ({ accountId, identity, personality, occupation, interests, boundaries, postingStyle, emojiStyle, punctuationStyle, activeHours }))
  const recentPosts = snapshot.posts
    .filter(item => requestedAccountIds.has(item.authorAccountId))
    .sort((a, b) => Number(b.createdAt) - Number(a.createdAt))
    .slice(0, 24)
    .map(({ authorAccountId, content, topics, createdAt }) => ({ authorAccountId, content, topics, createdAt }))

  return {
    viewerAccount: viewer,
    circle,
    worldBookEntries,
    eventPost: post ? pickPost(post) : undefined,
    involvedAccounts,
    involvedSubjects,
    involvedPersonas,
    recentPosts,
    reachableMemories,
    anonymousActors: post?.anonymousIdentityId ? [{ anonymousIdentityId: post.anonymousIdentityId, label: anonymousLabel(snapshot, post.anonymousIdentityId) }] : []
  }
}

const fitWorldBookEntries = <T extends { content: string }>(entries: T[], tokenBudget: number): T[] => {
  let remaining = Math.max(1600, Math.min(16000, Math.floor(tokenBudget * 2)))
  const fitted: T[] = []
  for (const entry of entries) {
    if (remaining <= 0) break
    const content = entry.content.trim()
    if (!content) continue
    const clipped = content.slice(0, remaining)
    fitted.push({ ...entry, content: clipped })
    remaining -= clipped.length
  }
  return fitted
}

const pickPost = (post: ForumPost) => ({ id: post.id, authorAccountId: post.authorAccountId, circleId: post.circleId, type: post.type, content: post.content, topics: post.topics })
const anonymousLabel = (snapshot: ForumSnapshot, id: string) => {
  const identity = snapshot.anonymousIdentities.find(item => item.id === id)
  return identity ? `匿名用户 ${identity.anonymousCode}` : '匿名用户'
}

export const canAccountAppear = (snapshot: ForumSnapshot, account: ForumAccount, circle?: ForumCircle) => {
  if (account.isArchived) return false
  const subject = snapshot.subjects.find(item => item.id === account.subjectId)
  if (!subject) return false
  if (subject.kind === 'user') return true
  const policy = snapshot.participantPolicies.find(item => item.subjectId === subject.id)
  if (!policy?.enabled) return false
  if (!circle) return policy.allowPublicDiscovery
  return !policy.blockedCircleIds.includes(circle.id)
    && (!policy.allowedCircleIds.length || policy.allowedCircleIds.includes(circle.id))
    && (!circle.participantSubjectIds.length || circle.participantSubjectIds.includes(subject.id))
}

export const visiblePostsFor = (snapshot: ForumSnapshot, viewerAccountId: string, circleId?: string) => {
  const blocked = new Set(snapshot.blocks.filter(rule => rule.ownerAccountId === viewerAccountId || rule.targetAccountId === viewerAccountId).map(rule => rule.ownerAccountId === viewerAccountId ? rule.targetAccountId : rule.ownerAccountId))
  const mutedAccounts = new Set(snapshot.mutes.filter(rule => rule.ownerAccountId === viewerAccountId && (!rule.expiresAt || rule.expiresAt > Date.now())).map(rule => rule.targetAccountId).filter(Boolean))
  const mutedCircles = new Set(snapshot.mutes.filter(rule => rule.ownerAccountId === viewerAccountId && (!rule.expiresAt || rule.expiresAt > Date.now())).map(rule => rule.circleId).filter(Boolean))
  return snapshot.posts.filter(post => {
    if (circleId && post.circleId !== circleId) return false
    if (blocked.has(post.authorAccountId) || mutedAccounts.has(post.authorAccountId) || (post.circleId && mutedCircles.has(post.circleId))) return false
    const account = snapshot.accounts.find(item => item.id === post.authorAccountId)
    const circle = post.circleId ? snapshot.circles.find(item => item.id === post.circleId) : undefined
    if (!account || !canAccountAppear(snapshot, account, circle)) return false
    if (post.visibility === 'private' && post.authorAccountId !== viewerAccountId) return false
    if (post.visibility === 'custom' && post.authorAccountId !== viewerAccountId && !post.visibleToAccountIds?.includes(viewerAccountId)) return false
    if (snapshot.visibilityRules.some(rule => rule.ownerAccountId === post.authorAccountId && rule.targetAccountId === viewerAccountId && (rule.scopes.includes('all') || rule.postIds?.includes(post.id) || (post.circleId && rule.circleIds?.includes(post.circleId))))) return false
    return true
  })
}

export const sanitizeAllowedContext = (context: AllowedForumContext) => JSON.parse(JSON.stringify(context)) as AllowedForumContext
export const assertNoDisabledSubjects = (snapshot: ForumSnapshot, context: AllowedForumContext) => {
  const disabledIds = new Set(snapshot.participantPolicies.filter(policy => !policy.enabled).map(policy => policy.subjectId))
  if (context.involvedSubjects.some(subject => disabledIds.has(subject.id)) || context.reachableMemories.some((memory: ForumMemory) => memory.subjectId && disabledIds.has(memory.subjectId))) throw new Error('论坛上下文包含未参与角色')
}
