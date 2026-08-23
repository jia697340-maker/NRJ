/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
withDefaults(
  defineProps<{
    title?: string
    showBack?: boolean
    showSearch?: boolean
    transparent?: boolean
  }>(),
  {
    title: '',
    showBack: false,
    showSearch: false,
    transparent: false
  }
)

const emit = defineEmits<{
  (e: 'back'): void
  (e: 'search'): void
}>()
</script>

<template>
  <header class="forum-header" :class="{ 'is-transparent': transparent }">
    <div class="header-left">
      <button
        v-if="showBack"
        class="header-action-btn"
        type="button"
        aria-label="返回"
        @click="emit('back')"
      >
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="15 18 9 12 15 6"></polyline>
        </svg>
      </button>
      <slot name="left"></slot>
    </div>

    <div class="header-center">
      <slot name="center">
        <h1 v-if="title" class="header-title">{{ title }}</h1>
      </slot>
    </div>

    <div class="header-right">
      <button
        v-if="showSearch"
        class="header-action-btn"
        type="button"
        aria-label="搜索"
        @click="emit('search')"
      >
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
      </button>
      <slot name="right"></slot>
    </div>
  </header>
</template>

<style scoped>
.forum-header {
  position: sticky;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 52px;
  padding: 0 12px;
  background: var(--sys-bg-secondary, #ffffff);
  border-bottom: 1px solid var(--border-color, rgba(0, 0, 0, 0.06));
  box-sizing: border-box;
}

.forum-header.is-transparent {
  background: transparent;
  border-bottom-color: transparent;
}

.header-left,
.header-right {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 44px;
}

.header-right {
  justify-content: flex-end;
}

.header-center {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
  padding: 0 8px;
}

.header-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary, #333333);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.header-action-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--text-primary, #333333);
  cursor: pointer;
  transition: background-color 0.15s ease, transform 0.12s ease;
}

.header-action-btn:active {
  background: var(--sys-bg-tertiary, #f0f0f0);
  transform: scale(0.92);
}
</style>
