/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<template>
  <transition name="modal-fade">
    <div v-if="visible" class="payment-password-overlay" @click.self="handleClose">
      <div class="payment-password-container">
        <div class="modal-header">
          <h3 class="modal-title">验证支付密码</h3>
          <div class="close-btn" @click="handleClose">
            <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </div>
        </div>

        <div class="modal-body">
          <label class="form-label">输入4位支付密码</label>
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
        </div>

        <div class="modal-footer">
          <button class="cancel-btn" @click="handleClose">取消</button>
          <button class="verify-btn" :disabled="paymentPasswordInput.length !== 4" @click="verifyPassword">确认支付</button>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { loadWalletState } from '../../../services/walletService'
import { useChatAuth } from '../../../composables/useChatAuth'

const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'success'): void
}>()

const paymentPasswordInput = ref('')
const passwordError = ref('')
const { currentChatUserId } = useChatAuth()

watch(() => props.visible, (newVal) => {
  if (newVal) {
    paymentPasswordInput.value = ''
    passwordError.value = ''
  }
})

const handleClose = () => {
  emit('close')
}

const verifyPassword = () => {
  const accountId = currentChatUserId.value || 'guest'
  const state = loadWalletState(accountId)
  if (paymentPasswordInput.value !== state.paymentPassword) {
    passwordError.value = '支付密码错误'
    paymentPasswordInput.value = ''
    return
  }
  emit('success')
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
.modal-fade-enter-active .payment-password-container {
  animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes slideUp {
  from { transform: translateY(20px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

.payment-password-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10001; /* 确保在 TransferModal 之上 */
  backdrop-filter: blur(2px);
}

.payment-password-container {
  width: 85%;
  max-width: 320px;
  background: var(--sys-bg-primary, #ffffff);
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
}
.is-dark .payment-password-container {
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
  padding: 24px 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.form-label {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-secondary);
  text-align: center;
}

.text-input {
  box-sizing: border-box;
  width: 100%;
  font-family: inherit;
  background: var(--sys-bg-secondary, rgba(0,0,0,0.03));
  border: none;
  border-radius: 8px;
  padding: 12px 14px;
  font-size: 16px;
  color: var(--text-primary);
  outline: none;
}
.text-input::placeholder {
  color: var(--text-tertiary);
}

.password-input {
  text-align: center;
  letter-spacing: 8px;
  font-size: 24px;
  font-weight: bold;
}

.error-text {
  color: #f44336;
  font-size: 13px;
  text-align: center;
}

.modal-footer {
  display: flex;
  padding: 16px 20px 20px;
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
  transition: opacity 0.2s;
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
.verify-btn:not(:disabled):active {
  opacity: 0.9;
}
</style>
