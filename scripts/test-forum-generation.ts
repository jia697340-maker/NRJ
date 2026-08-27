/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const memory = new Map<string, string>()
Object.defineProperty(globalThis, 'localStorage', { value: { getItem: (key: string) => memory.get(key) ?? null, setItem: (key: string, value: string) => memory.set(key, value), removeItem: (key: string) => memory.delete(key), key: (index: number) => [...memory.keys()][index] ?? null, clear: () => memory.clear(), get length() { return memory.size } } })
const { emptyForumSnapshot } = await import('../src/services/forumRepository')
const { createForumDistributionPlan, distributeForumComments, estimateForumBatchSize, generateForumContentBatch, normalizeForumGenerationConfig, shouldDiscoverForumCircle, validateForumTopicPlan } = await import('../src/services/forumGeneration')
const { formatForumTime } = await import('../src/services/forumTime')
const { parseChatMessageXml } = await import('../src/services/chatMessageXml')
const { generateForumPostInteractions } = await import('../src/services/forumPostInteraction')
const { forumGenerationRuntime, hasActiveForumGenerationTask, runSingleForumGenerationTask } = await import('../src/services/forumGenerationRuntime')
const snapshot = emptyForumSnapshot(); const now = Date.now()
snapshot.settings.activeAccountId = 'viewer'
snapshot.circles.push({ id: 'kitchen', name: '厨房', avatar: '厨', description: '聊做饭', contentScope: '日常做饭、菜谱和厨房经验', rules: [], tags: ['做饭'], creatorAccountId: 'viewer', administratorAccountIds: ['viewer'], memberCount: 18, activityScore: 1, searchable: true, isPublic: true, joinMode: 'public', contentPermissions: ['text','single-image','long-article','qa','link','poll','anonymous'], anonymousMode: 'per-post', adminCanResolveAnonymous: false, allowPoll: true, allowLottery: false, mediaPermissions: ['image'], participantSubjectIds: [], aiPopulation: 0, aiActivity: 'off', createdAt: now, source: 'user' })
const config = normalizeForumGenerationConfig({ postCount: 5, requiredCharacterAccountIds: ['character-a', 'character-b'] })
const authors = ['character-a', 'character-b', 'stranger-a', 'stranger-b', 'stranger-c', 'commenter-a']
const plan = createForumDistributionPlan(snapshot, 'session', 'batch', config, authors, [])
assert.equal(plan.slots.length, 5)
assert.ok(plan.slots.some(item => item.circleId === 'kitchen'), '内部规划器应自然分配少量圈子帖')
assert.ok(plan.slots.every(item => Number.isInteger(item.commentTarget) && item.commentTarget >= 0), '自然评论规划必须生成合法的非负整数')
assert.ok(plan.slots.some(item => item.authorAccountId === 'character-a') && plan.slots.some(item => item.authorAccountId === 'character-b'), '勾选角色必须各自至少自然参与一次')
assert.ok(plan.slots.filter(item => !['character-a', 'character-b'].includes(item.authorAccountId)).length >= 3, '剩余帖子应主要由不同陌生人补齐')
assert.ok(plan.slots.every(item => Number(item.createdAt) >= now - 36 * 3600000 - 1000 && Number(item.createdAt) <= Date.now() + 1000), '显示时间应由内部自然规划')
assert.deepEqual(validateForumTopicPlan(plan), [], '每个首页槽位都必须在 AI 调用前拥有有效的独立主题规划')

