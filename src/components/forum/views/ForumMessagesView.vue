/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import type { ForumConversation, ForumUser } from '../../../types/forum'
import ForumHeader from '../components/ForumHeader.vue'
import ForumAvatar from '../components/ForumAvatar.vue'
import ForumEmptyState from '../components/ForumEmptyState.vue'

withDefaults(
  defineProps<{
    conversations: ForumConversation[]
  }>(),
  {}
)

const emit = defineEmits<{
  (e: 'back'): void
  (e: 'click-chat', user: ForumUser): void
  (e: 'click-user', user: ForumUser): void
}>()
</script>

<template>
  <div class="forum-messages-view">
    <ForumHeader title="私信消息" show-back @back="emit('back')" />

    <div class="messages-list-wrap">
      <template v-if="conversations && conversations.length > 0">
        <div
          v-for="conv in conversations"
          :key="conv.id"
          class="conversation-row"
          @click="emit('click-chat', conv.user)"
        >
          <div class="avatar-col">
            <ForumAvatar
              :src="conv.user.avatar"
              :name="conv.user.name"
              :verified="conv.user.verified"
              size="md"
              clickable
              @click.stop="emit('click-user', conv.user)"
            />
            <span v-if="conv.unreadCount > 0" class="unread-badge">
              {{ conv.unreadCount }}
            </span>
          </div>

          <div class="info-col">
            <div class="info-top">
              <span class="user-name">{{ conv.user.name }}</span>
              <span class="msg-time">{{ conv.lastMessageTime }}</span>
            </div>
            <div class="info-bottom">
              <span class="last-msg-text">{{ conv.lastMessage }}</span>
            </div>
          </div>
        </div>
      </template>

      <ForumEmptyState
        v-else
        title="暂无私信"
        description="与感兴趣的创作者和同好开启对话吧"
      />
    </div>
  </div>
</template>

<style scoped>
.forum-messages-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--sys-bg-primary, #f5f5f7);
}

.messages-list-wrap {
  flex: 1;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  background: var(--sys-bg-secondary, #ffffff);
}

.conversation-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-color, rgba(0, 0, 0, 0.05));
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.conversation-row:active {
  background: var(--sys-bg-tertiary, rgba(0, 0, 0, 0.03));
}

.avatar-col {
  position: relative;
  flex-shrink: 0;
}

.unread-badge {
  position: absolute;
  top: -2px;
  right: -2px;
  background: #e0245e;
  color: #ffffff;
  font-size: 10px;
  font-weight: 700;
  min-width: 16px;
  height: 16px;
  border-radius: 999px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 4px;
  border: 2px solid var(--sys-bg-secondary, #ffffff);
}

.info-col {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.info-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.user-name {
  font-size: 14.5px;
  font-weight: 600;
  color: var(--text-primary, #222222);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.msg-time {
  font-size: 11.5px;
  color: var(--text-tertiary, #999999);
}

.info-bottom {
  display: flex;
  align-items: center;
}

.last-msg-text {
  font-size: 13px;
  color: var(--text-secondary, #666666);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
