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

const { nextTick } = await import('vue')
const { appStats, flushAppStatsStorage } = await import('../src/store/global')

appStats.usageTime += 1
appStats.usageTime += 1
appStats.usageTime += 1
await nextTick()

assert.equal(writes, 0, '连续使用时长更新不得每秒同步写入 localStorage')
flushAppStatsStorage()
assert.equal(writes, 1, '退出或隐藏页面时必须立即合并保存统计数据')
assert.equal(JSON.parse(memory.get('clingy_app_stats') || '{}').usageTime, appStats.usageTime, '合并保存不得丢失使用时长')

console.log('app stats persistence checks passed')