const circle = (id: string, name = id, contentScope = `${name}范围内的交流`) => ({ id, name, avatar: name.slice(0, 1), description: contentScope, contentScope, rules: [], tags: [name], creatorAccountId: 'viewer', administratorAccountIds: [], memberCount: 50, activityScore: 1, searchable: true, isPublic: true, joinMode: 'public' as const, contentPermissions: ['text','single-image','long-article','qa','link','poll','anonymous'] as const, anonymousMode: 'per-post' as const, adminCanResolveAnonymous: false, allowPoll: true, allowLottery: false, mediaPermissions: ['image' as const], participantSubjectIds: [], aiPopulation: 0, aiActivity: 'off' as const, createdAt: now, source: 'user' as const })
const planningConfig = normalizeForumGenerationConfig({ postCount: 12, requiredCharacterAccountIds: [], discoverCircles: false })
const planningAuthors = Array.from({ length: 14 }, (_, index) => `author-${index}`)
const threeCircleSnapshot = emptyForumSnapshot(); threeCircleSnapshot.circles.push(circle('c1'), circle('c2'), circle('c3'))
const threeCirclePlan = createForumDistributionPlan(threeCircleSnapshot, 's-a', 'b-a', planningConfig, planningAuthors, [], () => .17)
assert.ok(new Set(threeCirclePlan.slots.filter(item => item.circleId).map(item => item.circleId)).size > 1, '场景 A：3 个圈子时不能因固定步长锁死同一圈')
const sixCircleSnapshot = emptyForumSnapshot(); sixCircleSnapshot.circles.push(...Array.from({ length: 6 }, (_, index) => circle(`six-${index}`)))
const sixCirclePlan = createForumDistributionPlan(sixCircleSnapshot, 's-b', 'b-b', planningConfig, planningAuthors, [], () => .17)
assert.ok(new Set(sixCirclePlan.slots.filter(item => item.circleId).map(item => item.circleId)).size > 1, '场景 B：6 个圈子时不能发生公约数周期锁死')
const mixedCircleSnapshot = emptyForumSnapshot(); mixedCircleSnapshot.circles.push(circle('old-1'), circle('old-2'))
const newCirclePlan = createForumDistributionPlan(mixedCircleSnapshot, 's-c', 'b-c', planningConfig, planningAuthors, ['new-1'], () => .17)
const newCircleSlots = newCirclePlan.slots.filter(item => item.circleId)
assert.ok(newCircleSlots.some(item => item.circleId === 'new-1'), '场景 C：本轮新圈子必须至少绑定一篇真实帖子')
assert.ok(newCircleSlots.some(item => item.circleId !== 'new-1'), '场景 C：新圈子不得占据本轮全部圈子槽位')
assert.ok(new Set(newCirclePlan.slots.map(item => item.topicDomain)).size >= 3 && new Set(newCirclePlan.slots.map(item => item.topicSeed)).size === 12, '场景 D/G：12 篇规划必须有多个真实领域且每篇种子独立，不能只依赖 contentKind')
const foodSnapshot = emptyForumSnapshot(); foodSnapshot.circles.push(circle('food-safety', '食品安全', '冷冻食品保存、食品安全和保质期讨论'))
const foodPlan = createForumDistributionPlan(foodSnapshot, 's-e', 'b-e', planningConfig, planningAuthors, [], () => .17)
const publicFoodSlots = foodPlan.slots.filter(item => !item.circleId)
assert.ok(publicFoodSlots.length > 0 && publicFoodSlots.every(item => !item.topicDomain?.startsWith('circle:')), '场景 F：公共帖不得继承 unrelated circle.contentScope')
assert.ok(publicFoodSlots.filter(item => item.topicDomain === 'public:meals').length <= 1, '场景 E：食品安全圈存在时也不能把全部公共帖规划成食品主题')
assert.ok(new Set(foodPlan.slots.map(item => item.topicDomain)).size >= 3, '场景 E：食品安全圈存在时首页仍必须是多主题内容流')
const discoverConfig = normalizeForumGenerationConfig({ postCount: 12, requiredCharacterAccountIds: [], discoverCircles: true })
const discoverySnapshot = emptyForumSnapshot(); discoverySnapshot.settings.circleDiscoveryMisses = 0
assert.equal(shouldDiscoverForumCircle(discoverySnapshot, discoverConfig, () => .99), false, '新圈子发现首轮允许自然未命中')
discoverySnapshot.settings.circleDiscoveryMisses = 1
assert.equal(shouldDiscoverForumCircle(discoverySnapshot, discoverConfig, () => .99), true, '连续一次未发现后下一次必须保底，不能连续 24 篇完全无新圈子')
const unlimited = normalizeForumGenerationConfig({ postCount: 99, requiredCharacterAccountIds: Array.from({ length: 120 }, (_, index) => `c${index}`) })
assert.equal(unlimited.postCount, 99, '帖子数量不得设置业务硬上限')
assert.equal(unlimited.requiredCharacterAccountIds.length, 99, '指定角色只按帖子槽位数量截断')
assert.deepEqual(distributeForumComments(['thought','life','help','poll'], { commentMode: 'per-post', commentsPerPost: 3, totalComments: 0, includeInitialComments: true }, () => .5), [3, 3, 3, 3])
assert.equal(distributeForumComments(['thought','life','help','poll','question','link','experience'], { commentMode: 'total', commentsPerPost: 0, totalComments: 25, includeInitialComments: true }, () => .5).reduce((a: number, b: number) => a + b, 0), 25, '总评论量必须精确守恒')
let naturalSeed = 29
const seededRandom = () => { naturalSeed = naturalSeed * 16807 % 2147483647; return (naturalSeed - 1) / 2147483646 }
const naturalComments = distributeForumComments(['thought','life','image-share','question','help','complaint','discussion','experience'], { commentMode: 'natural', commentsPerPost: 0, totalComments: 0, includeInitialComments: true }, seededRandom)
assert.ok(naturalComments.includes(0) && Math.max(...naturalComments) >= 2 && new Set(naturalComments).size >= 3, '自然模式应允许冷帖、热帖和明显不同的评论数量')
assert.ok(estimateForumBatchSize(normalizeForumGenerationConfig({ postCount: 100, commentMode: 'per-post', commentsPerPost: 20 }), 2000) < estimateForumBatchSize(normalizeForumGenerationConfig({ postCount: 100, includeInitialComments: false }), 2000), '输出更重时应自动缩小技术批次')

