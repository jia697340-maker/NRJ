/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { computed } from 'vue'
import type { WorldBook } from '../../store'

const props = defineProps<{
  activeBook: WorldBook
  bookCovers: Record<string, string>
  bookBackgrounds: Record<string, string>
  isManageMode: boolean
  selectedEntries: Set<string>
  filterMode?: 'all' | 'enabled' | 'disabled' | 'override'
}>()

const emit = defineEmits<{
  (e: 'update:isManageMode', val: boolean): void
  (e: 'openEditModal', field: 'title' | 'author' | 'rating'): void
  (e: 'openTagManager'): void
  (e: 'openVisualSettings'): void
  (e: 'toggleBookSettings'): void
  (e: 'toggleEntrySelect', id: string): void
  (e: 'openEntry', id: string): void
  (e: 'deleteEntry', id: string, event: Event): void
  (e: 'handleNewEntry'): void
  (e: 'toggleSelectAll'): void
  (e: 'deleteSelectedEntries'): void
}>()

const displayEntries = computed(() => {
  if (!props.activeBook || !props.activeBook.entries) return []
  return props.activeBook.entries.map((entry, index) => ({
    ...entry,
    originalIndex: index
  })).filter(entry => {
    if (props.filterMode === 'enabled') return entry.enabled
    if (props.filterMode === 'disabled') return !entry.enabled
    if (props.filterMode === 'override') return entry.overrideSettings
    return true
  })
})

const isAllSelected = computed(() => {
  if (!displayEntries.value || displayEntries.value.length === 0) return false
  const allFilteredIds = displayEntries.value.map(e => e.id)
  return allFilteredIds.every(id => props.selectedEntries.has(id))
})

const toggleManageMode = () => {
  emit('update:isManageMode', !props.isManageMode)
}
</script>

