/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import type { ForumTopic, ForumUser } from '../../../types/forum'
import ForumHeader from '../components/ForumHeader.vue'
import ForumAvatar from '../components/ForumAvatar.vue'
import ForumFollowButton from '../components/ForumFollowButton.vue'

withDefaults(
  defineProps<{
    topics: ForumTopic[]
    recommendedUsers: ForumUser[]
  }>(),
  {}
)

const emit = defineEmits<{
  (e: 'back'): void
  (e: 'click-topic', topic: string): void
  (e: 'click-user', user: ForumUser): void
  (e: 'toggle-follow', userId: string): void
  (e: 'open-search'): void
}>()
</script>

<template>
  <div class="forum-discover-view">
    <ForumHeader title="发现" show-back show-search @back="emit('back')" @search="emit('open-search')" />

    <div class="discover-content">
      <!-- 搜索快捷条 -->
      <div class="search-bar-fake" @click="emit('open-search')">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
        <span>探索话题、动态与同行者...</span>
      </div>

      <!-- 热门话题榜单 -->
      <section class="section-card">
        <div class="section-header">
          <h2 class="section-title">热门话题</h2>
          <span class="section-sub">实时趋势</span>
        </div>
        <div class="topics-list">
          <div
            v-for="(t, index) in topics"
            :key="t.id"
            class="topic-row"
            @click="emit('click-topic', t.tag)"
          >
            <span class="topic-rank" :class="{ 'rank-top': index < 3 }">{{ index + 1 }}</span>
            <div class="topic-info">
              <div class="topic-title"># {{ t.name }}</div>
              <div v-if="t.description" class="topic-desc">{{ t.description }}</div>
            </div>
            <div class="topic-heat">{{ t.hotScore }}</div>
          </div>
        </div>
      </section>

      <!-- 推荐作者/同行者 -->
      <section class="section-card">
        <div class="section-header">
          <h2 class="section-title">值得关注的人</h2>
          <span class="section-sub">活跃分享者</span>
        </div>
        <div class="users-list">
          <div
            v-for="u in recommendedUsers"
            :key="u.id"
            class="user-row"
            @click="emit('click-user', u)"
          >
            <ForumAvatar
              :src="u.avatar"
              :name="u.name"
              :verified="u.verified"
              size="md"
            />
            <div class="user-row-info">
              <div class="user-row-name">{{ u.name }}</div>
              <div class="user-row-bio">{{ u.bio || '这个人很低调，还没有写简介' }}</div>
            </div>
            <ForumFollowButton
              :is-following="u.isFollowing"
              size="sm"
              @toggle="emit('toggle-follow', u.id)"
            />
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.forum-discover-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--sys-bg-primary, #f5f5f7);
}

.discover-content {
  flex: 1;
  overflow-y: auto;
  padding: 12px 14px 24px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  box-sizing: border-box;
}

.search-bar-fake {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  background: var(--sys-bg-secondary, #ffffff);
  border: 1px solid var(--border-color, rgba(0, 0, 0, 0.08));
  border-radius: 999px;
  color: var(--text-tertiary, #999999);
  font-size: 13.5px;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.02);
}

.search-bar-fake:active {
  transform: scale(0.98);
}

.section-card {
  background: var(--sys-bg-secondary, #ffffff);
  border-radius: 16px;
  padding: 14px;
  border: 1px solid var(--border-color, rgba(0, 0, 0, 0.05));
}

.section-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 12px;
}

.section-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-primary, #222222);
}

.section-sub {
  font-size: 11px;
  color: var(--text-tertiary, #999999);
}

.topics-list {
  display: flex;
  flex-direction: column;
}

.topic-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid var(--border-color, rgba(0, 0, 0, 0.03));
  cursor: pointer;
}

.topic-row:last-child {
  border-bottom: none;
}

.topic-rank {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-tertiary, #aaaaaa);
  width: 18px;
  text-align: center;
}

.topic-rank.rank-top {
  color: #e0245e;
}

.topic-info {
  flex: 1;
  min-width: 0;
}

.topic-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary, #333333);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.topic-desc {
  font-size: 12px;
  color: var(--text-secondary, #777777);
  margin-top: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.topic-heat {
  font-size: 11.5px;
  color: var(--text-tertiary, #999999);
  flex-shrink: 0;
}

.users-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.user-row {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
}

.user-row-info {
  flex: 1;
  min-width: 0;
}

.user-row-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary, #333333);
}

.user-row-bio {
  font-size: 12px;
  color: var(--text-secondary, #777777);
  margin-top: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