const parsedXml = parseChatMessageXml('<msg><content language="zh">第一条</content><translation language="en">One</translation></msg><msg><content>第二条</content></msg><persona_updates><fact field="occupation" confidence="0.8">摄影师</fact></persona_updates>')
assert.equal(parsedXml.messages.length, 2, 'XML 私信必须支持同一次请求返回多个气泡')
assert.equal(parsedXml.messages[0].translation, 'One')
assert.deepEqual(parsedXml.facts[0], { field: 'occupation', value: '摄影师', confidence: .8 })

const interactionSnapshot = emptyForumSnapshot()
interactionSnapshot.settings.activeAccountId = 'viewer'
interactionSnapshot.subjects.push({ id: 's-viewer', kind: 'user', displayName: '我', persona: '', createdAt: now, updatedAt: now }, { id: 's-author', kind: 'npc', displayName: '作者', persona: '', createdAt: now, updatedAt: now })
interactionSnapshot.accounts.push({ id: 'viewer', subjectId: 's-viewer', kind: 'main', name: '我', handle: 'me', avatar: '', privacy: 'public', searchable: true, acceptsFollow: true, followRequiresApproval: false, acceptsDm: 'all', showInRecommendations: true, showOnline: true, showCircles: true, joinedAt: now, circleIds: [], lifecycle: 'user' }, { id: 'author', subjectId: 's-author', kind: 'main', name: '作者', handle: 'author', avatar: '', privacy: 'public', searchable: true, acceptsFollow: true, followRequiresApproval: false, acceptsDm: 'all', showInRecommendations: true, showOnline: true, showCircles: true, joinedAt: now, circleIds: [], lifecycle: 'persistent' })
interactionSnapshot.posts.push({ id: 'target-post', author: {} as never, authorAccountId: 'author', type: 'text', content: '当前帖子', visibility: 'public', likeCount: 0, commentCount: 0, shareCount: 0, viewCount: 0, createdAt: now, source: 'generated' })
await generateForumPostInteractions(interactionSnapshot, 'viewer', 'target-post', { comments: false, replies: false, postLikes: true, commentLikes: false, shares: false, bookmarks: false, follows: false, views: true, countMode: 'custom', commentCount: 0, replyCount: 0, actorCount: 3, postLikeCount: 3, commentLikeCount: 0, shareCount: 0, bookmarkCount: 0, followCount: 0, viewCount: 12 }, { requestJson: (async () => ({ actors: [1, 2, 3].map(index => ({ actorKey: `new_${index}`, name: `互动者${index}`, handle: `actor_${index}` })), comments: [] })) as never })
assert.equal(interactionSnapshot.posts[0].likeCount, 3, '只执行勾选的帖子点赞且精确计数')
assert.equal(interactionSnapshot.posts[0].viewCount, 12, '自定义浏览量必须精确应用')
assert.equal(interactionSnapshot.posts[0].shareCount, 0, '未勾选分享不得产生分享')
assert.ok(interactionSnapshot.events.every(event => event.actorAccountId !== 'viewer'), '单帖增量互动绝不能以用户主账号为执行主体')

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
const batch = await generateForumContentBatch(batchSnapshot, 'viewer', { postCount: 3, requiredCharacterAccountIds: ['character-a'], postTypeMode: 'custom', allowedContentKinds: ['image-share', 'thought', 'question'], ensureEverySelectedKind: true }, undefined, {
  requestJson: (async (_snapshot: unknown, _request: unknown, _purpose: unknown, instruction: string) => {
    textRequests += 1
    const plan = JSON.parse(instruction.slice(instruction.indexOf('完整规划：') + 5)) as Array<{ postKey: string; kind: string; topicDomain: string; topicSeed: string; comments: Array<{ commentKey: string }> }>
    return {
      authors: Array.from({ length: 4 }, (_, index) => ({ authorKey: `stranger_${index + 1}`, name: `路人${index + 1}`, handle: `passer_${index + 1}`, bio: '普通网友', expressionStyle: '口语简短', backgroundHints: ['只在本轮出现'] })),
      circles: [{ circleKey: 'circle_new_1', name: '日常小组', avatar: '日', description: '聊具体小事', contentScope: '日常生活里的具体经验', tags: ['日常'], memberCount: 300 }],
      posts: plan.map((slot, index) => ({ postKey: slot.postKey, contentKind: slot.kind, topicDomain: slot.topicDomain, topicSeed: slot.topicSeed, content: `帖子 ${index + 1}`, imagePrompt: '一张自然的生活照片', comments: slot.comments.map(comment => ({ commentKey: comment.commentKey, content: `评论 ${comment.commentKey}` })) }))
    }
  }) as never,
  generateImage: (async (_prompt: string, provider: string) => { imageRequests += 1; imageProviders.push(provider); return { id: `image-${imageRequests}`, type: 'image', url: 'blob:test-image', mimeType: 'image/png' } }) as never
})
Math.random = originalRandom
await new Promise(resolve => setTimeout(resolve, 0))
assert.equal(textRequests, 1, '一次论坛刷新主体文本必须只请求一次 AI')
assert.equal(batch.postIds.length, 3)
assert.equal(batchSnapshot.posts.length, 3, '严格类型批次应完整提交')
assert.ok(batchSnapshot.posts.some(post => post.authorAccountId === 'character-a'), '指定角色必须参与')
assert.equal(batchSnapshot.comments.length, batch.commentIds.length)
assert.ok(batchSnapshot.comments.every(comment => !comment.parentId || batchSnapshot.comments.some(parent => parent.id === comment.parentId)), '楼中楼父评论必须正确关联')
assert.ok(batchSnapshot.comments.every(comment => Number.isInteger(comment.createdAt)), '场景 H：生成评论 createdAt 必须是整数毫秒')
assert.equal(formatForumTime(now - 180_000, now), '3 分钟前', '论坛统一时间工具应输出相对时间而非原始时间戳')
const commentItemSource = readFileSync(new URL('../src/components/forum/components/ForumCommentItem.vue', import.meta.url), 'utf8')
assert.match(commentItemSource, /formatForumTime\(sub\.createdAt\)/, '场景 H：楼中楼必须使用论坛统一时间格式化逻辑')
assert.doesNotMatch(commentItemSource, /\{\{\s*sub\.createdAt\s*\}\}/, '场景 H：UI 不得直接渲染楼中楼原始时间戳')
assert.ok(imageRequests >= 1, '图片帖必须在批次成功前完成配图')
assert.deepEqual([...new Set(imageProviders)], ['pollinations'], '默认自动配图只能调用 Pollinations')
assert.ok(batchSnapshot.posts.find(post => post.contentKind === 'image-share')?.media?.length, '要求 AI 生图时最终图片分享必须真实带图')

