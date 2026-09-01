import assert from 'node:assert/strict'

const memory = new Map<string, string>()
Object.defineProperty(globalThis, 'localStorage', { value: {
  getItem: (key: string) => memory.get(key) ?? null,
  setItem: (key: string, value: string) => { memory.set(key, String(value)) },
  removeItem: (key: string) => { memory.delete(key) },
  clear: () => memory.clear(),
  key: (index: number) => [...memory.keys()][index] ?? null,
  get length() { return memory.size }
} })

const { createManualPhoneDevice, parsePhoneReadRequests } = await import('../src/services/characterPhone')
const { defaultCharacterPhoneSettings } = await import('../src/services/characterPhoneRepository')

const device = createManualPhoneDevice()
assert.equal(device.lockType, 'none', '手建设备不得强制存在密码')
assert.ok(device.apps.some(app => app.id === 'chat'), '手建设备必须可进入聊天 APP')
assert.ok(device.apps.some(app => app.id === 'settings'), '手建设备必须可进入设置 APP')
assert.ok(device.apps.every(app => app.refreshMode === 'manual'), 'APP 默认不得在未授权时自动调用 API')

const parsed = parsePhoneReadRequests('先看看<read_phone app_id="chat" target="unread"/>再决定')
assert.equal(parsed.cleaned, '先看看再决定')
assert.deepEqual(parsed.requests, [{ appId: 'chat', target: 'unread' }])

const settings = defaultCharacterPhoneSettings()
assert.equal(settings.allowUseDuringChat, false, '手机不得默认影响单聊')
assert.equal(settings.allowBackgroundUse, false, '手机不得默认参与后台活动')
assert.equal(settings.bridgeToChat, false, '手机事件桥接必须由用户显式开启')
assert.equal(settings.allowDeepReadFollowup, false, '额外读取调用必须由用户显式开启')
assert.ok(settings.contextTokenBudget > 0 && settings.contextTokenBudget <= 1000, '默认上下文预算应保持克制')

console.log('character phone checks passed')
