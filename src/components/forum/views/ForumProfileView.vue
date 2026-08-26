/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { ref, computed } from 'vue'
import type { ForumUser, ForumPost, ForumMediaItem, ForumQuoteContent } from '../../../types/forum'
import ForumHeader from '../components/ForumHeader.vue'
import ForumAvatar from '../components/ForumAvatar.vue'
import ForumFollowButton from '../components/ForumFollowButton.vue'
import ForumFeedItem from '../components/ForumFeedItem.vue'
import ForumEmptyState from '../components/ForumEmptyState.vue'

const props = withDefaults(
  defineProps<{
    user: ForumUser
    posts: ForumPost[]
    isSelf?: boolean
    showBack?: boolean
    friendStatus?: 'none' | 'outgoing' | 'incoming' | 'friends'
  }>(),
  {
    isSelf: false,
    showBack: false
  }
)

const emit = defineEmits<{
  (e: 'back'): void
  (e: 'toggle-follow', userId: string): void
  (e: 'send-dm', user: ForumUser): void
  (e: 'friend-action', user: ForumUser): void
  (e: 'manage-user', user: ForumUser): void
  (e: 'manage-npc', user: ForumUser): void
  (e: 'refresh-profile', user: ForumUser): void
  (e: 'edit-profile'): void
  (e: 'click-post', post: ForumPost): void
  (e: 'click-topic', topic: string): void
  (e: 'preview-image', index: number, media: ForumMediaItem[]): void
  (e: 'click-quote', quote: ForumQuoteContent): void
  (e: 'like', post: ForumPost): void
  (e: 'comment', post: ForumPost): void
  (e: 'share', post: ForumPost): void
  (e: 'bookmark', post: ForumPost): void
}>()

const activeTab = ref<'posts' | 'media' | 'likes'>('posts')

const userPosts = computed(() => {
  return props.posts.filter(p => p.author.id === props.user.id)
})

const mediaPosts = computed(() => {
  return userPosts.value.filter(p => p.media && p.media.length > 0)
})

const likedPosts = computed(() => {
  return props.posts.filter(p => p.isLiked)
})

const displayPosts = computed(() => {
  if (activeTab.value === 'posts') return userPosts.value
  if (activeTab.value === 'media') return mediaPosts.value
  return likedPosts.value
})
</script>

<template>
  <div class="forum-profile-view">
    <ForumHeader
      :title="user.name"
      :show-back="showBack"
      @back="emit('back')"
    />

    <div class="profile-scroll-wrap">
      <!-- 个人资料卡片区 -->
      <div class="profile-header-card">
        <!-- 顶部背景条 -->
        <div class="profile-banner" :style="user.banner?{backgroundImage:`url(${user.banner})`}:undefined"></div>

        <div class="profile-main-info">
          <!-- 头像与操作按钮行 -->
          <div class="avatar-action-row">
            <div class="profile-avatar-anchor">
              <ForumAvatar
                :src="user.avatar"
                :name="user.name"
                :verified="user.verified"
                size="xl"
              />
            </div>

            <div class="profile-actions-group">
              <button v-if="!isSelf&&user.lifecycle!=='character'" class="dm-action-btn" type="button" title="编辑 NPC" @click="emit('manage-npc',user)">✎</button>
              <button v-if="!isSelf&&user.lifecycle!=='character'" class="dm-action-btn" type="button" title="增量刷新该主页" @click="emit('refresh-profile',user)">↻</button>
              <button v-if="!isSelf" class="dm-action-btn more-action-btn" type="button" aria-label="关系与可见性" @click="emit('manage-user', user)">•••</button>
              <button
                v-if="!isSelf"
                class="dm-action-btn"
                type="button"
                aria-label="发送私信"
                @click="emit('send-dm', user)"
              >
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                  <polyline points="22,6 12,13 2,6"></polyline>
                </svg>
              </button>
              <button v-if="!isSelf" class="friend-action-btn" :class="friendStatus" type="button" :disabled="friendStatus==='friends'||friendStatus==='outgoing'" @click="emit('friend-action',user)">{{friendStatus==='friends'?'已是好友':friendStatus==='incoming'?'同意好友':friendStatus==='outgoing'?'等待同意':'加好友'}}</button>
              <ForumFollowButton
                :is-self="isSelf"
                :is-following="user.isFollowing"
                size="md"
                @toggle="emit('toggle-follow', user.id)"
                @edit-profile="emit('edit-profile')"
              />
            </div>
          </div>

          <!-- 姓名与 Handle -->
          <div class="profile-identity">
            <h2 class="profile-name">{{ user.name }}</h2>
            <div class="profile-handle">@{{ user.handle }}</div>
          </div>

          <!-- 个人简介 -->
          <p class="profile-bio">{{ user.bio || '这个人很低调，还没有写简介' }}</p>

          <!-- 附属信息：IP / 加入时间 -->
          <div class="profile-meta-info">
            <span v-if="user.location" class="meta-item">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
              {{ user.location }}
            </span>
            <span v-if="user.joinedDate" class="meta-item">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
              {{ user.joinedDate }}加入
            </span>
          </div>

          <!-- 社交统计数据（关注 / 粉丝 / 获赞） -->
          <div class="profile-stats-row">
            <div class="stat-item">
              <strong class="stat-num">{{ user.followingCount }}</strong>
              <span class="stat-lbl">关注</span>
            </div>
            <div class="stat-item">
              <strong class="stat-num">{{ user.followersCount }}</strong>
              <span class="stat-lbl">粉丝</span>
            </div>
            <div class="stat-item">
              <strong class="stat-num">{{ user.likesCount }}</strong>
              <span class="stat-lbl">获赞</span>
            </div>
          </div>
        </div>

        <!-- 个人主页 Tab 切换 -->
        <div class="profile-tabs-bar">
          <button
            class="tab-btn"
            :class="{ 'is-active': activeTab === 'posts' }"
            type="button"
            @click="activeTab = 'posts'"
          >
            动态 ({{ userPosts.length }})
          </button>
          <button
            class="tab-btn"
            :class="{ 'is-active': activeTab === 'media' }"
            type="button"
            @click="activeTab = 'media'"
          >
            相册 ({{ mediaPosts.length }})
          </button>
          <button
            v-if="isSelf"
            class="tab-btn"
            :class="{ 'is-active': activeTab === 'likes' }"
            type="button"
            @click="activeTab = 'likes'"
          >
            喜欢 ({{ likedPosts.length }})
          </button>
        </div>
      </div>

      <!-- 动态/相册流列表 -->
      <div class="profile-feed-list">
        <template v-if="displayPosts.length > 0">
          <ForumFeedItem
            v-for="p in displayPosts"
            :key="p.id"
            :post="p"
            @click-post="emit('click-post', p)"
            @click-topic="t => emit('click-topic', t)"
            @preview-image="(i, m) => emit('preview-image', i, m)"
            @click-quote="q => emit('click-quote', q)"
            @like="post => emit('like', post)"
            @comment="post => emit('comment', post)"
            @share="post => emit('share', post)"
            @bookmark="post => emit('bookmark', post)"
          />
        </template>
        <ForumEmptyState
          v-else
          title="暂无内容"
          description="这里还没有任何动态记录"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.forum-profile-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--sys-bg-primary, #f5f5f7);
}

