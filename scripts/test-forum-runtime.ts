import assert from 'node:assert/strict'

const memory = new Map<string, string>()
Object.defineProperty(globalThis, 'localStorage', { value: { getItem: (key: string) => memory.get(key) ?? null, setItem: (key: string, value: string) => memory.set(key, value), removeItem: (key: string) => memory.delete(key), key: (index: number) => [...memory.keys()][index] ?? null, clear: () => memory.clear(), get length() { return memory.size } } })

const { emptyForumSnapshot, normalizeForumSnapshot } = await import('../src/services/forumRepository')
const { ensureResidentProfile } = await import('../src/services/forumPopulation')
const { canViewForumPost, rankForumFeed, recordFeedExposure } = await import('../src/services/forumFeedRanking')

const now = Date.now()
const migrated = normalizeForumSnapshot({
  version: 1,
  settings: { initialized: true, activeAccountId: 'viewer', defaultSquareEnabled: false, generateStrangers: true, manualGenerationOnly: true, aiBatchSize: 6, aiContextTokenBudget: 5000, createdAt: now, updatedAt: now },
  circles: [{ id: 'legacy-circle', name: '厨房', avatar: '厨', description: '聊做饭', rules: [], tags: [], creatorAccountId: 'viewer', administratorAccountIds: ['viewer'], memberCount: 1, activityScore: 0, searchable: true, isPublic: true, joinMode: 'public', contentPermissions: ['text'], anonymousMode: 'disabled', adminCanResolveAnonymous: false, allowPoll: false, allowLottery: false, mediaPermissions: [], participantSubjectIds: [], aiPopulation: 0, aiActivity: 'normal', createdAt: now }]
} as never)
assert.equal(migrated.version, 3)
assert.equal(migrated.circles[0].contentScope, '聊做饭')
assert.equal(migrated.settings.autonomousCommunity, false)
assert.equal(migrated.settings.manualGenerationOnly, true)
assert.ok(Array.isArray(migrated.residentProfiles) && Array.isArray(migrated.exposures) && Array.isArray(migrated.scheduledActions) && Array.isArray(migrated.generationSessions) && Array.isArray(migrated.contentBatches))

const snapshot = emptyForumSnapshot()
snapshot.settings.initialized = true
snapshot.settings.activeAccountId = 'viewer'
const subject = (id: string, kind: 'user' | 'npc' = 'npc') => ({ id: `subject-${id}`, kind, displayName: id, persona: `${id}的稳定生活背景`, createdAt: now, updatedAt: now })
const account = (id: string, kind: 'user' | 'npc' = 'npc') => ({ id, subjectId: `subject-${id}`, kind: 'main' as const, name: id, handle: id, avatar: '', privacy: 'public' as const, searchable: true, acceptsFollow: true, followRequiresApproval: false, acceptsDm: 'all' as const, showInRecommendations: true, showOnline: true, showCircles: true, joinedAt: now, circleIds: [] })
snapshot.subjects.push(subject('viewer', 'user'))
snapshot.accounts.push(account('viewer', 'user'))
for (let index = 0; index < 8; index += 1) {
  const id = `resident-${index}`
  snapshot.subjects.push(subject(id)); snapshot.accounts.push(account(id)); snapshot.participantPolicies.push({ id: `policy-${id}`, subjectId: `subject-${id}`, enabled: true, allowedCircleIds: [], blockedCircleIds: [], allowedAccountIds: [], allowedGroupIds: [], scope: ['global'], allowPublicDiscovery: true, allowNpcKnowledge: true, allowMention: true, allowSearch: true, allowRecommendation: true, allowDm: true, allowGroup: true, autonomy: { level: 'normal', actions: { post: true, comment: true, like: true } }, updatedAt: now })
  ensureResidentProfile(snapshot, snapshot.accounts.at(-1)!, 'ambient')
}
snapshot.circles.push({ id: 'public-circle', name: '厨房', avatar: '厨', description: '做饭的人在这里', contentScope: '日常做饭、菜谱、食材处理和厨房经验', rules: [], tags: ['做饭'], creatorAccountId: 'viewer', administratorAccountIds: ['viewer'], memberCount: 1, activityScore: 0, searchable: true, isPublic: true, joinMode: 'public', contentPermissions: ['text'], anonymousMode: 'disabled', adminCanResolveAnonymous: false, allowPoll: false, allowLottery: false, mediaPermissions: [], participantSubjectIds: [], aiPopulation: 0, aiActivity: 'normal', createdAt: now })
snapshot.circles.push({ ...snapshot.circles[0], id: 'private-circle', name: '私密厨房', isPublic: false, joinMode: 'invite' })
const makePost = (id: string, authorId: string, circleId: string | undefined, age: number) => ({ id, author: {} as never, authorAccountId: authorId, circleId, type: 'text' as const, content: `${id} 做饭记录`, topics: ['做饭'], visibility: circleId ? 'circle' as const : 'public' as const, likeCount: 0, commentCount: 0, shareCount: 0, createdAt: now - age, source: 'resident' as const })
snapshot.posts.push(makePost('public-post', 'resident-0', 'public-circle', 2000), makePost('private-post', 'resident-1', 'private-circle', 1000), makePost('plain-post', 'resident-2', undefined, 3000))
assert.equal(canViewForumPost(snapshot, snapshot.posts[0], 'viewer'), true)
assert.equal(canViewForumPost(snapshot, snapshot.posts[1], 'viewer'), false)
assert.deepEqual(rankForumFeed(snapshot, 'viewer', 'latest').map(item => item.id), ['public-post', 'plain-post'])
snapshot.relationships.push({ id: 'follow', fromAccountId: 'viewer', toAccountId: 'resident-2', type: 'follow', createdAt: now })
assert.deepEqual(rankForumFeed(snapshot, 'viewer', 'following').map(item => item.id), ['plain-post'])
recordFeedExposure(snapshot, 'viewer', rankForumFeed(snapshot, 'viewer', 'recommend'), 'recommend')
assert.equal(snapshot.exposures.length, 2)
assert.equal(snapshot.scheduledActions.length, 0, '普通浏览和排序不得创建固定居民行为队列')

console.log('forum runtime tests passed')
