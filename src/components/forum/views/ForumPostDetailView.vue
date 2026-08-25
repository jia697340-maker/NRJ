/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { ref, computed } from 'vue'
import type { ForumPost, ForumComment, ForumUser, ForumMediaItem, ForumQuoteContent, ForumCommentGenerationMode, ForumReplyTimingMode } from '../../../types/forum'
import ForumHeader from '../components/ForumHeader.vue'
import ForumFeedItem from '../components/ForumFeedItem.vue'
import ForumCommentItem from '../components/ForumCommentItem.vue'
import ForumEmptyState from '../components/ForumEmptyState.vue'

const props = defineProps<{
  post: ForumPost
  comments: ForumComment[]
  busy?: boolean
  error?: string
}>()

const emit = defineEmits<{
  (e: 'back'): void
  (e: 'click-user', user: ForumUser): void
  (e: 'click-topic', topic: string): void
  (e: 'preview-image', index: number, media: ForumMediaItem[]): void
  (e: 'click-quote', quote: ForumQuoteContent): void
  (e: 'like', post: ForumPost): void
  (e: 'bookmark', post: ForumPost): void
  (e: 'share', post: ForumPost): void
  (e: 'send-comment', content: string, replyTo?: ForumComment, options?: { generateReply: boolean; timing: ForumReplyTimingMode }): void
  (e: 'generate-comments', mode: ForumCommentGenerationMode, count: number): void
  (e: 'adjust-pending', commentId: string, minutes?: number): void
}>()

const replyInput = ref('')
const replyingTarget = ref<ForumComment | null>(null)
const showGenerator = ref(false)
const generateTargetReply = ref(true)
const presenceAware = ref(false)

const handleReply = (comment: ForumComment) => {
  replyingTarget.value = comment
}

const cancelReplyTarget = () => {
  replyingTarget.value = null
}

const submitComment = () => {
  const text = replyInput.value.trim()
  if (!text) return
  emit('send-comment', text, replyingTarget.value || undefined, { generateReply: Boolean(replyingTarget.value && generateTargetReply.value), timing: presenceAware.value ? 'presence-aware' : 'immediate' })
  replyInput.value = ''
  replyingTarget.value = null
}
</script>

<template>
  <div class="forum-post-detail-view">
    <ForumHeader title="动态正文" show-back @back="emit('back')"><template #right><button class="generate-reply-btn" :disabled="busy" @click="showGenerator=!showGenerator">{{busy?'生成中':'刷新评论'}}</button></template></ForumHeader>
    <section v-if="showGenerator" class="comment-generator" aria-label="手动生成评论"><div><b>生成几条评论</b><button type="button" aria-label="关闭" @click="showGenerator=false">×</button></div><p>只在点击后调用一次 API。覆盖不会删除你的评论和已发生的互动。</p><div class="generator-actions"><button type="button" :disabled="busy" @click="emit('generate-comments','incremental',3);showGenerator=false">增量 3 条</button><button type="button" :disabled="busy" @click="emit('generate-comments','incremental',5);showGenerator=false">增量 5 条</button><button class="replace" type="button" :disabled="busy" @click="emit('generate-comments','replace-generated',3);showGenerator=false">覆盖 AI 评论</button></div></section>

    <!-- 滚动容器：主贴内容 + 评论区 -->
    <div class="detail-scroll-wrap">
      <!-- 帖子主体 -->
      <ForumFeedItem
        :post="post"
        :is-detail="true"
        @click-user="u => emit('click-user', u)"
        @click-topic="t => emit('click-topic', t)"
        @preview-image="(i, m) => emit('preview-image', i, m)"
        @click-quote="q => emit('click-quote', q)"
        @like="p => emit('like', p)"
        @bookmark="p => emit('bookmark', p)"
        @share="p => emit('share', p)"
      />

      <!-- 分隔区域 -->
      <div class="comments-section-header">
        <span class="section-title">全部评论 ({{ post.commentCount }})</span>
      </div>
      <p v-if="error" class="detail-generation-error">{{error}}</p>

      <!-- 评论列表 -->
      <div v-if="comments && comments.length > 0" class="comments-list">
        <ForumCommentItem
          v-for="c in comments"
          :key="c.id"
          :comment="c"
          @click-user="u => emit('click-user', u)"
          @reply="handleReply"
          @reveal-pending="id => emit('adjust-pending', id)"
          @delay-pending="(id, minutes) => emit('adjust-pending', id, minutes)"
          @like="() => { c.isLiked = !c.isLiked; c.likeCount += c.isLiked ? 1 : -1 }"
        />
      </div>
      <ForumEmptyState
        v-else
        title="暂无评论"
        description="快来发表第一条评论吧"
      />
    </div>

    <!-- 底部固钉评论输入框 -->
    <div class="detail-comment-bar">
      <div v-if="replyingTarget" class="reply-indicator">
        <span>回复 @{{ replyingTarget.author.name }}</span>
        <button class="cancel-reply-btn" type="button" @click="cancelReplyTarget">×</button>
      </div>
      <div v-if="replyingTarget" class="reply-generation-options"><label><input v-model="generateTargetReply" type="checkbox"><span>发送后生成对方回应</span></label><label :class="{disabled:!generateTargetReply}"><input v-model="presenceAware" type="checkbox" :disabled="!generateTargetReply"><span>结合在线状态，允许稍后显示</span></label></div>
      <div class="input-row">
        <input
          v-model="replyInput"
          type="text"
          :placeholder="replyingTarget ? `回复 @${replyingTarget.author.name}...` : '说点什么吧...'"
          class="comment-input"
          @keyup.enter="submitComment"
        />
        <button
          class="send-btn"
          :disabled="!replyInput.trim()"
          type="button"
          @click="submitComment"
        >
          发送
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.forum-post-detail-view {
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--sys-bg-primary, #f5f5f7);
}

