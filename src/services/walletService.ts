/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */

export type WalletFundingSource = 'balance' | 'credit'
export type WalletTransferResolution = 'claimed' | 'rejected' | 'expired'

export interface WalletLedgerEntry {
  id: string
  category: string
  title: string
  amountCents: number
  balanceAfterCents: number
  createdAt: number
  relatedId?: string
  note?: string
}

export interface WalletPayment {
  id: string
  direction: 'outgoing' | 'incoming'
  amountCents: number
  kind: 'transfer' | 'red_packet'
  remark: string
  status: 'pending' | WalletTransferResolution
  createdAt: number
  resolvedAt?: number
}

export interface WalletQuote {
  code: string
  name: string
  sector: string
  priceCents: number
  previousCloseCents: number
  history: number[]
}

export interface WalletPosition { code: string; quantity: number; averageCostCents: number }
export interface WalletOrder {
  id: string
  code: string
  side: 'buy' | 'sell'
  orderType: 'market' | 'limit'
  quantity: number
  limitPriceCents?: number
  fundingSource: WalletFundingSource
  status: 'pending' | 'filled' | 'cancelled' | 'rejected'
  createdAt: number
  filledAt?: number
  filledPriceCents?: number
  rejectReason?: string
}
export interface WalletCreditTransaction { id: string; title: string; amountCents: number; repaidCents: number; createdAt: number }
export interface WalletCredit {
  enabled: boolean
  limitCents: number
  usedCents: number
  billingDay: number
  repaymentDay: number
  transactions: WalletCreditTransaction[]
}
export interface WalletBankCard { id: string; name: string; lastFour: string; enabled: boolean; createdAt: number }

export interface WalletState {
  schemaVersion: 2
  accountId: string
  accountName: string
  paymentHandle: string
  cashCents: number
  heldCents: number
  ledger: WalletLedgerEntry[]
  payments: WalletPayment[]
  quotes: WalletQuote[]
  positions: WalletPosition[]
  orders: WalletOrder[]
  watchlist: string[]
  credit: WalletCredit
  bankCards: WalletBankCard[]
  hideAmounts: boolean
  market: { tick: number; lastAdvancedAt: number }
}

const STORAGE_PREFIX = 'clingy_wallet_state_v2_'
const LEGACY_PREFIX = 'clingy_wallet_state_v1_'
const EVENT_NAME = 'clingy-wallet-updated'
const uid = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
const cents = (value: number) => Math.max(0, Math.round(Number(value) || 0))

const quoteSeeds: Array<[string, string, string, number]> = [
  ['CLY001', '微光科技', '科技', 2865], ['CLY002', '云帆网络', '科技', 1732],
  ['CLY003', '春潮消费', '消费', 4260], ['CLY004', '青禾医药', '医药', 3188],
  ['CLY005', '远山能源', '能源', 1246], ['CLY006', '星港金融', '金融', 2384],
  ['CLY007', '栖木文娱', '文娱', 1960], ['CLY008', '长风制造', '制造', 3515]
]

const makePaymentHandle = (accountId: string) => {
  let hash = 17
  for (const char of accountId) hash = (hash * 33 + char.charCodeAt(0)) >>> 0
  return `PAY${String(hash).padStart(9, '0').slice(-9)}`
}

export const walletStorageKey = (accountId: string) => `${STORAGE_PREFIX}${accountId || 'guest'}`
export const walletUpdateEventName = EVENT_NAME

export const createWalletState = (accountId: string, accountName = '我'): WalletState => ({
  schemaVersion: 2,
  accountId,
  accountName,
  paymentHandle: makePaymentHandle(accountId),
  cashCents: 0,
  heldCents: 0,
  ledger: [],
  payments: [],
  quotes: quoteSeeds.map(([code, name, sector, priceCents]) => ({ code, name, sector, priceCents, previousCloseCents: priceCents, history: [priceCents] })),
  positions: [], orders: [], watchlist: ['CLY001', 'CLY003', 'CLY006'],
  credit: { enabled: true, limitCents: 500000, usedCents: 0, billingDay: 5, repaymentDay: 15, transactions: [] },
  bankCards: [], hideAmounts: false,
  market: { tick: 0, lastAdvancedAt: Date.now() }
})

