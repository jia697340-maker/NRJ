/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useChatAuth } from './useChatAuth'
import { advanceWalletMarket, getWalletPositions, getWalletQuotes, loadWalletState, saveWalletState, walletUpdateEventName, type WalletState } from '../services/walletService'

export function useWallet() {
  const { currentChatUserId, currentAccount } = useChatAuth()
  const accountId = computed(() => currentChatUserId.value || 'guest')
  const state = ref<WalletState>(loadWalletState(accountId.value, currentAccount.value?.name || '我'))
  const hydrate = () => {
    state.value = loadWalletState(accountId.value, currentAccount.value?.name || '我')
    if (advanceWalletMarket(state.value)) saveWalletState(state.value)
  }
  const persist = () => saveWalletState(state.value)
  const reload = () => { state.value = loadWalletState(accountId.value, currentAccount.value?.name || '我') }
  const onUpdate = (event: Event) => { if ((event as CustomEvent).detail?.accountId === accountId.value) reload() }
  if (typeof window !== 'undefined') window.addEventListener(walletUpdateEventName, onUpdate)
  onBeforeUnmount(() => window.removeEventListener(walletUpdateEventName, onUpdate))
  watch(accountId, hydrate, { immediate: true })
  const activeQuotes = computed(() => getWalletQuotes(state.value))
  const activePositions = computed(() => getWalletPositions(state.value))
  const stockMarketValueCents = computed(() => activePositions.value.reduce((sum, position) => sum + (activeQuotes.value.find(item => item.code === position.code)?.priceCents || 0) * position.quantity, 0))
  const stockCostCents = computed(() => activePositions.value.reduce((sum, position) => sum + position.averageCostCents * position.quantity, 0))
  const bankAssetCents = computed(() => state.value.bankCards.filter(card => card.type !== 'credit').reduce((sum, card) => sum + (card.balanceCents || 0), 0))
  const liabilityCents = computed(() => state.value.credit.usedCents + state.value.bankCards.filter(card => card.type === 'credit').reduce((sum, card) => sum + (card.usedCents || 0), 0))
  const totalAssetCents = computed(() => state.value.cashCents + bankAssetCents.value + stockMarketValueCents.value)
  const netAssetCents = computed(() => totalAssetCents.value - liabilityCents.value)
  return { accountId, currentAccount, state, activeQuotes, activePositions, stockMarketValueCents, stockCostCents, bankAssetCents, liabilityCents, totalAssetCents, netAssetCents, persist, reload, hydrate }
}
