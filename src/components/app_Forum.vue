/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { computed } from 'vue'
import { globalSettings } from '../store/global'
import { useForum } from '../composables/useForum'
import type { ForumPost, ForumUser, ForumMediaItem, ForumQuoteContent } from '../types/forum'

// 基础导航组件
import ForumBottomNav from './forum/components/ForumBottomNav.vue'

// 8 大骨架页面
import ForumFeedView from './forum/views/ForumFeedView.vue'
import ForumDiscoverView from './forum/views/ForumDiscoverView.vue'
import ForumPostDetailView from './forum/views/ForumPostDetailView.vue'
import ForumProfileView from './forum/views/ForumProfileView.vue'
import ForumMessagesView from './forum/views/ForumMessagesView.vue'
import ForumChatRoomView from './forum/views/ForumChatRoomView.vue'
import ForumPublishView from './forum/views/ForumPublishView.vue'
import ForumSearchView from './forum/views/ForumSearchView.vue'

const emit = defineEmits<{
  (e: 'close'): void
}>()

const {
  activeTab,
  currentRoute,
  routeStack,
  pushRoute,
  popRoute,
  resetToTab,
  currentForumUser,
  mockForumUsers,
  mockForumTopics,
  mockForumPosts,
  mockForumComments,
  mockForumConversations,
  mockForumDirectMessages,
  toggleLikePost,
  toggleBookmarkPost,
  toggleFollowUser,
  publishNewPost,
  addComment,
  sendDirectMessage
} = useForum()

// 推荐作者列表
const recommendedUsers = computed(() => Object.values(mockForumUsers))

// 当前活跃详情帖子（若在详情页）
const activeDetailPost = computed(() => {
  if (currentRoute.value.name === 'post_detail') {
    return mockForumPosts.value.find(p => p.id === (currentRoute.value as any).postId) || mockForumPosts.value[0]
  }
  return mockForumPosts.value[0]
})

// 当前活跃详情评论
const activeDetailComments = computed(() => {
  if (activeDetailPost.value) {
    return mockForumComments.value[activeDetailPost.value.id] || []
  }
  return []
})

// 当前活跃他人主页用户
const activeProfileUser = computed(() => {
  if (currentRoute.value.name === 'user_profile') {
    const uid = (currentRoute.value as any).userId
    return mockForumUsers[uid] || (currentForumUser.value.id === uid ? currentForumUser.value : mockForumUsers.user_lin)
  }
  return currentForumUser.value
})

// 当前私聊对象与消息
const activeChatUser = computed(() => {
  if (currentRoute.value.name === 'chat_room') {
    const uid = (currentRoute.value as any).userId
    return mockForumUsers[uid] || mockForumUsers.user_lin
  }
  return mockForumUsers.user_lin
})

const activeChatMessages = computed(() => {
  if (activeChatUser.value) {
    return mockForumDirectMessages.value[activeChatUser.value.id] || []
  }
  return []
})

// 点击帖子 -> 进入详情页
const handleOpenPost = (post: ForumPost) => {
  pushRoute({ name: 'post_detail', postId: post.id })
}

// 点击用户 -> 进入个人主页
const handleOpenUser = (user: ForumUser) => {
  pushRoute({ name: 'user_profile', userId: user.id })
}

// 点击话题 -> 进入搜索页
const handleOpenTopic = (topicTag: string) => {
  pushRoute({ name: 'search' })
}

// 点击私信 -> 进入私聊页
const handleOpenChat = (user: ForumUser) => {
  pushRoute({ name: 'chat_room', userId: user.id })
}

// 点击发布
const handleOpenPublish = () => {
  pushRoute({ name: 'publish' })
}

// 点击搜索
const handleOpenSearch = () => {
  pushRoute({ name: 'search' })
}
</script>

