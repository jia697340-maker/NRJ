/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import type { ForumPost } from '../../../types/forum'

const props = withDefaults(
  defineProps<{
    post: ForumPost
    showBookmark?: boolean
  }>(),
  {
    showBookmark: true
  }
)

const emit = defineEmits<{
  (e: 'like', post: ForumPost): void
  (e: 'comment', post: ForumPost): void
  (e: 'share', post: ForumPost): void
  (e: 'bookmark', post: ForumPost): void
}>()
</script>

<template>
  <div class="post-actions-row">
    <!-- 评论按钮 -->
    <button
      class="action-item"
      type="button"
      aria-label="评论"
      @click.stop="emit('comment', post)"
    >
      <svg class="action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
      </svg>
      <span class="action-count">{{ post.commentCount > 0 ? post.commentCount : '评论' }}</span>
    </button>

    <!-- 点赞按钮 -->
    <button
      class="action-item"
      :class="{ 'is-active-like': post.isLiked }"
      type="button"
      aria-label="点赞"
      @click.stop="emit('like', post)"
    >
      <svg
        class="action-icon like-icon"
        viewBox="0 0 24 24"
        :fill="post.isLiked ? '#e0245e' : 'none'"
        :stroke="post.isLiked ? '#e0245e' : 'currentColor'"
        stroke-width="1.8"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
      <span class="action-count">{{ post.likeCount > 0 ? post.likeCount : '赞' }}</span>
    </button>

    <!-- 收藏/书签按钮 -->
    <button
      v-if="showBookmark"
      class="action-item"
      :class="{ 'is-active-bookmark': post.isBookmarked }"
      type="button"
      aria-label="收藏"
      @click.stop="emit('bookmark', post)"
    >
      <svg
        class="action-icon"
        viewBox="0 0 24 24"
        :fill="post.isBookmarked ? '#f59e0b' : 'none'"
        :stroke="post.isBookmarked ? '#f59e0b' : 'currentColor'"
        stroke-width="1.8"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
      </svg>
    </button>

    <!-- 分享/更多操作 -->
    <button
      class="action-item"
      type="button"
      aria-label="分享"
      @click.stop="emit('share', post)"
    >
      <svg class="action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="18" cy="5" r="3"></circle>
        <circle cx="6" cy="12" r="3"></circle>
        <circle cx="18" cy="19" r="3"></circle>
        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
        <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
      </svg>
    </button>
  </div>
</template>

<style scoped>
.post-actions-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 10px;
  max-width: 380px;
}

.action-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: transparent;
  border: 0;
  padding: 4px 6px;
  color: var(--text-secondary, #666666);
  cursor: pointer;
  border-radius: 8px;
  transition: all 0.15s ease;
  user-select: none;
}

.action-item:active {
  transform: scale(0.92);
  background: var(--sys-bg-tertiary, rgba(0, 0, 0, 0.04));
}

.action-icon {
  width: 17px;
  height: 17px;
  transition: transform 0.15s ease;
}

.action-count {
  font-size: 12px;
  font-weight: 500;
  line-height: 1;
}

.is-active-like {
  color: #e0245e;
}

.is-active-like .like-icon {
  transform: scale(1.1);
}

.is-active-bookmark {
  color: #f59e0b;
}
</style>
