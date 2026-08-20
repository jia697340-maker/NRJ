<!-- WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ -->
<script setup lang="ts">
import { useChatAuth } from '../../../composables/useChatAuth'
import type { ChatAccount } from '../../../composables/useChatAuth'

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'switched'): void
}>()

const { chatAccounts, currentAccount, login } = useChatAuth()

const handleAccountSelect = (account: ChatAccount) => {
  if (account.id !== currentAccount.value?.id) {
    login(account.id)
    emit('switched')
  }
  emit('close')
}

// 获取账号展示首字符
const getInitial = (name?: string) => {
  if (!name) return 'U'
  return name.trim().charAt(0).toUpperCase()
}
</script>

<template>
  <div class="canvas-modal-overlay designer-overlay" style="z-index: 10050;" @click.self="emit('close')">
    <div class="account-switch-modal">
      <!-- 头部设计 -->
      <div class="as-header">
        <div class="as-header-left">
          <div class="as-subtitle">SWITCH ACCOUNT</div>
          <div class="as-title">选择身份 / 切换账号</div>
        </div>
        <button class="as-close-btn" type="button" aria-label="关闭" @click="emit('close')">
          <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
      
      <!-- 账号列表 -->
      <div class="account-list">
        <div v-if="chatAccounts.length === 0" class="no-accounts">
          <div class="empty-icon">👥</div>
          <div class="empty-text">暂无可用账号，请先添加</div>
        </div>
        
        <div 
          v-for="acc in chatAccounts" 
          :key="acc.id"
          class="account-card"
          :class="{ active: currentAccount?.id === acc.id }"
          @click="handleAccountSelect(acc)"
        >
          <!-- 头像区域 -->
          <div class="account-avatar-wrapper">
            <div 
              v-if="acc.avatarUrl" 
              class="account-avatar" 
              :style="{ backgroundImage: `url(${acc.avatarUrl})` }"
            ></div>
            <div v-else class="account-avatar fallback-avatar">
              {{ getInitial(acc.name) }}
            </div>

            <!-- 当前激活圆环微徽标 -->
            <span v-if="currentAccount?.id === acc.id" class="avatar-active-dot" title="当前登录"></span>
          </div>

          <!-- 账号详情 -->
          <div class="account-info">
            <div class="account-title-row">
              <span class="account-name" :title="acc.name">{{ acc.name || '未命名用户' }}</span>
              <span v-if="currentAccount?.id === acc.id" class="badge-current">使用中</span>
            </div>
            
            <div class="account-meta-row">
              <span class="account-id">ID: {{ acc.accountId || acc.id.slice(0, 8) }}</span>
              <span class="account-purpose-tag" :class="acc.purpose || 'primary'">
                {{ acc.purpose === 'persona' ? '全新人设' : acc.linkedAccountIds?.length ? '关联账号' : '独立账号' }}
              </span>
            </div>
          </div>

          <!-- 右侧指示态 -->
          <div class="account-action">
            <div v-if="currentAccount?.id === acc.id" class="active-check">
              <svg viewBox="0 0 24 24" width="16" height="16" stroke="#007aff" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            </div>
            <div v-else class="switch-arrow">
              <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.designer-overlay {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  box-sizing: border-box;
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

.account-switch-modal {
  width: 90%;
  max-width: 380px;
  background: #fbfbfc;
  border: 1px solid rgba(230, 233, 239, 0.9);
  border-radius: 24px;
  padding: 24px 20px 22px;
  box-sizing: border-box;
  box-shadow: 0 20px 48px rgba(15, 23, 42, 0.12), 0 4px 12px rgba(15, 23, 42, 0.04);
  animation: scaleIn 0.28s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes scaleIn {
  from { transform: scale(0.94); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}

:root.dark .account-switch-modal,
.dark-mode .account-switch-modal {
  background: #181a1e;
  border-color: rgba(255, 255, 255, 0.08);
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
}

.as-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding: 0 4px;
}

.as-header-left {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.as-subtitle {
  font-size: 10px;
  font-weight: 700;
  color: #94a3b8;
  letter-spacing: 1.5px;
  text-transform: uppercase;
}

:root.dark .as-subtitle,
.dark-mode .as-subtitle {
  color: #64748b;
}

.as-title {
  font-size: 19px;
  font-weight: 700;
  color: #1e293b;
  letter-spacing: -0.2px;
}

:root.dark .as-title,
.dark-mode .as-title {
  color: #f1f5f9;
}

.as-close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.04);
  border: none;
  color: #64748b;
  cursor: pointer;
  transition: all 0.2s;
  padding: 0;
}

:root.dark .as-close-btn,
.dark-mode .as-close-btn {
  background: rgba(255, 255, 255, 0.08);
  color: #94a3b8;
}

.as-close-btn:hover {
  background: rgba(0, 0, 0, 0.08);
  color: #1e293b;
}

:root.dark .as-close-btn:hover,
.dark-mode .as-close-btn:hover {
  background: rgba(255, 255, 255, 0.15);
  color: #f8fafc;
}

.as-close-btn:active {
  transform: scale(0.92);
}

.account-list {
  max-height: 420px;
  overflow-y: auto;
  scrollbar-width: none;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 2px;
}

.account-list::-webkit-scrollbar {
  display: none;
}

.no-accounts {
  text-align: center;
  color: #94a3b8;
  padding: 36px 16px;
  background: #fff;
  border-radius: 18px;
  border: 1px dashed #cbd5e1;
}

:root.dark .no-accounts,
.dark-mode .no-accounts {
  background: #202329;
  border-color: #334155;
  color: #64748b;
}

.empty-icon {
  font-size: 28px;
  margin-bottom: 8px;
}

.empty-text {
  font-size: 13px;
  font-weight: 500;
}

/* 账号卡片 */
.account-card {
  display: flex;
  align-items: center;
  padding: 14px 16px;
  border-radius: 18px;
  background: #ffffff;
  cursor: pointer;
  border: 1.5px solid rgba(226, 232, 240, 0.8);
  transition: all 0.22s cubic-bezier(0.25, 0.8, 0.25, 1);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.02);
  gap: 14px;
}

