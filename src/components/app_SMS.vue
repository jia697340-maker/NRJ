/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { ref } from 'vue'
import { globalSettings } from '../store'

const emit = defineEmits(['close'])

const handleBackToDesktop = () => {
  emit('close')
}

// 模拟短信列表数据
const smsList = ref([
  {
    id: 1,
    name: '系统通知',
    avatarType: 'icon',
    avatarIcon: 'bell',
    number: '1069 0099 00',
    time: '刚刚',
    unread: true,
    lastMessage: '欢迎使用短信服务。',
    messages: [
      { id: 101, type: 'receive', time: '刚刚', text: '【系统通知】欢迎使用短信服务，您的初始设置已完成。' }
    ]
  }
])

const activeSms = ref<any>(null)

const openSms = (sms: any) => {
  activeSms.value = sms
  sms.unread = false
}

const closeSms = () => {
  activeSms.value = null
}
</script>

<template>
  <div class="sms-app" :class="{ 'dark-mode': globalSettings.darkMode }">
    <!-- 列表页 -->
    <div v-if="!activeSms" class="sms-list-view">
      <div class="header">
        <h1 class="title" @click="handleBackToDesktop" title="返回桌面">SMS</h1>
        <div class="header-actions">
          <svg viewBox="0 0 24 24" class="icon-btn" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
          </svg>
        </div>
      </div>
      
      <div class="search-container">
        <div class="search-box">
          <svg class="search-icon" viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input type="text" placeholder="搜索短信" class="search-input" />
          <svg class="filter-icon" viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <line x1="4" y1="21" x2="4" y2="14"></line>
            <line x1="4" y1="10" x2="4" y2="3"></line>
            <line x1="12" y1="21" x2="12" y2="12"></line>
            <line x1="12" y1="8" x2="12" y2="3"></line>
            <line x1="20" y1="21" x2="20" y2="16"></line>
            <line x1="20" y1="12" x2="20" y2="3"></line>
            <line x1="1" y1="14" x2="7" y2="14"></line>
            <line x1="9" y1="8" x2="15" y2="8"></line>
            <line x1="17" y1="16" x2="23" y2="16"></line>
          </svg>
        </div>
      </div>

      <div class="list-container">
        <div class="list-item" v-for="sms in smsList" :key="sms.id" @click="openSms(sms)">
          <div class="avatar">
            <template v-if="sms.avatarType === 'icon'">
              <svg v-if="sms.avatarIcon === 'bell'" viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
              </svg>
              <svg v-else-if="sms.avatarIcon === 'bank'" viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="10" width="18" height="12" rx="2"></rect>
                <path d="M2 10h20"></path>
                <path d="M12 2l-9 5v3h18V7z"></path>
              </svg>
              <svg v-else-if="sms.avatarIcon === 'user'" viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
            </template>
            <span v-else class="avatar-text">{{ sms.avatarText }}</span>
          </div>
          <div class="content">
            <div class="content-header">
              <span class="name">{{ sms.name }}</span>
              <span class="time">{{ sms.time }}</span>
            </div>
            <div class="content-body">
              <span class="preview">{{ sms.lastMessage }}</span>
              <div v-if="sms.unread" class="unread-dot"></div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 详情页 -->
    <div v-else class="sms-detail-view">
      <div class="detail-header">
        <div class="header-left" @click="closeSms">
          <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
        </div>
        <div class="header-center">
          <div class="avatar-small">
            <template v-if="activeSms.avatarType === 'icon'">
              <svg v-if="activeSms.avatarIcon === 'bell'" viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
              </svg>
              <svg v-else-if="activeSms.avatarIcon === 'bank'" viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="10" width="18" height="12" rx="2"></rect>
                <path d="M2 10h20"></path>
                <path d="M12 2l-9 5v3h18V7z"></path>
              </svg>
              <svg v-else-if="activeSms.avatarIcon === 'user'" viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
            </template>
            <span v-else style="font-size: 14px; font-weight: 600;">{{ activeSms.avatarText }}</span>
          </div>
          <div class="contact-info">
            <div class="contact-name">{{ activeSms.name }}</div>
            <div class="contact-number" v-if="activeSms.number">{{ activeSms.number }}</div>
          </div>
        </div>
        <div class="header-right">
          <svg class="action-icon" viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
          <svg class="action-icon" viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="1"></circle>
            <circle cx="12" cy="5" r="1"></circle>
            <circle cx="12" cy="19" r="1"></circle>
          </svg>
        </div>
      </div>

      <div class="message-list">
        <template v-if="activeSms.messages && activeSms.messages.length > 0">
          <div v-for="msg in activeSms.messages" :key="msg.id" class="message-wrapper">
            <div class="message-time">{{ msg.time }}</div>
            <div class="message-bubble" :class="msg.type">
              {{ msg.text }}
            </div>
          </div>
        </template>
      </div>

      <div class="input-area">
        <svg class="plus-icon" viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
        <div class="input-box">
          <input type="text" placeholder="输入短信内容" />
        </div>
        <svg class="send-icon" viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
          <line x1="22" y1="2" x2="11" y2="13"></line>
          <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
        </svg>
      </div>
    </div>
  </div>
</template>

<style scoped>
.sms-app {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: var(--sys-bg-secondary);
  z-index: 100;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Helvetica Neue", Arial, sans-serif;
}

.sms-app.dark-mode {
  background: #121212;
  color: #ffffff;
}

/* 列表页 */
.sms-list-view, .sms-detail-view {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px 8px;
}

