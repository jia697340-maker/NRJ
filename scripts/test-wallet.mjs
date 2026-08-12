import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'

const memory = new Map()
globalThis.localStorage = {
  getItem: key => memory.has(key) ? memory.get(key) : null,
  setItem: (key, value) => memory.set(key, String(value)),
  removeItem: key => memory.delete(key),
  clear: () => memory.clear()
}
globalThis.window = { dispatchEvent: () => true }
globalThis.CustomEvent = class CustomEvent {
  constructor(type, init) { this.type = type; this.detail = init?.detail }
}

const source = await readFile('src/services/walletService.ts', 'utf8')
const transpiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
}).outputText
const wallet = await import(`data:text/javascript;base64,${Buffer.from(transpiled).toString('base64')}`)

const state = wallet.createWalletState('user-1', '用户')
memory.set('clingy_wallet_state_v1_legacy-user', JSON.stringify({
  owners: {
    'user:legacy-user': { cashCents: 3200, heldCents: 0 },
    'character:old-role': { cashCents: 999999, heldCents: 0 }
  },
  channels: [{ id: 'old-wallet-message' }]
}))
const migrated = wallet.loadWalletState('legacy-user', '旧用户')
assert.equal(migrated.cashCents, 3200, '旧用户余额应迁移')
assert.equal('owners' in migrated, false, '迁移时必须丢弃所有角色账户')
assert.equal('channels' in migrated, false, '迁移时必须丢弃钱包私信数据')

wallet.setWalletBalance(state, 100000, '测试初始余额')
wallet.saveWalletState(state)

const outgoing = wallet.createWalletPayment({
  accountId: 'user-1', senderType: 'user', amountCents: 2500,
  kind: 'transfer', remark: '测试转账'
})
let stored = wallet.loadWalletState('user-1')
assert.equal(stored.cashCents, 97500, '用户发出转账时应扣除可用余额')
assert.equal(stored.heldCents, 2500, '用户发出转账时应冻结资金')
assert.equal('owners' in stored, false, '钱包不能创建角色账户映射')

assert.equal(wallet.resolveWalletPayment('user-1', outgoing.id, 'claimed').ok, true)
stored = wallet.loadWalletState('user-1')
assert.equal(stored.cashCents, 97500, '对方领取不应再次扣款')
assert.equal(stored.heldCents, 0, '对方领取后应释放冻结资金')
assert.equal(wallet.resolveWalletPayment('user-1', outgoing.id, 'claimed').reason, 'already_resolved')

const refund = wallet.createWalletPayment({
  accountId: 'user-1', senderType: 'user', amountCents: 1500,
  kind: 'red_packet', remark: '退款测试'
})
wallet.resolveWalletPayment('user-1', refund.id, 'expired')
stored = wallet.loadWalletState('user-1')
assert.equal(stored.cashCents, 97500, '红包过期后应退回用户余额')
assert.equal(stored.heldCents, 0)

const incoming = wallet.createWalletPayment({
  accountId: 'user-1', senderType: 'character', amountCents: 8800,
  kind: 'red_packet', remark: '收到红包'
})
stored = wallet.loadWalletState('user-1')
assert.equal(stored.cashCents, 97500, '收到但未领取时不应入账')
wallet.resolveWalletPayment('user-1', incoming.id, 'claimed')
stored = wallet.loadWalletState('user-1')
assert.equal(stored.cashCents, 106300, '领取角色发来的红包时只增加用户余额')
assert.equal('owners' in stored, false, '领取后仍不能出现角色钱包')

const quote = stored.quotes[0]
const order = wallet.placeWalletOrder(stored, {
  code: quote.code, side: 'buy', orderType: 'market', quantity: 10, fundingSource: 'balance'
})
assert.equal(order.status, 'filled')
assert.equal(stored.positions[0].quantity, 10)

stored.credit.usedCents = 1000
stored.credit.transactions = [{ id: 'credit-1', title: '测试', amountCents: 1000, repaidCents: 0, createdAt: Date.now() }]
wallet.repayWalletCredit(stored, 500)
assert.equal(stored.credit.usedCents, 500)

console.log('wallet service tests passed')