<template>
  <div
    class="forum-app-container"
    :class="{ 'is-dark': globalSettings.darkMode, 'is-light': !globalSettings.darkMode }"
  >
    <!-- 主界面视口 -->
    <div class="forum-main-viewport">
      <!-- 1. 帖子详情页 -->
      <ForumPostDetailView
        v-if="currentRoute.name === 'post_detail'"
        :post="activeDetailPost"
        :comments="activeDetailComments"
        @back="popRoute"
        @click-user="handleOpenUser"
        @click-topic="handleOpenTopic"
        @like="toggleLikePost(activeDetailPost.id)"
        @bookmark="toggleBookmarkPost(activeDetailPost.id)"
        @send-comment="(content, replyTo) => addComment(activeDetailPost.id, content, replyTo)"
      />

      <!-- 2. 他人/个人主页栈视图 -->
      <ForumProfileView
        v-else-if="currentRoute.name === 'user_profile'"
        :user="activeProfileUser"
        :posts="mockForumPosts"
        :is-self="activeProfileUser.id === currentForumUser.id"
        :show-back="true"
        @back="popRoute"
        @toggle-follow="uid => toggleFollowUser(uid)"
        @send-dm="u => handleOpenChat(u)"
        @click-post="handleOpenPost"
        @click-topic="handleOpenTopic"
        @like="p => toggleLikePost(p.id)"
        @bookmark="p => toggleBookmarkPost(p.id)"
      />

      <!-- 3. 私聊会话详情页 -->
      <ForumChatRoomView
        v-else-if="currentRoute.name === 'chat_room'"
        :target-user="activeChatUser"
        :messages="activeChatMessages"
        @back="popRoute"
        @click-user="handleOpenUser"
        @send="content => sendDirectMessage(activeChatUser.id, content)"
      />

      <!-- 4. 发动态页面 -->
      <ForumPublishView
        v-else-if="currentRoute.name === 'publish'"
        :current-user="currentForumUser"
        @back="popRoute"
        @publish="data => publishNewPost(data)"
      />

      <!-- 5. 搜索页面 -->
      <ForumSearchView
        v-else-if="currentRoute.name === 'search'"
        :posts="mockForumPosts"
        :topics="mockForumTopics"
        :users="recommendedUsers"
        @back="popRoute"
        @click-post="handleOpenPost"
        @click-user="handleOpenUser"
        @click-topic="handleOpenTopic"
        @toggle-follow="uid => toggleFollowUser(uid)"
        @like="p => toggleLikePost(p.id)"
        @bookmark="p => toggleBookmarkPost(p.id)"
      />

      <!-- 6. 底部 4 大 Tab 路由切换 -->
      <template v-else>
        <!-- 首页动态 -->
        <ForumFeedView
          v-if="activeTab === 'feed'"
          :posts="mockForumPosts"
          @back="emit('close')"
          @click-post="handleOpenPost"
          @click-user="handleOpenUser"
          @click-topic="handleOpenTopic"
          @like="p => toggleLikePost(p.id)"
          @bookmark="p => toggleBookmarkPost(p.id)"
          @comment="p => handleOpenPost(p)"
          @open-search="handleOpenSearch"
        />

        <!-- 发现页 -->
        <ForumDiscoverView
          v-else-if="activeTab === 'discover'"
          :topics="mockForumTopics"
          :recommended-users="recommendedUsers"
          @back="emit('close')"
          @click-topic="handleOpenTopic"
          @click-user="handleOpenUser"
          @toggle-follow="uid => toggleFollowUser(uid)"
          @open-search="handleOpenSearch"
        />

        <!-- 私信消息列表 -->
        <ForumMessagesView
          v-else-if="activeTab === 'messages'"
          :conversations="mockForumConversations"
          @back="emit('close')"
          @click-chat="handleOpenChat"
          @click-user="handleOpenUser"
        />

        <!-- 我的个人主页 -->
        <ForumProfileView
          v-else-if="activeTab === 'profile'"
          :user="currentForumUser"
          :posts="mockForumPosts"
          :is-self="true"
          :show-back="true"
          @back="emit('close')"
          @click-post="handleOpenPost"
          @click-topic="handleOpenTopic"
          @like="p => toggleLikePost(p.id)"
          @bookmark="p => toggleBookmarkPost(p.id)"
        />
      </template>
    </div>

    <!-- 底部微质感导航栏（仅在顶层 Tab 时显示） -->
    <ForumBottomNav
      v-if="currentRoute.name === 'tab'"
      :active-tab="activeTab"
      :unread-messages-count="1"
      @select-tab="t => resetToTab(t)"
      @click-publish="handleOpenPublish"
    />
  </div>
</template>

<style scoped>
.forum-app-container {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: var(--sys-bg-primary, #f5f5f7);
  color: var(--text-primary, #333333);
  z-index: 1000;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
}

.forum-main-viewport {
  flex: 1;
  width: 100%;
  height: 100%;
  position: relative;
  overflow: hidden;
}
</style>