const allKindsSnapshot = emptyForumSnapshot()
allKindsSnapshot.settings.activeAccountId = 'viewer'
allKindsSnapshot.settings.autoImageProvider = 'pollinations'
allKindsSnapshot.subjects.push({ id: 'all-viewer-subject', kind: 'user', displayName: '查看者', persona: '', createdAt: now, updatedAt: now })
allKindsSnapshot.accounts.push({ id: 'viewer', subjectId: 'all-viewer-subject', kind: 'main', name: '查看者', handle: 'all_viewer', avatar: '', privacy: 'public', searchable: true, acceptsFollow: true, followRequiresApproval: false, acceptsDm: 'all', showInRecommendations: true, showOnline: true, showCircles: true, joinedAt: now, circleIds: [], lifecycle: 'user' })
allKindsSnapshot.circles.push(circle('all-kinds-circle', '综合圈', '允许各种具体生活交流') as never)
const allKinds = ['thought','life','image-share','question','help','complaint','experience','discussion','link','poll','anonymous','circle-topic'] as const
const allKindsBatch = await generateForumContentBatch(allKindsSnapshot, 'viewer', { postCount: 12, requiredCharacterAccountIds: [], postTypeMode: 'custom', allowedContentKinds: [...allKinds], ensureEverySelectedKind: true, discoverCircles: false, includeInitialComments: false }, undefined, {
  requestJson: (async (_snapshot: unknown, _request: unknown, _purpose: unknown, instruction: string) => {
    const promptPlan = JSON.parse(instruction.slice(instruction.indexOf('完整规划：') + 5)) as Array<{ postKey: string; kind: string; topicDomain: string; topicSeed: string }>
    return {
      authors: Array.from({ length: 20 }, (_, index) => ({ authorKey: `stranger_${index + 1}`, name: `全类型路人${index + 1}`, handle: `all_kind_${index + 1}`, bio: '普通网友', expressionStyle: '自然表达' })), circles: [],
      posts: promptPlan.map((slot, index) => ({ postKey: slot.postKey, contentKind: slot.kind, topicDomain: slot.topicDomain, topicSeed: slot.topicSeed, content: `${slot.kind} 的可见正文 ${index}`, title: ['experience','discussion'].includes(slot.kind) ? `${slot.kind} 标题` : undefined, imagePrompt: slot.kind === 'image-share' ? '一张真实的日常照片' : undefined, pollOptions: slot.kind === 'poll' ? ['选项一','选项二'] : undefined, linkUrl: slot.kind === 'link' ? 'https://example.com/story' : undefined, linkTitle: slot.kind === 'link' ? '一条实际链接' : undefined, linkDescription: slot.kind === 'link' ? '链接摘要' : undefined, comments: [] }))
    }
  }) as never,
  generateImage: (async () => ({ id: 'all-kinds-image', type: 'image', url: 'blob:all-kinds-image', mimeType: 'image/png' })) as never
})
const allKindsPosts = allKindsBatch.postIds.map(id => allKindsSnapshot.posts.find(post => post.id === id)!)
assert.equal(allKindsPosts.length, 12)
assert.deepEqual(new Set(allKindsPosts.map(post => post.contentKind)), new Set(allKinds), '自定义全选 12 种时最终 12 篇必须逐一保留并兑现全部 contentKind')
assert.ok(allKindsPosts.find(post => post.contentKind === 'image-share')?.media?.length, '图片分享最终必须可见图片')
assert.ok(allKindsPosts.find(post => post.contentKind === 'poll')?.pollId, '投票最终必须有可见投票实体')
assert.ok(allKindsPosts.find(post => post.contentKind === 'link')?.linkPreview?.url, '链接分享最终必须有可见链接卡片')
assert.ok(allKindsPosts.find(post => post.contentKind === 'anonymous')?.anonymousIdentityId, '匿名帖最终必须有匿名身份')
assert.ok(allKindsPosts.find(post => post.contentKind === 'circle-topic')?.circleId, '圈子话题最终必须绑定圈子')
const feedItemSource = readFileSync(new URL('../src/components/forum/components/ForumFeedItem.vue', import.meta.url), 'utf8')
const feedViewSource = readFileSync(new URL('../src/components/forum/views/ForumFeedView.vue', import.meta.url), 'utf8')
assert.match(feedItemSource, /forumContentKindLabels/, '生成类型不能只停留在数据层，动态卡片必须显示真实类型标签')
assert.match(feedItemSource, /post\.linkPreview/, '链接分享必须在动态卡片渲染可点击链接，而不只是保存 URL')
assert.match(feedViewSource, /本轮已生成/, '刷新结束必须向用户显示实际生成数量、类型和新圈子结果')

