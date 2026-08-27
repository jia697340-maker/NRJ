/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useForum } from '../../../composables/useForum'
import type { ForumPost, ForumUser, ForumMediaItem, ForumQuoteContent } from '../../../types/forum'
import ForumHeader from '../components/ForumHeader.vue'
import ForumFeedItem from '../components/ForumFeedItem.vue'
import ForumEmptyState from '../components/ForumEmptyState.vue'
import ForumPostActionMenuModal from '../modals/ForumPostActionMenuModal.vue'
import { forumContentKindLabels } from '../../../services/forumContentKinds'

const props = defineProps<{
  posts: ForumPost[]
  mode: 'recommend' | 'following' | 'latest'
  busy?: boolean
  error?: string
  generationSummary?: { postCount: number; kindCounts: Record<string, number>; circleIds: string[]; circleNames: string[] }
}>()
const generationKindSummary = computed(() => Object.entries(props.generationSummary?.kindCounts || {}).map(([kind, count]) => `${forumContentKindLabels[kind as keyof typeof forumContentKindLabels] || kind} ${count}`).join('、'))

const emit = defineEmits<{
  (e: 'back'): void
  (e: 'click-post', post: ForumPost): void
  (e: 'click-user', user: ForumUser): void
  (e: 'click-topic', topic: string): void
  (e: 'preview-image', index: number, media: ForumMediaItem[]): void
  (e: 'click-quote', quote: ForumQuoteContent): void
  (e: 'like', post: ForumPost): void
  (e: 'comment', post: ForumPost): void
  (e: 'share', post: ForumPost): void
  (e: 'bookmark', post: ForumPost): void
  (e: 'open-search'): void
  (e: 'generate'): void
  (e: 'change-mode', mode: 'recommend' | 'following' | 'latest'): void
  (e: 'shown', posts: ForumPost[], mode: 'recommend' | 'following' | 'latest'): void
  (e: 'delete-posts', postIds: string[]): void
  (e: 'toggle-pin', postId: string): void
  (e: 'toggle-keep', postId: string): void
  (e: 'dismiss-generation-summary'): void
  (e: 'open-generated-circle', circleId: string): void
  (e: 'move-post', postId: string, direction: 'up' | 'down'): void
}>()

const forum = useForum()
const scrollContainerRef = ref<HTMLElement | null>(null)
const isSelecting = ref(false)
const selectedPostIds = ref<string[]>([])
const showDeleteConfirm = ref(false)
const singlePostToDelete = ref<ForumPost | null>(null)

const activeActionPost = ref<ForumPost | null>(null)
const isActionMenuVisible = ref(false)

let longPressTimer: ReturnType<typeof setTimeout> | null = null
let touchStartPosition = { x: 0, y: 0 }
let isMoved = false

const saveScrollPosition = () => {
  if (scrollContainerRef.value) {
    forum.setFeedScrollPosition(props.mode, scrollContainerRef.value.scrollTop)
  }
}

const restoreScrollPosition = () => {
  nextTick(() => {
    if (scrollContainerRef.value) {
      const savedTop = forum.getFeedScrollPosition(props.mode)
      scrollContainerRef.value.scrollTop = savedTop
    }
  })
}

const handleScroll = () => {
  if (scrollContainerRef.value) {
    forum.setFeedScrollPosition(props.mode, scrollContainerRef.value.scrollTop)
  }
}

onMounted(() => {
  restoreScrollPosition()
})

onBeforeUnmount(() => {
  saveScrollPosition()
})

const activeSubTab = computed({
  get: () => props.mode,
  set: value => {
    saveScrollPosition()
    emit('change-mode', value)
  }
})
const displayPosts = computed(() => props.posts)

const allDisplayedSelected = computed(() => displayPosts.value.length > 0 && displayPosts.value.every(post => selectedPostIds.value.includes(post.id)))

const isFirstPost = (postId: string) => displayPosts.value[0]?.id === postId
const isLastPost = (postId: string) => displayPosts.value[displayPosts.value.length - 1]?.id === postId

