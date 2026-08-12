/* WARNING: 本项目专属“粘人精”，严禁出现无关角色命名！ */
<script setup lang="ts">
import { computed, ref } from 'vue'
import { globalSettings } from '../store'
import { useWallet } from '../composables/useWallet'
import {
  adjustWalletBalance,
  cancelWalletOrder,
  formatWalletMoney,
  placeWalletOrder,
  repayWalletCredit,
  resetWalletFinance,
  setWalletBalance,
  type WalletFundingSource,
  type WalletOrder
} from '../services/walletService'

const emit = defineEmits<{ (event: 'close'): void }>()
const { state, currentAccount, stockMarketValueCents, stockCostCents, totalAssetCents, persist } = useWallet()

type Tab = 'wallet' | 'stocks' | 'mine'
type Panel = '' | 'bills' | 'payments' | 'cards' | 'security' | 'credit' | 'orders' | 'positions' | 'watchlist' | 'help'
type Dialog = '' | 'balance' | 'deposit' | 'withdraw' | 'card' | 'trade' | 'repay' | 'reset'

const activeTab = ref<Tab>('wallet')
const panel = ref<Panel>('')
const dialog = ref<Dialog>('')
const amountInput = ref('')
const noteInput = ref('')
const cardNameInput = ref('')
const cardNumberInput = ref('')
const selectedCode = ref('CLY001')
const tradeSide = ref<'buy' | 'sell'>('buy')
const tradeType = ref<'market' | 'limit'>('market')
const tradeQuantity = ref('100')
const tradeLimit = ref('')
const tradeFunding = ref<WalletFundingSource>('balance')
const toast = ref<{ text: string; error: boolean } | null>(null)

const money = (value: number) => state.value.hideAmounts ? '••••••' : formatWalletMoney(value)
const signedMoney = (value: number) => `${value > 0 ? '+' : value < 0 ? '-' : ''}${formatWalletMoney(Math.abs(value))}`
const stockProfitCents = computed(() => stockMarketValueCents.value - stockCostCents.value)
const stockRate = computed(() => stockCostCents.value ? stockProfitCents.value / stockCostCents.value * 100 : 0)
const availableCreditCents = computed(() => Math.max(0, state.value.credit.limitCents - state.value.credit.usedCents))
const recentLedger = computed(() => state.value.ledger.slice(0, 5))
const selectedQuote = computed(() => state.value.quotes.find(item => item.code === selectedCode.value) || state.value.quotes[0])
const positionRows = computed(() => state.value.positions.map(position => {
  const quote = state.value.quotes.find(item => item.code === position.code)
  const price = quote?.priceCents || 0
  const profit = (price - position.averageCostCents) * position.quantity
  return { ...position, quote, value: price * position.quantity, profit, rate: position.averageCostCents ? (price - position.averageCostCents) / position.averageCostCents * 100 : 0 }
}))
const paymentRows = computed(() => state.value.payments.slice().sort((a, b) => b.createdAt - a.createdAt))
const assetParts = computed(() => {
  const total = Math.max(1, totalAssetCents.value)
  return [
    { label: '现金', amount: state.value.cashCents, color: '#d1d1d6' },
    { label: '股票', amount: stockMarketValueCents.value, color: '#8e8e93' }
  ].map(item => ({ ...item, percent: item.amount / total * 100 }))
})
const donutStyle = computed(() => {
  const cash = assetParts.value[0]?.percent || 0
  return { background: `conic-gradient(#d1d1d6 0 ${cash}%, #8e8e93 ${cash}% 100%)` }
})

const notify = (text: string, error = false) => {
  toast.value = { text, error }
  window.setTimeout(() => { if (toast.value?.text === text) toast.value = null }, 2400)
}
const parseAmount = () => Math.round(Number(amountInput.value) * 100)
const openDialog = (name: Dialog) => {
  dialog.value = name
  amountInput.value = name === 'balance' ? formatWalletMoney(state.value.cashCents) : ''
  noteInput.value = ''
}
const closeDialog = () => { dialog.value = ''; amountInput.value = ''; noteInput.value = '' }
const submitMoney = () => {
  const cents = parseAmount()
  if (!Number.isFinite(cents) || cents < 0 || (dialog.value !== 'balance' && cents <= 0)) return notify('请输入有效金额', true)
  try {
    if (dialog.value === 'balance') setWalletBalance(state.value, cents, noteInput.value || '用户自定义余额')
    if (dialog.value === 'deposit') adjustWalletBalance(state.value, cents, '余额充值', 'deposit', noteInput.value)
    if (dialog.value === 'withdraw') adjustWalletBalance(state.value, -cents, '余额提现', 'withdraw', noteInput.value)
    persist(); closeDialog(); notify('操作成功')
  } catch (error) { notify(error instanceof Error ? error.message : '操作失败', true) }
}
const addCard = () => {
  const digits = cardNumberInput.value.replace(/\D/g, '')
  if (!cardNameInput.value.trim() || digits.length < 4) return notify('请填写卡片名称和至少四位卡号', true)
  state.value.bankCards.push({ id: `card_${Date.now()}`, name: cardNameInput.value.trim(), lastFour: digits.slice(-4), enabled: true, createdAt: Date.now() })
  persist(); cardNameInput.value = ''; cardNumberInput.value = ''; closeDialog(); notify('银行卡已添加')
}
const removeCard = (id: string) => {
  state.value.bankCards = state.value.bankCards.filter(card => card.id !== id); persist(); notify('银行卡已移除')
}
const openTrade = (side: 'buy' | 'sell', code = selectedCode.value) => {
  tradeSide.value = side; selectedCode.value = code; tradeType.value = 'market'; tradeQuantity.value = '100'; tradeLimit.value = ''; dialog.value = 'trade'
}
const submitTrade = () => {
  const quote = selectedQuote.value
  if (!quote) return notify('暂无可交易股票', true)
  const quantity = Math.floor(Number(tradeQuantity.value))
  try {
    placeWalletOrder(state.value, {
      code: quote.code, side: tradeSide.value, orderType: tradeType.value, quantity,
      limitPriceCents: tradeType.value === 'limit' ? Math.round(Number(tradeLimit.value) * 100) : undefined,
      fundingSource: tradeFunding.value
    })
    persist(); closeDialog(); notify(tradeType.value === 'market' ? '交易已成交' : '委托已提交')
  } catch (error) { notify(error instanceof Error ? error.message : '下单失败', true) }
}
const cancelOrder = (order: WalletOrder) => {
  try { cancelWalletOrder(state.value, order.id); persist(); notify('委托已撤销') }
  catch (error) { notify(error instanceof Error ? error.message : '撤单失败', true) }
}
const repay = () => {
  try { repayWalletCredit(state.value, parseAmount()); persist(); closeDialog(); notify('还款成功') }
  catch (error) { notify(error instanceof Error ? error.message : '还款失败', true) }
}
const resetFinance = () => { resetWalletFinance(state.value); persist(); closeDialog(); notify('钱包数据已重置') }
const toggleHidden = () => { state.value.hideAmounts = !state.value.hideAmounts; persist() }
const dateText = (value: number) => new Date(value).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
const orderStatus = (status: WalletOrder['status']) => ({ pending: '待成交', filled: '已成交', cancelled: '已撤销', rejected: '已失败' })[status]
const paymentStatus = (status: string) => ({ pending: '待处理', claimed: '已领取', rejected: '已退回', expired: '已过期' }[status] || status)
const paymentTitle = (direction: string, kind: string) => `${direction === 'incoming' ? '收到' : '发出'}${kind === 'red_packet' ? '红包' : '转账'}`
</script>

