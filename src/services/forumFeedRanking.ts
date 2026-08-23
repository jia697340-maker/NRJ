import { canAccountAppear } from './forumPolicy'
import type { ForumExposure, ForumPost, ForumSnapshot } from '../types/forum'

export type ForumFeedKind = 'recommend' | 'following' | 'latest'

const timestamp = (post: ForumPost) => typeof post.createdAt === 'number' ? post.createdAt : new Date(post.createdAt).getTime() || 0
const joinedCircleIds = (snapshot: ForumSnapshot, viewerId: string) => new Set(snapshot.memberships.filter(item => item.accountId === viewerId && ['owner', 'admin', 'member'].includes(item.role)).map(item => item.circleId))

export const canViewForumPost = (snapshot: ForumSnapshot, post: ForumPost, viewerId: string) => {
  if (post.authorAccountId === viewerId) return true
  const account = snapshot.accounts.find(item => item.id === post.authorAccountId)
  const circle = post.circleId ? snapshot.circles.find(item => item.id === post.circleId) : undefined
  if (!account || account.isArchived || !canAccountAppear(snapshot, account, circle)) return false
  if (post.circleId && circle) {
    const joined = joinedCircleIds(snapshot, viewerId).has(post.circleId)
    if (!circle.isPublic && !joined) return false
    if (['invite', 'password', 'specified-account', 'specified-character', 'hidden'].includes(circle.joinMode) && !joined) return false
  }
  if (post.visibility === 'private') return false
  if (post.visibility === 'custom') return Boolean(post.visibleToAccountIds?.includes(viewerId))
  const follows = snapshot.relationships.some(item => item.type === 'follow' && item.fromAccountId === viewerId && item.toAccountId === post.authorAccountId)
  if (post.visibility === 'followers') return follows
  if (post.visibility === 'mutual') return follows && snapshot.relationships.some(item => item.type === 'follow' && item.fromAccountId === post.authorAccountId && item.toAccountId === viewerId)
  if (post.visibility === 'circle') return Boolean(post.circleId && (circle?.isPublic || joinedCircleIds(snapshot, viewerId).has(post.circleId)))
  return true
}

const recommendationScore = (snapshot: ForumSnapshot, post: ForumPost, viewerId: string) => {
  const now = Date.now()
  const ageHours = Math.max(.08, (now - timestamp(post)) / 3600000)
  const freshness = 20 / Math.pow(ageHours + 1.6, .62)
  const engagement = Math.log1p(post.likeCount + post.commentCount * 2.5 + post.shareCount * 3.2) * 2.2
  const follows = snapshot.relationships.some(item => item.type === 'follow' && item.fromAccountId === viewerId && item.toAccountId === post.authorAccountId) ? 8 : 0
  const edge = snapshot.relationshipEdges.find(item => item.fromAccountId === viewerId && item.toAccountId === post.authorAccountId)
  const relationship = edge ? edge.familiarity * .08 + edge.affinity * .06 + edge.trust * .04 - edge.tension * .08 : 0
  const viewerProfile = snapshot.residentProfiles.find(item => item.accountId === viewerId)
  const topicText = `${post.topics?.join(' ') || ''} ${post.content}`.toLowerCase()
  const interest = (viewerProfile?.interests || []).reduce((score, item) => score + (item && topicText.includes(item.toLowerCase()) ? 4 : 0), 0)
  const circleAffinity = post.circleId && joinedCircleIds(snapshot, viewerId).has(post.circleId) ? 6 : 0
  const recentExposures = snapshot.exposures.filter(item => item.viewerAccountId === viewerId && item.postId === post.id && now - item.shownAt < 7 * 86400000)
  const exposurePenalty = Math.min(12, recentExposures.length * 4)
  const authorRepetition = snapshot.exposures.filter(item => item.viewerAccountId === viewerId && now - item.shownAt < 12 * 3600000).slice(-30).reduce((count, item) => count + (snapshot.posts.find(post => post.id === item.postId)?.authorAccountId === post.authorAccountId ? 1 : 0), 0)
  const discovery = !follows && !edge ? 2.5 : 0
  return freshness + engagement + follows + relationship + interest + circleAffinity + discovery - exposurePenalty - Math.max(0, authorRepetition - 2) * 2
}

export const rankForumFeed = (snapshot: ForumSnapshot, viewerId: string, kind: ForumFeedKind) => {
  const blocked = new Set(snapshot.blocks.filter(item => item.ownerAccountId === viewerId || item.targetAccountId === viewerId).map(item => item.ownerAccountId === viewerId ? item.targetAccountId : item.ownerAccountId))
  const muted = new Set(snapshot.mutes.filter(item => item.ownerAccountId === viewerId && (!item.expiresAt || item.expiresAt > Date.now())).map(item => item.targetAccountId).filter(Boolean))
  const visible = snapshot.posts.filter(post => !blocked.has(post.authorAccountId) && !muted.has(post.authorAccountId) && canViewForumPost(snapshot, post, viewerId))
  if (kind === 'following') {
    const following = new Set(snapshot.relationships.filter(item => item.type === 'follow' && item.fromAccountId === viewerId).map(item => item.toAccountId))
    return visible.filter(post => post.authorAccountId === viewerId || following.has(post.authorAccountId)).sort((a, b) => timestamp(b) - timestamp(a))
  }
  if (kind === 'latest') return visible.sort((a, b) => timestamp(b) - timestamp(a))
  return visible.map(post => ({ post, score: recommendationScore(snapshot, post, viewerId) })).sort((a, b) => b.score - a.score).map(item => item.post)
}

export const recordFeedExposure = (snapshot: ForumSnapshot, viewerId: string, posts: ForumPost[], source: ForumFeedKind | 'circle') => {
  const now = Date.now()
  posts.slice(0, 10).forEach(post => {
    if (snapshot.exposures.some(item => item.viewerAccountId === viewerId && item.postId === post.id && now - item.shownAt < 10 * 60000)) return
    const exposure: ForumExposure = { id: `exposure_${now}_${Math.random().toString(36).slice(2, 7)}`, viewerAccountId: viewerId, postId: post.id, source: source === 'following' ? 'following' : source, shownAt: now, attention: 'shown', dwellMs: 0, openedPost: false, openedProfile: false }
    snapshot.exposures.push(exposure)
  })
  if (snapshot.exposures.length > 1200) snapshot.exposures.splice(0, snapshot.exposures.length - 1200)
}

export const markPostOpened = (snapshot: ForumSnapshot, viewerId: string, postId: string) => {
  const existing = [...snapshot.exposures].reverse().find(item => item.viewerAccountId === viewerId && item.postId === postId)
  if (existing) { existing.attention = 'deep-read'; existing.openedPost = true }
}