const clearLongPress = () => {
  if (longPressTimer) {
    clearTimeout(longPressTimer)
    longPressTimer = null
  }
}

const handleTouchStart = (post: ForumPost, event: TouchEvent | MouseEvent) => {
  if (isSelecting.value) return
  isMoved = false
  const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX
  const clientY = 'touches' in event ? event.touches[0].clientY : event.clientY
  touchStartPosition = { x: clientX, y: clientY }

  clearLongPress()
  longPressTimer = setTimeout(() => {
    if (!isMoved) {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(35)
      }
      activeActionPost.value = post
      isActionMenuVisible.value = true
    }
  }, 480)
}

const handleTouchMove = (event: TouchEvent | MouseEvent) => {
  if (!longPressTimer) return
  const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX
  const clientY = 'touches' in event ? event.touches[0].clientY : event.clientY
  if (Math.hypot(clientX - touchStartPosition.x, clientY - touchStartPosition.y) > 8) {
    isMoved = true
    clearLongPress()
  }
}

const handleTouchEnd = () => {
  clearLongPress()
}

const enterSelection = (initialPost?: ForumPost) => {
  isSelecting.value = true
  selectedPostIds.value = initialPost ? [initialPost.id] : []
}

const exitSelection = () => {
  isSelecting.value = false
  selectedPostIds.value = []
  showDeleteConfirm.value = false
  singlePostToDelete.value = null
}

const togglePost = (postId: string) => {
  selectedPostIds.value = selectedPostIds.value.includes(postId)
    ? selectedPostIds.value.filter(id => id !== postId)
    : [...selectedPostIds.value, postId]
}

const toggleSelectAll = () => {
  const displayedIds = displayPosts.value.map(post => post.id)
  if (allDisplayedSelected.value) {
    selectedPostIds.value = selectedPostIds.value.filter(id => !displayedIds.includes(id))
  } else {
    selectedPostIds.value = [...new Set([...selectedPostIds.value, ...displayedIds])]
  }
}

const handleSelectionClick = (event: Event, postId: string) => {
  if (!isSelecting.value) return
  event.preventDefault()
  event.stopPropagation()
  togglePost(postId)
}

const handleSinglePostDeleteRequest = (post: ForumPost) => {
  singlePostToDelete.value = post
  showDeleteConfirm.value = true
}

const confirmDelete = () => {
  if (singlePostToDelete.value) {
    emit('delete-posts', [singlePostToDelete.value.id])
    singlePostToDelete.value = null
    showDeleteConfirm.value = false
  } else if (selectedPostIds.value.length) {
    emit('delete-posts', [...selectedPostIds.value])
    exitSelection()
  }
}

watch(activeSubTab, () => {
  if (isSelecting.value) selectedPostIds.value = []
  restoreScrollPosition()
})

watch(() => props.posts.map(post => post.id), (postIds, oldPostIds) => {
  const existingIds = new Set(postIds)
  selectedPostIds.value = selectedPostIds.value.filter(id => existingIds.has(id))
  emit('shown', props.posts.slice(0,10), props.mode)
  if (!oldPostIds || oldPostIds.length === 0) {
    restoreScrollPosition()
  }
}, { immediate:true })
</script>