<template>
  <div class="wallet-app" :class="{ 'dark-theme': globalSettings.darkMode }">
    <template v-if="!panel">
      <main v-show="activeTab === 'wallet'" class="tab-content">
        <header class="page-header">
          <h2><button class="title-button" @click="emit('close')">钱包 <span>Wallet</span></button></h2>
          <button class="icon-button" aria-label="自定义余额" title="自定义余额" @click="openDialog('balance')">
            <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 8v8M8 12h8"/></svg>
          </button>
        </header>

        <section class="asset-card">
          <button class="card-title visibility-button" @click="toggleHidden">总资产 (CNY)
            <svg viewBox="0 0 24 24"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="2.5"/></svg>
          </button>
          <div class="card-main"><strong class="asset-amount">{{ money(totalAssetCents) }}</strong><div class="sparkline"><svg viewBox="0 0 100 35" preserveAspectRatio="none"><path d="M0 29 14 25 27 27 42 18 58 21 74 11 88 14 100 5"/></svg></div></div>
          <div class="card-stats">
            <div><span>可用余额</span><strong>{{ money(state.cashCents) }}</strong></div>
            <div><span>冻结金额</span><strong>{{ money(state.heldCents) }}</strong></div>
          </div>
        </section>

        <div class="action-grid">
          <button class="action-item" @click="openDialog('deposit')"><i><svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M12 8v8M8 12h8"/></svg></i><span>充值</span></button>
          <button class="action-item" @click="openDialog('withdraw')"><i><svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M12 7v9m-4-4 4 4 4-4"/></svg></i><span>提现</span></button>
          <button class="action-item" @click="panel = 'payments'"><i><svg viewBox="0 0 24 24"><path d="M16 4h5v5M8 20H3v-5M21 4 13 12M3 20l8-8"/></svg></i><span>转账</span></button>
          <button class="action-item" @click="panel = 'bills'"><i><svg viewBox="0 0 24 24"><path d="M6 2h9l4 4v16H6z"/><path d="M14 2v5h5M9 12h7M9 16h7"/></svg></i><span>账单</span></button>
        </div>

        <section class="section-block">
          <div class="section-header"><h3>资产分布</h3><button @click="activeTab = 'stocks'">更多 <span>›</span></button></div>
          <div class="distribution-content">
            <div class="donut-chart" :style="donutStyle"><div></div></div>
            <div class="dist-list">
              <div v-for="item in assetParts" :key="item.label" class="dist-item"><i :style="{ background: item.color }"></i><span>{{ item.label }}</span><strong>{{ money(item.amount) }}</strong><em>{{ item.percent.toFixed(1) }}%</em></div>
            </div>
          </div>
        </section>

        <section class="section-block">
          <h3>快捷功能</h3>
          <div class="quick-funcs">
            <button class="quick-card" @click="panel = 'cards'"><i><svg viewBox="0 0 24 24"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg></i><span><strong>银行卡</strong><small>管理绑定卡片</small></span></button>
            <button class="quick-card" @click="panel = 'security'"><i><svg viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/></svg></i><span><strong>安全中心</strong><small>金额显示设置</small></span></button>
            <button class="quick-card" @click="panel = 'payments'"><i><svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 10h18M8 2v4M16 2v4"/></svg></i><span><strong>红包</strong><small>查看收发记录</small></span></button>
            <button class="quick-card" @click="panel = 'credit'"><i><svg viewBox="0 0 24 24"><path d="M4 8h16M6 4h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z"/><path d="M8 14h4"/></svg></i><span><strong>花呗</strong><small>额度与还款</small></span></button>
            <button class="quick-card disabled" disabled><i><svg viewBox="0 0 24 24"><path d="M5 9h14l-1 12H6L5 9Z"/><path d="M9 9V6a3 3 0 0 1 6 0v3"/></svg></i><span><strong>小荷包</strong><small>暂未开放</small></span></button>
            <button class="quick-card" @click="panel = 'help'"><i><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M9.5 9a2.7 2.7 0 1 1 4.3 2.2c-1 .7-1.8 1.2-1.8 2.8M12 18h.01"/></svg></i><span><strong>帮助与反馈</strong><small>功能使用说明</small></span></button>
          </div>
        </section>

        <section class="section-block">
          <div class="section-header"><h3>最近交易</h3><button @click="panel = 'bills'">更多 <span>›</span></button></div>
          <div v-if="!recentLedger.length" class="empty-state"><svg viewBox="0 0 24 24"><path d="M6 2h12v20l-3-2-3 2-3-2-3 2V2Z"/><path d="M9 8h6M9 12h6"/></svg><strong>暂无交易记录</strong><span>充值、提现或聊天收发款后会显示在这里</span></div>
          <div v-else class="row-list"><div v-for="entry in recentLedger" :key="entry.id" class="data-row"><span><strong>{{ entry.title }}</strong><small>{{ dateText(entry.createdAt) }}</small></span><em :class="{ income: entry.amountCents > 0 }">{{ signedMoney(entry.amountCents) }}</em></div></div>
        </section>
      </main>

      <main v-show="activeTab === 'stocks'" class="tab-content">
        <header class="page-header"><h2><button class="title-button" @click="emit('close')">股票 <span>Stocks</span></button></h2><button class="icon-button" aria-label="自选股票" @click="panel = 'watchlist'"><svg viewBox="0 0 24 24"><path d="m12 2 3 6 7 .9-5 4.8 1.2 6.8L12 17.3l-6.2 3.2L7 13.7 2 8.9 9 8l3-6Z"/></svg></button></header>
        <section class="section-block"><h3>我的持仓</h3><div class="asset-card"><div class="card-title">总市值 (CNY)</div><div class="card-main"><strong class="asset-amount">{{ money(stockMarketValueCents) }}</strong><div class="sparkline"><svg viewBox="0 0 100 35" preserveAspectRatio="none"><path d="M0 30 13 26 28 28 40 20 55 23 71 13 86 16 100 7"/></svg></div></div><div class="card-stats"><div><span>持仓盈亏</span><strong :class="stockProfitCents >= 0 ? 'up' : 'down'">{{ signedMoney(stockProfitCents) }}</strong></div><div><span>收益率</span><strong :class="stockProfitCents >= 0 ? 'up' : 'down'">{{ stockRate.toFixed(2) }}%</strong></div></div></div></section>
        <div class="action-grid"><button class="action-item" @click="openTrade('buy')"><i><svg viewBox="0 0 24 24"><path d="M12 3v14M7 12l5 5 5-5M4 21h16"/></svg></i><span>买入</span></button><button class="action-item" @click="openTrade('sell')"><i><svg viewBox="0 0 24 24"><path d="M12 21V7M7 12l5-5 5 5M4 3h16"/></svg></i><span>卖出</span></button><button class="action-item" @click="panel = 'orders'"><i><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="m9 9 6 6m0-6-6 6"/></svg></i><span>撤单</span></button><button class="action-item" @click="panel = 'positions'"><i><svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 9v12"/></svg></i><span>持仓</span></button></div>
        <section class="section-block"><div class="section-header"><h3>持仓列表</h3><button @click="panel = 'positions'">全部 <span>›</span></button></div><div class="stock-list"><div class="stock-head"><span>名称/代码</span><span>市值</span><span>盈亏/收益率</span></div><div v-if="!positionRows.length" class="empty-state compact"><strong>暂无持仓</strong><span>选择下方股票开始模拟交易</span></div><button v-for="row in positionRows.slice(0, 4)" :key="row.code" class="stock-row" @click="openTrade('sell', row.code)"><span><strong>{{ row.quote?.name }}</strong><small>{{ row.code }} · {{ row.quantity }} 股</small></span><strong>{{ formatWalletMoney(row.value) }}</strong><em :class="row.profit >= 0 ? 'up' : 'down'">{{ signedMoney(row.profit) }}<small>{{ row.rate.toFixed(2) }}%</small></em></button></div></section>
        <section class="section-block"><h3>市场概览</h3><div class="market-scroll"><button v-for="quote in state.quotes" :key="quote.code" class="market-card" @click="openTrade('buy', quote.code)"><small>{{ quote.name }}</small><strong>{{ formatWalletMoney(quote.priceCents) }}</strong><em :class="quote.priceCents >= quote.previousCloseCents ? 'up' : 'down'">{{ ((quote.priceCents - quote.previousCloseCents) / quote.previousCloseCents * 100).toFixed(2) }}%</em><svg viewBox="0 0 50 20" preserveAspectRatio="none"><path d="M0 16 10 11 20 13 30 6 40 9 50 3"/></svg></button></div></section>
        <section class="section-block"><div class="section-header"><h3>热门板块</h3><button @click="panel = 'watchlist'">自选 <span>›</span></button></div><div class="tag-list"><div v-for="sector in ['科技', '消费', '医药', '金融']" :key="sector"><strong>{{ sector }}</strong><span>模拟行情</span></div></div></section>
      </main>

      <main v-show="activeTab === 'mine'" class="tab-content">
        <header class="page-header"><h2><button class="title-button" @click="emit('close')">我的 <span>Mine</span></button></h2><button class="icon-button" aria-label="安全设置" @click="panel = 'security'"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19 13.5a7 7 0 0 0 0-3l2-1.5-2-3.4-2.5 1A7 7 0 0 0 14 5l-.4-3h-4L9 5a7 7 0 0 0-2.5 1.5l-2.5-1L2 9l2 1.5a7 7 0 0 0 0 3L2 15l2 3.5 2.5-1A7 7 0 0 0 9 19l.5 3h4l.5-3a7 7 0 0 0 2.5-1.5l2.5 1 2-3.5-2-1.5Z"/></svg></button></header>
        <section class="profile-card"><div class="avatar"><svg viewBox="0 0 24 24"><path d="M20 21a8 8 0 0 0-16 0M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"/></svg></div><span><strong>{{ currentAccount?.name || state.accountName || '用户' }}</strong><small>钱包号：{{ state.paymentHandle }}</small></span><em>本地账户</em></section>
        <section class="asset-card compact"><button class="card-title visibility-button" @click="toggleHidden">资产总览 <svg viewBox="0 0 24 24"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="2.5"/></svg></button><div class="card-main"><strong class="asset-amount">{{ money(totalAssetCents) }}</strong></div><div class="card-sub">总资产 (CNY)</div></section>
        <section class="section-block"><h3>我的服务</h3><div class="service-list"><button @click="panel = 'credit'"><i><svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M8 15h4"/></svg></i><span>花呗</span><em>可用 {{ formatWalletMoney(availableCreditCents) }}</em><b>›</b></button><button @click="panel = 'orders'"><i><svg viewBox="0 0 24 24"><path d="M6 2h12v20l-3-2-3 2-3-2-3 2V2Z"/></svg></i><span>我的订单</span><b>›</b></button><button @click="panel = 'cards'"><i><svg viewBox="0 0 24 24"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg></i><span>银行卡</span><em>{{ state.bankCards.length }} 张</em><b>›</b></button><button @click="panel = 'watchlist'"><i><svg viewBox="0 0 24 24"><path d="m12 2 3 6 7 .9-5 4.8 1.2 6.8L12 17.3l-6.2 3.2L7 13.7 2 8.9 9 8l3-6Z"/></svg></i><span>我的自选</span><b>›</b></button><button disabled class="disabled"><i><svg viewBox="0 0 24 24"><path d="M5 9h14l-1 12H6L5 9Z"/><path d="M9 9V6a3 3 0 0 1 6 0v3"/></svg></i><span>小荷包</span><em>暂未开放</em></button></div></section>
        <section class="section-block"><h3>设置与帮助</h3><div class="service-list"><button @click="panel = 'security'"><i><svg viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/></svg></i><span>安全与显示</span><b>›</b></button><button @click="openDialog('reset')"><i><svg viewBox="0 0 24 24"><path d="M4 4v6h6M20 20v-6h-6"/><path d="M5 15a8 8 0 0 0 13 3l2-4M19 9A8 8 0 0 0 6 6l-2 4"/></svg></i><span>重置钱包</span><b>›</b></button><button @click="panel = 'help'"><i><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M9.5 9a2.7 2.7 0 1 1 4.3 2.2c-1 .7-1.8 1.2-1.8 2.8M12 18h.01"/></svg></i><span>帮助与反馈</span><b>›</b></button></div></section>
      </main>

      <nav class="bottom-tab-bar" aria-label="钱包导航"><button :class="{ active: activeTab === 'wallet' }" aria-label="钱包" @click="activeTab = 'wallet'"><svg viewBox="0 0 24 24"><path d="M4 5h16v16H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z"/><path d="M16 11h6v6h-6a3 3 0 0 1 0-6Z"/></svg></button><button :class="{ active: activeTab === 'stocks' }" aria-label="股票" @click="activeTab = 'stocks'"><svg viewBox="0 0 24 24"><path d="M2 12h4l3-9 6 18 3-9h4"/></svg></button><button :class="{ active: activeTab === 'mine' }" aria-label="我的" @click="activeTab = 'mine'"><svg viewBox="0 0 24 24"><path d="M20 21a8 8 0 0 0-16 0M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"/></svg></button></nav>
    </template>

    <main v-else class="tab-content detail-page">
      <header class="detail-header"><button class="back-button" aria-label="返回" @click="panel = ''">‹</button><h2>{{ ({ bills: '账单', payments: '转账与红包', cards: '银行卡', security: '安全中心', credit: '花呗', orders: '委托订单', positions: '我的持仓', watchlist: '我的自选', help: '帮助与反馈' } as Record<string, string>)[panel] }}</h2><button v-if="panel === 'cards'" class="text-button" @click="dialog = 'card'">添加</button><span v-else></span></header>
      <section v-if="panel === 'bills'" class="detail-section"><div v-if="!state.ledger.length" class="empty-state"><strong>暂无账单</strong><span>钱包资金变化会记录在这里</span></div><div v-else class="row-list card-list"><div v-for="entry in state.ledger" :key="entry.id" class="data-row"><span><strong>{{ entry.title }}</strong><small>{{ dateText(entry.createdAt) }}<template v-if="entry.note"> · {{ entry.note }}</template></small></span><em :class="{ income: entry.amountCents > 0 }">{{ signedMoney(entry.amountCents) }}</em></div></div></section>
      <section v-if="panel === 'payments'" class="detail-section"><div class="info-card"><strong>聊天收付款记录</strong><span>转账和红包仍在聊天中发送、领取或退回；钱包这里只负责用户余额与本地记录。</span></div><div v-if="!paymentRows.length" class="empty-state"><strong>暂无转账或红包</strong><span>在聊天中使用后会显示在这里</span></div><div v-else class="row-list card-list"><div v-for="item in paymentRows" :key="item.id" class="data-row"><span><strong>{{ paymentTitle(item.direction, item.kind) }}</strong><small>{{ dateText(item.createdAt) }} · {{ paymentStatus(item.status) }}</small></span><em :class="{ income: item.direction === 'incoming' }">{{ item.direction === 'incoming' ? '+' : '-' }}{{ formatWalletMoney(item.amountCents) }}</em></div></div></section>
      <section v-if="panel === 'cards'" class="detail-section"><div v-if="!state.bankCards.length" class="empty-state"><strong>还没有银行卡</strong><span>添加后可在这里统一管理</span><button class="primary-button" @click="dialog = 'card'">添加银行卡</button></div><div v-else class="bank-list"><article v-for="card in state.bankCards" :key="card.id"><span><small>{{ card.name }}</small><strong>•••• •••• •••• {{ card.lastFour }}</strong></span><button @click="removeCard(card.id)">移除</button></article></div></section>
      <section v-if="panel === 'security'" class="detail-section"><div class="settings-card"><button @click="toggleHidden"><span><strong>隐藏金额</strong><small>在钱包页面用圆点代替资产数字</small></span><i :class="{ on: state.hideAmounts }"><b></b></i></button></div><div class="info-card"><strong>数据说明</strong><span>钱包数据只保存在当前用户的本地账户中，不会把余额加入聊天提示词，也不会为角色创建钱包。</span></div></section>
      <section v-if="panel === 'credit'" class="detail-section"><div class="credit-card"><small>可用额度 (CNY)</small><strong>{{ formatWalletMoney(availableCreditCents) }}</strong><div><span>总额度 {{ formatWalletMoney(state.credit.limitCents) }}</span><span>待还 {{ formatWalletMoney(state.credit.usedCents) }}</span></div></div><button class="primary-button wide" :disabled="!state.credit.usedCents" @click="openDialog('repay')">立即还款</button><div class="info-card"><strong>账单日 {{ state.credit.billingDay }} 日 · 还款日 {{ state.credit.repaymentDay }} 日</strong><span>花呗可用于模拟股票买入；使用后会形成待还金额。</span></div></section>
      <section v-if="panel === 'orders'" class="detail-section"><div v-if="!state.orders.length" class="empty-state"><strong>暂无委托</strong><span>股票买卖委托会显示在这里</span></div><div v-else class="row-list card-list"><div v-for="order in state.orders" :key="order.id" class="data-row order-row"><span><strong>{{ order.side === 'buy' ? '买入' : '卖出' }} {{ state.quotes.find(q => q.code === order.code)?.name }}</strong><small>{{ order.quantity }} 股 · {{ order.orderType === 'market' ? '市价' : `限价 ${formatWalletMoney(order.limitPriceCents || 0)}` }} · {{ orderStatus(order.status) }}</small></span><button v-if="order.status === 'pending'" @click="cancelOrder(order)">撤单</button><em v-else>{{ order.filledPriceCents ? formatWalletMoney(order.filledPriceCents * order.quantity) : '--' }}</em></div></div></section>
      <section v-if="panel === 'positions'" class="detail-section"><div v-if="!positionRows.length" class="empty-state"><strong>暂无持仓</strong><span>买入股票后会显示在这里</span></div><div v-else class="row-list card-list"><button v-for="row in positionRows" :key="row.code" class="data-row clickable" @click="openTrade('sell', row.code)"><span><strong>{{ row.quote?.name }}</strong><small>{{ row.quantity }} 股 · 成本 {{ formatWalletMoney(row.averageCostCents) }}</small></span><em :class="row.profit >= 0 ? 'up' : 'down'">{{ signedMoney(row.profit) }}</em></button></div></section>
      <section v-if="panel === 'watchlist'" class="detail-section"><div class="row-list card-list"><button v-for="quote in state.quotes" :key="quote.code" class="data-row clickable" @click="state.watchlist.includes(quote.code) ? state.watchlist = state.watchlist.filter(code => code !== quote.code) : state.watchlist.push(quote.code); persist()"><span><strong>{{ quote.name }}</strong><small>{{ quote.code }} · {{ quote.sector }}</small></span><em>{{ state.watchlist.includes(quote.code) ? '已自选' : '添加' }}</em></button></div></section>
      <section v-if="panel === 'help'" class="detail-section faq"><article><strong>余额如何设置？</strong><span>点击钱包首页右上角加号可直接自定义余额；充值和提现也会形成账单。</span></article><article><strong>转账和红包在哪里发送？</strong><span>仍在聊天页面使用原有转账与红包功能。钱包只做用户余额校验、冻结、到账或退款。</span></article><article><strong>股票是真实行情吗？</strong><span>不是。这里是完全本地的模拟行情与交易，不连接真实证券市场，也不涉及真实资金。</span></article></section>
    </main>

    <div v-if="dialog" class="dialog-layer" @click.self="closeDialog">
      <section class="dialog-card" role="dialog" aria-modal="true">
        <header><h3>{{ ({ balance: '自定义余额', deposit: '充值', withdraw: '提现', card: '添加银行卡', trade: tradeSide === 'buy' ? '买入股票' : '卖出股票', repay: '花呗还款', reset: '重置钱包' } as Record<string, string>)[dialog] }}</h3><button aria-label="关闭" @click="closeDialog">×</button></header>
        <template v-if="['balance', 'deposit', 'withdraw'].includes(dialog)"><label>金额 (CNY)<input v-model="amountInput" inputmode="decimal" placeholder="0.00" @keyup.enter="submitMoney"></label><label>备注（可选）<input v-model="noteInput" maxlength="40" placeholder="填写这笔操作的说明"></label><p v-if="dialog === 'balance'" class="form-note">直接设定当前可用余额；聊天中仍在处理的冻结金额不会被修改。</p><button class="primary-button wide" @click="submitMoney">确认</button></template>
        <template v-if="dialog === 'card'"><label>卡片名称<input v-model="cardNameInput" maxlength="24" placeholder="例如：储蓄卡"></label><label>卡号<input v-model="cardNumberInput" inputmode="numeric" maxlength="24" placeholder="仅用于本地展示末四位"></label><button class="primary-button wide" @click="addCard">保存银行卡</button></template>
        <template v-if="dialog === 'trade'"><label>股票<select v-model="selectedCode"><option v-for="quote in state.quotes" :key="quote.code" :value="quote.code">{{ quote.name }} · {{ formatWalletMoney(quote.priceCents) }}</option></select></label><div class="segmented"><button :class="{ active: tradeType === 'market' }" @click="tradeType = 'market'">市价</button><button :class="{ active: tradeType === 'limit' }" @click="tradeType = 'limit'">限价</button></div><label>数量（股）<input v-model="tradeQuantity" inputmode="numeric" placeholder="100"></label><label v-if="tradeType === 'limit'">限价 (CNY)<input v-model="tradeLimit" inputmode="decimal" :placeholder="formatWalletMoney(selectedQuote?.priceCents || 0)"></label><label v-if="tradeSide === 'buy'">付款方式<select v-model="tradeFunding"><option value="balance">钱包余额</option><option value="credit">花呗额度</option></select></label><p class="form-note">预计金额：{{ formatWalletMoney((selectedQuote?.priceCents || 0) * Math.max(0, Number(tradeQuantity) || 0)) }} CNY</p><button class="primary-button wide" @click="submitTrade">确认{{ tradeSide === 'buy' ? '买入' : '卖出' }}</button></template>
        <template v-if="dialog === 'repay'"><p class="form-note">待还金额 {{ formatWalletMoney(state.credit.usedCents) }} CNY，可用余额 {{ formatWalletMoney(state.cashCents) }} CNY</p><label>还款金额<input v-model="amountInput" inputmode="decimal" :placeholder="formatWalletMoney(state.credit.usedCents)"></label><button class="primary-button wide" @click="repay">确认还款</button></template>
        <template v-if="dialog === 'reset'"><div class="confirm-copy"><strong>确定重置钱包数据吗？</strong><span>余额、账单、转账记录、股票持仓、委托和花呗账单将被清空；银行卡和显示设置会保留。</span></div><div class="confirm-actions"><button @click="closeDialog">取消</button><button class="danger-button" @click="resetFinance">确认重置</button></div></template>
      </section>
    </div>
    <Transition name="toast"><div v-if="toast" class="toast" :class="{ error: toast.error }">{{ toast.text }}</div></Transition>
  </div>