let impossibleConfigRequests = 0
await assert.rejects(() => generateForumContentBatch(allKindsSnapshot, 'viewer', { postCount: 2, requiredCharacterAccountIds: [], postTypeMode: 'custom', allowedContentKinds: ['thought', 'life', 'question'], ensureEverySelectedKind: true }, undefined, { requestJson: (async () => { impossibleConfigRequests += 1; return {} }) as never }), /已选择 3 种帖子类型，但本轮只有 2 篇/)
assert.equal(impossibleConfigRequests, 0, '无法兑现的自定义类型组合必须在调用 AI 前明确拦截')

const strictFailurePostCount = allKindsSnapshot.posts.length
await assert.rejects(() => generateForumContentBatch(allKindsSnapshot, 'viewer', { postCount: 1, requiredCharacterAccountIds: [], postTypeMode: 'custom', allowedContentKinds: ['image-share'], ensureEverySelectedKind: true, discoverCircles: false, includeInitialComments: false, imageUnavailable: 'ai' }, undefined, {
  requestJson: (async (_snapshot: unknown, _request: unknown, _purpose: unknown, instruction: string) => {
    const [slot] = JSON.parse(instruction.slice(instruction.indexOf('完整规划：') + 5)) as Array<{ postKey: string; kind: string; topicDomain: string; topicSeed: string }>
    return { authors: Array.from({ length: 3 }, (_, index) => ({ authorKey: `stranger_${index + 1}`, name: `失败路人${index}`, handle: `failure_${index}` })), circles: [], posts: [{ postKey: slot.postKey, contentKind: slot.kind, topicDomain: slot.topicDomain, topicSeed: slot.topicSeed, content: '图片分享正文', imagePrompt: '必须生成的图片', comments: [] }] }
  }) as never,
  generateImage: (async () => { throw new Error('模拟图片服务失败') }) as never
}), /图片分享生成失败/)
assert.equal(allKindsSnapshot.posts.length, strictFailurePostCount, '显式要求的类型无法兑现时必须整轮回滚，不得静默降级或提交半批内容')

