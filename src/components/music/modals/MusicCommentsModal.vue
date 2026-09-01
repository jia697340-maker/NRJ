/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { ref, watch } from 'vue'
import { useMusicLibrary } from '../../../composables/useMusicLibrary'
import type { MusicComment, MusicTrack } from '../../../types/music'

const props = defineProps<{ visible: boolean; track: MusicTrack | null }>()
const emit = defineEmits<{ (e: 'close'): void; (e: 'updateTotal', total: number): void }>()
const { loadComments } = useMusicLibrary()

const hotComments = ref<MusicComment[]>([])
const comments = ref<MusicComment[]>([])
const total = ref(0)
const page = ref(1)
const hasMore = ref(false)
const isStale = ref(false)
const loading = ref(false)
const error = ref('')
let requestVersion = 0

// 本地暂存点赞状态与数量
const likedCommentIds = ref<Set<number | string>>(new Set())

const toggleLikeComment = (comment: MusicComment) => {
  const cid = comment.id
  if (likedCommentIds.value.has(cid)) {
    likedCommentIds.value.delete(cid)
    if (typeof comment.likedCount === 'number') {
      comment.likedCount = Math.max(0, comment.likedCount - 1)
    }
  } else {
    likedCommentIds.value.add(cid)
    if (typeof comment.likedCount === 'number') {
      comment.likedCount += 1
    } else {
      comment.likedCount = 1
    }
  }
}

const formatCommentCount = (count?: number) => {
  if (!count || count <= 0) return ''
  if (count >= 100000) return `${(count / 10000).toFixed(1).replace(/\.0$/, '')}w`
  if (count >= 10000) return `${(count / 10000).toFixed(1).replace(/\.0$/, '')}w`
  return count.toLocaleString()
}

const formatCommentTime = (comment: MusicComment) => {
  if (comment.timeText) return comment.timeText
  if (!comment.time) return ''
  const date = new Date(comment.time)
  const sameYear = date.getFullYear() === new Date().getFullYear()
  return new Intl.DateTimeFormat('zh-CN', sameYear
    ? { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }
    : { year: 'numeric', month: 'numeric', day: 'numeric' }).format(date)
}

const loadPage = async (nextPage: number, append = false) => {
  if (!props.track || loading.value) return
  const version = ++requestVersion
  loading.value = true
  error.value = ''
  try {
    const result = await loadComments(props.track, nextPage)
    if (version !== requestVersion) return
    total.value = result.total
    emit('updateTotal', result.total)
    hotComments.value = nextPage === 1 ? result.hotComments : hotComments.value
    comments.value = append ? [...comments.value, ...result.comments] : result.comments
    page.value = nextPage
    hasMore.value = result.more
    isStale.value = result.stale === true
  } catch (reason) {
    if (version === requestVersion) error.value = reason instanceof Error ? reason.message : '评论加载失败'
  } finally {
    if (version === requestVersion) loading.value = false
  }
}

watch(() => [props.visible, props.track?.id] as const, ([visible]) => {
  if (!visible) { requestVersion += 1; return }
  hotComments.value = []; comments.value = []; total.value = 0; page.value = 1; hasMore.value = false; isStale.value = false; error.value = ''
  void loadPage(1)
}, { immediate: true })
</script>

