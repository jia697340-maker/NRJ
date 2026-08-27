/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { ref } from 'vue'
import type { ForumComment, ForumUser } from '../../../types/forum'
import ForumAvatar from './ForumAvatar.vue'
import ForumUserIdentity from './ForumUserIdentity.vue'
import { formatForumTime } from '../../../services/forumTime'

withDefaults(
  defineProps<{
    comment: ForumComment
  }>(),
  {}
)

const emit = defineEmits<{
  (e: 'click-user', user: ForumUser): void
  (e: 'reply', comment: ForumComment): void
  (e: 'like', comment: ForumComment): void
  (e: 'reveal-pending', commentId: string): void
  (e: 'delay-pending', commentId: string, minutes: number): void
}>()
const delayMinutes = ref(10)
</script>

<template>
  <div class="forum-comment-item">
    <div class="comment-avatar-col">
      <ForumAvatar
        :src="comment.author.avatar"
        :name="comment.author.name"
        :verified="comment.author.verified"
        size="sm"
        clickable
        @click="emit('click-user', comment.author)"
      />
    </div>

    <div class="comment-main-col">
      <!-- 用户名与发布时间 -->
      <div class="comment-header-row">
        <ForumUserIdentity
          :user="comment.author"
          :time="comment.createdAt"
          :show-handle="false"
          @click-user="emit('click-user', comment.author)"
        />
        
        <!-- 点赞小按钮 -->
        <button
          class="comment-like-btn"
          :class="{ 'is-liked': comment.isLiked }"
          type="button"
          @click.stop="emit('like', comment)"
        >
          <svg
            viewBox="0 0 24 24"
            width="14"
            height="14"
            :fill="comment.isLiked ? '#e0245e' : 'none'"
            :stroke="comment.isLiked ? '#e0245e' : 'currentColor'"
            stroke-width="1.8"
          >
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
          </svg>
          <span v-if="comment.likeCount > 0" class="like-num">{{ comment.likeCount }}</span>
        </button>
      </div>

      <!-- 评论内容（支持回复谁） -->
      <div class="comment-body-text">
        <span v-if="comment.replyToUser" class="reply-target">
          回复 <strong class="reply-name">@{{ comment.replyToUser.name }}</strong>：
        </span>
        {{ comment.content }}
      </div>

      <!-- 底部回复操作 -->
      <div class="comment-actions">
        <button class="reply-action-btn" type="button" @click="emit('reply', comment)">
          回复
        </button>
        <template v-if="comment.pendingReply"><button class="reply-action-btn pending-action" type="button" @click="emit('reveal-pending', comment.id)">立即显示</button><label class="pending-delay"><input v-model.number="delayMinutes" type="number" min="1" max="1440"><span>分钟</span><button class="reply-action-btn pending-action" type="button" @click="emit('delay-pending', comment.id, delayMinutes)">修改</button></label></template>
      </div>

      <!-- 二级楼中楼子回复列表 -->
      <div v-if="comment.replies && comment.replies.length > 0" class="sub-replies-list">
        <div
          v-for="sub in comment.replies"
          :key="sub.id"
          class="sub-reply-item"
        >
          <ForumAvatar
            :src="sub.author.avatar"
            :name="sub.author.name"
            size="xs"
            clickable
            @click="emit('click-user', sub.author)"
          />
          <div class="sub-reply-content">
            <span class="sub-user-name" @click="emit('click-user', sub.author)">
              {{ sub.author.name }}
            </span>
            <span v-if="sub.replyToUser" class="sub-reply-to">
              回复 @{{ sub.replyToUser.name }}
            </span>：
            <span class="sub-text">{{ sub.content }}</span>
            <div class="sub-meta">
              <span class="sub-time">{{ formatForumTime(sub.createdAt) }}</span>
              <button class="sub-reply-btn" type="button" @click="emit('reply', sub)">回复</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.forum-comment-item {
  display: flex;
  gap: 10px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-color, rgba(0, 0, 0, 0.04));
}

.comment-avatar-col {
  flex-shrink: 0;
}

.comment-main-col {
  flex: 1;
  min-width: 0;
}

.comment-header-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}

.comment-like-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: transparent;
  border: 0;
  color: var(--text-secondary, #888888);
  font-size: 11px;
  cursor: pointer;
  padding: 2px 4px;
}

.comment-like-btn.is-liked {
  color: #e0245e;
}

.comment-body-text {
  margin-top: 4px;
  font-size: 14px;
  line-height: 1.5;
  color: var(--text-primary, #333333);
  word-break: break-word;
}

.reply-target {
  color: var(--text-secondary, #666666);
}

.reply-name {
  font-weight: 600;
  color: var(--text-primary, #222222);
}

.comment-actions {
  margin-top: 6px;
  display:flex;
  gap:10px;
}

.reply-action-btn {
  background: transparent;
  border: 0;
  padding: 0;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary, #777777);
  cursor: pointer;
}

.reply-action-btn:hover {
  color: var(--text-primary, #333333);
}
.pending-action{color:var(--accent-color,#576b95)}
.pending-delay{display:flex;align-items:center;gap:3px;color:var(--text-tertiary,#999);font-size:9px}.pending-delay input{box-sizing:border-box;width:40px;height:21px;border:1px solid var(--border-color,#ddd);border-radius:5px;background:var(--sys-bg-primary,#f5f5f7);color:var(--text-primary,#222);padding:0 3px;font-size:9px}

/* 楼中楼二级回复 */
.sub-replies-list {
  margin-top: 8px;
  padding: 8px 10px;
  background: var(--sys-bg-tertiary, #f6f7f9);
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.sub-reply-item {
  display: flex;
  gap: 8px;
  font-size: 13px;
  line-height: 1.4;
}

.sub-reply-content {
  flex: 1;
  min-width: 0;
}

.sub-user-name {
  font-weight: 600;
  color: var(--text-primary, #333333);
  cursor: pointer;
}

.sub-reply-to {
  color: var(--text-secondary, #777777);
  margin-left: 2px;
}

.sub-text {
  color: var(--text-primary, #444444);
}

.sub-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 2px;
  font-size: 11px;
  color: var(--text-tertiary, #999999);
}

.sub-reply-btn {
  background: transparent;
  border: 0;
  padding: 0;
  font-size: 11px;
  color: var(--text-secondary, #777777);
  cursor: pointer;
}
</style>
