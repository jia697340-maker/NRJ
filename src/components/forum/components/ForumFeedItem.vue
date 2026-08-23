/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import type { ForumPost, ForumUser, ForumMediaItem, ForumQuoteContent } from '../../../types/forum'
import ForumAvatar from './ForumAvatar.vue'
import ForumUserIdentity from './ForumUserIdentity.vue'
import ForumTopicChip from './ForumTopicChip.vue'
import ForumImageGrid from './ForumImageGrid.vue'
import ForumQuoteCard from './ForumQuoteCard.vue'
import ForumPostActions from './ForumPostActions.vue'

const props = withDefaults(
  defineProps<{
    post: ForumPost
    isDetail?: boolean
  }>(),
  {
    isDetail: false
  }
)

const emit = defineEmits<{
  (e: 'click-post', post: ForumPost): void
  (e: 'click-user', user: ForumUser): void
  (e: 'click-topic', topic: string): void
  (e: 'preview-image', index: number, media: ForumMediaItem[]): void
  (e: 'click-quote', quote: ForumQuoteContent): void
  (e: 'like', post: ForumPost): void
  (e: 'comment', post: ForumPost): void
  (e: 'share', post: ForumPost): void
  (e: 'bookmark', post: ForumPost): void
}>()
</script>

<template>
  <article
    class="forum-feed-item"
    :class="{ 'is-detail': isDetail }"
    @click="!isDetail && emit('click-post', post)"
  >
    <!-- 头部：头像 + 用户标识 + 右侧可选操作 -->
    <div class="item-header">
      <ForumAvatar
        :src="post.author.avatar"
        :name="post.author.name"
        :verified="post.author.verified"
        size="md"
        clickable
        @click="emit('click-user', post.author)"
      />
      <div class="item-header-info">
        <ForumUserIdentity
          :user="post.author"
          :time="post.createdAt"
          @click-user="emit('click-user', post.author)"
        />
      </div>
      <div v-if="post.pinned" class="pinned-badge">置顶</div>
    </div>

    <!-- 正文区域 -->
    <div class="item-body">
      <!-- 专栏标题 -->
      <h2 v-if="post.title" class="post-title">{{ post.title }}</h2>

      <!-- 正文文字 -->
      <p class="post-text" :class="{ 'text-clamp': !isDetail && post.type === 'long-article' }">
        {{ post.content }}
      </p>

      <!-- 话题标签 -->
      <div v-if="post.topics && post.topics.length > 0" class="topics-wrap">
        <ForumTopicChip
          v-for="t in post.topics"
          :key="t"
          :topic="t"
          @click="emit('click-topic', t)"
        />
      </div>

      <!-- 配图宫格 -->
      <ForumImageGrid
        v-if="post.media && post.media.length > 0"
        :media="post.media"
        @preview="(index, media) => emit('preview-image', index, media)"
      />

      <!-- 嵌套引用帖 -->
      <ForumQuoteCard
        v-if="post.quote"
        :quote="post.quote"
        @click-quote="emit('click-quote', post.quote)"
      />
    </div>

    <!-- 底部互动操作栏 -->
    <ForumPostActions
      :post="post"
      @like="emit('like', post)"
      @comment="emit('comment', post)"
      @share="emit('share', post)"
      @bookmark="emit('bookmark', post)"
    />
  </article>
</template>

<style scoped>
.forum-feed-item {
  padding: 14px 16px;
  background: var(--sys-bg-secondary, #ffffff);
  border-bottom: 1px solid var(--border-color, rgba(0, 0, 0, 0.05));
  transition: background-color 0.15s ease;
  cursor: pointer;
  box-sizing: border-box;
}

.forum-feed-item:not(.is-detail):active {
  background: var(--sys-bg-tertiary, rgba(0, 0, 0, 0.02));
}

.forum-feed-item.is-detail {
  cursor: default;
  border-bottom: none;
}

.item-header {
  display: flex;
  align-items: center;
  gap: 10px;
  position: relative;
}

.item-header-info {
  flex: 1;
  min-width: 0;
}

.pinned-badge {
  font-size: 11px;
  color: var(--accent-color, #2b7de9);
  background: rgba(43, 125, 233, 0.1);
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 600;
}

.item-body {
  margin-top: 8px;
}

.post-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary, #222222);
  margin-bottom: 6px;
  line-height: 1.4;
}

.post-text {
  font-size: 14.5px;
  line-height: 1.6;
  color: var(--text-primary, #333333);
  word-break: break-word;
  white-space: pre-line;
}

.text-clamp {
  display: -webkit-box;
  -webkit-line-clamp: 4;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.topics-wrap {
  display: flex;
  flex-wrap: wrap;
  margin-top: 8px;
}
</style>