<template>
  <transition name="comment-slide">
    <div v-if="visible" class="comments-fullscreen-container" role="dialog" aria-modal="true" aria-label="歌曲评论">
      <!-- 顶部固定高质感导航栏 -->
      <header class="comments-header">
        <button class="nav-back-btn" title="返回" @click="emit('close')">
          <svg viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
        </button>

        <div class="header-center">
          <div class="title-wrap">
            <span class="main-title">评论</span>
            <span v-if="total > 0" class="total-tag">{{ total }}</span>
          </div>
          <div class="track-sub-text">
            <span class="track-title-text">{{ track?.title || '未知曲目' }}</span>
            <span class="sub-sep">-</span>
            <span class="track-artist-text">{{ track?.artist || '网易云音乐' }}</span>
          </div>
        </div>

        <button class="nav-refresh-btn" title="刷新" :disabled="loading" @click="loadPage(1)">
          <svg class="refresh-svg" :class="{ 'is-spinning': loading }" viewBox="0 0 24 24" width="19" height="19" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
          </svg>
        </button>
      </header>

      <!-- 评论主体滚动区 -->
      <main class="comments-body">
        <!-- 歌曲顶部信息卡片 -->
        <div v-if="track" class="song-card-header">
          <div class="song-cover" :style="track.coverUrl ? { backgroundImage: `url(${track.coverUrl})` } : {}">
            <div v-if="!track.coverUrl" class="song-cover-fallback">
              <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none">
                <path d="M9 18V5l12-2v13" />
                <circle cx="6" cy="18" r="3" />
                <circle cx="18" cy="16" r="3" />
              </svg>
            </div>
          </div>
          <div class="song-info">
            <div class="song-name">{{ track.title }}</div>
            <div class="song-singer">{{ track.artist }}</div>
          </div>
          <span class="source-badge">网易云真实评论</span>
        </div>

        <!-- 初始全屏加载状态 -->
        <div v-if="loading && !comments.length && !hotComments.length" class="state-panel">
          <div class="loading-ring"></div>
          <span class="state-text">正在获取精选评论…</span>
        </div>

        <!-- 初始错误状态 -->
        <div v-else-if="error && !comments.length && !hotComments.length" class="state-panel error-panel">
          <div class="state-icon-wrap">
            <svg viewBox="0 0 24 24" width="28" height="28" stroke="currentColor" stroke-width="2" fill="none">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
          </div>
          <p class="state-desc">{{ error }}</p>
          <button class="retry-action-btn" @click="loadPage(1)">重新加载</button>
        </div>

        <template v-else>
          <!-- 缓存离线提示 -->
          <div v-if="isStale" class="cache-notice-bar">
            <svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="2" fill="none">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            <span>云端暂时不可用，已自动显示最近缓存的真实评论</span>
          </div>

          <!-- 热门评论板块 -->
          <section v-if="hotComments.length" class="comment-section hot-section">
            <div class="section-badge-row">
              <div class="badge-tag hot-tag">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                  <path d="M12 23c4.97 0 9-4.03 9-9 0-4.06-2.69-7.5-6.42-8.59-.44-.13-.77.34-.51.69 1.15 1.54 1.76 3.39 1.76 5.31 0 .28-.02.55-.07.82-.09.47-.63.7-1.02.43-1.63-1.12-2.74-2.98-2.74-5.11 0-1.89.87-3.62 2.25-4.82.35-.31.14-.88-.33-.91C13.2 1.76 12.61 1.7 12 1.7c-5.52 0-10 4.48-10 10 0 6.24 5.06 11.3 10 11.3z"/>
                </svg>
                <span>热门评论</span>
              </div>
            </div>

            <article v-for="comment in hotComments" :key="`hot-${comment.id}`" class="comment-row">
              <div class="avatar-box">
                <img v-if="comment.user.avatarUrl" :src="comment.user.avatarUrl" class="avatar-img" alt="" referrerpolicy="no-referrer" loading="lazy" />
                <div v-else class="avatar-img avatar-default">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                  </svg>
                </div>
              </div>

              <div class="comment-detail">
                <div class="meta-row">
                  <div class="user-info">
                    <span class="user-nickname">{{ comment.user.nickname }}</span>
                    <span class="publish-time">{{ formatCommentTime(comment) }}</span>
                  </div>

                  <!-- 大号爱心点赞按键 (无 Emoji，纯矢量) -->
                  <button
                    class="like-action-btn"
                    :class="{ 'is-active': likedCommentIds.has(comment.id) }"
                    title="点赞"
                    @click="toggleLikeComment(comment)"
                  >
                    <span v-if="comment.likedCount" class="count-num">{{ formatCommentCount(comment.likedCount) }}</span>
                    <svg class="heart-svg" viewBox="0 0 24 24" width="20" height="20">
                      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                    </svg>
                  </button>
                </div>

                <p class="content-paragraph">{{ comment.content }}</p>

                <div v-if="comment.reply" class="quote-reply-box">
                  <span class="quote-user">@{{ comment.reply.nickname }}：</span>
                  <span class="quote-text">{{ comment.reply.content }}</span>
                </div>
              </div>
            </article>
          </section>

          <!-- 最新评论板块 -->
          <section class="comment-section latest-section">
            <div class="section-badge-row">
              <div class="badge-tag latest-tag">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                </svg>
                <span>最新评论</span>
              </div>
            </div>

            <div v-if="!comments.length && !hotComments.length" class="empty-panel">
              <div class="empty-icon-wrap">
                <svg viewBox="0 0 24 24" width="36" height="36" stroke="currentColor" stroke-width="1.5" fill="none">
                  <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
                </svg>
              </div>
              <p>这首歌暂时还没有评论</p>
            </div>

            <article v-for="comment in comments" :key="comment.id" class="comment-row">
              <div class="avatar-box">
                <img v-if="comment.user.avatarUrl" :src="comment.user.avatarUrl" class="avatar-img" alt="" referrerpolicy="no-referrer" loading="lazy" />
                <div v-else class="avatar-img avatar-default">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                  </svg>
                </div>
              </div>

              <div class="comment-detail">
                <div class="meta-row">
                  <div class="user-info">
                    <span class="user-nickname">{{ comment.user.nickname }}</span>
                    <span class="publish-time">{{ formatCommentTime(comment) }}</span>
                  </div>

                  <!-- 大号爱心点赞按键 (无 Emoji，纯矢量) -->
                  <button
                    class="like-action-btn"
                    :class="{ 'is-active': likedCommentIds.has(comment.id) }"
                    title="点赞"
                    @click="toggleLikeComment(comment)"
                  >
                    <span v-if="comment.likedCount" class="count-num">{{ formatCommentCount(comment.likedCount) }}</span>
                    <svg class="heart-svg" viewBox="0 0 24 24" width="20" height="20">
                      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                    </svg>
                  </button>
                </div>

                <p class="content-paragraph">{{ comment.content }}</p>

                <div v-if="comment.reply" class="quote-reply-box">
                  <span class="quote-user">@{{ comment.reply.nickname }}：</span>
                  <span class="quote-text">{{ comment.reply.content }}</span>
                </div>
              </div>
            </article>
          </section>

          <!-- 底部加载更多 -->
          <div class="list-footer-area">
            <div v-if="error" class="error-tip">{{ error }}</div>
            <button v-if="hasMore" class="load-more-action" :disabled="loading" @click="loadPage(page + 1, true)">
              <span v-if="loading" class="spin-circle"></span>
              <span>{{ loading ? '正在加载…' : '加载更多评论' }}</span>
            </button>
            <div v-else-if="comments.length || hotComments.length" class="end-text">
              已显示全部评论
            </div>
          </div>
        </template>
      </main>
    </div>
  </transition>