.profile-scroll-wrap {
  flex: 1;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

.profile-header-card {
  background: var(--sys-bg-secondary, #ffffff);
  border-bottom: 1px solid var(--border-color, rgba(0, 0, 0, 0.05));
}

.profile-banner {
  height: 90px;
  background: linear-gradient(135deg, #2b3a4a 0%, #1e2630 100%);
}

.profile-main-info {
  padding: 0 16px 14px;
}

.avatar-action-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-top: -38px;
  margin-bottom: 12px;
}

.profile-avatar-anchor {
  border: 3px solid var(--sys-bg-secondary, #ffffff);
  border-radius: 50%;
  background: var(--sys-bg-secondary, #ffffff);
}

.profile-actions-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.dm-action-btn {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  border: 1px solid var(--border-color, rgba(0, 0, 0, 0.15));
  background: transparent;
  color: var(--text-primary, #333333);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: transform 0.12s ease;
}

.dm-action-btn:active {
  transform: scale(0.92);
}
.friend-action-btn{height:34px;border:1px solid var(--border-color,rgba(0,0,0,.14));border-radius:999px;background:var(--sys-bg-secondary,#fff);color:var(--text-primary,#333);padding:0 11px;font-size:10.5px}.friend-action-btn.incoming{border-color:var(--accent-color,#576b95);color:var(--accent-color,#576b95)}.friend-action-btn.friends,.friend-action-btn.outgoing{opacity:.58}

.profile-identity {
  margin-bottom: 8px;
}

.profile-name {
  font-size: 19px;
  font-weight: 700;
  color: var(--text-primary, #111111);
}

.profile-handle {
  font-size: 13px;
  color: var(--text-tertiary, #888888);
  margin-top: 2px;
}

.profile-bio {
  font-size: 14px;
  line-height: 1.5;
  color: var(--text-primary, #333333);
  margin-bottom: 12px;
  white-space: pre-line;
}

.profile-meta-info {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 14px;
  font-size: 12px;
  color: var(--text-secondary, #777777);
}

.meta-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.profile-stats-row {
  display: flex;
  gap: 18px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border-color, rgba(0, 0, 0, 0.05));
}

.stat-item {
  display: inline-flex;
  align-items: baseline;
  gap: 4px;
}

.stat-num {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-primary, #111111);
}

.stat-lbl {
  font-size: 12px;
  color: var(--text-secondary, #777777);
}

.profile-tabs-bar {
  display: flex;
  border-top: 1px solid var(--border-color, rgba(0, 0, 0, 0.05));
}

.tab-btn {
  flex: 1;
  padding: 12px 0;
  background: transparent;
  border: 0;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-secondary, #777777);
  cursor: pointer;
  position: relative;
  transition: color 0.15s ease;
}

.tab-btn.is-active {
  font-weight: 700;
  color: var(--text-primary, #111111);
}

.tab-btn.is-active::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 24px;
  height: 2.5px;
  border-radius: 999px;
  background: var(--accent-color, #2b7de9);
}

.profile-feed-list {
  margin-top: 8px;
}
</style>