.detail-scroll-wrap {
  flex: 1;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

.comments-section-header {
  padding: 12px 16px 8px;
  background: var(--sys-bg-primary, #f5f5f7);
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary, #666666);
}

.comments-list {
  background: var(--sys-bg-secondary, #ffffff);
}

.detail-comment-bar {
  background: var(--sys-bg-secondary, #ffffff);
  border-top: 1px solid var(--border-color, rgba(0, 0, 0, 0.08));
  padding: 10px 14px;
  padding-bottom: max(10px, env(safe-area-inset-bottom));
}

.reply-indicator {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 11.5px;
  color: var(--accent-color, #2b7de9);
  margin-bottom: 6px;
  padding: 2px 8px;
  background: rgba(43, 125, 233, 0.08);
  border-radius: 6px;
}

.cancel-reply-btn {
  background: transparent;
  border: 0;
  font-size: 15px;
  color: inherit;
  cursor: pointer;
  padding: 0 4px;
}

.input-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.comment-input {
  flex: 1;
  border: 1px solid var(--border-color, rgba(0, 0, 0, 0.1));
  border-radius: 999px;
  padding: 8px 14px;
  font-size: 14px;
  background: var(--sys-bg-tertiary, #f0f2f5);
  color: var(--text-primary, #222222);
  outline: none;
}

.comment-input:focus {
  border-color: var(--accent-color, #2b7de9);
  background: var(--sys-bg-secondary, #ffffff);
}

.send-btn {
  background: var(--text-primary, #111111);
  color: var(--sys-bg-secondary, #ffffff);
  border: 0;
  border-radius: 999px;
  padding: 7px 16px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.15s ease, transform 0.12s ease;
}

.send-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.send-btn:not(:disabled):active {
  transform: scale(0.94);
}
.generate-reply-btn{height:27px;border:0;border-radius:999px;background:var(--sys-bg-tertiary,#eef0f2);color:var(--text-secondary,#666);padding:0 9px;font-size:10.5px}.generate-reply-btn:disabled{opacity:.4}.detail-generation-error{margin:0;padding:7px 16px;background:color-mix(in srgb,#d44c4c 7%,var(--sys-bg-secondary,#fff));color:#c24a4a;font-size:10.5px;line-height:1.4}
.comment-generator{position:absolute;z-index:20;top:54px;left:12px;right:12px;padding:11px;border:1px solid var(--border-color,rgba(0,0,0,.08));border-radius:12px;background:var(--sys-bg-secondary,#fff);box-shadow:0 9px 30px rgba(0,0,0,.12)}.comment-generator>div:first-child{display:flex;align-items:center;justify-content:space-between}.comment-generator b{font-size:12.5px}.comment-generator>div:first-child button{width:25px;height:25px;border:0;background:transparent;color:var(--text-secondary,#777);font-size:18px}.comment-generator p{margin:5px 0 9px;color:var(--text-tertiary,#999);font-size:9.8px;line-height:1.45}.generator-actions{display:grid;grid-template-columns:1fr 1fr 1.2fr;gap:5px}.generator-actions button{height:31px;border:0;border-radius:8px;background:var(--sys-bg-primary,#f0f1f3);color:var(--text-secondary,#666);font-size:10.5px}.generator-actions .replace{color:#b14a4a}.reply-generation-options{display:flex;flex-wrap:wrap;gap:6px 12px;margin:0 5px 7px}.reply-generation-options label{display:flex;align-items:center;gap:4px;color:var(--text-secondary,#666);font-size:9.8px}.reply-generation-options label.disabled{opacity:.45}.reply-generation-options input{width:13px;height:13px;margin:0;accent-color:var(--accent-color,#576b95)}
</style>