</template>

<style scoped>
.comments-fullscreen-container {
  position: absolute;
  inset: 0;
  z-index: 1200;
  display: flex;
  flex-direction: column;
  background: var(--music-card-bg, #ffffff);
  color: var(--music-text, #1c1c1e);
  overflow: hidden;
  user-select: text;
}

/* 顶部固定导航栏 */
.comments-header {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 56px;
  padding: 0 8px;
  background: var(--music-card-bg, #ffffff);
  border-bottom: 1px solid var(--music-divider, rgba(0, 0, 0, 0.08));
  z-index: 10;
}

.nav-back-btn,
.nav-refresh-btn {
  width: 42px;
  height: 42px;
  border-radius: 50%;
  border: none;
  background: transparent;
  color: var(--music-text, #1c1c1e);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background-color 0.2s, transform 0.15s;
  flex-shrink: 0;
}

.nav-back-btn:active,
.nav-refresh-btn:active {
  background: var(--music-btn-active, rgba(0, 0, 0, 0.06));
  transform: scale(0.92);
}

.header-center {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 0 6px;
  text-align: center;
}

.title-wrap {
  display: flex;
  align-items: center;
  gap: 6px;
}

.main-title {
  font-size: 16px;
  font-weight: 700;
  letter-spacing: -0.2px;
  color: var(--music-text, #1c1c1e);
}

.total-tag {
  font-size: 11px;
  font-weight: 600;
  color: var(--music-text-sub, #8e8e93);
}

.track-sub-text {
  display: flex;
  align-items: center;
  gap: 4px;
  max-width: 240px;
  margin-top: 2px;
  font-size: 11px;
  color: var(--music-text-sub, #8e8e93);
}

.track-title-text {
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sub-sep {
  opacity: 0.6;
}

.track-artist-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  opacity: 0.85;
}

.refresh-svg.is-spinning {
  animation: spin 0.8s linear infinite;
}

/* 滚动区 */
.comments-body {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 14px 16px calc(24px + env(safe-area-inset-bottom, 0));
  -webkit-overflow-scrolling: touch;
  background: var(--music-bg, #ffffff);
}

/* 歌曲横卡片 */
.song-card-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  margin-bottom: 18px;
  border-radius: 12px;
  background: var(--music-secondary-bg, #f5f6fa);
  border: 1px solid var(--music-card-border, rgba(0, 0, 0, 0.05));
}

.song-cover {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  background-size: cover;
  background-position: center;
  background-color: var(--music-pill-bg, #eee);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.song-cover-fallback {
  color: var(--music-text-sub, #8e8e93);
}

.song-info {
  flex: 1;
  min-width: 0;
}

.song-name {
  font-size: 13.5px;
  font-weight: 600;
  color: var(--music-text, #1c1c1e);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.song-singer {
  font-size: 11px;
  color: var(--music-text-sub, #8e8e93);
  margin-top: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.source-badge {
  font-size: 10px;
  font-weight: 600;
  padding: 3px 8px;
  border-radius: 6px;
  background: rgba(239, 68, 68, 0.08);
  color: #ef4444;
  flex-shrink: 0;
}

/* 状态展示 */
.state-panel {
  min-height: 240px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: var(--music-text-sub, #8e8e93);
}

.loading-ring {
  width: 28px;
  height: 28px;
  border: 2.5px solid var(--music-divider, rgba(0, 0, 0, 0.1));
  border-top-color: #ef4444;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.state-text {
  font-size: 12.5px;
}

.error-panel .state-icon-wrap {
  color: #ef4444;
}

.state-desc {
  font-size: 12px;
  max-width: 260px;
  text-align: center;
  line-height: 1.5;
  margin: 0;
}

.retry-action-btn {
  padding: 8px 20px;
  border-radius: 20px;
  border: 1px solid var(--music-card-border, rgba(0, 0, 0, 0.1));
  background: var(--music-card-bg, #ffffff);
  color: var(--music-text, #1c1c1e);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.05);
}

.cache-notice-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 12px;
  margin-bottom: 14px;
  border-radius: 10px;
  background: rgba(245, 158, 11, 0.1);
  color: #d97706;
  font-size: 11.5px;
  line-height: 1.4;
}

/* 分区标题 */
.comment-section {
  margin-bottom: 22px;
}

.section-badge-row {
  display: flex;
  align-items: center;
  margin-bottom: 10px;
}

.badge-tag {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 13px;
  font-weight: 700;
  color: var(--music-text, #1c1c1e);
}

.hot-tag {
  color: #ef4444;
}

.latest-tag {
  color: var(--music-text, #1c1c1e);
}

/* 单条评论 */
.comment-row {
  display: flex;
  gap: 12px;
  padding: 13px 0;
  border-bottom: 1px solid var(--music-divider, rgba(0, 0, 0, 0.06));
}

.avatar-box {
  flex-shrink: 0;
}

.avatar-img {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  object-fit: cover;
  border: 1px solid var(--music-card-border, rgba(0, 0, 0, 0.08));
}

.avatar-default {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--music-pill-bg, #f0f2f5);
  color: var(--music-text-sub, #8e8e93);
}

.comment-detail {
  flex: 1;
  min-width: 0;
}

.meta-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}

.user-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.user-nickname {
  font-size: 13px;
  font-weight: 600;
  color: var(--music-text, #1c1c1e);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.publish-time {
  font-size: 10px;
  color: var(--music-text-muted, #9ca3af);
}

/* 大号矢量红心点赞组件 */
.like-action-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 6px;
  border: none;
  background: transparent;
  color: var(--music-text-muted, #9ca3af);
  cursor: pointer;
  border-radius: 8px;
  transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
  flex-shrink: 0;
}

.like-action-btn:active {
  transform: scale(0.88);
}

.count-num {
  font-size: 12px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
}

.heart-svg {
  fill: transparent;
  stroke: currentColor;
  stroke-width: 2;
  transition: fill 0.2s, stroke 0.2s, transform 0.2s;
}

.like-action-btn.is-active {
  color: #ef4444;
}

.like-action-btn.is-active .heart-svg {
  fill: #ef4444;
  stroke: #ef4444;
  transform: scale(1.12);
}

.content-paragraph {
  margin: 7px 0 0;
  font-size: 13.5px;
  line-height: 1.6;
  color: var(--music-text, #27272a);
  word-break: break-word;
  white-space: pre-wrap;
}

/* 引用回复卡片 */
.quote-reply-box {
  margin: 8px 0 0;
  padding: 8px 10px;
  background: var(--music-secondary-bg, #f5f6fa);
  border-radius: 8px;
  border-left: 3px solid rgba(239, 68, 68, 0.4);
  font-size: 11.5px;
  line-height: 1.5;
}

.quote-user {
  font-weight: 600;
  color: var(--music-text-sub, #6b7280);
}

.quote-text {
  color: var(--music-text, #374151);
  word-break: break-word;
}

/* 空状态 */
.empty-panel {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 0;
  color: var(--music-text-muted, #9ca3af);
  font-size: 13px;
  gap: 10px;
}

.empty-icon-wrap {
  color: var(--music-text-muted, #9ca3af);
}

/* 底部加载 */
.list-footer-area {
  padding: 16px 0 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
}

.load-more-action {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 9px 22px;
  border-radius: 999px;
  border: 1px solid var(--music-card-border, rgba(0, 0, 0, 0.1));
  background: var(--music-pill-bg, #f3f4f6);
  color: var(--music-text, #1f2937);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.load-more-action:hover {
  background: var(--music-secondary-bg, #e5e7eb);
}

.load-more-action:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.spin-circle {
  width: 13px;
  height: 13px;
  border: 2px solid var(--music-divider, rgba(0,0,0,0.1));
  border-top-color: var(--music-text, #1f2937);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.end-text {
  font-size: 11px;
  color: var(--music-text-muted, #9ca3af);
}

.error-tip {
  font-size: 11px;
  color: #ef4444;
  text-align: center;
}

/* 动效 */
.comment-slide-enter-active,
.comment-slide-leave-active {
  transition: opacity 0.22s ease, transform 0.22s cubic-bezier(0.16, 1, 0.3, 1);
}

.comment-slide-enter-from,
.comment-slide-leave-to {
  opacity: 0;
  transform: translateY(16px);
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
