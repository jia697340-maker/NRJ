/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { ref, computed } from 'vue'
import type { ForumPost, ForumUser, ForumMediaItem, ForumQuoteContent } from '../../../types/forum'
import ForumHeader from '../components/ForumHeader.vue'
import ForumFeedItem from '../components/ForumFeedItem.vue'
import ForumEmptyState from '../components/ForumEmptyState.vue'

const props = defineProps<{
  posts: ForumPost[]
}>()

const emit = defineEmits<{
  (e: 'back'): void
  (e: 'click-post', post: ForumPost): void
  (e: 'click-user', user: ForumUser): void
  (e: 'click-topic', topic: string): void
  (e: 'preview-image', index: number, media: ForumMediaItem[]): void
  (e: 'click-quote', quote: ForumQuoteContent): void
  (e: 'like', post: ForumPost): void
  (e: 'comment', post: ForumPost): void
  (e: 'share', post: ForumPost): void
  (e: 'bookmark', post: ForumPost): void
  (e: 'open-search'): void
}>()

const activeSubTab = ref<'recommend' | 'follow' | 'latest'>('recommend')

const displayPosts = computed(() => {
  if (activeSubTab.value === 'follow') {
    return props.posts.filter(p => p.author.isFollowing)
  }
  return props.posts
})
</script>

<template>
  <div class="forum-feed-view">
    <!-- 顶部导航栏与分类 SubTab -->
    <ForumHeader show-back show-search @back="emit('back')" @search="emit('open-search')">
      <template #center>
        <div class="feed-subtabs">
          <button
            class="subtab-item"
            :class="{ 'is-active': activeSubTab === 'follow' }"
            type="button"
            @click="activeSubTab = 'follow'"
          >
            关注
          </button>
          <button
            class="subtab-item"
            :class="{ 'is-active': activeSubTab === 'recommend' }"
            type="button"
            @click="activeSubTab = 'recommend'"
          >
            推荐
          </button>
          <button
            class="subtab-item"
            :class="{ 'is-active': activeSubTab === 'latest' }"
            type="button"
            @click="activeSubTab = 'latest'"
          >
            最新
          </button>
        </div>
      </template>
    </ForumHeader>

    <!-- 动态流滚动容器 -->
    <div class="feed-scroll-container">
      <template v-if="displayPosts.length > 0">
        <ForumFeedItem
          v-for="post in displayPosts"
          :key="post.id"
          :post="post"
          @click-post="emit('click-post', post)"
          @click-user="u => emit('click-user', u)"
          @click-topic="t => emit('click-topic', t)"
          @preview-image="(i, m) => emit('preview-image', i, m)"
          @click-quote="q => emit('click-quote', q)"
          @like="p => emit('like', p)"
          @comment="p => emit('comment', p)"
          @share="p => emit('share', p)"
          @bookmark="p => emit('bookmark', p)"
        />
      </template>
      <ForumEmptyState
        v-else
        title="暂无动态"
        description="你关注的作者还没有发布新动态"
        action-text="去推荐逛逛"
        @action="activeSubTab = 'recommend'"
      />
    </div>
  </div>
</template>

<style scoped>
.forum-feed-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--sys-bg-primary, #f5f5f7);
}

.feed-subtabs {
  display: flex;
  align-items: center;
  gap: 16px;
}

.subtab-item {
  background: transparent;
  border: 0;
  font-size: 15px;
  font-weight: 500;
  color: var(--text-tertiary, #888888);
  cursor: pointer;
  padding: 4px 0;
  position: relative;
  transition: color 0.15s ease;
}

.subtab-item.is-active {
  font-weight: 700;
  color: var(--text-primary, #111111);
}

.subtab-item.is-active::after {
  content: '';
  position: absolute;
  bottom: -4px;
  left: 50%;
  transform: translateX(-50%);
  width: 16px;
  height: 2.5px;
  border-radius: 999px;
  background: var(--accent-color, #2b7de9);
}

.feed-scroll-container {
  flex: 1;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}
</style>