.title {
  font-size: 22px;
  font-weight: 600;
  margin: 0;
  color: var(--text-primary);
  letter-spacing: 0.5px;
  font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif;
  cursor: pointer;
  transition: opacity 0.2s;
}
.title:active {
  opacity: 0.7;
}
.dark-mode .title {
  color: #eee;
}

.header-actions {
  display: flex;
  align-items: center;
}

.icon-btn {
  color: var(--text-primary);
  cursor: pointer;
}
.dark-mode .icon-btn {
  color: #eee;
}

.search-container {
  padding: 8px 20px 16px;
}

.search-box {
  display: flex;
  align-items: center;
  background-color: var(--sys-bg-primary);
  border-radius: 20px;
  padding: 8px 12px;
  gap: 8px;
}
.dark-mode .search-box {
  background-color: #2c2c2c;
}

.search-icon, .filter-icon {
  color: var(--text-tertiary);
}

.search-input {
  flex: 1;
  border: none;
  background: transparent;
  outline: none;
  font-size: 14px;
  color: var(--text-primary);
}
.search-input::placeholder {
  color: var(--text-tertiary);
}
.dark-mode .search-input {
  color: #eee;
}

.list-container {
  flex: 1;
  overflow-y: auto;
}

.list-item {
  display: flex;
  padding: 12px 20px;
  cursor: pointer;
  align-items: center;
}
.list-item:hover {
  background-color: var(--sys-bg-primary);
}
.dark-mode .list-item:hover {
  background-color: #1a1a1a;
}

.avatar {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background-color: var(--sys-bg-primary);
  display: flex;
  justify-content: center;
  align-items: center;
  margin-right: 12px;
  flex-shrink: 0;
  color: var(--text-secondary);
}
.dark-mode .avatar {
  background-color: var(--text-primary);
  color: #ccc;
}

.avatar-text {
  font-size: 18px;
  font-weight: 600;
}

.content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.content-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.name {
  font-size: 16px;
  font-weight: 500;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.dark-mode .name {
  color: #eee;
}

.time {
  font-size: 12px;
  color: var(--text-tertiary);
  flex-shrink: 0;
  margin-left: 8px;
}

.content-body {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.preview {
  font-size: 13px;
  color: var(--text-secondary);
  flex: 1;
  margin-right: 8px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: normal;
  line-height: 1.4;
}
.dark-mode .preview {
  color: var(--text-tertiary);
}

.unread-dot {
  width: 8px;
  height: 8px;
  min-width: 8px;
  min-height: 8px;
  border-radius: 50%;
  background-color: var(--text-primary);
  flex-shrink: 0;
}
.dark-mode .unread-dot {
  background-color: var(--sys-bg-secondary);
}

/* 详情页 */
.detail-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background-color: var(--sys-bg-secondary);
  z-index: 10;
}
.dark-mode .detail-header {
  background-color: #121212;
}

.header-left {
  cursor: pointer;
  color: var(--text-primary);
  display: flex;
  align-items: center;
}
.dark-mode .header-left {
  color: #eee;
}

.header-center {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
}

.avatar-small {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background-color: var(--sys-bg-primary);
  display: flex;
  justify-content: center;
  align-items: center;
  margin-bottom: 4px;
  color: var(--text-secondary);
}
.dark-mode .avatar-small {
  background-color: var(--text-primary);
  color: #ccc;
}

.contact-info {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.contact-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  line-height: 1.2;
}
.dark-mode .contact-name {
  color: #eee;
}

.contact-number {
  font-size: 12px;
  color: var(--text-tertiary);
  margin-top: 2px;
}

.header-right {
  display: flex;
  gap: 16px;
  color: var(--text-primary);
}
.dark-mode .header-right {
  color: #eee;
}

.action-icon {
  cursor: pointer;
}

.message-list {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  background-color: var(--sys-bg-secondary);
  display: flex;
  flex-direction: column;
}
.dark-mode .message-list {
  background-color: #121212;
}

.message-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 24px;
  width: 100%;
}

.message-time {
  font-size: 12px;
  color: var(--text-tertiary);
  margin-bottom: 12px;
}

.message-bubble {
  max-width: 85%;
  padding: 12px 16px;
  border-radius: 12px;
  font-size: 14px;
  line-height: 1.5;
  word-wrap: break-word;
  align-self: flex-start;
  background-color: var(--sys-bg-primary);
  color: var(--text-primary);
}
.dark-mode .message-bubble {
  background-color: #2c2c2c;
  color: #eee;
}

.input-area {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  background-color: var(--sys-bg-secondary);
  gap: 12px;
  margin-bottom: env(safe-area-inset-bottom);
}
.dark-mode .input-area {
  background-color: #121212;
}

.plus-icon {
  color: var(--text-secondary);
  cursor: pointer;
}
.dark-mode .plus-icon {
  color: var(--text-tertiary);
}

.input-box {
  flex: 1;
  background-color: var(--sys-bg-primary);
  border-radius: 20px;
  padding: 8px 16px;
}
.dark-mode .input-box {
  background-color: #2c2c2c;
}

.input-box input {
  width: 100%;
  border: none;
  background: transparent;
  outline: none;
  font-size: 14px;
  color: var(--text-primary);
}
.input-box input::placeholder {
  color: var(--text-tertiary);
}
.dark-mode .input-box input {
  color: #eee;
}

.send-icon {
  color: var(--text-primary);
  cursor: pointer;
}
.dark-mode .send-icon {
  color: #eee;
}
</style>
