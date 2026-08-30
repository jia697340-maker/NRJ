import assert from 'node:assert/strict'
import {
  adjacentReplyVariantId,
  completeReplyReplacement,
  completeReplyRegeneration,
  deleteActiveReplyVariant,
  hasPendingReplyReplacement,
  keepOnlyActiveReplyVariant,
  prepareReplyReplacement,
  prepareReplyRegeneration,
  recoverInterruptedReplyRegeneration,
  restoreReplyAfterReplacementFailure,
  restorePreviousReplyAfterFailure,
  restoreReplyVariant
} from '../src/services/replyVariants'

const chat: any = {
  messages: [
    { id: 1, type: 'right', content: '你好', turnId: 'user_1' },
    { id: 2, type: 'left', content: '你好呀', turnId: 'turn_1' },
    { id: 3, type: 'left', content: '今天过得好吗？', turnId: 'turn_1' }
  ],
  innerThoughts: [{ id: 'thought_1', turnId: 'turn_1', content: '很开心' }],
  statusText: '在线'
}

const failedSession = prepareReplyRegeneration(chat, 'single')
assert.ok(failedSession)
assert.equal(chat.messages.length, 1)
const interrupted = JSON.parse(JSON.stringify(chat))
assert.equal(recoverInterruptedReplyRegeneration(interrupted), true)
assert.equal(interrupted.messages.at(-1).content, '今天过得好吗？')
assert.equal(interrupted.pendingReplyVariantSetId, undefined)
restorePreviousReplyAfterFailure(chat, failedSession!)
assert.deepEqual(chat.messages.map((message: any) => message.content), ['你好', '你好呀', '今天过得好吗？'])

const session = prepareReplyRegeneration(chat, 'single')
assert.ok(session)
chat.messages.push({ id: 4, type: 'left', content: '抱抱你。', turnId: session!.turnId })
chat.innerThoughts.push({ id: 'thought_2', turnId: session!.turnId, content: '想安慰她' })
assert.equal(completeReplyRegeneration(chat, session!), true)
assert.equal(chat.replyVariantSets[0].variants.length, 2)
assert.equal(chat.messages.at(-1).content, '抱抱你。')

const previousId = adjacentReplyVariantId(chat, session!.setId, -1)
assert.ok(previousId)
assert.equal(restoreReplyVariant(chat, session!.setId, previousId!).ok, true)
assert.equal(chat.messages.at(-1).content, '今天过得好吗？')
assert.equal(chat.innerThoughts[0].content, '很开心')

chat.messages.push({ id: 5, type: 'right', content: '还不错', turnId: 'user_2' })
const newerId = adjacentReplyVariantId(chat, session!.setId, 1)
const historicalResult = restoreReplyVariant(chat, session!.setId, newerId!)
assert.equal(historicalResult.needsTimeline, true)
assert.equal(chat.messages.at(-1).content, '还不错')

const group: any = {
  messages: [
    { id: 10, type: 'right', content: '大家好' },
    { id: 11, type: 'left', senderId: 'a', content: '你好', turnId: 'group_turn_1' },
    { id: 12, type: 'system', content: '群公告建议', turnId: 'group_turn_1' }
  ],
  innerThoughts: [{ id: 'gt', turnId: 'group_turn_1', content: '欢迎' }],
  memberInnerThoughts: { a: [{ id: 'gt', turnId: 'group_turn_1', content: '欢迎' }] }
}
const groupSession = prepareReplyRegeneration(group, 'group')
assert.ok(groupSession)
assert.equal(group.messages.length, 1)
restorePreviousReplyAfterFailure(group, groupSession!)
assert.equal(group.messages.length, 3)

const replacementChat: any = {
  messages: [
    { id: 20, type: 'right', content: '问题', turnId: 'user_replace' },
    { id: 21, type: 'left', content: '旧回复', turnId: 'turn_replace' }
  ],
  innerThoughts: [{ id: 'replace_thought', turnId: 'turn_replace', content: '旧心声' }]
}
const replacementSession = prepareReplyReplacement(replacementChat, 'single')
assert.ok(replacementSession)
assert.equal(hasPendingReplyReplacement(replacementChat), true)
assert.equal(Object.keys(replacementChat).includes('_pendingReplyReplacement'), false)
assert.equal(replacementChat.replyVariantSets?.length || 0, 0)
replacementChat.messages.push({ id: 22, type: 'left', content: '新回复', turnId: replacementSession!.turnId })
assert.equal(completeReplyReplacement(replacementChat, replacementSession!), true)
assert.equal(hasPendingReplyReplacement(replacementChat), false)
assert.deepEqual(replacementChat.messages.map((message: any) => message.content), ['问题', '新回复'])
assert.equal(replacementChat.replyVariantSets?.length || 0, 0)
assert.equal(replacementChat.messages.some((message: any) => message.replyVariantSetId || message.replyVariantId), false)