const explicitTextFallback = await generateForumContentBatch(allKindsSnapshot, 'viewer', { postCount: 1, requiredCharacterAccountIds: [], postTypeMode: 'custom', allowedContentKinds: ['image-share'], ensureEverySelectedKind: true, discoverCircles: false, includeInitialComments: false, imageUnavailable: 'text' }, undefined, {
  requestJson: (async (_snapshot: unknown, _request: unknown, _purpose: unknown, instruction: string) => {
    const [slot] = JSON.parse(instruction.slice(instruction.indexOf('完整规划：') + 5)) as Array<{ postKey: string; kind: string; topicDomain: string; topicSeed: string }>
    return { authors: Array.from({ length: 3 }, (_, index) => ({ authorKey: `stranger_${index + 1}`, name: `降级路人${index}`, handle: `fallback_${index}` })), circles: [], posts: [{ postKey: slot.postKey, contentKind: slot.kind, topicDomain: slot.topicDomain, topicSeed: slot.topicSeed, content: '明确允许改成文字的正文', imagePrompt: '会失败的图片', comments: [] }] }
  }) as never,
  generateImage: (async () => { throw new Error('模拟允许降级') }) as never
})
const fallbackPost = allKindsSnapshot.posts.find(post => post.id === explicitTextFallback.postIds[0])
assert.equal(fallbackPost?.type, 'text')
assert.equal(fallbackPost?.contentKind, 'thought', '用户明确允许文字降级时也必须显示真实最终类型，不能把无图文字冒充图片分享')

