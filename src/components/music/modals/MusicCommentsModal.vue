/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { ref, watch } from 'vue'
import { useMusicLibrary } from '../../../composables/useMusicLibrary'
import type { MusicComment, MusicTrack } from '../../../types/music'

const props = defineProps<{ visible: boolean; track: MusicTrack | null }>()
const emit = defineEmits<{ (e: 'close'): void }>()
const { loadComments } = useMusicLibrary()
const hotComments = ref<MusicComment[]>([])
const comments = ref<MusicComment[]>([])
const total = ref(0)
const page = ref(1)
const hasMore = ref(false)
const loading = ref(false)
const error = ref('')
let requestVersion = 0

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
    hotComments.value = nextPage === 1 ? result.hotComments : hotComments.value
    comments.value = append ? [...comments.value, ...result.comments] : result.comments
    page.value = nextPage
    hasMore.value = result.more
  } catch (reason) {
    if (version === requestVersion) error.value = reason instanceof Error ? reason.message : '评论加载失败'
  } finally {
    if (version === requestVersion) loading.value = false
  }
}

watch(() => [props.visible, props.track?.id] as const, ([visible]) => {
  if (!visible) { requestVersion += 1; return }
  hotComments.value = []; comments.value = []; total.value = 0; page.value = 1; hasMore.value = false; error.value = ''
  void loadPage(1)
}, { immediate: true })
</script>

<template>
  <div v-if="visible" class="comments-mask" @click="emit('close')">
    <section class="comments-sheet" @click.stop>
      <header>
        <div class="header-copy"><strong>评论<span v-if="total">（{{ total }}）</span></strong><small>{{ track?.title }} · 网易云真实评论</small></div>
        <button class="close-btn" aria-label="关闭评论" @click="emit('close')">×</button>
      </header>
      <div class="comments-body">
        <div v-if="loading && !comments.length" class="comments-state"><span class="spinner"></span>正在加载评论…</div>
        <div v-else-if="error && !comments.length" class="comments-state error-state"><span>{{ error }}</span><button @click="loadPage(1)">重新加载</button></div>
        <template v-else>
          <section v-if="hotComments.length" class="comment-section">
            <h3>热门评论</h3>
            <article v-for="comment in hotComments" :key="`hot-${comment.id}`" class="comment-card">
              <img v-if="comment.user.avatarUrl" :src="comment.user.avatarUrl" alt="" referrerpolicy="no-referrer" />
              <span v-else class="avatar-placeholder">云</span>
              <div class="comment-main"><div class="comment-meta"><div><b>{{ comment.user.nickname }}</b><small>{{ formatCommentTime(comment) }}</small></div><span>♡ {{ comment.likedCount || '' }}</span></div><p>{{ comment.content }}</p><blockquote v-if="comment.reply">@{{ comment.reply.nickname }}：{{ comment.reply.content }}</blockquote></div>
            </article>
          </section>
          <section class="comment-section">
            <h3>最新评论</h3>
            <div v-if="!comments.length" class="comments-state">这首歌暂时还没有评论</div>
            <article v-for="comment in comments" :key="comment.id" class="comment-card">
              <img v-if="comment.user.avatarUrl" :src="comment.user.avatarUrl" alt="" referrerpolicy="no-referrer" />
              <span v-else class="avatar-placeholder">云</span>
              <div class="comment-main"><div class="comment-meta"><div><b>{{ comment.user.nickname }}</b><small>{{ formatCommentTime(comment) }}</small></div><span>♡ {{ comment.likedCount || '' }}</span></div><p>{{ comment.content }}</p><blockquote v-if="comment.reply">@{{ comment.reply.nickname }}：{{ comment.reply.content }}</blockquote></div>
            </article>
          </section>
          <div v-if="error" class="load-note">{{ error }}</div>
          <button v-if="hasMore" class="load-more" :disabled="loading" @click="loadPage(page + 1, true)">{{ loading ? '加载中…' : '加载更多评论' }}</button>
          <div v-else-if="comments.length" class="load-note">已经到底了</div>
        </template>
      </div>
    </section>
  </div>
</template>

<style scoped>
.comments-mask{position:absolute;inset:0;z-index:90;display:flex;align-items:flex-end;background:rgba(0,0,0,.44);backdrop-filter:blur(8px)}.comments-sheet{display:flex;width:100%;height:min(82%,720px);flex-direction:column;overflow:hidden;border:1px solid var(--music-card-border);border-radius:22px 22px 0 0;background:var(--music-card-bg);color:var(--music-text)}header{display:flex;align-items:center;justify-content:space-between;padding:17px 18px 14px;border-bottom:1px solid var(--music-divider)}.header-copy{min-width:0}.header-copy strong{display:block;font-size:17px}.header-copy small{display:block;margin-top:4px;overflow:hidden;color:var(--music-text-sub);font-size:10px;text-overflow:ellipsis;white-space:nowrap}.close-btn{width:32px;height:32px;flex:0 0 auto;border:0;border-radius:50%;background:var(--music-pill-bg);color:var(--music-text);font-size:22px}.comments-body{flex:1;overflow:auto;padding:5px 17px calc(22px + env(safe-area-inset-bottom));overscroll-behavior:contain}.comment-section h3{margin:17px 0 5px;font-size:13px}.comment-card{display:flex;gap:10px;padding:13px 0;border-bottom:1px solid var(--music-divider)}.comment-card>img,.avatar-placeholder{width:34px;height:34px;flex:0 0 auto;border-radius:50%}.comment-card>img{object-fit:cover}.avatar-placeholder{display:grid;place-items:center;background:var(--music-pill-bg);color:var(--music-text-sub);font-size:12px}.comment-main{min-width:0;flex:1}.comment-meta{display:flex;align-items:flex-start;justify-content:space-between;gap:8px}.comment-meta b,.comment-meta small{display:block}.comment-meta b{overflow:hidden;color:var(--music-text-sub);font-size:11px;font-weight:600;text-overflow:ellipsis;white-space:nowrap}.comment-meta small{margin-top:3px;color:var(--music-text-muted);font-size:8px}.comment-meta>span{color:var(--music-text-muted);font-size:9px;white-space:nowrap}.comment-main p{margin:7px 0 0;font-size:12px;line-height:1.65;white-space:pre-wrap;word-break:break-word}.comment-main blockquote{margin:8px 0 0;padding:8px 9px;border:0;border-radius:8px;background:var(--music-secondary-bg);color:var(--music-text-sub);font-size:10px;line-height:1.5}.comments-state{min-height:170px;display:flex;align-items:center;justify-content:center;gap:9px;color:var(--music-text-sub);font-size:11px}.error-state{flex-direction:column}.error-state button,.load-more{border:1px solid var(--music-card-border);border-radius:999px;background:var(--music-pill-bg);color:var(--music-text)}.error-state button{padding:7px 13px}.spinner{width:15px;height:15px;border:2px solid var(--music-divider);border-top-color:var(--music-text-sub);border-radius:50%;animation:spin .8s linear infinite}.load-more{display:block;margin:18px auto 5px;padding:9px 22px;font-size:10px}.load-more:disabled{opacity:.55}.load-note{padding:16px 0 4px;color:var(--music-text-muted);font-size:9px;text-align:center}@keyframes spin{to{transform:rotate(360deg)}}
</style>
