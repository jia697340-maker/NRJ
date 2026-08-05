/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
const props = defineProps<{
  searchText: string
  searchResults: any[]
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'update:searchText', val: string): void
  (e: 'jump-to-chat', id: string | number): void
}>()

const handleInput = (e: Event) => {
  const target = e.target as HTMLInputElement
  emit('update:searchText', target.value)
}
</script>

<template>
  <div class="canvas-modal-overlay" style="z-index: 10002;" @click.self="emit('close')">
    <div class="search-contact-modal">
      <div class="scm-header">
        <div class="scm-search-box">
          <svg viewBox="0 0 24 24" width="16" height="16" stroke="var(--text-tertiary)" stroke-width="2" fill="none"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          <input type="text" :value="searchText" @input="handleInput" class="scm-input" placeholder="搜索联系人姓名..." autofocus />
        </div>
        <div class="scm-cancel" @click="emit('close')">取消</div>
      </div>
      <div class="scm-body">
        <div v-if="!searchText" class="scm-empty">请在上方输入以搜索联系人</div>
        <div v-else-if="searchResults.length === 0" class="scm-empty">未找到匹配的联系人</div>
        <div 
          v-for="res in searchResults" 
          :key="res.id" 
          class="scm-result-item"
          @click="emit('jump-to-chat', res.id)"
        >
          <div class="scm-avatar" :style="res.avatarUrl ? { backgroundImage: `url(${res.avatarUrl})` } : {}">{{ res.avatarUrl ? '' : res.avatarText }}</div>
          <div class="scm-name">{{ res.name }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 搜索联系人弹窗 */
.search-contact-modal {
  width: 90%;
  max-width: 400px;
  min-height: 200px;
  max-height: 80vh;
  background: var(--sys-bg-primary);
  border-radius: 16px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 20px 50px rgba(0,0,0,0.2);
  animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}
.scm-header {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  background: var(--sys-bg-secondary);
  border-bottom: 1px solid var(--border-color);
  gap: 12px;
}
.scm-search-box {
  flex: 1;
  display: flex;
  align-items: center;
  background: var(--sys-bg-primary);
  border-radius: 10px;
  padding: 8px 12px;
  gap: 8px;
  border: 1px solid var(--border-color);
}
.scm-input {
  flex: 1;
  border: none;
  background: transparent;
  outline: none;
  font-size: 15px;
  color: var(--text-primary);
}
.scm-cancel {
  font-size: 15px;
  color: #007aff;
  cursor: pointer;
  white-space: nowrap;
}
.scm-body {
  flex: 1;
  overflow-y: auto;
  padding: 12px 0;
}
.scm-empty {
  text-align: center;
  color: var(--text-tertiary);
  font-size: 14px;
  padding: 30px 0;
}
.scm-result-item {
  display: flex;
  align-items: center;
  padding: 12px 20px;
  gap: 16px;
  cursor: pointer;
  transition: background 0.2s;
}
.scm-result-item:active, .scm-result-item:hover {
  background: var(--sys-bg-secondary);
}
.scm-avatar {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: var(--sys-bg-secondary);
  background-size: cover;
  background-position: center;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  color: var(--text-secondary);
}
.scm-name {
  font-size: 16px;
  color: var(--text-primary);
  font-weight: 500;
}

@keyframes slideUp {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}
.canvas-modal-overlay {
  z-index: 9999;
}
</style>
