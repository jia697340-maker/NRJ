/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { ref, computed } from 'vue'
import type { ForumPost, ForumTopic, ForumUser, ForumMediaItem, ForumQuoteContent } from '../../../types/forum'
import ForumFeedItem from '../components/ForumFeedItem.vue'
import ForumAvatar from '../components/ForumAvatar.vue'
import ForumFollowButton from '../components/ForumFollowButton.vue'
import ForumEmptyState from '../components/ForumEmptyState.vue'

const props = defineProps<{
  posts: ForumPost[]
  topics: ForumTopic[]
  users: ForumUser[]
}>()

const emit = defineEmits<{
  (e: 'back'): void
  (e: 'click-post', post: ForumPost): void
  (e: 'click-user', user: ForumUser): void
  (e: 'click-topic', topic: string): void
  (e: 'toggle-follow', userId: string): void
  (e: 'preview-image', index: number, media: ForumMediaItem[]): void
  (e: 'click-quote', quote: ForumQuoteContent): void
  (e: 'like', post: ForumPost): void
  (e: 'comment', post: ForumPost): void
  (e: 'share', post: ForumPost): void
  (e: 'bookmark', post: ForumPost): void
}>()

const searchKeyword = ref('')
const activeFilter = ref<'all' | 'posts' | 'users'>('all')

const filteredPosts = computed(() => {
  const kw = searchKeyword.value.trim().toLowerCase()
  if (!kw) return []
  return props.posts.filter(p =>
    p.content.toLowerCase().includes(kw) ||
    p.author.name.toLowerCase().includes(kw) ||
    p.topics?.some(t => t.toLowerCase().includes(kw))
  )
})

const filteredUsers = computed(() => {
  const kw = searchKeyword.value.trim().toLowerCase()
  if (!kw) return []
  return props.users.filter(u =>
    u.name.toLowerCase().includes(kw) ||
    u.handle.toLowerCase().includes(kw) ||
    (u.bio && u.bio.toLowerCase().includes(kw))
  )
})

const handleSelectTopic = (topicName: string) => {
  searchKeyword.value = topicName
}
</script>

<template>
  <div class="forum-search-view">
    <!-- 顶部搜索导航栏 -->
    <header class="search-nav-header">
      <button class="back-btn" type="button" aria-label="返回" @click="emit('back')">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="15 18 9 12 15 6"></polyline>
        </svg>
      </button>

      <div class="search-input-box">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
        <input
          v-model="searchKeyword"
          type="search"
          placeholder="搜索动态、用户或话题..."
          class="search-input"
          autofocus
        />
        <button
          v-if="searchKeyword"
          class="clear-input-btn"
          type="button"
          @click="searchKeyword = ''"
        >
          ×
        </button>
      </div>
    </header>

    <!-- 搜索结果过滤栏 -->
    <div v-if="searchKeyword.trim()" class="search-filter-bar">
      <button
        class="filter-tab"
        :class="{ 'is-active': activeFilter === 'all' }"
        type="button"
        @click="activeFilter = 'all'"
      >
        综合
      </button>
      <button
        class="filter-tab"
        :class="{ 'is-active': activeFilter === 'posts' }"
        type="button"
        @click="activeFilter = 'posts'"
      >
        动态 ({{ filteredPosts.length }})
      </button>
      <button
        class="filter-tab"
        :class="{ 'is-active': activeFilter === 'users' }"
        type="button"
        @click="activeFilter = 'users'"
      >
        用户 ({{ filteredUsers.length }})
      </button>
    </div>

    <!-- 搜索主体内容 -->
    <div class="search-result-body">
      <!-- 初始状态：展示热门搜索与话题推荐 -->
      <div v-if="!searchKeyword.trim()" class="search-preset-wrap">
        <h4 class="preset-title">热门话题推荐</h4>
        <div class="preset-topics-grid">
          <button
            v-for="t in topics"
            :key="t.id"
            class="preset-topic-tag"
            type="button"
            @click="handleSelectTopic(t.tag)"
          >
            # {{ t.name }}
          </button>
        </div>
      </div>

      <!-- 搜索结果列表 -->
      <div v-else class="results-list">
        <!-- 用户板块（综合或用户Tab显示） -->
        <div
          v-if="(activeFilter === 'all' || activeFilter === 'users') && filteredUsers.length > 0"
          class="users-section"
        >
          <div class="section-title">相关用户</div>
          <div
            v-for="u in filteredUsers"
            :key="u.id"
            class="user-match-row"
            @click="emit('click-user', u)"
          >
            <ForumAvatar
              :src="u.avatar"
              :name="u.name"
              :verified="u.verified"
              size="md"
            />
            <div class="user-match-info">
              <div class="match-name">{{ u.name }}</div>
              <div class="match-bio">{{ u.bio || '暂无简介' }}</div>
            </div>
            <ForumFollowButton
              :is-following="u.isFollowing"
              size="sm"
              @toggle="emit('toggle-follow', u.id)"
            />
          </div>
        </div>

        <!-- 动态板块（综合或动态Tab显示） -->
        <div
          v-if="(activeFilter === 'all' || activeFilter === 'posts') && filteredPosts.length > 0"
          class="posts-section"
        >
          <div v-if="activeFilter === 'all'" class="section-title">相关动态</div>
          <ForumFeedItem
            v-for="p in filteredPosts"
            :key="p.id"
            :post="p"
            @click-post="emit('click-post', p)"
            @click-user="u => emit('click-user', u)"
            @click-topic="t => emit('click-topic', t)"
            @preview-image="(i, m) => emit('preview-image', i, m)"
            @click-quote="q => emit('click-quote', q)"
            @like="post => emit('like', post)"
            @comment="post => emit('comment', post)"
            @share="post => emit('share', post)"
            @bookmark="post => emit('bookmark', post)"
          />
        </div>

        <!-- 无搜索结果 -->
        <ForumEmptyState
          v-if="filteredPosts.length === 0 && filteredUsers.length === 0"
          title="未找到相关结果"
          description="换个关键词试试看吧"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.forum-search-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--sys-bg-primary, #f5f5f7);
}

