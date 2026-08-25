/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { listCurrentChatCharacterDirectory, refreshCharacterDirectoryFromAllAccounts } from './characterDirectory'
import type { ForumAccount, ForumParticipantPolicy, ForumSnapshot, ForumUser } from '../types/forum'

const makeId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

const defaultPolicy = (subjectId: string, enabled = true): ForumParticipantPolicy => ({
  id: makeId('participant'), subjectId, enabled, allowedCircleIds: [], blockedCircleIds: [], allowedAccountIds: [], allowedGroupIds: [], scope: ['global', 'circle', 'following-feed', 'passive', 'post'],
  allowPublicDiscovery: true, allowNpcKnowledge: true, allowMention: true, allowSearch: true, allowRecommendation: true, allowDm: true, allowGroup: true,
  autonomy: { level: 'off', actions: {} }, updatedAt: Date.now()
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

const createCharacterAccount = (snapshot: ForumSnapshot, entry: ReturnType<typeof listCurrentChatCharacterDirectory>[number]) => {
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
    const persona = snapshot.personas.find(item => item.accountId === account!.id)
    if (persona) { persona.identity = account.bio; persona.personality = entry.persona }
  }
  if (!snapshot.bridgePolicies.some(item => item.subjectId === subject!.id)) snapshot.bridgePolicies.push({ id: makeId('bridge'), subjectId: subject.id, forumToChat: { mode: 'important', memoryTypes: ['post', 'comment', 'relationship', 'important-event'] }, chatToForum: { mode: 'reachable-only', memoryTypes: ['chat-daily', 'important-event', 'relationship'] }, updatedAt: Date.now() })
  return account
}

export const syncForumCharacters = (snapshot: ForumSnapshot) => {
  refreshCharacterDirectoryFromAllAccounts()
  const entries = listCurrentChatCharacterDirectory()
  const activeSourceIds = new Set(entries.map(entry => entry.entityId))
  snapshot.subjects.filter(subject => subject.kind === 'character' && subject.sourceId && !activeSourceIds.has(subject.sourceId)).forEach(subject => {
    const policy = snapshot.participantPolicies.find(item => item.subjectId === subject.id)
    if (policy && (policy.enabled || policy.autonomy.level !== 'off' || Object.keys(policy.autonomy.actions).length)) {
      policy.enabled = false
      policy.autonomy = { level: 'off', actions: {} }
      policy.updatedAt = Date.now()
    }
  })
  return entries.map(entry => createCharacterAccount(snapshot, entry))
}

const uniqueHandle = (snapshot: ForumSnapshot, value: string) => {
  const base = String(value || '').trim().replace(/^@/, '').replace(/[^\p{L}\p{N}_-]+/gu, '_').replace(/^_+|_+$/g, '').slice(0, 28) || `nrj_${Date.now().toString(36)}`
  let result = base; let index = 1
  while (snapshot.accounts.some(item => item.handle.toLowerCase() === result.toLowerCase())) result = `${base.slice(0, 24)}_${index++}`
  return result
}
