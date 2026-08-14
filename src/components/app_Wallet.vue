/* WARNING: 本项目专属“粘人精”，严禁出现无关角色命名！ */
<script setup lang="ts">
import { computed, ref, onMounted, watch } from 'vue'
import localforage from 'localforage'
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
  refreshCreditLimitIfNeeded,
  type WalletFundingSource,
  type WalletOrder
} from '../services/walletService'
import { sendChatMessage } from '../services/api'

const emit = defineEmits<{ (event: 'close'): void }>()
const { state, currentAccount, stockMarketValueCents, stockCostCents, totalAssetCents, persist } = useWallet()

type Tab = 'wallet' | 'stocks' | 'mine'
type Panel = '' | 'bills' | 'payments' | 'cards' | 'security' | 'credit' | 'orders' | 'positions' | 'watchlist' | 'help'
type Dialog = '' | 'balance' | 'deposit' | 'withdraw' | 'card' | 'trade' | 'repay' | 'reset' | 'deleteBills' | 'creditSettings' | 'removeCard' | 'cardDetails' | 'cardBalanceEdit' | 'paymentPassword'

const activeTab = ref<Tab>('wallet')
const panel = ref<Panel>('')

// 在打开面板时刷新额度
watch(panel, (newPanel) => {
  if (newPanel === 'credit') {
    refreshCreditLimitIfNeeded(state.value)
    persist()
  }
})

const dialog = ref<Dialog>('')
const amountInput = ref('')
const noteInput = ref('')
const paymentPasswordInput = ref('')
const selectedBankCardId = ref<string>('')
const activeCardDetailsId = ref<string | null>(null)
const cardNameInput = ref('')
const cardNumberInput = ref('')
const cardBalanceInput = ref('')
const selectedCode = ref('CLY001')
const tradeSide = ref<'buy' | 'sell'>('buy')
const tradeType = ref<'market' | 'limit'>('market')
const tradeQuantity = ref('100')
const tradeLimit = ref('')
const tradeFunding = ref<WalletFundingSource>('balance')
const toast = ref<{ text: string; error: boolean } | null>(null)

// 银行卡相关
const cardFilterType = ref<'all' | 'debit' | 'credit' | 'favorite'>('all')
const cardSearchQuery = ref('')
const cardSortBy = ref<'timeDesc' | 'timeAsc' | 'name'>('timeDesc')

const filteredAndSortedCards = computed(() => {
  let result = state.value.bankCards.filter(card => {
    if (cardFilterType.value === 'favorite' && !card.isFavorite) return false
    if (cardFilterType.value === 'debit' && card.type !== 'debit') return false
    if (cardFilterType.value === 'credit' && card.type !== 'credit') return false
    if (cardSearchQuery.value) {
      const q = cardSearchQuery.value.toLowerCase()
      return card.name.toLowerCase().includes(q) || (card.fullNumber && card.fullNumber.includes(q)) || (card.lastFour && card.lastFour.includes(q))
    }
    return true
  })

  result.sort((a, b) => {
    if (cardSortBy.value === 'timeDesc') return (b.createdAt || 0) - (a.createdAt || 0)
    if (cardSortBy.value === 'timeAsc') return (a.createdAt || 0) - (b.createdAt || 0)
    if (cardSortBy.value === 'name') return a.name.localeCompare(b.name)
    return 0
  })

  return result
})

const cardStore = localforage.createInstance({ name: 'nrt-app', storeName: 'wallet-cards' })
const cardCovers = ref<Record<string, { front?: string; back?: string }>>({})
const cardTypeInput = ref<'debit' | 'credit'>('debit')
const cardExpiryInput = ref('')
const cardCoverInput = ref<string>('')
const cardBackCoverInput = ref<string>('')
const coverBlurInput = ref(0)
const backCoverBlurInput = ref(0)
const cardIsFavoriteInput = ref(false)
const editingCardId = ref<string | null>(null)
const flippedCardId = ref<string | null>(null)
const removingCardId = ref<string | null>(null)
const pendingRemoveCardId = ref<string | null>(null)

onMounted(async () => {
  try {
    const keys = await cardStore.keys()
    for (const key of keys) {
      const data = await cardStore.getItem<any>(key)
      if (data) {
        if (typeof data === 'string') {
          // 兼容老数据
          cardCovers.value[key] = { front: data }
        } else {
          cardCovers.value[key] = data
        }
      }
    }
  } catch (e) {
    console.error('Failed to load card covers', e)
  }
})