<template>
  <div class="forum-feed-view">
    <!-- 顶部导航栏与分类 SubTab -->
    <ForumHeader :show-back="!isSelecting" :show-search="!isSelecting" :show-refresh="!isSelecting" :refresh-busy="busy" @back="emit('back')" @search="emit('open-search')" @refresh="emit('generate')">
      <template v-if="isSelecting" #left>
        <button class="selection-header-action" type="button" @click="exitSelection">取消</button>
      </template>
      <template #center>
        <strong v-if="isSelecting" class="selection-count">已选 {{ selectedPostIds.length }} 项</strong>
        <div v-else class="feed-subtabs">
          <button
            class="subtab-item"
            :class="{ 'is-active': activeSubTab === 'following' }"
            type="button"
            @click="activeSubTab = 'following'"
          >
            关注
          </button>
          <button
            class="subtab-item"
            :class="{ 'is-active': activeSubTab === 'recommend' }"
            type="button"
            @click="activeSubTab = 'recommend'"
          >
            推荐
          </button>
          <button
            class="subtab-item"
            :class="{ 'is-active': activeSubTab === 'latest' }"
            type="button"
            @click="activeSubTab = 'latest'"
          >
            最新
          </button>
        </div>
      </template>
      <template #right>
        <button v-if="isSelecting" class="selection-header-action" type="button" :disabled="displayPosts.length === 0" @click="toggleSelectAll">
          {{ allDisplayedSelected ? '取消全选' : '全选' }}
        </button>
      </template>
    </ForumHeader>

    <!-- 动态流滚动容器 -->
    <div ref="scrollContainerRef" class="feed-scroll-container" @scroll.passive="handleScroll">
      <p v-if="error" class="generation-error">{{ error }}</p>
      <div v-if="generationSummary" class="generation-summary">
        <div><b>本轮已生成 {{generationSummary.postCount}} 篇</b><span>实际类型：{{generationKindSummary}}<template v-if="generationSummary.circleNames.length"> · 新圈子：<button v-for="(name,index) in generationSummary.circleNames" :key="generationSummary.circleIds[index]" type="button" @click="emit('open-generated-circle',generationSummary.circleIds[index])">{{name}}</button></template><template v-else> · 本轮未发现新圈子</template></span></div>
        <button type="button" aria-label="关闭本轮结果" @click="emit('dismiss-generation-summary')">×</button>
      </div>
      <template v-if="displayPosts.length > 0">
        <div
          v-for="post in displayPosts"
          :key="post.id"
          class="selectable-post"
          :class="{ 'is-selecting': isSelecting, 'is-selected': selectedPostIds.includes(post.id) }"
          @click.capture="handleSelectionClick($event, post.id)"
          @touchstart="handleTouchStart(post, $event)"
          @touchmove="handleTouchMove($event)"
          @touchend="handleTouchEnd"
          @touchcancel="handleTouchEnd"
          @mousedown="handleTouchStart(post, $event)"
          @mousemove="handleTouchMove($event)"
          @mouseup="handleTouchEnd"
          @mouseleave="handleTouchEnd"
        >
          <span v-if="isSelecting" class="post-selection-checkbox" aria-hidden="true">
            <svg v-if="selectedPostIds.includes(post.id)" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 4 4L19 6"></path></svg>
          </span>
          <ForumFeedItem
            :post="post"
            @click-post="emit('click-post', post)"
            @click-user="u => emit('click-user', u)"
            @click-topic="t => emit('click-topic', t)"
            @preview-image="(i, m) => emit('preview-image', i, m)"
            @click-quote="q => emit('click-quote', q)"
            @like="p => emit('like', p)"
            @comment="p => emit('comment', p)"
            @share="p => emit('share', p)"
            @bookmark="p => emit('bookmark', p)"
          />
        </div>
      </template>
      <ForumEmptyState
        v-else
        title="暂无动态"
        :description="activeSubTab==='following'?'你关注的作者还没有发布新动态':'社区暂时还没有可见的新动态'"
        action-text="去推荐逛逛"
        @action="activeSubTab = 'recommend'"
      />
    </div>

    <transition name="slide-up">
      <div v-if="isSelecting" class="selection-toolbar">
        <div class="toolbar-info">
          <span class="info-label">已选择</span>
          <strong class="info-count">{{ selectedPostIds.length }}</strong>
          <span class="info-unit">篇动态</span>
        </div>
        <div class="toolbar-actions">
          <button
            class="delete-btn"
            type="button"
            :disabled="selectedPostIds.length === 0"
            @click="showDeleteConfirm = true"
          >
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 6h18m-2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              <line x1="10" y1="11" x2="10" y2="17"></line>
              <line x1="14" y1="11" x2="14" y2="17"></line>
            </svg>
            <span>删除所选{{ selectedPostIds.length > 0 ? ` (${selectedPostIds.length})` : '' }}</span>
          </button>
        </div>
      </div>
    </transition>

    <!-- 长按快捷操作菜单 -->
    <ForumPostActionMenuModal
      :visible="isActionMenuVisible"
      :post="activeActionPost"
      :is-first="activeActionPost ? isFirstPost(activeActionPost.id) : false"
      :is-last="activeActionPost ? isLastPost(activeActionPost.id) : false"
      @close="isActionMenuVisible = false"
      @toggle-pin="p => emit('toggle-pin', p.id)"
      @toggle-keep="p => emit('toggle-keep', p.id)"
      @move-up="p => emit('move-post', p.id, 'up')"
      @move-down="p => emit('move-post', p.id, 'down')"
      @enter-select="p => enterSelection(p)"
      @delete-post="p => handleSinglePostDeleteRequest(p)"
    />

    <div v-if="showDeleteConfirm" class="delete-confirm-overlay" @click.self="showDeleteConfirm = false">
      <section role="alertdialog" aria-modal="true" aria-labelledby="forum-delete-title">
        <h2 id="forum-delete-title">
          {{ singlePostToDelete ? '删除这篇帖子？' : `删除选中的 ${selectedPostIds.length} 篇帖子？` }}
        </h2>
        <p>帖子及其评论、投票和抽奖记录将一并删除，且无法恢复。</p>
        <div><button type="button" @click="showDeleteConfirm = false">取消</button><button class="danger" type="button" @click="confirmDelete">确认删除</button></div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.forum-feed-view {
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--sys-bg-primary, #f5f5f7);
}

