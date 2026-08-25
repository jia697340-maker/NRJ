/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import assert from 'node:assert/strict'
const memory = new Map<string, string>()
Object.defineProperty(globalThis, 'localStorage', { value: { getItem: (key: string) => memory.get(key) ?? null, setItem: (key: string, value: string) => memory.set(key, value), removeItem: (key: string) => memory.delete(key), key: (index: number) => [...memory.keys()][index] ?? null, clear: () => memory.clear(), get length() { return memory.size } } })
const { emptyForumSnapshot } = await import('../src/services/forumRepository')
const { createForumDistributionPlan, normalizeForumGenerationConfig } = await import('../src/services/forumGeneration')
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
console.log('forum generation tests passed')
