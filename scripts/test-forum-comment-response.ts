/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import assert from 'node:assert/strict'

const memory = new Map<string, string>()
Object.defineProperty(globalThis, 'localStorage', { value: { getItem: (key: string) => memory.get(key) ?? null, setItem: (key: string, value: string) => memory.set(key, value), removeItem: (key: string) => memory.delete(key), key: (index: number) => [...memory.keys()][index] ?? null, clear: () => memory.clear(), get length() { return memory.size } } })

const { emptyForumSnapshot } = await import('../src/services/forumRepository')
const { generateCommunityCommentResponse, selectCommunityResponseCandidates } = await import('../src/services/forumCommentResponse')
const snapshot = emptyForumSnapshot()
const now = Date.now()
snapshot.settings.initialized = true
snapshot.settings.activeAccountId = 'viewer'
const subject = (id: string, kind: 'user' | 'character' = 'character') => ({ id: `subject-${id}`, kind, displayName: id, persona: '', createdAt: now, updatedAt: now })
const account = (id: string, subjectId = `subject-${id}`) => ({ id, subjectId, kind: 'main' as const, name: id, handle: id, avatar: '', privacy: 'public' as const, searchable: true, acceptsFollow: true, followRequiresApproval: false, acceptsDm: 'all' as const, showInRecommendations: true, showOnline: true, showCircles: true, joinedAt: now, circleIds: [] })
snapshot.subjects.push(subject('viewer', 'user'), subject('author'), subject('participant'), subject('disabled'))
snapshot.accounts.push(account('viewer'), account('author'), account('participant'), account('disabled'))
for (const id of ['author', 'participant']) snapshot.participantPolicies.push({ id: `policy-${id}`, subjectId: `subject-${id}`, enabled: true, allowedCircleIds: [], blockedCircleIds: [], allowedAccountIds: [], allowedGroupIds: [], scope: ['global', 'post'], allowPublicDiscovery: true, allowNpcKnowledge: true, allowMention: true, allowSearch: true, allowRecommendation: true, allowDm: true, allowGroup: false, autonomy: { level: 'off', actions: {} }, updatedAt: now })
snapshot.participantPolicies.push({ id: 'policy-disabled', subjectId: 'subject-disabled', enabled: false, allowedCircleIds: [], blockedCircleIds: [], allowedAccountIds: [], allowedGroupIds: [], scope: ['global'], allowPublicDiscovery: true, allowNpcKnowledge: true, allowMention: true, allowSearch: true, allowRecommendation: true, allowDm: true, allowGroup: false, autonomy: { level: 'off', actions: {} }, updatedAt: now })
snapshot.posts.push({ id: 'post', author: {} as never, authorAccountId: 'author', type: 'text', content: '窗边的蓝紫色花开了', topics: ['花'], visibility: 'public', likeCount: 0, commentCount: 2, shareCount: 0, createdAt: now })
snapshot.comments.push(
  { id: 'participant-comment', postId: 'post', author: {} as never, authorAccountId: 'participant', content: '今年开得早', likeCount: 0, createdAt: now, source: 'generated' },
  { id: 'user-comment', postId: 'post', author: { ...account('viewer'), followersCount: 0, followingCount: 0, postsCount: 0, likesCount: 0 }, authorAccountId: 'viewer', content: '这个蓝紫色真的好美', likeCount: 0, createdAt: now + 1, source: 'user' }
)

const candidates = selectCommunityResponseCandidates(snapshot, 'viewer', snapshot.posts[0], snapshot.comments[1])
assert.deepEqual(candidates.slice(0, 2).map(item => item.account.id), ['author', 'participant'])
assert.equal(candidates.some(item => item.account.id === 'disabled'), false)

const replyResult = await generateCommunityCommentResponse(snapshot, 'viewer', 'post', 'user-comment', {}, { random: () => 0.99, requestJson: async () => ({ action: 'reply-and-like', actorAccountId: 'participant', content: '对，这个颜色在阴天里反而更显眼', timing: 'immediate', reason: '参与者对花色有共同观察' }) as never })
assert.equal(replyResult.commentCount, 1)
assert.equal(snapshot.comments.find(item => item.communityResponseForCommentId === 'user-comment')?.parentId, 'user-comment')
assert.equal(snapshot.comments.find(item => item.id === 'user-comment')?.likeCount, 1)
assert.equal(snapshot.events.some(item => item.type === 'npc-comment-like' && item.entityId === 'user-comment'), true)

const oldResponseId = replyResult.responseComment?.id
await generateCommunityCommentResponse(snapshot, 'viewer', 'post', 'user-comment', { mode: 'regenerate' }, { requestJson: async () => ({ action: 'reply', actorAccountId: 'author', content: '我拍完还站那儿看了半天', timing: 'immediate', reason: '帖主补充现场感受' }) as never })
assert.equal(snapshot.comments.some(item => item.id === oldResponseId), false, '重试应替换旧的局部回应')
assert.equal(snapshot.comments.filter(item => item.communityResponseForCommentId === 'user-comment').length, 1)
assert.equal(snapshot.comments.find(item => item.id === 'user-comment')?.likeCount, 0, '旧局部回应附带的赞应一并撤销')
assert.equal(snapshot.comments.some(item => item.id === 'participant-comment'), true, '批量/普通评论不能被单条重试删除')

const currentResponseId = snapshot.comments.find(item => item.communityResponseForCommentId === 'user-comment')?.id
const noneResult = await generateCommunityCommentResponse(snapshot, 'viewer', 'post', 'user-comment', {}, { random: () => 0.99, requestJson: async () => ({ action: 'none', reason: '普通感叹暂时无人接话' }) as never })
assert.equal(noneResult.action, 'none', '自动判定必须允许无人回应')
assert.equal(snapshot.comments.some(item => item.id === currentResponseId), true)
await assert.rejects(() => generateCommunityCommentResponse(snapshot, 'viewer', 'post', 'user-comment', { mode: 'regenerate' }, { requestJson: async () => ({ action: 'reply', actorAccountId: 'disabled', content: '不应出现' }) as never }), /不可用的账号/)
assert.equal(snapshot.comments.some(item => item.id === currentResponseId), true, '重试失败时不能先删掉旧回应')

console.log('forum comment response tests passed')
