/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { ref } from 'vue'
import { chatSettings } from '../../store'
const emit = defineEmits<{
  (e: 'back'): void
}>()

const currentUrl = ref('edge://chat-appearance')

const handleBack = () => {
  emit('back')
}

const handleRefresh = () => {
  // 模拟刷新动画或不做实际操作
}
</script>

<template>
  <div class="chat-appearance-container">
    <!-- 仿 EDGE 地址栏 -->
    <header class="edge-header">
      <div class="edge-nav-buttons">
        <button class="nav-btn" @click="handleBack" title="后退">
          <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
        </button>
        <button class="nav-btn disabled" title="前进">
          <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
        </button>
        <button class="nav-btn" @click="handleRefresh" title="刷新">
          <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
        </button>
      </div>
      <div class="edge-address-bar">
        <div class="address-icon lock-icon">
          <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
        </div>
        <input type="text" class="address-input" v-model="currentUrl" readonly />
        <div class="address-icon star-icon">
          <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
        </div>
      </div>
      <div class="edge-extensions">
        <button class="nav-btn">
          <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"></circle><circle cx="19" cy="12" r="1"></circle><circle cx="5" cy="12" r="1"></circle></svg>
        </button>
      </div>
    </header>

    <!-- 主体区域：留白、好看 -->
    <main class="appearance-main">
      <div class="appearance-settings-list">
        <div class="setting-item">
          <div class="setting-info">
            <div class="setting-title">顶栏右键菜单</div>
            <div class="setting-desc">开启后，在聊天页顶部导航栏右键可唤出快捷菜单。</div>
          </div>
          <label class="switch">
            <input type="checkbox" v-model="chatSettings.showTopBarContextMenu" />
            <span class="slider"></span>
          </label>
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
.chat-appearance-container {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: var(--sys-bg-primary, #ffffff);
  display: flex;
  flex-direction: column;
  z-index: 100;
  overflow: hidden;
}

/* 仿 EDGE 地址栏样式 */
.edge-header {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  background: #f3f3f3;
  border-bottom: 1px solid #e5e5e5;
  padding-top: calc(8px + env(safe-area-inset-top, 40px)); /* 适配刘海屏 */
  gap: 8px;
}

.edge-nav-buttons {
  display: flex;
  align-items: center;
  gap: 4px;
}

.nav-btn {
  background: transparent;
  border: none;
  border-radius: 4px;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #4a4a4a;
  cursor: pointer;
  transition: background-color 0.2s;
}

.nav-btn:hover {
  background-color: #e5e5e5;
}

.nav-btn.disabled {
  color: #b0b0b0;
  cursor: not-allowed;
}

.nav-btn.disabled:hover {
  background-color: transparent;
}

.edge-address-bar {
  flex: 1;
  display: flex;
  align-items: center;
  background: #ffffff;
  border: 1px solid #ffffff;
  border-radius: 20px;
  height: 34px;
  padding: 0 12px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.05);
  transition: box-shadow 0.2s, border-color 0.2s;
}

.edge-address-bar:focus-within {
  border-color: #0078d4;
  box-shadow: 0 0 0 1px rgba(0, 120, 212, 0.3);
}

.address-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #666666;
}

.address-input {
  flex: 1;
  border: none;
  outline: none;
  background: transparent;
  font-size: 13px;
  color: #333333;
  padding: 0 8px;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  text-overflow: ellipsis;
}

.edge-extensions {
  display: flex;
  align-items: center;
}

/* 主体区域 */
.appearance-main {
  flex: 1;
  background: var(--sys-bg-primary, #ffffff);
  padding: 24px 16px;
}

.appearance-settings-list {
  background: var(--sys-bg-secondary, #f8f9fa);
  border-radius: 12px;
  padding: 0 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.02);
}

.setting-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 0;
  border-bottom: 1px solid var(--border-color, #e5e5e5);
}

.setting-item:last-child {
  border-bottom: none;
}

.setting-item.clickable {
  cursor: pointer;
}

.setting-item.clickable:active {
  opacity: 0.7;
}

.setting-arrow {
  color: var(--text-tertiary, #999999);
  display: flex;
  align-items: center;
}

.setting-info {
  flex: 1;
  padding-right: 16px;
}

.setting-title {
  font-size: 15px;
  font-weight: 500;
  color: var(--text-primary, #333333);
  margin-bottom: 4px;
}

.setting-desc {
  font-size: 12px;
  color: var(--text-tertiary, #999999);
  line-height: 1.4;
}

/* Switch 样式 */
.switch {
  position: relative;
  display: inline-block;
  width: 44px;
  height: 24px;
  flex-shrink: 0;
}

.switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #e5e5e5;
  transition: .3s;
  border-radius: 24px;
}

.slider:before {
  position: absolute;
  content: "";
  height: 20px;
  width: 20px;
  left: 2px;
  bottom: 2px;
  background-color: white;
  transition: .3s;
  border-radius: 50%;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.bm-select {
  padding: 6px 10px;
  border: 1px solid var(--border-color, #e5e5e5);
  border-radius: 8px;
  background: var(--sys-bg-secondary, #f8f9fa);
  color: var(--text-primary, #333333);
  font-size: 14px;
  outline: none;
}

input:checked + .slider {
  background-color: #007aff;
}

input:checked + .slider:before {
  transform: translateX(20px);
}
</style>