const discoveryFlowSnapshot = emptyForumSnapshot()
discoveryFlowSnapshot.settings.activeAccountId = 'viewer'
discoveryFlowSnapshot.subjects.push({ id: 'discovery-viewer-subject', kind: 'user', displayName: '查看者', persona: '', createdAt: now, updatedAt: now })
discoveryFlowSnapshot.accounts.push({ id: 'viewer', subjectId: 'discovery-viewer-subject', kind: 'main', name: '查看者', handle: 'discovery_viewer', avatar: '', privacy: 'public', searchable: true, acceptsFollow: true, followRequiresApproval: false, acceptsDm: 'all', showInRecommendations: true, showOnline: true, showCircles: true, joinedAt: now, circleIds: [], lifecycle: 'user' })
discoveryFlowSnapshot.circles.push({ ...circle('legacy-public', '已有圈子', '已有圈子的普通内容'), source: undefined } as never)
const discoveryRequest = (async (_snapshot: unknown, _request: unknown, _purpose: unknown, instruction: string) => {
  const promptPlan = JSON.parse(instruction.slice(instruction.indexOf('完整规划：') + 5)) as Array<{ postKey: string; kind: string; topicDomain: string; topicSeed: string }>
  return {
    authors: Array.from({ length: 8 }, (_, index) => ({ authorKey: `stranger_${index + 1}`, name: `发现路人${index}`, handle: `discover_${Date.now()}_${index}` })),
    circles: [{ circleKey: 'circle_new_1', name: '新发现圈子', avatar: '新', description: '本轮自然发现', contentScope: '一个独立的新兴趣范围', tags: ['新'], memberCount: 88 }],
    posts: promptPlan.map(slot => ({ postKey: slot.postKey, contentKind: slot.kind, topicDomain: slot.topicDomain, topicSeed: slot.topicSeed, content: `${slot.kind} 正文`, imagePrompt: '发现流程图片', pollOptions: ['一','二'], linkUrl: 'https://example.com/discovery', linkTitle: '发现链接', comments: [] }))
  }
}) as never
const discoveryOriginalRandom = Math.random
Math.random = () => .99
const missedDiscoveryBatch = await generateForumContentBatch(discoveryFlowSnapshot, 'viewer', { postCount: 3, requiredCharacterAccountIds: [], discoverCircles: true, includeInitialComments: false }, undefined, { requestJson: discoveryRequest, generateImage: (async () => ({ id: 'discovery-image-1', type: 'image', url: 'blob:discovery-1' })) as never })
assert.equal(missedDiscoveryBatch.circleIds.length, 0, '自动发现首轮自然未命中时不应伪造新圈子')
assert.equal(discoveryFlowSnapshot.settings.circleDiscoveryMisses, 1, '首轮未发现必须记录保底状态')
const guaranteedDiscoveryBatch = await generateForumContentBatch(discoveryFlowSnapshot, 'viewer', { postCount: 3, requiredCharacterAccountIds: [], discoverCircles: true, includeInitialComments: false }, undefined, { requestJson: discoveryRequest, generateImage: (async () => ({ id: 'discovery-image-2', type: 'image', url: 'blob:discovery-2' })) as never })
Math.random = discoveryOriginalRandom
assert.equal(guaranteedDiscoveryBatch.circleIds.length, 1, '连续一次未发现后的下一轮必须真实创建一个新圈子')
assert.ok(guaranteedDiscoveryBatch.postIds.some(id => discoveryFlowSnapshot.posts.find(post => post.id === id)?.circleId === guaranteedDiscoveryBatch.circleIds[0]), '新圈子必须绑定本轮真实帖子')
assert.equal(discoveryFlowSnapshot.settings.circleDiscoveryMisses, 0, '成功发现后必须重置保底计数')

const splitSnapshot = emptyForumSnapshot()
splitSnapshot.settings.activeAccountId = 'viewer'
splitSnapshot.settings.aiContextTokenBudget = 16_000
splitSnapshot.subjects.push({ id: 'split-viewer-subject', kind: 'user', displayName: '查看者', persona: '不应成为批次主题', createdAt: now, updatedAt: now })
splitSnapshot.accounts.push({ id: 'viewer', subjectId: 'split-viewer-subject', kind: 'main', name: '查看者', handle: 'split_viewer', avatar: '', privacy: 'public', searchable: true, acceptsFollow: true, followRequiresApproval: false, acceptsDm: 'all', showInRecommendations: true, showOnline: true, showCircles: true, joinedAt: now, circleIds: [], lifecycle: 'user' })
let splitRequests = 0
await generateForumContentBatch(splitSnapshot, 'viewer', { postCount: 8, requiredCharacterAccountIds: [], discoverCircles: false, includeInitialComments: false, npcGenerationMode: 'full' }, undefined, {
  requestJson: (async (_snapshot: unknown, request: { involvedAccountIds?: string[] }, _purpose: unknown, instruction: string) => {
    splitRequests += 1
    assert.deepEqual(request.involvedAccountIds, [], '首页批量生成不得把某个角色的近期帖子和 memory 作为整批共同上下文')
    const promptPlan = JSON.parse(instruction.slice(instruction.indexOf('完整规划：') + 5)) as Array<{ postKey: string; kind: string; topicDomain: string; topicSeed: string; comments: Array<{ commentKey: string }> }>
    return {
      authors: Array.from({ length: 20 }, (_, index) => ({ authorKey: `stranger_${index + 1}`, name: `分批路人${index + 1}`, handle: `split_${splitRequests}_${index + 1}`, bio: '普通网友', expressionStyle: '自然表达' })),
      circles: [],
      posts: promptPlan.map((slot, index) => ({ postKey: slot.postKey, contentKind: slot.kind, topicDomain: slot.topicDomain, topicSeed: slot.topicSeed, content: `分批帖子 ${splitRequests}-${index}`, pollOptions: ['选项一','选项二'], linkUrl: 'https://example.com/item', linkTitle: '示例链接', imagePrompt: '普通生活照片', comments: [] }))
    }
  }) as never,
  generateImage: (async () => ({ id: `split-image-${splitRequests}`, type: 'image', url: 'blob:split-image', mimeType: 'image/png' })) as never
})
assert.ok(splitRequests > 1, '高上下文成本时应进入多个技术子批次')
const splitSlots = splitSnapshot.generationSessions.flatMap(session => session.plan?.slots || [])
assert.equal(splitSlots.length, 8)
assert.equal(new Set(splitSlots.map(slot => slot.topicSeed)).size, 8, '多个技术子批次必须共享本轮已用 topicSeed 约束')
assert.equal(new Set(splitSlots.filter(slot => !slot.circleId).map(slot => slot.topicDomain)).size, splitSlots.filter(slot => !slot.circleId).length, '多个技术子批次不得重新坍缩到相同公共领域')

