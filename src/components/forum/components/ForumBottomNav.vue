/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
withDefaults(
  defineProps<{
    activeTab: 'feed' | 'discover' | 'messages' | 'profile'
    unreadMessagesCount?: number
  }>(),
  {
    unreadMessagesCount: 0
  }
)

const emit = defineEmits<{
  (e: 'select-tab', tab: 'feed' | 'discover' | 'messages' | 'profile'): void
  (e: 'click-publish'): void
}>()
</script>

<template>
  <nav class="forum-bottom-nav">
    <!-- 1. 动态首页 -->
    <button
      class="nav-tab-btn"
      :class="{ 'is-active': activeTab === 'feed' }"
      type="button"
      @click="emit('select-tab', 'feed')"
    >
      <svg class="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
        <polyline points="9 22 9 12 15 12 15 22"></polyline>
      </svg>
      <span class="tab-label">首页</span>
    </button>

    <!-- 2. 发现/探索 -->
    <button
      class="nav-tab-btn"
      :class="{ 'is-active': activeTab === 'discover' }"
      type="button"
      @click="emit('select-tab', 'discover')"
    >
      <svg class="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"></polygon>
      </svg>
      <span class="tab-label">发现</span>
    </button>

    <!-- 3. 居中快捷发布入口 -->
    <div class="nav-publish-slot">
      <button
        class="publish-btn"
        type="button"
        aria-label="发布新动态"
        @click="emit('click-publish')"
      >
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
      </button>
    </div>

    <!-- 4. 私信消息 -->
    <button
      class="nav-tab-btn"
      :class="{ 'is-active': activeTab === 'messages' }"
      type="button"
      @click="emit('select-tab', 'messages')"
    >
      <div class="tab-icon-wrap">
        <svg class="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
          <polyline points="22,6 12,13 2,6"></polyline>
        </svg>
        <span v-if="unreadMessagesCount > 0" class="badge-dot"></span>
      </div>
      <span class="tab-label">消息</span>
    </button>

    <!-- 5. 个人主页 -->
    <button
      class="nav-tab-btn"
      :class="{ 'is-active': activeTab === 'profile' }"
      type="button"
      @click="emit('select-tab', 'profile')"
    >
      <svg class="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
        <circle cx="12" cy="7" r="4"></circle>
      </svg>
      <span class="tab-label">我的</span>
    </button>
  </nav>
</template>

<style scoped>
.forum-bottom-nav {
  display: flex;
  align-items: center;
  justify-content: space-around;
  height: 54px;
  background: var(--sys-bg-secondary, #ffffff);
  border-top: 1px solid var(--border-color, rgba(0, 0, 0, 0.06));
  position: relative;
  z-index: 100;
  user-select: none;
  padding-bottom: env(safe-area-inset-bottom, 0);
  box-sizing: content-box;
}

.nav-tab-btn {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  height: 100%;
  background: transparent;
  border: 0;
  color: var(--text-tertiary, #999999);
  cursor: pointer;
  transition: color 0.15s ease, transform 0.12s ease;
  padding: 0;
}

.nav-tab-btn:active {
  transform: scale(0.92);
}

.nav-tab-btn.is-active {
  color: var(--text-primary, #111111);
}

.tab-icon {
  width: 22px;
  height: 22px;
}

.tab-label {
  font-size: 10.5px;
  font-weight: 500;
}

.tab-icon-wrap {
  position: relative;
  display: inline-flex;
}

.badge-dot {
  position: absolute;
  top: -1px;
  right: -2px;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #e0245e;
}

.nav-publish-slot {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 4px;
}

.publish-btn {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--text-primary, #111111);
  color: var(--sys-bg-secondary, #ffffff);
  border: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  transition: transform 0.15s ease;
}

.publish-btn:active {
  transform: scale(0.9);
}
</style>