.search-nav-header {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 52px;
  padding: 0 12px;
  background: var(--sys-bg-secondary, #ffffff);
  border-bottom: 1px solid var(--border-color, rgba(0, 0, 0, 0.06));
}

.back-btn {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 0;
  background: transparent;
  color: var(--text-primary, #333333);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.search-input-box {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--sys-bg-tertiary, #f0f2f5);
  border-radius: 999px;
  padding: 6px 12px;
  color: var(--text-secondary, #666666);
}

.search-input {
  flex: 1;
  border: 0;
  background: transparent;
  font-size: 14px;
  color: var(--text-primary, #222222);
  outline: none;
}

.clear-input-btn {
  background: transparent;
  border: 0;
  font-size: 16px;
  color: var(--text-tertiary, #999999);
  cursor: pointer;
  padding: 0 4px;
}

.search-filter-bar {
  display: flex;
  background: var(--sys-bg-secondary, #ffffff);
  border-bottom: 1px solid var(--border-color, rgba(0, 0, 0, 0.05));
}

.filter-tab {
  flex: 1;
  padding: 10px 0;
  background: transparent;
  border: 0;
  font-size: 13.5px;
  font-weight: 500;
  color: var(--text-secondary, #777777);
  cursor: pointer;
  position: relative;
}

.filter-tab.is-active {
  color: var(--text-primary, #111111);
  font-weight: 700;
}

.filter-tab.is-active::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 20px;
  height: 2px;
  border-radius: 999px;
  background: var(--accent-color, #2b7de9);
}

.search-result-body {
  flex: 1;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

.search-preset-wrap {
  padding: 16px;
}

.preset-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary, #666666);
  margin-bottom: 12px;
}

.preset-topics-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.preset-topic-tag {
  background: var(--sys-bg-secondary, #ffffff);
  border: 1px solid var(--border-color, rgba(0, 0, 0, 0.08));
  border-radius: 999px;
  padding: 6px 14px;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary, #333333);
  cursor: pointer;
  transition: transform 0.12s ease;
}

.preset-topic-tag:active {
  transform: scale(0.95);
}

.users-section {
  background: var(--sys-bg-secondary, #ffffff);
  margin-bottom: 8px;
  padding: 12px 16px;
}

.section-title {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--text-tertiary, #888888);
  margin-bottom: 10px;
}

.user-match-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 0;
  border-bottom: 1px solid var(--border-color, rgba(0, 0, 0, 0.03));
  cursor: pointer;
}

.user-match-info {
  flex: 1;
  min-width: 0;
}

.match-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary, #222222);
}

.match-bio {
  font-size: 12px;
  color: var(--text-secondary, #777777);
  margin-top: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