:root.dark .account-card,
.dark-mode .account-card {
  background: #20242b;
  border-color: rgba(255, 255, 255, 0.05);
}

.account-card:hover {
  border-color: #cbd5e1;
  transform: translateY(-1px);
  box-shadow: 0 6px 18px rgba(15, 23, 42, 0.06);
}

:root.dark .account-card:hover,
.dark-mode .account-card:hover {
  border-color: rgba(255, 255, 255, 0.15);
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.3);
}

.account-card:active {
  transform: scale(0.985);
}

.account-card.active {
  background: #f4f8ff;
  border-color: rgba(0, 122, 255, 0.4);
  box-shadow: 0 4px 16px rgba(0, 122, 255, 0.08);
}

:root.dark .account-card.active,
.dark-mode .account-card.active {
  background: #172336;
  border-color: rgba(0, 122, 255, 0.5);
  box-shadow: 0 4px 16px rgba(0, 122, 255, 0.15);
}

/* 头像 */
.account-avatar-wrapper {
  position: relative;
  width: 46px;
  height: 46px;
  flex-shrink: 0;
}

.account-avatar {
  width: 100%;
  height: 100%;
  border-radius: 14px;
  background-size: cover;
  background-position: center;
  background-color: #e2e8f0;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.06);
}

:root.dark .account-avatar,
.dark-mode .account-avatar {
  background-color: #334155;
}

.fallback-avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  font-weight: 700;
  color: #475569;
  background: linear-gradient(135deg, #e2e8f0, #cbd5e1);
}

:root.dark .fallback-avatar,
.dark-mode .fallback-avatar {
  background: linear-gradient(135deg, #334155, #1e293b);
  color: #94a3b8;
}

.avatar-active-dot {
  position: absolute;
  right: -2px;
  bottom: -2px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #34c759;
  border: 2px solid #fff;
  box-sizing: border-box;
}

:root.dark .avatar-active-dot,
.dark-mode .avatar-active-dot {
  border-color: #181a1e;
}

/* 信息区 */
.account-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.account-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.account-name {
  font-size: 15px;
  font-weight: 700;
  color: #1e293b;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

:root.dark .account-name,
.dark-mode .account-name {
  color: #f1f5f9;
}

.badge-current {
  font-size: 10px;
  font-weight: 600;
  color: #007aff;
  background: rgba(0, 122, 255, 0.1);
  padding: 1px 7px;
  border-radius: 999px;
  white-space: nowrap;
  flex-shrink: 0;
}

:root.dark .badge-current,
.dark-mode .badge-current {
  background: rgba(0, 122, 255, 0.2);
  color: #60a5fa;
}

.account-meta-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
}

.account-id {
  color: #94a3b8;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

:root.dark .account-id,
.dark-mode .account-id {
  color: #64748b;
}

.account-purpose-tag {
  display: inline-flex;
  padding: 1px 6px;
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.04);
  font-size: 10px;
  font-weight: 500;
  color: #64748b;
  white-space: nowrap;
  flex-shrink: 0;
}

:root.dark .account-purpose-tag,
.dark-mode .account-purpose-tag {
  background: rgba(255, 255, 255, 0.06);
  color: #94a3b8;
}

/* 操作指示态 */
.account-action {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  flex-shrink: 0;
}

.active-check {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: rgba(0, 122, 255, 0.1);
}

:root.dark .active-check,
.dark-mode .active-check {
  background: rgba(0, 122, 255, 0.2);
}

.switch-arrow {
  color: #cbd5e1;
  transition: transform 0.2s, color 0.2s;
}

:root.dark .switch-arrow,
.dark-mode .switch-arrow {
  color: #475569;
}

.account-card:hover .switch-arrow {
  color: #64748b;
  transform: translateX(2px);
}

:root.dark .account-card:hover .switch-arrow {
  color: #94a3b8;
}
</style>
