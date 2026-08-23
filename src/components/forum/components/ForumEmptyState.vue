/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
withDefaults(
  defineProps<{
    title?: string
    description?: string
    actionText?: string
  }>(),
  {
    title: '暂无动态',
    description: '这里静悄悄的，去发现更多有趣的内容吧',
    actionText: ''
  }
)

const emit = defineEmits<{
  (e: 'action'): void
}>()
</script>

<template>
  <div class="forum-empty-state">
    <div class="empty-icon-box">
      <svg viewBox="0 0 24 24" width="44" height="44" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
      </svg>
    </div>
    <h3 class="empty-title">{{ title }}</h3>
    <p class="empty-desc">{{ description }}</p>
    <button
      v-if="actionText"
      class="empty-action-btn"
      type="button"
      @click="emit('action')"
    >
      {{ actionText }}
    </button>
  </div>
</template>

<style scoped>
.forum-empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 24px;
  text-align: center;
}

.empty-icon-box {
  color: var(--text-tertiary, #aaaaaa);
  margin-bottom: 14px;
  opacity: 0.6;
}

.empty-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary, #333333);
  margin-bottom: 6px;
}

.empty-desc {
  font-size: 13px;
  color: var(--text-secondary, #777777);
  max-width: 240px;
  line-height: 1.5;
}

.empty-action-btn {
  margin-top: 18px;
  padding: 8px 20px;
  border-radius: 999px;
  border: 0;
  background: var(--text-primary, #222222);
  color: var(--sys-bg-secondary, #ffffff);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.15s ease;
}

.empty-action-btn:active {
  transform: scale(0.94);
}
</style>
