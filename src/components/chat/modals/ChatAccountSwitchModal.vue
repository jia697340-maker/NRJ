<!-- WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ -->
<script setup lang="ts">
import { ref } from 'vue'
import { useChatAuth } from '../../../composables/useChatAuth'
import type { ChatAccount } from '../../../composables/useChatAuth'

const emit = defineEmits<{
  (e: 'close'): void
}>()

const { chatAccounts, currentAccount, login } = useChatAuth()

const handleAccountSelect = (account: ChatAccount) => {
  if (account.id !== currentAccount.value?.id) {
    login(account.id)
  }
  emit('close')
}

// 格式化索引，使其始终为两位数 (01, 02 等)
const formatIndex = (index: number) => {
  return (index + 1).toString().padStart(2, '0')
}
</script>

<template>
  <div class="canvas-modal-overlay designer-overlay" style="z-index: 10050;" @click.self="emit('close')">
    <div class="account-switch-modal">
      <div class="as-header">
        <div class="as-header-left">
          <div class="as-subtitle">SWITCH ACCOUNT</div>
          <div class="as-title">切换账号</div>
        </div>
        <div class="as-close-btn" @click="emit('close')">CLOSE</div>
      </div>
      
      <div class="account-list">
        <div v-if="chatAccounts.length === 0" class="no-accounts">
          暂无可用账号，请先添加
        </div>
        
        <div 
          v-for="(acc, index) in chatAccounts" 
          :key="acc.id"
          class="account-item"
          :class="{ active: currentAccount?.id === acc.id }"
          @click="handleAccountSelect(acc)"
        >
          <div class="account-index">{{ formatIndex(index) }}</div>
          <div class="account-info">
            <div class="account-name">{{ acc.name }}</div>
            <div class="account-id">ID: {{ acc.accountId || acc.id.slice(0, 8) }}</div>
          </div>
          <div class="account-status" v-if="currentAccount?.id === acc.id">
            <svg viewBox="0 0 24 24" width="20" height="20" stroke="#007aff" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.account-switch-modal {
  width: 100%;
  max-width: 380px;
  background: #f5f6f8;
  border-radius: 24px;
  padding: 32px 24px;
  box-sizing: border-box;
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.1);
}

:root.dark .account-switch-modal,
.dark-mode .account-switch-modal {
  background: #1e1e1e;
}

.as-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 28px;
}

.as-header-left {
  display: flex;
  flex-direction: column;
}

.as-subtitle {
  font-size: 11px;
  font-weight: 700;
  color: #999;
  letter-spacing: 1.5px;
  margin-bottom: 6px;
}

.as-title {
  font-size: 24px;
  font-weight: 700;
  color: #222;
}

:root.dark .as-title,
.dark-mode .as-title {
  color: #eee;
}

.as-close-btn {
  font-size: 11px;
  font-weight: 700;
  color: #666;
  background: #fff;
  border: 1px solid #e5e5e5;
  border-radius: 20px;
  padding: 6px 14px;
  cursor: pointer;
  letter-spacing: 1px;
  transition: all 0.2s;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.02);
}

:root.dark .as-close-btn,
.dark-mode .as-close-btn {
  background: #2a2a2a;
  border-color: #444;
  color: #bbb;
}

.as-close-btn:active {
  transform: scale(0.95);
  background: #f0f0f0;
}

.account-list {
  max-height: 450px;
  overflow-y: auto;
  scrollbar-width: none;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.account-list::-webkit-scrollbar {
  display: none;
}

.no-accounts {
  text-align: center;
  color: #999;
  font-size: 14px;
  padding: 20px 0;
  background: #fff;
  border-radius: 16px;
}

.account-item {
  display: flex;
  align-items: center;
  padding: 24px 20px;
  border-radius: 20px;
  background: #fff;
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.25, 0.8, 0.25, 1);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.03);
  border: 1px solid transparent;
}

:root.dark .account-item,
.dark-mode .account-item {
  background: #2a2a2a;
}

.account-item:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.06);
}

.account-item.active {
  border-color: rgba(0, 122, 255, 0.15);
  background: #fafdff;
}

:root.dark .account-item.active,
.dark-mode .account-item.active {
  background: #232c38;
  border-color: rgba(0, 122, 255, 0.3);
}

.account-item:active {
  transform: scale(0.97);
}

.account-index {
  font-size: 36px;
  font-weight: 200;
  color: #efefef;
  margin-right: 24px;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  letter-spacing: -1px;
}

:root.dark .account-index,
.dark-mode .account-index {
  color: #444;
}

.account-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.account-name {
  font-size: 17px;
  font-weight: 700;
  color: #333;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: 6px;
}

:root.dark .account-name,
.dark-mode .account-name {
  color: #eee;
}

.account-id {
  font-size: 13px;
  color: #999;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.account-status {
  width: 24px;
  display: flex;
  justify-content: flex-end;
  align-items: center;
  flex-shrink: 0;
}
</style>
