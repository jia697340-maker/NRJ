/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<template>
  <transition name="modal-fade">
    <div v-if="visible" class="transfer-modal-overlay" @click.self="handleClose">
      <div class="transfer-modal-container">
        <div class="modal-header">
          <h3 class="modal-title">发送给 {{ targetName }}</h3>
          <div class="close-btn" @click="handleClose">
            <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </div>
        </div>

        <div class="modal-body">
          <div class="type-selector">
            <div class="type-btn" :class="{ active: transferType === 'red_packet' }" @click="transferType = 'red_packet'">红包</div>
            <div class="type-btn" :class="{ active: transferType === 'transfer' }" @click="transferType = 'transfer'">转账</div>
          </div>

          <div class="form-group">
            <label class="form-label">付款方式</label>
            <select class="text-input" v-model="selectedFundingSource">
              <option value="balance">余额 (可用: {{ formatMoney(walletState?.cashCents || 0) }})</option>
              <option 
                v-if="walletState?.credit?.enabled" 
                value="credit"
                :disabled="walletState.credit.limitCents - walletState.credit.usedCents <= 0"
              >
                花呗 (可用: {{ formatMoney(walletState.credit.limitCents - walletState.credit.usedCents) }})
              </option>
              <option 
                v-for="card in (walletState?.bankCards || [])" 
                :key="card.id" 
                :value="`card_${card.id}`"
                :disabled="card.type === 'credit' ? (card.limitCents! - card.usedCents! <= 0) : (card.balanceCents! <= 0)"
              >
                {{ card.name }} ({{ card.lastFour }}) - 
                可用: {{ formatMoney(card.type === 'credit' ? (card.limitCents! - card.usedCents!) : card.balanceCents!) }}
              </option>
            </select>
          </div>

          <div class="form-group">
            <label class="form-label">金额</label>
            <div class="amount-input-wrapper">
              <span class="currency-symbol">￥</span>
              <input type="number" class="amount-input" v-model="amount" placeholder="0.00" />
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">备注说明</label>
            <input type="text" class="text-input" v-model="remark" :placeholder="transferType === 'red_packet' ? '恭喜发财，大吉大利' : '转账给对方'" />
          </div>

          <div class="form-group">
            <label class="form-label">过期时效 (小时)</label>
            <input type="number" class="text-input" v-model="expireHours" placeholder="默认 24 小时" />
            <div class="form-hint">过期后若未领取，将自动退回</div>
          </div>
        </div>

        <div class="modal-footer">
          <button v-if="!showPasswordInput" class="submit-btn" :disabled="!isValid" @click="handleSubmit">发送</button>
          
          <div v-if="showPasswordInput" class="password-verification">
            <label class="form-label" style="text-align: center; display: block; margin-bottom: 8px;">输入4位支付密码</label>
            <input 
              type="password" 
              class="text-input password-input" 
              v-model="paymentPasswordInput" 
              maxlength="4"
              inputmode="numeric"
              placeholder="请输入密码"
              @input="passwordError = ''"
            />
            <div v-if="passwordError" class="error-text">{{ passwordError }}</div>
            <div class="password-actions">
              <button class="cancel-btn" @click="showPasswordInput = false">取消</button>
              <button class="verify-btn" :disabled="paymentPasswordInput.length !== 4" @click="verifyPassword">确认支付</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { loadWalletState } from '../../../services/walletService'
import { useChatAuth } from '../../../composables/useChatAuth'

const props = defineProps<{
  visible: boolean
  targetName: string
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'send', data: { 
    type: 'red_packet' | 'transfer', 
    amount: number, 
    remark: string, 
    expireHours: number,
    fundingSource: 'balance' | 'credit' | 'bank_card',
    fundingSourceId?: string
  }): void
}>()

const transferType = ref<'red_packet' | 'transfer'>('red_packet')
const amount = ref<string>('')
const remark = ref<string>('')
const expireHours = ref<string>('24')
const showPasswordInput = ref(false)
const paymentPasswordInput = ref('')
const passwordError = ref('')

const walletState = ref<ReturnType<typeof loadWalletState> | null>(null)
const selectedFundingSource = ref<string>('balance')
const { currentChatUserId, currentAccount } = useChatAuth()

const formatMoney = (cents: number) => {
  return '￥' + (cents / 100).toFixed(2)
}

watch(() => props.visible, (newVal) => {
  if (newVal) {
    transferType.value = 'red_packet'
    amount.value = ''
    remark.value = ''
    expireHours.value = '24'
    showPasswordInput.value = false
    paymentPasswordInput.value = ''
    passwordError.value = ''
    
    const accountId = currentChatUserId.value || 'guest'
    walletState.value = loadWalletState(accountId, currentAccount.value?.name || '我')
    selectedFundingSource.value = 'balance'
  }
})

const isValid = computed(() => {
  const amt = parseFloat(amount.value)
  return !isNaN(amt) && amt > 0
})

const handleClose = () => {
  emit('close')
}