const normalize = (raw: any, accountId: string, accountName = '我'): WalletState => {
  const base = createWalletState(accountId, accountName)
  if (!raw || typeof raw !== 'object') return base
  const legacyUser = raw.owners?.[`user:${accountId}`]
  return {
    ...base,
    schemaVersion: 2, accountId, accountName: accountName || raw.accountName || base.accountName,
    paymentHandle: raw.paymentHandle || legacyUser?.paymentHandle || base.paymentHandle,
    cashCents: cents(raw.cashCents ?? legacyUser?.cashCents),
    heldCents: cents(raw.heldCents ?? legacyUser?.heldCents),
    ledger: Array.isArray(raw.ledger) ? raw.ledger.filter((entry: any) => !entry.ownerKey || entry.ownerKey === `user:${accountId}`).map((entry: any) => {
      const { ownerKey: _ownerKey, ...rest } = entry
      return rest
    }) : [],
    payments: Array.isArray(raw.payments) ? raw.payments.map((payment: any) => ({
      id: payment.id, direction: payment.direction || (payment.senderKey === `user:${accountId}` ? 'outgoing' : 'incoming'),
      amountCents: cents(payment.amountCents), kind: payment.kind === 'red_packet' ? 'red_packet' : 'transfer',
      remark: payment.remark || '', status: payment.status || 'pending', createdAt: payment.createdAt || Date.now(), resolvedAt: payment.resolvedAt
    })) : [],
    quotes: Array.isArray(raw.quotes) && raw.quotes.length ? raw.quotes : base.quotes,
    positions: Array.isArray(raw.positions) ? raw.positions : [], orders: Array.isArray(raw.orders) ? raw.orders : [],
    watchlist: Array.isArray(raw.watchlist) ? raw.watchlist : base.watchlist,
    credit: { ...base.credit, ...(raw.credit || {}), transactions: Array.isArray(raw.credit?.transactions) ? raw.credit.transactions : [] },
    bankCards: Array.isArray(raw.bankCards) ? raw.bankCards : [],
    hideAmounts: raw.hideAmounts ?? raw.security?.hideAmounts ?? false,
    market: { ...base.market, ...(raw.market || {}) }
  }
}

export const loadWalletState = (accountId: string, accountName = '我') => {
  try {
    const current = localStorage.getItem(walletStorageKey(accountId))
    if (current) return normalize(JSON.parse(current), accountId, accountName)
    const legacy = localStorage.getItem(`${LEGACY_PREFIX}${accountId || 'guest'}`)
    return normalize(legacy ? JSON.parse(legacy) : null, accountId, accountName)
  } catch (_) { return createWalletState(accountId, accountName) }
}

export const saveWalletState = (state: WalletState) => {
  localStorage.setItem(walletStorageKey(state.accountId), JSON.stringify(state))
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { accountId: state.accountId } }))
}

const pushLedger = (state: WalletState, input: Omit<WalletLedgerEntry, 'id' | 'createdAt' | 'balanceAfterCents'>) => {
  const entry: WalletLedgerEntry = { ...input, id: uid('ledger'), createdAt: Date.now(), balanceAfterCents: state.cashCents }
  state.ledger.unshift(entry); state.ledger = state.ledger.slice(0, 2000); return entry
}

export const setWalletBalance = (state: WalletState, targetCents: number, note = '用户自定义余额') => {
  const target = cents(targetCents); const delta = target - state.cashCents; state.cashCents = target
  pushLedger(state, { category: 'adjustment', title: delta >= 0 ? '余额调增' : '余额调减', amountCents: delta, note })
}

export const adjustWalletBalance = (state: WalletState, amountCents: number, title: string, category = 'adjustment', note = '') => {
  const amount = Math.round(Number(amountCents) || 0)
  if (state.cashCents + amount < 0) throw new Error('可用余额不足')
  state.cashCents += amount
  return pushLedger(state, { category, title, amountCents: amount, note })
}