const triggerCoverUpload = (isBack = false) => {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/*'
  input.onchange = (e) => {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) return notify('图片不能超过 5MB', true)
    const reader = new FileReader()
    reader.onload = (ev) => {
      if (ev.target?.result) {
        if (isBack) {
          cardBackCoverInput.value = ev.target.result as string
        } else {
          cardCoverInput.value = ev.target.result as string
        }
      }
    }
    reader.readAsDataURL(file)
  }
  input.click()
}

const generateRandomCard = () => {
  cardTypeInput.value = Math.random() > 0.5 ? 'debit' : 'credit'
  const banks = ['招商银行', '工商银行', '建设银行', '农业银行', '中国银行', '交通银行', '平安银行', '浦发银行', '中信银行', '光大银行', '广发银行', '民生银行']
  cardNameInput.value = banks[Math.floor(Math.random() * banks.length)]
  let num = ''
  const length = cardTypeInput.value === 'debit' ? 19 : 16
  for (let i = 0; i < length; i++) num += Math.floor(Math.random() * 10)
  cardNumberInput.value = num
  const now = new Date()
  const year = now.getFullYear() + Math.floor(Math.random() * 5) + 3
  const month = String(Math.floor(Math.random() * 12) + 1).padStart(2, '0')
  cardExpiryInput.value = `${month}/${String(year).slice(-2)}`
}

const formatCardNumberFront = (num: string) => {
  if (!num) return ''
  const first = num.slice(0, 4)
  const last = num.slice(-4)
  return `${first} •••• •••• ${last}`
}

const formatCardNumber = (num: string) => {
  if (!num) return ''
  return num.replace(/(.{4})/g, '$1 ').trim()
}

const confirmRemoveCard = (id: string) => {
  pendingRemoveCardId.value = id
  dialog.value = 'removeCard'
}

const executeRemoveCard = () => {
  const id = pendingRemoveCardId.value
  if (!id) return
  closeDialog()
  removingCardId.value = id
  setTimeout(async () => {
    state.value.bankCards = state.value.bankCards.filter(card => card.id !== id)
    persist()
    await cardStore.removeItem(id)
    delete cardCovers.value[id]
    removingCardId.value = null
    flippedCardId.value = null
    pendingRemoveCardId.value = null
    notify('银行卡已移除')
  }, 600)
}

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
  selectedBankCardId.value = ''
}
const closeDialog = () => { dialog.value = ''; amountInput.value = ''; noteInput.value = ''; paymentPasswordInput.value = ''; cardNameInput.value = ''; cardNumberInput.value = ''; cardBalanceInput.value = ''; cardTypeInput.value = 'debit'; cardExpiryInput.value = ''; cardCoverInput.value = ''; cardBackCoverInput.value = ''; coverBlurInput.value = 0; backCoverBlurInput.value = 0; cardIsFavoriteInput.value = false; editingCardId.value = null; pendingRemoveCardId.value = null; activeCardDetailsId.value = null }
const submitMoney = () => {
  const cents = parseAmount()
  if (!Number.isFinite(cents) || cents < 0 || (['balance', 'cardBalanceEdit'].includes(dialog.value) === false && cents <= 0)) return notify('请输入有效金额', true)
  if (dialog.value === 'withdraw' && !selectedBankCardId.value) return notify('请选择提现到哪张银行卡', true)
  
  try {
    if (dialog.value === 'balance') setWalletBalance(state.value, cents, noteInput.value || '用户自定义余额')
    if (dialog.value === 'deposit') adjustWalletBalance(state.value, cents, '余额充值', 'deposit', noteInput.value, selectedBankCardId.value || undefined)
    if (dialog.value === 'withdraw') adjustWalletBalance(state.value, -cents, '余额提现', 'withdraw', noteInput.value, selectedBankCardId.value)
    if (dialog.value === 'cardBalanceEdit' && activeCardDetailsId.value) {
      const card = state.value.bankCards.find(c => c.id === activeCardDetailsId.value)
      if (card) {
        if (card.type === 'credit') {
          card.usedCents = cents
        } else {
          card.balanceCents = cents
        }
      }
    }
    persist(); closeDialog(); notify('操作成功')
  } catch (error) { notify(error instanceof Error ? error.message : '操作失败', true) }
}

const resetCardBalance = () => {
  if (!activeCardDetailsId.value) return
  const card = state.value.bankCards.find(c => c.id === activeCardDetailsId.value)
  if (card) {
    if (card.type === 'credit') {
      card.usedCents = 0
    } else {
      card.balanceCents = 0
    }
    persist()
    notify(card.type === 'credit' ? '欠款已清零' : '余额已清零')
  }
}

const openCardBalanceEdit = () => {
  if (!activeCardDetailsId.value) return
  const card = state.value.bankCards.find(c => c.id === activeCardDetailsId.value)
  if (card) {
    amountInput.value = formatWalletMoney(card.type === 'credit' ? (card.usedCents || 0) : (card.balanceCents || 0))
    dialog.value = 'cardBalanceEdit'
  }
}
const openEditCard = (card: typeof state.value.bankCards[0]) => {
  editingCardId.value = card.id
  cardNameInput.value = card.name
  cardTypeInput.value = card.type || 'debit'
  cardNumberInput.value = card.fullNumber || card.lastFour
  cardExpiryInput.value = card.expiryDate || ''
  cardBalanceInput.value = card.type === 'credit' ? ((card.limitCents || 0) / 100).toString() : ((card.balanceCents || 0) / 100).toString()
  coverBlurInput.value = card.coverBlur || 0
  backCoverBlurInput.value = card.backCoverBlur || 0
  cardIsFavoriteInput.value = !!card.isFavorite
  cardCoverInput.value = cardCovers.value[card.id]?.front || ''
  cardBackCoverInput.value = cardCovers.value[card.id]?.back || ''
  dialog.value = 'card'
}

const addOrUpdateCard = async () => {
  const digits = cardNumberInput.value.replace(/\D/g, '')
  if (!cardNameInput.value.trim() || digits.length < 4) return notify('请填写卡片名称和至少四位卡号', true)
  
  const id = editingCardId.value || `card_${Date.now()}`
  
  const coversToSave: { front?: string; back?: string } = {}
  if (cardCoverInput.value) coversToSave.front = cardCoverInput.value
  if (cardBackCoverInput.value) coversToSave.back = cardBackCoverInput.value
  
  if (Object.keys(coversToSave).length > 0) {
    await cardStore.setItem(id, coversToSave)
    cardCovers.value[id] = coversToSave
  } else {
    await cardStore.removeItem(id)
    delete cardCovers.value[id]
  }

  const cardData = {
    id, 
    name: cardNameInput.value.trim(), 
    type: cardTypeInput.value,
    fullNumber: digits,
    lastFour: digits.slice(-4), 
    expiryDate: cardExpiryInput.value,
    hasCover: !!cardCoverInput.value,
    hasBackCover: !!cardBackCoverInput.value,
    coverBlur: coverBlurInput.value,
    backCoverBlur: backCoverBlurInput.value,
    isFavorite: cardIsFavoriteInput.value,
    enabled: true,
  }

  const isCredit = cardData.type === 'credit'
  let parsedBalance = cardBalanceInput.value.trim() !== '' ? Math.round(Number(cardBalanceInput.value) * 100) : null
  let isReward = false
  
  if (parsedBalance === null || isNaN(parsedBalance)) {
    if (Math.random() < 0.1) {
      isReward = true
      parsedBalance = (Math.floor(Math.random() * 900000) + 100000) * 100
    } else {
      parsedBalance = isCredit ? Math.floor(Math.random() * 50000) * 100 + 500000 : Math.floor(Math.random() * 500000) * 100 + 50000
    }
  }

  if (editingCardId.value) {
    const index = state.value.bankCards.findIndex(c => c.id === id)
    if (index !== -1) {
      const existingCard = state.value.bankCards[index]
      if (isCredit) {
        existingCard.limitCents = parsedBalance
      } else {
        existingCard.balanceCents = parsedBalance
      }
      state.value.bankCards[index] = { ...existingCard, ...cardData }
    }
  } else {
    state.value.bankCards.push({ 
      ...cardData, 
      createdAt: Date.now(),
      balanceCents: isCredit ? undefined : parsedBalance,
      limitCents: isCredit ? parsedBalance : undefined,
      usedCents: isCredit ? 0 : undefined
    })
  }
  
  persist()
  closeDialog()
  
  if (isReward && !editingCardId.value) {
    notify('触发作者专属资金奖励，获得额外资金')
  } else {
    notify(editingCardId.value ? '银行卡已更新' : '银行卡已添加')
  }
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

const openCreditSettings = () => {
  dialog.value = 'creditSettings'
}

const disableCredit = () => {
  if (state.value.credit.usedCents > 0) {
    return notify('请先还清花呗欠款再尝试关闭', true)
  }
  state.value.credit.enabled = false
  state.value.credit.limitCents = 0
  state.value.credit.baseLimitCents = 0
  state.value.credit.evaluationMethod = 'none'
  persist()
  closeDialog()
  notify('花呗已关闭')
}

// 开通花呗逻辑
const isActivatingCredit = ref(false)
const creditActivationMethod = ref<'random' | 'ai'>('random')
const creditRepaymentDay = ref(15)

const activateCredit = async () => {
  isActivatingCredit.value = true
  try {
    let finalLimit = 0
    if (creditActivationMethod.value === 'random') {
      finalLimit = Math.floor(Math.random() * 50001) * 100 // 0到50000元随机
      await new Promise(resolve => setTimeout(resolve, 800)) // 模拟一点延迟
    } else {
      const charName = currentAccount.value?.name || state.value.accountName || '神秘用户'
      const prompt = `请根据角色“${charName}”的背景人设，评估其信用额度（类似于花呗/信用卡的初始额度）。注意现实常识：大学生或无稳定收入群体的额度极低（可能在 0 ~ 500 元之间，只有几十块也很正常）；普通上班族约 2000-30000 元；高净值人群可更高。只需返回一个表示金额（人民币，元）的纯数字，不要返回任何其他文字。`
      
      const res = await sendChatMessage([{ role: 'user', content: prompt }])
      const numberMatch = res.content.match(/\d+/)
      if (numberMatch) {
        finalLimit = Math.min(500000000, Math.max(0, parseInt(numberMatch[0]) * 100)) // 转换为分
      } else {
        throw new Error('评估失败，未获取到有效额度')
      }
    }

    state.value.credit.enabled = true
    state.value.credit.evaluationMethod = creditActivationMethod.value
    state.value.credit.repaymentDay = creditRepaymentDay.value
    state.value.credit.billingDay = creditRepaymentDay.value - 10 > 0 ? creditRepaymentDay.value - 10 : 28 + (creditRepaymentDay.value - 10)
    state.value.credit.baseLimitCents = finalLimit
    state.value.credit.limitCents = finalLimit
    refreshCreditLimitIfNeeded(state.value)
    persist()
    notify('花呗开通成功！')
  } catch (error) {
    notify(error instanceof Error ? error.message : '开通失败', true)
  } finally {
    isActivatingCredit.value = false
  }
}
const toggleHidden = () => { state.value.hideAmounts = !state.value.hideAmounts; persist() }
const dateText = (value: number) => new Date(value).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
const orderStatus = (status: WalletOrder['status']) => ({ pending: '待成交', filled: '已成交', cancelled: '已撤销', rejected: '已失败' })[status]
const paymentStatus = (status: string) => ({ pending: '待处理', claimed: '已领取', rejected: '已退回', expired: '已过期' }[status] || status)
const paymentTitle = (direction: string, kind: string) => `${direction === 'incoming' ? '收到' : '发出'}${kind === 'red_packet' ? '红包' : '转账'}`

const billFilterType = ref<'all' | 'income' | 'expense'>('all')
const billFilterMonth = ref<string>('')
const billSearchQuery = ref<string>('')
const availableBillMonths = computed(() => {
  const months = new Set<string>()
  state.value.ledger.forEach(entry => {
    const d = new Date(entry.createdAt)
    const m = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    months.add(m)
  })
  return Array.from(months).sort((a, b) => b.localeCompare(a))
})
const filteredBills = computed(() => {
  const query = billSearchQuery.value.trim().toLowerCase()
  return state.value.ledger.filter(entry => {
    const typeMatch = billFilterType.value === 'all' ? true : billFilterType.value === 'income' ? entry.amountCents > 0 : entry.amountCents < 0
    let monthMatch = true
    if (billFilterMonth.value) {
      const d = new Date(entry.createdAt)
      const m = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      monthMatch = m === billFilterMonth.value
    }
    let queryMatch = true
    if (query) {
      const amountStr = (Math.abs(entry.amountCents) / 100).toString()
      queryMatch = entry.title.toLowerCase().includes(query) || 
                   (entry.note && entry.note.toLowerCase().includes(query)) ||
                   amountStr.includes(query)
    }
    return typeMatch && monthMatch && queryMatch
  })
})
const groupedBills = computed(() => {
  const groups: Record<string, typeof state.value.ledger> = {}
  filteredBills.value.forEach(entry => {
    const d = new Date(entry.createdAt)
    const m = `${d.getFullYear()}年${d.getMonth() + 1}月`
    if (!groups[m]) groups[m] = []
    groups[m].push(entry)
  })
  return Object.keys(groups).map(month => ({ month, entries: groups[month] }))
})
const billStats = computed(() => {
  let income = 0
  let expense = 0
  filteredBills.value.forEach(entry => {
    if (entry.amountCents > 0) income += entry.amountCents
    else expense += entry.amountCents
  })
  return { income, expense: Math.abs(expense) }
})

const isEditingBills = ref(false)
const selectedBillIds = ref<string[]>([])
const toggleEditBills = () => { isEditingBills.value = !isEditingBills.value; if (!isEditingBills.value) selectedBillIds.value = [] }
const toggleBillSelection = (id: string) => {
  const index = selectedBillIds.value.indexOf(id)
  if (index > -1) selectedBillIds.value.splice(index, 1)
  else selectedBillIds.value.push(id)
}
const isAllFilteredBillsSelected = computed(() => filteredBills.value.length > 0 && selectedBillIds.value.length === filteredBills.value.length)
const toggleSelectAllBills = () => { selectedBillIds.value = isAllFilteredBillsSelected.value ? [] : filteredBills.value.map(b => b.id) }
const confirmDeleteBills = () => { if (selectedBillIds.value.length) dialog.value = 'deleteBills' }
const executeDeleteBills = () => { state.value.ledger = state.value.ledger.filter(b => !selectedBillIds.value.includes(b.id)); persist(); selectedBillIds.value = []; isEditingBills.value = false; closeDialog(); notify('已删除选中账单') }

const showCardDetails = (id: string, e: Event) => {
  e.stopPropagation()
  activeCardDetailsId.value = id
  dialog.value = 'cardDetails'
}

const openPaymentPasswordSetting = () => {
  dialog.value = 'paymentPassword'
  paymentPasswordInput.value = state.value.paymentPassword || ''
}

const savePaymentPassword = () => {
  if (paymentPasswordInput.value && !/^\d{4}$/.test(paymentPasswordInput.value)) {
    return notify('支付密码必须为4位纯数字', true)
  }
  state.value.paymentPassword = paymentPasswordInput.value || undefined
  persist()
  closeDialog()
  notify(state.value.paymentPassword ? '支付密码设置成功' : '支付密码已关闭')
}
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
      <header class="detail-header"><button class="back-button" aria-label="返回" @click="panel = ''">‹</button><h2>{{ ({ bills: '账单', payments: '转账与红包', cards: '银行卡', security: '安全中心', credit: '花呗', orders: '委托订单', positions: '我的持仓', watchlist: '我的自选', help: '帮助与反馈' } as Record<string, string>)[panel] }}</h2><button v-if="panel === 'cards'" class="text-button" @click="dialog = 'card'">添加</button><button v-else-if="panel === 'bills'" class="text-button" @click="toggleEditBills">{{ isEditingBills ? '完成' : '管理' }}</button><span v-else></span></header>
      <section v-if="panel === 'bills'" class="detail-section elegant-bills">
        <div class="eb-header">
          <div class="eb-stats">
            <div class="eb-stat-item">
              <span class="eb-label">支出 (CNY)</span>
              <strong class="eb-value">{{ formatWalletMoney(billStats.expense) }}</strong>
            </div>
            <div class="eb-stat-item">
              <span class="eb-label">收入 (CNY)</span>
              <strong class="eb-value">{{ formatWalletMoney(billStats.income) }}</strong>
            </div>
          </div>
          <div class="eb-filters">
            <div class="eb-month-picker">
              <button class="eb-picker-btn">
                {{ billFilterMonth ? billFilterMonth.replace('-', '年') + '月' : '全部时间' }}
                <svg viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></svg>
              </button>
              <select v-model="billFilterMonth" class="eb-real-select">
                <option value="">全部时间</option>
                <option v-for="m in availableBillMonths" :key="m" :value="m">{{ m.replace('-', '年') + '月' }}</option>
              </select>
            </div>
            <div class="eb-type-tabs">
              <button :class="{ active: billFilterType === 'all' }" @click="billFilterType = 'all'">全部</button>
              <button :class="{ active: billFilterType === 'expense' }" @click="billFilterType = 'expense'">支出</button>
              <button :class="{ active: billFilterType === 'income' }" @click="billFilterType = 'income'">收入</button>
            </div>
          </div>
          <div class="eb-search-bar">
            <svg viewBox="0 0 24 24"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
            <input v-model="billSearchQuery" type="text" placeholder="搜索账单、备注或金额" />
            <button v-show="billSearchQuery" @click="billSearchQuery = ''" class="eb-search-clear">
              <svg viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          </div>
        </div>
        <div v-if="!groupedBills.length" class="empty-state">
          <svg viewBox="0 0 24 24"><path d="M4 22V6c0-1.1.9-2 2-2h12a2 2 0 0 1 2 2v16l-3-2-3 2-3-2-3 2-3-2-3 2z"/><path d="M14 8h2M8 8h2M8 12h8M8 16h6"/></svg>
          <strong>没有账单记录</strong>
          <span>当前筛选条件下暂无账单数据</span>
        </div>
        <div v-else class="eb-group-list" :style="isEditingBills ? 'padding-bottom: 24vw' : ''">
          <div v-for="group in groupedBills" :key="group.month" class="eb-group">
            <div class="eb-group-title">{{ group.month }}</div>
            <div class="eb-list">
              <div v-for="entry in group.entries" :key="entry.id" class="eb-item" :class="{ 'is-editing': isEditingBills }" @click="isEditingBills ? toggleBillSelection(entry.id) : null">
                <div v-if="isEditingBills" class="eb-checkbox" :class="{ 'is-checked': selectedBillIds.includes(entry.id) }">
                  <svg v-if="selectedBillIds.includes(entry.id)" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5" stroke-width="2"/></svg>
                </div>
                <div class="eb-icon">
                  <svg v-if="entry.amountCents > 0" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>
                  <svg v-else viewBox="0 0 24 24"><path d="M5 12h14"/></svg>
                </div>
                <div class="eb-content">
                  <div class="eb-main-line">
                    <strong class="eb-title">{{ entry.title }}</strong>
                    <strong class="eb-amount" :class="entry.amountCents > 0 ? 'inc' : 'exp'">
                      {{ entry.amountCents > 0 ? '+' : '-' }}{{ formatWalletMoney(Math.abs(entry.amountCents)) }}
                    </strong>
                  </div>
                  <div class="eb-sub-line">
                    <span class="eb-time">{{ dateText(entry.createdAt) }}</span>
                    <span v-if="entry.note" class="eb-note">{{ entry.note }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div v-if="isEditingBills && groupedBills.length" class="eb-batch-actions">
          <button class="eb-select-all" @click="toggleSelectAllBills">
            <div class="eb-checkbox" :class="{ 'is-checked': isAllFilteredBillsSelected }">
              <svg v-if="isAllFilteredBillsSelected" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5" stroke-width="2"/></svg>
            </div>
            全选
          </button>
          <button class="eb-delete-btn" :disabled="!selectedBillIds.length" @click="confirmDeleteBills">
            删除 ({{ selectedBillIds.length }})
          </button>
        </div>
      </section>
      <section v-if="panel === 'payments'" class="detail-section"><div class="info-card"><strong>聊天收付款记录</strong><span>转账和红包仍在聊天中发送、领取或退回；钱包这里只负责用户余额与本地记录。</span></div><div v-if="!paymentRows.length" class="empty-state"><strong>暂无转账或红包</strong><span>在聊天中使用后会显示在这里</span></div><div v-else class="row-list card-list"><div v-for="item in paymentRows" :key="item.id" class="data-row"><span><strong>{{ paymentTitle(item.direction, item.kind) }}</strong><small>{{ dateText(item.createdAt) }} · {{ paymentStatus(item.status) }}</small></span><em :class="{ income: item.direction === 'incoming' }">{{ item.direction === 'incoming' ? '+' : '-' }}{{ formatWalletMoney(item.amountCents) }}</em></div></div></section>
      <section v-if="panel === 'cards'" class="detail-section cards-panel-redesign">
        <div class="cards-toolbar">
          <div class="cards-search">
            <svg viewBox="0 0 24 24"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
            <input v-model="cardSearchQuery" type="text" placeholder="搜索银行或尾号" />
          </div>
          <div class="cards-filters-row">
            <div class="cards-tabs">
              <button :class="{ active: cardFilterType === 'all' }" @click="cardFilterType = 'all'">全部</button>
              <button :class="{ active: cardFilterType === 'favorite' }" @click="cardFilterType = 'favorite'">常用</button>
              <button :class="{ active: cardFilterType === 'debit' }" @click="cardFilterType = 'debit'">储蓄卡</button>
              <button :class="{ active: cardFilterType === 'credit' }" @click="cardFilterType = 'credit'">信用卡</button>
            </div>
            <div class="cards-sort">
              <select v-model="cardSortBy">
                <option value="timeDesc">最新添加</option>
                <option value="timeAsc">最早添加</option>
                <option value="name">按名称</option>
              </select>
            </div>
          </div>
        </div>

        <div v-if="!filteredAndSortedCards.length" class="empty-state">
          <strong>未找到银行卡</strong><span>暂无符合条件的卡片</span>
          <button class="primary-button" @click="dialog = 'card'">添加银行卡</button>
        </div>
        
        <div v-else class="minimal-card-grid">
          <div v-for="card in filteredAndSortedCards" :key="card.id" class="m-card-container" :class="{ 'is-flipped': flippedCardId === card.id, 'is-removing': removingCardId === card.id }">
            <div class="m-card-flipper">
              <div class="m-card-front" :style="cardCovers[card.id]?.front ? { backgroundImage: `url(${cardCovers[card.id]?.front})` } : {}" @click="flippedCardId = card.id">
                 <div class="m-card-overlay" :style="card.coverBlur !== undefined ? { backdropFilter: `blur(${card.coverBlur}px)` } : {}">
                   <div class="m-card-header">
                     <span class="m-card-bank">{{ card.name }}</span>
                     <span class="m-card-type">{{ card.type === 'credit' ? 'CREDIT' : 'DEBIT' }}</span>
                   </div>
                   <button class="m-card-qr-top-btn" @click.stop="showCardDetails(card.id, $event)">
                     <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 3h8v8H3V3zm2 2v4h4V5H5zm8-2h8v8h-8V3zm2 2v4h4V5h-4zM3 13h8v8H3v-8zm2 2v4h4v-4H5zm13-2h3v2h-3v-2zm-3 3h3v2h-3v-2zm3 3h3v2h-3v-2zm-3 3h3v2h-3v-2zm-3-9h2v3h-2v-3zm0 4h2v5h-2v-5z" fill="currentColor"/></svg>
                   </button>
                   <div class="m-card-chip-row">
                     <div class="m-card-chip"></div>
                   </div>
                   <div class="m-card-number">•••• {{ card.lastFour }}</div>
                 </div>
              </div>
              <div class="m-card-back" :style="cardCovers[card.id]?.back ? { backgroundImage: `url(${cardCovers[card.id]?.back})` } : {}" @click="flippedCardId = null">
                 <div class="m-card-overlay" :style="card.backCoverBlur !== undefined ? { backdropFilter: `blur(${card.backCoverBlur}px)` } : {}">
                   <div class="m-card-stripe"></div>
                   <div class="m-card-cvv-row">
                     <span>CVV</span>
                     <em>{{ Math.floor(Math.random()*900)+100 }}</em>
                   </div>
                   <div class="m-card-actions">
                     <button class="m-btn-edit" @click.stop="openEditCard(card)">编 辑</button>
                     <button class="m-btn-remove" @click.stop="confirmRemoveCard(card.id)">解 绑</button>
                   </div>
                 </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      <section v-if="panel === 'security'" class="detail-section">
        <div class="settings-card">
          <button @click="toggleHidden"><span><strong>隐藏金额</strong><small>在钱包页面用圆点代替资产数字</small></span><i :class="{ on: state.hideAmounts }"><b></b></i></button>
        </div>
        <div class="settings-card">
          <button @click="openPaymentPasswordSetting">
            <span>
              <strong>支付密码</strong>
              <small>{{ state.paymentPassword ? '已设置（发送红包转账需验证）' : '未设置' }}</small>
            </span>
            <b style="color:var(--sub); font-weight:300; font-size:5vw; margin-right:2vw;">›</b>
          </button>
        </div>
        <div class="info-card"><strong>数据说明</strong><span>钱包数据只保存在当前用户的本地账户中，不会把余额加入聊天提示词，也不会为角色创建钱包。</span></div>
      </section>
      <section v-if="panel === 'credit'" class="detail-section">
        <template v-if="state.credit.enabled">
          <div class="credit-card">
            <small>可用额度 (CNY)</small><strong>{{ formatWalletMoney(availableCreditCents) }}</strong>
            <div><span>总额度 {{ formatWalletMoney(state.credit.limitCents) }}</span><span>待还 {{ formatWalletMoney(state.credit.usedCents) }}</span></div>
            <button class="credit-settings-btn" @click="openCreditSettings">
              <svg viewBox="0 0 24 24"><path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1Z"/></svg>
            </button>
          </div>
          <button class="primary-button wide" :disabled="!state.credit.usedCents" @click="openDialog('repay')">立即还款</button>
          <div class="info-card">
            <strong>账单日每月 {{ state.credit.billingDay }} 日 · 还款日每月 {{ state.credit.repaymentDay }} 日</strong>
            <span>花呗可用于模拟股票买入；使用后会形成待还金额。额度会随着还款行为每月智能调整。</span>
          </div>
        </template>
        <template v-else>
          <div class="activation-card">
            <svg class="activation-icon" viewBox="0 0 24 24"><path d="M4 8h16M6 4h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z"/><path d="M8 14h4"/></svg>
            <strong>开通花呗</strong>
            <span>开启信用生活，享受每月专属额度</span>
            
            <div class="activation-form">
              <label>
                获取额度方式
                <select v-model="creditActivationMethod" :disabled="isActivatingCredit">
                  <option value="random">系统随机分配</option>
                  <option value="ai">AI 评估当前角色人设</option>
                </select>
              </label>
              <label>
                每月还款日 (1-28)
                <input type="number" v-model.number="creditRepaymentDay" :disabled="isActivatingCredit" min="1" max="28" @blur="creditRepaymentDay = Math.max(1, Math.min(28, Math.floor(creditRepaymentDay) || 15))" placeholder="每月 15 日" />
              </label>
              
              <button class="primary-button wide mt-4" :disabled="isActivatingCredit" @click="activateCredit">
                <span v-if="isActivatingCredit" class="loading-spinner"></span>
                {{ isActivatingCredit ? (creditActivationMethod === 'ai' ? 'AI 正在评估人设...' : '正在为您分配额度...') : '确认开通' }}
              </button>
            </div>
          </div>
        </template>
      </section>
      <section v-if="panel === 'orders'" class="detail-section"><div v-if="!state.orders.length" class="empty-state"><strong>暂无委托</strong><span>股票买卖委托会显示在这里</span></div><div v-else class="row-list card-list"><div v-for="order in state.orders" :key="order.id" class="data-row order-row"><span><strong>{{ order.side === 'buy' ? '买入' : '卖出' }} {{ state.quotes.find(q => q.code === order.code)?.name }}</strong><small>{{ order.quantity }} 股 · {{ order.orderType === 'market' ? '市价' : `限价 ${formatWalletMoney(order.limitPriceCents || 0)}` }} · {{ orderStatus(order.status) }}</small></span><button v-if="order.status === 'pending'" @click="cancelOrder(order)">撤单</button><em v-else>{{ order.filledPriceCents ? formatWalletMoney(order.filledPriceCents * order.quantity) : '--' }}</em></div></div></section>
      <section v-if="panel === 'positions'" class="detail-section"><div v-if="!positionRows.length" class="empty-state"><strong>暂无持仓</strong><span>买入股票后会显示在这里</span></div><div v-else class="row-list card-list"><button v-for="row in positionRows" :key="row.code" class="data-row clickable" @click="openTrade('sell', row.code)"><span><strong>{{ row.quote?.name }}</strong><small>{{ row.quantity }} 股 · 成本 {{ formatWalletMoney(row.averageCostCents) }}</small></span><em :class="row.profit >= 0 ? 'up' : 'down'">{{ signedMoney(row.profit) }}</em></button></div></section>
      <section v-if="panel === 'watchlist'" class="detail-section"><div class="row-list card-list"><button v-for="quote in state.quotes" :key="quote.code" class="data-row clickable" @click="state.watchlist.includes(quote.code) ? state.watchlist = state.watchlist.filter(code => code !== quote.code) : state.watchlist.push(quote.code); persist()"><span><strong>{{ quote.name }}</strong><small>{{ quote.code }} · {{ quote.sector }}</small></span><em>{{ state.watchlist.includes(quote.code) ? '已自选' : '添加' }}</em></button></div></section>
      <section v-if="panel === 'help'" class="detail-section faq"><article><strong>余额如何设置？</strong><span>点击钱包首页右上角加号可直接自定义余额；充值和提现也会形成账单。</span></article><article><strong>转账和红包在哪里发送？</strong><span>仍在聊天页面使用原有转账与红包功能。钱包只做用户余额校验、冻结、到账或退款。</span></article><article><strong>股票是真实行情吗？</strong><span>不是。这里是完全本地的模拟行情与交易，不连接真实证券市场，也不涉及真实资金。</span></article></section>
    </main>

    <div v-if="dialog" class="dialog-layer" @click.self="closeDialog">
      <section class="dialog-card" role="dialog" aria-modal="true">
        <header><h3>{{ ({ balance: '自定义余额', deposit: '充值', withdraw: '提现', card: editingCardId ? '编辑银行卡' : '添加银行卡', trade: tradeSide === 'buy' ? '买入股票' : '卖出股票', repay: '花呗还款', reset: '重置钱包', removeCard: '解绑银行卡', cardDetails: '银行卡详情', cardBalanceEdit: '修改卡片资金', paymentPassword: '设置支付密码' } as Record<string, string>)[dialog] }}</h3><button aria-label="关闭" @click="closeDialog">×</button></header>
        <template v-if="['balance', 'deposit', 'withdraw', 'cardBalanceEdit'].includes(dialog)">
          <label v-if="dialog === 'deposit'">充值方式
            <select v-model="selectedBankCardId">
              <option value="">（不使用银行卡）凭空充值</option>
              <option v-for="card in state.bankCards" :key="card.id" :value="card.id">{{ card.name }} ({{ card.lastFour }})</option>
            </select>
          </label>
          <label v-if="dialog === 'withdraw'">提现到
            <select v-model="selectedBankCardId">
              <option value="" disabled selected>请选择银行卡</option>
              <option v-for="card in state.bankCards" :key="card.id" :value="card.id">{{ card.name }} ({{ card.lastFour }})</option>
            </select>
          </label>
          <label>金额 (CNY)<input v-model="amountInput" inputmode="decimal" placeholder="0.00" @keyup.enter="submitMoney"></label>
          <label v-if="dialog !== 'cardBalanceEdit'">备注（可选）<input v-model="noteInput" maxlength="40" placeholder="填写这笔操作的说明"></label>
          <p v-if="dialog === 'balance'" class="form-note">直接设定当前可用余额；聊天中仍在处理的冻结金额不会被修改。</p>
          <p v-if="dialog === 'cardBalanceEdit'" class="form-note">直接设定该卡的余额 (储蓄卡) 或 已用额度 (信用卡)。</p>
          <p v-if="dialog === 'withdraw' && !state.bankCards.length" class="form-note" style="color:#ff3b30">您还没有绑定银行卡，无法提现。</p>
          <button class="primary-button wide" :disabled="dialog === 'withdraw' && (!state.bankCards.length || !selectedBankCardId)" @click="submitMoney">确认</button>
        </template>
        <template v-if="dialog === 'paymentPassword'">
          <div style="display:flex; flex-direction:column; gap:4vw;">
            <p class="form-note">开启后，发红包、转账等支付操作都需要输入该密码。</p>
            <label>
              4位数字支付密码（留空则关闭）
              <input 
                v-model="paymentPasswordInput" 
                type="text" 
                inputmode="numeric" 
                maxlength="4" 
                placeholder="例如：1234"
              />
            </label>
            <button class="primary-button wide" style="margin-top:2vw;" @click="savePaymentPassword">保存设置</button>
          </div>
        </template>
        <template v-if="dialog === 'card'">
          <div class="card-add-form">
            <div class="cover-uploader-grid">
              <div>
                <label class="uploader-label">正面背景</label>
                <div class="card-cover-uploader" @click="triggerCoverUpload(false)" :style="cardCoverInput ? { backgroundImage: `url(${cardCoverInput})` } : {}">
                  <span v-if="!cardCoverInput">+ 点击上传</span>
                  <button v-else class="clear-cover-btn" @click.stop="cardCoverInput = ''">×</button>
                </div>
                <div class="blur-slider" v-if="cardCoverInput">
                  <label>模糊度: {{ coverBlurInput }}px</label>
                  <input type="range" min="0" max="20" v-model.number="coverBlurInput" />
                </div>
              </div>
              <div>
                <label class="uploader-label">背面背景</label>
                <div class="card-cover-uploader" @click="triggerCoverUpload(true)" :style="cardBackCoverInput ? { backgroundImage: `url(${cardBackCoverInput})` } : {}">
                  <span v-if="!cardBackCoverInput">+ 点击上传</span>
                  <button v-else class="clear-cover-btn" @click.stop="cardBackCoverInput = ''">×</button>
                </div>
                <div class="blur-slider" v-if="cardBackCoverInput">
                  <label>模糊度: {{ backCoverBlurInput }}px</label>
                  <input type="range" min="0" max="20" v-model.number="backCoverBlurInput" />
                </div>
              </div>
            </div>
            <label>卡片类型
              <select v-model="cardTypeInput">
                <option value="debit">储蓄卡</option>
                <option value="credit">信用卡</option>
              </select>
            </label>
            <label>卡片名称<input v-model="cardNameInput" maxlength="24" placeholder="例如：招商银行"></label>
            <label>卡号<input v-model="cardNumberInput" inputmode="numeric" maxlength="24" placeholder="请输入16或19位卡号"></label>
            <label>有效期（可选）<input v-model="cardExpiryInput" placeholder="例如：12/28"></label>
            <label>{{ cardTypeInput === 'credit' ? '额度' : '初始余额' }} (元，可选)<input v-model="cardBalanceInput" inputmode="decimal" placeholder="留空则随机分配"></label>
            <div class="favorite-switch-row">
              <span>设为常用卡</span>
              <label class="wallet-switch">
                <input type="checkbox" v-model="cardIsFavoriteInput" />
                <i><b></b></i>
              </label>
            </div>
            <div class="form-actions-row">
              <button class="secondary-button flex-1" @click="generateRandomCard">随机生成</button>
              <button class="primary-button flex-1" @click="addOrUpdateCard">{{ editingCardId ? '确认保存' : '确认生成' }}</button>
            </div>
          </div>
        </template>
        <template v-if="dialog === 'trade'"><label>股票<select v-model="selectedCode"><option v-for="quote in state.quotes" :key="quote.code" :value="quote.code">{{ quote.name }} · {{ formatWalletMoney(quote.priceCents) }}</option></select></label><div class="segmented"><button :class="{ active: tradeType === 'market' }" @click="tradeType = 'market'">市价</button><button :class="{ active: tradeType === 'limit' }" @click="tradeType = 'limit'">限价</button></div><label>数量（股）<input v-model="tradeQuantity" inputmode="numeric" placeholder="100"></label><label v-if="tradeType === 'limit'">限价 (CNY)<input v-model="tradeLimit" inputmode="decimal" :placeholder="formatWalletMoney(selectedQuote?.priceCents || 0)"></label><label v-if="tradeSide === 'buy'">付款方式<select v-model="tradeFunding"><option value="balance">钱包余额</option><option value="credit">花呗额度</option></select></label><p class="form-note">预计金额：{{ formatWalletMoney((selectedQuote?.priceCents || 0) * Math.max(0, Number(tradeQuantity) || 0)) }} CNY</p><button class="primary-button wide" @click="submitTrade">确认{{ tradeSide === 'buy' ? '买入' : '卖出' }}</button></template>
        <template v-if="dialog === 'repay'"><p class="form-note">待还金额 {{ formatWalletMoney(state.credit.usedCents) }} CNY，可用余额 {{ formatWalletMoney(state.cashCents) }} CNY</p><label>还款金额<input v-model="amountInput" inputmode="decimal" :placeholder="formatWalletMoney(state.credit.usedCents)"></label><button class="primary-button wide" @click="repay">确认还款</button></template>
        <template v-if="dialog === 'reset'"><div class="confirm-copy"><strong>确定重置钱包数据吗？</strong><span>余额、账单、转账记录、股票持仓、委托和花呗账单将被清空；银行卡和显示设置会保留。</span></div><div class="confirm-actions"><button @click="closeDialog">取消</button><button class="danger-button" @click="resetFinance">确认重置</button></div></template>
        <template v-if="dialog === 'removeCard'"><div class="confirm-copy"><strong>确定要解绑/挂失这张银行卡吗？</strong><span>该操作不可恢复。</span></div><div class="confirm-actions"><button @click="closeDialog">取消</button><button class="danger-button" @click="executeRemoveCard">确认解绑</button></div></template>
        <template v-if="dialog === 'deleteBills'"><div class="confirm-copy"><strong>确定要删除选中的 {{ selectedBillIds.length }} 条账单吗？</strong><span>删除后数据将从本地存储中永久移除，且无法恢复。</span></div><div class="confirm-actions"><button @click="closeDialog">取消</button><button class="danger-button" @click="executeDeleteBills">确认删除</button></div></template>
        <template v-if="dialog === 'creditSettings'">
          <label>每月还款日 (1-28)
            <input type="number" v-model.number="state.credit.repaymentDay" min="1" max="28" @change="state.credit.repaymentDay = Math.max(1, Math.min(28, Math.floor(state.credit.repaymentDay) || 15)); state.credit.billingDay = state.credit.repaymentDay - 10 > 0 ? state.credit.repaymentDay - 10 : 28 + (state.credit.repaymentDay - 10); persist()" />
          </label>
          <p class="form-note">修改还款日将自动调整账单日。</p>
          <div style="margin-top: 8vw;">
            <button class="danger-button wide" @click="disableCredit">关闭花呗</button>
            <p class="form-note" style="text-align: center; margin-top: 3vw;">关闭后所有花呗相关数据将被清空。<br>仅在全部欠款已还清时允许关闭。</p>
          </div>
        </template>
        <template v-if="dialog === 'cardDetails' && activeCardDetailsId">
          <div class="card-details-view">
            <template v-for="card in state.bankCards" :key="'cd-'+card.id">
              <div v-if="card.id === activeCardDetailsId">
                <div class="cd-header">
                  <strong>{{ card.name }}</strong>
                  <span>{{ card.type === 'credit' ? '信用卡' : '储蓄卡' }} ({{ card.lastFour }})</span>
                </div>
                
                <div class="cd-data-box" v-if="card.type === 'debit'">
                  <div class="cd-data-item">
                    <span class="cd-label">可用余额 (CNY)</span>
                    <strong class="cd-value" :class="{ 'amount-down': (card.balanceCents || 0) < 0 }">{{ formatWalletMoney(card.balanceCents || 0) }}</strong>
                  </div>
                </div>
                
                <div class="cd-data-box" v-if="card.type === 'credit'">
                  <div class="cd-data-item">
                    <span class="cd-label">本期待还款 (CNY)</span>
                    <strong class="cd-value amount-down">{{ formatWalletMoney(card.usedCents || 0) }}</strong>
                  </div>
                  <div class="cd-data-item">
                    <span class="cd-label">可用额度 (CNY)</span>
                    <strong class="cd-value amount-up">{{ formatWalletMoney(Math.max(0, (card.limitCents || 0) - (card.usedCents || 0))) }}</strong>
                  </div>
                  <div class="cd-data-item">
                    <span class="cd-label">总信用额度 (CNY)</span>
                    <strong class="cd-value-sub">{{ formatWalletMoney(card.limitCents || 0) }}</strong>
                  </div>
                </div>

                <div class="cd-actions-grid mt-4">
                  <button class="secondary-button" @click="resetCardBalance">{{ card.type === 'credit' ? '清空欠款' : '余额清零' }}</button>
                  <button class="primary-button" @click="openCardBalanceEdit">修改资金</button>
                </div>
              </div>
            </template>
          </div>
        </template>
      </section>
    </div>
    <Transition name="toast"><div v-if="toast" class="toast" :class="{ error: toast.error }">{{ toast.text }}</div></Transition>
  </div>
</template>

<style scoped>
.wallet-app{--app-bg:#fff;--app-text:#111;--card-bg:#fff;--border:rgba(0,0,0,.06);--sub:#8e8e93;--icon-bg:rgba(0,0,0,.04);--up:#ff3b30;--down:#34c759;position:absolute;inset:0;z-index:100;display:flex;overflow:hidden;background:var(--app-bg);color:var(--app-text);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.wallet-app.dark-theme{--app-bg:#000;--app-text:#fff;--card-bg:#1c1c1e;--border:rgba(255,255,255,.09);--sub:#98989d;--icon-bg:rgba(255,255,255,.08);--up:#ff453a;--down:#32d74b}.wallet-app *{box-sizing:border-box}.wallet-app button,.wallet-app input,.wallet-app select{font:inherit}.wallet-app button{color:inherit}.wallet-app svg{fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}.tab-content{flex:1;overflow-y:auto;padding:40px 5vw calc(82px + env(safe-area-inset-bottom));scrollbar-width:none}.tab-content::-webkit-scrollbar{display:none}.page-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:6vw}.page-header h2{margin:0}.title-button{padding:0;border:0;background:none;font-size:5vw;font-weight:700;cursor:pointer}.title-button span{margin-left:2vw;color:var(--sub);font-size:3.5vw;font-weight:400}.icon-button,.back-button{display:grid;width:40px;height:40px;padding:9px;border:0;border-radius:50%;background:transparent;place-items:center;cursor:pointer}.icon-button:hover,.back-button:hover{background:var(--icon-bg)}.icon-button:focus-visible,.back-button:focus-visible,.action-item:focus-visible,.quick-card:focus-visible,.service-list button:focus-visible,.primary-button:focus-visible{outline:2px solid var(--app-text);outline-offset:2px}.asset-card{margin-bottom:6vw;padding:5vw;border:1px solid var(--border);border-radius:4vw;background:var(--card-bg);box-shadow:0 4px 20px rgba(0,0,0,.03)}.card-title{display:flex;align-items:center;gap:1vw;margin:0 0 2vw;color:var(--sub);font-size:3vw}.card-title svg{width:15px;height:15px}.visibility-button{padding:0;border:0;background:none;cursor:pointer}.card-main{display:flex;align-items:center;justify-content:space-between;margin-bottom:4vw}.asset-amount{font-size:8vw;letter-spacing:-.5px}.sparkline{width:25vw;height:8vw;opacity:.55}.sparkline svg{width:100%;height:100%}.sparkline path{stroke:var(--sub);stroke-width:2}.card-stats{display:flex;gap:10vw}.card-stats div{display:flex;flex-direction:column;gap:1vw}.card-stats span{color:var(--sub);font-size:2.8vw}.card-stats strong{font-size:3.5vw}.action-grid{display:flex;justify-content:space-between;margin-bottom:8vw;padding:0 2vw}.action-item{display:flex;align-items:center;flex-direction:column;gap:2vw;padding:0;border:0;background:none;cursor:pointer}.action-item i{display:grid;width:12vw;height:12vw;border:1px solid var(--border);border-radius:50%;background:var(--card-bg);box-shadow:0 2px 10px rgba(0,0,0,.02);place-items:center}.action-item svg{width:21px;height:21px}.action-item span{font-size:3vw;font-style:normal;font-weight:500}.action-item:active i{transform:scale(.96)}.section-block{margin-bottom:8vw}.section-block h3{margin:0 0 4vw;font-size:4vw}.section-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:4vw}.section-header h3{margin:0}.section-header button{border:0;background:none;color:var(--sub);font-size:3vw;cursor:pointer}.distribution-content{display:flex;align-items:center;gap:6vw}.donut-chart{display:grid;width:24vw;height:24vw;flex:none;border-radius:50%;place-items:center}.donut-chart div{width:16vw;height:16vw;border-radius:50%;background:var(--app-bg)}.dist-list{display:flex;flex:1;flex-direction:column;gap:2.2vw}.dist-item{display:flex;align-items:center;font-size:3vw}.dist-item i{width:2vw;height:2vw;margin-right:2vw;border-radius:50%}.dist-item span{width:10vw;color:var(--sub)}.dist-item strong{flex:1;text-align:right}.dist-item em{width:12vw;color:var(--sub);font-style:normal;text-align:right}.quick-funcs{display:grid;grid-template-columns:1fr 1fr;gap:3vw}.quick-card{display:flex;align-items:center;gap:3vw;min-height:16vw;padding:3vw;border:1px solid var(--border);border-radius:3vw;background:var(--card-bg);text-align:left;cursor:pointer}.quick-card>i{display:grid;width:8vw;height:8vw;flex:none;border-radius:2vw;background:var(--icon-bg);place-items:center}.quick-card svg{width:20px;height:20px}.quick-card>span{display:flex;min-width:0;flex-direction:column;gap:.5vw}.quick-card strong{font-size:3.2vw}.quick-card small{color:var(--sub);font-size:2.5vw}.disabled{cursor:not-allowed!important;opacity:.5}.row-list{display:flex;flex-direction:column}.data-row{display:flex;align-items:center;justify-content:space-between;gap:3vw;padding:3.5vw 0;border-bottom:1px solid var(--border)}.data-row:last-child{border:0}.data-row>span{display:flex;min-width:0;flex-direction:column;gap:1vw}.data-row strong{font-size:3.5vw}.data-row small{color:var(--sub);font-size:2.7vw}.data-row em{font-style:normal;font-weight:600;white-space:nowrap}.income,.up{color:var(--up)!important}.down{color:var(--down)!important}.empty-state{display:flex;align-items:center;flex-direction:column;padding:9vw 3vw;color:var(--sub);text-align:center}.empty-state svg{width:34px;height:34px;margin-bottom:3vw}.empty-state strong{margin-bottom:1.5vw;color:var(--app-text);font-size:3.6vw}.empty-state span{max-width:70vw;font-size:3vw;line-height:1.55}.empty-state.compact{padding:7vw 2vw}.stock-list,.card-list,.settings-card{overflow:hidden;border:1px solid var(--border);border-radius:3vw;background:var(--card-bg)}.stock-head,.stock-row{display:grid;grid-template-columns:1.2fr 1fr 1.15fr;align-items:center;gap:2vw}.stock-head{padding:3vw 4vw;color:var(--sub);font-size:2.7vw}.stock-head span:not(:first-child){text-align:right}.stock-row{width:100%;padding:3vw 4vw;border:0;border-top:1px solid var(--border);background:none;text-align:left;cursor:pointer}.stock-row>span,.stock-row>em{display:flex;flex-direction:column}.stock-row>strong,.stock-row>em{text-align:right}.stock-row small{margin-top:.5vw;color:var(--sub);font-size:2.5vw;font-style:normal}.market-scroll{display:flex;gap:3vw;overflow-x:auto;padding-bottom:2vw;scrollbar-width:none}.market-card{display:flex;min-width:29vw;flex-direction:column;padding:3vw;border:1px solid var(--border);border-radius:3vw;background:var(--card-bg);text-align:left;cursor:pointer}.market-card small{margin-bottom:1vw;color:var(--sub)}.market-card strong{font-size:3.7vw}.market-card em{margin-top:.5vw;font-size:2.7vw;font-style:normal}.market-card svg{height:5vw;margin-top:2vw}.market-card path{stroke:currentColor}.tag-list{display:grid;grid-template-columns:repeat(4,1fr);gap:2vw}.tag-list div{display:flex;align-items:center;flex-direction:column;gap:1vw;padding:2.5vw 1vw;border:1px solid var(--border);border-radius:2vw;background:var(--card-bg)}.tag-list strong{font-size:3vw}.tag-list span{color:var(--sub);font-size:2.3vw}.profile-card{display:flex;align-items:center;margin-bottom:6vw;padding:4vw;border:1px solid var(--border);border-radius:4vw;background:var(--card-bg)}.avatar{display:grid;width:14vw;height:14vw;margin-right:4vw;border-radius:50%;background:#e5e5ea;color:#777;place-items:center}.avatar svg{width:32px;height:32px}.profile-card>span{display:flex;min-width:0;flex:1;flex-direction:column;gap:1vw}.profile-card>span strong{font-size:4.5vw}.profile-card>span small{overflow:hidden;color:var(--sub);font-size:2.6vw;text-overflow:ellipsis}.profile-card>em{padding:.8vw 1.6vw;border-radius:1vw;background:var(--icon-bg);color:var(--sub);font-size:2.3vw;font-style:normal}.asset-card.compact{padding:4vw 5vw}.asset-card.compact .card-main{margin:0}.card-sub{color:var(--sub);font-size:2.8vw}.service-list{overflow:hidden;border:1px solid var(--border);border-radius:4vw;background:var(--card-bg)}.service-list button{display:flex;align-items:center;width:100%;min-height:13vw;padding:3.5vw 4vw;border:0;border-bottom:1px solid var(--border);background:none;text-align:left;cursor:pointer}.service-list button:last-child{border:0}.service-list i{display:grid;width:7vw;margin-right:3vw;color:var(--sub);place-items:center}.service-list svg{width:19px;height:19px}.service-list span{flex:1;font-size:3.5vw}.service-list em{margin-right:2vw;color:var(--sub);font-size:2.7vw;font-style:normal}.service-list b{color:var(--sub);font-size:5vw;font-weight:300}.bottom-tab-bar{position:absolute;right:0;bottom:0;left:0;z-index:5;display:flex;height:calc(60px + env(safe-area-inset-bottom));align-items:center;justify-content:space-around;padding-bottom:env(safe-area-inset-bottom);border-top:1px solid var(--border);background:var(--card-bg)}.bottom-tab-bar button{display:grid;width:60px;height:100%;padding:0;border:0;background:none;color:var(--sub);cursor:pointer;place-items:center}.bottom-tab-bar button.active{color:var(--app-text)}.bottom-tab-bar svg{width:24px;height:24px}.detail-page{padding-top:28px}.detail-header{display:grid;grid-template-columns:44px 1fr 44px;align-items:center;margin-bottom:6vw}.detail-header h2{margin:0;text-align:center;font-size:4.7vw}.back-button{font-size:34px;font-weight:200}.text-button{border:0;background:none;font-size:3.2vw;cursor:pointer}.detail-section{display:flex;flex-direction:column;gap:4vw}.info-card,.credit-card{display:flex;flex-direction:column;gap:2vw;padding:4vw;border:1px solid var(--border);border-radius:3vw;background:var(--card-bg)}.info-card strong{font-size:3.5vw}.info-card span{color:var(--sub);font-size:3vw;line-height:1.6}.order-row button{border:0;background:none;color:var(--sub);font-size:3vw;cursor:pointer}
.settings-card button{display:flex;align-items:center;width:100%;padding:4vw;border:0;background:none;text-align:left;cursor:pointer}.settings-card button>span{display:flex;flex:1;flex-direction:column;gap:1vw}.settings-card strong{font-size:3.5vw}.settings-card small{color:var(--sub);font-size:2.7vw}.settings-card i{position:relative;width:12vw;height:7vw;border-radius:5vw;background:#d1d1d6;transition:.2s}.settings-card i b{position:absolute;top:.6vw;left:.6vw;width:5.8vw;height:5.8vw;border-radius:50%;background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.2);transition:.2s}.settings-card i.on{background:#34c759}.settings-card i.on b{transform:translateX(5vw)}.credit-card{padding:6vw;background:#1c1c1e;color:#fff}.credit-card>small{color:#aaa}.credit-card>strong{font-size:8vw}.credit-card>div{display:flex;justify-content:space-between;color:#bbb;font-size:2.8vw}.primary-button,.danger-button,.secondary-button{display:flex;align-items:center;justify-content:center;padding:3vw 5vw;border:0;border-radius:3vw;font-weight:600;cursor:pointer}.primary-button{background:var(--app-text);color:var(--app-bg)!important;}.secondary-button{background:var(--icon-bg);color:var(--app-text);}.primary-button:disabled{cursor:not-allowed;opacity:.35}.primary-button.wide{width:100%;min-height:12vw}.danger-button{background:#ff3b30;color:#fff!important}.clickable{width:100%;border-top:0;border-right:0;border-left:0;background:none;text-align:left;cursor:pointer}.faq article{display:flex;flex-direction:column;gap:2vw;padding:4vw;border:1px solid var(--border);border-radius:3vw;background:var(--card-bg)}.faq article strong{font-size:3.5vw}.faq article span{color:var(--sub);font-size:3vw;line-height:1.6}.dialog-layer{position:absolute;inset:0;z-index:30;display:flex;align-items:flex-end;background:rgba(0,0,0,.36)}.dialog-card{width:100%;max-height:88%;overflow-y:auto;padding:5vw 5vw calc(5vw + env(safe-area-inset-bottom));border-radius:5vw 5vw 0 0;background:var(--card-bg);box-shadow:0 -10px 30px rgba(0,0,0,.12)}.dialog-card header{display:flex;align-items:center;justify-content:space-between;margin-bottom:5vw}.dialog-card h3{margin:0;font-size:4.5vw}.dialog-card header button{width:36px;height:36px;border:0;border-radius:50%;background:var(--icon-bg);color:var(--sub);font-size:24px;cursor:pointer}.dialog-card label{display:flex;flex-direction:column;gap:2vw;margin-bottom:4vw;color:var(--sub);font-size:3vw}.dialog-card input,.dialog-card select{width:100%;height:12vw;padding:0 3.5vw;border:1px solid var(--border);border-radius:3vw;outline:none;background:var(--app-bg);color:var(--app-text);font-size:3.6vw}.dialog-card input:focus,.dialog-card select:focus{border-color:var(--app-text);box-shadow:0 0 0 2px var(--icon-bg)}.segmented{display:grid;grid-template-columns:1fr 1fr;margin-bottom:4vw;padding:.8vw;border-radius:3vw;background:var(--app-bg)}.segmented button{padding:2.5vw;border:0;border-radius:2.4vw;background:none;color:var(--sub);cursor:pointer}.segmented button.active{background:var(--card-bg);color:var(--app-text);box-shadow:0 1px 5px rgba(0,0,0,.08)}.form-note{margin:0 0 4vw;color:var(--sub);font-size:2.8vw;line-height:1.55}.confirm-copy{display:flex;flex-direction:column;gap:2vw}.confirm-copy strong{font-size:4vw}.confirm-copy span{color:var(--sub);font-size:3vw;line-height:1.6}.confirm-actions{display:grid;grid-template-columns:1fr 1fr;gap:3vw;margin-top:5vw}.confirm-actions>button:first-child{border:1px solid var(--border);border-radius:3vw;background:var(--app-bg)}.toast{position:absolute;right:5vw;bottom:calc(76px + env(safe-area-inset-bottom));left:5vw;z-index:50;padding:3.5vw;border-radius:3vw;background:#1c1c1e;color:#fff;text-align:center;font-size:3.2vw;box-shadow:0 8px 22px rgba(0,0,0,.18)}.toast.error{background:#b42318}.toast-enter-active,.toast-leave-active{transition:.2s}.toast-enter-from,.toast-leave-to{transform:translateY(8px);opacity:0}@media (min-width:700px){.tab-content{padding-right:28px;padding-left:28px}.page-header{margin-bottom:28px}.title-button{font-size:28px}.title-button span{margin-left:12px;font-size:18px}.asset-card{margin-bottom:28px;padding:28px;border-radius:22px}.asset-amount{font-size:42px}.card-title{font-size:15px}.sparkline{width:140px;height:44px}.action-grid{margin-bottom:38px}.action-item i{width:62px;height:62px}.action-item span{font-size:15px}.section-block{margin-bottom:38px}.section-block h3{margin-bottom:20px;font-size:20px}.quick-funcs{gap:14px}.quick-card{min-height:84px;padding:15px;border-radius:16px}.quick-card>i{width:42px;height:42px}.quick-card strong{font-size:16px}.quick-card small{font-size:13px}.dialog-card{padding:26px 28px 30px;border-radius:26px 26px 0 0}.dialog-card h3{font-size:23px}.dialog-card input,.dialog-card select{height:54px;font-size:17px}.detail-header h2{font-size:24px}}
.elegant-bills{display:flex;flex-direction:column;gap:0}.eb-header{padding:2vw 5vw 6vw;border-bottom:1px solid var(--border);margin:0 -5vw}.eb-stats{display:flex;gap:12vw;margin-bottom:6vw}.eb-stat-item{display:flex;flex-direction:column;gap:1.5vw}.eb-label{font-size:3.2vw;color:var(--sub);font-weight:400}.eb-value{font-size:6.5vw;font-weight:600;letter-spacing:-0.5px}.eb-filters{display:flex;justify-content:space-between;align-items:center}.eb-month-picker{position:relative}.eb-picker-btn{background:var(--card-bg);border:1px solid var(--border);border-radius:5vw;padding:1.5vw 3.5vw;font-size:3.3vw;font-weight:500;display:flex;align-items:center;gap:1vw;color:var(--app-text);box-shadow:0 2px 6px rgba(0,0,0,.02)}.eb-picker-btn svg{width:3.5vw;height:3.5vw}.eb-real-select{position:absolute;inset:0;opacity:0;width:100%;height:100%}.eb-type-tabs{display:flex;gap:3vw}.eb-type-tabs button{background:none;border:none;font-size:3.3vw;color:var(--sub);padding:1vw 0;font-weight:500;position:relative}.eb-type-tabs button.active{color:var(--app-text)}.eb-type-tabs button.active::after{content:'';position:absolute;bottom:-1vw;left:50%;transform:translateX(-50%);width:1.2vw;height:1.2vw;border-radius:50%;background:var(--app-text)}
.eb-search-bar{display:flex;align-items:center;background:var(--app-bg);border:1px solid var(--border);border-radius:3vw;padding:0 3vw;margin-top:4vw;height:10vw;transition:border-color 0.2s}
.eb-search-bar:focus-within{border-color:var(--app-text)}
.eb-search-bar svg{width:4.5vw;height:4.5vw;stroke:var(--sub);flex:none}
.eb-search-bar input{flex:1;background:transparent;border:none;outline:none;padding:0 2vw;font-size:3.5vw;color:var(--app-text);width:100%}
.eb-search-bar input::placeholder{color:var(--sub)}
.eb-search-clear{background:none;border:none;padding:1vw;display:flex;align-items:center;justify-content:center;cursor:pointer}
.eb-search-clear svg{width:4.5vw;height:4.5vw}
.eb-group-list{display:flex;flex-direction:column;padding-bottom:10vw}.eb-group{padding-top:6vw}.eb-group-title{color:var(--sub);font-size:3.2vw;font-weight:500;margin-bottom:2vw;text-transform:uppercase}.eb-list{display:flex;flex-direction:column;background:var(--card-bg);margin:0 -5vw;padding:0 5vw;border-top:1px solid var(--border);border-bottom:1px solid var(--border)}.eb-item{display:flex;align-items:center;padding:4.5vw 0;border-bottom:1px solid var(--border)}.eb-item:last-child{border-bottom:none}.eb-icon{display:grid;width:10vw;height:10vw;border-radius:50%;background:var(--app-bg);border:1px solid var(--border);color:var(--app-text);margin-right:4vw;place-items:center}.eb-icon svg{width:4.5vw;height:4.5vw;stroke-width:1.5}.eb-content{display:flex;flex:1;flex-direction:column;gap:1vw}.eb-main-line{display:flex;justify-content:space-between;align-items:center}.eb-title{font-size:3.8vw;font-weight:500;color:var(--app-text)}.eb-amount{font-size:4.2vw;font-weight:600}.eb-amount.exp{color:var(--app-text)}.eb-amount.inc{color:#e64a19}.eb-sub-line{display:flex;justify-content:space-between;color:var(--sub);font-size:2.8vw}
.eb-item.is-editing{cursor:pointer;padding-left:11vw;position:relative;transition:0.2s}
.eb-checkbox{position:absolute;left:2vw;top:50%;transform:translateY(-50%);width:5.5vw;height:5.5vw;border:2px solid var(--border);border-radius:50%;display:grid;place-items:center;background:var(--app-bg);transition:0.2s}
.eb-checkbox.is-checked{background:var(--app-text);border-color:var(--app-text)}
.eb-checkbox svg{width:3.5vw;height:3.5vw;stroke:var(--app-bg)}
.eb-batch-actions{position:fixed;bottom:calc(60px + env(safe-area-inset-bottom) + 3vw);left:4vw;right:4vw;background:var(--card-bg);border:1px solid var(--border);border-radius:4vw;padding:3.5vw 5vw;display:flex;justify-content:space-between;align-items:center;box-shadow:0 8px 30px rgba(0,0,0,.15);z-index:40;animation:eb-slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1)}
.eb-select-all{display:flex;align-items:center;gap:3vw;background:none;border:none;color:var(--app-text);font-size:3.8vw;cursor:pointer;padding:0}
.eb-select-all .eb-checkbox{position:static;transform:none;border-color:var(--sub);background:transparent}
.eb-select-all .eb-checkbox.is-checked{background:var(--app-text);border-color:var(--app-text)}
.eb-select-all .eb-checkbox svg{stroke:var(--app-bg)}
.eb-delete-btn{background:#ff3b30;color:#fff;border:none;border-radius:2.5vw;padding:2vw 4vw;font-size:3.5vw;font-weight:500;cursor:pointer;transition:0.2s}
.eb-delete-btn:disabled{opacity:0.4;cursor:not-allowed}
@keyframes eb-slide-up { from { transform: translateY(120%); opacity: 0 } to { transform: translateY(0); opacity: 1 } }
.credit-card { position: relative; }
.credit-settings-btn { position: absolute; top: 4vw; right: 4vw; border: none; background: none; color: #fff; opacity: 0.7; cursor: pointer; padding: 2vw; border-radius: 50%; display: grid; place-items: center; }
.credit-settings-btn:hover { opacity: 1; background: rgba(255,255,255,0.1); }
.credit-settings-btn svg { width: 22px; height: 22px; stroke: currentColor; stroke-width: 1.5; }

.activation-card { display: flex; flex-direction: column; align-items: center; padding: 8vw 5vw; background: var(--card-bg); border: 1px solid var(--border); border-radius: 4vw; text-align: center; }
.activation-icon { width: 16vw; height: 16vw; color: #007aff; margin-bottom: 4vw; stroke-width: 1.5; }
.activation-card strong { font-size: 5vw; margin-bottom: 2vw; }
.activation-card span { color: var(--sub); font-size: 3.2vw; margin-bottom: 8vw; }
.activation-form { width: 100%; display: flex; flex-direction: column; gap: 4vw; text-align: left; }
.activation-form label { display: flex; flex-direction: column; gap: 2vw; color: var(--sub); font-size: 3vw; }
.activation-form select, .activation-form input { width: 100%; height: 12vw; padding: 0 3.5vw; border: 1px solid var(--border); border-radius: 3vw; background: var(--app-bg); color: var(--app-text); font-size: 3.6vw; outline: none; }
.activation-form select:focus, .activation-form input:focus { border-color: var(--app-text); }
.mt-4 { margin-top: 4vw; }
.danger-button.wide { width: 100%; min-height: 12vw; }

.loading-spinner { display: inline-block; width: 16px; height: 16px; margin-right: 8px; border: 2px solid rgba(255,255,255,0.3); border-radius: 50%; border-top-color: #fff; animation: spin 1s ease-in-out infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

@media (min-width:700px){
  .eb-batch-actions{left:50%;width:600px;transform:translateX(-50%);bottom:40px}
  @keyframes eb-slide-up { from { transform: translate(-50%, 120%); opacity: 0 } to { transform: translate(-50%, 0); opacity: 1 } }
}

/* Empty State Fixes */
.empty-state {
  padding: 16vw 5vw !important;
}
.empty-state strong {
  font-size: 4.8vw !important;
  margin-bottom: 2.5vw !important;
}
.empty-state span {
  font-size: 3.5vw !important;
  margin-bottom: 6vw !important;
  display: block;
}
.empty-state .primary-button {
  margin-top: 2vw !important;
}

/* 极简网格银行卡样式 */
.cards-panel-redesign { display: flex; flex-direction: column; gap: 4vw; padding: 0 4vw; }
.cards-toolbar { display: flex; flex-direction: column; gap: 3vw; }
.cards-search { display: flex; align-items: center; background: var(--card-bg); border: 1px solid var(--border); border-radius: 2.5vw; padding: 0 3vw; height: 10vw; }
.cards-search svg { width: 4.5vw; height: 4.5vw; stroke: var(--sub); flex: none; margin-right: 2vw; }
.cards-search input { flex: 1; background: transparent; border: none; outline: none; font-size: 3.5vw; color: var(--app-text); height: 100%; padding: 0; }

.cards-filters-row { display: flex; justify-content: space-between; align-items: center; gap: 2vw; }
.cards-tabs { display: flex; gap: 1vw; background: var(--icon-bg); padding: 1vw; border-radius: 2.5vw; }
.cards-tabs button { border: none; background: transparent; padding: 1.5vw 3vw; border-radius: 2vw; font-size: 3vw; color: var(--sub); font-weight: 500; cursor: pointer; transition: 0.2s; white-space: nowrap; }
.cards-tabs button.active { background: var(--card-bg); color: var(--app-text); box-shadow: 0 1px 4px rgba(0,0,0,0.08); }
.cards-sort { flex: 1; display: flex; justify-content: flex-end; }
.cards-sort select { background: var(--card-bg); border: 1px solid var(--border); padding: 1.5vw 2vw; border-radius: 2vw; font-size: 3vw; color: var(--app-text); outline: none; min-width: 24vw; cursor: pointer; }

.minimal-card-grid { display: flex; flex-direction: column; gap: 5vw; padding-bottom: 6vw; perspective: 1000px; align-items: center; }

.m-card-container { width: 90%; max-width: 400px; aspect-ratio: 1.586; position: relative; border-radius: 4vw; }
.m-card-container.is-removing { transform: scale(0.8); opacity: 0; transition: 0.4s; pointer-events: none; }
.m-card-flipper { width: 100%; height: 100%; position: relative; transition: transform 0.6s cubic-bezier(0.4, 0, 0.2, 1); transform-style: preserve-3d; cursor: pointer; }
.m-card-container.is-flipped .m-card-flipper { transform: rotateY(180deg); }

.m-card-front, .m-card-back { position: absolute; inset: 0; backface-visibility: hidden; border-radius: 4vw; background-color: var(--card-bg); background-size: cover; background-position: center; box-shadow: 0 4px 15px rgba(0,0,0,0.06); border: 1px solid var(--border); overflow: hidden; }
.m-card-front[style*="background-image"], .m-card-back[style*="background-image"] { border: none; }

.m-card-overlay { width: 100%; height: 100%; display: flex; flex-direction: column; background: transparent; backdrop-filter: blur(4px); position: relative; }
.dark-theme .m-card-overlay { background: transparent; }
.m-card-front:not([style*="background-image"]) .m-card-overlay,
.m-card-back:not([style*="background-image"]) .m-card-overlay { backdrop-filter: none; }

.m-card-front .m-card-overlay { padding: 4.5vw; justify-content: space-between; }
.m-card-header { display: flex; justify-content: space-between; align-items: flex-start; }
.m-card-bank { font-size: 4vw; font-weight: 600; color: var(--app-text); max-width: 70%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-shadow: 0 1px 6px rgba(255,255,255,0.9), 0 2px 10px rgba(255,255,255,0.9); }
.dark-theme .m-card-bank { text-shadow: 0 1px 6px rgba(0,0,0,0.9), 0 2px 10px rgba(0,0,0,0.9); }
.m-card-type { font-size: 3vw; color: var(--sub); font-style: italic; font-weight: 700; letter-spacing: 0.5px; opacity: 0; }

.m-card-chip { width: 9.5vw; height: 7vw; background: linear-gradient(135deg, #e5e5ea, #d1d1d6); border-radius: 1.5vw; margin-top: 2vw; position: relative; overflow: hidden; border: 1px solid rgba(0,0,0,0.06); box-shadow: inset 0 1px 2px rgba(255,255,255,0.5); }
.m-card-chip-row { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 2vw; }
.m-card-chip { width: 9.5vw; height: 7vw; background: linear-gradient(135deg, #e5e5ea, #d1d1d6); border-radius: 1.5vw; position: relative; overflow: hidden; border: 1px solid rgba(0,0,0,0.06); box-shadow: inset 0 1px 2px rgba(255,255,255,0.5); }
.m-card-chip::after { content: ''; position: absolute; inset: 1px; border: 1px solid rgba(0,0,0,0.04); border-radius: 0.5vw; }
.dark-theme .m-card-chip { background: linear-gradient(135deg, #48484a, #2c2c2e); border: 1px solid rgba(255,255,255,0.1); }
.dark-theme .m-card-chip::after { border: 1px solid rgba(255,255,255,0.05); }

.m-card-qr-top-btn { position: absolute; top: 4.5vw; right: 4.5vw; width: 6.5vw; height: 6.5vw; background: transparent; border: none; cursor: pointer; display: grid; place-items: center; z-index: 2; padding: 0; color: rgba(0,0,0,0.3); transition: 0.2s; }
.dark-theme .m-card-qr-top-btn { color: rgba(255,255,255,0.4); }
.m-card-qr-top-btn:hover { color: rgba(0,0,0,0.5); }
.dark-theme .m-card-qr-top-btn:hover { color: rgba(255,255,255,0.6); }
.m-card-qr-top-btn:active { transform: scale(0.92); }
.m-card-qr-top-btn svg { width: 100%; height: 100%; fill: currentColor; stroke: none; }

.m-card-number { font-family: 'Courier New', Courier, monospace; font-size: 5vw; font-weight: 600; letter-spacing: 2px; color: var(--app-text); margin-top: auto; text-shadow: 0 1px 6px rgba(255,255,255,0.9), 0 2px 10px rgba(255,255,255,0.9); }
.dark-theme .m-card-number { text-shadow: 0 1px 6px rgba(0,0,0,0.9), 0 2px 10px rgba(0,0,0,0.9); }

.m-card-back { transform: rotateY(180deg); }
.m-card-back .m-card-overlay { padding: 0; display: flex; flex-direction: column; }
.m-card-stripe { height: 9vw; background: rgba(0,0,0,0.8); margin-top: 5vw; width: 100%; box-shadow: 0 1px 2px rgba(0,0,0,0.1); }
.dark-theme .m-card-stripe { background: rgba(255,255,255,0.1); }
.m-card-cvv-row { background: var(--app-bg); margin: 3vw 4.5vw 0 auto; padding: 1.5vw 3vw; border-radius: 1.5vw; display: flex; gap: 3vw; align-items: center; border: 1px solid var(--border); box-shadow: inset 0 1px 3px rgba(0,0,0,0.05); }
.m-card-cvv-row span { font-size: 3vw; color: var(--sub); font-weight: 500; }
.m-card-cvv-row em { font-family: 'Courier New', Courier, monospace; font-size: 4vw; font-weight: bold; font-style: normal; color: var(--app-text); }

.m-card-actions { display: flex; justify-content: center; padding: 0 4.5vw; margin-top: auto; margin-bottom: 4.5vw; gap: 6vw; }
.m-btn-edit, .m-btn-remove { flex: 1; max-width: 140px; background: var(--icon-bg); border: 1px solid var(--border); color: var(--app-text); border-radius: 4vw; padding: 2.5vw 0; font-size: 3.5vw; cursor: pointer; transition: 0.2s; font-weight: 600; box-shadow: 0 2px 8px rgba(0,0,0,0.04); }
.m-btn-edit:active, .m-btn-remove:active { background: var(--border); }

/* 添加卡片表单 */
.card-add-form { display: flex; flex-direction: column; gap: 0; }
.cover-uploader-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 3vw; margin-bottom: 4vw; }
.uploader-label { font-size: 3vw; color: var(--sub); margin-bottom: 1.5vw; display: block; text-align: center; }
.card-cover-uploader { width: 100%; height: 22vw; max-height: 120px; border: 2px dashed var(--border); border-radius: 3vw; display: flex; align-items: center; justify-content: center; background-color: var(--app-bg); background-size: cover; background-position: center; cursor: pointer; transition: 0.2s; position: relative; }
.card-cover-uploader:hover { border-color: var(--sub); }
.card-cover-uploader span { color: var(--sub); font-size: 3vw; font-weight: 500; background: rgba(0,0,0,0.5); padding: 1vw 2vw; border-radius: 2vw; color: #fff; backdrop-filter: blur(2px); }
.clear-cover-btn { position: absolute; top: 1vw; right: 1vw; width: 6vw; height: 6vw; border-radius: 50%; background: rgba(0,0,0,0.6); color: white; border: none; font-size: 4vw; display: grid; place-items: center; cursor: pointer; }
.blur-slider { margin-top: 2vw; display: flex; flex-direction: column; gap: 1vw; }
.blur-slider label { font-size: 2.5vw; color: var(--sub); margin: 0; }
.blur-slider input[type=range] { width: 100%; height: auto; padding: 0; }
.form-actions-row { display: flex; gap: 3vw; margin-top: 2vw; }
.flex-1 { flex: 1; }

.favorite-switch-row { display: flex; flex-direction: row; align-items: center; justify-content: space-between; margin-top: 2vw; margin-bottom: 4vw; color: var(--sub); font-size: 3vw; }
.dialog-card .wallet-switch { margin: 0; display: inline-block; }
.wallet-switch { position: relative; width: 12vw; height: 7vw; border-radius: 5vw; flex: none; cursor: pointer; }
.wallet-switch input { position: absolute; opacity: 0; width: 0; height: 0; }
.wallet-switch i { position: absolute; inset: 0; border-radius: 5vw; background: #d1d1d6; transition: 0.2s; display: block; }
.wallet-switch i b { position: absolute; top: 0.6vw; left: 0.6vw; width: 5.8vw; height: 5.8vw; border-radius: 50%; background: #fff; box-shadow: 0 1px 4px rgba(0,0,0,.2); transition: 0.2s; display: block; }
.wallet-switch input:checked + i { background: #34c759; }
.wallet-switch input:checked + i b { transform: translateX(5vw); }
.dark-theme .wallet-switch i { background: #39393d; }
@media (min-width:700px){
  .favorite-switch-row { font-size: 15px; margin-bottom: 24px; margin-top: 12px; }
  .wallet-switch { width: 50px; height: 30px; }
  .wallet-switch i { border-radius: 20px; }
  .wallet-switch i b { width: 24px; height: 24px; top: 3px; left: 3px; }
  .wallet-switch input:checked + i b { transform: translateX(20px); }
}

/* Card Details View */
.card-details-view { display: flex; flex-direction: column; gap: 4vw; padding-bottom: 4vw; }
.cd-header { display: flex; flex-direction: column; gap: 1vw; align-items: center; text-align: center; margin-bottom: 4vw; }
.cd-header strong { font-size: 5vw; color: var(--app-text); }
.cd-header span { font-size: 3.2vw; color: var(--sub); }
.cd-data-box { background: var(--app-bg); border: 1px solid var(--border); border-radius: 3vw; padding: 4vw; display: flex; flex-direction: column; gap: 4vw; }
.cd-data-item { display: flex; flex-direction: column; gap: 1.5vw; }
.cd-label { font-size: 3vw; color: var(--sub); }
.cd-value { font-size: 7vw; font-weight: 600; letter-spacing: -0.5px; color: var(--app-text); }
.cd-value-sub { font-size: 4vw; font-weight: 500; color: var(--app-text); }
.amount-down { color: var(--down) !important; }
.amount-up { color: var(--up) !important; }
.cd-actions-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 3vw; margin-top: 6vw; }
</style>
