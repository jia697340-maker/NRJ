/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import assert from 'node:assert/strict'
const memory = new Map<string, string>()
Object.defineProperty(globalThis, 'localStorage', { value: { getItem: (key: string) => memory.get(key) ?? null, setItem: (key: string, value: string) => memory.set(key, value), removeItem: (key: string) => memory.delete(key), key: (index: number) => [...memory.keys()][index] ?? null, clear: () => memory.clear(), get length() { return memory.size } } })
const { emptyForumSnapshot } = await import('../src/services/forumRepository')
const { createForumDistributionPlan, generateForumContentBatch, normalizeForumGenerationConfig } = await import('../src/services/forumGeneration')
const { forumGenerationRuntime, hasActiveForumGenerationTask, runSingleForumGenerationTask } = await import('../src/services/forumGenerationRuntime')
const snapshot = emptyForumSnapshot(); const now = Date.now()
snapshot.settings.activeAccountId = 'viewer'
snapshot.circles.push({ id: 'kitchen', name: '厨房', avatar: '厨', description: '聊做饭', contentScope: '日常做饭、菜谱和厨房经验', rules: [], tags: ['做饭'], creatorAccountId: 'viewer', administratorAccountIds: ['viewer'], memberCount: 18, activityScore: 1, searchable: true, isPublic: true, joinMode: 'public', contentPermissions: ['text'], anonymousMode: 'per-post', adminCanResolveAnonymous: false, allowPoll: true, allowLottery: false, mediaPermissions: [], participantSubjectIds: [], aiPopulation: 0, aiActivity: 'off', createdAt: now, source: 'user' })
const config = normalizeForumGenerationConfig({ postCount: 5, requiredCharacterAccountIds: ['character-a', 'character-b'] })
const authors = ['character-a', 'character-b', 'stranger-a', 'stranger-b', 'stranger-c', 'commenter-a']
const plan = createForumDistributionPlan(snapshot, 'session', 'batch', config, authors, [])
assert.equal(plan.slots.length, 5)
assert.ok(plan.slots.some(item => item.circleId === 'kitchen'), '内部规划器应自然分配少量圈子帖')
assert.ok(plan.slots.some(item => item.commentTarget === 0), '应允许无人回复的帖子')
assert.ok(plan.slots.every(item => item.commentTarget <= 5), '默认评论量必须保持轻量')
assert.ok(plan.slots.some(item => item.authorAccountId === 'character-a') && plan.slots.some(item => item.authorAccountId === 'character-b'), '勾选角色必须各自至少自然参与一次')
assert.ok(plan.slots.filter(item => item.authorAccountId.startsWith('stranger')).length >= 3, '剩余帖子应主要由不同陌生人补齐')
assert.ok(plan.slots.every(item => Number(item.createdAt) >= now - 36 * 3600000 - 1000 && Number(item.createdAt) <= Date.now() + 1000), '显示时间应由内部自然规划')
assert.deepEqual(normalizeForumGenerationConfig({ postCount: 99, requiredCharacterAccountIds: Array.from({ length: 30 }, (_, index) => `c${index}`) }), { postCount: 20, requiredCharacterAccountIds: Array.from({ length: 20 }, (_, index) => `c${index}`) })

assert.equal(snapshot.settings.autoImageProvider, 'pollinations', '论坛自动配图默认必须是 Pollinations')
for (const provider of ['novelai', 'gpt', 'gemini', 'flux', 'niji', 'seedream', 'pollinations', 'aihorde', 'off'] as const) { snapshot.settings.autoImageProvider = provider; assert.equal(snapshot.settings.autoImageProvider, provider) }

const batchSnapshot = emptyForumSnapshot()
batchSnapshot.settings.initialized = true
batchSnapshot.settings.activeAccountId = 'viewer'
batchSnapshot.settings.autoImageProvider = 'pollinations'
batchSnapshot.subjects.push({ id: 'subject-viewer', kind: 'user', displayName: '我', persona: '', createdAt: now, updatedAt: now }, { id: 'subject-character', kind: 'character', displayName: '角色甲', persona: '认真但不端着', createdAt: now, updatedAt: now })
batchSnapshot.accounts.push({ id: 'viewer', subjectId: 'subject-viewer', kind: 'main', name: '我', handle: 'viewer', avatar: '', privacy: 'public', searchable: true, acceptsFollow: true, followRequiresApproval: false, acceptsDm: 'all', showInRecommendations: true, showOnline: true, showCircles: true, joinedAt: now, circleIds: [], lifecycle: 'user' }, { id: 'character-a', subjectId: 'subject-character', kind: 'main', name: '角色甲', handle: 'character_a', avatar: '甲', privacy: 'normal', searchable: true, acceptsFollow: true, followRequiresApproval: false, acceptsDm: 'all', showInRecommendations: true, showOnline: true, showCircles: true, joinedAt: now, circleIds: [], lifecycle: 'character', expressionStyle: '自然简短' })
batchSnapshot.participantPolicies.push({ id: 'policy-character', subjectId: 'subject-character', enabled: true, allowedCircleIds: [], blockedCircleIds: [], allowedAccountIds: [], allowedGroupIds: [], scope: ['global', 'post'], allowPublicDiscovery: true, allowNpcKnowledge: true, allowMention: true, allowSearch: true, allowRecommendation: true, allowDm: true, allowGroup: true, autonomy: { level: 'off', actions: {} }, updatedAt: now })