<template>
  <div class="view detail-view">
    <div class="detail-bg-blur" 
          :class="{ 'no-cover-bg': !bookBackgrounds[activeBook.id] && !bookCovers[activeBook.id] }">
      <img v-if="bookBackgrounds[activeBook.id] || bookCovers[activeBook.id]" 
           :src="bookBackgrounds[activeBook.id] || bookCovers[activeBook.id]" 
           class="detail-bg-img-inner"
           :style="{ filter: `blur(${activeBook.bgBlur ?? 40}px) brightness(1.2)` }"
           alt="" />
    </div>
    
    <div class="detail-header">
      <div class="detail-cover-box">
        <div v-if="bookCovers[activeBook.id]" class="detail-cover-img">
          <img :src="bookCovers[activeBook.id]" class="detail-cover-img-inner" alt="" />
        </div>
        <div v-else class="detail-cover-placeholder">无封面</div>
      </div>
      
      <div class="detail-info">
        <div class="detail-title-display clickable" @click="emit('openEditModal', 'title')">
          {{ activeBook.title || '未命名书籍' }}
        </div>
        
        <div class="detail-author-row clickable" @click="emit('openEditModal', 'author')">
          <span class="author-label">作者:</span>
          <span class="author-display">{{ activeBook.author || '未知作者' }}</span>
        </div>

        <div class="detail-tags clickable" @click="emit('openTagManager')">
          <span v-if="!(activeBook.tags && activeBook.tags.length)" class="d-tag empty-tag">点击添加标签...</span>
          <span v-else v-for="(tag, index) in activeBook.tags" :key="index" class="d-tag">
            {{ tag }}
          </span>
        </div>

        <div class="detail-stats">
          <div class="d-stat">
            <strong>{{ activeBook.entries.length }}</strong>
            <span>章节</span>
          </div>
          
          <div class="d-stat rating-stat clickable" @click="emit('openEditModal', 'rating')">
            <strong class="rating-display">{{ activeBook.rating?.toFixed(1) || '0.0' }}</strong>
            <span>评分</span>
          </div>
        </div>
      </div>
    </div>

    <div class="detail-body" :class="{ 'has-bottom-bar': isManageMode }">
      <div class="section-title-wrap">
        <span class="sec-title">Contents</span>
        <div class="section-actions">
          <div class="btn-settings" @click="toggleManageMode">
            <span v-if="!isManageMode">管理</span>
            <span v-else>完成</span>
          </div>
          <div class="btn-settings" @click="emit('toggleBookSettings')" v-show="!isManageMode">
            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
            属性设置
          </div>
        </div>
      </div>

      <div class="chapter-list">
        <div v-if="displayEntries.length === 0" class="empty-chapter-hint">
          当前过滤条件下没有条目
        </div>
        <div 
          v-for="entry in displayEntries" 
          :key="entry.id"
          class="chapter-item"
          :class="{ 'is-selected': selectedEntries.has(entry.id) }"
          @click="isManageMode ? emit('toggleEntrySelect', entry.id) : emit('openEntry', entry.id)"
        >
          <div v-if="isManageMode" class="ch-checkbox">
            <div class="ch-chk-inner" :class="{ checked: selectedEntries.has(entry.id) }">
              <svg v-if="selectedEntries.has(entry.id)" viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="3" fill="none"><polyline points="20 6 9 17 4 12"></polyline></svg>
            </div>
          </div>
          <div class="ch-left">
            <div class="ch-index">第 {{ entry.originalIndex + 1 }} 章</div>
            <div class="ch-title-wrap">
              <span class="ch-title">{{ entry.title || '无标题' }}</span>
              <span v-if="!entry.enabled" class="entry-status-badge disabled-badge">已关闭</span>
              <span v-if="entry.overrideSettings" class="entry-status-badge override-badge">独立参数</span>
            </div>
          </div>
          <div class="ch-right" v-if="!isManageMode">
            <div class="btn-del-ch" @click.stop="emit('deleteEntry', entry.id, $event)">
              <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </div>
          </div>
        </div>
        
        <div v-if="!isManageMode" class="btn-add-chapter" @click="emit('handleNewEntry')">
          <span>+ 新增一页</span>
        </div>
      </div>
    </div>

    <!-- Manage Bottom Bar -->
    <transition name="slide-up">
      <div v-if="isManageMode" class="manage-bottom-bar">
        <div class="manage-btn" @click="emit('toggleSelectAll')">
          {{ isAllSelected ? '取消全选' : '全选' }}
        </div>
        <div class="manage-btn danger" :class="{ disabled: selectedEntries.size === 0 }" @click="emit('deleteSelectedEntries')">
          删除 ({{ selectedEntries.size }})
        </div>
      </div>
    </transition>
  </div>
</template>

<style scoped>
.detail-view { background: var(--sys-bg-secondary); }
.detail-bg-blur {
  position: absolute; top: -56px; left: 0; right: 0; height: 350px;
  z-index: 0; opacity: 0.6; overflow: hidden;
  mask-image: linear-gradient(to bottom, rgba(255,255,255,1) 30%, rgba(255,255,255,0) 100%);
  -webkit-mask-image: linear-gradient(to bottom, rgba(255,255,255,1) 30%, rgba(255,255,255,0) 100%);
}
.detail-bg-img-inner {
  width: 100%; height: 100%; object-fit: cover; object-position: center; display: block;
}
.detail-bg-blur.no-cover-bg {
  background-color: #64748b;
}
.detail-header {
  position: relative; z-index: 10; padding: 24px;
  display: flex; gap: 20px;
}
.detail-cover-box {
  width: 110px; height: 146px; border-radius: 6px; overflow: hidden; flex-shrink: 0;
  box-shadow: 0 8px 24px rgba(0,0,0,0.1); background: var(--sys-bg-primary);
}
.detail-cover-img { width: 100%; height: 100%; overflow: hidden; }
.detail-cover-img-inner { width: 100%; height: 100%; object-fit: cover; object-position: center; display: block; }
.detail-cover-placeholder { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; color: var(--text-tertiary); font-size: 12px; }

.clickable { transition: opacity 0.2s; cursor: pointer; border-radius: 8px; margin: -4px; padding: 4px; }
.clickable:hover { background: rgba(0,0,0,0.04); }

.detail-info { flex: 1; display: flex; flex-direction: column; justify-content: flex-end; align-items: flex-start; }
.detail-title-display { font-size: 24px; font-weight: 700; margin-bottom: 8px; line-height: 1.2; color: var(--text-primary); }

