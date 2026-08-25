/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import assert from 'node:assert/strict'

const memory = new Map<string, string>()
Object.defineProperty(globalThis, 'localStorage', { value: { getItem: (key: string) => memory.get(key) ?? null, setItem: (key: string, value: string) => memory.set(key, value), removeItem: (key: string) => memory.delete(key), key: (index: number) => [...memory.keys()][index] ?? null, clear: () => memory.clear(), get length() { return memory.size } } })

const { emptyForumSnapshot } = await import('../src/services/forumRepository')
const { assertNoDisabledSubjects, buildAllowedForumContext, canAccountAppear } = await import('../src/services/forumPolicy')
const { collectChatToForumBridgeMemories } = await import('../src/services/forumMemoryBridge')
const { requestForumJson } = await import('../src/services/forumAI')
const snapshot = emptyForumSnapshot()
const now = Date.now()
snapshot.settings.initialized = true
snapshot.settings.activeAccountId = 'viewer'
snapshot.subjects.push(
  { id: 'user', kind: 'user', displayName: '用户', persona: '', createdAt: now, updatedAt: now },
  { id: 'enabled', kind: 'character', displayName: '允许角色', persona: '允许资料', createdAt: now, updatedAt: now },
  { id: 'disabled', kind: 'character', displayName: '关闭角色', persona: '绝密资料', createdAt: now, updatedAt: now }
)
const account = (id: string, subjectId: string) => ({ id, subjectId, kind: 'main' as const, name: id, handle: id, avatar: '', privacy: 'public' as const, searchable: true, acceptsFollow: true, followRequiresApproval: false, acceptsDm: 'all' as const, showInRecommendations: true, showOnline: true, showCircles: true, joinedAt: now, circleIds: [] })
snapshot.accounts.push(account('viewer', 'user'), account('enabled-account', 'enabled'), account('disabled-account', 'disabled'))
snapshot.personas.push({ id: 'persona-enabled', accountId: 'enabled-account', interests: ['散步'], boundaries: [], postingStyle: '短句', punctuationStyle: '很少使用句号', socialInitiative: 50, activeHours: [], habits: {}, lockedFields: [] })
snapshot.posts.push({ id: 'recent-post', author: {} as never, authorAccountId: 'enabled-account', type: 'text', content: '刚刚下楼买了杯水', topics: [], visibility: 'public', likeCount: 0, commentCount: 0, shareCount: 0, createdAt: now - 1000 })
snapshot.participantPolicies.push(
  { id: 'p1', subjectId: 'enabled', enabled: true, allowedCircleIds: ['circle-a'], blockedCircleIds: [], allowedAccountIds: [], allowedGroupIds: [], scope: ['global'], allowPublicDiscovery: true, allowNpcKnowledge: true, allowMention: true, allowSearch: true, allowRecommendation: true, allowDm: true, allowGroup: true, autonomy: { level: 'off', actions: {} }, updatedAt: now },
  { id: 'p2', subjectId: 'disabled', enabled: false, allowedCircleIds: ['circle-a'], blockedCircleIds: [], allowedAccountIds: [], allowedGroupIds: [], scope: ['global'], allowPublicDiscovery: true, allowNpcKnowledge: true, allowMention: true, allowSearch: true, allowRecommendation: true, allowDm: true, allowGroup: true, autonomy: { level: 'high', actions: { post: true } }, updatedAt: now }
)
snapshot.circles.push({ id: 'circle-a', name: '测试圈', avatar: '测', description: '', rules: [], tags: [], creatorAccountId: 'viewer', administratorAccountIds: ['viewer'], memberCount: 1, activityScore: 0, searchable: true, isPublic: true, joinMode: 'public', contentPermissions: ['text'], anonymousMode: 'per-post', adminCanResolveAnonymous: false, allowPoll: true, allowLottery: true, mediaPermissions: ['image'], participantSubjectIds: ['enabled'], aiPopulation: 0, aiActivity: 'off', createdAt: now })
snapshot.memories.push({ id: 'secret', subjectId: 'disabled', type: 'chat-secret', summary: '不应泄露', visibility: 'public', sourceEventIds: [], importance: 10, createdAt: now })

const context = buildAllowedForumContext(snapshot, { viewerAccountId: 'viewer', circleId: 'circle-a', involvedAccountIds: ['enabled-account', 'disabled-account'] })
assert.deepEqual(context.involvedSubjects.map(item => item.id), ['enabled'])
assert.deepEqual(context.involvedPersonas.map(item => item.accountId), ['enabled-account'])
assert.deepEqual(context.recentPosts.map(item => item.content), ['刚刚下楼买了杯水'])
assert.equal(context.reachableMemories.some(item => item.subjectId === 'disabled'), false)
assert.doesNotThrow(() => assertNoDisabledSubjects(snapshot, context))
assert.equal(canAccountAppear(snapshot, snapshot.accounts[2], snapshot.circles[0]), false)

snapshot.participantPolicies[1].enabled = true
assert.equal(canAccountAppear(snapshot, snapshot.accounts[2], snapshot.circles[0]), false, '圈子白名单必须继续排除未列入角色')
snapshot.circles[0].participantSubjectIds.push('disabled')
assert.equal(canAccountAppear(snapshot, snapshot.accounts[2], snapshot.circles[0]), true)

snapshot.subjects[2].sourceId = 'chat-disabled'
snapshot.bridgePolicies.push({ id: 'bridge-disabled', subjectId: 'disabled', forumToChat: { mode: 'off', memoryTypes: [] }, chatToForum: { mode: 'all', memoryTypes: [] }, updatedAt: now })
memory.set('clingy_custom_contacts_test', JSON.stringify([{ id: 9, characterEntityId: 'chat-disabled', messages: [{ type: 'left', content: '只属于关闭角色的聊天秘密' }] }]))
snapshot.participantPolicies[1].enabled = false
assert.deepEqual(collectChatToForumBridgeMemories(snapshot, ['disabled-account']), [], '关闭参与论坛时，聊天记忆不得桥接')
snapshot.participantPolicies[1].enabled = true
assert.equal(collectChatToForumBridgeMemories(snapshot, ['disabled-account']).length, 1, '逐角色明确开启后才可桥接')
assert.deepEqual(collectChatToForumBridgeMemories(snapshot, ['enabled-account', 'disabled-account']), [], '多角色批量生成不得混入跨角色聊天记忆')

const noWorldContext = buildAllowedForumContext(snapshot, { viewerAccountId: 'viewer', involvedAccountIds: ['enabled-account'], worldBookIds: [] })
assert.equal(noWorldContext.worldBookEntries.length, 0, '明确不选世界书时不得注入背景')
const selectedWorldContext = buildAllowedForumContext(snapshot, { viewerAccountId: 'viewer', involvedAccountIds: ['enabled-account'], worldBookIds: ['1'] })
assert.ok(selectedWorldContext.worldBookEntries.length > 0, '公共推荐流应能按本次选择注入世界书')
await assert.rejects(() => requestForumJson(snapshot, { viewerAccountId: 'viewer', involvedAccountIds: ['enabled-account'] }, 'forum-comment', '不应执行', '{}'), /只能由用户手动操作触发/, '未标记用户操作时必须在 API 调用前拒绝')

console.log('forum policy tests passed')
