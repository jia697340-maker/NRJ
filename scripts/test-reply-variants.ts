import assert from 'node:assert/strict'
import {
  adjacentReplyVariantId,
  completeReplyRegeneration,
  prepareReplyRegeneration,
  recoverInterruptedReplyRegeneration,
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

console.log('reply variant tests passed')
