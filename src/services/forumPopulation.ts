import { listCharacterDirectory, refreshCharacterDirectoryFromAllAccounts } from './characterDirectory'
import type { ForumAccount, ForumParticipantPolicy, ForumResidentProfile, ForumSnapshot, ForumUser } from '../types/forum'

const makeId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
const hash = (value: string) => Array.from(value).reduce((score, char) => ((score << 5) - score + char.charCodeAt(0)) | 0, 0) >>> 0
const bounded = (seed: number, min: number, span: number) => min + seed % span
const unique = <T>(values: T[]) => [...new Set(values)]

const defaultPolicy = (subjectId: string, enabled = true): ForumParticipantPolicy => ({
  id: makeId('participant'), subjectId, enabled, allowedCircleIds: [], blockedCircleIds: [], allowedAccountIds: [], allowedGroupIds: [], scope: ['global', 'circle', 'following-feed', 'passive', 'post'],
  allowPublicDiscovery: true, allowNpcKnowledge: true, allowMention: true, allowSearch: true, allowRecommendation: true, allowDm: true, allowGroup: true,
  autonomy: { level: enabled ? 'normal' : 'off', actions: { post: enabled, comment: enabled, like: enabled, follow: enabled, replyDm: enabled } }, updatedAt: Date.now()
})

export const projectForumUser = (snapshot: ForumSnapshot, account: ForumAccount): ForumUser => ({
  ...account,
  followersCount: snapshot.relationships.filter(item => item.type === 'follow' && item.toAccountId === account.id).length,
  followingCount: snapshot.relationships.filter(item => item.type === 'follow' && item.fromAccountId === account.id).length,
  postsCount: snapshot.posts.filter(item => item.authorAccountId === account.id).length,
  likesCount: snapshot.posts.filter(item => item.authorAccountId === account.id).reduce((sum, item) => sum + item.likeCount, 0),
  joinedDate: new Date(account.joinedAt).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long' }),
  isFollowing: snapshot.relationships.some(item => item.type === 'follow' && item.fromAccountId === snapshot.settings.activeAccountId && item.toAccountId === account.id)
})

export const ensureResidentProfile = (snapshot: ForumSnapshot, account: ForumAccount, origin: ForumResidentProfile['origin'] = 'ambient') => {
  const existing = snapshot.residentProfiles.find(item => item.accountId === account.id)
  if (existing) return existing
  const persona = snapshot.personas.find(item => item.accountId === account.id)
  const seed = hash(`${account.subjectId}:${account.handle}`)
  const activeStart = bounded(seed, 6, 15)
  const activeEnd = (activeStart + bounded(seed >> 2, 7, 8)) % 24
  const profile: ForumResidentProfile = {
    id: makeId('resident'), subjectId: account.subjectId, accountId: account.id, origin,
    browsingPatience: bounded(seed, 35, 56), likeTendency: bounded(seed >> 2, 18, 60), commentTendency: bounded(seed >> 4, 8, 48), followTendency: bounded(seed >> 6, 5, 35), socialInitiative: persona?.socialInitiative ?? bounded(seed >> 8, 20, 65), strangerTrust: bounded(seed >> 10, 16, 58), conflictTolerance: bounded(seed >> 12, 20, 65), trendSensitivity: bounded(seed >> 14, 12, 70), privacySensitivity: bounded(seed >> 16, 25, 66),
    activeHours: [activeStart, activeEnd], homeCircleIds: [...account.circleIds], interests: unique(persona?.interests || []), avoidedTopics: [...(persona?.boundaries || [])],
    averageLength: seed % 3 === 0 ? 'short' : seed % 3 === 1 ? 'medium' : 'long', punctuationStyle: persona?.punctuationStyle || (seed % 2 ? '句尾不总加标点，停顿自然' : '标点完整，很少连续感叹'), emojiFrequency: seed % 5 === 0 ? 'medium' : seed % 2 ? 'low' : 'none', commonWords: [], avoidedPhrases: ['作为一个', '值得一提的是', '期待更多精彩内容'], recentSamples: [], createdAt: Date.now(), updatedAt: Date.now()
  }
  snapshot.residentProfiles.push(profile)
  return profile
}

const createCharacterAccount = (snapshot: ForumSnapshot, entry: ReturnType<typeof listCharacterDirectory>[number]) => {
  let subject = snapshot.subjects.find(item => item.kind === 'character' && item.sourceId === entry.entityId)
  if (!subject) {
    subject = { id: makeId('subject_character'), kind: 'character', sourceId: entry.entityId, sourceAccountId: entry.ownerAccountId, displayName: entry.socialProfile?.nickname || entry.name, persona: entry.persona, avatarKey: entry.avatarKey, createdAt: Date.now(), updatedAt: Date.now() }
    snapshot.subjects.push(subject)
  } else {
    subject.displayName = entry.socialProfile?.nickname || entry.name
    subject.persona = entry.persona
    subject.avatarKey = entry.avatarKey
    subject.updatedAt = Date.now()
  }
  let policy = snapshot.participantPolicies.find(item => item.subjectId === subject!.id)
  if (!policy) { policy = defaultPolicy(subject.id); snapshot.participantPolicies.push(policy) }
  let account = snapshot.accounts.find(item => item.subjectId === subject!.id && item.kind === 'main')
  if (!account) {
    account = { id: makeId('forum_account'), subjectId: subject.id, kind: 'main', name: entry.socialProfile?.nickname || entry.name, handle: uniqueHandle(snapshot, entry.socialProfile?.socialId || entry.name), avatar: '', bio: entry.socialProfile?.signature || '', privacy: 'normal', searchable: entry.discoverable !== false, acceptsFollow: true, followRequiresApproval: false, acceptsDm: 'all', showInRecommendations: true, showOnline: true, showCircles: true, joinedAt: Date.now(), circleIds: [], lifecycle: 'character' }
    snapshot.accounts.push(account)
    const personaId = makeId('forum_persona')
    account.personaId = personaId
    snapshot.personas.push({ id: personaId, accountId: account.id, identity: account.bio, personality: entry.persona, interests: [], boundaries: [], socialInitiative: 50, activeHours: [], habits: {}, lockedFields: [] })
  } else {
    account.lifecycle = 'character'
    account.name = entry.socialProfile?.nickname || entry.name
    account.handle = entry.socialProfile?.socialId || account.handle
    account.bio = entry.socialProfile?.signature || account.bio
  }
  if (!snapshot.bridgePolicies.some(item => item.subjectId === subject!.id)) snapshot.bridgePolicies.push({ id: makeId('bridge'), subjectId: subject.id, forumToChat: { mode: 'important', memoryTypes: ['post', 'comment', 'relationship', 'important-event'] }, chatToForum: { mode: 'reachable-only', memoryTypes: ['chat-daily', 'important-event', 'relationship'] }, updatedAt: Date.now() })
  ensureResidentProfile(snapshot, account, 'character')
  return account
}

export const syncForumCharacters = (snapshot: ForumSnapshot) => {
  refreshCharacterDirectoryFromAllAccounts()
  return listCharacterDirectory().map(entry => createCharacterAccount(snapshot, entry))
}

const uniqueHandle = (snapshot: ForumSnapshot, value: string) => {
  const base = String(value || '').trim().replace(/^@/, '').replace(/[^\p{L}\p{N}_-]+/gu, '_').replace(/^_+|_+$/g, '').slice(0, 28) || `nrj_${Date.now().toString(36)}`
  let result = base; let index = 1
  while (snapshot.accounts.some(item => item.handle.toLowerCase() === result.toLowerCase())) result = `${base.slice(0, 24)}_${index++}`
  return result
}
