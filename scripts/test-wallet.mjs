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

stored.bankCards.push({ id: 'debit-1', name: '测试储蓄卡', type: 'debit', lastFour: '1234', enabled: true, createdAt: Date.now(), balanceCents: 5000 })
stored.credit = { ...stored.credit, enabled: true, limitCents: 10000, usedCents: 0, transactions: [] }
wallet.saveWalletState(stored)
const bankPayment = wallet.createWalletPayment({
  accountId: 'user-1', senderType: 'user', amountCents: 1200,
  kind: 'transfer', remark: '银行卡付款', fundingSource: 'bank_card', fundingSourceId: 'debit-1'
})
stored = wallet.loadWalletState('user-1')
assert.equal(stored.bankCards[0].balanceCents, 3800, '银行卡付款必须从所选银行卡扣款')
assert.equal(stored.cashCents, 106300, '银行卡付款不得误扣钱包余额')
wallet.resolveWalletPayment('user-1', bankPayment.id, 'rejected')
stored = wallet.loadWalletState('user-1')
assert.equal(stored.bankCards[0].balanceCents, 5000, '银行卡付款退回时必须原路退卡')

const creditPayment = wallet.createWalletPayment({
  accountId: 'user-1', senderType: 'user', amountCents: 1800,
  kind: 'red_packet', remark: '花呗付款', fundingSource: 'credit'
})
stored = wallet.loadWalletState('user-1')
assert.equal(stored.credit.usedCents, 1800, '花呗付款必须形成待还金额')
assert.equal(stored.credit.transactions[0].relatedId, creditPayment.id, '花呗明细必须关联原付款')
wallet.resolveWalletPayment('user-1', creditPayment.id, 'expired')
stored = wallet.loadWalletState('user-1')
assert.equal(stored.credit.usedCents, 0, '花呗付款过期后必须撤销待还金额')
assert.equal(stored.credit.transactions[0].repaidCents, 1800, '退款后的花呗明细必须标记已结清')

const quote = stored.quotes[0]
const order = wallet.placeWalletOrder(stored, {
  code: quote.code, side: 'buy', orderType: 'market', quantity: 10, fundingSource: 'balance'
})
assert.equal(order.status, 'filled')
assert.equal(stored.positions[0].quantity, 10)

const cashBeforeLimit = stored.cashCents
const limitOrder = wallet.placeWalletOrder(stored, {
  code: quote.code, side: 'buy', orderType: 'limit', quantity: 2,
  limitPriceCents: quote.priceCents - 1, fundingSource: 'balance'
})
assert.equal(limitOrder.status, 'pending')
assert.equal(stored.heldCents, (quote.priceCents - 1) * 2, '限价买单必须冻结对应资金')
wallet.cancelWalletOrder(stored, limitOrder.id)
assert.equal(stored.cashCents, cashBeforeLimit, '撤销限价买单必须全额退回冻结资金')
assert.equal(stored.heldCents, 0)

stored.marketSettings.mode = 'live'
stored.liveQuotes[0].priceCents = 10000
stored.liveQuotes[0].previousCloseCents = 9800
const liveOrder = wallet.placeWalletOrder(stored, {
  code: stored.liveQuotes[0].code, side: 'buy', orderType: 'market', quantity: 1, fundingSource: 'balance'
})
assert.equal(liveOrder.status, 'filled')
assert.equal(stored.livePositions[0].quantity, 1, '真实行情模拟持仓必须独立保存')
assert.equal(stored.positions[0].quantity, 10, '真实行情交易不得覆盖原模拟持仓')

stored.credit.usedCents = 1000
stored.credit.transactions = [{ id: 'credit-1', title: '测试', amountCents: 1000, repaidCents: 0, createdAt: Date.now() }]
wallet.repayWalletCredit(stored, 500)
assert.equal(stored.credit.usedCents, 500)

console.log('wallet service tests passed')