const failedReplacement = prepareReplyReplacement(replacementChat, 'single')
assert.ok(failedReplacement)
replacementChat.messages.push({ id: 23, type: 'left', content: '半截回复', turnId: failedReplacement!.turnId })
restoreReplyAfterReplacementFailure(replacementChat, failedReplacement!)
assert.deepEqual(replacementChat.messages.map((message: any) => message.content), ['问题', '新回复'])
assert.equal(replacementChat.replyVariantSets?.length || 0, 0)

const cleanupChat: any = {
  messages: [
    { id: 30, type: 'right', content: '给我三个版本', turnId: 'user_cleanup' },
    { id: 31, type: 'left', content: '版本 A', turnId: 'turn_cleanup' }
  ],
  innerThoughts: []
}
const toB = prepareReplyRegeneration(cleanupChat, 'single')!
cleanupChat.messages.push({ id: 32, type: 'left', content: '版本 B', turnId: toB.turnId })
assert.equal(completeReplyRegeneration(cleanupChat, toB), true)
const toC = prepareReplyRegeneration(cleanupChat, 'single')!
cleanupChat.messages.push({ id: 33, type: 'left', content: '版本 C', turnId: toC.turnId })
assert.equal(completeReplyRegeneration(cleanupChat, toC), true)
const cleanupSet = cleanupChat.replyVariantSets[0]
assert.equal(cleanupSet.variants.length, 3)
assert.equal(restoreReplyVariant(cleanupChat, cleanupSet.id, cleanupSet.variants[1].id).ok, true)
assert.equal(deleteActiveReplyVariant(cleanupChat, cleanupSet.id).ok, true)
assert.deepEqual(cleanupSet.variants.map((variant: any) => variant.messages[0].content), ['版本 A', '版本 C'])
assert.equal(cleanupChat.messages.at(-1).content, '版本 C')
assert.equal(cleanupSet.activeVariantId, cleanupSet.variants[1].id)
assert.equal(JSON.stringify(cleanupChat).includes('版本 B'), false)

assert.equal(restoreReplyVariant(cleanupChat, cleanupSet.id, cleanupSet.variants[0].id).ok, true)
const serializedBeforeCleanup = JSON.stringify(cleanupChat)
assert.equal(keepOnlyActiveReplyVariant(cleanupChat, cleanupSet.id).ok, true)
const serializedAfterCleanup = JSON.stringify(cleanupChat)
assert.equal(cleanupChat.replyVariantSets.length, 0)
assert.equal(cleanupChat.messages.at(-1).content, '版本 A')
assert.equal(cleanupChat.messages.some((message: any) => message.replyVariantSetId || message.replyVariantId), false)
assert.ok(serializedAfterCleanup.length < serializedBeforeCleanup.length)
assert.equal(serializedAfterCleanup.includes('replyVariantSetId'), false)

const existingHistoryReplacement: any = {
  messages: [
    { id: 40, type: 'right', content: '保留已有历史', turnId: 'user_existing' },
    { id: 41, type: 'left', content: '已有 A', turnId: 'turn_existing' }
  ],
  innerThoughts: []
}
const existingToB = prepareReplyRegeneration(existingHistoryReplacement, 'single')!
existingHistoryReplacement.messages.push({ id: 42, type: 'left', content: '已有 B', turnId: existingToB.turnId })
completeReplyRegeneration(existingHistoryReplacement, existingToB)
const existingSet = existingHistoryReplacement.replyVariantSets[0]
const existingCount = existingSet.variants.length
const replaceExisting = prepareReplyReplacement(existingHistoryReplacement, 'single')!
existingHistoryReplacement.messages.push({ id: 43, type: 'left', content: '替换后的 B', turnId: replaceExisting.turnId })
assert.equal(completeReplyReplacement(existingHistoryReplacement, replaceExisting), true)
assert.equal(existingSet.variants.length, existingCount)
assert.equal(existingSet.variants.find((variant: any) => variant.id === existingSet.activeVariantId).messages[0].content, '替换后的 B')
assert.equal(existingSet.variants.some((variant: any) => variant.messages.some((message: any) => message.content === '已有 B')), false)
assert.equal(JSON.stringify(existingHistoryReplacement).includes('已有 B'), false)

console.log('reply variant tests passed')
