/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { ForumPost, ForumUser, ForumMediaItem, ForumQuoteContent } from '../../../types/forum'
import ForumHeader from '../components/ForumHeader.vue'
import ForumFeedItem from '../components/ForumFeedItem.vue'
import ForumEmptyState from '../components/ForumEmptyState.vue'

const props = defineProps<{
  posts: ForumPost[]
  mode: 'recommend' | 'following' | 'latest'
  busy?: boolean
  error?: string
}>()

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
}>()

const isSelecting = ref(false)
const selectedPostIds = ref<string[]>([])
const showDeleteConfirm = ref(false)

const activeSubTab = computed({ get:()=>props.mode, set:value=>emit('change-mode',value) })
const displayPosts = computed(() => props.posts)

const allDisplayedSelected = computed(() => displayPosts.value.length > 0 && displayPosts.value.every(post => selectedPostIds.value.includes(post.id)))

const enterSelection = () => {
  isSelecting.value = true
  selectedPostIds.value = []
}

const exitSelection = () => {
  isSelecting.value = false
  selectedPostIds.value = []
  showDeleteConfirm.value = false
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

const confirmDelete = () => {
  if (!selectedPostIds.value.length) return
  emit('delete-posts', [...selectedPostIds.value])
  exitSelection()
}

watch(activeSubTab, () => {
  if (isSelecting.value) selectedPostIds.value = []
})

watch(() => props.posts.map(post => post.id), postIds => {
  const existingIds = new Set(postIds)
  selectedPostIds.value = selectedPostIds.value.filter(id => existingIds.has(id))
  emit('shown', props.posts.slice(0,10), props.mode)
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
        <button v-else-if="displayPosts.length" class="manage-posts-button" type="button" aria-label="批量管理帖子" title="批量管理帖子" @click="enterSelection">
          <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="3"></rect>
            <path d="m7.5 12 3 3 6-7"></path>
          </svg>
        </button>
      </template>
    </ForumHeader>

    <!-- 动态流滚动容器 -->
    <div class="feed-scroll-container">
      <p v-if="error" class="generation-error">{{ error }}</p>
      <template v-if="displayPosts.length > 0">
        <div
          v-for="post in displayPosts"
          :key="post.id"
          class="selectable-post"
          :class="{ 'is-selecting': isSelecting, 'is-selected': selectedPostIds.includes(post.id) }"
          @click.capture="handleSelectionClick($event, post.id)"
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

    <div v-if="isSelecting" class="selection-toolbar">
      <span>已选择 {{ selectedPostIds.length }} 篇帖子</span>
      <button type="button" :disabled="selectedPostIds.length === 0" @click="showDeleteConfirm = true">删除所选</button>
    </div>

    <div v-if="showDeleteConfirm" class="delete-confirm-overlay" @click.self="showDeleteConfirm = false">
      <section role="alertdialog" aria-modal="true" aria-labelledby="forum-delete-title">
        <h2 id="forum-delete-title">删除选中的 {{ selectedPostIds.length }} 篇帖子？</h2>
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
.selectable-post { position: relative; }
.selectable-post.is-selecting { padding-left: 42px; background: var(--sys-bg-secondary, #ffffff); }
.selectable-post.is-selecting :deep(.forum-feed-item) { padding-left: 0; }
.selectable-post.is-selected { background: color-mix(in srgb, var(--accent-color, #2b7de9) 6%, var(--sys-bg-secondary, #ffffff)); }
.post-selection-checkbox { position: absolute; z-index: 2; top: 23px; left: 14px; display: inline-flex; width: 20px; height: 20px; align-items: center; justify-content: center; box-sizing: border-box; border: 1.5px solid var(--border-color, #b8b8b8); border-radius: 50%; background: var(--sys-bg-secondary, #fff); color: #fff; }
.is-selected .post-selection-checkbox { border-color: var(--accent-color, #2b7de9); background: var(--accent-color, #2b7de9); }
.selection-toolbar { display: flex; flex: 0 0 auto; align-items: center; justify-content: space-between; gap: 12px; min-height: 54px; padding: 7px 16px calc(7px + env(safe-area-inset-bottom, 0px)); box-sizing: border-box; border-top: 1px solid var(--border-color, rgba(0, 0, 0, 0.08)); background: var(--sys-bg-secondary, #fff); box-shadow: 0 -5px 16px rgba(0, 0, 0, 0.04); }
.selection-toolbar span { font-size: 12px; color: var(--text-secondary, #777); }
.selection-toolbar button { height: 36px; padding: 0 17px; border: 0; border-radius: 999px; background: #d94b4b; color: #fff; font-size: 13px; font-weight: 600; }
.selection-toolbar button:disabled { opacity: 0.38; }
.delete-confirm-overlay { position: absolute; inset: 0; z-index: 300; display: flex; align-items: center; justify-content: center; padding: 20px; background: rgba(0, 0, 0, 0.34); }
.delete-confirm-overlay section { width: min(100%, 320px); box-sizing: border-box; border-radius: 16px; background: var(--sys-bg-secondary, #fff); padding: 20px; text-align: center; box-shadow: 0 12px 36px rgba(0, 0, 0, 0.18); }
.delete-confirm-overlay h2 { margin: 0; color: var(--text-primary, #222); font-size: 16px; }
.delete-confirm-overlay p { margin: 10px 0 18px; color: var(--text-secondary, #777); font-size: 12px; line-height: 1.55; }
.delete-confirm-overlay section div { display: flex; gap: 10px; }
.delete-confirm-overlay button { flex: 1; height: 38px; border: 0; border-radius: 10px; background: var(--sys-bg-tertiary, #f0f0f0); color: var(--text-primary, #333); font-size: 13px; }
.delete-confirm-overlay button.danger { background: #d94b4b; color: #fff; }
.generation-error{margin:0;padding:7px 16px;background:color-mix(in srgb,#d44c4c 7%,var(--sys-bg-secondary,#fff));color:#c24a4a;font-size:10.5px;line-height:1.4}@media(max-width:340px){.generation-error{padding-left:12px;padding-right:12px}}
</style>
