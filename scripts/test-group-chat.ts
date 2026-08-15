import assert from 'node:assert/strict'

const storage = new Map<string, string>()
Object.defineProperty(globalThis, 'localStorage', {
  value: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, String(value)),
    removeItem: (key: string) => storage.delete(key),
    key: (index: number) => [...storage.keys()][index] ?? null,
    get length() { return storage.size }
  },
  configurable: true
})

const { buildGroupChatMessages, createGroupChat, parseGroupResponse } = await import('../src/services/groupChat.ts')

const contacts = [
  { id: 'a', name: '阿岚', persona: '直率，习惯先回应朋友的玩笑。', memoryBook: [] },
  { id: 'b', name: '白露', persona: '慢热，有自己的话题和作息。', memoryBook: [] }
]
const group = createGroupChat({ name: '周末碰头', groupContext: '', memberIds: ['a', 'b'] }, { name: '小满' })
let payload = await buildGroupChatMessages(group, contacts, { name: '小满' })
assert.equal(payload.length, 1)
assert.doesNotMatch(payload[0].content, /可选群背景/)
assert.match(payload[0].content, /用户只是群成员之一/)
assert.match(payload[0].content, /display_name="阿岚"/)
assert.match(payload[0].content, /单聊全局提示词/)

group.groupContext = '这是一起旅行前临时建的群。'
payload = await buildGroupChatMessages(group, contacts, { name: '小满' })
assert.match(payload[0].content, /可选群背景/)
assert.match(payload[0].content, /一起旅行前临时建的群/)

const parsed = parseGroupResponse('<group_msg sender="b">先等等，我还没收拾好。</group_msg><group_msg sender="a" reply_to="12" mentions="b">@白露 你每次都这么说。</group_msg>', ['a', 'b'])
assert.deepEqual(parsed.messages.map(item => item.senderId), ['b', 'a'])
assert.equal(parsed.messages[1].replyToMessageId, '12')
assert.deepEqual(parsed.messages[1].mentions, ['b'])
assert.equal(parseGroupResponse('<group_msg sender="unknown">越权消息</group_msg><group_idle />', ['a', 'b']).messages.length, 0)
assert.equal(parseGroupResponse('<group_idle />', ['a', 'b']).idle, true)

console.log('Group chat prompt and response protocol tests passed.')
