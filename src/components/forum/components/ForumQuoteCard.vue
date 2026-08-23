/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import type { ForumQuoteContent } from '../../../types/forum'
import ForumAvatar from './ForumAvatar.vue'

withDefaults(
  defineProps<{
    quote: ForumQuoteContent
  }>(),
  {}
)

const emit = defineEmits<{
  (e: 'click-quote', quote: ForumQuoteContent): void
}>()
</script>

<template>
  <div class="forum-quote-card" @click.stop="emit('click-quote', quote)">
    <div class="quote-header">
      <ForumAvatar
        :src="quote.author.avatar"
        :name="quote.author.name"
        size="xs"
      />
      <span class="quote-author-name">{{ quote.author.name }}</span>
      <span v-if="quote.author.handle" class="quote-author-handle">@{{ quote.author.handle }}</span>
    </div>
    <div class="quote-content-text">
      {{ quote.content }}
    </div>
  </div>
</template>

<style scoped>
.forum-quote-card {
  margin-top: 8px;
  padding: 10px 12px;
  border-radius: 12px;
  background: var(--sys-bg-tertiary, #f6f7f9);
  border: 1px solid var(--border-color, rgba(0, 0, 0, 0.06));
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.forum-quote-card:active {
  background: var(--border-color, rgba(0, 0, 0, 0.08));
}

.quote-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
}

.quote-author-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary, #333333);
}

.quote-author-handle {
  font-size: 12px;
  color: var(--text-tertiary, #999999);
}

.quote-content-text {
  font-size: 13px;
  line-height: 1.45;
  color: var(--text-secondary, #555555);
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
