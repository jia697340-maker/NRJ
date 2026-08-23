/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { computed } from 'vue'
import type { ForumPost, ForumUser, ForumMediaItem, ForumQuoteContent } from '../../../types/forum'
import { useForum } from '../../../composables/useForum'
import ForumAvatar from './ForumAvatar.vue'
import ForumUserIdentity from './ForumUserIdentity.vue'
import ForumTopicChip from './ForumTopicChip.vue'
import ForumImageGrid from './ForumImageGrid.vue'
import ForumQuoteCard from './ForumQuoteCard.vue'
import ForumPostActions from './ForumPostActions.vue'
import ForumRichMedia from './ForumRichMedia.vue'

const props = withDefaults(
  defineProps<{
    post: ForumPost
    isDetail?: boolean
  }>(),
  {
    isDetail: false
  }
)
const forum=useForum()
const poll=computed(()=>props.post.pollId?forum.snapshot.value.polls.find(item=>item.id===props.post.pollId):null)
const lottery=computed(()=>props.post.lotteryId?forum.snapshot.value.lotteries.find(item=>item.id===props.post.lotteryId):null)
const lotteryResult=computed(()=>lottery.value?forum.snapshot.value.lotteryResults.find(item=>item.lotteryId===lottery.value?.id):null)
const entered=computed(()=>lottery.value?forum.snapshot.value.lotteryEntries.some(item=>item.lotteryId===lottery.value?.id&&item.accountId===forum.currentAccount.value?.id):false)
const canDraw=computed(()=>lottery.value&&!lottery.value.drawnAt&&lottery.value.drawAt<=Date.now()&&props.post.authorAccountId===forum.currentAccount.value?.id)
const sourceCircle=computed(()=>props.post.circleId?forum.circles.value.find(item=>item.id===props.post.circleId):null)

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
        <button v-if="sourceCircle" class="post-source" type="button" @click.stop="forum.pushRoute({name:'circle',circleId:sourceCircle.id})">来自 {{sourceCircle.name}}</button>
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
        v-if="post.media && post.media.some(item => !['voice','short-video'].includes(item.type || 'image'))"
        :media="post.media.filter(item => !['voice','short-video'].includes(item.type || 'image'))"
        @preview="(index, media) => emit('preview-image', index, media)"
      />

      <ForumRichMedia v-for="item in (post.media || []).filter(media => ['voice','short-video'].includes(media.type || ''))" :key="item.id" :media="item" />

      <div v-if="poll" class="poll-box" @click.stop>
        <button v-for="option in poll.options" :key="option.id" type="button" @click="forum.votePoll(poll.id, option.id)"><span>{{option.label}}</span><em>{{option.votes}} 票</em><i :style="{width:`${Math.round(option.votes/Math.max(1,poll.options.reduce((n,o)=>n+o.votes,0))*100)}%`}"></i></button>
        <small>{{poll.multiple?'多选':'单选'}} · {{poll.anonymous?'匿名投票':'公开投票'}}</small>
      </div>

      <div v-if="lottery" class="lottery-box" @click.stop><span><b>抽奖 · {{lottery.prize}}</b><small>{{lottery.winnerCount}} 个名额 · 本地随机开奖</small></span><button v-if="!lotteryResult&&!canDraw" :disabled="entered" @click="forum.enterLottery(lottery.id)">{{entered?'已参与':'参与'}}</button><button v-else-if="canDraw" @click="forum.drawLottery(lottery.id)">开奖</button><em v-else>已开奖</em></div>

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
  display: flex;
  flex: 1;
  min-width: 0;
  flex-direction: column;
  align-items: flex-start;
}
.post-source{max-width:100%;height:17px;overflow:hidden;border:0;background:transparent;padding:0;color:var(--text-tertiary,#929292);font:inherit;font-size:10px;line-height:17px;white-space:nowrap;text-overflow:ellipsis}

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
.poll-box{display:flex;flex-direction:column;gap:6px;margin-top:9px;padding:9px;border-radius:11px;background:var(--sys-bg-primary,#f4f5f7)}.poll-box button{position:relative;display:flex;min-width:0;align-items:center;justify-content:space-between;gap:8px;height:34px;overflow:hidden;border:1px solid var(--border-color,#e1e3e6);border-radius:8px;background:var(--sys-bg-secondary,#fff);padding:0 9px;color:var(--text-primary,#333);font-size:12px}.poll-box button span,.poll-box button em{position:relative;z-index:1;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}.poll-box button span{min-width:0;flex:1;text-align:left}.poll-box button em{flex:0 0 auto;color:var(--text-tertiary,#999);font-size:10px;font-style:normal}.poll-box button i{position:absolute;inset:0 auto 0 0;background:color-mix(in srgb,var(--accent-color,#576b95) 10%,transparent)}.poll-box>small{font-size:10px;color:var(--text-tertiary,#999)}.lottery-box{display:flex;min-width:0;align-items:center;gap:9px;margin-top:9px;padding:10px;border-radius:11px;background:color-mix(in srgb,#f2b35c 10%,var(--sys-bg-secondary,#fff))}.lottery-box>span{display:flex;min-width:0;flex:1;flex-direction:column;gap:3px}.lottery-box b{overflow:hidden;font-size:12.5px;white-space:nowrap;text-overflow:ellipsis}.lottery-box small{color:var(--text-secondary,#777);font-size:10.5px}.lottery-box button{flex:0 0 auto;height:27px;border:0;border-radius:999px;background:#d99539;color:#fff;padding:0 10px;font-size:11px}.lottery-box button:disabled{opacity:.45}.lottery-box em{color:var(--text-tertiary,#999);font-size:10.5px;font-style:normal}
</style>