export const createOutgoingWalletPayment = (accountId: string, amountCents: number, kind: 'transfer' | 'red_packet', remark = '') => {
  const state = loadWalletState(accountId); const amount = cents(amountCents)
  if (!amount) throw new Error('金额必须大于 0')
  if (state.cashCents < amount) throw new Error('钱包余额不足')
  state.cashCents -= amount; state.heldCents += amount
  const payment: WalletPayment = { id: uid('payment'), direction: 'outgoing', amountCents: amount, kind, remark, status: 'pending', createdAt: Date.now() }
  state.payments.unshift(payment)
  pushLedger(state, { category: kind, title: kind === 'red_packet' ? '发出红包（待领取）' : '转账（待收款）', amountCents: -amount, relatedId: payment.id, note: remark })
  saveWalletState(state); return payment
}

export const createIncomingWalletPayment = (accountId: string, amountCents: number, kind: 'transfer' | 'red_packet', remark = '') => {
  const state = loadWalletState(accountId); const amount = cents(amountCents)
  const payment: WalletPayment = { id: uid('payment'), direction: 'incoming', amountCents: amount, kind, remark, status: 'pending', createdAt: Date.now() }
  state.payments.unshift(payment); saveWalletState(state); return payment
}

// 兼容聊天发送层：只允许用户方向创建冻结款，不创建任何角色账户。
export const createWalletPayment = (input: { accountId: string; senderType: 'user' | 'character'; amountCents: number; kind: 'transfer' | 'red_packet'; remark: string }) => (
  input.senderType === 'user'
    ? createOutgoingWalletPayment(input.accountId, input.amountCents, input.kind, input.remark)
    : createIncomingWalletPayment(input.accountId, input.amountCents, input.kind, input.remark)
)

export const resolveWalletPayment = (accountId: string, paymentId: string, resolution: WalletTransferResolution) => {
  const state = loadWalletState(accountId); const payment = state.payments.find(item => item.id === paymentId)
  if (!payment) return { ok: false as const, reason: 'missing_payment' }
  if (payment.status !== 'pending') return { ok: false as const, reason: 'already_resolved' }
  payment.status = resolution; payment.resolvedAt = Date.now()
  if (payment.direction === 'outgoing') {
    state.heldCents = Math.max(0, state.heldCents - payment.amountCents)
    if (resolution !== 'claimed') {
      state.cashCents += payment.amountCents
      pushLedger(state, { category: 'refund', title: resolution === 'expired' ? '过期退款' : '款项退回', amountCents: payment.amountCents, relatedId: payment.id, note: payment.remark })
    }
  } else if (resolution === 'claimed') {
    state.cashCents += payment.amountCents
    pushLedger(state, { category: payment.kind, title: payment.kind === 'red_packet' ? '收到红包' : '收到转账', amountCents: payment.amountCents, relatedId: payment.id, note: payment.remark })
  }
  saveWalletState(state); return { ok: true as const, payment }
}

const noise = (code: string, tick: number) => {
  let seed = tick * 97; for (const char of code) seed += char.charCodeAt(0) * 13
  return Math.sin(seed * .017) * .012 + Math.sin(seed * .0031) * .006
}

export const advanceWalletMarket = (state: WalletState, forceTicks = 0) => {
  const ticks = Math.max(forceTicks, Math.min(96, Math.max(0, Math.floor((Date.now() - state.market.lastAdvancedAt) / 300000))))
  if (!ticks) return false
  for (let i = 0; i < ticks; i++) { state.market.tick++; state.quotes.forEach(quote => { quote.priceCents = Math.max(100, Math.round(quote.priceCents * (1 + noise(quote.code, state.market.tick)))); quote.history.push(quote.priceCents); quote.history = quote.history.slice(-48) }) }
  state.market.lastAdvancedAt = Date.now(); processPendingOrders(state); return true
}

