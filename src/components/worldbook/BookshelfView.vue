/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { ref, computed } from 'vue'
import type { WorldBook, WorldBookGroup } from '../../store'

const props = defineProps<{
  worldBooks: WorldBook[]
  worldBookGroups: WorldBookGroup[]
  bookCovers: Record<string, string>
  isShelfManageMode: boolean
  selectedBooks: Set<string>
}>()

const emit = defineEmits<{
  (e: 'update:isShelfManageMode', val: boolean): void
  (e: 'openBook', id: string): void
  (e: 'openGroupManager'): void
  (e: 'toggleBookSelect', id: string): void
  (e: 'handlePressStart', id: string): void
  (e: 'handlePressEnd'): void
  (e: 'handleContextMenu', id: string, event: Event): void
  (e: 'deleteSingleBook', id: string, event: Event): void
  (e: 'toggleSelectAllBooks'): void
  (e: 'openMoveModal', ids: string[]): void
  (e: 'openCopyModal', ids: string[]): void
  (e: 'deleteSelectedBooks'): void
  (e: 'exitApp'): void
}>()

const activeGroupId = ref<string>('all')

const filteredWorldBooks = computed(() => {
  if (activeGroupId.value === 'all') {
    return props.worldBooks
  }
  return props.worldBooks.filter(book => book.groupIds && book.groupIds.includes(activeGroupId.value))
})

const isAllBooksSelected = computed(() => {
  if (filteredWorldBooks.value.length === 0) return false
  return props.selectedBooks.size === filteredWorldBooks.value.length
})

const toggleShelfManageMode = () => {
  emit('update:isShelfManageMode', !props.isShelfManageMode)
}

let isLongPress = false
const handleClickBook = (id: string) => {
  if (isLongPress) {
    isLongPress = false
    return
  }
  emit('openBook', id)
}

const getDefaultCoverClass = (index: number) => {
  // 替换为更柔和的纸张感配色
  const styles = ['cover-ivory', 'cover-purewhite', 'cover-softgray']
  return styles[index % 3]
}

const getCoverTitle = (title?: string) => {
  return title || '未命名'
}
</script>

<template>
  <div class="view shelf-view">
    <!-- Hero Section with Arch Photo -->
    <div class="hero-section">
      <div class="hero-arch" @click="emit('exitApp')" style="cursor: pointer;"></div>
      <div class="hero-content">
        <div class="quote">“我相信你的爱。”让这句话做我的最后的话。</div>
        <div class="author">—— Let this be my last word, that I trust in thy love.</div>
        <div class="photo-credit">Photo by Ahmed Nishaath on Unsplash</div>
      </div>
    </div>

    <!-- Compact Index Tabs -->
    <div class="index-tabs-wrap">
      <div class="index-tabs">
        <span class="index-tab" :class="{ active: activeGroupId === 'all' }" @click="activeGroupId = 'all'">全部</span>
        <span class="index-dot">·</span>
        
        <template v-for="(grp, idx) in worldBookGroups" :key="grp.id">
          <span class="index-tab" :class="{ active: activeGroupId === grp.id }" @click="activeGroupId = grp.id">{{ grp.name }}</span>
          <span v-if="idx < worldBookGroups.length - 1" class="index-dot">·</span>
        </template>
        
        <div class="index-action" @click="emit('openGroupManager')">
          <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
        </div>
      </div>
      
      <div class="index-manage-btn" @click="toggleShelfManageMode">
        <span v-if="!isShelfManageMode">批量管理</span>
        <span v-else style="color: #3b82f6;">退出管理</span>
      </div>
    </div>
    
    <!-- Shelf Grid -->
    <div class="bookshelf-grid" :class="{ 'has-bottom-bar': isShelfManageMode }">
      <div 
        v-for="(item, index) in filteredWorldBooks" 
        :key="item.id"
        class="book-item"
        :class="{ 'is-selected': selectedBooks.has(item.id) }"
        @mousedown="!isShelfManageMode && emit('handlePressStart', item.id)"
        @mouseup="!isShelfManageMode && emit('handlePressEnd')"
        @mouseleave="!isShelfManageMode && emit('handlePressEnd')"
        @touchstart="!isShelfManageMode && emit('handlePressStart', item.id)"
        @touchend="!isShelfManageMode && emit('handlePressEnd')"
        @touchcancel="!isShelfManageMode && emit('handlePressEnd')"
        @click="isShelfManageMode ? emit('toggleBookSelect', item.id) : handleClickBook(item.id)"
        @contextmenu.prevent="!isShelfManageMode && emit('handleContextMenu', item.id, $event)"
      >
        <div class="book-cover-wrap">
          <!-- 实体书书脊阴影 -->
          <div class="book-spine-shadow"></div>
          
          <div v-if="bookCovers[item.id]" class="book-cover custom-cover" :style="{ backgroundImage: `url(${bookCovers[item.id]})` }"></div>
          <div v-else class="book-cover default-cover" :class="getDefaultCoverClass(index)">
            <!-- 雅致的内边框 -->
            <div class="cover-inner-border"></div>
          </div>
          
          <div v-if="!item.enabled" class="book-disabled-mark"></div>
          
          <div v-if="isShelfManageMode" class="book-checkbox">
            <div class="ch-chk-inner" :class="{ checked: selectedBooks.has(item.id) }">
              <svg v-if="selectedBooks.has(item.id)" viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="3" fill="none"><polyline points="20 6 9 17 4 12"></polyline></svg>
            </div>
          </div>
        </div>
        
        <div class="book-info">
          <div class="book-title">{{ item.title || '未命名' }}</div>
          <div class="book-meta">{{ item.entries.length }} chaps</div>
        </div>
      </div>
    </div>

    <!-- Shelf Manage Bottom Bar -->
    <transition name="slide-up">
      <div v-if="isShelfManageMode" class="manage-bottom-bar" style="flex-wrap: wrap;">
        <div class="manage-btn" @click="emit('toggleSelectAllBooks')">
          {{ isAllBooksSelected ? '取消全选' : '全选' }}
        </div>
        <div class="manage-btn" :class="{ disabled: selectedBooks.size === 0 }" @click="selectedBooks.size > 0 && emit('openMoveModal', Array.from(selectedBooks))">
          转移
        </div>
        <div class="manage-btn" :class="{ disabled: selectedBooks.size === 0 }" @click="selectedBooks.size > 0 && emit('openCopyModal', Array.from(selectedBooks))">
          复制
        </div>
        <div class="manage-btn danger" :class="{ disabled: selectedBooks.size === 0 }" @click="emit('deleteSelectedBooks')">
          删除 ({{ selectedBooks.size }})
        </div>
      </div>
    </transition>
  </div>
