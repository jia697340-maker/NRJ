<!-- WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ -->
<script setup lang="ts">
import { ref, computed } from 'vue'
import {
  activeIncomingPrompt,
  acceptIncomingPrompt,
  rejectIncomingPrompt,
  closeIncomingPrompt
} from '../../../composables/useFriendRequestPrompt'

const isRejecting = ref(false)
const rejectReason = ref('')

const currentItem = computed(() => activeIncomingPrompt.value)
const chat = computed(() => currentItem.value?.chat)
const request = computed(() => currentItem.value?.request)

const handleAccept = () => {
  if (!currentItem.value) return
  acceptIncomingPrompt(currentItem.value)
}

const handleStartReject = () => {
  isRejecting.value = true
  rejectReason.value = ''
}

const handleCancelReject = () => {
  isRejecting.value = false
}

const handleConfirmReject = () => {
  if (!currentItem.value) return
  rejectIncomingPrompt(currentItem.value, rejectReason.value)
  isRejecting.value = false
}

const handleIgnore = () => {
  closeIncomingPrompt()
}
</script>

<template>
  <Teleport to="body">
    <Transition name="fr-modal-fade">
      <div v-if="currentItem" class="fr-modal-overlay" @click.self="handleIgnore">
        <div class="fr-modal-card">
          <!-- 顶部背景光晕装饰 -->
          <div class="fr-card-glow"></div>

          <!-- 模式 1: 收到好友申请详情 -->
          <div v-if="!isRejecting" class="fr-content-view">
            <div class="fr-header">
              <span class="fr-badge">好友申请</span>
              <button type="button" class="fr-close-btn" aria-label="稍后处理" @click="handleIgnore">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="m18 6-12 12M6 6l12 12"/>
                </svg>
              </button>
            </div>

            <div class="fr-avatar-wrapper">
              <div
                class="fr-avatar"
                :style="chat?.avatarUrl ? { backgroundImage: `url(${chat.avatarUrl})` } : {}"
              >
                {{ chat?.avatarUrl ? '' : (chat?.avatarText || chat?.name?.slice(0, 2) || '角色') }}
              </div>
            </div>

            <h3 class="fr-title">{{ chat?.realName || chat?.name || '未知角色' }}</h3>
            <p class="fr-subtitle">想要添加你为好友</p>

            <div class="fr-message-box">
              <div class="fr-message-label">验证附言</div>
              <div class="fr-message-text">
                {{ request?.message || '（对方未填写验证附言）' }}
              </div>
            </div>

            <div class="fr-actions">
              <button type="button" class="fr-btn fr-btn-reject" @click="handleStartReject">
                拒绝
              </button>
              <button type="button" class="fr-btn fr-btn-accept" @click="handleAccept">
                同意申请
              </button>
            </div>
          </div>

          <!-- 模式 2: 填写拒绝理由 -->
          <div v-else class="fr-content-view">
            <div class="fr-header">
              <span class="fr-badge reject">拒绝申请</span>
              <button type="button" class="fr-close-btn" aria-label="取消" @click="handleCancelReject">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="m18 6-12 12M6 6l12 12"/>
                </svg>
              </button>
            </div>

            <h3 class="fr-title" style="margin-top: 10px;">拒绝理由（选填）</h3>
            <p class="fr-subtitle">你可以向对方说明拒绝的原因，也可以直接拒绝</p>

            <div class="fr-textarea-box">
              <textarea
                v-model="rejectReason"
                maxlength="140"
                placeholder="例如：现在还不方便加好友…"
                rows="3"
              ></textarea>
              <span class="fr-char-count">{{ rejectReason.length }}/140</span>
            </div>

            <div class="fr-actions">
              <button type="button" class="fr-btn fr-btn-secondary" @click="handleCancelReject">
                返回
              </button>
              <button type="button" class="fr-btn fr-btn-danger" @click="handleConfirmReject">
                确认拒绝
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.fr-modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.48);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  padding: 20px;
}