const handleSubmit = () => {
  if (!isValid.value) return

  // 获取钱包状态，检查是否需要支付密码
  const accountId = currentChatUserId.value || 'guest'
  const state = loadWalletState(accountId)
  if (state.paymentPassword) {
    showPasswordInput.value = true
    return
  }
  
  executeSend()
}

const verifyPassword = () => {
  const accountId = currentChatUserId.value || 'guest'
  const state = loadWalletState(accountId)
  if (paymentPasswordInput.value !== state.paymentPassword) {
    passwordError.value = '支付密码错误'
    paymentPasswordInput.value = ''
    return
  }
  executeSend()
}

const executeSend = () => {
  const finalRemark = remark.value.trim()
  const finalExpireHours = parseFloat(expireHours.value) || 24
  
  let fundingSource: 'balance' | 'credit' | 'bank_card' = 'balance'
  let fundingSourceId: string | undefined = undefined

  if (selectedFundingSource.value === 'credit') {
    fundingSource = 'credit'
  } else if (selectedFundingSource.value.startsWith('card_')) {
    fundingSource = 'bank_card'
    fundingSourceId = selectedFundingSource.value.replace('card_', '')
  }
  
  emit('send', {
    type: transferType.value,
    amount: parseFloat(amount.value),
    remark: finalRemark,
    expireHours: finalExpireHours,
    fundingSource,
    fundingSourceId
  })
  
  showPasswordInput.value = false
  paymentPasswordInput.value = ''
  passwordError.value = ''
}
</script>

<style scoped>
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.3s ease;
}
.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}
.modal-fade-enter-active .transfer-modal-container {
  animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes slideUp {
  from { transform: translateY(20px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

.transfer-modal-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  backdrop-filter: blur(2px);
}

.transfer-modal-container {
  width: 85%;
  max-width: 320px;
  background: var(--sys-bg-primary, #ffffff);
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
}
.is-dark .transfer-modal-container {
  background: var(--sys-bg-primary, #2a2826);
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color, rgba(0, 0, 0, 0.05));
}

.modal-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.close-btn {
  color: var(--text-tertiary);
  cursor: pointer;
  padding: 4px;
}

.modal-body {
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: 50vh;
  overflow-y: auto;
}

/* 自定义滚动条 */
.modal-body::-webkit-scrollbar {
  width: 4px;
}
.modal-body::-webkit-scrollbar-track {
  background: transparent;
}
.modal-body::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.1);
  border-radius: 4px;
}
.is-dark .modal-body::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
}

.type-selector {
  display: flex;
  background: var(--sys-bg-secondary, rgba(0,0,0,0.03));
  border-radius: 8px;
  padding: 4px;
}
.type-btn {
  flex: 1;
  text-align: center;
  padding: 8px 0;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-secondary);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}
.type-btn.active {
  background: #f44336;
  color: white;
  box-shadow: 0 2px 4px rgba(244, 67, 54, 0.3);
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
}

.amount-input-wrapper {
  display: flex;
  align-items: baseline;
  background: var(--sys-bg-secondary, rgba(0,0,0,0.03));
  border-radius: 8px;
  padding: 10px 14px;
}
.currency-symbol {
  font-size: 24px;
  font-weight: 600;
  color: var(--text-primary);
  margin-right: 8px;
}
.amount-input {
  flex: 1;
  background: transparent;
  border: none;
  font-size: 32px;
  font-weight: 600;
  color: var(--text-primary);
  outline: none;
  width: 100%;
}
.amount-input::placeholder {
  color: var(--text-tertiary);
}

.text-input {
  box-sizing: border-box;
  width: 100%;
  font-family: inherit;
  min-width: 0;
  height: auto;
  flex: none;
  background: var(--sys-bg-secondary, rgba(0,0,0,0.03));
  border: none;
  border-radius: 8px;
  padding: 10px 14px;
  font-size: 14px;
  color: var(--text-primary);
  outline: none;
}
.text-input::placeholder {
  color: var(--text-tertiary);
}

.form-hint {
  font-size: 11px;
  color: var(--text-tertiary);
}

.modal-footer {
  padding: 16px 20px 20px;
  border-top: 1px solid var(--border-color, rgba(0, 0, 0, 0.03));
}

.submit-btn {
  width: 100%;
  background: #f44336;
  color: white;
  border: none;
  border-radius: 8px;
  padding: 12px 0;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.2s;
}
.submit-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.submit-btn:not(:disabled):active {
  opacity: 0.9;
}

.password-verification {
  display: flex;
  flex-direction: column;
  gap: 12px;
  animation: slideUp 0.2s ease;
}

.password-input {
  text-align: center;
  letter-spacing: 4px;
  font-size: 20px;
}

.error-text {
  color: #f44336;
  font-size: 12px;
  text-align: center;
}

.password-actions {
  display: flex;
  gap: 12px;
}

.cancel-btn, .verify-btn {
  flex: 1;
  border: none;
  border-radius: 8px;
  padding: 12px 0;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}

.cancel-btn {
  background: var(--sys-bg-secondary, rgba(0,0,0,0.05));
  color: var(--text-secondary);
}

.verify-btn {
  background: #f44336;
  color: white;
}
.verify-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