let textRequests = 0
let imageRequests = 0
const imageProviders: string[] = []
const originalRandom = Math.random
Math.random = () => .17
const batch = await generateForumContentBatch(batchSnapshot, 'viewer', { postCount: 3, requiredCharacterAccountIds: ['character-a'] }, undefined, {
  requestJson: (async (_snapshot: unknown, _request: unknown, _purpose: unknown, instruction: string) => {
    textRequests += 1
    const plan = JSON.parse(instruction.slice(instruction.indexOf('完整规划：') + 5)) as Array<{ postKey: string; comments: Array<{ commentKey: string }> }>
    return {
      authors: Array.from({ length: 4 }, (_, index) => ({ authorKey: `stranger_${index + 1}`, name: `路人${index + 1}`, handle: `passer_${index + 1}`, bio: '普通网友', expressionStyle: '口语简短', backgroundHints: ['只在本轮出现'] })),
      circles: [{ circleKey: 'circle_new_1', name: '日常小组', avatar: '日', description: '聊具体小事', contentScope: '日常生活里的具体经验', tags: ['日常'], memberCount: 300 }],
      posts: plan.map((slot, index) => ({ postKey: slot.postKey, content: `帖子 ${index + 1}`, imagePrompt: '一张自然的生活照片', comments: slot.comments.map(comment => ({ commentKey: comment.commentKey, content: `评论 ${comment.commentKey}` })) }))
    }
  }) as never,
  generateImage: (async (_prompt: string, provider: string) => { imageRequests += 1; imageProviders.push(provider); throw new Error('图片服务失败') }) as never
})
Math.random = originalRandom
await new Promise(resolve => setTimeout(resolve, 0))
assert.equal(textRequests, 1, '一次论坛刷新主体文本必须只请求一次 AI')
assert.equal(batch.postIds.length, 3)
assert.equal(batchSnapshot.posts.length, 3, '文本批次应在图片任务之外完整提交')
assert.ok(batchSnapshot.posts.some(post => post.authorAccountId === 'character-a'), '指定角色必须参与')
assert.equal(batchSnapshot.comments.length, batch.commentIds.length)
assert.ok(batchSnapshot.comments.every(comment => !comment.parentId || batchSnapshot.comments.some(parent => parent.id === comment.parentId)), '楼中楼父评论必须正确关联')
assert.ok(imageRequests >= 1, '图片帖应在正文提交后启动后台配图')
assert.deepEqual([...new Set(imageProviders)], ['pollinations'], '默认自动配图只能调用 Pollinations，失败不得转投 GPT Image')
assert.ok(batchSnapshot.posts.every(post => !post.media?.length), '图片失败只能降级为纯文字，不得影响主体批次')

const disabledSnapshot = JSON.parse(JSON.stringify(batchSnapshot))
disabledSnapshot.posts = []; disabledSnapshot.comments = []; disabledSnapshot.contentBatches = []; disabledSnapshot.generationSessions = []
disabledSnapshot.participantPolicies.find((item: { subjectId: string }) => item.subjectId === 'subject-character').enabled = false
let disabledRequests = 0
await assert.rejects(() => generateForumContentBatch(disabledSnapshot, 'viewer', { postCount: 1, requiredCharacterAccountIds: ['character-a'] }, undefined, { requestJson: (async () => { disabledRequests += 1; return {} }) as never }), /未启用或已不可用/)
assert.equal(disabledRequests, 0, '禁用角色必须在文本 API 调用前被拦截')
assert.equal(disabledSnapshot.posts.length, 0, '失败时不得提交半成品帖子快照')

let releaseTask!: () => void
let runnerCalls = 0
const firstTask = runSingleForumGenerationTask(async progress => { runnerCalls += 1; progress(25); await new Promise<void>(resolve => { releaseTask = resolve }) })
const duplicateTask = runSingleForumGenerationTask(async () => { runnerCalls += 1 })
assert.strictEqual(firstTask, duplicateTask, '重复点击必须复用同一个运行中 Promise')
assert.equal(runnerCalls, 1)
assert.equal(hasActiveForumGenerationTask(), true)
assert.equal(forumGenerationRuntime.progress, 25)
releaseTask()
assert.equal(await firstTask, true)
assert.equal(hasActiveForumGenerationTask(), false)
assert.equal(forumGenerationRuntime.status, 'completed', '任务状态在调用组件之外保留，重新进入论坛仍可读取')
console.log('forum generation tests passed')
