import assert from 'node:assert/strict'
import {
  applyIdentityClock,
  formatIdentityDateTime,
  getConversationAdjustedTimestamp,
  getIdentityTimestamp,
  isConversationTimePaused,
  pauseConversationTime,
  resumeConversationTime
} from '../src/services/conversationTime'

const realAnchor = Date.UTC(2026, 7, 22, 4, 0)
const user: any = {}
const character: any = {}

applyIdentityClock(user, {
  clockMode: 'custom', timezone: 'Asia/Shanghai',
  clockAnchorRealAt: realAnchor,
  clockAnchorTimeAt: Date.UTC(2030, 0, 2, 23, 30)
})
applyIdentityClock(character, {
  clockMode: 'custom', timezone: 'America/New_York',
  clockAnchorRealAt: realAnchor,
  clockAnchorTimeAt: Date.UTC(1999, 4, 6, 8, 15)
})

assert.equal(getIdentityTimestamp(user, realAnchor + 45 * 60_000), Date.UTC(2030, 0, 3, 0, 15))
assert.equal(getIdentityTimestamp(character, realAnchor + 45 * 60_000), Date.UTC(1999, 4, 6, 9, 0))
assert.notEqual(formatIdentityDateTime(user, realAnchor), formatIdentityDateTime(character, realAnchor))

const chat: any = {
  autonomyLastRunAt: realAnchor - 60_000,
  incomingCallLastAt: realAnchor - 120_000,
  autonomyState: { lastCheckedAt: realAnchor - 30_000, nextCheckAt: realAnchor + 60_000 }
}
pauseConversationTime(chat, realAnchor)
assert.equal(isConversationTimePaused(chat), true)
resumeConversationTime(chat, realAnchor + 3 * 24 * 60 * 60_000)
assert.equal(isConversationTimePaused(chat), false)

const hiddenDuration = 3 * 24 * 60 * 60_000
assert.equal(getConversationAdjustedTimestamp(chat, realAnchor - 5 * 60_000), realAnchor - 5 * 60_000 + hiddenDuration)
assert.equal(getConversationAdjustedTimestamp(chat, realAnchor + hiddenDuration + 5 * 60_000), realAnchor + hiddenDuration + 5 * 60_000)
assert.equal(chat.autonomyState.lastCheckedAt, realAnchor - 30_000 + hiddenDuration)
assert.equal(chat.autonomyState.nextCheckAt, realAnchor + 60_000 + hiddenDuration)

console.log('conversation time tests passed')
