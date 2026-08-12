/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useChatAuth } from './useChatAuth'
import { advanceWalletMarket, loadWalletState, saveWalletState, walletUpdateEventName, type WalletState } from '../services/walletService'

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
  const stockMarketValueCents = computed(() => state.value.positions.reduce((sum, position) => sum + (state.value.quotes.find(item => item.code === position.code)?.priceCents || 0) * position.quantity, 0))
  const stockCostCents = computed(() => state.value.positions.reduce((sum, position) => sum + position.averageCostCents * position.quantity, 0))
  const totalAssetCents = computed(() => state.value.cashCents + stockMarketValueCents.value)
  return { accountId, currentAccount, state, stockMarketValueCents, stockCostCents, totalAssetCents, persist, reload, hydrate }
}