const useFunds = (state: WalletState, amount: number, source: WalletFundingSource, title: string, relatedId: string) => {
  if (source === 'credit') {
    if (!state.credit.enabled || state.credit.limitCents - state.credit.usedCents < amount) throw new Error('花呗可用额度不足')
    state.credit.usedCents += amount; state.credit.transactions.unshift({ id: uid('credit'), title, amountCents: amount, repaidCents: 0, createdAt: Date.now() })
  } else {
    if (state.cashCents < amount) throw new Error('钱包余额不足')
    state.cashCents -= amount; pushLedger(state, { category: 'stock', title, amountCents: -amount, relatedId })
  }
}

const fillOrder = (state: WalletState, order: WalletOrder, price: number) => {
  const quote = state.quotes.find(item => item.code === order.code); if (!quote) throw new Error('股票不存在')
  if (order.side === 'buy') {
    const total = price * order.quantity; useFunds(state, total, order.fundingSource, `买入${quote.name}`, order.id)
    const position = state.positions.find(item => item.code === order.code)
    if (position) { const old = position.averageCostCents * position.quantity; position.quantity += order.quantity; position.averageCostCents = Math.round((old + total) / position.quantity) }
    else state.positions.push({ code: order.code, quantity: order.quantity, averageCostCents: price })
  } else {
    const position = state.positions.find(item => item.code === order.code); if (!position || position.quantity < order.quantity) throw new Error('可卖数量不足')
    position.quantity -= order.quantity; const total = price * order.quantity; state.cashCents += total
    pushLedger(state, { category: 'stock', title: `卖出${quote.name}`, amountCents: total, relatedId: order.id })
    if (!position.quantity) state.positions = state.positions.filter(item => item !== position)
  }
  order.status = 'filled'; order.filledAt = Date.now(); order.filledPriceCents = price
}

const processPendingOrders = (state: WalletState) => state.orders.filter(order => order.status === 'pending').forEach(order => {
  const quote = state.quotes.find(item => item.code === order.code); if (!quote || !order.limitPriceCents) return
  if (!(order.side === 'buy' ? quote.priceCents <= order.limitPriceCents : quote.priceCents >= order.limitPriceCents)) return
  try { fillOrder(state, order, quote.priceCents) } catch (error) { order.status = 'rejected'; order.rejectReason = error instanceof Error ? error.message : '成交失败' }
})

export const placeWalletOrder = (state: WalletState, input: Omit<WalletOrder, 'id' | 'status' | 'createdAt'>) => {
  const quote = state.quotes.find(item => item.code === input.code); if (!quote) throw new Error('请选择有效股票')
  const order: WalletOrder = { ...input, quantity: Math.max(1, Math.floor(Number(input.quantity) || 0)), id: uid('order'), status: 'pending', createdAt: Date.now() }
  state.orders.unshift(order)
  if (order.orderType === 'market') { try { fillOrder(state, order, quote.priceCents) } catch (error) { order.status = 'rejected'; order.rejectReason = error instanceof Error ? error.message : '下单失败'; throw error } }
  else if (!order.limitPriceCents || order.limitPriceCents <= 0) throw new Error('请输入有效限价')
  return order
}

export const cancelWalletOrder = (state: WalletState, orderId: string) => { const order = state.orders.find(item => item.id === orderId); if (!order || order.status !== 'pending') throw new Error('该委托无法撤销'); order.status = 'cancelled' }

export const repayWalletCredit = (state: WalletState, amountCents: number) => {
  const amount = Math.min(cents(amountCents), state.credit.usedCents); if (!amount) throw new Error('当前没有待还金额'); if (state.cashCents < amount) throw new Error('钱包余额不足')
  state.cashCents -= amount; state.credit.usedCents -= amount; let left = amount
  for (const tx of [...state.credit.transactions].reverse()) { const applied = Math.min(left, tx.amountCents - tx.repaidCents); tx.repaidCents += applied; left -= applied; if (!left) break }
  pushLedger(state, { category: 'credit_repayment', title: '花呗还款', amountCents: -amount })
}

export const resetWalletFinance = (state: WalletState) => {
  const keep = { accountName: state.accountName, paymentHandle: state.paymentHandle, bankCards: state.bankCards, hideAmounts: state.hideAmounts }
  Object.assign(state, createWalletState(state.accountId, state.accountName), keep)
}

export const formatWalletMoney = (value: number) => (Number(value || 0) / 100).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
