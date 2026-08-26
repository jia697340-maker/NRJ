/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import type { ForumPost } from '../../../types/forum'

const props = defineProps<{
  visible: boolean
  post: ForumPost | null
  isFirst?: boolean
  isLast?: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'toggle-pin', post: ForumPost): void
  (e: 'toggle-keep', post: ForumPost): void
  (e: 'move-up', post: ForumPost): void
  (e: 'move-down', post: ForumPost): void
  (e: 'enter-select', post: ForumPost): void
  (e: 'delete-post', post: ForumPost): void
}>()
</script>

<template>
  <div v-if="visible && post" class="post-action-overlay" @click.self="emit('close')">
    <div class="post-action-sheet">
      <div class="action-sheet-header">
        <span class="action-sheet-pill"></span>
        <h3 class="action-sheet-title">帖子操作</h3>
      </div>

      <div class="action-options-grid">
        <button type="button" class="action-item-btn" @click="emit('toggle-keep', post); emit('close')">
          <div class="action-icon-wrap" :class="{ 'is-active': post.isKept }">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 3h12v18l-6-4-6 4z"/></svg>
          </div>
          <span class="action-item-label">{{ post.isKept ? '取消保留' : '保留生成帖' }}</span>
        </button>
        <!-- 置顶/取消置顶 -->
        <button
          type="button"
          class="action-item-btn"
          @click="emit('toggle-pin', post); emit('close')"
        >
          <div class="action-icon-wrap" :class="{ 'is-active': post.pinned }">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="12" y1="17" x2="12" y2="22"></line>
              <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"></path>
            </svg>
          </div>
          <span class="action-item-label">{{ post.pinned ? '取消置顶' : '置顶帖子' }}</span>
        </button>

        <!-- 上移帖子 -->
        <button
          type="button"
          class="action-item-btn"
          :disabled="isFirst"
          @click="emit('move-up', post); emit('close')"
        >
          <div class="action-icon-wrap">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="m18 15-6-6-6 6"></path>
            </svg>
          </div>
          <span class="action-item-label">上移一位</span>
        </button>

        <!-- 下移帖子 -->
        <button
          type="button"
          class="action-item-btn"
          :disabled="isLast"
          @click="emit('move-down', post); emit('close')"
        >
          <div class="action-icon-wrap">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="m6 9 6 6 6-6"></path>
            </svg>
          </div>
          <span class="action-item-label">下移一位</span>
        </button>

        <!-- 批量管理 -->
        <button
          type="button"
          class="action-item-btn"
          @click="emit('enter-select', post); emit('close')"
        >
          <div class="action-icon-wrap">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="3"></rect>
              <path d="m7.5 12 3 3 6-7"></path>
            </svg>
          </div>
          <span class="action-item-label">多选管理</span>
        </button>

        <!-- 删除此贴 -->
        <button
          type="button"
          class="action-item-btn is-danger"
          @click="emit('delete-post', post); emit('close')"
        >
          <div class="action-icon-wrap">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 6h18m-2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              <line x1="10" y1="11" x2="10" y2="17"></line>
              <line x1="14" y1="11" x2="14" y2="17"></line>
            </svg>
          </div>
          <span class="action-item-label">删除此贴</span>
        </button>
      </div>

      <div class="action-sheet-footer">
        <button type="button" class="action-cancel-btn" @click="emit('close')">取消</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.post-action-overlay {
  position: absolute;
  inset: 0;
  z-index: 600;
  display: flex;
  align-items: flex-end;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(2px);
  animation: fadeIn 0.18s ease-out;
}

.post-action-sheet {
  width: 100%;
  box-sizing: border-box;
  background: var(--sys-bg-secondary, #ffffff);
  border-radius: 20px 20px 0 0;
  padding: 12px 18px calc(14px + env(safe-area-inset-bottom, 0px));
  box-shadow: 0 -8px 32px rgba(0, 0, 0, 0.12);
  animation: slideUp 0.22s cubic-bezier(0.16, 1, 0.3, 1);
}

.action-sheet-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-bottom: 12px;
}

.action-sheet-pill {
  width: 36px;
  height: 4px;
  border-radius: 2px;
  background: var(--border-color, rgba(0, 0, 0, 0.15));
  margin-bottom: 8px;
}

.action-sheet-title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-secondary, #666666);
}

.action-options-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  padding: 10px 0 16px;
}

.action-item-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  border: 0;
  background: transparent;
  padding: 8px 0;
  cursor: pointer;
  color: var(--text-primary, #333333);
  transition: transform 0.12s ease;
}

.action-item-btn:active:not(:disabled) {
  transform: scale(0.92);
}

.action-item-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.action-icon-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: 14px;
  background: var(--sys-bg-tertiary, #f0f2f5);
  color: var(--text-primary, #333333);
  transition: all 0.18s ease;
}

.action-icon-wrap.is-active {
  background: color-mix(in srgb, var(--accent-color, #2b7de9) 15%, var(--sys-bg-secondary, #ffffff));
  color: var(--accent-color, #2b7de9);
}

.action-item-btn.is-danger .action-icon-wrap {
  color: #e04b4b;
  background: color-mix(in srgb, #e04b4b 12%, var(--sys-bg-secondary, #ffffff));
}

.action-item-btn.is-danger .action-item-label {
  color: #e04b4b;
}

.action-item-label {
  font-size: 11.5px;
  font-weight: 500;
  white-space: nowrap;
}

.action-sheet-footer {
  margin-top: 6px;
  border-top: 1px solid var(--border-color, rgba(0, 0, 0, 0.06));
  padding-top: 10px;
}

.action-cancel-btn {
  width: 100%;
  height: 42px;
  border: 0;
  border-radius: 12px;
  background: var(--sys-bg-tertiary, #f0f2f5);
  color: var(--text-primary, #333333);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}

.action-cancel-btn:active {
  background: var(--border-color, #e4e7ed);
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slideUp {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}

@media (max-width: 360px) {
  .action-options-grid {
    gap: 4px;
  }
  .action-icon-wrap {
    width: 42px;
    height: 42px;
  }
  .action-item-label {
    font-size: 10.5px;
  }
}
</style>