.selection-header-action {
  min-width: 40px;
  height: 34px;
  padding: 0 4px;
  border: 0;
  background: transparent;
  color: var(--accent-color, #2b7de9);
  font-size: 13px;
  white-space: nowrap;
}

.selection-header-action:disabled { opacity: 0.4; }
.selection-count { font-size: 14px; color: var(--text-primary, #222222); }

.manage-posts-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--text-primary, #333333);
}

.manage-posts-button:active { background: var(--sys-bg-tertiary, #f0f0f0); transform: scale(0.92); }

.feed-subtabs {
  display: flex;
  align-items: center;
  gap: 16px;
}

.subtab-item {
  background: transparent;
  border: 0;
  font-size: 15px;
  font-weight: 500;
  color: var(--text-tertiary, #888888);
  cursor: pointer;
  padding: 4px 0;
  position: relative;
  transition: color 0.15s ease;
}

.subtab-item.is-active {
  font-weight: 700;
  color: var(--text-primary, #111111);
}

.subtab-item.is-active::after {
  content: '';
  position: absolute;
  bottom: -4px;
  left: 50%;
  transform: translateX(-50%);
  width: 16px;
  height: 2.5px;
  border-radius: 999px;
  background: var(--accent-color, #2b7de9);
}

.feed-scroll-container {
  flex: 1;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}
.selectable-post {
  position: relative;
  transition: background-color 0.18s ease;
  cursor: pointer;
}

.selectable-post.is-selecting {
  padding-left: 48px;
  background: var(--sys-bg-secondary, #ffffff);
  user-select: none;
}

.selectable-post.is-selecting :deep(.forum-feed-item) {
  padding-left: 6px;
  padding-right: 16px;
}

.selectable-post.is-selecting :deep(.forum-post-actions) {
  opacity: 0.35;
  pointer-events: none;
}

.selectable-post.is-selected {
  background: color-mix(in srgb, var(--accent-color, #2b7de9) 8%, var(--sys-bg-secondary, #ffffff));
}

.selectable-post.is-selected :deep(.forum-feed-item) {
  background: transparent;
}

.post-selection-checkbox {
  position: absolute;
  z-index: 2;
  top: 25px;
  left: 16px;
  display: inline-flex;
  width: 22px;
  height: 22px;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  border: 1.8px solid var(--border-color, #c0c4cc);
  border-radius: 50%;
  background: var(--sys-bg-secondary, #fff);
  color: #fff;
  transition: all 0.18s cubic-bezier(0.16, 1, 0.3, 1);
}

.is-selected .post-selection-checkbox {
  border-color: var(--accent-color, #2b7de9);
  background: var(--accent-color, #2b7de9);
  transform: scale(1.05);
  box-shadow: 0 2px 6px rgba(43, 125, 233, 0.28);
}

.selection-toolbar {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 56px;
  padding: 8px 16px calc(8px + env(safe-area-inset-bottom, 0px));
  box-sizing: border-box;
  border-top: 1px solid var(--border-color, rgba(0, 0, 0, 0.08));
  background: var(--sys-bg-secondary, #ffffff);
  box-shadow: 0 -4px 18px rgba(0, 0, 0, 0.05);
  z-index: 50;
}

.toolbar-info {
  display: flex;
  align-items: baseline;
  gap: 4px;
  color: var(--text-secondary, #666666);
  font-size: 13px;
}

.info-label {
  font-size: 13px;
}

.info-count {
  font-size: 16px;
  font-weight: 700;
  color: var(--accent-color, #2b7de9);
}

.info-unit {
  font-size: 13px;
}

.toolbar-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.delete-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 38px;
  padding: 0 18px;
  border: 0;
  border-radius: 999px;
  background: #e04b4b;
  color: #ffffff;
  font-size: 13.5px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
  box-shadow: 0 2px 8px rgba(224, 75, 75, 0.25);
}

.delete-btn:active:not(:disabled) {
  transform: scale(0.96);
  background: #c93b3b;
}

.delete-btn:disabled {
  opacity: 0.4;
  box-shadow: none;
  cursor: not-allowed;
}

.slide-up-enter-active,
.slide-up-leave-active {
  transition: transform 0.22s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s ease;
}

.slide-up-enter-from,
.slide-up-leave-to {
  transform: translateY(100%);
  opacity: 0;
}
.delete-confirm-overlay { position: absolute; inset: 0; z-index: 300; display: flex; align-items: center; justify-content: center; padding: 20px; background: rgba(0, 0, 0, 0.34); }
.delete-confirm-overlay section { width: min(100%, 320px); box-sizing: border-box; border-radius: 16px; background: var(--sys-bg-secondary, #fff); padding: 20px; text-align: center; box-shadow: 0 12px 36px rgba(0, 0, 0, 0.18); }
.delete-confirm-overlay h2 { margin: 0; color: var(--text-primary, #222); font-size: 16px; }
.delete-confirm-overlay p { margin: 10px 0 18px; color: var(--text-secondary, #777); font-size: 12px; line-height: 1.55; }
.delete-confirm-overlay section div { display: flex; gap: 10px; }
.delete-confirm-overlay button { flex: 1; height: 38px; border: 0; border-radius: 10px; background: var(--sys-bg-tertiary, #f0f0f0); color: var(--text-primary, #333); font-size: 13px; }
.delete-confirm-overlay button.danger { background: #d94b4b; color: #fff; }
.generation-error{margin:0;padding:7px 16px;background:color-mix(in srgb,#d44c4c 7%,var(--sys-bg-secondary,#fff));color:#c24a4a;font-size:10.5px;line-height:1.4}@media(max-width:340px){.generation-error{padding-left:12px;padding-right:12px}}
.generation-summary{display:flex;align-items:center;gap:10px;margin:9px 12px;padding:10px 11px;border:1px solid color-mix(in srgb,var(--accent-color,#2b7de9) 18%,transparent);border-radius:11px;background:color-mix(in srgb,var(--accent-color,#2b7de9) 6%,var(--sys-bg-secondary,#fff))}.generation-summary>div{display:flex;min-width:0;flex:1;flex-direction:column;gap:2px}.generation-summary b{font-size:12px}.generation-summary span{overflow:hidden;color:var(--text-secondary,#777);font-size:10.5px;line-height:1.35;text-overflow:ellipsis;white-space:nowrap}.generation-summary span button{border:0;background:transparent;padding:0;color:var(--accent-color,#576b95);font:inherit}.generation-summary>button{flex:0 0 auto;width:25px;height:25px;border:0;border-radius:50%;background:var(--sys-bg-tertiary,#eee);color:var(--text-secondary,#777);font-size:16px}
</style>