</template>

<style scoped>
/* Hero Section */
.hero-section {
  display: flex; align-items: center; gap: 16px;
  padding: 16px 24px; margin-top: 8px;
}
.hero-arch {
  width: 80px; height: 110px; flex-shrink: 0;
  border-radius: 40px 40px 0 0;
  background-image: url('/dove.jpg');
  background-size: cover; background-position: center 30%;
  box-shadow: inset 0 0 0 1px rgba(0,0,0,0.05), 0 4px 12px rgba(0,0,0,0.05);
  position: relative;
}
.hero-content {
  display: flex; flex-direction: column; justify-content: center;
}
.quote {
  font-family: "Georgia", "Times New Roman", serif;
  font-size: 14px; line-height: 1.6; color: var(--text-secondary);
  font-style: italic; margin-bottom: 6px;
}
.author { font-size: 11px; color: var(--text-tertiary); letter-spacing: 0.5px; }
.photo-credit { font-size: 9px; color: rgba(0,0,0,0.2); margin-top: 4px; }

/* Compact Index Tabs */
.index-tabs-wrap {
  padding: 0 24px 12px; display: flex; justify-content: space-between; align-items: flex-end;
  border-bottom: 1px solid rgba(0,0,0,0.06); margin-bottom: 16px;
}
.index-tabs {
  display: flex; flex-wrap: wrap; align-items: center; gap: 6px; flex: 1;
}
.index-tab {
  font-size: 13px; color: var(--text-tertiary); cursor: pointer; transition: 0.2s;
  position: relative; padding: 2px 4px; border-radius: 4px;
}
.index-tab:hover { color: var(--text-secondary); }
.index-tab.active {
  color: var(--text-primary); font-weight: 600;
}
.index-tab.active::after {
  content: ''; position: absolute; bottom: -2px; left: 4px; right: 4px;
  height: 2px; background: var(--text-primary); border-radius: 1px;
}
.index-dot { color: rgba(0,0,0,0.15); font-size: 14px; line-height: 1; margin: 0 2px; }
.index-action {
  color: var(--text-tertiary); cursor: pointer; padding: 4px; border-radius: 50%; margin-left: 4px;
  display: flex; align-items: center; justify-content: center; transition: 0.2s;
}
.index-action:hover { background: rgba(0,0,0,0.05); color: var(--text-primary); }

