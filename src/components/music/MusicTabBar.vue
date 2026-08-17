/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
defineProps<{
  activeTab: 'home' | 'listen' | 'mine'
}>()

const emit = defineEmits<{
  (e: 'update:activeTab', tab: 'home' | 'listen' | 'mine'): void
}>()
</script>

<template>
  <div class="music-tab-bar">
    <!-- 首页 -->
    <button
      class="tab-item"
      :class="{ active: activeTab === 'home' }"
      @click="emit('update:activeTab', 'home')"
    >
      <div class="tab-icon">
        <svg viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" stroke-width="2" fill="none">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
          <polyline points="9 22 9 12 15 12 15 22"/>
        </svg>
      </div>
      <span class="tab-label">首页</span>
    </button>

    <!-- 听歌 / 一起听 -->
    <button
      class="tab-item"
      :class="{ active: activeTab === 'listen' }"
      @click="emit('update:activeTab', 'listen')"
    >
      <div class="tab-icon">
        <svg viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" stroke-width="2" fill="none">
          <circle cx="12" cy="12" r="10"/>
          <circle cx="12" cy="12" r="3"/>
        </svg>
      </div>
      <span class="tab-label">听歌</span>
    </button>

    <!-- 我的 -->
    <button
      class="tab-item"
      :class="{ active: activeTab === 'mine' }"
      @click="emit('update:activeTab', 'mine')"
    >
      <div class="tab-icon">
        <svg viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" stroke-width="2" fill="none">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
          <circle cx="12" cy="7" r="4"/>
        </svg>
      </div>
      <span class="tab-label">我的</span>
    </button>
  </div>
</template>

<style scoped>
.music-tab-bar {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 54px;
  background: var(--music-glass-bg, rgba(255, 255, 255, 0.94));
  border-top: 1px solid var(--music-divider, rgba(0, 0, 0, 0.06));
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  display: flex;
  align-items: center;
  justify-content: space-around;
  z-index: 30;
  padding-bottom: env(safe-area-inset-bottom);
  transition: background 0.25s, border-color 0.25s;
}

.is-dark .music-tab-bar {
  background: rgba(26, 26, 29, 0.96);
  border-top-color: rgba(255, 255, 255, 0.08);
}

.tab-item {
  background: none;
  border: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  color: var(--music-text-sub, #8e8e93);
  cursor: pointer;
  flex: 1;
  height: 100%;
  transition: color 0.2s;
}

.tab-item.active {
  color: var(--music-text, #111111);
}

.is-dark .tab-item.active {
  color: #ffffff;
}

.tab-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 24px;
}

.tab-label {
  font-size: 10px;
  font-weight: 500;
}
</style>