</template>

<style scoped>
.wallet-app{--app-bg:#f7f7f8;--app-text:#111;--card-bg:#fff;--border:rgba(0,0,0,.06);--sub:#8e8e93;--icon-bg:rgba(0,0,0,.04);--up:#ff3b30;--down:#34c759;position:absolute;inset:0;z-index:100;display:flex;overflow:hidden;background:var(--app-bg);color:var(--app-text);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.wallet-app.dark-theme{--app-bg:#000;--app-text:#fff;--card-bg:#1c1c1e;--border:rgba(255,255,255,.09);--sub:#98989d;--icon-bg:rgba(255,255,255,.08);--up:#ff453a;--down:#32d74b}.wallet-app *{box-sizing:border-box}.wallet-app button,.wallet-app input,.wallet-app select{font:inherit}.wallet-app button{color:inherit}.wallet-app svg{fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}.tab-content{flex:1;overflow-y:auto;padding:40px 5vw calc(82px + env(safe-area-inset-bottom));scrollbar-width:none}.tab-content::-webkit-scrollbar{display:none}.page-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:6vw}.page-header h2{margin:0}.title-button{padding:0;border:0;background:none;font-size:5vw;font-weight:700;cursor:pointer}.title-button span{margin-left:2vw;color:var(--sub);font-size:3.5vw;font-weight:400}.icon-button,.back-button{display:grid;width:40px;height:40px;padding:9px;border:0;border-radius:50%;background:transparent;place-items:center;cursor:pointer}.icon-button:hover,.back-button:hover{background:var(--icon-bg)}.icon-button:focus-visible,.back-button:focus-visible,.action-item:focus-visible,.quick-card:focus-visible,.service-list button:focus-visible,.primary-button:focus-visible{outline:2px solid var(--app-text);outline-offset:2px}.asset-card{margin-bottom:6vw;padding:5vw;border:1px solid var(--border);border-radius:4vw;background:var(--card-bg);box-shadow:0 4px 20px rgba(0,0,0,.03)}.card-title{display:flex;align-items:center;gap:1vw;margin:0 0 2vw;color:var(--sub);font-size:3vw}.card-title svg{width:15px;height:15px}.visibility-button{padding:0;border:0;background:none;cursor:pointer}.card-main{display:flex;align-items:center;justify-content:space-between;margin-bottom:4vw}.asset-amount{font-size:8vw;letter-spacing:-.5px}.sparkline{width:25vw;height:8vw;opacity:.55}.sparkline svg{width:100%;height:100%}.sparkline path{stroke:var(--sub);stroke-width:2}.card-stats{display:flex;gap:10vw}.card-stats div{display:flex;flex-direction:column;gap:1vw}.card-stats span{color:var(--sub);font-size:2.8vw}.card-stats strong{font-size:3.5vw}.action-grid{display:flex;justify-content:space-between;margin-bottom:8vw;padding:0 2vw}.action-item{display:flex;align-items:center;flex-direction:column;gap:2vw;padding:0;border:0;background:none;cursor:pointer}.action-item i{display:grid;width:12vw;height:12vw;border:1px solid var(--border);border-radius:50%;background:var(--card-bg);box-shadow:0 2px 10px rgba(0,0,0,.02);place-items:center}.action-item svg{width:21px;height:21px}.action-item span{font-size:3vw;font-style:normal;font-weight:500}.action-item:active i{transform:scale(.96)}.section-block{margin-bottom:8vw}.section-block h3{margin:0 0 4vw;font-size:4vw}.section-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:4vw}.section-header h3{margin:0}.section-header button{border:0;background:none;color:var(--sub);font-size:3vw;cursor:pointer}.distribution-content{display:flex;align-items:center;gap:6vw}.donut-chart{display:grid;width:24vw;height:24vw;flex:none;border-radius:50%;place-items:center}.donut-chart div{width:16vw;height:16vw;border-radius:50%;background:var(--app-bg)}.dist-list{display:flex;flex:1;flex-direction:column;gap:2.2vw}.dist-item{display:flex;align-items:center;font-size:3vw}.dist-item i{width:2vw;height:2vw;margin-right:2vw;border-radius:50%}.dist-item span{width:10vw;color:var(--sub)}.dist-item strong{flex:1;text-align:right}.dist-item em{width:12vw;color:var(--sub);font-style:normal;text-align:right}.quick-funcs{display:grid;grid-template-columns:1fr 1fr;gap:3vw}.quick-card{display:flex;align-items:center;gap:3vw;min-height:16vw;padding:3vw;border:1px solid var(--border);border-radius:3vw;background:var(--card-bg);text-align:left;cursor:pointer}.quick-card>i{display:grid;width:8vw;height:8vw;flex:none;border-radius:2vw;background:var(--icon-bg);place-items:center}.quick-card svg{width:20px;height:20px}.quick-card>span{display:flex;min-width:0;flex-direction:column;gap:.5vw}.quick-card strong{font-size:3.2vw}.quick-card small{color:var(--sub);font-size:2.5vw}.disabled{cursor:not-allowed!important;opacity:.5}.row-list{display:flex;flex-direction:column}.data-row{display:flex;align-items:center;justify-content:space-between;gap:3vw;padding:3.5vw 0;border-bottom:1px solid var(--border)}.data-row:last-child{border:0}.data-row>span{display:flex;min-width:0;flex-direction:column;gap:1vw}.data-row strong{font-size:3.5vw}.data-row small{color:var(--sub);font-size:2.7vw}.data-row em{font-style:normal;font-weight:600;white-space:nowrap}.income,.up{color:var(--up)!important}.down{color:var(--down)!important}.empty-state{display:flex;align-items:center;flex-direction:column;padding:9vw 3vw;color:var(--sub);text-align:center}.empty-state svg{width:34px;height:34px;margin-bottom:3vw}.empty-state strong{margin-bottom:1.5vw;color:var(--app-text);font-size:3.6vw}.empty-state span{max-width:70vw;font-size:3vw;line-height:1.55}.empty-state.compact{padding:7vw 2vw}.stock-list,.card-list,.settings-card{overflow:hidden;border:1px solid var(--border);border-radius:3vw;background:var(--card-bg)}.stock-head,.stock-row{display:grid;grid-template-columns:1.2fr 1fr 1.15fr;align-items:center;gap:2vw}.stock-head{padding:3vw 4vw;color:var(--sub);font-size:2.7vw}.stock-head span:not(:first-child){text-align:right}.stock-row{width:100%;padding:3vw 4vw;border:0;border-top:1px solid var(--border);background:none;text-align:left;cursor:pointer}.stock-row>span,.stock-row>em{display:flex;flex-direction:column}.stock-row>strong,.stock-row>em{text-align:right}.stock-row small{margin-top:.5vw;color:var(--sub);font-size:2.5vw;font-style:normal}.market-scroll{display:flex;gap:3vw;overflow-x:auto;padding-bottom:2vw;scrollbar-width:none}.market-card{display:flex;min-width:29vw;flex-direction:column;padding:3vw;border:1px solid var(--border);border-radius:3vw;background:var(--card-bg);text-align:left;cursor:pointer}.market-card small{margin-bottom:1vw;color:var(--sub)}.market-card strong{font-size:3.7vw}.market-card em{margin-top:.5vw;font-size:2.7vw;font-style:normal}.market-card svg{height:5vw;margin-top:2vw}.market-card path{stroke:currentColor}.tag-list{display:grid;grid-template-columns:repeat(4,1fr);gap:2vw}.tag-list div{display:flex;align-items:center;flex-direction:column;gap:1vw;padding:2.5vw 1vw;border:1px solid var(--border);border-radius:2vw;background:var(--card-bg)}.tag-list strong{font-size:3vw}.tag-list span{color:var(--sub);font-size:2.3vw}.profile-card{display:flex;align-items:center;margin-bottom:6vw;padding:4vw;border:1px solid var(--border);border-radius:4vw;background:var(--card-bg)}.avatar{display:grid;width:14vw;height:14vw;margin-right:4vw;border-radius:50%;background:#e5e5ea;color:#777;place-items:center}.avatar svg{width:32px;height:32px}.profile-card>span{display:flex;min-width:0;flex:1;flex-direction:column;gap:1vw}.profile-card>span strong{font-size:4.5vw}.profile-card>span small{overflow:hidden;color:var(--sub);font-size:2.6vw;text-overflow:ellipsis}.profile-card>em{padding:.8vw 1.6vw;border-radius:1vw;background:var(--icon-bg);color:var(--sub);font-size:2.3vw;font-style:normal}.asset-card.compact{padding:4vw 5vw}.asset-card.compact .card-main{margin:0}.card-sub{color:var(--sub);font-size:2.8vw}.service-list{overflow:hidden;border:1px solid var(--border);border-radius:4vw;background:var(--card-bg)}.service-list button{display:flex;align-items:center;width:100%;min-height:13vw;padding:3.5vw 4vw;border:0;border-bottom:1px solid var(--border);background:none;text-align:left;cursor:pointer}.service-list button:last-child{border:0}.service-list i{display:grid;width:7vw;margin-right:3vw;color:var(--sub);place-items:center}.service-list svg{width:19px;height:19px}.service-list span{flex:1;font-size:3.5vw}.service-list em{margin-right:2vw;color:var(--sub);font-size:2.7vw;font-style:normal}.service-list b{color:var(--sub);font-size:5vw;font-weight:300}.bottom-tab-bar{position:absolute;right:0;bottom:0;left:0;z-index:5;display:flex;height:calc(60px + env(safe-area-inset-bottom));align-items:center;justify-content:space-around;padding-bottom:env(safe-area-inset-bottom);border-top:1px solid var(--border);background:var(--card-bg)}.bottom-tab-bar button{display:grid;width:60px;height:100%;padding:0;border:0;background:none;color:var(--sub);cursor:pointer;place-items:center}.bottom-tab-bar button.active{color:var(--app-text)}.bottom-tab-bar svg{width:24px;height:24px}.detail-page{padding-top:28px}.detail-header{display:grid;grid-template-columns:44px 1fr 44px;align-items:center;margin-bottom:6vw}.detail-header h2{margin:0;text-align:center;font-size:4.7vw}.back-button{font-size:34px;font-weight:200}.text-button{border:0;background:none;font-size:3.2vw;cursor:pointer}.detail-section{display:flex;flex-direction:column;gap:4vw}.info-card,.credit-card{display:flex;flex-direction:column;gap:2vw;padding:4vw;border:1px solid var(--border);border-radius:3vw;background:var(--card-bg)}.info-card strong{font-size:3.5vw}.info-card span{color:var(--sub);font-size:3vw;line-height:1.6}.bank-list{display:flex;flex-direction:column;gap:3vw}.bank-list article{display:flex;align-items:center;justify-content:space-between;padding:5vw;border-radius:4vw;background:#1c1c1e;color:#fff}.bank-list article span{display:flex;flex-direction:column;gap:3vw}.bank-list small{color:#aaa}.bank-list button,.order-row button{border:0;background:none;color:var(--sub);font-size:3vw;cursor:pointer}.settings-card button{display:flex;align-items:center;width:100%;padding:4vw;border:0;background:none;text-align:left;cursor:pointer}.settings-card button>span{display:flex;flex:1;flex-direction:column;gap:1vw}.settings-card strong{font-size:3.5vw}.settings-card small{color:var(--sub);font-size:2.7vw}.settings-card i{position:relative;width:12vw;height:7vw;border-radius:5vw;background:#d1d1d6;transition:.2s}.settings-card i b{position:absolute;top:.6vw;left:.6vw;width:5.8vw;height:5.8vw;border-radius:50%;background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.2);transition:.2s}.settings-card i.on{background:#34c759}.settings-card i.on b{transform:translateX(5vw)}.credit-card{padding:6vw;background:#1c1c1e;color:#fff}.credit-card>small{color:#aaa}.credit-card>strong{font-size:8vw}.credit-card>div{display:flex;justify-content:space-between;color:#bbb;font-size:2.8vw}.primary-button,.danger-button{padding:3vw 5vw;border:0;border-radius:3vw;background:var(--app-text);color:var(--app-bg)!important;font-weight:600;cursor:pointer}.primary-button:disabled{cursor:not-allowed;opacity:.35}.primary-button.wide{width:100%;min-height:12vw}.danger-button{background:#ff3b30;color:#fff!important}.clickable{width:100%;border-top:0;border-right:0;border-left:0;background:none;text-align:left;cursor:pointer}.faq article{display:flex;flex-direction:column;gap:2vw;padding:4vw;border:1px solid var(--border);border-radius:3vw;background:var(--card-bg)}.faq article strong{font-size:3.5vw}.faq article span{color:var(--sub);font-size:3vw;line-height:1.6}.dialog-layer{position:absolute;inset:0;z-index:30;display:flex;align-items:flex-end;background:rgba(0,0,0,.36)}.dialog-card{width:100%;max-height:88%;overflow-y:auto;padding:5vw 5vw calc(5vw + env(safe-area-inset-bottom));border-radius:5vw 5vw 0 0;background:var(--card-bg);box-shadow:0 -10px 30px rgba(0,0,0,.12)}.dialog-card header{display:flex;align-items:center;justify-content:space-between;margin-bottom:5vw}.dialog-card h3{margin:0;font-size:4.5vw}.dialog-card header button{width:36px;height:36px;border:0;border-radius:50%;background:var(--icon-bg);color:var(--sub);font-size:24px;cursor:pointer}.dialog-card label{display:flex;flex-direction:column;gap:2vw;margin-bottom:4vw;color:var(--sub);font-size:3vw}.dialog-card input,.dialog-card select{width:100%;height:12vw;padding:0 3.5vw;border:1px solid var(--border);border-radius:3vw;outline:none;background:var(--app-bg);color:var(--app-text);font-size:3.6vw}.dialog-card input:focus,.dialog-card select:focus{border-color:var(--app-text);box-shadow:0 0 0 2px var(--icon-bg)}.segmented{display:grid;grid-template-columns:1fr 1fr;margin-bottom:4vw;padding:.8vw;border-radius:3vw;background:var(--app-bg)}.segmented button{padding:2.5vw;border:0;border-radius:2.4vw;background:none;color:var(--sub);cursor:pointer}.segmented button.active{background:var(--card-bg);color:var(--app-text);box-shadow:0 1px 5px rgba(0,0,0,.08)}.form-note{margin:0 0 4vw;color:var(--sub);font-size:2.8vw;line-height:1.55}.confirm-copy{display:flex;flex-direction:column;gap:2vw}.confirm-copy strong{font-size:4vw}.confirm-copy span{color:var(--sub);font-size:3vw;line-height:1.6}.confirm-actions{display:grid;grid-template-columns:1fr 1fr;gap:3vw;margin-top:5vw}.confirm-actions>button:first-child{border:1px solid var(--border);border-radius:3vw;background:var(--app-bg)}.toast{position:absolute;right:5vw;bottom:calc(76px + env(safe-area-inset-bottom));left:5vw;z-index:50;padding:3.5vw;border-radius:3vw;background:#1c1c1e;color:#fff;text-align:center;font-size:3.2vw;box-shadow:0 8px 22px rgba(0,0,0,.18)}.toast.error{background:#b42318}.toast-enter-active,.toast-leave-active{transition:.2s}.toast-enter-from,.toast-leave-to{transform:translateY(8px);opacity:0}@media (min-width:700px){.tab-content{padding-right:28px;padding-left:28px}.page-header{margin-bottom:28px}.title-button{font-size:28px}.title-button span{margin-left:12px;font-size:18px}.asset-card{margin-bottom:28px;padding:28px;border-radius:22px}.asset-amount{font-size:42px}.card-title{font-size:15px}.sparkline{width:140px;height:44px}.action-grid{margin-bottom:38px}.action-item i{width:62px;height:62px}.action-item span{font-size:15px}.section-block{margin-bottom:38px}.section-block h3{margin-bottom:20px;font-size:20px}.quick-funcs{gap:14px}.quick-card{min-height:84px;padding:15px;border-radius:16px}.quick-card>i{width:42px;height:42px}.quick-card strong{font-size:16px}.quick-card small{font-size:13px}.dialog-card{padding:26px 28px 30px;border-radius:26px 26px 0 0}.dialog-card h3{font-size:23px}.dialog-card input,.dialog-card select{height:54px;font-size:17px}.detail-header h2{font-size:24px}}
</style>