const postsBeforeAtomicFailure = splitSnapshot.posts.length
const batchesBeforeAtomicFailure = splitSnapshot.contentBatches.length
let atomicFailureRequests = 0
await assert.rejects(() => generateForumContentBatch(splitSnapshot, 'viewer', { postCount: 8, requiredCharacterAccountIds: [], discoverCircles: false, includeInitialComments: false, npcGenerationMode: 'full' }, undefined, {
  requestJson: (async (_snapshot: unknown, _request: unknown, _purpose: unknown, instruction: string) => {
    atomicFailureRequests += 1
    if (atomicFailureRequests === 2) throw new Error('模拟第二个技术子批次失败')
    const promptPlan = JSON.parse(instruction.slice(instruction.indexOf('完整规划：') + 5)) as Array<{ postKey: string; kind: string; topicDomain: string; topicSeed: string }>
    return {
      authors: Array.from({ length: 20 }, (_, index) => ({ authorKey: `stranger_${index + 1}`, name: `回滚路人${index + 1}`, handle: `rollback_${index + 1}`, bio: '普通网友', expressionStyle: '自然表达' })), circles: [],
      posts: promptPlan.map(slot => ({ postKey: slot.postKey, contentKind: slot.kind, topicDomain: slot.topicDomain, topicSeed: slot.topicSeed, content: `${slot.kind} 回滚测试正文`, pollOptions: ['选项一','选项二'], linkUrl: 'https://example.com/rollback', linkTitle: '回滚链接', imagePrompt: '回滚测试照片', comments: [] }))
    }
  }) as never,
  generateImage: (async () => ({ id: 'rollback-image', type: 'image', url: 'blob:rollback-image', mimeType: 'image/png' })) as never
}), /本轮没有提交/)
assert.equal(atomicFailureRequests, 2, '原子回滚用例必须真实进入第二个技术子批次')
assert.equal(splitSnapshot.posts.length, postsBeforeAtomicFailure, '后续技术子批次失败时，前一子批次帖子也不能泄漏到用户数据')
assert.equal(splitSnapshot.contentBatches.length, batchesBeforeAtomicFailure, '后续技术子批次失败时，批次记录也必须保持不变')

const disabledSnapshot = JSON.parse(JSON.stringify(batchSnapshot))
disabledSnapshot.posts = []; disabledSnapshot.comments = []; disabledSnapshot.contentBatches = []; disabledSnapshot.generationSessions = []
disabledSnapshot.participantPolicies.find((item: { subjectId: string }) => item.subjectId === 'subject-character').enabled = false
let disabledRequests = 0
await assert.rejects(() => generateForumContentBatch(disabledSnapshot, 'viewer', { postCount: 1, requiredCharacterAccountIds: ['character-a'] }, undefined, { requestJson: (async () => { disabledRequests += 1; return {} }) as never }), /未启用或已不可用/)
assert.equal(disabledRequests, 0, '禁用角色必须在文本 API 调用前被拦截')
assert.equal(disabledSnapshot.posts.length, 0, '失败时不得提交半成品帖子快照')

forumGenerationRuntime.summary = { postIds: ['stale'], postCount: 1, kindCounts: { thought: 1 }, circleIds: [], circleNames: [] }
assert.equal(await runSingleForumGenerationTask(async () => { throw new Error('模拟保存失败') }), false)
assert.equal(forumGenerationRuntime.summary, undefined, '生成或保存失败后不得继续显示一份虚假的成功摘要')

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