.index-manage-btn {
  font-size: 12px; color: var(--text-tertiary); cursor: pointer;
  padding: 4px 8px; border-radius: 12px; transition: 0.2s; background: rgba(0,0,0,0.03);
}
.index-manage-btn:hover { background: rgba(0,0,0,0.06); color: var(--text-primary); }

/* Bookshelf Grid */
.bookshelf-grid {
  padding: 0 24px 100px;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px 12px; /* vertical 16px, horizontal 12px */
}
.bookshelf-grid.has-bottom-bar { padding-bottom: 140px; }

.book-item {
  display: flex; flex-direction: column; align-items: center;
  cursor: pointer;
  transition: transform 0.2s;
}
.book-item:active { transform: scale(0.96); }

.book-cover-wrap {
  width: 100%;
  aspect-ratio: 3 / 4;
  position: relative;
  border-radius: 4px;
  overflow: hidden;
  box-shadow: 0 4px 10px rgba(0,0,0,0.05), inset 0 0 0 1px rgba(0,0,0,0.05);
  margin-bottom: 8px;
}

.book-cover {
  width: 100%; height: 100%;
  display: flex; align-items: center; justify-content: center;
  box-sizing: border-box;
}

.book-spine-shadow {
  position: absolute; top: 0; left: 0; bottom: 0; width: 8px;
  background: linear-gradient(to right, rgba(0,0,0,0.12) 0%, rgba(0,0,0,0.03) 30%, transparent 100%);
  z-index: 5; pointer-events: none;
}

.custom-cover {
  background-size: cover; background-position: center;
}

.default-cover {
  position: relative;
  font-family: "Songti SC", "SimSun", "Georgia", serif; /* 优雅的宋体衬线 */
}

.cover-inner-border {
  position: absolute; top: 6px; left: 10px; right: 6px; bottom: 6px;
  border: 1px solid rgba(0,0,0,0.06);
  pointer-events: none; z-index: 1;
}

/* 纸张感配色 */
.cover-ivory {
  background: #F9F6F0; /* 羊皮纸/象牙白 */
  border: 1px solid rgba(0,0,0,0.04);
}

.cover-purewhite {
  background: #FFFFFF;
  border: 1px solid rgba(0,0,0,0.08);
}

.cover-softgray {
  background: #F0F1F3; /* 浅雅灰 */
  border: 1px solid rgba(0,0,0,0.05);
}

.book-disabled-mark {
  position: absolute; top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(255,255,255,0.6); backdrop-filter: grayscale(1);
}

.book-checkbox {
  position: absolute;
  top: 4px; right: 4px;
  z-index: 10;
}
.ch-chk-inner { 
  width: 18px; height: 18px; border-radius: 50%;
  background: rgba(255,255,255,0.8);
  border: 1px solid rgba(0,0,0,0.15); 
  display: flex; align-items: center; justify-content: center; transition: 0.2s; color: white;
  backdrop-filter: blur(4px);
}
.ch-chk-inner.checked { background: #1A1A1A; border-color: #1A1A1A; }
.ch-chk-inner svg { width: 10px; height: 10px; }

.book-info {
  width: 100%;
  text-align: center;
  display: flex; flex-direction: column; gap: 2px;
}

.book-title {
  font-size: 12px; font-weight: 600; color: var(--text-primary);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  width: 100%;
}

.book-meta {
  font-family: "Georgia", serif; font-size: 10px; color: var(--text-tertiary);
  font-style: italic; white-space: nowrap;
}

.manage-bottom-bar {
  position: fixed; bottom: 0; left: 0; right: 0; padding: 16px 24px; padding-bottom: calc(16px + env(safe-area-inset-bottom));
  background: rgba(255,255,255,0.9); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
  border-top: 1px solid var(--border-color); display: flex; gap: 16px; z-index: 40;
}
.manage-btn {
  flex: 1; text-align: center; padding: 12px 0; font-size: 15px; font-weight: 600;
  background: var(--sys-bg-primary); color: var(--text-secondary); border-radius: 12px; cursor: pointer; transition: 0.2s;
}
.manage-btn:hover { background: #e5e7eb; }
.manage-btn.danger { background: #fee2e2; color: #ef4444; }
.manage-btn.danger:hover:not(.disabled) { background: #fecaca; }
.manage-btn.disabled { opacity: 0.5; cursor: not-allowed; }

.slide-up-enter-active, .slide-up-leave-active { transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
.slide-up-enter-from, .slide-up-leave-to { transform: translateY(100%); }

</style>