.detail-author-row { display: flex; align-items: center; gap: 6px; margin-bottom: 12px; }
.author-label { font-size: 14px; color: var(--text-tertiary); font-weight: 500;}
.author-display { font-size: 14px; color: var(--text-secondary); font-weight: 600;}

.detail-tags { display: flex; gap: 8px; margin-bottom: 16px; flex-wrap: wrap; }
.d-tag { background: rgba(0,0,0,0.06); color: var(--text-secondary); font-size: 12px; padding: 4px 10px; border-radius: 6px; font-weight: 500; display: inline-block;}
.empty-tag { background: transparent; border: 1px dashed var(--border-color); }

.detail-stats { display: flex; gap: 32px; align-items: center; margin-top: 4px; }
.d-stat { display: flex; flex-direction: column; }
.d-stat strong { font-size: 20px; color: var(--text-primary); line-height: 1.1; font-weight: 800;}
.d-stat span { font-size: 12px; color: var(--text-tertiary); font-weight: 500; margin-top: 2px;}
.rating-stat { align-items: center; }

.detail-body { position: relative; z-index: 10; padding: 0 24px 80px 24px; }
.section-title-wrap {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid var(--border-color);
}
.sec-title { font-size: 18px; font-weight: 700; color: var(--text-primary); }
.btn-settings {
  display: flex; align-items: center; gap: 6px; font-size: 13px; color: var(--text-tertiary);
  background: rgba(0,0,0,0.04); padding: 6px 12px; border-radius: 16px; cursor: pointer; transition: 0.2s;
}
.btn-settings:hover { background: rgba(0,0,0,0.08); color: var(--text-primary); }

.chapter-list { display: flex; flex-direction: column; }
.section-actions { display: flex; gap: 8px; }
.detail-body.has-bottom-bar { padding-bottom: 140px; }

.chapter-item {
  display: flex; justify-content: space-between; align-items: center;
  padding: 16px 0; border-bottom: 1px solid var(--border-color); cursor: pointer; transition: background 0.2s;
}
.chapter-item:hover { background: rgba(0,0,0,0.02); }
.chapter-item.is-selected { background: rgba(59, 130, 246, 0.05); }
.ch-checkbox { margin-right: 12px; display: flex; align-items: center; justify-content: center; }
.ch-chk-inner { width: 20px; height: 20px; border-radius: 6px; border: 2px solid var(--border-color); display: flex; align-items: center; justify-content: center; transition: 0.2s; color: white; }
.ch-chk-inner.checked { background: #3b82f6; border-color: #3b82f6; }
.ch-left { flex: 1; }
.ch-title-wrap { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.entry-status-badge { font-size: 10px; padding: 2px 6px; border-radius: 4px; font-weight: 600; white-space: nowrap; }
.disabled-badge { background: rgba(156, 163, 175, 0.15); color: var(--text-tertiary); }
.override-badge { background: rgba(59, 130, 246, 0.1); color: #3b82f6; }
.empty-chapter-hint { text-align: center; color: var(--text-tertiary); font-size: 14px; padding: 32px 0; }

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
.ch-index { font-size: 12px; color: #3b82f6; font-weight: 600; margin-bottom: 4px; }
.ch-title { font-size: 15px; color: var(--text-secondary); }
.ch-right { opacity: 0; transition: opacity 0.2s; }
.chapter-item:hover .ch-right { opacity: 1; }
.btn-del-ch { color: var(--text-tertiary); padding: 8px; cursor: pointer; }
.btn-del-ch:hover { color: #ef4444; }

.btn-add-chapter {
  margin-top: 16px; padding: 16px; text-align: center;
  border: 1px dashed var(--border-color); border-radius: 8px;
  color: var(--text-tertiary); font-size: 14px; font-weight: 500; cursor: pointer; transition: 0.2s;
}
.btn-add-chapter:hover { border-color: #3b82f6; color: #3b82f6; }

.slide-up-enter-active, .slide-up-leave-active { transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
.slide-up-enter-from, .slide-up-leave-to { transform: translateY(100%); }
</style>