.fr-modal-card {
  position: relative;
  width: 100%;
  max-width: 360px;
  background: var(--sys-bg-primary, #ffffff);
  border: 1px solid var(--border-color, rgba(255, 255, 255, 0.2));
  border-radius: 24px;
  box-shadow: 0 20px 48px rgba(0, 0, 0, 0.22);
  overflow: hidden;
  animation: frPop 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  color: var(--text-primary, #1c1c1e);
}

.is-dark .fr-modal-card {
  background: #242426;
  border-color: rgba(255, 255, 255, 0.08);
}

.fr-card-glow {
  position: absolute;
  top: -40px;
  left: 50%;
  transform: translateX(-50%);
  width: 180px;
  height: 90px;
  background: radial-gradient(circle, rgba(0, 122, 255, 0.25) 0%, rgba(0, 122, 255, 0) 70%);
  pointer-events: none;
}

.fr-content-view {
  position: relative;
  padding: 20px 22px 22px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.fr-header {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.fr-badge {
  font-size: 11px;
  font-weight: 600;
  padding: 3px 10px;
  border-radius: 999px;
  background: rgba(0, 122, 255, 0.12);
  color: #007aff;
  letter-spacing: 0.5px;
}

.fr-badge.reject {
  background: rgba(255, 59, 48, 0.12);
  color: #ff3b30;
}

.fr-close-btn {
  border: none;
  background: var(--sys-bg-tertiary, #f2f2f7);
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  color: var(--text-tertiary, #8e8e93);
  cursor: pointer;
  transition: opacity 0.2s;
}

.fr-close-btn:hover {
  opacity: 0.8;
}

.fr-avatar-wrapper {
  margin-top: 4px;
  margin-bottom: 12px;
}

.fr-avatar {
  width: 68px;
  height: 68px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: #007aff;
  color: #ffffff;
  font-size: 20px;
  font-weight: 600;
  background-size: cover;
  background-position: center;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.12);
}

.fr-title {
  margin: 0;
  font-size: 18px;
  font-weight: 650;
  line-height: 1.3;
}

.fr-subtitle {
  margin: 4px 0 16px;
  font-size: 12px;
  color: var(--text-tertiary, #8e8e93);
}

.fr-message-box {
  width: 100%;
  box-sizing: border-box;
  background: var(--sys-bg-secondary, #f7f7f9);
  border-radius: 14px;
  padding: 12px 14px;
  margin-bottom: 20px;
  text-align: left;
}

.is-dark .fr-message-box {
  background: rgba(255, 255, 255, 0.05);
}

.fr-message-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-tertiary, #8e8e93);
  margin-bottom: 4px;
}

.fr-message-text {
  font-size: 13px;
  color: var(--text-primary, #333333);
  line-height: 1.5;
  max-height: 120px;
  overflow-y: auto;
  word-break: break-word;
}

.fr-textarea-box {
  width: 100%;
  box-sizing: border-box;
  background: var(--sys-bg-secondary, #f7f7f9);
  border-radius: 14px;
  padding: 10px 12px;
  margin-bottom: 20px;
  position: relative;
  text-align: left;
}

.is-dark .fr-textarea-box {
  background: rgba(255, 255, 255, 0.05);
}

.fr-textarea-box textarea {
  width: 100%;
  box-sizing: border-box;
  border: none;
  background: transparent;
  resize: none;
  font-family: inherit;
  font-size: 13px;
  color: var(--text-primary, #1c1c1e);
  outline: none;
}

.fr-char-count {
  display: block;
  text-align: right;
  font-size: 10px;
  color: var(--text-tertiary, #8e8e93);
}

.fr-actions {
  width: 100%;
  display: flex;
  gap: 10px;
}

.fr-btn {
  flex: 1;
  height: 42px;
  border-radius: 12px;
  border: none;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.15s, opacity 0.15s;
}

.fr-btn:active {
  transform: scale(0.97);
}

.fr-btn-reject {
  background: var(--sys-bg-secondary, #f2f2f7);
  color: var(--text-secondary, #666666);
}

.is-dark .fr-btn-reject {
  background: rgba(255, 255, 255, 0.08);
  color: #d1d1d6;
}

.fr-btn-accept {
  background: #007aff;
  color: #ffffff;
}

.fr-btn-secondary {
  background: var(--sys-bg-secondary, #f2f2f7);
  color: var(--text-primary, #1c1c1e);
}

.fr-btn-danger {
  background: #ff3b30;
  color: #ffffff;
}

@keyframes frPop {
  0% { transform: scale(0.92); opacity: 0; }
  100% { transform: scale(1); opacity: 1; }
}

.fr-modal-fade-enter-active,
.fr-modal-fade-leave-active {
  transition: opacity 0.22s ease;
}

.fr-modal-fade-enter-from,
.fr-modal-fade-leave-to {
  opacity: 0;
}
</style>
