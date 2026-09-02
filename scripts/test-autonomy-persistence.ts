import assert from 'node:assert/strict'

const memory = new Map<string, string>()
let writes = 0

Object.defineProperty(globalThis, 'localStorage', { value: {
  getItem: (key: string) => memory.get(key) ?? null,
  setItem: (key: string, value: string) => { writes += 1; memory.set(key, String(value)) },
  removeItem: (key: string) => { memory.delete(key) },
  clear: () => memory.clear(),
  key: (index: number) => [...memory.keys()][index] ?? null,
  get length() { return memory.size }
} })

Object.defineProperty(globalThis, 'window', { value: globalThis })
Object.defineProperty(globalThis, 'CustomEvent', { value: class CustomEvent {
  constructor(public type: string, public init?: unknown) {}
} })

const {
  beginAutonomyPersistenceBatch,
  flushAutonomyPersistenceBatch,
  persistAutonomyChat
} = await import('../src/services/characterAutonomy')

Object.defineProperty(globalThis, 'document', { value: {
  dispatchEvent: () => true,
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
  visibilityState: 'visible'
} })

const storageKey = 'clingy_custom_contacts'
memory.set(storageKey, JSON.stringify([
  { id: 101, name: '角色一', messages: [], unread: 0 },
  { id: 102, name: '角色二', messages: [], unread: 0 }
]))
writes = 0

const first = { id: 101, messages: [{ id: 1, content: '旧消息' }], unread: 1, autonomyState: { nextCheckAt: 1 } }
const second = { id: 102, messages: [], unread: 2, autonomyState: { nextCheckAt: 2 } }

beginAutonomyPersistenceBatch()
persistAutonomyChat(first)
first.messages.push({ id: 2, content: '最终消息' })
first.unread = 3
persistAutonomyChat(first)
persistAutonomyChat(second)

assert.equal(writes, 0, '批处理进行中不得同步重写完整联系人数据')
flushAutonomyPersistenceBatch()
assert.equal(writes, 1, '同一批次的多个联系人只能触发一次完整联系人写入')

const saved = JSON.parse(memory.get(storageKey) || '[]')
assert.equal(saved[0].messages.length, 2, '同一联系人重复更新时必须保留最终状态')
assert.equal(saved[0].unread, 3, '同一联系人的最终未读状态必须保存')
assert.equal(saved[1].unread, 2, '批次内其他联系人也必须完整保存')
assert.equal(saved[0].name, '角色一', '自主状态持久化不得覆盖无关联系人字段')

console.log('autonomy persistence batching checks passed')
